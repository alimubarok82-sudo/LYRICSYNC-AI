import React from 'react';
import {
  Sparkles,
  RotateCcw,
  RotateCw,
  FolderOpen,
  FileText,
  Upload,
  Sliders,
  Save,
  BookOpen,
  Music,
  Mic,
  Disc,
  Key,
} from 'lucide-react';
import { SubtitleContentType } from '../types/subtitle';

interface HeaderProps {
  contentType: SubtitleContentType;
  onContentTypeChange: (type: SubtitleContentType) => void;
  onNewProject: () => void;
  onImportSrt: () => void;
  onPasteLyrics: () => void;
  onLoadDemo: () => void;
  onOpenProjects: () => void;
  onOpenSettings: () => void;
  onOpenApiKeyModal: () => void;
  onExportWebm?: () => void;
  onSave: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  isSaving?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  contentType,
  onContentTypeChange,
  onNewProject,
  onImportSrt,
  onPasteLyrics,
  onLoadDemo,
  onOpenProjects,
  onOpenSettings,
  onOpenApiKeyModal,
  onSave,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  isSaving,
}) => {
  return (
    <header className="border-b border-neutral-800 bg-neutral-900/90 backdrop-blur-md sticky top-0 z-40 px-3 py-2.5 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Logo & Branding */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center text-neutral-950 shadow-lg shadow-amber-500/20 font-black tracking-wider text-sm">
              LS
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-extrabold text-base tracking-tight text-white flex items-center gap-1.5">
                  LYRICSYNC AI
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    V2 STUDIO
                  </span>
                </h1>
              </div>
              <p className="text-[11px] text-neutral-400 hidden sm:block">
                Bilingual & Multilingual Lyric Subtitle Studio
              </p>
            </div>
          </div>

          {/* Content Type Selector */}
          <div className="hidden lg:flex items-center gap-1 bg-neutral-950/80 p-1 rounded-lg border border-neutral-800 text-xs ml-4">
            <button
              onClick={() => onContentTypeChange('quran')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition-colors ${
                contentType === 'quran'
                  ? 'bg-amber-500/20 text-amber-300 font-medium border border-amber-500/30'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
              title="Quran Recitation (strict harakat preservation & verse numbers)"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Quran</span>
            </button>
            <button
              onClick={() => onContentTypeChange('nasheed')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition-colors ${
                contentType === 'nasheed'
                  ? 'bg-amber-500/20 text-amber-300 font-medium border border-amber-500/30'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Nasheed</span>
            </button>
            <button
              onClick={() => onContentTypeChange('song')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition-colors ${
                contentType === 'song'
                  ? 'bg-amber-500/20 text-amber-300 font-medium border border-amber-500/30'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <Music className="w-3.5 h-3.5" />
              <span>Song</span>
            </button>
            <button
              onClick={() => onContentTypeChange('spoken')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition-colors ${
                contentType === 'spoken'
                  ? 'bg-amber-500/20 text-amber-300 font-medium border border-amber-500/30'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <Mic className="w-3.5 h-3.5" />
              <span>Spoken</span>
            </button>
          </div>
        </div>

        {/* Center / History Controls */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className={`p-1.5 rounded-lg border text-xs flex items-center gap-1 transition ${
              canUndo
                ? 'bg-neutral-800/80 border-neutral-700 text-neutral-200 hover:bg-neutral-700 hover:text-white'
                : 'bg-neutral-900 border-neutral-800/50 text-neutral-600 cursor-not-allowed'
            }`}
            title="Undo (Ctrl+Z)"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Undo</span>
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className={`p-1.5 rounded-lg border text-xs flex items-center gap-1 transition ${
              canRedo
                ? 'bg-neutral-800/80 border-neutral-700 text-neutral-200 hover:bg-neutral-700 hover:text-white'
                : 'bg-neutral-900 border-neutral-800/50 text-neutral-600 cursor-not-allowed'
            }`}
            title="Redo (Ctrl+Shift+Z)"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Redo</span>
          </button>
        </div>

        {/* Right Action Bar */}
        <div className="flex items-center gap-2">
          <button
            onClick={onLoadDemo}
            className="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-neutral-800/80 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 transition flex items-center gap-1.5"
            title="Load demo Quran bilingual project"
          >
            <Disc className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Load Demo</span>
          </button>

          <button
            onClick={onPasteLyrics}
            className="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-neutral-800/80 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 transition flex items-center gap-1.5"
            title="Paste existing lyrics for authoritative alignment"
          >
            <FileText className="w-3.5 h-3.5 text-blue-400" />
            <span className="hidden sm:inline">Paste Lyrics</span>
          </button>

          <button
            onClick={onImportSrt}
            className="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-neutral-800/80 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 transition flex items-center gap-1.5"
            title="Import an existing .SRT file"
          >
            <Upload className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Import SRT</span>
          </button>

          <button
            onClick={onOpenProjects}
            className="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-neutral-800/80 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 transition flex items-center gap-1.5"
            title="Saved projects"
          >
            <FolderOpen className="w-3.5 h-3.5 text-purple-400" />
            <span className="hidden sm:inline">Projects</span>
          </button>

          <button
            onClick={onOpenApiKeyModal}
            className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-purple-950/60 hover:bg-purple-900/80 text-purple-300 border border-purple-800/80 hover:border-purple-600 transition flex items-center gap-1.5 shadow-sm shadow-purple-900/20"
            title="Pengaturan Kunci API (BYOK) - Masukkan Gemini API Key Anda sendiri"
          >
            <Key className="w-3.5 h-3.5 text-purple-400" />
            <span className="hidden md:inline">API Key</span>
          </button>

          <button
            onClick={onOpenSettings}
            className="p-1.5 text-xs font-medium rounded-lg bg-neutral-800/80 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 transition"
            title="Subtitle visual styles & settings"
          >
            <Sliders className="w-4 h-4 text-neutral-300" />
          </button>

          <button
            onClick={onSave}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-500 hover:bg-amber-400 text-neutral-950 font-semibold transition flex items-center gap-1.5 shadow-sm shadow-amber-500/30"
            title="Save Project"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSaving ? 'Saving...' : 'Save'}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
