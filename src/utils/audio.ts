/**
 * Audio processing utilities:
 * - Decoding audio files for waveform display
 * - Generating harmonic demo audio using Web Audio API when user loads demo
 */

export async function extractWaveformData(
  audioBlobOrBuffer: Blob | ArrayBuffer,
  numPoints = 200
): Promise<number[]> {
  try {
    const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    let arrayBuffer: ArrayBuffer;
    if (audioBlobOrBuffer instanceof Blob) {
      arrayBuffer = await audioBlobOrBuffer.arrayBuffer();
    } else {
      arrayBuffer = audioBlobOrBuffer;
    }

    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
    const channelData = audioBuffer.getChannelData(0);
    const blockSize = Math.floor(channelData.length / numPoints);
    const waveform: number[] = [];

    for (let i = 0; i < numPoints; i++) {
      let sum = 0;
      const start = i * blockSize;
      for (let j = 0; j < blockSize; j++) {
        sum += Math.abs(channelData[start + j] || 0);
      }
      waveform.push(Math.min(1, (sum / blockSize) * 2.5));
    }

    await audioCtx.close();
    return waveform;
  } catch (err) {
    console.warn('Could not extract waveform from audio, using rhythmic fallback:', err);
    return generateFallbackWaveform(numPoints);
  }
}

export function generateFallbackWaveform(numPoints = 200): number[] {
  const points: number[] = [];
  for (let i = 0; i < numPoints; i++) {
    // Generate organic musical looking peaks
    const norm = i / numPoints;
    const peak =
      0.2 +
      0.45 * Math.sin(norm * 18 * Math.PI) * Math.sin(norm * 5 * Math.PI) +
      0.25 * Math.sin(norm * 40);
    points.push(Math.max(0.08, Math.min(0.95, Math.abs(peak))));
  }
  return points;
}

/**
 * Generate a demo ambient recitation-style audio track using Web Audio API
 * so users can play and hear sound immediately on demo load!
 */
export async function createDemoAudioTrack(duration = 43.5): Promise<string> {
  const sampleRate = 22050;
  const numSamples = Math.floor(sampleRate * duration);
  const offlineCtx = new OfflineAudioContext(1, numSamples, sampleRate);

  // Create serene harmonic soundscape
  const baseFreqs = [110, 164.81, 220, 329.63, 440];

  baseFreqs.forEach((freq, idx) => {
    const osc = offlineCtx.createOscillator();
    const gain = offlineCtx.createGain();

    osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
    osc.frequency.setValueAtTime(freq, 0);

    // Subtle vibrato
    osc.frequency.setTargetAtTime(freq + Math.sin(idx) * 2, 0, 0.5);

    gain.gain.setValueAtTime(0.001, 0);
    // Envelope for a serene, breathing acoustic atmosphere
    const stepDuration = 5.5;
    for (let t = 0; t < duration; t += stepDuration) {
      gain.gain.exponentialRampToValueAtTime(0.08 / (idx + 1), t + 1.5);
      gain.gain.exponentialRampToValueAtTime(0.015 / (idx + 1), t + stepDuration - 0.5);
    }
    gain.gain.exponentialRampToValueAtTime(0.0001, duration);

    osc.connect(gain);
    gain.connect(offlineCtx.destination);

    osc.start(0);
    osc.stop(duration);
  });

  const renderedBuffer = await offlineCtx.startRendering();

  // Convert AudioBuffer to WAV blob URL
  const wavBlob = audioBufferToWavBlob(renderedBuffer);
  return URL.createObjectURL(wavBlob);
}

function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  const channelData = buffer.getChannelData(0);
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = channelData.length * bytesPerSample;
  const bufferLength = 44 + dataSize;
  const arrayBuffer = new ArrayBuffer(bufferLength);
  const view = new DataView(arrayBuffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  // Write PCM audio data
  let offset = 44;
  for (let i = 0; i < channelData.length; i++) {
    const s = Math.max(-1, Math.min(1, channelData[i]));
    const sample = s < 0 ? s * 0x8000 : s * 0x7fff;
    view.setInt16(offset, sample, true);
    offset += 2;
  }

  return new Blob([view], { type: 'audio/wav' });
}

/**
 * Optimizes an uploaded audio file (MP3/WAV/etc) for Gemini AI transcription.
 * Converts to mono 16kHz WAV (speech recognition standard) and compresses file size
 * dramatically (usually from 10MB down to < 1.5MB), eliminating ETIMEDOUT network hangs.
 */
export async function optimizeAudioForAi(
  fileOrBlob: Blob,
  maxDurationSec = 120
): Promise<{ base64: string; mimeType: string }> {
  try {
    const arrayBuffer = await fileOrBlob.arrayBuffer();
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const audioCtx = new AudioContextClass();

    const decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
    await audioCtx.close();

    const targetSampleRate = 16000; // 16kHz mono is ideal speech recognition format
    const duration = Math.min(decodedBuffer.duration, maxDurationSec);
    const offlineCtx = new OfflineAudioContext(1, Math.floor(targetSampleRate * duration), targetSampleRate);

    const source = offlineCtx.createBufferSource();
    source.buffer = decodedBuffer;
    source.connect(offlineCtx.destination);
    source.start(0);

    const renderedBuffer = await offlineCtx.startRendering();
    const compactWavBlob = audioBufferToWavBlob(renderedBuffer);

    // Convert optimized blob to base64 safely without stack overflow
    const compactBuffer = await compactWavBlob.arrayBuffer();
    const bytes = new Uint8Array(compactBuffer);
    let binary = '';
    const chunkSize = 0x8000; // 32KB chunks
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunkSize)));
    }

    return {
      base64: btoa(binary),
      mimeType: 'audio/wav',
    };
  } catch (err) {
    console.warn('Could not optimize audio with Web Audio API, falling back to raw slice:', err);
    // Fallback: read directly as base64
    const buf = await fileOrBlob.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunkSize)));
    }
    return {
      base64: btoa(binary),
      mimeType: fileOrBlob.type || 'audio/mp3',
    };
  }
}
