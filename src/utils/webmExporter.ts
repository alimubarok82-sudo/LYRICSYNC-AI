import { SubtitleProject, SubtitleSegment } from '../types/subtitle';
import { formatQuranVerseSymbol } from './languages';

export interface WebMExportOptions {
  aspectRatio: '16:9' | '9:16';
  quality: '1080p' | '720p';
  backgroundStyle: 'black' | 'dark' | 'transparent';
  includeAudio: boolean;
  onProgress?: (progress: number, statusText: string) => void;
}

export interface WebMRenderResult {
  blob: Blob;
  url: string;
  filename: string;
  duration: number;
}

/**
 * Renders project subtitles and synced audio into a WebM video using HTML5 Canvas & MediaRecorder.
 */
export async function renderProjectToWebM(
  project: SubtitleProject,
  options: WebMExportOptions
): Promise<WebMRenderResult> {
  const {
    aspectRatio = '16:9',
    quality = '1080p',
    backgroundStyle = 'black',
    includeAudio = true,
    onProgress,
  } = options;

  // Determine canvas dimensions
  let width = 1920;
  let height = 1080;

  if (aspectRatio === '9:16') {
    if (quality === '720p') {
      width = 720;
      height = 1280;
    } else {
      width = 1080;
      height = 1920;
    }
  } else {
    // 16:9
    if (quality === '720p') {
      width = 1280;
      height = 720;
    } else {
      width = 1920;
      height = 1080;
    }
  }

  // Calculate duration
  const segments = project.segments || [];
  const maxSegmentEnd = segments.reduce((max, s) => Math.max(max, s.end), 0);
  const totalDuration = Math.max(project.audioDuration || 0, maxSegmentEnd, 5);

  onProgress?.(2, 'Menyiapkan canvas & media stream...');

  // Setup Offscreen Canvas
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: backgroundStyle === 'transparent' });
  if (!ctx) {
    throw new Error('Gagal menginisialisasi Canvas 2D Context untuk render WebM.');
  }

  // Setup Audio playback if available and requested
  let audioElement: HTMLAudioElement | null = null;
  let audioStream: MediaStream | null = null;
  let audioContext: AudioContext | null = null;
  let audioSource: MediaElementAudioSourceNode | null = null;
  let audioDest: MediaStreamAudioDestinationNode | null = null;

  if (includeAudio && project.audioUrl) {
    try {
      audioElement = new Audio();
      audioElement.src = project.audioUrl;
      audioElement.crossOrigin = 'anonymous';
      audioElement.currentTime = 0;
      audioElement.muted = false;

      // Use Web Audio API to capture audio stream cleanly without echoing to speakers
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      audioContext = new AudioCtx();
      audioSource = audioContext.createMediaElementSource(audioElement);
      audioDest = audioContext.createMediaStreamDestination();
      audioSource.connect(audioDest);
      audioStream = audioDest.stream;
    } catch (e) {
      console.warn('Could not setup audio context capture:', e);
      audioStream = null;
    }
  }

  // Capture canvas video stream
  const fps = 30;
  const canvasStream = canvas.captureStream(fps);

  // Combine video and audio tracks
  const combinedTracks: MediaStreamTrack[] = [...canvasStream.getVideoTracks()];
  if (audioStream) {
    const audioTracks = audioStream.getAudioTracks();
    if (audioTracks.length > 0) {
      combinedTracks.push(audioTracks[0]);
    }
  }

  const combinedStream = new MediaStream(combinedTracks);

  // Select best WebM mimeType supported by browser
  let mimeType = 'video/webm;codecs=vp9,opus';
  if (!MediaRecorder.isTypeSupported(mimeType)) {
    mimeType = 'video/webm;codecs=vp8,opus';
  }
  if (!MediaRecorder.isTypeSupported(mimeType)) {
    mimeType = 'video/webm';
  }

  const mediaRecorder = new MediaRecorder(combinedStream, {
    mimeType,
    videoBitsPerSecond: quality === '1080p' ? 6_000_000 : 3_500_000,
  });

  const chunks: Blob[] = [];
  mediaRecorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) {
      chunks.push(e.data);
    }
  };

  // Helper function to draw frame
  const drawFrame = (currentTimeSec: number) => {
    // 1. Draw Background
    if (backgroundStyle === 'transparent') {
      ctx.clearRect(0, 0, width, height);
    } else if (backgroundStyle === 'dark') {
      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, '#0a0d14');
      gradient.addColorStop(1, '#05070a');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
    } else {
      // solid black
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, width, height);
    }

    // 2. Find Active Segment
    const activeSegment = segments.find(
      (s) => currentTimeSec >= s.start && currentTimeSec <= s.end
    );

    if (!activeSegment) return;

    const settings = project.settings;
    const isBilingual = settings.displayMode === 'bilingual';
    const showOriginal = settings.displayMode !== 'translation';
    const showTranslation = settings.displayMode !== 'original';

    // Scaling factors based on 1080p canvas
    const baseScale = width / 1920;
    const origFontSize = Math.round((settings.originalFontSize || 44) * (aspectRatio === '9:16' ? 1.6 : 1.35) * baseScale);
    const transFontSize = Math.round((settings.translationFontSize || 22) * (aspectRatio === '9:16' ? 1.5 : 1.3) * baseScale);

    // Compute Vertical Center
    let centerY = height * 0.75; // Default lower third
    if (settings.position === 'center') {
      centerY = height * 0.5;
    } else if (settings.position === 'top') {
      centerY = height * 0.25;
    }

    // Font Families
    const arabicFont = "'Amiri', 'Traditional Arabic', 'Scheherazade New', 'Noto Naskh Arabic', serif";
    const latinFont = "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif";

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Original Text (Arabic / Primary)
    let origText = activeSegment.original || '';
    if (settings.showVerseNumber && activeSegment.verseNumber) {
      origText += ' ' + formatQuranVerseSymbol(activeSegment.verseNumber);
    }

    // Translation Text
    const currentTransLang = settings.selectedTranslationLanguage || 'id';
    const transText = activeSegment.translations?.[currentTransLang] || '';

    // Calculate layout heights
    const lineSpacing = (settings.lineSpacing || 14) * baseScale;
    let origY = centerY;
    let transY = centerY;

    if (isBilingual && showOriginal && showTranslation && transText) {
      origY = centerY - (origFontSize * 0.7);
      transY = centerY + (transFontSize * 0.8) + lineSpacing;
    }

    // Shadow & Outline setup
    const applyShadowAndOutline = (textColor: string, isArabic: boolean) => {
      ctx.fillStyle = textColor;
      if (settings.shadow) {
        ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
        ctx.shadowBlur = 12 * baseScale;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 3 * baseScale;
      } else {
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
      }
    };

    // Draw Original
    if (showOriginal && origText) {
      ctx.font = `${settings.originalWeight || '700'} ${origFontSize}px ${arabicFont}`;
      applyShadowAndOutline(settings.originalColor || '#FFFFFF', true);

      // Text Stroke Outline
      if (settings.outline) {
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.9)';
        ctx.lineWidth = 4 * baseScale;
        ctx.strokeText(origText, width / 2, origY);
      }
      ctx.fillText(origText, width / 2, origY);
    }

    // Draw Translation
    if (showTranslation && transText) {
      ctx.font = `${settings.translationWeight || '600'} ${transFontSize}px ${latinFont}`;
      applyShadowAndOutline(settings.translationColor || '#E6C86A', false);

      // Text Stroke Outline
      if (settings.outline) {
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.lineWidth = 3 * baseScale;
        ctx.strokeText(transText, width / 2, transY);
      }
      ctx.fillText(transText, width / 2, transY);
    }
  };

  // Perform recording loop
  return new Promise<WebMRenderResult>(async (resolve, reject) => {
    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType });
      const url = URL.createObjectURL(blob);
      const safeTitle = (project.title || 'LyricSync_Video')
        .replace(/[^a-zA-Z0-9_\-\u0600-\u06FF]/g, '_')
        .replace(/_+/g, '_');
      const filename = `${safeTitle}_${aspectRatio.replace(':', 'x')}_${quality}.webm`;

      // Clean audio context if opened
      if (audioContext && audioContext.state !== 'closed') {
        audioContext.close().catch(() => {});
      }

      onProgress?.(100, 'Render video WebM selesai!');
      resolve({
        blob,
        url,
        filename,
        duration: totalDuration,
      });
    };

    mediaRecorder.onerror = (err) => {
      reject(err);
    };

    try {
      mediaRecorder.start(200); // chunk every 200ms

      if (audioElement) {
        audioElement.currentTime = 0;
        await audioElement.play().catch((err) => {
          console.warn('Audio play notice:', err);
        });
      }

      const startTime = performance.now();
      const intervalMs = 1000 / fps;

      const renderInterval = setInterval(() => {
        const elapsed = (performance.now() - startTime) / 1000;

        if (elapsed >= totalDuration) {
          clearInterval(renderInterval);
          drawFrame(totalDuration);
          if (audioElement) {
            audioElement.pause();
          }
          onProgress?.(99, 'Menyelesaikan enkoding WebM container...');
          mediaRecorder.stop();
          return;
        }

        drawFrame(elapsed);

        const pct = Math.min(98, Math.round((elapsed / totalDuration) * 98));
        onProgress?.(
          pct,
          `Rendering frame video... ${elapsed.toFixed(1)}s / ${totalDuration.toFixed(1)}s (${pct}%)`
        );
      }, intervalMs);
    } catch (err) {
      reject(err);
    }
  });
}
