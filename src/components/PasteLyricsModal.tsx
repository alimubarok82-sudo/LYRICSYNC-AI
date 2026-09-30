import React, { useState } from 'react';
import { FileText, X, Sparkles, ShieldCheck } from 'lucide-react';

interface PasteLyricsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAlignLyrics: (lyrics: string) => void;
  isAligning?: boolean;
}

export const PasteLyricsModal: React.FC<PasteLyricsModalProps> = ({
  isOpen,
  onClose,
  onAlignLyrics,
  isAligning,
}) => {
  const [lyricsText, setLyricsText] = useState('');

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (lyricsText.trim()) {
      onAlignLyrics(lyricsText.trim());
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-xl w-full p-5 shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-400" />
            <h3 className="font-bold text-sm text-white">Paste Authoritative Lyrics</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="py-4 space-y-3 overflow-y-auto flex-1 text-xs">
          {/* Authoritative Guarantee Badge */}
          <div className="bg-blue-500/10 border border-blue-500/20 p-3 rounded-xl flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold text-blue-300">
                100% Authoritative Original Text Guarantee
              </span>
              <p className="text-[11px] text-neutral-400 leading-relaxed">
                Your supplied lyrics will remain untouched: no spelling changes, no
                paraphrasing, no removal of repeated lines, and full preservation of
                Arabic characters and harakat. AI only synchronizes timestamps.
              </p>
            </div>
          </div>

          <div>
            <label className="block text-neutral-300 font-semibold mb-1.5">
              Paste Lyrics (One vocal phrase / line per break):
            </label>
            <textarea
              rows={9}
              value={lyricsText}
              onChange={(e) => setLyricsText(e.target.value)}
              placeholder={`الَّذِي أَسْتَوْقَدَ نَارًا\nفَلَمَّا أَضَاءَتْ مَا حَوْلَهُ\nذَهَبَ اللَّهُ بِنُورِهِمْ\nوَتَرَكَهُمْ فِي ظُلُمَاتٍ لَّا يُبْصِرُونَ`}
              className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-3 text-xs text-neutral-200 focus:outline-none focus:border-amber-500 font-arabic text-base leading-relaxed resize-none transition"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-neutral-800 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-medium transition"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!lyricsText.trim() || isAligning}
            className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-blue-500 to-amber-500 hover:from-blue-400 hover:to-amber-400 text-neutral-950 text-xs font-bold transition disabled:opacity-50 shadow-md flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{isAligning ? 'Aligning...' : 'Align to Audio Timestamps'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
