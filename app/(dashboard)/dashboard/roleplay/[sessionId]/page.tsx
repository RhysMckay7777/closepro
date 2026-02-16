'use client';

import { Suspense, useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { RoleplaySessionSkeleton } from '@/components/dashboard/skeletons';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Mic, MicOff, Video, PhoneOff, MessageSquare, Loader2, User, Bot, Pin, PinOff, Search, ChevronDown, ChevronUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { toastError } from '@/lib/toast';
import { resolveProspectAvatarUrl, getProspectInitials, getProspectPlaceholderColor } from '@/lib/prospect-avatar';
import { getVoiceIdFromProspect } from '@/lib/ai/roleplay/voice-mapping';
import { ElevenLabsClient } from '@/lib/tts/elevenlabs-client';
import { useVoiceSession, type VoiceTranscriptEntry } from '@/hooks/use-voice-session';
import { VoiceSessionControls } from '@/components/roleplay/VoiceSessionControls';
import { VoicePermissionGate } from '@/components/roleplay/VoicePermissionGate';

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
  backstory?: string | null;
}

interface OfferInfo {
  id: string;
  name: string;
  description?: string | null;
  price?: number | null;
  offerType?: string | null;
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
  const [offerInfo, setOfferInfo] = useState<OfferInfo | null>(null);
  const [showRoleContext, setShowRoleContext] = useState(false);
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
  const [voiceStarted, setVoiceStarted] = useState(false);
  const [voicePermissionGranted, setVoicePermissionGranted] = useState(false);
  const [showEndSessionDialog, setShowEndSessionDialog] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const ttsProviderRef = useRef<ElevenLabsClient | null>(null);
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

  // Derive voice mode from session
  const isVoiceMode = session?.inputMode === 'voice';

  // Voice session hook (ElevenLabs Conversational AI)
  const handleVoiceTranscriptUpdate = useCallback((entries: VoiceTranscriptEntry[]) => {
    // Map voice transcript entries into the messages array for the transcript sidebar
    setMessages(entries.map((e) => ({
      role: e.role,
      content: e.content,
      timestamp: e.timestamp,
      messageType: 'voice' as const,
    })));
  }, []);

  const handleVoiceError = useCallback((message: string) => {
    toastError('Voice error: ' + message);
  }, []);

  const voiceSession = useVoiceSession({
    sessionId,
    onTranscriptUpdate: handleVoiceTranscriptUpdate,
    onError: handleVoiceError,
  });

  // Derive active speaker from voice session
  useEffect(() => {
    if (!isVoiceMode) return;
    if (voiceSession.isSpeaking) {
      setActiveSpeaker('prospect');
    } else if (voiceSession.voiceStatus === 'connected') {
      // When not speaking but connected, the user is likely talking
      setActiveSpeaker('rep');
    } else {
      setActiveSpeaker(null);
    }
  }, [isVoiceMode, voiceSession.isSpeaking, voiceSession.voiceStatus]);

  useEffect(() => {
    fetchSession();
    fetchUserProfile();

    // Handle timestamp navigation from feedback clicks
    const timestamp = searchParams?.get('timestamp');
    if (timestamp) {
      const timestampMs = parseInt(timestamp);
      setTimeout(() => {
        const messageElement = document.querySelector(`[data-timestamp="${timestampMs}"]`);
        if (messageElement) {
          messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
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

  // Initialize text-mode voice (Web Speech API + TTS) only when NOT in voice mode
  useEffect(() => {
    if (session && !isVoiceMode) {
      initializeTextModeVoice();
    }
  }, [session, isVoiceMode]);

  // Auto-start voice session when permission is granted and session is loaded
  useEffect(() => {
    if (
      isVoiceMode &&
      voicePermissionGranted &&
      !voiceStarted &&
      session?.status === 'in_progress'
    ) {
      setVoiceStarted(true);
      voiceSession.startVoice();
    }
  }, [isVoiceMode, voicePermissionGranted, voiceStarted, session?.status]);

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
      setOfferInfo(data.offer ?? null);
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
    // For voice mode, timestamps are already relative (ms from session start)
    // For text mode, ms is Date.now() — make it relative to session start
    const elapsed = isVoiceMode ? Math.max(0, ms) : Math.max(0, ms - sessionStartRef.current);
    const s = Math.floor(elapsed / 1000);
    const m = Math.floor(s / 60);
    return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
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

  // === TEXT MODE ONLY: Web Speech API + ElevenLabs TTS ===

  const shouldAutoSend = (text: string): boolean => {
    const trimmed = text.trim();
    if (!trimmed || trimmed.split(/\s+/).length < 3) return false;
    if (/[.!?]$/.test(trimmed)) return true;
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

  const initializeTextModeVoice = () => {
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

        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

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

      recognitionRef.current.onend = () => {
        if (session?.inputMode === 'voice' && !isSpeakingTTSRef.current) {
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

    // Initialize ElevenLabs TTS provider
    if (!ttsProviderRef.current) {
      ttsProviderRef.current = new ElevenLabsClient();
    }
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

      if (activeSpeakerTimeoutRef.current) {
        clearTimeout(activeSpeakerTimeoutRef.current);
      }
      activeSpeakerTimeoutRef.current = setTimeout(() => {
        setActiveSpeaker(null);
      }, 5000);

      // Speak prospect response via ElevenLabs TTS provider (text mode only)
      if (!isMuted && ttsProviderRef.current) {
        ttsProviderRef.current.stop();
        const speakText = cleanForSpeech(data.response);
        try {
          if (!lockedVoiceIdRef.current && prospectAvatar) {
            lockedVoiceIdRef.current = getVoiceIdFromProspect(prospectAvatar);
          }
          const voiceId = lockedVoiceIdRef.current || undefined;

          isSpeakingTTSRef.current = true;
          if (recognitionRef.current && isListening) {
            try { recognitionRef.current.stop(); } catch { /* ignore */ }
          }

          await ttsProviderRef.current.speak(speakText, voiceId);

          isSpeakingTTSRef.current = false;
          if (session?.inputMode === 'voice') startContinuousListening();
          setActiveSpeaker(null);
        } catch (ttsErr) {
          isSpeakingTTSRef.current = false;
          if (session?.inputMode === 'voice') startContinuousListening();
          setActiveSpeaker(null);
          console.error('[TTS] Voice playback failed:', ttsErr);
          toastError('Voice playback unavailable — check your ElevenLabs configuration');
        }
      }
    } catch (error: any) {
      console.error('Error sending message:', error);
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
    if (isVoiceMode) {
      // In voice mode, mute/unmute controls ElevenLabs volume
      const newMuted = !isMuted;
      setIsMuted(newMuted);
      voiceSession.setVolume({ volume: newMuted ? 0 : 1 });
    } else {
      setIsMuted(!isMuted);
      if (!isMuted && ttsProviderRef.current) {
        ttsProviderRef.current.stop();
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

  const handleSwitchToText = () => {
    // Switch current session to text mode (in-memory only)
    if (session) {
      // End voice if active
      if (voiceSession.voiceStatus === 'connected') {
        voiceSession.endVoice();
      }
      setSession({ ...session, inputMode: 'text' });
      setVoiceStarted(false);
      setVoicePermissionGranted(false);
    }
  };

  // Only show the dialog — no heavy work here
  const handleEndSession = useCallback(() => {
    setShowEndSessionDialog(true);
  }, []);

  // Heavy work runs only when the user confirms inside the dialog
  const confirmEndSession = useCallback(async () => {
    setShowEndSessionDialog(false);
    try {
      setLoading(true);

      // End voice session if active (persists transcript)
      if (isVoiceMode && voiceSession.voiceStatus === 'connected') {
        await voiceSession.endVoice();
      }

      if (ttsProviderRef.current) ttsProviderRef.current.stop();

      // Mark session as completed
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
      setLoading(false);
    }
  }, [isVoiceMode, voiceSession, sessionId, router]);

  // Voice mode: wrap the avatar area + controls in a permission gate
  const renderVoiceContent = () => {
    if (!voicePermissionGranted) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <VoicePermissionGate
            onFallbackToText={handleSwitchToText}
          >
            {/* This renders when permission is granted */}
            <VoicePermissionGrantedTrigger
              onGranted={() => setVoicePermissionGranted(true)}
            />
          </VoicePermissionGate>
        </div>
      );
    }

    return (
      <>
        {renderAvatarArea()}
        <VoiceSessionControls
          voiceStatus={voiceSession.voiceStatus}
          isSpeaking={voiceSession.isSpeaking}
          isMuted={isMuted}
          cameraOn={cameraOn}
          onMuteToggle={handleMute}
          onEndCall={handleEndSession}
          onSwitchToText={handleSwitchToText}
          onRetry={async () => {
            // Clean up existing session before retrying
            await voiceSession.endVoice();
            setVoiceStarted(false);
            // Small delay to ensure cleanup completes
            setTimeout(() => {
              setVoiceStarted(true);
              voiceSession.startVoice();
            }, 500);
          }}
          onToggleCamera={toggleCamera}
          error={voiceSession.error}
          reconnectFailed={voiceSession.reconnectFailed}
        />
      </>
    );
  };

  const renderAvatarArea = () => (
    <div className="flex-1 flex items-center justify-center p-3 sm:p-4 min-h-0 overflow-hidden">
      <div className="w-full max-w-5xl flex flex-col md:flex-row items-stretch gap-4 md:gap-0 min-h-0 max-h-full overflow-hidden">

        {/* ── User / Closer Tile ── */}
        <div
          className={cn(
            "flex-1 rounded-xl overflow-hidden border transition-all duration-300 flex flex-col min-h-0",
            activeSpeaker === 'rep'
              ? "border-blue-400/40 shadow-lg shadow-blue-500/10"
              : "border-white/10",
            "bg-gradient-to-br from-blue-900/30 via-slate-900/60 to-blue-950/40"
          )}
        >
          {cameraOn ? (
            /* Large video tile when camera is on */
            <div className="relative flex-1 min-h-0">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="absolute inset-0 w-full h-full object-cover rounded-xl"
              />
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4 rounded-b-xl">
                <div className="flex items-center gap-2">
                  {activeSpeaker === 'rep' && (
                    <div className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse shrink-0" />
                  )}
                  <span className="text-sm font-semibold text-white">{userProfile?.name || 'You'}</span>
                  <span className="text-[10px] text-blue-300/80 uppercase tracking-wider ml-auto">Closer</span>
                </div>
              </div>
            </div>
          ) : (
            /* Avatar tile when camera is off */
            <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 min-h-0">
              <div
                className={cn(
                  "w-20 h-20 sm:w-28 sm:h-28 md:w-32 md:h-32 rounded-full overflow-hidden border-2 transition-all duration-300 flex items-center justify-center shrink-0",
                  activeSpeaker === 'rep'
                    ? "border-blue-400 shadow-lg shadow-blue-500/20"
                    : "border-blue-500/40 bg-blue-500/20"
                )}
              >
                {userProfile?.profilePhoto ? (
                  <Avatar className="w-full h-full">
                    <AvatarImage src={userProfile.profilePhoto} alt={userProfile.name} />
                    <AvatarFallback className="bg-blue-500/30 text-blue-300 text-3xl">
                      {userProfile.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                ) : (
                  <Mic className="h-10 w-10 text-blue-400" />
                )}
              </div>
              <span className="text-base font-semibold text-blue-300 mt-3">{userProfile?.name || 'You'}</span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">Closer</span>
              {activeSpeaker === 'rep' && (
                <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse mt-2" />
              )}
              {!isVoiceMode && isListening && !activeSpeaker && (
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 mt-2">
                  <div className="flex items-center gap-0.5">
                    {[0, 1, 2, 3, 4].map(i => (
                      <span
                        key={i}
                        className="w-1 bg-blue-400 rounded-full animate-pulse"
                        style={{
                          height: `${6 + Math.random() * 8}px`,
                          animationDelay: `${i * 0.1}s`,
                          animationDuration: `${0.4 + Math.random() * 0.4}s`,
                        }}
                      />
                    ))}
                  </div>
                  <span className="text-[10px] text-blue-400 font-medium">Listening</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Vertical Divider (desktop) ── */}
        <div className="hidden md:flex flex-col items-center justify-center px-3 shrink-0">
          <div className="w-px flex-1 bg-gradient-to-b from-blue-500/40 to-transparent" />
          <div className="py-2.5 flex flex-col items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-[10px] text-muted-foreground font-medium tracking-widest">LIVE</span>
          </div>
          <div className="w-px flex-1 bg-gradient-to-b from-transparent to-amber-500/40" />
        </div>

        {/* ── Horizontal Divider (mobile) ── */}
        <div className="md:hidden flex items-center gap-3 px-4 shrink-0">
          <div className="flex-1 h-px bg-gradient-to-r from-blue-500/30 to-transparent" />
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-[10px] text-muted-foreground font-medium tracking-wider">LIVE</span>
          </div>
          <div className="flex-1 h-px bg-gradient-to-r from-transparent to-amber-500/30" />
        </div>

        {/* ── AI Prospect Tile ── */}
        <div
          className={cn(
            "flex-1 rounded-xl overflow-y-auto border transition-all duration-300 flex flex-col items-center p-4 sm:p-6 min-h-0",
            activeSpeaker === 'prospect'
              ? "border-amber-400/40 shadow-lg shadow-amber-500/10"
              : "border-white/10",
            "bg-gradient-to-br from-amber-900/30 via-slate-900/60 to-amber-950/40"
          )}
        >
          {/* Prospect Avatar */}
          <div className="relative shrink-0">
            <div
              className={cn(
                "w-20 h-20 sm:w-28 sm:h-28 md:w-32 md:h-32 rounded-full overflow-hidden border-2 transition-all duration-300",
                activeSpeaker === 'prospect'
                  ? "border-amber-400 shadow-lg shadow-amber-500/20"
                  : "border-amber-500/40"
              )}
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
                  <Bot className="h-10 w-10 text-stone-500" />
                </div>
              )}
            </div>
            {loading && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-full">
                <Loader2 className="h-6 w-6 animate-spin text-stone-400" />
              </div>
            )}
          </div>

          {/* Prospect Name — larger font */}
          <h3 className="text-lg sm:text-xl font-bold text-amber-300 mt-3 shrink-0">
            {prospectAvatar?.name ?? 'AI Prospect'}
          </h3>
          {activeSpeaker === 'prospect' && (
            <div className="w-3 h-3 rounded-full bg-amber-500 animate-pulse mt-2 shrink-0" />
          )}

          {/* Prospect Description — larger font */}
          <p className="text-sm sm:text-base text-muted-foreground text-center mt-2 max-w-sm leading-relaxed shrink-0">
            {prospectAvatar?.positionDescription ?? 'Virtual Buyer'}
          </p>

          {/* What You're Selling — always visible */}
          {offerInfo && (
            <div className="mt-3 w-full max-w-sm rounded-lg border border-white/10 bg-white/5 p-3 shrink-0">
              <h5 className="text-[10px] font-bold text-foreground/60 uppercase tracking-wider mb-1.5">What You{'\u2019'}re Selling</h5>
              <p className="text-sm sm:text-base font-medium text-foreground">{offerInfo.name}</p>
              {offerInfo.price != null && (
                <p className="text-sm text-amber-300/80 mt-0.5">{'\u00A3'}{(offerInfo.price / 100).toLocaleString()}</p>
              )}
              {offerInfo.description && (
                <p className="text-xs text-muted-foreground leading-relaxed mt-1.5 line-clamp-2">{offerInfo.description}</p>
              )}
            </div>
          )}

          {/* Expandable Role Context */}
          {prospectAvatar?.backstory && (
            <>
              <div className="mt-3 shrink-0">
                <button
                  onClick={() => setShowRoleContext(!showRoleContext)}
                  className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                >
                  <span>Backstory</span>
                  {showRoleContext ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </button>
              </div>
              {showRoleContext && (
                <div className="mt-2 w-full max-w-sm rounded-lg border border-white/10 bg-white/5 p-3 shrink-0">
                  <p className="text-xs text-muted-foreground leading-relaxed">{prospectAvatar.backstory}</p>
                </div>
              )}
            </>
          )}
        </div>

      </div>
    </div>
  );

  const renderTextModeControls = () => (
    <div className="shrink-0 flex justify-center p-3 border-t border-white/5 bg-stone-950/60">
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
  );

  return (
    <>
      <div className="fixed inset-0 h-dvh flex flex-col overflow-hidden z-50 bg-gradient-to-br from-indigo-950/90 via-stone-950 to-purple-950/60">
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
            {isVoiceMode && (
              <Badge variant="outline" className="text-[10px] h-5 border-blue-500/30 text-blue-400">
                Voice AI
              </Badge>
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

        {/* ─── Main Content: Gradient Avatar + Sidebar Transcript ─── */}
        <div className="flex-1 flex overflow-hidden min-h-0">
          {/* LEFT: Avatar area + controls */}
          <div className="flex-1 flex flex-col min-w-0 min-h-0">
            {isVoiceMode ? renderVoiceContent() : (
              <>
                {renderAvatarArea()}
                {renderTextModeControls()}
              </>
            )}
          </div>

          {/* RIGHT: Sidebar Transcript */}
          {showTranscript && (
            <div className="w-[400px] shrink-0 border-l border-white/10 bg-stone-900/80 backdrop-blur-xl flex flex-col">
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
                            {msg.role === 'rep' ? 'Closer' : 'Prospect'}
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
                      <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400 shrink-0">Prospect</span>
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
                            {msg.role === 'rep' ? 'Closer' : 'Prospect'}
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

      </div>

      {/* ─── End Session Confirmation ─── */}
      {/* Rendered outside the main layout so it never affects tile flex sizing */}
      <div
        className={cn(
          'fixed inset-0 z-[999] flex items-center justify-center',
          showEndSessionDialog ? 'pointer-events-auto' : 'pointer-events-none'
        )}
      >
        {/* Backdrop */}
        <div
          className={cn(
            'absolute inset-0 bg-black/60 transition-opacity duration-200',
            showEndSessionDialog ? 'opacity-100' : 'opacity-0'
          )}
          onClick={() => setShowEndSessionDialog(false)}
        />
        {/* Panel */}
        <div
          className={cn(
            'relative z-10 bg-stone-900 border border-white/10 rounded-xl shadow-2xl p-6 max-w-sm w-full mx-4 transition-all duration-200 ease-out',
            showEndSessionDialog ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
          )}
        >
          <h3 className="text-lg font-semibold text-foreground">End roleplay session?</h3>
          <p className="text-sm text-muted-foreground mt-2">
            This session will be analyzed and scored. You can view results afterward.
          </p>
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="ghost" onClick={() => setShowEndSessionDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmEndSession}>
              End &amp; Score
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * Helper component: triggers onGranted callback when rendered (inside VoicePermissionGate children)
 */
function VoicePermissionGrantedTrigger({ onGranted }: { onGranted: () => void }) {
  useEffect(() => {
    onGranted();
  }, [onGranted]);
  return null;
}

export default function RoleplaySessionPage() {
  return (
    <Suspense fallback={<RoleplaySessionSkeleton />}>
      <RoleplaySessionContent />
    </Suspense>
  );
}
