import React, { useState } from 'react';
import {
  Globe,
  Plus,
  Sparkles,
  Check,
  Languages,
  X,
  Layers,
} from 'lucide-react';
import {
  SUPPORTED_LANGUAGES,
  ORIGINAL_LANGUAGES,
  getLanguageName,
} from '../utils/languages';

interface LanguageManagerBarProps {
  originalLanguage: string;
  selectedTranslationLanguage: string;
  availableTranslations: string[];
  onOriginalLanguageChange: (lang: string) => void;
  onSelectTranslationLanguage: (lang: string) => void;
  onAddTranslationLanguage: (lang: string) => void;
  onRemoveTranslationLanguage: (lang: string) => void;
  onTranslateLanguage: (lang: string, forceReplace?: boolean) => void;
  onTranslateAllLanguages: () => void;
  isTranslating?: boolean;
  hasExistingTranslations?: boolean;
}

export const LanguageManagerBar: React.FC<LanguageManagerBarProps> = ({
  originalLanguage,
  selectedTranslationLanguage,
  availableTranslations,
  onOriginalLanguageChange,
  onSelectTranslationLanguage,
  onAddTranslationLanguage,
  onRemoveTranslationLanguage,
  onTranslateLanguage,
  onTranslateAllLanguages,
  isTranslating,
  hasExistingTranslations,
}) => {
  const [showAddDropdown, setShowAddDropdown] = useState(false);
  const [showReplaceModal, setShowReplaceModal] = useState(false);

  const availableToAdd = SUPPORTED_LANGUAGES.filter(
    (l) => !availableTranslations.includes(l.code) && l.code !== originalLanguage
  );

  const handleTranslateClick = () => {
    if (hasExistingTranslations) {
      setShowReplaceModal(true);
    } else {
      onTranslateLanguage(selectedTranslationLanguage, false);
    }
  };

  const confirmReplaceTranslation = () => {
    setShowReplaceModal(false);
    onTranslateLanguage(selectedTranslationLanguage, true);
  };

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-3 sm:p-4 shadow-xl">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-neutral-800">
        {/* Source Language & Target Language Selectors */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-neutral-400">
              Original Language:
            </span>
            <select
              value={originalLanguage}
              onChange={(e) => onOriginalLanguageChange(e.target.value)}
              className="bg-neutral-950 border border-neutral-800 text-neutral-200 text-xs rounded-lg px-2.5 py-1.5 focus:border-amber-500 focus:outline-none"
            >
              {ORIGINAL_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-neutral-400">
              Active Translation:
            </span>
            <select
              value={selectedTranslationLanguage}
              onChange={(e) => onSelectTranslationLanguage(e.target.value)}
              className="bg-neutral-950 border border-amber-500/40 text-amber-300 font-semibold text-xs rounded-lg px-2.5 py-1.5 focus:border-amber-400 focus:outline-none"
            >
              {availableTranslations.map((langCode) => (
                <option key={langCode} value={langCode}>
                  {getLanguageName(langCode)} ({langCode.toUpperCase()})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Translation Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleTranslateClick}
            disabled={isTranslating}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-amber-300 border border-neutral-700 text-xs font-medium transition disabled:opacity-50"
            title={`Translate to ${getLanguageName(selectedTranslationLanguage)}`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>
              {isTranslating
                ? 'Translating...'
                : `Translate (${selectedTranslationLanguage.toUpperCase()})`}
            </span>
          </button>

          <button
            onClick={onTranslateAllLanguages}
            disabled={isTranslating || availableTranslations.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-neutral-950 text-xs font-bold shadow-md transition disabled:opacity-50"
            title="Generate AI translations for all configured languages simultaneously"
          >
            <Languages className="w-3.5 h-3.5" />
            <span>Translate All Languages</span>
          </button>
        </div>
      </div>

      {/* Multilingual Layers Bar (Switch active translation instantly!) */}
      <div className="pt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs text-neutral-400 font-semibold mr-1">
            <Layers className="w-3.5 h-3.5 text-neutral-500" />
            <span>Translation Layers:</span>
          </div>

          {availableTranslations.map((langCode) => {
            const isSelected = selectedTranslationLanguage === langCode;
            return (
              <div
                key={langCode}
                onClick={() => onSelectTranslationLanguage(langCode)}
                className={`group cursor-pointer flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                  isSelected
                    ? 'bg-amber-500 text-neutral-950 font-bold border-amber-400 shadow-md shadow-amber-500/20'
                    : 'bg-neutral-950/80 text-neutral-300 border-neutral-800 hover:border-neutral-700 hover:text-white'
                }`}
              >
                <span>{getLanguageName(langCode)}</span>
                <span className={`text-[10px] uppercase font-mono ${isSelected ? 'text-neutral-900' : 'text-neutral-500'}`}>
                  {langCode}
                </span>

                {availableTranslations.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveTranslationLanguage(langCode);
                    }}
                    className={`p-0.5 rounded-full hover:bg-neutral-700 transition ${
                      isSelected ? 'text-neutral-900 hover:text-black' : 'text-neutral-500 hover:text-neutral-200'
                    }`}
                    title="Remove language layer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}

          {/* Add Translation Language Button */}
          <div className="relative">
            <button
              onClick={() => setShowAddDropdown(!showAddDropdown)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700 text-xs transition"
              title="Add another translation language"
            >
              <Plus className="w-3 h-3 text-amber-400" />
              <span>Add Language</span>
            </button>

            {showAddDropdown && (
              <div className="absolute top-full left-0 mt-2 w-48 bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl p-1 z-50 max-h-56 overflow-y-auto">
                {availableToAdd.length > 0 ? (
                  availableToAdd.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => {
                        onAddTranslationLanguage(lang.code);
                        setShowAddDropdown(false);
                      }}
                      className="w-full text-left px-3 py-1.5 rounded-lg text-xs text-neutral-300 hover:bg-neutral-800 hover:text-white flex items-center justify-between transition"
                    >
                      <span>{lang.name}</span>
                      <span className="text-[10px] text-neutral-500 uppercase font-mono">
                        {lang.code}
                      </span>
                    </button>
                  ))
                ) : (
                  <div className="p-2 text-neutral-500 text-xs text-center">
                    All languages added
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="text-[11px] text-neutral-500 font-mono hidden md:block">
          One Master Timeline • Infinite Language Layers
        </div>
      </div>

      {/* Confirmation Modal if Translation Already Exists (Section 24) */}
      {showReplaceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 max-w-sm w-full shadow-2xl">
            <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
              <Globe className="w-4 h-4 text-amber-400" />
              Replace Existing Translation?
            </h3>
            <p className="text-xs text-neutral-400 mb-4 leading-relaxed">
              {getLanguageName(selectedTranslationLanguage)} translation already
              exists for this project. Would you like to overwrite it with a fresh
              AI translation?
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setShowReplaceModal(false)}
                className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-medium transition"
              >
                Cancel
              </button>
              <button
                onClick={confirmReplaceTranslation}
                className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-bold transition shadow-sm"
              >
                Replace Translation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
