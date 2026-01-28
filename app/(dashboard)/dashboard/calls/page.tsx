'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Upload, FileAudio, Loader2, CheckCircle2, AlertCircle, X, Search, Filter, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from '@/components/ui/empty';
import { toastError } from '@/lib/toast';
import { useConfirmDialog } from '@/hooks/use-confirm-dialog';

export default function CallsPage() {
  const router = useRouter();
  const { openDialog, ConfirmDialog } = useConfirmDialog();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasActiveSubscription, setHasActiveSubscription] = useState<boolean | null>(null);
  const [isDevMode, setIsDevMode] = useState(false);
  const [calls, setCalls] = useState<Array<{
    id: string;
    fileName: string;
    status: string;
    duration?: number;
    createdAt: string;
  }>>([]);
  const [loadingCalls, setLoadingCalls] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedCalls, setSelectedCalls] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    // Check subscription status
    const checkSubscription = async () => {
      try {
        const response = await fetch('/api/subscription/check');
        if (response.ok) {
          const data = await response.json();
          setHasActiveSubscription(data.hasActiveSubscription);
          setIsDevMode(data.isDevMode || false);
        }
      } catch (err) {
        console.error('Error checking subscription:', err);
      }
    };
    checkSubscription();

    // Fetch calls list
    const fetchCalls = async () => {
      try {
        const response = await fetch('/api/calls');
        if (response.ok) {
          const data = await response.json();
          setCalls(data.calls || []);
        }
      } catch (err) {
        console.error('Error fetching calls:', err);
      } finally {
        setLoadingCalls(false);
      }
    };
    fetchCalls();
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      // Validate file type
      const allowedTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/m4a', 'audio/webm'];
      if (!allowedTypes.includes(selectedFile.type)) {
        setError('Invalid file type. Supported: MP3, WAV, M4A, WebM');
        return;
      }

      // Validate file size (100MB max)
      if (selectedFile.size > 100 * 1024 * 1024) {
        setError('File too large. Maximum size is 100MB');
        return;
      }

      setFile(selectedFile);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setIsUploading(true);
    setError(null);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/calls/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }

      const data = await response.json();
      setIsUploading(false);
      setIsProcessing(true);

      // Poll for completion
      pollCallStatus(data.callId);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to upload call';
      setError(errorMessage);
      setIsUploading(false);
    }
  };

  const pollCallStatus = async (id: string) => {
    const maxAttempts = 120; // 10 minutes max
    let attempts = 0;

    const interval = setInterval(async () => {
      attempts++;

      try {
        const response = await fetch(`/api/calls/${id}/status`);
        if (!response.ok) throw new Error('Failed to check status');

        const data = await response.json();

        if (data.status === 'completed') {
          clearInterval(interval);
          setIsProcessing(false);
          // Refresh calls list
          const callsResponse = await fetch('/api/calls');
          if (callsResponse.ok) {
            const callsData = await callsResponse.json();
            setCalls(callsData.calls || []);
          }
          // Redirect to call detail page
          router.push(`/dashboard/calls/${id}`);
        } else if (data.status === 'failed') {
          clearInterval(interval);
          setIsProcessing(false);
          setError(data.error || 'Processing failed');
        } else if (attempts >= maxAttempts) {
          clearInterval(interval);
          setIsProcessing(false);
          setError('Processing timeout - please check back later');
        }
      } catch (err) {
        console.error('Error checking status:', err);
        if (attempts >= maxAttempts) {
          clearInterval(interval);
          setIsProcessing(false);
          setError('Failed to check status');
        }
      }
    }, 5000); // Poll every 5 seconds
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      const allowedTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/m4a', 'audio/webm'];
      if (allowedTypes.includes(droppedFile.type)) {
        setFile(droppedFile);
        setError(null);
      } else {
        setError('Invalid file type');
      }
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  // Filter calls based on search and status
  const filteredCalls = calls.filter(call => {
    const matchesSearch = call.fileName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || call.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleSelectCall = (callId: string) => {
    setSelectedCalls(prev => {
      const next = new Set(prev);
      if (next.has(callId)) {
        next.delete(callId);
      } else {
        next.add(callId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedCalls.size === filteredCalls.length) {
      setSelectedCalls(new Set());
    } else {
      setSelectedCalls(new Set(filteredCalls.map(c => c.id)));
    }
  };

  const handleBulkDelete = () => {
    if (selectedCalls.size === 0) return;
    openDialog({
      title: 'Delete calls?',
      description: `Are you sure you want to delete ${selectedCalls.size} call(s)? This cannot be undone.`,
      confirmLabel: 'Delete',
      variant: 'destructive',
      onConfirm: async () => {
        setIsDeleting(true);
        try {
          const deletePromises = Array.from(selectedCalls).map((callId) =>
            fetch(`/api/calls/${callId}`, { method: 'DELETE' })
          );
          await Promise.all(deletePromises);
          setCalls((prev) => prev.filter((c) => !selectedCalls.has(c.id)));
          setSelectedCalls(new Set());
        } catch (error) {
          console.error('Error deleting calls:', error);
          toastError('Failed to delete some calls');
        } finally {
          setIsDeleting(false);
        }
      },
    });
  };

  return (
    <>
      <ConfirmDialog />
      <div className="space-y-6 sm:space-y-8">
        {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-serif font-semibold tracking-tight">
          Upload Sales Call
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-2">
          Upload an audio recording of your sales call for AI analysis
        </p>
      </div>

      {/* Upload Area */}
      <Card className="border border-white/10 bg-linear-to-br from-card/80 to-card/40 backdrop-blur-xl shadow-xl">
        <CardHeader>
          <CardTitle className="font-serif">Upload Audio File</CardTitle>
          <CardDescription>
            Supported formats: MP3, WAV, M4A, WebM (max 100MB)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!file && !isUploading && !isProcessing && (
            <div
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              className="border-2 border-dashed border-primary/30 rounded-xl p-12 text-center hover:border-primary/50 transition-colors cursor-pointer bg-primary/5"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-12 w-12 mx-auto mb-4 text-primary/70" />
              <p className="text-lg font-medium mb-2">Drag and drop your audio file here</p>
              <p className="text-sm text-muted-foreground mb-4">or click to browse</p>
              <Button variant="outline">Select File</Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          )}

          {file && !isUploading && !isProcessing && (
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 rounded-lg bg-white/5 border border-white/10">
                <FileAudio className="h-10 w-10 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{file.name}</p>
                  <p className="text-sm text-muted-foreground">{formatFileSize(file.size)}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <Button
                onClick={handleUpload}
                className="w-full"
                size="lg"
                disabled={hasActiveSubscription === false && !isDevMode && hasActiveSubscription !== null}
              >
                <Upload className="mr-2 h-4 w-4" />
                Upload and Analyze
              </Button>
              {hasActiveSubscription === false && !isDevMode && (
                <Alert className="mt-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    No active subscription.{' '}
                    <Link href="/pricing" className="underline font-medium hover:text-primary">
                      Upgrade your plan
                    </Link>{' '}
                    to upload and analyze calls.
                  </AlertDescription>
                </Alert>
              )}
              {isDevMode && (
                <Alert className="mt-4 border-primary/20 bg-primary/5">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <AlertDescription className="text-primary/90">
                    Development mode: All features enabled
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {isUploading && (
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 rounded-lg bg-white/5 border border-white/10">
                <Loader2 className="h-10 w-10 text-primary animate-spin shrink-0" />
                <div className="flex-1">
                  <p className="font-medium">Uploading...</p>
                  <Progress value={uploadProgress} className="mt-2" />
                </div>
              </div>
            </div>
          )}

          {isProcessing && (
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 rounded-lg bg-primary/10 border border-primary/20">
                <Loader2 className="h-10 w-10 text-primary animate-spin shrink-0" />
                <div className="flex-1">
                  <p className="font-medium">Processing call...</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Transcribing audio and analyzing call. This may take a few minutes.
                  </p>
                </div>
              </div>
            </div>
          )}

          {error && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Call History */}
      <Card className="border border-white/10 bg-linear-to-br from-card/80 to-card/40 backdrop-blur-xl shadow-xl">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="font-serif">Call History</CardTitle>
              <CardDescription>
                Your recent sales calls and their analysis status
              </CardDescription>
            </div>
            {selectedCalls.size > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleBulkDelete}
                disabled={isDeleting}
                className="gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Delete {selectedCalls.size}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          {calls.length > 0 && (
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search calls..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="analyzing">Analyzing</SelectItem>
                  <SelectItem value="transcribing">Transcribing</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {loadingCalls ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : calls.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <FileAudio className="size-6" />
                </EmptyMedia>
                <EmptyTitle>No calls uploaded yet</EmptyTitle>
                <EmptyDescription>Upload your first sales call to get AI feedback and scores.</EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <p className="text-sm text-muted-foreground">Use the upload area above to add a call.</p>
              </EmptyContent>
            </Empty>
          ) : filteredCalls.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Search className="size-6" />
                </EmptyMedia>
                <EmptyTitle>No calls match your filters</EmptyTitle>
                <EmptyDescription>Try clearing or changing your search and filters.</EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearchQuery('');
                    setStatusFilter('all');
                  }}
                >
                  Clear Filters
                </Button>
              </EmptyContent>
            </Empty>
          ) : (
            <>
              {/* Select All */}
              <div className="flex items-center gap-2 mb-3 pb-3 border-b">
                <Checkbox
                  checked={selectedCalls.size === filteredCalls.length && filteredCalls.length > 0}
                  onCheckedChange={handleSelectAll}
                />
                <span className="text-sm text-muted-foreground">
                  Select all ({filteredCalls.length} {filteredCalls.length === 1 ? 'call' : 'calls'})
                </span>
              </div>

              <div className="space-y-3">
                {filteredCalls.map((call) => (
                  <div
                    key={call.id}
                    className={`flex items-center gap-3 p-4 rounded-lg border transition-colors ${
                      selectedCalls.has(call.id)
                        ? 'bg-primary/10 border-primary/50'
                        : 'bg-white/5 border-white/10 hover:bg-white/10'
                    }`}
                  >
                    <Checkbox
                      checked={selectedCalls.has(call.id)}
                      onCheckedChange={() => handleSelectCall(call.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div
                      className="flex items-center gap-4 flex-1 min-w-0 cursor-pointer"
                      onClick={() => router.push(`/dashboard/calls/${call.id}`)}
                    >
                      <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${
                        call.status === 'completed' ? 'bg-emerald-500/20 text-emerald-500' :
                        call.status === 'processing' || call.status === 'transcribing' || call.status === 'analyzing' ? 'bg-primary/20 text-primary' :
                          call.status === 'failed' ? 'bg-destructive/20 text-destructive' :
                            'bg-muted text-muted-foreground'
                      }`}>
                        {call.status === 'completed' ? (
                          <CheckCircle2 className="h-5 w-5" />
                        ) : call.status === 'failed' ? (
                          <AlertCircle className="h-5 w-5" />
                        ) : (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{call.fileName}</p>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                          <span className="capitalize">{call.status}</span>
                          {call.duration && (
                            <>
                              <span>•</span>
                              <span>{Math.floor(call.duration / 60)}:{(call.duration % 60).toString().padStart(2, '0')}</span>
                            </>
                          )}
                          <span>•</span>
                          <span>{new Date(call.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        openDialog({
                          title: 'Delete call?',
                          description: 'Are you sure you want to delete this call? This cannot be undone.',
                          confirmLabel: 'Delete',
                          variant: 'destructive',
                          onConfirm: async () => {
                            try {
                              await fetch(`/api/calls/${call.id}`, { method: 'DELETE' });
                              setCalls((prev) => prev.filter((c) => c.id !== call.id));
                            } catch (error) {
                              console.error('Error deleting call:', error);
                              toastError('Failed to delete call');
                            }
                          },
                        });
                      }}
                      className="shrink-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
      </div>
    </>
  );
}
