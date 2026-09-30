import React, { useState } from 'react';
import {
  Video,
  X,
  Play,
  Download,
  Tv,
  Smartphone,
  CheckCircle,
  Loader2,
  Sparkles,
  Layers,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { SubtitleProject } from '../types/subtitle';
import { renderProjectToWebM, WebMRenderResult } from '../utils/webmExporter';

interface ExportWebmModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: SubtitleProject;
}

export const ExportWebmModal: React.FC<ExportWebmModalProps> = ({
  isOpen,
  onClose,
  project,
}) => {
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>(
    project.settings.aspectRatio === '9:16' ? '9:16' : '16:9'
  );
  const [quality, setQuality] = useState<'1080p' | '720p'>('1080p');
  const [backgroundStyle, setBackgroundStyle] = useState<'black' | 'dark' | 'transparent'>('black');
  const [includeAudio, setIncludeAudio] = useState(true);

  const [isRendering, setIsRendering] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [renderResult, setRenderResult] = useState<WebMRenderResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleStartRender = async () => {
    setIsRendering(true);
    setProgress(0);
    setStatusText('Memulai proses perekaman video...');
    setRenderResult(null);
    setErrorMessage(null);

    try {
      const result = await renderProjectToWebM(project, {
        aspectRatio,
        quality,
        backgroundStyle,
        includeAudio,
        onProgress: (pct, text) => {
          setProgress(pct);
          setStatusText(text);
        },
      });

      setRenderResult(result);
    } catch (err: any) {
      console.error('WebM render error:', err);
      setErrorMessage(err.message || 'Terjadi kesalahan saat merender video WebM.');
    } finally {
      setIsRendering(false);
    }
  };

  const handleDownload = () => {
    if (!renderResult) return;
    const a = document.createElement('a');
    a.href = renderResult.url;
    a.download = renderResult.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#12141a] border border-neutral-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden p-6 relative">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
              <Video className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-wide flex items-center gap-2">
                Export Video WebM
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  Client-Side Fast
                </span>
              </h2>
              <p className="text-xs text-neutral-400">
                Render video lirik subtitle langsung dari browser tanpa perlu upload ke server
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isRendering}
            className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Configuration Body */}
        {!renderResult ? (
          <div className="py-4 space-y-4">
            {/* Aspect Ratio Selection */}
            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-2">
                Format Rasio Video:
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setAspectRatio('16:9')}
                  disabled={isRendering}
                  className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition ${
                    aspectRatio === '16:9'
                      ? 'bg-amber-500/10 border-amber-500 text-amber-300 font-bold'
                      : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                  }`}
                >
                  <Tv className="w-5 h-5 text-amber-400" />
                  <span className="text-xs">16:9 Landscape</span>
                  <span className="text-[10px] text-neutral-500">YouTube / TV / Desktop</span>
                </button>

                <button
                  type="button"
                  onClick={() => setAspectRatio('9:16')}
                  disabled={isRendering}
                  className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition ${
                    aspectRatio === '9:16'
                      ? 'bg-amber-500/10 border-amber-500 text-amber-300 font-bold'
                      : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                  }`}
                >
                  <Smartphone className="w-5 h-5 text-amber-400" />
                  <span className="text-xs">9:16 Vertical</span>
                  <span className="text-[10px] text-neutral-500">TikTok / Reels / Shorts</span>
                </button>
              </div>
            </div>

            {/* Quality & Background Grid */}
            <div className="grid grid-cols-2 gap-3">
              {/* Resolution Quality */}
              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                  Kualitas Resolusi:
                </label>
                <div className="flex bg-neutral-900 rounded-xl p-1 border border-neutral-800">
                  <button
                    type="button"
                    onClick={() => setQuality('1080p')}
                    disabled={isRendering}
                    className={`flex-1 py-1.5 text-xs rounded-lg font-semibold transition ${
                      quality === '1080p'
                        ? 'bg-neutral-700 text-white'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    1080p (FHD)
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuality('720p')}
                    disabled={isRendering}
                    className={`flex-1 py-1.5 text-xs rounded-lg font-semibold transition ${
                      quality === '720p'
                        ? 'bg-neutral-700 text-white'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    720p (HD)
                  </button>
                </div>
              </div>

              {/* Background Style */}
              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                  Latar Belakang Video:
                </label>
                <select
                  value={backgroundStyle}
                  onChange={(e: any) => setBackgroundStyle(e.target.value)}
                  disabled={isRendering}
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-amber-500"
                >
                  <option value="black">Hitam Solid (Black)</option>
                  <option value="dark">Gradien Sinematik (Dark)</option>
                  <option value="transparent">Transparan (Alpha Overlay)</option>
                </select>
              </div>
            </div>

            {/* Audio Checkbox */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-neutral-900/60 border border-neutral-800/80">
              <div className="flex items-center gap-2.5">
                {includeAudio ? (
                  <Volume2 className="w-4 h-4 text-amber-400" />
                ) : (
                  <VolumeX className="w-4 h-4 text-neutral-500" />
                )}
                <div>
                  <div className="text-xs font-semibold text-neutral-200">
                    Sertakan Trek Audio
                  </div>
                  <div className="text-[11px] text-neutral-500">
                    {project.audioUrl
                      ? 'Sinkronkan rekaman suara musik ke video'
                      : 'Belum ada file audio yang dimuat'}
                  </div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={includeAudio}
                onChange={(e) => setIncludeAudio(e.target.checked)}
                disabled={isRendering || !project.audioUrl}
                className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
              />
            </div>

            {/* Progress Bar during rendering */}
            {isRendering && (
              <div className="p-4 rounded-xl bg-neutral-900 border border-amber-500/30 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-amber-300 flex items-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    {statusText}
                  </span>
                  <span className="font-mono text-amber-400 font-bold">{progress}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-neutral-800 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-amber-300 transition-all duration-200"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-[11px] text-neutral-500 text-center">
                  Mohon jangan menutup jendela browser selama proses rekaman berlangsung.
                </p>
              </div>
            )}

            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/50 text-rose-300 text-xs">
                {errorMessage}
              </div>
            )}
          </div>
        ) : (
          /* Render Success Result */
          <div className="py-6 space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto">
              <CheckCircle className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-base font-bold text-white">Video WebM Siap Diunduh!</h3>
              <p className="text-xs text-neutral-400 mt-1">
                Format: <span className="font-mono text-amber-300">{aspectRatio}</span> •{' '}
                <span className="font-mono text-amber-300">{quality}</span> • Durasi:{' '}
                {renderResult.duration.toFixed(1)}s
              </p>
            </div>

            {/* Video Preview */}
            <div className="max-h-56 rounded-xl overflow-hidden border border-neutral-800 bg-black flex items-center justify-center">
              <video
                src={renderResult.url}
                controls
                className="max-h-56 w-full object-contain"
              />
            </div>

            <div className="pt-2 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setRenderResult(null)}
                className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold transition"
              >
                Render Ulang
              </button>
              <button
                type="button"
                onClick={handleDownload}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-neutral-950 text-xs font-bold shadow-lg shadow-amber-500/20 transition flex items-center gap-1.5"
              >
                <Download className="w-4 h-4" />
                <span>Unduh File WebM</span>
              </button>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        {!renderResult && (
          <div className="pt-4 border-t border-neutral-800 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isRendering}
              className="px-4 py-2 text-xs font-medium rounded-xl text-neutral-300 hover:bg-neutral-800 transition disabled:opacity-50"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleStartRender}
              disabled={isRendering || project.segments.length === 0}
              className="px-5 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-neutral-950 transition flex items-center gap-1.5 shadow-md shadow-amber-500/20 disabled:opacity-50"
            >
              {isRendering ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Merender Video...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Mulai Render WebM</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
