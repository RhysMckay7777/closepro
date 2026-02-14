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
import { resolveProspectAvatarUrl, getProspectInitials, getProspectPlaceholderColor } from '@/lib/prospect-avatar';
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

/**
 * Strip stage directions, emotional cues, and action descriptions from prospect text.
 * Ensures TTS never says "(hesitant)" and transcript never shows "*sighs*".
 */
function cleanForSpeech(text: string): string {
  return text
    .replace(/\([^)]*\)/g, '')          // Remove (anything in parens)
    .replace(/\*[^*]*\*/g, '')          // Remove *anything in asterisks*
    .replace(/\[(?![\d£$€¥])[^\]]*\]/g, '') // Remove [narration] but not [£2,000]
    .replace(/\s{2,}/g, ' ')            // Collapse double spaces
    .trim();
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

  // Voice consistency: lock voice ID on first TTS call so it never changes mid-session
  const lockedVoiceIdRef = useRef<string | null>(null);
  // Continuous listening: debounce timer + accumulated transcript
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const interimTranscriptRef = useRef<string>('');
  const isSpeakingTTSRef = useRef(false);
  // Session timer
  const [sessionElapsed, setSessionElapsed] = useState(0);
  const sessionStartRef = useRef<number>(Date.now());

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
        try { recognitionRef.current.stop(); } catch { /* ignore */ }
      }
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
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

  // Sentence completion detection for continuous listening
  const shouldAutoSend = (text: string): boolean => {
    const trimmed = text.trim();
    if (!trimmed || trimmed.split(/\s+/).length < 3) return false;
    // Ends with sentence-ending punctuation
    if (/[.!?]$/.test(trimmed)) return true;
    // Has enough words (natural pause point)
    if (trimmed.split(/\s+/).length >= 8) return true;
    return false;
  };

  const startContinuousListening = () => {
    if (!recognitionRef.current || isSpeakingTTSRef.current) return;
    try {
      interimTranscriptRef.current = '';
      recognitionRef.current.start();
      setIsListening(true);
    } catch (e) {
      // Already started — ignore
    }
  };

  const stopContinuousListening = () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch { /* ignore */ }
    }
    setIsListening(false);
  };

  const initializeVoice = () => {
    // Initialize Web Speech API with continuous listening
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event: any) => {
        let finalTranscript = '';
        let interimText = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const t = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += t;
          } else {
            interimText += t;
          }
        }

        if (finalTranscript) {
          interimTranscriptRef.current += ' ' + finalTranscript;
          interimTranscriptRef.current = interimTranscriptRef.current.trim();
          setInput(interimTranscriptRef.current);
        } else if (interimText) {
          setInput((interimTranscriptRef.current + ' ' + interimText).trim());
        }

        // Reset silence timer on any speech
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

        // Start silence timer — auto-send after 2s of silence
        silenceTimerRef.current = setTimeout(() => {
          const accumulated = interimTranscriptRef.current.trim();
          if (accumulated && shouldAutoSend(accumulated)) {
            interimTranscriptRef.current = '';
            handleSend(accumulated);
          }
        }, 2000);
      };

      recognitionRef.current.onerror = (event: any) => {
        if (event.error !== 'no-speech' && event.error !== 'aborted') {
          setIsListening(false);
        }
      };

      // Auto-restart if mic stops (for continuous listening)
      recognitionRef.current.onend = () => {
        if (session?.inputMode === 'voice' && !isSpeakingTTSRef.current) {
          // Auto-restart recognition to keep mic live
          try {
            recognitionRef.current.start();
          } catch {
            setIsListening(false);
          }
        } else {
          setIsListening(false);
        }
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

      // Speak prospect response (ElevenLabs TTS if configured, else browser speechSynthesis)
      if (!isMuted) {
        if (synthRef.current) synthRef.current.cancel();
        const speakText = cleanForSpeech(data.response);
        const onEnd = () => setActiveSpeaker(null);
        try {
          // Voice consistency: lock voice ID on first call, reuse for entire session
          if (!lockedVoiceIdRef.current && prospectAvatar) {
            lockedVoiceIdRef.current = getVoiceIdFromProspect(prospectAvatar);
          }
          const voiceId = lockedVoiceIdRef.current || undefined;

          // Pause mic during TTS to avoid echo
          isSpeakingTTSRef.current = true;
          if (recognitionRef.current && isListening) {
            try { recognitionRef.current.stop(); } catch { /* ignore */ }
          }

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
              isSpeakingTTSRef.current = false;
              // Resume mic after TTS
              if (session?.inputMode === 'voice') startContinuousListening();
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

      function inferProspectGender(name: string): 'male' | 'female' | 'unknown' {
        const first = name.trim().split(/\s+/)[0]?.toLowerCase() || '';
        const FEMALE = new Set(['maria', 'sarah', 'emma', 'rachel', 'sophie', 'jessica', 'laura', 'hannah', 'charlotte', 'olivia', 'nicole', 'katie', 'amy', 'lisa', 'jennifer', 'emily', 'amanda', 'megan', 'ashley', 'brooke', 'hayley', 'lauren', 'bella']);
        const MALE = new Set(['james', 'david', 'michael', 'robert', 'daniel', 'thomas', 'william', 'richard', 'joseph', 'marcus', 'ryan', 'nathan', 'ben', 'luke', 'adam', 'jack', 'chris', 'connor', 'john', 'brian', 'kevin', 'jason', 'josh', 'arnold', 'anthony', 'andrew', 'steven', 'matthew', 'mark', 'george']);
        if (FEMALE.has(first)) return 'female';
        if (MALE.has(first)) return 'male';
        return 'unknown';
      }

      function fallbackSpeak(text: string, onEnd: () => void) {
        if (synthRef.current) {
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.rate = 0.9;

          // Pick a gender-appropriate browser voice based on prospect name
          const gender = inferProspectGender(prospectAvatar?.name || '');
          const voices = synthRef.current.getVoices();
          if (voices.length > 0) {
            const preferred = voices.find(v => {
              const vn = v.name.toLowerCase();
              if (gender === 'male') return /\b(male|david|mark|james|daniel|george|guy)\b/.test(vn);
              if (gender === 'female') return /\b(female|zira|hazel|susan|samantha|karen|fiona)\b/.test(vn);
              return false;
            });
            if (preferred) utterance.voice = preferred;
          }
          utterance.pitch = gender === 'male' ? 0.85 : 1.0;
          utterance.onend = () => {
            isSpeakingTTSRef.current = false;
            // Resume mic after fallback TTS
            if (session?.inputMode === 'voice') startContinuousListening();
            onEnd();
          };
          synthRef.current.speak(utterance);
        } else {
          isSpeakingTTSRef.current = false;
          if (session?.inputMode === 'voice') startContinuousListening();
          onEnd();
        }
      }
    } catch (error: any) {
      console.error('Error sending message:', error);
      // Rollback the optimistically added rep message
      setMessages((prev) => prev.slice(0, -1));
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
      stopContinuousListening();
      // Send any accumulated text
      const accumulated = interimTranscriptRef.current.trim();
      if (accumulated) {
        interimTranscriptRef.current = '';
        handleSend(accumulated);
      }
    } else {
      startContinuousListening();
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

  // Session timer
  useEffect(() => {
    const interval = setInterval(() => {
      setSessionElapsed(Math.floor((Date.now() - sessionStartRef.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTimer = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
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

          // Mark session as completed (fast DB update)
          await fetch(`/api/roleplay/${sessionId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'completed' }),
          });

          // Navigate to results immediately — the results page will trigger scoring
          // and show a nice "Analyzing..." loading UI while it works
          router.push(`/dashboard/roleplay/${sessionId}/results`);
        } catch (error) {
          console.error('Error ending session:', error);
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          toastError('Failed to end session: ' + errorMessage);
          setLoading(false);
        }
      },
    });
  };

  return (
    <>
      <ConfirmDialog />
      <div className="fixed inset-0 flex flex-col overflow-hidden z-50 bg-linear-to-b from-stone-950 via-stone-900 to-stone-950">
        {/* ─── Top Header Bar ─── */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/5 bg-stone-950/80 backdrop-blur-md z-20 shrink-0">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/dashboard/roleplay')}
              className="gap-2 text-muted-foreground hover:text-foreground rounded-full"
            >
              <PhoneOff className="h-4 w-4" />
              Exit
            </Button>
            <div className="w-px h-5 bg-white/10" />
            <span className="text-sm font-medium text-foreground/90">{session?.offerName || 'Roleplay'}</span>
            {session?.status === 'in_progress' && (
              <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live
              </span>
            )}
          </div>
          {/* Session Timer */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-stone-800/60 border border-white/5">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-sm font-mono text-foreground/80 tabular-nums">{formatTimer(sessionElapsed)}</span>
            </div>
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

        {/* ─── Main Content: Split Panels + Transcript ─── */}
        <div className="flex-1 flex flex-col overflow-hidden min-h-0">
          {/* ─── User & Prospect Panels (Side by Side) ─── */}
          <div className="flex-1 flex min-h-0">
            {/* Left Panel: User */}
            <div className="flex-1 flex flex-col items-center justify-center p-6 border-r border-white/5">
              <div
                className={cn(
                  "relative rounded-full overflow-hidden transition-all duration-300",
                  activeSpeaker === 'rep'
                    ? "ring-4 ring-orange-500/50 shadow-2xl shadow-orange-500/20"
                    : "ring-2 ring-white/10"
                )}
                style={{ width: 'clamp(120px, 14vw, 180px)', height: 'clamp(120px, 14vw, 180px)' }}
              >
                {cameraOn ? (
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                ) : userProfile?.profilePhoto ? (
                  <Avatar className="w-full h-full">
                    <AvatarImage src={userProfile.profilePhoto} alt={userProfile.name} />
                    <AvatarFallback className="bg-orange-500/30 text-orange-300 text-2xl">
                      {userProfile.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-stone-800">
                    <User className="h-12 w-12 text-orange-400" />
                  </div>
                )}
                {activeSpeaker === 'rep' && (
                  <div className="absolute top-2 right-2 w-3 h-3 bg-orange-500 rounded-full animate-pulse ring-2 ring-orange-400/50" />
                )}
              </div>
              <h3 className="mt-3 text-lg font-semibold text-foreground">{userProfile?.name || 'You'}</h3>
              <p className="text-xs text-muted-foreground mt-1">Sales Rep</p>
              {/* Live mic indicator */}
              {isListening && (
                <div className="mt-3 flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/30">
                  <div className="flex items-center gap-0.5">
                    {[0, 1, 2, 3, 4].map(i => (
                      <span
                        key={i}
                        className="w-1 bg-orange-400 rounded-full animate-pulse"
                        style={{
                          height: `${8 + Math.random() * 12}px`,
                          animationDelay: `${i * 0.1}s`,
                          animationDuration: `${0.4 + Math.random() * 0.4}s`,
                        }}
                      />
                    ))}
                  </div>
                  <span className="text-xs text-orange-400 font-medium">Listening</span>
                </div>
              )}
            </div>

            {/* Right Panel: Prospect */}
            <div className="flex-1 flex flex-col items-center justify-center p-6">
              <div
                className={cn(
                  "relative rounded-full overflow-hidden transition-all duration-300",
                  activeSpeaker === 'prospect'
                    ? "ring-4 ring-stone-500/50 shadow-2xl shadow-stone-500/20"
                    : "ring-2 ring-white/10"
                )}
                style={{ width: 'clamp(120px, 14vw, 180px)', height: 'clamp(120px, 14vw, 180px)' }}
              >
                {prospectAvatar ? (
                  <Avatar className="w-full h-full">
                    {resolveProspectAvatarUrl(prospectAvatar.id, prospectAvatar.name, prospectAvatar.avatarUrl) ? (
                      <AvatarImage
                        src={resolveProspectAvatarUrl(prospectAvatar.id, prospectAvatar.name, prospectAvatar.avatarUrl)!}
                        alt={prospectAvatar.name}
                        className="object-cover"
                      />
                    ) : null}
                    <AvatarFallback className={`text-3xl font-bold text-white bg-gradient-to-br ${getProspectPlaceholderColor(prospectAvatar.name)}`}>
                      {getProspectInitials(prospectAvatar.name)}
                    </AvatarFallback>
                  </Avatar>
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-stone-800">
                    <Bot className="h-12 w-12 text-stone-500" />
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
              <h3 className="mt-3 text-lg font-semibold text-foreground">{prospectAvatar?.name ?? 'AI Prospect'}</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs text-center">
                {prospectAvatar?.positionDescription ?? 'Virtual buyer'}
              </p>
              {prospectAvatar?.voiceStyle && (
                <Badge variant="outline" className="mt-2 text-xs border-white/10 text-muted-foreground">
                  {prospectAvatar.voiceStyle}
                </Badge>
              )}
            </div>
          </div>

          {/* ─── Live Transcript Panel (Below) ─── */}
          {showTranscript && (
            <div className="h-[280px] shrink-0 border-t border-white/10 bg-stone-900/80 backdrop-blur-xl flex flex-col">
              <div className="border-b border-white/5 px-4 py-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-0">
                  {(['transcript', 'pinned', 'notes'] as const).map((tab) => (
                    <Button
                      key={tab}
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "rounded-none border-b-2 border-transparent text-xs h-8",
                        transcriptTab === tab && "border-primary font-medium"
                      )}
                      onClick={() => setTranscriptTab(tab)}
                    >
                      {tab === 'transcript' ? 'Transcript' : tab === 'pinned' ? 'Pinned' : 'Notes'}
                    </Button>
                  ))}
                </div>
                {transcriptTab === 'transcript' && (
                  <div className="relative max-w-xs">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Search..."
                      value={transcriptSearch}
                      onChange={(e) => setTranscriptSearch(e.target.value)}
                      className="pl-8 h-7 text-xs bg-background/40 w-48"
                      aria-label="Search transcript"
                    />
                  </div>
                )}
              </div>
              {transcriptTab === 'transcript' && (
                <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                  {(() => {
                    const filtered = transcriptSearch.trim()
                      ? messages.filter((m) =>
                        m.content.toLowerCase().includes(transcriptSearch.trim().toLowerCase())
                      )
                      : messages;
                    if (filtered.length === 0) {
                      return (
                        <div className="text-center py-8 text-muted-foreground text-sm">
                          <p>{transcriptSearch.trim() ? 'No messages match your search.' : 'Conversation will appear here'}</p>
                        </div>
                      );
                    }
                    return filtered.map((msg, idx) => (
                      <div
                        key={msg.id ?? idx}
                        className="group flex gap-3"
                        data-timestamp={msg.timestamp ?? idx * 5000}
                      >
                        <div className="shrink-0 flex flex-col items-center gap-1">
                          <span className={cn(
                            "text-[10px] font-bold uppercase tracking-wider",
                            msg.role === 'rep' ? "text-orange-400" : "text-blue-400"
                          )}>
                            {msg.role === 'rep' ? 'REP' : 'PRO'}
                          </span>
                          {typeof msg.timestamp === 'number' && (
                            <span className="text-[10px] text-muted-foreground/60 tabular-nums">
                              {formatMessageTime(msg.timestamp)}
                            </span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white/90 whitespace-pre-wrap leading-relaxed">
                            {msg.role === 'prospect' ? cleanForSpeech(msg.content) : msg.content}
                          </p>
                          {msg.metadata?.objectionType && (
                            <Badge variant="outline" className="text-[10px] mt-1 h-5">
                              {msg.metadata.objectionType}
                            </Badge>
                          )}
                        </div>
                        {msg.id && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-70 hover:opacity-100 transition-opacity"
                            onClick={() => togglePin(msg.id!)}
                            title={pinnedMessageIds.includes(msg.id) ? 'Unpin' : 'Pin'}
                            aria-label={pinnedMessageIds.includes(msg.id) ? 'Unpin' : 'Pin'}
                          >
                            {pinnedMessageIds.includes(msg.id) ? (
                              <Pin className="h-3.5 w-3.5 fill-current" />
                            ) : (
                              <PinOff className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        )}
                      </div>
                    ));
                  })()}
                  {loading && (
                    <div className="flex gap-3">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400 shrink-0">PRO</span>
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Typing…</span>
                      </div>
                    </div>
                  )}
                  <div ref={transcriptEndRef} />
                </div>
              )}
              {transcriptTab === 'pinned' && (
                <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                  {pinnedMessageIds.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      <p>No pinned messages.</p>
                      <p className="text-xs mt-1">Pin lines from the Transcript tab.</p>
                    </div>
                  ) : (
                    messages
                      .filter((m) => m.id && pinnedMessageIds.includes(m.id))
                      .map((msg) => (
                        <div key={msg.id} className="flex gap-3">
                          <span className={cn(
                            "text-[10px] font-bold uppercase tracking-wider shrink-0",
                            msg.role === 'rep' ? "text-orange-400" : "text-blue-400"
                          )}>
                            {msg.role === 'rep' ? 'REP' : 'PRO'}
                          </span>
                          <p className="text-sm text-white/90 whitespace-pre-wrap flex-1">{msg.role === 'prospect' ? cleanForSpeech(msg.content) : msg.content}</p>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0"
                            onClick={() => togglePin(msg.id!)}
                            title="Unpin"
                            aria-label="Unpin"
                          >
                            <Pin className="h-3.5 w-3.5 fill-current" />
                          </Button>
                        </div>
                      ))
                  )}
                </div>
              )}
              {transcriptTab === 'notes' && (
                <div className="flex-1 flex flex-col px-4 py-3 min-h-0">
                  <p className="text-xs text-muted-foreground mb-2">Session notes (saved automatically)</p>
                  <textarea
                    className="flex-1 min-h-[120px] w-full rounded-md border bg-background/30 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
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
        </div>

        {/* ─── Floating Control Bar ─── */}
        <div className="shrink-0 flex justify-center p-3 bg-stone-950/90 backdrop-blur-md border-t border-white/5">
          <div className="flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-stone-900/95 backdrop-blur-xl border border-white/10 shadow-2xl max-w-2xl w-full">
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
                  isListening && "ring-2 ring-orange-500/50 bg-orange-500/20"
                )}
                title={isListening ? 'Stop voice input' : 'Start voice input'}
              >
                {isListening ? (
                  <span className="relative flex">
                    <Mic className="h-5 w-5 text-orange-400" />
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
