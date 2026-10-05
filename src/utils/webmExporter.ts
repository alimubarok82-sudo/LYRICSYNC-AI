import { SubtitleProject, SubtitleSegment } from '../types/subtitle';
import { formatQuranVerseSymbol, isRtlLanguage } from './languages';

export interface WebMExportOptions {
  aspectRatio: '16:9' | '9:16';
  quality: '1080p' | '720p';
  backgroundStyle: 'video' | 'image' | 'black' | 'dark' | 'transparent';
  backgroundImageUrl?: string | null;
  backgroundVideoUrl?: string | null;
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
 * Loads an HTMLImageElement from a URL or Base64 data string safely.
 */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(new Error('Gagal memuat file gambar backdrop: ' + e));
    img.src = src;
  });
}

/**
 * Loads and prepares an HTMLVideoElement for canvas frame drawing
 */
function loadVideo(src: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.onloadeddata = () => resolve(video);
    video.onerror = (e) => reject(new Error('Gagal memuat file video latar: ' + e));
    video.src = src;
    video.load();
  });
}

/**
 * Draws an image or video frame with object-fit: cover into canvas context.
 */
function drawMediaCover(
  ctx: CanvasRenderingContext2D,
  media: HTMLImageElement | HTMLVideoElement,
  targetWidth: number,
  targetHeight: number
) {
  const mediaWidth = 'videoWidth' in media && media.videoWidth ? media.videoWidth : media.width;
  const mediaHeight = 'videoHeight' in media && media.videoHeight ? media.videoHeight : media.height;
  if (!mediaWidth || !mediaHeight) return;

  const mediaRatio = mediaWidth / mediaHeight;
  const targetRatio = targetWidth / targetHeight;
  let renderWidth = targetWidth;
  let renderHeight = targetHeight;
  let offsetX = 0;
  let offsetY = 0;

  if (mediaRatio > targetRatio) {
    renderWidth = targetHeight * mediaRatio;
    offsetX = (targetWidth - renderWidth) / 2;
  } else {
    renderHeight = targetWidth / mediaRatio;
    offsetY = (targetHeight - renderHeight) / 2;
  }

  ctx.drawImage(media, offsetX, offsetY, renderWidth, renderHeight);
}

/**
 * Resolves font family for canvas rendering based on user settings and content type
 */
function resolveFontFamily(fontKey: string, isOriginal: boolean, isRtl: boolean): string {
  if (fontKey === 'font-arabic') {
    return "'Amiri', 'Traditional Arabic', 'Scheherazade New', 'Noto Naskh Arabic', serif";
  }
  if (fontKey === 'font-arabic-sans') {
    return "'Noto Sans Arabic', 'Plus Jakarta Sans', system-ui, sans-serif";
  }
  if (fontKey === 'font-cinematic') {
    return "'Cinzel', 'Plus Jakarta Sans', serif";
  }
  if (isRtl) {
    return "'Amiri', 'Noto Naskh Arabic', serif";
  }
  return "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif";
}

/**
 * Wraps text into multiple lines so that no line exceeds maxWidth.
 * Respects existing newline characters and splits by whitespace or punctuation.
 */
function wrapTextLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  if (!text) return [];

  // Support explicit user newlines first
  const explicitParagraphs = text.split('\n');
  const finalLines: string[] = [];

  for (const para of explicitParagraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;

    // Check if the whole paragraph already fits
    if (ctx.measureText(trimmed).width <= maxWidth) {
      finalLines.push(trimmed);
      continue;
    }

    // Split into tokens (words)
    const words = trimmed.split(/\s+/);
    let currentLine = '';

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const testWidth = ctx.measureText(testLine).width;

      if (testWidth <= maxWidth) {
        currentLine = testLine;
      } else {
        if (currentLine) {
          finalLines.push(currentLine);
          currentLine = word;
        } else {
          // Single word is wider than maxWidth, break characters if needed
          finalLines.push(word);
          currentLine = '';
        }
      }
    }

    if (currentLine) {
      finalLines.push(currentLine);
    }
  }

  return finalLines;
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
    backgroundImageUrl = project.settings.backgroundImageUrl,
    backgroundVideoUrl = project.settings.backgroundVideoUrl,
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

  // Preload background video or image if selected or present
  let loadedBgImage: HTMLImageElement | null = null;
  let loadedBgVideo: HTMLVideoElement | null = null;

  const effectiveVideoUrl =
    backgroundVideoUrl ||
    project.settings.backgroundVideoUrl ||
    project.videoUrl ||
    (project.audioUrl && (project.audioFileName?.endsWith('.mp4') || project.audioFileName?.endsWith('.webm'))
      ? project.audioUrl
      : null);

  const effectiveBgUrl =
    backgroundImageUrl ||
    (backgroundStyle === 'image' ? project.settings.backgroundImageUrl : null);

  if (backgroundStyle === 'video' || (effectiveVideoUrl && backgroundStyle !== 'black' && backgroundStyle !== 'dark' && backgroundStyle !== 'transparent' && !effectiveBgUrl)) {
    if (effectiveVideoUrl) {
      try {
        onProgress?.(3, 'Memuat trek video latar belakang...');
        loadedBgVideo = await loadVideo(effectiveVideoUrl);
      } catch (err) {
        console.warn('Gagal memuat video backdrop, beralih ke gambar/warna:', err);
      }
    }
  }

  if (!loadedBgVideo && (backgroundStyle === 'image' || effectiveBgUrl) && backgroundStyle !== 'transparent') {
    if (effectiveBgUrl) {
      try {
        onProgress?.(3, 'Memuat gambar latar backdrop...');
        loadedBgImage = await loadImage(effectiveBgUrl);
      } catch (err) {
        console.warn('Gagal memuat gambar backdrop, beralih ke warna gelap:', err);
      }
    }
  }

  // Helper function to draw frame
  const drawFrame = (currentTimeSec: number) => {
    // 1. Draw Background
    if (backgroundStyle === 'transparent') {
      ctx.clearRect(0, 0, width, height);
    } else if (loadedBgVideo) {
      // Sync background video frame to timeline
      if (Math.abs(loadedBgVideo.currentTime - currentTimeSec) > 0.05) {
        loadedBgVideo.currentTime = currentTimeSec % (loadedBgVideo.duration || 9999);
      }
      drawMediaCover(ctx, loadedBgVideo, width, height);

      // Add cinematic dark overlay to maintain subtitle legibility
      const overlayGradient = ctx.createLinearGradient(0, 0, 0, height);
      overlayGradient.addColorStop(0, 'rgba(0, 0, 0, 0.50)');
      overlayGradient.addColorStop(1, 'rgba(0, 0, 0, 0.70)');
      ctx.fillStyle = overlayGradient;
      ctx.fillRect(0, 0, width, height);
    } else if (loadedBgImage) {
      // Draw background image scaled cover
      drawMediaCover(ctx, loadedBgImage, width, height);

      // Add cinematic dark overlay to maintain subtitle legibility (as in preview)
      const overlayGradient = ctx.createLinearGradient(0, 0, 0, height);
      overlayGradient.addColorStop(0, 'rgba(0, 0, 0, 0.60)');
      overlayGradient.addColorStop(1, 'rgba(0, 0, 0, 0.75)');
      ctx.fillStyle = overlayGradient;
      ctx.fillRect(0, 0, width, height);
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
    let origFontSize = Math.round(
      (settings.originalFontSize || 44) * (aspectRatio === '9:16' ? 1.45 : 1.25) * baseScale
    );
    let transFontSize = Math.round(
      (settings.translationFontSize || 22) * (aspectRatio === '9:16' ? 1.4 : 1.18) * baseScale
    );

    // Title Safe Area Width:
    // 16:9 gets max 80% screen width, 9:16 (vertical reels/shorts) gets 86% screen width
    const maxSafeWidth = width * (aspectRatio === '9:16' ? 0.86 : 0.80);

    // Original Text (Primary)
    let origText = activeSegment.original || '';
    if (settings.showVerseNumber && activeSegment.verseNumber) {
      origText += ' ' + formatQuranVerseSymbol(activeSegment.verseNumber);
    }

    // Translation Text
    const currentTransLang = settings.selectedTranslationLanguage || 'id';
    const transText = activeSegment.translations?.[currentTransLang] || '';

    // RTL & Font detection
    const isOrigRtl = isRtlLanguage(project.originalLanguage || 'auto', origText);
    const resolvedOrigFont = resolveFontFamily(settings.originalFont, true, isOrigRtl);
    const resolvedTransFont = resolveFontFamily(settings.translationFont, false, false);

    // Dynamic scale-down if text is extremely long to prevent massive vertical sprawl
    ctx.font = `${settings.originalWeight || '700'} ${origFontSize}px ${resolvedOrigFont}`;
    let origLines = wrapTextLines(ctx, origText, maxSafeWidth);
    if (origLines.length > 3) {
      origFontSize = Math.round(origFontSize * 0.85);
      ctx.font = `${settings.originalWeight || '700'} ${origFontSize}px ${resolvedOrigFont}`;
      origLines = wrapTextLines(ctx, origText, maxSafeWidth);
    }

    ctx.font = `${settings.translationWeight || '600'} ${transFontSize}px ${resolvedTransFont}`;
    let transLines = wrapTextLines(ctx, transText, maxSafeWidth);
    if (transLines.length > 3) {
      transFontSize = Math.round(transFontSize * 0.85);
      ctx.font = `${settings.translationWeight || '600'} ${transFontSize}px ${resolvedTransFont}`;
      transLines = wrapTextLines(ctx, transText, maxSafeWidth);
    }

    // Line heights and gaps
    const origLineHeight = origFontSize * 1.32;
    const transLineHeight = transFontSize * 1.36;
    const blockGap = (settings.lineSpacing || 14) * baseScale * 1.25;

    const origBlockHeight = showOriginal && origLines.length > 0 ? origLines.length * origLineHeight : 0;
    const transBlockHeight = showTranslation && transLines.length > 0 ? transLines.length * transLineHeight : 0;
    const totalBlockHeight =
      origBlockHeight +
      transBlockHeight +
      (origBlockHeight > 0 && transBlockHeight > 0 ? blockGap : 0);

    // Horizontal Alignment & Anchor X
    let anchorX = width / 2;
    let textAlign: CanvasTextAlign = 'center';

    if (settings.alignment === 'left') {
      anchorX = (width - maxSafeWidth) / 2;
      textAlign = 'left';
    } else if (settings.alignment === 'right') {
      anchorX = width - (width - maxSafeWidth) / 2;
      textAlign = 'right';
    } else {
      anchorX = width / 2;
      textAlign = 'center';
    }

    ctx.textAlign = textAlign;
    ctx.textBaseline = 'middle';

    // Compute Vertical Anchor Y
    let startY: number;
    if (settings.position === 'top') {
      startY = height * (aspectRatio === '9:16' ? 0.14 : 0.12);
    } else if (settings.position === 'center') {
      startY = (height - totalBlockHeight) / 2;
    } else {
      // bottom / lower third
      const bottomPadding = height * (aspectRatio === '9:16' ? 0.15 : 0.12);
      startY = height - bottomPadding - totalBlockHeight;
    }

    // Shadow & Outline setup helper
    const setupShadow = () => {
      if (settings.shadow) {
        ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
        ctx.shadowBlur = 12 * baseScale;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 3 * baseScale;
      } else {
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
      }
    };

    let currentY = startY;

    // 1. Draw Wrapped Original Text
    if (showOriginal && origLines.length > 0) {
      ctx.font = `${settings.originalWeight || '700'} ${origFontSize}px ${resolvedOrigFont}`;
      ctx.fillStyle = settings.originalColor || '#FFFFFF';

      for (const line of origLines) {
        const lineCenterY = currentY + origLineHeight / 2;

        setupShadow();

        // Outline Stroke
        if (settings.outline) {
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.9)';
          ctx.lineWidth = Math.max(3, 4.5 * baseScale);
          ctx.strokeText(line, anchorX, lineCenterY);
        }

        ctx.fillText(line, anchorX, lineCenterY);
        currentY += origLineHeight;
      }

      if (transBlockHeight > 0) {
        currentY += blockGap;
      }
    }

    // 2. Draw Wrapped Translation Text
    if (showTranslation && transLines.length > 0) {
      ctx.font = `${settings.translationWeight || '600'} ${transFontSize}px ${resolvedTransFont}`;
      ctx.fillStyle = settings.translationColor || '#E6C86A';

      for (const line of transLines) {
        const lineCenterY = currentY + transLineHeight / 2;

        setupShadow();

        // Outline Stroke
        if (settings.outline) {
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.88)';
          ctx.lineWidth = Math.max(2.5, 3.5 * baseScale);
          ctx.strokeText(line, anchorX, lineCenterY);
        }

        ctx.fillText(line, anchorX, lineCenterY);
        currentY += transLineHeight;
      }
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
