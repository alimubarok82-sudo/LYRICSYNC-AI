import React, { useState, useMemo } from 'react';
import {
  Download,
  Copy,
  Check,
  AlertTriangle,
  CheckCircle2,
  FileArchive,
  FileText,
  Sparkles,
  Video,
} from 'lucide-react';
import JSZip from 'jszip';
import {
  SubtitleSegment,
  SubtitleDisplayMode,
  ValidationReport,
} from '../types/subtitle';
import { generateSRT, validateSubtitles } from '../utils/srt';
import { getLanguageName } from '../utils/languages';

interface SrtOutputPanelProps {
  segments: SubtitleSegment[];
  availableTranslations: string[];
  selectedTranslationLanguage: string;
  originalLanguage: string;
  projectTitle: string;
  audioDuration: number;
  showVerseNumber: boolean;
  onSelectTranslationLanguage: (lang: string) => void;
  onTranslateMissing?: () => void;
  onExportWebm?: () => void;
}

export const SrtOutputPanel: React.FC<SrtOutputPanelProps> = ({
  segments,
  availableTranslations,
  selectedTranslationLanguage,
  originalLanguage,
  projectTitle,
  audioDuration,
  showVerseNumber,
  onSelectTranslationLanguage,
  onTranslateMissing,
  onExportWebm,
}) => {
  const [exportMode, setExportMode] = useState<SubtitleDisplayMode>('bilingual');
  const [copied, setCopied] = useState(false);
  const [isZipping, setIsZipping] = useState(false);

  // Compute live SRT content
  const srtContent = useMemo(() => {
    return generateSRT(segments, exportMode, selectedTranslationLanguage, {
      showVerseNumber,
    });
  }, [segments, exportMode, selectedTranslationLanguage, showVerseNumber]);

  // Compute preflight validation
  const validation: ValidationReport = useMemo(() => {
    return validateSubtitles(
      segments,
      exportMode,
      selectedTranslationLanguage,
      audioDuration
    );
  }, [segments, exportMode, selectedTranslationLanguage, audioDuration]);

  // Compute standard filename
  const baseFilename = (projectTitle || 'LyricSync_Subtitles')
    .replace(/[^a-zA-Z0-9_\-\u0600-\u06FF]/g, '_')
    .replace(/_+/g, '_');

  const getExportFilename = () => {
    if (exportMode === 'original') {
      return `${baseFilename}-${originalLanguage}.srt`;
    }
    if (exportMode === 'translation') {
      return `${baseFilename}-${selectedTranslationLanguage}.srt`;
    }
    return `${baseFilename}-${originalLanguage}-${selectedTranslationLanguage}.srt`;
  };

  const handleCopySRT = () => {
    navigator.clipboard.writeText(srtContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadSRT = () => {
    const filename = getExportFilename();
    const blob = new Blob([srtContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Download all languages in a single ZIP (Section 32)
  const handleDownloadAllLanguages = async () => {
    try {
      setIsZipping(true);
      const zip = new JSZip();

      // 1. Original only SRT
      const origSrt = generateSRT(segments, 'original', '', { showVerseNumber });
      zip.file(`${baseFilename}-${originalLanguage}.srt`, origSrt);

      // 2. Each translation language (Translation only and Bilingual versions)
      for (const lang of availableTranslations) {
        const transOnly = generateSRT(segments, 'translation', lang, {
          showVerseNumber,
        });
        zip.file(`${baseFilename}-${lang}.srt`, transOnly);

        const bilingual = generateSRT(segments, 'bilingual', lang, {
          showVerseNumber,
        });
        zip.file(`${baseFilename}-${originalLanguage}-${lang}.srt`, bilingual);
      }

      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${baseFilename}-All-Languages-SRT.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to create ZIP package:', err);
    } finally {
      setIsZipping(false);
    }
  };

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl flex flex-col shadow-xl overflow-hidden">
      {/* Top Header & Export Options */}
      <div className="bg-neutral-950/80 p-3 sm:p-4 border-b border-neutral-800 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-bold text-neutral-200 tracking-wider">
              SRT ENGINE & EXPORT STUDIO
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopySRT}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 text-xs font-semibold transition"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy SRT</span>
                </>
              )}
            </button>

            <button
              onClick={handleDownloadSRT}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs shadow-md transition shadow-amber-500/20"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download SRT</span>
            </button>

            <button
              onClick={handleDownloadAllLanguages}
              disabled={isZipping}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 text-xs font-semibold transition disabled:opacity-50"
              title="Download all language SRTs bundled into a ZIP file"
            >
              <FileArchive className="w-3.5 h-3.5 text-amber-400" />
              <span>{isZipping ? 'Bundling...' : 'All (.ZIP)'}</span>
            </button>

            {onExportWebm && (
              <button
                onClick={onExportWebm}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-neutral-950 font-bold text-xs shadow-md transition"
                title="Render subtitles into WebM video format"
              >
                <Video className="w-3.5 h-3.5" />
                <span>Export</span>
              </button>
            )}
          </div>
        </div>

        {/* Export Configuration Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-neutral-800/80 text-xs">
          {/* Mode Switcher */}
          <div className="flex items-center gap-2">
            <span className="text-neutral-400 font-semibold text-[11px]">
              Export Mode:
            </span>
            <div className="flex items-center bg-neutral-900 rounded-lg p-0.5 border border-neutral-800">
              <button
                onClick={() => setExportMode('bilingual')}
                className={`px-2.5 py-1 rounded transition text-xs ${
                  exportMode === 'bilingual'
                    ? 'bg-amber-500 text-neutral-950 font-bold'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                ● Bilingual
              </button>
              <button
                onClick={() => setExportMode('original')}
                className={`px-2.5 py-1 rounded transition text-xs ${
                  exportMode === 'original'
                    ? 'bg-amber-500 text-neutral-950 font-bold'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                ○ Original
              </button>
              <button
                onClick={() => setExportMode('translation')}
                className={`px-2.5 py-1 rounded transition text-xs ${
                  exportMode === 'translation'
                    ? 'bg-amber-500 text-neutral-950 font-bold'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                ○ Translation
              </button>
            </div>
          </div>

          {/* Target Language */}
          {exportMode !== 'original' && (
            <div className="flex items-center gap-2">
              <span className="text-neutral-400 font-semibold text-[11px]">
                Export Language:
              </span>
              <select
                value={selectedTranslationLanguage}
                onChange={(e) => onSelectTranslationLanguage(e.target.value)}
                className="bg-neutral-900 border border-neutral-800 rounded-lg px-2.5 py-1 text-amber-300 font-semibold text-xs focus:outline-none focus:border-amber-500"
              >
                {availableTranslations.map((langCode) => (
                  <option key={langCode} value={langCode}>
                    {getLanguageName(langCode)} ({langCode.toUpperCase()})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Filename Preview */}
          <div className="text-[11px] text-neutral-500 font-mono">
            Output: <span className="text-neutral-300">{getExportFilename()}</span>
          </div>
        </div>
      </div>

      {/* Validation Banner (Sections 34 & 35) */}
      <div className="bg-neutral-950 px-4 py-2.5 border-b border-neutral-800 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{validation.totalSegments} segments</span>
            </div>
            <span className="text-neutral-600">•</span>
            <span className="text-neutral-400">Timeline valid</span>
            <span className="text-neutral-600">•</span>
            <span className="text-neutral-400">UTF-8 ready</span>
          </div>

          {/* Missing translation warning with instant action */}
          {validation.missingTranslationsCount > 0 && exportMode !== 'original' && (
            <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-lg text-amber-300 text-[11px]">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>
                {validation.missingTranslationsCount} subtitles missing{' '}
                {getLanguageName(selectedTranslationLanguage)} translation.
              </span>
              {onTranslateMissing && (
                <button
                  onClick={onTranslateMissing}
                  className="underline font-bold text-amber-300 hover:text-white ml-1"
                >
                  Translate Missing
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Live SRT Code View Area */}
      <div className="p-3 sm:p-4 bg-neutral-950 font-mono text-xs text-neutral-300 overflow-y-auto max-h-[500px] select-text">
        {srtContent ? (
          <pre className="whitespace-pre-wrap leading-relaxed selection:bg-amber-500/30 selection:text-amber-200">
            {srtContent}
          </pre>
        ) : (
          <div className="text-neutral-600 italic text-center py-12">
            No subtitle text generated yet. Add or import subtitles to view standard SRT.
          </div>
        )}
      </div>
    </div>
  );
};
