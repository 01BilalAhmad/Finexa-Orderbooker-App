// ═══════════════════════════════════════════════════════════════════════════
//  useSpeechToText — Hook for transcribing voice to text via expo-speech-recognition
//  Free, on-device speech recognition. No API key needed.
// ═══════════════════════════════════════════════════════════════════════════
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import type {
  ExpoSpeechRecognitionOptions,
  ExpoSpeechRecognitionResultEvent,
  ExpoSpeechRecognitionErrorEvent,
} from 'expo-speech-recognition';
import { Platform, Alert, Linking } from 'react-native';

interface UseSpeechToTextResult {
  /** True if speech recognition is currently listening */
  isListening: boolean;
  /** True if speech recognition is available on this device */
  isSupported: boolean;
  /** The current transcript (accumulated while listening) */
  transcript: string;
  /** Start listening — requests permission if needed */
  startListening: (locale?: string) => Promise<void>;
  /** Stop listening */
  stopListening: () => void;
  /** Clear transcript */
  clearTranscript: () => void;
  /** Last error message (if any) */
  error: string | null;
}

export function useSpeechToText(): UseSpeechToTextResult {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSupported] = useState(true); // always true — module is loaded
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      try {
        ExpoSpeechRecognitionModule.stop();
      } catch {}
    };
  }, []);

  // Listen to speech recognition events — event names match
  // ExpoSpeechRecognitionNativeEventMap keys ("result", "error", "start", "end")
  useSpeechRecognitionEvent('result', (event: ExpoSpeechRecognitionResultEvent) => {
    if (event?.results && event.results.length > 0) {
      const bestResult = event.results[0];
      if (bestResult && bestResult.transcript) {
        setTranscript((prev) => prev + (prev ? ' ' : '') + bestResult.transcript);
      }
    }
  });

  useSpeechRecognitionEvent('error', (event: ExpoSpeechRecognitionErrorEvent) => {
    const code = event?.error || 'unknown';
    const friendly =
      code === 'not-allowed' || code === 'service-not-allowed'
        ? 'Microphone permission denied. Settings → Apps → Finexa → Microphone → Allow.'
        : code === 'no-speech'
        ? 'Koi awaaz nahi mili. Dobara try karein.'
        : code === 'busy'
        ? 'Speech recognizer busy. Thodi der baad try karein.'
        : code === 'network'
        ? 'Network error. Internet connection check karein.'
        : `Speech error: ${code}`;

    if (isMountedRef.current) {
      setError(friendly);
      setIsListening(false);
    }
  });

  useSpeechRecognitionEvent('start', () => {
    if (isMountedRef.current) {
      setIsListening(true);
      setError(null);
    }
  });

  useSpeechRecognitionEvent('end', () => {
    if (isMountedRef.current) {
      setIsListening(false);
    }
  });

  const requestPermissionIfNeeded = useCallback(async (): Promise<boolean> => {
    if (Platform.OS !== 'android' && Platform.OS !== 'ios') return true;

    try {
      const status = await ExpoSpeechRecognitionModule.getPermissionsAsync();
      if (status?.granted) return true;
      if (status?.canAskAgain) {
        const req = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
        return !!req?.granted;
      }
      // User previously denied — show settings link
      Alert.alert(
        'Microphone Permission Required',
        'Speech-to-Text ke liye microphone access chahiye. Settings mein jaakar allow karein.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ],
      );
      return false;
    } catch {
      // Permission API may not be available on all platforms — assume OK
      return true;
    }
  }, []);

  const startListening = useCallback(async (locale: string = 'en-US') => {
    setError(null);

    const hasPermission = await requestPermissionIfNeeded();
    if (!hasPermission) {
      setError('Microphone permission denied');
      return;
    }

    try {
      const options: ExpoSpeechRecognitionOptions = {
        lang: locale,
        interimResults: true,
        maxAlternatives: 1,
        continuous: false,  // single utterance — stops when user pauses
        requiresOnDeviceRecognition: false,  // allow cloud fallback
      };

      ExpoSpeechRecognitionModule.start(options);
      if (isMountedRef.current) setIsListening(true);
    } catch (e: any) {
      if (isMountedRef.current) {
        setError(`Could not start speech recognition: ${e?.message || e}`);
        setIsListening(false);
      }
    }
  }, [requestPermissionIfNeeded]);

  const stopListening = useCallback(() => {
    try {
      ExpoSpeechRecognitionModule.stop();
    } catch {}
    if (isMountedRef.current) setIsListening(false);
  }, []);

  const clearTranscript = useCallback(() => {
    setTranscript('');
    setError(null);
  }, []);

  return {
    isListening,
    isSupported,
    transcript,
    startListening,
    stopListening,
    clearTranscript,
    error,
  };
}
