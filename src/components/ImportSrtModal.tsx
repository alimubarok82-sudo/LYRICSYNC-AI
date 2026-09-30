import React, { useState } from 'react';
import { Upload, X, FileText, Check, AlertCircle } from 'lucide-react';
import { parseSRT } from '../utils/srt';
import { SubtitleSegment } from '../types/subtitle';
import { getLanguageName } from '../utils/languages';

interface ImportSrtModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (segments: SubtitleSegment[], detectedBilingual: boolean) => void;
  targetLangCode: string;
}

export const ImportSrtModal: React.FC<ImportSrtModalProps> = ({
  isOpen,
  onClose,
  onImport,
  targetLangCode,
}) => {
  const [srtText, setSrtText] = useState('');
  const [fileName, setFileName] = useState('');
  const [previewSegments, setPreviewSegments] = useState<SubtitleSegment[]>([]);
  const [detectedBilingual, setDetectedBilingual] = useState(false);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = String(event.target?.result || '');
      setSrtText(content);
      const parsed = parseSRT(content, targetLangCode);
      setPreviewSegments(parsed.segments);
      setDetectedBilingual(parsed.detectedBilingual);
    };
    reader.readAsText(file);
  };

  const handleTextChange = (text: string) => {
    setSrtText(text);
    if (text.trim()) {
      const parsed = parseSRT(text, targetLangCode);
      setPreviewSegments(parsed.segments);
      setDetectedBilingual(parsed.detectedBilingual);
    } else {
      setPreviewSegments([]);
    }
  };

  const handleConfirm = () => {
    if (previewSegments.length > 0) {
      onImport(previewSegments, detectedBilingual);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-xl w-full p-5 shadow-2xl flex flex-col max-h-[85vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <Upload className="w-4 h-4 text-emerald-400" />
            <h3 className="font-bold text-sm text-white">Import Existing SRT Subtitles</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="py-4 space-y-4 overflow-y-auto flex-1 text-xs">
          {/* File drag / upload zone */}
          <label className="border-2 border-dashed border-neutral-800 hover:border-neutral-700 bg-neutral-950/60 rounded-xl p-4 flex flex-col items-center justify-center gap-2 cursor-pointer transition text-center">
            <Upload className="w-6 h-6 text-neutral-500" />
            <div>
              <span className="text-amber-400 font-medium">Click to upload .SRT file</span>
              <p className="text-[11px] text-neutral-500 mt-0.5">
                Supports Standard & Bilingual SRT (e.g. Line 1 Arabic, Line 2 Translation)
              </p>
            </div>
            {fileName && (
              <span className="text-xs text-neutral-300 font-mono bg-neutral-800 px-2 py-0.5 rounded">
                {fileName}
              </span>
            )}
            <input
              type="file"
              accept=".srt,text/plain"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>

          {/* Or Paste SRT text directly */}
          <div>
            <div className="flex items-center justify-between mb-1.5 text-neutral-400">
              <span className="font-semibold">Or Paste SRT Text:</span>
              {previewSegments.length > 0 && (
                <span className="text-amber-400 font-mono">
                  {previewSegments.length} segments parsed
                </span>
              )}
            </div>
            <textarea
              rows={6}
              value={srtText}
              onChange={(e) => handleTextChange(e.target.value)}
              placeholder={`1\n00:00:03,250 --> 00:00:07,420\nالَّذِي أَسْتَوْقَدَ نَارًا\nYang menyalakan api`}
              className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-3 font-mono text-xs text-neutral-200 focus:outline-none focus:border-amber-500 transition resize-none"
            />
          </div>

          {/* Bilingual structure notice */}
          {previewSegments.length > 0 && (
            <div className="bg-neutral-950 p-3 rounded-xl border border-neutral-800 space-y-1">
              <div className="flex items-center gap-2 text-emerald-400 font-semibold">
                <Check className="w-3.5 h-3.5" />
                <span>
                  {detectedBilingual
                    ? `Detected bilingual layout (Original + ${getLanguageName(targetLangCode)})`
                    : 'Importing as single original text layer'}
                </span>
              </div>
              <p className="text-[11px] text-neutral-400">
                First segment: "{previewSegments[0].original}"
                {previewSegments[0].translations[targetLangCode] &&
                  ` → "${previewSegments[0].translations[targetLangCode]}"`}
              </p>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="pt-3 border-t border-neutral-800 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-medium transition"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={previewSegments.length === 0}
            className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-bold transition disabled:opacity-50 shadow-md shadow-amber-500/20"
          >
            Import {previewSegments.length > 0 ? `(${previewSegments.length} Segments)` : ''}
          </button>
        </div>
      </div>
    </div>
  );
};
