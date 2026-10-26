import { Platform } from 'react-native';

export interface RecordedAudioResult {
  uri: string;
  durationSeconds: number;
  sizeBytes: number;
  mimeType: string;
  isDevMock?: boolean;
}

// Web MediaRecorder state
let webMediaRecorder: MediaRecorder | null = null;
let webAudioChunks: Blob[] = [];
let webStartTime = 0;
let webCurrentAudioElement: HTMLAudioElement | null = null;
let isWebDevMockActive = false;

// Native state
let nativeRecording: any = null;
let nativeStartTime = 0;
let nativeSound: any = null;

/**
 * Generates a valid synthetic 2-second mono PCM WAV blob for web dev testing
 * if no physical microphone is available.
 */
function generateDevMockWavBlob(): Blob {
  const sampleRate = 8000;
  const numSamples = sampleRate * 2; // 2 seconds
  const buffer = new ArrayBuffer(44 + numSamples);
  const view = new DataView(buffer);

  // RIFF header
  view.setUint32(0, 0x52494646, false); // "RIFF"
  view.setUint32(4, 36 + numSamples, true);
  view.setUint32(8, 0x57415645, false); // "WAVE"
  // fmt subchunk
  view.setUint32(12, 0x666d7420, false); // "fmt "
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate, true);
  view.setUint16(32, 1, true);
  view.setUint16(34, 8, true);
  // data subchunk
  view.setUint32(36, 0x64617461, false); // "data"
  view.setUint32(40, numSamples, true);

  // Pleasant 520Hz tone
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const sample = Math.round(128 + 50 * Math.sin(2 * Math.PI * 520 * t));
    view.setUint8(44 + i, sample);
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

/**
 * Requests microphone permission.
 */
export async function requestMicrophonePermission(): Promise<boolean> {
  if (Platform.OS === 'web') {
    try {
      if (typeof navigator !== 'undefined' && navigator.mediaDevices) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((track) => track.stop());
        return true;
      }
      return __DEV__;
    } catch (err) {
      console.warn('Web microphone permission check note:', err);
      return __DEV__; // In dev, allow mock fallback
    }
  }

  // Native expo-audio permission
  try {
    const ExpoAudio = await import('expo-audio');
    const status = await ExpoAudio.requestRecordingPermissionsAsync();
    return status.granted;
  } catch (err) {
    console.warn('Native audio permission request error:', err);
    return false;
  }
}

/**
 * Starts audio recording.
 */
export async function startAudioRecording(): Promise<void> {
  if (Platform.OS === 'web') {
    isWebDevMockActive = false;
    webStartTime = Date.now();

    try {
      if (typeof navigator !== 'undefined' && navigator.mediaDevices) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        webAudioChunks = [];

        const mimeType = MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : MediaRecorder.isTypeSupported('audio/mp4')
          ? 'audio/mp4'
          : '';

        webMediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
        webMediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            webAudioChunks.push(event.data);
          }
        };
        webMediaRecorder.start(250);
        return;
      }
    } catch (err) {
      if (__DEV__) {
        console.warn('Web live mic not available, activating DEV MOCK voice note recording:', err);
        isWebDevMockActive = true;
        return;
      }
      throw err;
    }

    if (__DEV__) {
      isWebDevMockActive = true;
      return;
    }
    throw new Error('Audio recording not supported in this browser environment');
  }

  // Native implementation via expo-audio
  try {
    const ExpoAudio = await import('expo-audio');

    try {
      const perm = await ExpoAudio.requestRecordingPermissionsAsync();
      if (!perm.granted) {
        throw new Error('Microphone permission not granted');
      }
    } catch (permErr: any) {
      if (permErr?.message?.includes('Microphone permission')) {
        throw permErr;
      }
      console.warn('Audio permission request note:', permErr);
    }

    try {
      await ExpoAudio.setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
    } catch (modeErr) {
      console.warn('Audio mode setting note:', modeErr);
    }

    nativeStartTime = Date.now();

    // Look for native AudioRecorder constructor on AudioModule or ExpoAudio export
    const AudioRecorderConstructor =
      (ExpoAudio as any).AudioModule?.AudioRecorder ||
      (ExpoAudio as any).AudioRecorder;

    if (!AudioRecorderConstructor) {
      throw new Error('Native audio recording module is not available on this device');
    }

    const recording = new AudioRecorderConstructor({
      extension: '.m4a',
      sampleRate: 44100,
      numberOfChannels: 1,
      bitRate: 64000,
    });

    if (typeof recording.prepareToRecordAsync === 'function') {
      await recording.prepareToRecordAsync();
    }
    if (typeof recording.record === 'function') {
      recording.record();
    }
    nativeRecording = recording;
  } catch (err) {
    console.error('Error starting native recording:', err);
    throw err;
  }
}

/**
 * Stops audio recording and returns file metadata.
 */
export async function stopAudioRecording(): Promise<RecordedAudioResult> {
  if (Platform.OS === 'web') {
    const elapsedSeconds = Math.max(1, Math.round((Date.now() - webStartTime) / 1000));

    if (isWebDevMockActive || !webMediaRecorder) {
      // Return synthesized DEV MOCK audio
      const mockBlob = generateDevMockWavBlob();
      const uri = URL.createObjectURL(mockBlob);
      isWebDevMockActive = false;
      return {
        uri,
        durationSeconds: elapsedSeconds,
        sizeBytes: mockBlob.size,
        mimeType: 'audio/wav',
        isDevMock: true,
      };
    }

    return new Promise((resolve) => {
      const recorder = webMediaRecorder!;
      recorder.onstop = () => {
        const mimeType = recorder.mimeType || 'audio/webm';
        const audioBlob = new Blob(webAudioChunks, { type: mimeType });
        const uri = URL.createObjectURL(audioBlob);

        if (recorder.stream) {
          recorder.stream.getTracks().forEach((track) => track.stop());
        }
        webMediaRecorder = null;

        resolve({
          uri,
          durationSeconds: elapsedSeconds,
          sizeBytes: audioBlob.size,
          mimeType,
          isDevMock: false,
        });
      };

      recorder.stop();
    });
  }

  // Native stop recording
  try {
    const elapsedSeconds = Math.max(1, Math.round((Date.now() - nativeStartTime) / 1000));
    let uri = '';
    if (nativeRecording) {
      if (typeof nativeRecording.stop === 'function') {
        await nativeRecording.stop();
      }
      uri = nativeRecording.uri || '';
      nativeRecording = null;
    }

    return {
      uri: uri || '',
      durationSeconds: elapsedSeconds,
      sizeBytes: 150000, // ~150KB for compressed voice note
      mimeType: 'audio/m4a',
      isDevMock: false,
    };
  } catch (err) {
    console.error('Error stopping native recording:', err);
    throw err;
  }
}

/**
 * Plays back recorded audio.
 */
export async function playAudio(uri: string, onEnded?: () => void): Promise<void> {
  if (Platform.OS === 'web') {
    if (webCurrentAudioElement) {
      webCurrentAudioElement.pause();
    }
    const audio = new Audio(uri);
    webCurrentAudioElement = audio;
    if (onEnded) {
      audio.onended = onEnded;
    }
    await audio.play();
    return;
  }

  // Native playback
  try {
    const ExpoAudio = await import('expo-audio');
    let player: any = null;
    if (typeof ExpoAudio.createAudioPlayer === 'function') {
      player = ExpoAudio.createAudioPlayer(uri);
    } else if ((ExpoAudio as any).AudioModule?.AudioPlayer) {
      player = new (ExpoAudio as any).AudioModule.AudioPlayer(uri, 500);
    }
    if (player) {
      nativeSound = player;
      if (typeof player.play === 'function') {
        player.play();
      }
    }
  } catch (err) {
    console.warn('Native playback error:', err);
  }
}

/**
 * Stops active audio playback.
 */
export function stopAudioPlayback(): void {
  if (Platform.OS === 'web') {
    if (webCurrentAudioElement) {
      webCurrentAudioElement.pause();
      webCurrentAudioElement.currentTime = 0;
      webCurrentAudioElement = null;
    }
    return;
  }

  if (nativeSound) {
    try {
      nativeSound.pause();
    } catch {}
    nativeSound = null;
  }
}
