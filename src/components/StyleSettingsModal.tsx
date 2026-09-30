import React, { useRef } from 'react';
import {
  Sliders,
  X,
  Type,
  Palette,
  Image as ImageIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  BookOpen,
} from 'lucide-react';
import { SubtitleStyleSettings } from '../types/subtitle';

interface StyleSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: SubtitleStyleSettings;
  onUpdateSettings: (updates: Partial<SubtitleStyleSettings>) => void;
}

export const StyleSettingsModal: React.FC<StyleSettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
}) => {
  const bgFileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      onUpdateSettings({ backgroundImageUrl: url });
    }
  };

  const removeBgImage = () => {
    onUpdateSettings({ backgroundImageUrl: null });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-2xl w-full p-5 shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-amber-400" />
            <h3 className="font-bold text-sm text-white">Subtitle Visual Styling & Layout</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="py-4 space-y-5 overflow-y-auto flex-1 text-xs">
          {/* Typography: Original (Layer 1) & Translation (Layer 2) */}
          <div className="space-y-3">
            <div className="flex items-center gap-1.5 text-neutral-300 font-semibold pb-1 border-b border-neutral-800">
              <Type className="w-3.5 h-3.5 text-amber-400" />
              <span>Typography & Hierarchy</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Layer 1: Original */}
              <div className="bg-neutral-950 p-3 rounded-xl border border-neutral-800 space-y-2.5">
                <span className="font-bold text-neutral-200">Layer 1: Original Text</span>

                <div>
                  <label className="text-neutral-400 block mb-1">Font Family</label>
                  <select
                    value={settings.originalFont}
                    onChange={(e) => onUpdateSettings({ originalFont: e.target.value })}
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-lg p-1.5 text-neutral-200 focus:outline-none focus:border-amber-500"
                  >
                    <option value="font-arabic">Amiri / Noto Naskh (Arabic Serif)</option>
                    <option value="font-arabic-sans">Noto Sans Arabic</option>
                    <option value="font-sans">Modern Sans (Plus Jakarta)</option>
                    <option value="font-cinematic">Cinzel (Cinematic)</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-neutral-400 block mb-1">Size (px)</label>
                    <input
                      type="number"
                      min={16}
                      max={72}
                      value={settings.originalFontSize}
                      onChange={(e) =>
                        onUpdateSettings({ originalFontSize: parseInt(e.target.value, 10) || 48 })
                      }
                      className="w-full bg-neutral-900 border border-neutral-800 rounded-lg p-1.5 text-neutral-200 text-center font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-neutral-400 block mb-1">Color</label>
                    <div className="flex items-center gap-1.5 bg-neutral-900 border border-neutral-800 rounded-lg p-1">
                      <input
                        type="color"
                        value={settings.originalColor}
                        onChange={(e) => onUpdateSettings({ originalColor: e.target.value })}
                        className="w-6 h-6 rounded border-0 cursor-pointer bg-transparent"
                      />
                      <span className="text-[10px] font-mono text-neutral-300">
                        {settings.originalColor}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Layer 2: Translation */}
              <div className="bg-neutral-950 p-3 rounded-xl border border-neutral-800 space-y-2.5">
                <span className="font-bold text-amber-300">Layer 2: Translation Text</span>

                <div>
                  <label className="text-neutral-400 block mb-1">Font Family</label>
                  <select
                    value={settings.translationFont}
                    onChange={(e) => onUpdateSettings({ translationFont: e.target.value })}
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-lg p-1.5 text-neutral-200 focus:outline-none focus:border-amber-500"
                  >
                    <option value="font-sans">Modern Sans (Plus Jakarta)</option>
                    <option value="font-arabic">Amiri (Arabic Serif)</option>
                    <option value="font-cinematic">Cinzel (Cinematic)</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-neutral-400 block mb-1">Size (px)</label>
                    <input
                      type="number"
                      min={12}
                      max={48}
                      value={settings.translationFontSize}
                      onChange={(e) =>
                        onUpdateSettings({ translationFontSize: parseInt(e.target.value, 10) || 22 })
                      }
                      className="w-full bg-neutral-900 border border-neutral-800 rounded-lg p-1.5 text-neutral-200 text-center font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-neutral-400 block mb-1">Color (Gold/Yellow)</label>
                    <div className="flex items-center gap-1.5 bg-neutral-900 border border-neutral-800 rounded-lg p-1">
                      <input
                        type="color"
                        value={settings.translationColor}
                        onChange={(e) => onUpdateSettings({ translationColor: e.target.value })}
                        className="w-6 h-6 rounded border-0 cursor-pointer bg-transparent"
                      />
                      <span className="text-[10px] font-mono text-amber-300">
                        {settings.translationColor}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Positioning, Alignments & Spacing */}
          <div className="space-y-3">
            <div className="flex items-center gap-1.5 text-neutral-300 font-semibold pb-1 border-b border-neutral-800">
              <AlignCenter className="w-3.5 h-3.5 text-amber-400" />
              <span>Alignment, Position & Spacing</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Vertical Position */}
              <div className="bg-neutral-950 p-2.5 rounded-xl border border-neutral-800 space-y-1.5">
                <label className="text-neutral-400 block">Vertical Position</label>
                <div className="flex bg-neutral-900 rounded-lg p-0.5 border border-neutral-800 text-[11px]">
                  {(['top', 'center', 'bottom'] as const).map((pos) => (
                    <button
                      key={pos}
                      onClick={() => onUpdateSettings({ position: pos })}
                      className={`flex-1 py-1 rounded capitalize transition ${
                        settings.position === pos
                          ? 'bg-amber-500 text-neutral-950 font-bold'
                          : 'text-neutral-400 hover:text-white'
                      }`}
                    >
                      {pos}
                    </button>
                  ))}
                </div>
              </div>

              {/* Horizontal Alignment */}
              <div className="bg-neutral-950 p-2.5 rounded-xl border border-neutral-800 space-y-1.5">
                <label className="text-neutral-400 block">Text Alignment</label>
                <div className="flex bg-neutral-900 rounded-lg p-0.5 border border-neutral-800 text-[11px]">
                  {(['left', 'center', 'right'] as const).map((align) => (
                    <button
                      key={align}
                      onClick={() => onUpdateSettings({ alignment: align })}
                      className={`flex-1 py-1 rounded capitalize transition ${
                        settings.alignment === align
                          ? 'bg-amber-500 text-neutral-950 font-bold'
                          : 'text-neutral-400 hover:text-white'
                      }`}
                    >
                      {align}
                    </button>
                  ))}
                </div>
              </div>

              {/* Line Spacing */}
              <div className="bg-neutral-950 p-2.5 rounded-xl border border-neutral-800 space-y-1.5">
                <label className="text-neutral-400 block">Line Gap ({settings.lineSpacing}px)</label>
                <input
                  type="range"
                  min={4}
                  max={32}
                  value={settings.lineSpacing}
                  onChange={(e) =>
                    onUpdateSettings({ lineSpacing: parseInt(e.target.value, 10) })
                  }
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Effects, Outline, Shadow & Quran Verse */}
          <div className="space-y-3">
            <div className="flex items-center gap-1.5 text-neutral-300 font-semibold pb-1 border-b border-neutral-800">
              <Palette className="w-3.5 h-3.5 text-amber-400" />
              <span>Readability & Preview Backdrop</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-neutral-950 p-3 rounded-xl border border-neutral-800 space-y-2">
                <span className="font-bold text-neutral-200">Shadow & Outline</span>
                <label className="flex items-center gap-2 cursor-pointer text-neutral-300">
                  <input
                    type="checkbox"
                    checked={settings.shadow}
                    onChange={(e) => onUpdateSettings({ shadow: e.target.checked })}
                    className="accent-amber-500 rounded"
                  />
                  <span>Cinematic Text Shadow</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-neutral-300">
                  <input
                    type="checkbox"
                    checked={settings.outline}
                    onChange={(e) => onUpdateSettings({ outline: e.target.checked })}
                    className="accent-amber-500 rounded"
                  />
                  <span>Text Stroke Outline (Boosts Readability)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-amber-300">
                  <input
                    type="checkbox"
                    checked={settings.showVerseNumber}
                    onChange={(e) =>
                      onUpdateSettings({ showVerseNumber: e.target.checked })
                    }
                    className="accent-amber-500 rounded"
                  />
                  <span>Show Quran Verse End Symbol (۝)</span>
                </label>
              </div>

              {/* Background selector */}
              <div className="bg-neutral-950 p-3 rounded-xl border border-neutral-800 space-y-2">
                <span className="font-bold text-neutral-200">Preview Backdrop</span>
                <div className="flex flex-wrap gap-1.5">
                  {(['black', 'dark', 'transparent'] as const).map((bg) => (
                    <button
                      key={bg}
                      onClick={() => onUpdateSettings({ backgroundColor: bg, backgroundImageUrl: null })}
                      className={`px-2.5 py-1 rounded text-xs capitalize transition ${
                        settings.backgroundColor === bg && !settings.backgroundImageUrl
                          ? 'bg-amber-500 text-neutral-950 font-bold'
                          : 'bg-neutral-900 text-neutral-300 border border-neutral-800 hover:text-white'
                      }`}
                    >
                      {bg}
                    </button>
                  ))}
                </div>

                <div className="pt-1 flex items-center gap-2">
                  <button
                    onClick={() => bgFileInputRef.current?.click()}
                    className="flex items-center gap-1 px-2.5 py-1 rounded bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-neutral-800 text-xs transition"
                  >
                    <ImageIcon className="w-3.5 h-3.5 text-amber-400" />
                    <span>Upload Image Backdrop</span>
                  </button>
                  {settings.backgroundImageUrl && (
                    <button
                      onClick={removeBgImage}
                      className="text-red-400 hover:underline text-[11px]"
                    >
                      Remove
                    </button>
                  )}
                  <input
                    ref={bgFileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-neutral-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-bold transition shadow-sm"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
