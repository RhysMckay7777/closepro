'use client';

import { useEffect, useState } from 'react';
import { Mic, MicOff, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

type PermissionState = 'checking' | 'granted' | 'prompt' | 'denied' | 'unsupported';

interface VoicePermissionGateProps {
  children: React.ReactNode;
  onFallbackToText: () => void;
}

export function VoicePermissionGate({ children, onFallbackToText }: VoicePermissionGateProps) {
  const [permission, setPermission] = useState<PermissionState>('checking');

  useEffect(() => {
    // Check WebRTC support
    if (typeof window === 'undefined' || !window.RTCPeerConnection) {
      setPermission('unsupported');
      return;
    }

    // Check microphone permission
    checkMicPermission();
  }, []);

  const checkMicPermission = async () => {
    try {
      // Try the Permissions API first for non-blocking check
      if (navigator.permissions) {
        const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        if (result.state === 'granted') {
          setPermission('granted');
          return;
        }
        if (result.state === 'denied') {
          setPermission('denied');
          return;
        }
      }
      // State is 'prompt' or Permissions API not available
      setPermission('prompt');
    } catch {
      // Permissions API not supported — show prompt
      setPermission('prompt');
    }
  };

  const requestPermission = async () => {
    try {
      setPermission('checking');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Stop the test stream immediately
      stream.getTracks().forEach((t) => t.stop());
      setPermission('granted');
    } catch (err: any) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setPermission('denied');
      } else {
        setPermission('unsupported');
      }
    }
  };

  if (permission === 'granted') {
    return <>{children}</>;
  }

  if (permission === 'checking') {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-8">
        <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center animate-pulse">
          <Mic className="h-6 w-6 text-blue-400" />
        </div>
        <p className="text-sm text-muted-foreground">Checking microphone access...</p>
      </div>
    );
  }

  if (permission === 'prompt') {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-8 max-w-sm mx-auto text-center">
        <div className="w-16 h-16 rounded-full bg-blue-500/20 flex items-center justify-center">
          <Mic className="h-8 w-8 text-blue-400" />
        </div>
        <h3 className="text-lg font-semibold text-foreground">Microphone Access Required</h3>
        <p className="text-sm text-muted-foreground">
          Voice mode needs access to your microphone for real-time conversation with the AI prospect.
        </p>
        <div className="flex flex-col gap-2 w-full">
          <Button onClick={requestPermission} className="w-full">
            <Mic className="h-4 w-4 mr-2" />
            Allow Microphone
          </Button>
          <Button variant="ghost" size="sm" onClick={onFallbackToText}>
            Switch to text mode instead
          </Button>
        </div>
      </div>
    );
  }

  // denied or unsupported
  return (
    <div className="flex flex-col items-center justify-center gap-4 p-8 max-w-sm mx-auto text-center">
      <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center">
        {permission === 'denied' ? (
          <MicOff className="h-8 w-8 text-red-400" />
        ) : (
          <AlertTriangle className="h-8 w-8 text-amber-400" />
        )}
      </div>
      <h3 className="text-lg font-semibold text-foreground">
        {permission === 'denied' ? 'Microphone Blocked' : 'Voice Not Supported'}
      </h3>
      <p className="text-sm text-muted-foreground">
        {permission === 'denied'
          ? 'Microphone access was denied. Please enable it in your browser settings and reload the page.'
          : 'Your browser does not support the required voice features (WebRTC). Try using Chrome or Edge.'}
      </p>
      <Button variant="outline" onClick={onFallbackToText}>
        Switch to text mode
      </Button>
    </div>
  );
}
