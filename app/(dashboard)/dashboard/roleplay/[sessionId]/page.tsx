'use client';

import { Suspense, useState, useEffect, useRef } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { RoleplaySessionSkeleton } from '@/components/dashboard/skeletons';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Mic, MicOff, Video, VideoOff, PhoneOff, MessageSquare, MoreVertical, Loader2, User, Bot } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { toastError } from '@/lib/toast';
import { useConfirmDialog } from '@/hooks/use-confirm-dialog';
import { resolveProspectAvatarUrl } from '@/lib/prospect-avatar';

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
}

interface ProspectAvatar {
  id: string;
  name: string;
  avatarUrl?: string | null;
  positionDescription?: string | null;
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
    } catch (error) {
      console.error('Error fetching session:', error);
    }
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
        role: 'prospect',
        content: data.response,
        timestamp: Date.now(),
        metadata: data.metadata,
      };

      setMessages((prev) => [...prev, prospectMessage]);
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
          const ttsRes = await fetch('/api/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: speakText }),
          });
          if (ttsRes.ok && ttsRes.body) {
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
            fallbackSpeak(speakText, onEnd);
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
      <div className="fixed inset-0 flex flex-col bg-background overflow-hidden z-50">
        {/* Minimal Header - Arena Mode */}
        <div className="border-b bg-card/80 backdrop-blur-md p-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/dashboard/roleplay')}
              className="gap-2"
            >
              <PhoneOff className="h-4 w-4" />
              Exit Arena
            </Button>
            <div className="h-4 w-px bg-border" />
            <div>
              <h1 className="text-sm font-semibold">{session?.offerName || 'Roleplay Session'}</h1>
              <p className="text-xs text-muted-foreground">
                {session?.inputMode === 'voice' ? 'Voice Mode' : 'Text Mode'} • {messages.length} messages
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant={cameraOn ? 'default' : 'outline'}
              size="sm"
              onClick={toggleCamera}
              className="gap-1"
            >
              <Video className="h-4 w-4" />
              {cameraOn ? 'Camera on' : 'Turn on camera'}
            </Button>
            {session?.status === 'in_progress' && (
              <Badge variant="default" className="bg-blue-500 text-xs">In Progress</Badge>
            )}
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex overflow-hidden bg-linear-to-br from-background via-background to-muted/10">
          {/* Video Grid Area (Left) */}
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="grid grid-cols-2 gap-4 w-full max-w-4xl">
              {/* Rep (You) */}
              <Card
                className={cn(
                  "aspect-video relative overflow-hidden border-2 transition-all duration-300 bg-card",
                  activeSpeaker === 'rep'
                    ? "border-orange-500 shadow-2xl shadow-orange-500/50 scale-[1.02] ring-4 ring-orange-500/20"
                    : "border-border/50"
                )}
              >
                <div className="absolute inset-0 bg-linear-to-br from-primary/10 via-primary/5 to-transparent flex items-center justify-center">
                  <div className="text-center z-10 w-full h-full flex flex-col items-center justify-center">
                    {cameraOn && videoRef.current ? (
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className={cn(
                          "w-full h-full object-cover rounded-lg transition-all duration-300",
                          activeSpeaker === 'rep' && "ring-4 ring-orange-500/30 scale-[1.02]"
                        )}
                      />
                    ) : (
                      <>
                        <div className={cn(
                          "w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-3 transition-all duration-300 overflow-hidden",
                          activeSpeaker === 'rep'
                            ? "ring-4 ring-orange-500/30 scale-110"
                            : ""
                        )}>
                          {userProfile?.profilePhoto ? (
                            <Avatar className="w-full h-full">
                              <AvatarImage src={userProfile.profilePhoto} alt={userProfile.name} />
                              <AvatarFallback className="bg-primary/40 text-primary">
                                {userProfile.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                          ) : (
                            <div className={cn(
                              "w-full h-full flex items-center justify-center",
                              activeSpeaker === 'rep' ? "bg-primary/40" : "bg-primary/20"
                            )}>
                              <User className="h-12 w-12 text-primary" />
                            </div>
                          )}
                        </div>
                        <p className="font-semibold text-lg">{userProfile?.name || 'You'}</p>
                        <p className="text-xs text-muted-foreground">Rep</p>
                      </>
                    )}
                    {isListening && (
                      <div className="mt-2 flex items-center justify-center gap-2">
                        <div className="flex gap-1">
                          <div className="w-2 h-2 bg-orange-400 rounded-full animate-pulse"></div>
                          <div className="w-2 h-2 bg-orange-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                          <div className="w-2 h-2 bg-orange-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                        </div>
                        <span className="text-xs text-orange-400 font-medium">Listening...</span>
                      </div>
                    )}
                  </div>
                </div>
                {activeSpeaker === 'rep' && (
                  <div className="absolute top-3 right-3 z-20">
                    <div className="w-4 h-4 bg-orange-400 rounded-full animate-pulse ring-2 ring-orange-400/50"></div>
                  </div>
                )}
              </Card>

              {/* Prospect (AI or selected avatar) */}
              <Card
                className={cn(
                  "aspect-video relative overflow-hidden border-2 transition-all duration-300 bg-card",
                  activeSpeaker === 'prospect'
                    ? "border-blue-500 shadow-2xl shadow-blue-500/50 scale-[1.02] ring-4 ring-blue-500/20"
                    : "border-border/50"
                )}
              >
                <div className="absolute inset-0 bg-linear-to-br from-muted/10 via-muted/5 to-transparent flex items-center justify-center">
                  <div className="text-center z-10">
                    <div className={cn(
                      "w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-3 transition-all duration-300 overflow-hidden",
                      activeSpeaker === 'prospect'
                        ? "ring-4 ring-blue-500/30 scale-110"
                        : "bg-muted/20"
                    )}>
                      {prospectAvatar ? (
                        <Avatar className="w-full h-full">
                          <AvatarImage
                            src={resolveProspectAvatarUrl(prospectAvatar.id, prospectAvatar.name, prospectAvatar.avatarUrl)}
                            alt={prospectAvatar.name}
                            className="object-cover"
                          />
                          <AvatarFallback className="bg-blue-500/20 text-blue-600">
                            {prospectAvatar.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      ) : (
                        <Bot className="h-12 w-12 text-foreground" />
                      )}
                    </div>
                    <p className="font-semibold text-lg">{prospectAvatar?.name ?? 'AI Prospect'}</p>
                    <p className="text-xs text-muted-foreground">
                      {prospectAvatar?.positionDescription ?? 'Virtual Buyer'}
                    </p>
                    {loading && (
                      <div className="mt-2 flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                        <span className="text-xs text-blue-500 font-medium">Thinking...</span>
                      </div>
                    )}
                  </div>
                </div>
                {activeSpeaker === 'prospect' && (
                  <div className="absolute top-3 right-3 z-20">
                    <div className="w-4 h-4 bg-blue-500 rounded-full animate-pulse ring-2 ring-blue-500/50"></div>
                  </div>
                )}
              </Card>
            </div>
          </div>

          {/* Transcript Panel (Right) */}
          {showTranscript && (
            <div className="w-96 border-l bg-card/80 backdrop-blur-md flex flex-col shrink-0">
              <div className="border-b p-4 flex items-center justify-between">
                <h2 className="font-semibold">Transcript</h2>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowTranscript(false)}
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <p>Conversation will appear here</p>
                  </div>
                ) : (
                  messages.map((msg, idx) => (
                    <div
                      key={idx}
                      className="space-y-1"
                      data-timestamp={msg.timestamp || idx * 5000}
                    >
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "font-semibold text-sm",
                          msg.role === 'rep' ? "text-primary" : "text-muted-foreground"
                        )}>
                          {msg.role === 'rep' ? 'You' : 'Prospect'}
                        </span>
                        {msg.metadata?.objectionType && (
                          <Badge variant="outline" className="text-xs">
                            {msg.metadata.objectionType}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-foreground/80 whitespace-pre-wrap">
                        {msg.content}
                      </p>
                    </div>
                  ))
                )}
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
            </div>
          )}

          {/* Show Transcript Button (when hidden) */}
          {!showTranscript && (
            <Button
              variant="secondary"
              size="icon"
              className="fixed top-20 right-4 z-30 shadow-lg"
              onClick={() => setShowTranscript(true)}
            >
              <MessageSquare className="h-5 w-5" />
            </Button>
          )}
        </div>

        {/* Footer Controls - Clean Meeting Style */}
        <div className="border-t bg-card/95 backdrop-blur-md p-4 flex items-center justify-center shrink-0">
          <div className="flex items-center gap-4 max-w-5xl w-full">
            {/* Left: AI Voice Control */}
            <div className="flex items-center gap-2">
              <Button
                variant={isMuted ? 'destructive' : 'outline'}
                size="icon"
                onClick={handleMute}
                className="rounded-full h-11 w-11"
                title={isMuted ? 'Unmute AI voice' : 'Mute AI voice'}
              >
                {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              </Button>
              <span className="text-xs text-muted-foreground hidden sm:block">
                {isMuted ? 'AI Muted' : 'AI Voice'}
              </span>
            </div>

            {/* Center: Input Area */}
            <div className="flex-1 flex items-center gap-2">
              {/* Voice Input Button (only in voice mode) */}
              {session?.inputMode === 'voice' && (
                <Button
                  variant={isListening ? 'default' : 'outline'}
                  size="icon"
                  onClick={handleVoiceInput}
                  className={cn(
                    "rounded-full h-11 w-11 border-2 transition-all",
                    isListening && "border-blue-500 ring-2 ring-blue-500/20"
                  )}
                  title={isListening ? 'Stop voice input' : 'Start voice input'}
                >
                  {isListening ? (
                    <div className="relative">
                      <Mic className="h-5 w-5" />
                      <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse border-2 border-background"></div>
                    </div>
                  ) : (
                    <Mic className="h-5 w-5" />
                  )}
                </Button>
              )}

              {/* Text Input */}
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={
                  session?.inputMode === 'voice'
                    ? (isListening ? 'Listening...' : 'Click mic or type here...')
                    : 'Type your message...'
                }
                disabled={loading || isListening}
                className="flex-1 bg-background/90 border-border/50 h-11"
              />

              {/* Send Button */}
              <Button
                onClick={() => handleSend()}
                disabled={loading || !input.trim() || isListening}
                size="icon"
                className="rounded-full h-11 w-11"
                title="Send message"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <MessageSquare className="h-4 w-4" />
                )}
              </Button>
            </div>

            {/* Right: End Call */}
            <Button
              variant="destructive"
              size="icon"
              onClick={handleEndSession}
              className="rounded-full h-11 w-11"
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
