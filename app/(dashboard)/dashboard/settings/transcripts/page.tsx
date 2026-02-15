'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Upload,
    FileText,
    Trash2,
    Loader2,
    CheckCircle2,
    AlertCircle,
    Plus,
    X,
    FolderDown,
} from 'lucide-react';
import Link from 'next/link';
import { parseTranscript, titleFromFilename, autoDetectTags } from '@/lib/training/transcript-parser';

interface Transcript {
    id: string;
    title: string;
    tags?: string;
    status: string;
    wordCount?: number;
    createdAt: string;
}

export default function TranscriptUploadPage() {
    const [transcripts, setTranscripts] = useState<Transcript[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [seeding, setSeeding] = useState(false);
    const [seedResult, setSeedResult] = useState<string | null>(null);
    const [dragActive, setDragActive] = useState(false);
    const [showPaste, setShowPaste] = useState(false);
    const [pasteTitle, setPasteTitle] = useState('');
    const [pasteContent, setPasteContent] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const fetchTranscripts = useCallback(async () => {
        try {
            const res = await fetch('/api/training/transcripts');
            const data = await res.json();
            setTranscripts(data.transcripts || []);
        } catch (err) {
            console.error('Error fetching transcripts:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchTranscripts();
    }, [fetchTranscripts]);

    // Poll for processing status updates
    useEffect(() => {
        const hasProcessing = transcripts.some((t) => t.status === 'processing');
        if (!hasProcessing) return;

        const interval = setInterval(fetchTranscripts, 5000);
        return () => clearInterval(interval);
    }, [transcripts, fetchTranscripts]);

    const handleUpload = async (files: File[]) => {
        if (files.length === 0) return;
        setUploading(true);

        try {
            const uploads = await Promise.all(
                files.slice(0, 10).map(async (file) => {
                    const raw = await file.text();
                    // Auto-detect and parse SRT/WEBVTT/custom formats
                    const parsed = parseTranscript(raw);
                    const title = titleFromFilename(file.name);
                    const tags = autoDetectTags(parsed.cleanText, parsed.speakers, file.name);
                    return {
                        title,
                        content: parsed.format !== 'plain' ? parsed.cleanText : raw,
                        tags: tags.length > 0 ? tags : undefined,
                    };
                })
            );

            const res = await fetch('/api/training/transcripts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ transcripts: uploads }),
            });

            if (res.ok) {
                await fetchTranscripts();
            }
        } catch (err) {
            console.error('Upload error:', err);
        } finally {
            setUploading(false);
        }
    };

    const handlePasteUpload = async () => {
        if (!pasteContent.trim()) return;
        setUploading(true);

        try {
            const res = await fetch('/api/training/transcripts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    transcripts: [
                        {
                            title: pasteTitle || `Transcript ${new Date().toLocaleDateString()}`,
                            content: pasteContent,
                        },
                    ],
                }),
            });

            if (res.ok) {
                setPasteTitle('');
                setPasteContent('');
                setShowPaste(false);
                await fetchTranscripts();
            }
        } catch (err) {
            console.error('Paste upload error:', err);
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await fetch('/api/training/transcripts', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id }),
            });
            setTranscripts((prev) => prev.filter((t) => t.id !== id));
        } catch (err) {
            console.error('Delete error:', err);
        }
    };

    const handleSeedFromFolder = async () => {
        setSeeding(true);
        setSeedResult(null);
        try {
            const res = await fetch('/api/admin/seed-transcripts', { method: 'POST' });
            const data = await res.json();
            if (res.ok) {
                setSeedResult(data.message);
                await fetchTranscripts();
            } else {
                setSeedResult(`Error: ${data.error}`);
            }
        } catch (err) {
            setSeedResult('Error: Failed to connect');
        } finally {
            setSeeding(false);
        }
    };

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true);
        } else if (e.type === 'dragleave') {
            setDragActive(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        const files = Array.from(e.dataTransfer.files).filter((f) =>
            /\.(txt|csv|json|md|srt|vtt|webvtt)$/i.test(f.name)
        );
        if (files.length > 0) handleUpload(files);
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length > 0) handleUpload(files);
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'processed':
                return (
                    <Badge variant="default" className="bg-green-100 text-green-700 border-green-300">
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Processed
                    </Badge>
                );
            case 'processing':
                return (
                    <Badge variant="secondary">
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" /> Processing
                    </Badge>
                );
            case 'error':
                return (
                    <Badge variant="destructive">
                        <AlertCircle className="h-3 w-3 mr-1" /> Error
                    </Badge>
                );
            default:
                return <Badge variant="outline">Uploaded</Badge>;
        }
    };

    return (
        <div className="container mx-auto p-4 sm:p-6 space-y-6 max-w-4xl">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold">Training Transcripts</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Upload sales call transcripts to improve AI roleplay quality. Patterns are automatically extracted.
                    </p>
                </div>
                <Link href="/dashboard/settings">
                    <Button variant="outline" size="sm">Back to Settings</Button>
                </Link>
            </div>

            {/* Upload Zone */}
            <Card
                className={`p-8 border-2 border-dashed transition-colors cursor-pointer ${dragActive
                        ? 'border-primary bg-primary/5'
                        : 'border-muted-foreground/25 hover:border-primary/50'
                    }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
            >
                <div className="flex flex-col items-center gap-3 text-center">
                    {uploading ? (
                        <Loader2 className="h-10 w-10 text-primary animate-spin" />
                    ) : (
                        <Upload className="h-10 w-10 text-muted-foreground" />
                    )}
                    <div>
                        <p className="font-medium">
                            {uploading ? 'Uploading...' : 'Drag & drop transcript files here'}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                            Supports .txt, .csv, .json, .md, .srt, .vtt files — up to 10 at once
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                                e.stopPropagation();
                                fileInputRef.current?.click();
                            }}
                            disabled={uploading}
                        >
                            Browse Files
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                                e.stopPropagation();
                                setShowPaste(true);
                            }}
                            disabled={uploading}
                        >
                            <Plus className="h-4 w-4 mr-1" /> Paste Text
                        </Button>
                    </div>
                </div>
                <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept=".txt,.csv,.json,.md,.srt,.vtt,.webvtt"
                    multiple
                    onChange={handleFileSelect}
                />
            </Card>

            {/* Paste Modal */}
            {showPaste && (
                <Card className="p-4 sm:p-6 space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="font-semibold">Paste Transcript</h3>
                        <Button variant="ghost" size="sm" onClick={() => setShowPaste(false)}>
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                    <Input
                        placeholder="Transcript title (optional)"
                        value={pasteTitle}
                        onChange={(e) => setPasteTitle(e.target.value)}
                    />
                    <textarea
                        className="w-full h-48 p-3 border rounded-md text-sm bg-background resize-y font-mono"
                        placeholder="Paste your transcript here...&#10;&#10;[Rep] Hello, thanks for joining...&#10;[Prospect] Hi, yeah thanks for having me..."
                        value={pasteContent}
                        onChange={(e) => setPasteContent(e.target.value)}
                    />
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setShowPaste(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handlePasteUpload} disabled={uploading || !pasteContent.trim()}>
                            {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                            Upload
                        </Button>
                    </div>
                </Card>
            )}

            {/* Transcript List */}
            <div className="space-y-3">
                <h2 className="text-lg font-semibold">
                    Uploaded Transcripts ({transcripts.length})
                </h2>

                {loading ? (
                    <Card className="p-8 text-center">
                        <Loader2 className="h-6 w-6 mx-auto animate-spin text-muted-foreground" />
                    </Card>
                ) : transcripts.length === 0 ? (
                    <Card className="p-8 text-center">
                        <FileText className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                        <p className="text-muted-foreground">No transcripts uploaded yet</p>
                        <p className="text-sm text-muted-foreground mt-1">
                            Upload sales call transcripts to help the AI roleplay engine learn real conversation patterns.
                        </p>
                    </Card>
                ) : (
                    transcripts.map((t) => {
                        const tags: string[] = (() => {
                            try {
                                return t.tags ? JSON.parse(t.tags) : [];
                            } catch {
                                return [];
                            }
                        })();

                        return (
                            <Card key={t.id} className="p-4 flex items-center justify-between gap-4">
                                <div className="flex items-center gap-3 min-w-0">
                                    <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                                    <div className="min-w-0">
                                        <p className="font-medium truncate">{t.title}</p>
                                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                                            {getStatusBadge(t.status)}
                                            {t.wordCount && (
                                                <span className="text-xs text-muted-foreground">
                                                    {t.wordCount.toLocaleString()} words
                                                </span>
                                            )}
                                            {tags.map((tag, i) => (
                                                <Badge key={i} variant="outline" className="text-xs">
                                                    {tag}
                                                </Badge>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="flex-shrink-0 text-muted-foreground hover:text-destructive"
                                    onClick={() => handleDelete(t.id)}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </Card>
                        );
                    })
                )}
            </div>

            {/* Seed from folder (dev tool) */}
            <Card className="p-4 border-dashed">
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <h3 className="text-sm font-semibold">Bulk Seed from Folder</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            Load all transcript files from the <code className="bg-muted px-1 rounded">transcripts/</code> project folder.
                            SRT, WEBVTT, and custom formats are auto-parsed.
                        </p>
                        {seedResult && (
                            <p className={`text-xs mt-1 ${seedResult.startsWith('Error') ? 'text-red-500' : 'text-green-600'}`}>
                                {seedResult}
                            </p>
                        )}
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleSeedFromFolder}
                        disabled={seeding}
                        className="shrink-0"
                    >
                        {seeding ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FolderDown className="h-4 w-4 mr-1" />}
                        {seeding ? 'Seeding...' : 'Seed Now'}
                    </Button>
                </div>
            </Card>

            {/* Info */}
            <Card className="p-4 bg-muted/30 border-muted">
                <h3 className="text-sm font-semibold mb-2">How it works</h3>
                <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Upload transcript files or paste transcript text</li>
                    <li>• SRT, WEBVTT, and custom timestamp formats are automatically parsed</li>
                    <li>• AI extracts key patterns (closing techniques, objection handles, discovery questions)</li>
                    <li>• Extracted patterns are used to make AI roleplay prospects more realistic</li>
                    <li>• More transcripts = better AI training data</li>
                </ul>
            </Card>
        </div>
    );
}
