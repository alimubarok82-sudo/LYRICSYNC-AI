import React, { useRef, useState } from 'react';
import {
  Maximize2,
  Minimize2,
  Tv,
  Smartphone,
  Eye,
  Globe,
  Palette,
  Video,
  Move,
  ArrowUp,
  ArrowDown,
  Minimize,
} from 'lucide-react';
import {
  SubtitleSegment,
  SubtitleStyleSettings,
  SubtitleDisplayMode,
} from '../types/subtitle';
import {
  isRtlLanguage,
  formatQuranVerseSymbol,
  getLanguageName,
} from '../utils/languages';

interface SubtitlePreviewProps {
  currentTime: number;
  segments: SubtitleSegment[];
  settings: SubtitleStyleSettings;
  availableTranslations: string[];
  originalLanguage: string;
  videoUrl?: string;
  onUpdateSettings: (settings: Partial<SubtitleStyleSettings>) => void;
  onSelectSegment?: (segmentId: number) => void;
  onExportWebm?: () => void;
}

export const SubtitlePreview: React.FC<SubtitlePreviewProps> = ({
  currentTime,
  segments,
  settings,
  availableTranslations,
  originalLanguage,
  videoUrl,
  onUpdateSettings,
  onSelectSegment,
  onExportWebm,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const subtitleBoxRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartY, setDragStartY] = useState(0);
  const [dragStartPercent, setDragStartPercent] = useState(0);

  // Sync background video time with timeline
  const effectiveVideoUrl = settings.backgroundVideoUrl || videoUrl;

  React.useEffect(() => {
    const video = previewVideoRef.current;
    if (!video || !effectiveVideoUrl) return;

    if (Math.abs(video.currentTime - currentTime) > 0.3) {
      video.currentTime = currentTime % (video.duration || 9999);
    }
  }, [currentTime, effectiveVideoUrl]);

  // Find active segment for currentTime
  const activeSegment = segments.find(
    (seg) => currentTime >= seg.start && currentTime <= seg.end
  );

  // If no segment active right now, we can show a placeholder or preview segment for style tweaking
  const displaySegment = activeSegment || (segments.length > 0 ? segments[0] : null);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch((err) => {
        console.warn('Fullscreen error:', err);
      });
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch((err) => console.warn(err));
      setIsFullscreen(false);
    }
  };

  // Determine text direction
  const isOriginalRtl =
    settings.direction === 'rtl' ||
    (settings.direction === 'auto' &&
      isRtlLanguage(originalLanguage, displaySegment?.original));

  // Background styling
  const getBgStyle = () => {
    if (settings.backgroundImageUrl) {
      return {
        backgroundImage: `linear-gradient(rgba(0,0,0,0.65), rgba(0,0,0,0.75)), url(${settings.backgroundImageUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      };
    }
    if (settings.backgroundColor === 'transparent') {
      return {
        backgroundColor: '#0a0a0c',
        backgroundImage:
          'radial-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 0)',
        backgroundSize: '16px 16px',
      };
    }
    if (settings.backgroundColor === 'dark') {
      return { backgroundColor: '#18181b' };
    }
    if (settings.backgroundColor === 'custom' && settings.customBgColor) {
      return { backgroundColor: settings.customBgColor };
    }
    return { backgroundColor: '#000000' };
  };

  // Calculate effective vertical percentage (0 - 100)
  const currentYPercent = React.useMemo(() => {
    if (typeof settings.customPositionY === 'number') {
      return settings.customPositionY;
    }
    if (settings.position === 'top') return 20;
    if (settings.position === 'center') return 50;
    return 80; // default bottom
  }, [settings.customPositionY, settings.position]);

  // Handle Drag & Drop Mouse / Touch Interactions
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStartY(e.clientY);
    setDragStartPercent(currentYPercent);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || !containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    if (!containerRect.height) return;

    const deltaY = e.clientY - dragStartY;
    const deltaPercent = (deltaY / containerRect.height) * 100;
    const newPercent = Math.max(8, Math.min(92, Math.round(dragStartPercent + deltaPercent)));

    onUpdateSettings({
      customPositionY: newPercent,
      position: newPercent < 33 ? 'top' : newPercent > 66 ? 'bottom' : 'center',
    });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDragging) {
      setIsDragging(false);
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch (_) {}
    }
  };

  // Vertical placement
  const getVerticalPlacementClass = () => {
    if (typeof settings.customPositionY === 'number') {
      return ''; // We will use inline absolute positioning
    }
    switch (settings.position) {
      case 'top':
        return 'justify-start pt-10 sm:pt-16';
      case 'center':
        return 'justify-center';
      case 'bottom':
      default:
        return 'justify-end pb-8 sm:pb-14';
    }
  };

  // Horizontal text alignment
  const getHorizontalAlignmentClass = () => {
    switch (settings.alignment) {
      case 'left':
        return 'text-left items-start';
      case 'right':
        return 'text-right items-end';
      case 'center':
      default:
        return 'text-center items-center';
    }
  };

  // Font family resolution
  const getFontFamilyClass = (fontSetting: string) => {
    if (fontSetting === 'font-arabic') return 'font-arabic';
    if (fontSetting === 'font-arabic-sans') return 'font-arabic-sans';
    if (fontSetting === 'font-cinematic') return 'font-cinematic';
    return 'font-sans';
  };

  const currentTranslationText =
    displaySegment?.translations[settings.selectedTranslationLanguage] || '';

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col">
      {/* Preview Control Bar */}
      <div className="bg-neutral-950/80 px-4 py-2 border-b border-neutral-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-semibold text-neutral-300">
            <Eye className="w-3.5 h-3.5 text-amber-400" />
            <span>CINEMATIC SUBTITLE PREVIEW</span>
          </div>

          {activeSegment ? (
            <span
              onClick={() => onSelectSegment?.(activeSegment.id)}
              className="cursor-pointer px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[11px] font-mono border border-amber-500/30 flex items-center gap-1 hover:bg-amber-500/30"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
              #{String(activeSegment.id).padStart(2, '0')} (
              {activeSegment.start.toFixed(2)}s - {activeSegment.end.toFixed(2)}s)
            </span>
          ) : (
            <span className="text-neutral-500 text-[11px] italic">
              (No active vocal phrase at {currentTime.toFixed(2)}s)
            </span>
          )}
        </div>

        {/* Dynamic Controls: Mode, Translation Language, Aspect Ratio */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Display Mode Switcher */}
          <div className="flex items-center bg-neutral-900 rounded-lg p-0.5 border border-neutral-800 text-[11px]">
            <button
              onClick={() => onUpdateSettings({ displayMode: 'bilingual' })}
              className={`px-2 py-1 rounded transition-colors ${
                settings.displayMode === 'bilingual'
                  ? 'bg-amber-500 text-neutral-950 font-bold'
                  : 'text-neutral-400 hover:text-white'
              }`}
              title="Show Original on top, Translation below"
            >
              Bilingual
            </button>
            <button
              onClick={() => onUpdateSettings({ displayMode: 'original' })}
              className={`px-2 py-1 rounded transition-colors ${
                settings.displayMode === 'original'
                  ? 'bg-amber-500 text-neutral-950 font-bold'
                  : 'text-neutral-400 hover:text-white'
              }`}
              title="Show Original text only"
            >
              Original
            </button>
            <button
              onClick={() => onUpdateSettings({ displayMode: 'translation' })}
              className={`px-2 py-1 rounded transition-colors ${
                settings.displayMode === 'translation'
                  ? 'bg-amber-500 text-neutral-950 font-bold'
                  : 'text-neutral-400 hover:text-white'
              }`}
              title="Show Translation text only"
            >
              Translation
            </button>
          </div>

          {/* Dynamic Language Switcher (Instant switch without reprocessing!) */}
          {settings.displayMode !== 'original' && (
            <div className="flex items-center gap-1 bg-neutral-900 px-2 py-1 rounded-lg border border-neutral-800">
              <Globe className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-neutral-400 text-[11px]">Layer 2:</span>
              <select
                value={settings.selectedTranslationLanguage}
                onChange={(e) =>
                  onUpdateSettings({ selectedTranslationLanguage: e.target.value })
                }
                className="bg-transparent text-amber-300 font-semibold focus:outline-none cursor-pointer text-xs"
              >
                {availableTranslations.map((langCode) => (
                  <option
                    key={langCode}
                    value={langCode}
                    className="bg-neutral-900 text-neutral-200"
                  >
                    {getLanguageName(langCode)} ({langCode.toUpperCase()})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Quick Position Selector (Atas / Tengah / Bawah / Reset) */}
          <div className="flex items-center bg-neutral-900 rounded-lg p-0.5 border border-neutral-800 text-[11px]">
            <span className="px-1.5 text-neutral-500 font-medium hidden sm:inline flex items-center gap-1">
              <Move className="w-3 h-3 text-amber-400" /> Posisi:
            </span>
            <button
              onClick={() => onUpdateSettings({ position: 'top', customPositionY: 18 })}
              className={`px-2 py-1 rounded transition-colors ${
                (settings.position === 'top' && settings.customPositionY === undefined) || settings.customPositionY === 18
                  ? 'bg-amber-500 text-neutral-950 font-bold'
                  : 'text-neutral-400 hover:text-white'
              }`}
              title="Posisikan di Atas (Top)"
            >
              Atas
            </button>
            <button
              onClick={() => onUpdateSettings({ position: 'center', customPositionY: 50 })}
              className={`px-2 py-1 rounded transition-colors ${
                (settings.position === 'center' && settings.customPositionY === undefined) || settings.customPositionY === 50
                  ? 'bg-amber-500 text-neutral-950 font-bold'
                  : 'text-neutral-400 hover:text-white'
              }`}
              title="Posisikan di Tengah (Center)"
            >
              Tengah
            </button>
            <button
              onClick={() => onUpdateSettings({ position: 'bottom', customPositionY: 80 })}
              className={`px-2 py-1 rounded transition-colors ${
                (settings.position === 'bottom' && settings.customPositionY === undefined) || settings.customPositionY === 80
                  ? 'bg-amber-500 text-neutral-950 font-bold'
                  : 'text-neutral-400 hover:text-white'
              }`}
              title="Posisikan di Bawah (Bottom)"
            >
              Bawah
            </button>
            {typeof settings.customPositionY === 'number' && (
              <span className="text-[10px] text-amber-300 font-mono px-1 border-l border-neutral-800" title="Posisi vertikal kustom">
                {settings.customPositionY}%
              </span>
            )}
          </div>

          {/* Aspect Ratio Toggle */}
          <div className="flex items-center bg-neutral-900 rounded-lg p-0.5 border border-neutral-800">
            <button
              onClick={() => onUpdateSettings({ aspectRatio: '16:9' })}
              className={`p-1 rounded ${
                settings.aspectRatio === '16:9'
                  ? 'bg-neutral-700 text-white'
                  : 'text-neutral-400 hover:text-white'
              }`}
              title="16:9 Landscape / YouTube"
            >
              <Tv className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onUpdateSettings({ aspectRatio: '9:16' })}
              className={`p-1 rounded ${
                settings.aspectRatio === '9:16'
                  ? 'bg-neutral-700 text-white'
                  : 'text-neutral-400 hover:text-white'
              }`}
              title="9:16 Vertical / TikTok / Shorts / Reels"
            >
              <Smartphone className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Fullscreen Button */}
          <button
            onClick={toggleFullscreen}
            className="p-1 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          >
            {isFullscreen ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
          </button>

          {/* Quick Video Export Button */}
          {onExportWebm && (
            <button
              onClick={onExportWebm}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-semibold transition"
              title="Render to WebM video"
            >
              <Video className="w-3.5 h-3.5 text-amber-400" />
              <span>Export</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Video-like Screen Container */}
      <div className="w-full flex items-center justify-center p-2 sm:p-4 bg-neutral-950">
        <div
          ref={containerRef}
          style={effectiveVideoUrl ? undefined : getBgStyle()}
          className={`relative w-full max-w-4xl rounded-xl overflow-hidden transition-all duration-300 flex flex-col ${getVerticalPlacementClass()} ${
            settings.aspectRatio === '9:16'
              ? 'aspect-[9/16] max-w-xs mx-auto'
              : 'aspect-video'
          } select-none shadow-2xl border border-neutral-800/80`}
        >
          {/* Active Background Video Layer */}
          {effectiveVideoUrl && (
            <>
              <video
                ref={previewVideoRef}
                src={effectiveVideoUrl}
                muted
                playsInline
                loop
                className="absolute inset-0 w-full h-full object-cover pointer-events-none z-0"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/40 to-black/75 pointer-events-none z-0" />
            </>
          )}

          {/* Safe Area Subtitle Container with Interactive Drag & Drop */}
          <div
            className={`w-full subtitle-safe-area flex flex-col ${getHorizontalAlignmentClass()} z-10`}
            style={
              typeof settings.customPositionY === 'number'
                ? {
                    position: 'absolute',
                    top: `${settings.customPositionY}%`,
                    transform: 'translateY(-50%)',
                    left: 0,
                    right: 0,
                  }
                : undefined
            }
          >
            {displaySegment ? (
              <div
                ref={subtitleBoxRef}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                className={`group/drag relative max-w-2xl w-full flex flex-col ${getHorizontalAlignmentClass()} transition-opacity duration-150 cursor-grab active:cursor-grabbing select-none p-2 rounded-xl transition-all ${
                  isDragging
                    ? 'ring-2 ring-amber-400 bg-black/40 backdrop-blur-xs scale-[1.01]'
                    : 'hover:ring-1 hover:ring-amber-500/40 hover:bg-black/20'
                } ${
                  activeSegment ? 'opacity-100 scale-100' : 'opacity-40 scale-[0.99]'
                }`}
                title="Klik dan tahan mouse untuk menggeser posisi vertikal lirik secara bebas"
              >
                {/* Floating Drag Indicator Hint */}
                <div
                  className={`absolute -top-7 left-1/2 -translate-x-1/2 pointer-events-none transition-all duration-150 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold shadow-lg ${
                    isDragging
                      ? 'opacity-100 bg-amber-500 text-neutral-950 scale-105'
                      : 'opacity-0 group-hover/drag:opacity-100 bg-neutral-900/90 text-amber-400 border border-neutral-700'
                  }`}
                >
                  <Move className="w-3 h-3" />
                  <span>
                    {isDragging
                      ? `Posisi: ${currentYPercent}%`
                      : 'Tahan & Geser Vertikal'}
                  </span>
                </div>

                {/* LAYER 1: ORIGINAL TEXT (DOMINANT) */}
                {settings.displayMode !== 'translation' && (
                  <div
                    dir={isOriginalRtl ? 'rtl' : 'ltr'}
                    className={`${getFontFamilyClass(
                      settings.originalFont
                    )} leading-snug tracking-wide transition-all`}
                    style={{
                      color: settings.originalColor || 'var(--subtitle-original-color)',
                      fontSize: `clamp(18px, 3.2vw, ${settings.originalFontSize}px)`,
                      fontWeight: settings.originalWeight || '700',
                      textShadow: settings.shadow
                        ? '0 3px 12px rgba(0, 0, 0, 0.95), 0 1px 3px rgba(0, 0, 0, 0.9)'
                        : 'none',
                      WebkitTextStroke: settings.outline
                        ? '1px rgba(0, 0, 0, 0.85)'
                        : 'none',
                    }}
                  >
                    <span>{displaySegment.original}</span>
                    {settings.showVerseNumber && displaySegment.verseNumber ? (
                      <span className="inline-block mx-2 text-amber-400 font-normal">
                        {formatQuranVerseSymbol(displaySegment.verseNumber)}
                      </span>
                    ) : null}
                  </div>
                )}

                {/* LAYER 2: TRANSLATION (BELOW ORIGINAL) */}
                {settings.displayMode !== 'original' && (
                  <div
                    dir="ltr"
                    className={`${getFontFamilyClass(
                      settings.translationFont
                    )} leading-relaxed tracking-normal max-w-xl transition-all`}
                    style={{
                      marginTop:
                        settings.displayMode === 'bilingual'
                          ? `${settings.lineSpacing || 12}px`
                          : '0px',
                      color:
                        settings.translationColor || 'var(--subtitle-translation-color)',
                      fontSize: `clamp(14px, 2.1vw, ${settings.translationFontSize}px)`,
                      fontWeight: settings.translationWeight || '600',
                      textShadow: settings.shadow
                        ? '0 2px 10px rgba(0, 0, 0, 0.95), 0 1px 2px rgba(0, 0, 0, 0.85)'
                        : 'none',
                      WebkitTextStroke: settings.outline
                        ? '0.6px rgba(0, 0, 0, 0.75)'
                        : 'none',
                    }}
                  >
                    {currentTranslationText ? (
                      currentTranslationText
                    ) : (
                      <span className="italic text-neutral-400 opacity-60 text-sm">
                        [No {getLanguageName(settings.selectedTranslationLanguage)}{' '}
                        translation yet]
                      </span>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-neutral-500 text-sm italic">
                Belum ada subtitle. Gunakan tombol "Paste Lyrics", "Import SRT", atau "+ Tambah Manual" di bawah untuk menambahkan lirik.
              </div>
            )}
          </div>

          {/* Subtle branding watermark in preview corner */}
          <div className="absolute top-3 left-3 opacity-40 hover:opacity-80 transition text-[10px] font-mono tracking-widest text-neutral-400 pointer-events-none">
            LYRICSYNC AI • MASTER TIMELINE
          </div>
        </div>
      </div>
    </div>
  );
};
