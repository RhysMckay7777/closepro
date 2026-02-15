'use client';

import { PhoneOff, Mic, MicOff, Volume2, VolumeX, MessageSquare, Loader2, RefreshCw, Video, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Status } from '@elevenlabs/react';

interface VoiceSessionControlsProps {
  voiceStatus: Status;
  isSpeaking: boolean;
  isMuted: boolean;
  cameraOn: boolean;
  onMuteToggle: () => void;
  onEndCall: () => void;
  onSwitchToText: () => void;
  onRetry: () => void;
  onToggleCamera: () => void;
  error: string | null;
  reconnectFailed?: boolean;
}

export function VoiceSessionControls({
  voiceStatus,
  isSpeaking,
  isMuted,
  cameraOn,
  onMuteToggle,
  onEndCall,
  onSwitchToText,
  onRetry,
  onToggleCamera,
  error,
  reconnectFailed = false,
}: VoiceSessionControlsProps) {
  const isConnected = voiceStatus === 'connected';
  const isConnecting = voiceStatus === 'connecting';
  const isError = error !== null;

  return (
    <div className="shrink-0 flex flex-col items-center gap-2 p-3 border-t border-white/5 bg-stone-950/60">
      {/* Reconnection failed banner */}
      {reconnectFailed && (
        <div className="w-full max-w-2xl rounded-xl bg-red-950/60 border border-red-500/30 p-4 flex flex-col items-center gap-3">
          <div className="flex items-center gap-2 text-red-400">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <span className="text-sm font-medium">Voice connection lost after multiple retries</span>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={onRetry}
              className="border-red-500/30 text-red-300 hover:bg-red-500/10"
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              Try Again
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={onSwitchToText}
            >
              <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
              Switch to Text Mode
            </Button>
          </div>
        </div>
      )}

      {/* Status indicator */}
      <div className="flex items-center gap-2 text-xs">
        {isConnecting && (
          <>
            <Loader2 className="h-3 w-3 animate-spin text-blue-400" />
            <span className="text-blue-400">Connecting to voice...</span>
          </>
        )}
        {isConnected && !isSpeaking && (
          <>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-emerald-400">Connected — listening</span>
          </>
        )}
        {isConnected && isSpeaking && (
          <>
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-amber-400">Prospect speaking...</span>
          </>
        )}
        {isError && !reconnectFailed && (
          <>
            <span className="w-2 h-2 rounded-full bg-red-400" />
            <span className="text-red-400 max-w-xs truncate">{error}</span>
          </>
        )}
        {voiceStatus === 'disconnected' && !isError && (
          <>
            <span className="w-2 h-2 rounded-full bg-stone-500" />
            <span className="text-stone-400">Disconnected</span>
          </>
        )}
      </div>

      {/* Control bar */}
      <div className="flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-stone-900/95 backdrop-blur-xl border border-white/10 shadow-2xl max-w-2xl w-full justify-center">
        {/* Mute/unmute AI voice */}
        <Button
          variant={isMuted ? 'destructive' : 'ghost'}
          size="icon"
          onClick={onMuteToggle}
          className="rounded-full h-10 w-10 shrink-0"
          title={isMuted ? 'Unmute' : 'Mute'}
          disabled={!isConnected}
        >
          {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
        </Button>

        {/* Center mic indicator */}
        <div
          className={cn(
            'relative rounded-full h-14 w-14 flex items-center justify-center border-2 transition-all duration-300',
            isConnected && !isSpeaking && 'border-emerald-500/60 bg-emerald-500/10',
            isConnected && isSpeaking && 'border-amber-500/60 bg-amber-500/10',
            isConnecting && 'border-blue-500/60 bg-blue-500/10',
            !isConnected && !isConnecting && 'border-stone-600 bg-stone-800/50'
          )}
        >
          {isConnecting ? (
            <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
          ) : isConnected ? (
            <Mic className={cn('h-6 w-6', isSpeaking ? 'text-amber-400' : 'text-emerald-400')} />
          ) : (
            <MicOff className="h-6 w-6 text-stone-500" />
          )}
          {isConnected && !isSpeaking && (
            <span className="absolute inset-0 rounded-full border-2 border-emerald-400/30 animate-ping" />
          )}
        </div>

        {/* Camera toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleCamera}
          className={cn('rounded-full h-10 w-10 shrink-0', cameraOn && 'bg-orange-500/20 text-orange-400')}
          title={cameraOn ? 'Camera on' : 'Turn on camera'}
        >
          <Video className="h-4 w-4" />
        </Button>

        {/* End call */}
        <Button
          variant="destructive"
          size="icon"
          onClick={onEndCall}
          className="rounded-full h-10 w-10 shrink-0"
          title="End session"
          disabled={isConnecting}
        >
          <PhoneOff className="h-5 w-5" />
        </Button>

        {/* Error: retry + fallback (only when not reconnectFailed — that has its own banner) */}
        {isError && !reconnectFailed && (
          <>
            <div className="w-px h-6 bg-white/10 shrink-0" />
            <Button
              variant="ghost"
              size="icon"
              onClick={onRetry}
              className="rounded-full h-10 w-10 shrink-0"
              title="Retry connection"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>

      {/* Fallback link */}
      {!reconnectFailed && (
        <button
          onClick={onSwitchToText}
          className="text-xs text-muted-foreground hover:text-foreground underline-offset-4 hover:underline transition-colors"
        >
          Switch to text mode
        </button>
      )}
    </div>
  );
}
