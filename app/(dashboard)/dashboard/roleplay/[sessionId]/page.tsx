'use client';

import { Suspense, useState, useEffect, useRef } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { RoleplaySessionSkeleton } from '@/components/dashboard/skeletons';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Mic, MicOff, Video, PhoneOff, MessageSquare, MoreVertical, Loader2, User, Bot, Pin, PinOff, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { toastError } from '@/lib/toast';
import { useConfirmDialog } from '@/hooks/use-confirm-dialog';
import { resolveProspectAvatarUrl } from '@/lib/prospect-avatar';
import { getVoiceIdFromProspect } from '@/lib/ai/roleplay/voice-mapping';

interface Message {
  id?: string;
  role: 'rep' | 'prospect';
  content: string;
  timestamp: number;
  messageType?: 'text' | 'voice';
  audioUrl?: string | null;
  metadata?: any;
}

interface Session {
  id: string;
  status: string;
  inputMode: string;
  offerName?: string;
  metadata?: { pinnedMessageIds?: string[]; notes?: string } | null;
}

interface ProspectAvatar {
  id: string;
  name: string;
  avatarUrl?: string | null;
  positionDescription?: string | null;
  voiceStyle?: string | null;
}

interface UserProfile {
  name: string;
  email: string;
  profilePhoto: string | null;
}

function RoleplaySessionContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = params.sessionId as string;

  const [session, setSession] = useState<Session | null>(null);
  const [prospectAvatar, setProspectAvatar] = useState<ProspectAvatar | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [activeSpeaker, setActiveSpeaker] = useState<'rep' | 'prospect' | null>(null);
  const [showTranscript, setShowTranscript] = useState(true);
  const [transcriptTab, setTranscriptTab] = useState<'transcript' | 'pinned' | 'notes'>('transcript');
  const [transcriptSearch, setTranscriptSearch] = useState('');
  const [pinnedMessageIds, setPinnedMessageIds] = useState<string[]>([]);
  const [sessionNotes, setSessionNotes] = useState('');
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const { openDialog, ConfirmDialog } = useConfirmDialog();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const activeSpeakerTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchSession();
    fetchUserProfile();
    initializeVoice();

    // Handle timestamp navigation from feedback clicks
    const timestamp = searchParams?.get('timestamp');
    if (timestamp) {
      const timestampMs = parseInt(timestamp);
      setTimeout(() => {
        // Scroll to message at or near this timestamp
        const messageElement = document.querySelector(`[data-timestamp="${timestampMs}"]`);
        if (messageElement) {
          messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Highlight the message briefly
          messageElement.classList.add('ring-2', 'ring-primary', 'ring-offset-2');
          setTimeout(() => {
            messageElement.classList.remove('ring-2', 'ring-primary', 'ring-offset-2');
          }, 3000);
        }
      }, 500);
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (activeSpeakerTimeoutRef.current) {
        clearTimeout(activeSpeakerTimeoutRef.current);
      }
    };
  }, [sessionId, searchParams]);

  const fetchUserProfile = async () => {
    try {
      const response = await fetch('/api/profile');
      if (response.ok) {
        const data = await response.json();
        setUserProfile({
          name: data.name || 'User',
          email: data.email || '',
          profilePhoto: data.profilePhoto || null,
        });
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (cameraOn && streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [cameraOn]);

  const fetchSession = async () => {
    try {
      const response = await fetch(`/api/roleplay/${sessionId}`);
      const data = await response.json();
      setSession(data.session);
      setMessages(data.messages || []);
      setProspectAvatar(data.prospectAvatar ?? null);
      const meta = data.session?.metadata;
      if (meta) {
        try {
          const parsed = typeof meta === 'string' ? JSON.parse(meta) : meta;
          if (Array.isArray(parsed.pinnedMessageIds)) setPinnedMessageIds(parsed.pinnedMessageIds);
          if (typeof parsed.notes === 'string') setSessionNotes(parsed.notes);
        } catch {
          // ignore
        }
      }
    } catch (error) {
      console.error('Error fetching session:', error);
    }
  };

  const persistPins = async (ids: string[]) => {
    setPinnedMessageIds(ids);
    try {
      await fetch(`/api/roleplay/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pinnedMessageIds: ids }),
      });
    } catch (e) {
      console.error('Failed to persist pins', e);
    }
  };

  const persistNotes = async (notes: string) => {
    setSessionNotes(notes);
    try {
      await fetch(`/api/roleplay/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      });
    } catch (e) {
      console.error('Failed to persist notes', e);
    }
  };

  const togglePin = (messageId: string | undefined) => {
    if (!messageId) return;
    const next = pinnedMessageIds.includes(messageId)
      ? pinnedMessageIds.filter((id) => id !== messageId)
      : [...pinnedMessageIds, messageId];
    persistPins(next);
  };

  const formatMessageTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    if (m > 0) return `${m}:${String(s % 60).padStart(2, '0')}`;
    return `0:${String(s).padStart(2, '0')}`;
  };

  const toggleCamera = async () => {
    if (cameraOn && streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setCameraOn(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCameraOn(true);
    } catch (err) {
      console.error('Camera error:', err);
    }
  };

  const initializeVoice = () => {
    // Initialize Web Speech API
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput(transcript);
        setIsListening(false);
        handleSend(transcript);
      };

      recognitionRef.current.onerror = () => {
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }

    synthRef.current = window.speechSynthesis;
  };

  const handleSend = async (messageText?: string) => {
    const text = messageText || input.trim();
    if (!text || loading) return;

    const repMessage: Message = {
      role: 'rep',
      content: text,
      timestamp: Date.now(),
      messageType: session?.inputMode === 'voice' ? 'voice' : 'text',
    };

    setMessages((prev) => [...prev, repMessage]);
    setInput('');
    setLoading(true);
    setActiveSpeaker('rep');

    // Clear active speaker after 2 seconds
    if (activeSpeakerTimeoutRef.current) {
      clearTimeout(activeSpeakerTimeoutRef.current);
    }
    activeSpeakerTimeoutRef.current = setTimeout(() => {
      setActiveSpeaker(null);
    }, 2000);

    try {
      const response = await fetch(`/api/roleplay/${sessionId}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const data = await response.json();
      const prospectMessage: Message = {
        id: data.prospectMessageId ?? undefined,
        role: 'prospect',
        content: data.response,
        timestamp: Date.now(),
        metadata: data.metadata,
      };

      setMessages((prev) => {
        const withProspect = [...prev, prospectMessage];
        const repIdx = withProspect.length - 2;
        const prospectIdx = withProspect.length - 1;
        if (data.repMessageId && repIdx >= 0)
          withProspect[repIdx] = { ...withProspect[repIdx], id: data.repMessageId };
        if (data.prospectMessageId && prospectIdx >= 0)
          withProspect[prospectIdx] = { ...withProspect[prospectIdx], id: data.prospectMessageId };
        return withProspect;
      });
      setActiveSpeaker('prospect');

      // Clear active speaker after prospect finishes
      if (activeSpeakerTimeoutRef.current) {
        clearTimeout(activeSpeakerTimeoutRef.current);
      }
      activeSpeakerTimeoutRef.current = setTimeout(() => {
        setActiveSpeaker(null);
      }, 5000);

      // Speak prospect response if voice mode (ElevenLabs TTS if configured, else browser speechSynthesis)
      if (session?.inputMode === 'voice' && !isMuted) {
        if (synthRef.current) synthRef.current.cancel();
        const speakText = data.response;
        const onEnd = () => setActiveSpeaker(null);
        try {
          // Get voice ID from prospect avatar (matches character appearance)
          const voiceId = prospectAvatar ? getVoiceIdFromProspect(prospectAvatar) : undefined;
          const ttsRes = await fetch('/api/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: speakText,
              voiceId: voiceId,
            }),
          });

          // Check if response is successful audio (200) or needs fallback (503 with fallback flag)
          if (ttsRes.ok && ttsRes.headers.get('content-type')?.includes('audio')) {
            const blob = await ttsRes.blob();
            const url = URL.createObjectURL(blob);
            const audio = new Audio(url);
            audio.onended = () => {
              URL.revokeObjectURL(url);
              onEnd();
            };
            audio.onerror = () => {
              URL.revokeObjectURL(url);
              fallbackSpeak(speakText, onEnd);
            };
            await audio.play();
          } else {
            // Check for explicit fallback flag in JSON response (503 from ElevenLabs auth/quota issues)
            try {
              const errorData = await ttsRes.json().catch(() => null);
              if (errorData?.fallback) {
                // Explicit fallback requested (ElevenLabs unavailable)
                fallbackSpeak(speakText, onEnd);
              } else {
                // Other error, still fallback to browser speech
                fallbackSpeak(speakText, onEnd);
              }
            } catch {
              // Response not JSON, fallback to browser speech
              fallbackSpeak(speakText, onEnd);
            }
          }
        } catch {
          fallbackSpeak(speakText, onEnd);
        }
      }

      function fallbackSpeak(text: string, onEnd: () => void) {
        if (synthRef.current) {
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.rate = 0.9;
          utterance.pitch = 1;
          utterance.onend = onEnd;
          synthRef.current.speak(utterance);
        } else {
          onEnd();
        }
      }
    } catch (error: any) {
      console.error('Error sending message:', error);
      toastError('Failed to send message: ' + error.message);
      setActiveSpeaker(null);
    } finally {
      setLoading(false);
    }
  };

  const handleVoiceInput = () => {
    if (!recognitionRef.current) {
      alert('Speech recognition not supported in your browser');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      recognitionRef.current.start();
      setIsListening(true);
      setActiveSpeaker('rep');
    }
  };

  const handleMute = () => {
    setIsMuted(!isMuted);
    if (synthRef.current) {
      if (!isMuted) {
        synthRef.current.cancel();
      }
    }
  };

  const handleEndSession = () => {
    openDialog({
      title: 'End roleplay session?',
      description: 'This session will be analyzed and scored. You can view results afterward.',
      confirmLabel: 'End & score',
      onConfirm: async () => {
        try {
          setLoading(true);
          if (synthRef.current) synthRef.current.cancel();
          const scoreResponse = await fetch(`/api/roleplay/${sessionId}/score`, { method: 'POST' });
          const errorData = await scoreResponse.json().catch(() => ({}));
          if (!scoreResponse.ok) {
            const msg = errorData.error || 'Failed to score session';
            toastError(msg);
            // Still end the session and go to results so user can see transcript; results page shows "No analysis" + retry
            await fetch(`/api/roleplay/${sessionId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ status: 'completed' }),
            });
            router.push(`/dashboard/roleplay/${sessionId}/results`);
            return;
          }
          await fetch(`/api/roleplay/${sessionId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'completed' }),
          });
          router.push(`/dashboard/roleplay/${sessionId}/results`);
        } catch (error) {
          console.error('Error ending session:', error);
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          toastError('Failed to end session: ' + errorMessage);
        } finally {
          setLoading(false);
        }
      },
    });
  };

  return (
    <>
      <ConfirmDialog />
      <div className="fixed inset-0 flex flex-col overflow-hidden z-50 bg-linear-to-b from-stone-950 via-stone-900 to-stone-950">
        {/* Minimal floating header */}
        <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between p-4 pointer-events-none">
          <div className="pointer-events-auto">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/dashboard/roleplay')}
              className="gap-2 text-muted-foreground hover:text-foreground rounded-full"
            >
              <PhoneOff className="h-4 w-4" />
              Exit
            </Button>
          </div>
          <div className="absolute left-1/2 -transtone-x-1/2 flex items-center gap-2 pointer-events-none">
            <span className="text-sm font-medium text-foreground/90">{session?.offerName || 'Roleplay'}</span>
            {session?.status === 'in_progress' && (
              <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live
              </span>
            )}
          </div>
          <div className="pointer-events-auto">
            <Button
              variant={showTranscript ? 'secondary' : 'ghost'}
              size="icon"
              onClick={() => setShowTranscript(!showTranscript)}
              className="rounded-full h-9 w-9"
              title={showTranscript ? 'Hide transcript' : 'Show transcript'}
            >
              <MessageSquare className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Focus stage: prospect center, you PiP bottom-right */}
        <div className="flex-1 flex overflow-hidden relative min-h-0">
          <div className="flex-1 flex flex-col items-center justify-center p-6 pt-20 pb-32">
            {/* Prospect as main focus */}
            <div
              className={cn(
                "flex flex-col items-center text-center transition-all duration-300",
                activeSpeaker === 'prospect' && "scale-[1.02]"
              )}
            >
              <div
                className={cn(
                  "relative rounded-full overflow-hidden transition-all duration-300",
                  activeSpeaker === 'prospect'
                    ? "ring-4 ring-stone-500/50 shadow-2xl shadow-stone-500/20"
                    : "ring-2 ring-white/10"
                )}
                style={{ width: 'clamp(160px, 20vw, 220px)', height: 'clamp(160px, 20vw, 220px)' }}
              >
                {prospectAvatar ? (
                  <Avatar className="w-full h-full">
                    <AvatarImage
                      src={resolveProspectAvatarUrl(prospectAvatar.id, prospectAvatar.name, prospectAvatar.avatarUrl)}
                      alt={prospectAvatar.name}
                      className="object-cover"
                    />
                    <AvatarFallback className="bg-stone-700 text-stone-200 text-2xl">
                      {prospectAvatar.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-stone-800">
                    <Bot className="h-16 w-16 text-stone-500" />
                  </div>
                )}
                {loading && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-stone-400" />
                  </div>
                )}
                {activeSpeaker === 'prospect' && !loading && (
                  <div className="absolute top-2 right-2 w-3 h-3 bg-stone-500 rounded-full animate-pulse ring-2 ring-stone-400/50" />
                )}
              </div>
              <h2 className="mt-4 text-xl font-semibold text-foreground">
                {prospectAvatar?.name ?? 'AI Prospect'}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground max-w-sm">
                {prospectAvatar?.positionDescription ?? 'Virtual buyer'}
              </p>
            </div>

            {/* You – PiP bottom-right */}
            <div
              className={cn(
                "absolute bottom-24 right-6 w-[210px] z-[5000] rounded-xl overflow-hidden border-2 transition-all duration-300 bg-stone-900/90 backdrop-blur",
                activeSpeaker === 'rep'
                  ? "border-orange-500/80 shadow-lg shadow-orange-500/20"
                  : "border-white/10"
              )}
              style={{ aspectRatio: '4/3' }}
            >
              {cameraOn ? (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  <div className="absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/80 to-transparent p-2">
                    <span className="text-white text-xs font-medium truncate block">{userProfile?.name || 'You'}</span>
                  </div>
                  {isListening && (
                    <div className="absolute top-1 right-1 flex gap-0.5">
                      <span className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-pulse" />
                      <span className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-pulse" style={{ animationDelay: '0.15s' }} />
                      <span className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-pulse" style={{ animationDelay: '0.3s' }} />
                    </div>
                  )}
                </>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-stone-800/80 p-2">
                  {userProfile?.profilePhoto ? (
                    <Avatar className="w-12 h-12">
                      <AvatarImage src={userProfile.profilePhoto} alt={userProfile.name} />
                      <AvatarFallback className="bg-orange-500/30 text-orange-300 text-sm">
                        {userProfile.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-orange-500/20 flex items-center justify-center">
                      <User className="h-6 w-6 text-orange-400" />
                    </div>
                  )}
                  <span className="text-xs text-muted-foreground mt-1 truncate w-full text-center">You</span>
                </div>
              )}
            </div>
          </div>

          {/* Transcript Panel (Right) – floating sheet style */}
          {showTranscript && (
            <div className="w-96 shrink-0 flex flex-col rounded-l-2xl border-l border-y border-white/10 bg-stone-900/95 backdrop-blur-xl shadow-2xl">
              <div className="border-b p-3 flex items-center justify-between gap-2">
                <h2 className="font-semibold shrink-0">Transcript</h2>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowTranscript(false)}
                  aria-label="Close transcript"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </div>
              <div className="border-b flex gap-0">
                {(['transcript', 'pinned', 'notes'] as const).map((tab) => (
                  <Button
                    key={tab}
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "rounded-none border-b-2 border-transparent flex-1",
                      transcriptTab === tab && "border-primary font-medium"
                    )}
                    onClick={() => setTranscriptTab(tab)}
                  >
                    {tab === 'transcript' ? 'Transcript' : tab === 'pinned' ? 'Pinned' : 'Notes'}
                  </Button>
                ))}
              </div>
              {transcriptTab === 'transcript' && (
                <>
                  <div className="border-b p-2">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -transtone-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search transcript..."
                        value={transcriptSearch}
                        onChange={(e) => setTranscriptSearch(e.target.value)}
                        className="pl-8 h-9 bg-background/80"
                        aria-label="Search transcript"
                      />
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {(() => {
                      const filtered = transcriptSearch.trim()
                        ? messages.filter((m) =>
                          m.content.toLowerCase().includes(transcriptSearch.trim().toLowerCase())
                        )
                        : messages;
                      if (filtered.length === 0) {
                        return (
                          <div className="text-center py-12 text-muted-foreground">
                            <p>{transcriptSearch.trim() ? 'No messages match your search.' : 'Conversation will appear here'}</p>
                          </div>
                        );
                      }
                      return filtered.map((msg, idx) => (
                        <div
                          key={msg.id ?? idx}
                          className="space-y-1 group"
                          data-timestamp={msg.timestamp ?? idx * 5000}
                        >
                          <div className="flex items-center gap-2 justify-between">
                            <div className="flex items-center gap-2 min-w-0 flex-wrap">
                              <span className={cn(
                                "font-semibold text-sm shrink-0",
                                msg.role === 'rep' ? "text-primary" : "text-muted-foreground"
                              )}>
                                {msg.role === 'rep' ? 'You' : 'Prospect'}
                              </span>
                              {typeof msg.timestamp === 'number' && (
                                <span className="text-xs text-muted-foreground" title="Time in session">
                                  {formatMessageTime(msg.timestamp)}
                                </span>
                              )}
                              {msg.metadata?.objectionType && (
                                <Badge variant="outline" className="text-xs">
                                  {msg.metadata.objectionType}
                                </Badge>
                              )}
                            </div>
                            {msg.id && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 shrink-0 opacity-70 hover:opacity-100"
                                onClick={() => togglePin(msg.id!)}
                                title={pinnedMessageIds.includes(msg.id) ? 'Unpin this line' : 'Pin this line'}
                                aria-label={pinnedMessageIds.includes(msg.id) ? 'Unpin' : 'Pin'}
                              >
                                {pinnedMessageIds.includes(msg.id) ? (
                                  <Pin className="h-4 w-4 fill-current" />
                                ) : (
                                  <PinOff className="h-4 w-4" />
                                )}
                              </Button>
                            )}
                          </div>
                          <p className="text-sm text-foreground/80 whitespace-pre-wrap">
                            {msg.content}
                          </p>
                        </div>
                      ));
                    })()}
                    {loading && (
                      <div className="space-y-1">
                        <span className="font-semibold text-sm text-muted-foreground">Prospect</span>
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">Typing...</span>
                        </div>
                      </div>
                    )}
                    <div ref={transcriptEndRef} />
                  </div>
                </>
              )}
              {transcriptTab === 'pinned' && (
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {pinnedMessageIds.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <p>No pinned messages.</p>
                      <p className="text-xs mt-1">Pin lines from the Transcript tab.</p>
                    </div>
                  ) : (
                    messages
                      .filter((m) => m.id && pinnedMessageIds.includes(m.id))
                      .map((msg) => (
                        <div key={msg.id} className="space-y-1">
                          <div className="flex items-center gap-2 justify-between">
                            <span className={cn(
                              "font-semibold text-sm",
                              msg.role === 'rep' ? "text-primary" : "text-muted-foreground"
                            )}>
                              {msg.role === 'rep' ? 'You' : 'Prospect'}
                            </span>
                            {typeof msg.timestamp === 'number' && (
                              <span className="text-xs text-muted-foreground">{formatMessageTime(msg.timestamp)}</span>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => togglePin(msg.id!)}
                              title="Unpin"
                              aria-label="Unpin"
                            >
                              <Pin className="h-4 w-4 fill-current" />
                            </Button>
                          </div>
                          <p className="text-sm text-foreground/80 whitespace-pre-wrap">{msg.content}</p>
                        </div>
                      ))
                  )}
                </div>
              )}
              {transcriptTab === 'notes' && (
                <div className="flex-1 flex flex-col p-4 min-h-0">
                  <p className="text-xs text-muted-foreground mb-2">Session notes (saved automatically)</p>
                  <textarea
                    className="flex-1 min-h-[200px] w-full rounded-md border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="e.g. Prospect concerned about price, follow up on timeline..."
                    value={sessionNotes}
                    onChange={(e) => setSessionNotes(e.target.value)}
                    onBlur={() => persistNotes(sessionNotes)}
                    aria-label="Session notes"
                  />
                </div>
              )}
            </div>
          )}

          {/* Show Transcript Button (when hidden) */}
          {!showTranscript && (
            <Button
              variant="secondary"
              size="sm"
              className="fixed top-16 right-6 z-30 rounded-full shadow-lg gap-2 bg-stone-800/90 hover:bg-stone-700 border-white/10"
              onClick={() => setShowTranscript(true)}
            >
              <MessageSquare className="h-4 w-4" />
              Transcript
            </Button>
          )}
        </div>

        {/* Floating control bar */}
        <div className="absolute bottom-0 left-0 right-0 z-20 flex justify-center p-4 pointer-events-none">
          <div className="pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-2xl bg-stone-900/95 backdrop-blur-xl border border-white/10 shadow-2xl max-w-2xl w-full">
            <Button
              variant={isMuted ? 'destructive' : 'ghost'}
              size="icon"
              onClick={handleMute}
              className="rounded-full h-10 w-10 shrink-0"
              title={isMuted ? 'Unmute AI voice' : 'Mute AI voice'}
            >
              {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </Button>
            {session?.inputMode === 'voice' && (
              <Button
                variant={isListening ? 'default' : 'ghost'}
                size="icon"
                onClick={handleVoiceInput}
                className={cn(
                  "rounded-full h-10 w-10 shrink-0 transition-all",
                  isListening && "ring-2 ring-orange-500/50"
                )}
                title={isListening ? 'Stop voice input' : 'Start voice input'}
              >
                {isListening ? (
                  <span className="relative flex">
                    <Mic className="h-5 w-5" />
                    <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-orange-500 animate-pulse ring-2 ring-background" />
                  </span>
                ) : (
                  <Mic className="h-5 w-5" />
                )}
              </Button>
            )}
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={
                session?.inputMode === 'voice'
                  ? (isListening ? 'Listening...' : 'Type or use mic...')
                  : 'Type your message...'
              }
              disabled={loading || isListening}
              className="flex-1 h-10 rounded-full bg-stone-800/80 border-white/10 focus-visible:ring-orange-500/50"
            />
            <Button
              onClick={() => handleSend()}
              disabled={loading || !input.trim() || isListening}
              size="icon"
              className="rounded-full h-10 w-10 shrink-0"
              title="Send"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <MessageSquare className="h-4 w-4" />
              )}
            </Button>
            <div className="w-px h-6 bg-white/10 shrink-0" />
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleCamera}
              className={cn("rounded-full h-10 w-10 shrink-0", cameraOn && "bg-orange-500/20 text-orange-400")}
              title={cameraOn ? 'Camera on' : 'Turn on camera'}
            >
              <Video className="h-4 w-4" />
            </Button>
            <Button
              variant="destructive"
              size="icon"
              onClick={handleEndSession}
              className="rounded-full h-10 w-10 shrink-0"
              title="End session"
            >
              <PhoneOff className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

export default function RoleplaySessionPage() {
  return (
    <Suspense fallback={<RoleplaySessionSkeleton />}>
      <RoleplaySessionContent />
    </Suspense>
  );
}
