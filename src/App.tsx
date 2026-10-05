import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Header } from './components/Header';
import { SubtitlePreview } from './components/SubtitlePreview';
import { AudioPlayer } from './components/AudioPlayer';
import { LanguageManagerBar } from './components/LanguageManagerBar';
import { SubtitleTimelineList } from './components/SubtitleTimelineList';
import { SrtOutputPanel } from './components/SrtOutputPanel';
import { ImportSrtModal } from './components/ImportSrtModal';
import { PasteLyricsModal } from './components/PasteLyricsModal';
import { StyleSettingsModal } from './components/StyleSettingsModal';
import { ProjectsModal } from './components/ProjectsModal';
import { ApiKeyModal } from './components/ApiKeyModal';
import { ExportWebmModal } from './components/ExportWebmModal';

import {
  SubtitleProject,
  SubtitleSegment,
  SubtitleStyleSettings,
  SubtitleContentType,
} from './types/subtitle';
import { DEMO_PROJECT } from './utils/demoData';
import {
  saveCurrentProject,
  loadCurrentProject,
  getSavedProjectsList,
  UndoManager,
} from './utils/storage';
import { createDemoAudioTrack, optimizeAudioForAi } from './utils/audio';
import { aiSubtitleService } from './services/aiService';

export default function App() {
  // Initialize project state from localStorage or Demo
  const [project, setProject] = useState<SubtitleProject>(() => loadCurrentProject());
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isAnalyzingAudio, setIsAnalyzingAudio] = useState<boolean>(false);
  const [isTranslating, setIsTranslating] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Active view tab: 'editor' or 'srt'
  const [activeTab, setActiveTab] = useState<'editor' | 'srt'>('editor');

  // Modals state
  const [isImportSrtOpen, setIsImportSrtOpen] = useState(false);
  const [isPasteLyricsOpen, setIsPasteLyricsOpen] = useState(false);
  const [isStyleSettingsOpen, setIsStyleSettingsOpen] = useState(false);
  const [isProjectsOpen, setIsProjectsOpen] = useState(false);
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const [isExportWebmOpen, setIsExportWebmOpen] = useState(false);

  // Undo / Redo Manager instance
  const undoManagerRef = useRef<UndoManager<SubtitleSegment[]>>(
    new UndoManager<SubtitleSegment[]>(project.segments)
  );
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Synchronize undo stack state
  const updateUndoRedoFlags = useCallback(() => {
    setCanUndo(undoManagerRef.current.canUndo());
    setCanRedo(undoManagerRef.current.canRedo());
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3200);
  };

  // Generate / initialize demo audio track if no audioUrl exists
  useEffect(() => {
    if (!project.audioUrl) {
      createDemoAudioTrack(project.audioDuration || 43.5).then((url) => {
        setProject((prev) => ({ ...prev, audioUrl: url }));
      });
    }
  }, []);

  // Set segments helper with undo registration and sequential renumbering
  const setSegmentsWithHistory = useCallback(
    (newSegments: SubtitleSegment[], recordHistory = true) => {
      // Renumber sequentially 1..N
      const renumbered = newSegments.map((seg, idx) => ({
        ...seg,
        id: idx + 1,
      }));

      if (recordHistory) {
        undoManagerRef.current.push(renumbered);
        updateUndoRedoFlags();
      }

      setProject((prev) => ({
        ...prev,
        segments: renumbered,
        updatedAt: Date.now(),
      }));
    },
    [updateUndoRedoFlags]
  );

  // Undo handler
  const handleUndo = useCallback(() => {
    const prevState = undoManagerRef.current.undo();
    if (prevState) {
      setProject((prev) => ({
        ...prev,
        segments: prevState,
        updatedAt: Date.now(),
      }));
      updateUndoRedoFlags();
      showToast('Undo performed');
    }
  }, [updateUndoRedoFlags]);

  // Redo handler
  const handleRedo = useCallback(() => {
    const nextState = undoManagerRef.current.redo();
    if (nextState) {
      setProject((prev) => ({
        ...prev,
        segments: nextState,
        updatedAt: Date.now(),
      }));
      updateUndoRedoFlags();
      showToast('Redo performed');
    }
  }, [updateUndoRedoFlags]);

  // Keyboard shortcuts (Space, ArrowLeft, ArrowRight, Ctrl+Z, Ctrl+Shift+Z, S, M)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore shortcuts while user is typing in inputs or textareas
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;

      // Undo / Redo shortcuts (work even in inputs if Ctrl/Cmd is held)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          e.preventDefault();
          handleRedo();
        } else {
          e.preventDefault();
          handleUndo();
        }
        return;
      }

      if (isInput) return;

      // S: Split current active subtitle
      if (e.key.toLowerCase() === 's') {
        const active = project.segments.find(
          (s) => currentTime >= s.start && currentTime <= s.end
        );
        if (active) {
          e.preventDefault();
          handleSplitSegment(active.id, currentTime);
        }
      }

      // M: Merge active subtitle with next
      if (e.key.toLowerCase() === 'm') {
        const active = project.segments.find(
          (s) => currentTime >= s.start && currentTime <= s.end
        );
        if (active) {
          e.preventDefault();
          handleMergeWithNext(active.id);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [project.segments, currentTime, handleUndo, handleRedo]);

  // Update a single subtitle segment
  const handleUpdateSegment = (
    segmentId: number,
    updates: Partial<SubtitleSegment>
  ) => {
    const updated = project.segments.map((seg) =>
      seg.id === segmentId ? { ...seg, ...updates } : seg
    );
    setSegmentsWithHistory(updated, true);
  };

  // Split Subtitle (Section 21)
  const handleSplitSegment = (segmentId: number, splitTime?: number) => {
    const targetIdx = project.segments.findIndex((s) => s.id === segmentId);
    if (targetIdx === -1) return;

    const seg = project.segments[targetIdx];
    const midTime = Number(((seg.start + seg.end) / 2).toFixed(3));
    const effectiveSplitTime =
      splitTime && splitTime > seg.start + 0.3 && splitTime < seg.end - 0.3
        ? Number(splitTime.toFixed(3))
        : midTime;

    // Split original text into two halves
    const origWords = seg.original.trim().split(/\s+/);
    const midOrigWordIdx = Math.max(1, Math.floor(origWords.length / 2));
    const orig1 = origWords.slice(0, midOrigWordIdx).join(' ');
    const orig2 = origWords.slice(midOrigWordIdx).join(' ') || origWords.slice(0, midOrigWordIdx).join(' ');

    // Split translations for each language
    const trans1: Record<string, string> = {};
    const trans2: Record<string, string> = {};

    for (const [lang, text] of Object.entries(seg.translations)) {
      const words = (text || '').trim().split(/\s+/);
      const midIdx = Math.max(1, Math.floor(words.length / 2));
      trans1[lang] = words.slice(0, midIdx).join(' ');
      trans2[lang] = words.slice(midIdx).join(' ') || trans1[lang];
    }

    const firstSeg: SubtitleSegment = {
      ...seg,
      end: effectiveSplitTime,
      original: orig1,
      translations: trans1,
    };

    const secondSeg: SubtitleSegment = {
      ...seg,
      id: seg.id + 1,
      start: effectiveSplitTime,
      end: seg.end,
      original: orig2,
      translations: trans2,
    };

    const newSegments = [...project.segments];
    newSegments.splice(targetIdx, 1, firstSeg, secondSeg);
    setSegmentsWithHistory(newSegments, true);
    showToast(`Split subtitle #${segmentId} into two segments`);
  };

  // Merge Subtitle with next (Section 22)
  const handleMergeWithNext = (segmentId: number) => {
    const targetIdx = project.segments.findIndex((s) => s.id === segmentId);
    if (targetIdx === -1 || targetIdx >= project.segments.length - 1) return;

    const segA = project.segments[targetIdx];
    const segB = project.segments[targetIdx + 1];

    const mergedOriginal = `${segA.original.trim()} ${segB.original.trim()}`;

    // Combine translations for every available language
    const mergedTranslations: Record<string, string> = {};
    const allLangs = new Set([
      ...Object.keys(segA.translations),
      ...Object.keys(segB.translations),
    ]);

    for (const lang of allLangs) {
      const tA = segA.translations[lang] || '';
      const tB = segB.translations[lang] || '';
      mergedTranslations[lang] = [tA, tB].filter(Boolean).join(' ').trim();
    }

    const mergedSeg: SubtitleSegment = {
      ...segA,
      end: segB.end,
      original: mergedOriginal,
      translations: mergedTranslations,
    };

    const newSegments = [...project.segments];
    newSegments.splice(targetIdx, 2, mergedSeg);
    setSegmentsWithHistory(newSegments, true);
    showToast(`Merged subtitle #${segmentId} and #${segmentId + 1}`);
  };

  // Add a new subtitle directly below (Section 23)
  const handleAddSegmentBelow = (segmentId: number) => {
    const targetIdx = project.segments.findIndex((s) => s.id === segmentId);
    const prevSeg = targetIdx >= 0 ? project.segments[targetIdx] : null;

    const start = prevSeg ? Number((prevSeg.end + 0.1).toFixed(3)) : 0;
    const end = Number((start + 4.0).toFixed(3));

    const newSeg: SubtitleSegment = {
      id: 9999, // will be renumbered
      start,
      end,
      original: 'New lyric phrase',
      translations: {},
    };

    const newSegments = [...project.segments];
    if (targetIdx >= 0) {
      newSegments.splice(targetIdx + 1, 0, newSeg);
    } else {
      newSegments.push(newSeg);
    }

    setSegmentsWithHistory(newSegments, true);
    showToast('Added new subtitle segment');
  };

  // Delete Subtitle and auto-renumber (Section 23)
  const handleDeleteSegment = (segmentId: number) => {
    const filtered = project.segments.filter((s) => s.id !== segmentId);
    setSegmentsWithHistory(filtered, true);
    showToast(`Deleted subtitle #${segmentId}`);
  };

  // Global Timing Offset (Section 54)
  const handleGlobalOffset = (deltaSeconds: number) => {
    const adjusted = project.segments.map((seg) => ({
      ...seg,
      start: Math.max(0, Number((seg.start + deltaSeconds).toFixed(3))),
      end: Math.max(0.1, Number((seg.end + deltaSeconds).toFixed(3))),
    }));
    setSegmentsWithHistory(adjusted, true);
    showToast(
      `Shifted timeline by ${deltaSeconds > 0 ? '+' : ''}${Math.round(
        deltaSeconds * 1000
      )}ms`
    );
  };

  // Audio/Video upload handler: loads media for playback & timeline and automatically detects video backdrops
  const handleAudioUpload = async (file: File) => {
    try {
      const url = URL.createObjectURL(file);
      const isVideo =
        file.type.startsWith('video/') ||
        file.name.endsWith('.mp4') ||
        file.name.endsWith('.webm') ||
        file.name.endsWith('.mov') ||
        file.name.endsWith('.mkv');

      setProject((prev) => ({
        ...prev,
        audioUrl: url,
        audioFileName: file.name,
        videoUrl: isVideo ? url : prev.videoUrl,
        videoFileName: isVideo ? file.name : prev.videoFileName,
        settings: {
          ...prev.settings,
          backgroundVideoUrl: isVideo ? url : prev.settings.backgroundVideoUrl,
        },
      }));

      if (isVideo) {
        showToast(`Video dimuat: ${file.name}. Audio dan latar video aktif!`);
      } else {
        showToast(`Audio berhasil dimuat: ${file.name}`);
      }
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Gagal memuat media');
    }
  };

  // AI Lyrics Detect & Alignment
  const handleAnalyzeAudio = async () => {
    try {
      setIsAnalyzingAudio(true);
      showToast('AI menganalisis frase audio dan menyinkronkan lirik...');

      let base64Audio: string | undefined;
      let mimeType: string | undefined;

      if (project.audioUrl) {
        try {
          const res = await fetch(project.audioUrl);
          const blob = await res.blob();
          const optimized = await optimizeAudioForAi(blob);
          base64Audio = optimized.base64;
          mimeType = optimized.mimeType;
        } catch (e) {
          console.warn('Could not read audio blob directly:', e);
        }
      }

      const response = await aiSubtitleService.transcribe({
        audioBase64: base64Audio,
        audioMimeType: mimeType,
        duration: project.audioDuration || 60,
        contentType: project.contentType,
        originalLanguage: project.originalLanguage,
      });

      if (response.segments && response.segments.length > 0) {
        const mappedSegments: SubtitleSegment[] = response.segments.map((s, idx) => ({
          id: idx + 1,
          start: s.start,
          end: s.end,
          original: s.original,
          verseNumber: s.verseNumber,
          translations: {},
          isAiGeneratedOriginal: true,
        }));

        setSegmentsWithHistory(mappedSegments, true);
        if (response.detectedLanguage && project.originalLanguage === 'auto') {
          setProject((prev) => ({
            ...prev,
            originalLanguage: response.detectedLanguage!,
          }));
        }
        showToast(`AI transcribed ${mappedSegments.length} vocal segments!`);
      }
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'AI transcription failed');
    } finally {
      setIsAnalyzingAudio(false);
    }
  };

  // Align pasted authoritative lyrics (Section 8 & 38)
  const handleAlignPastedLyrics = async (lyrics: string) => {
    try {
      setIsAnalyzingAudio(true);
      showToast('Aligning your authoritative lyrics to timestamps...');

      const response = await aiSubtitleService.transcribe({
        userSuppliedLyrics: lyrics,
        duration: project.audioDuration || 60,
        contentType: project.contentType,
        originalLanguage: project.originalLanguage,
      });

      if (response.segments && response.segments.length > 0) {
        const mappedSegments: SubtitleSegment[] = response.segments.map((s, idx) => ({
          id: idx + 1,
          start: s.start,
          end: s.end,
          original: s.original,
          verseNumber: s.verseNumber,
          translations: {},
          isAiGeneratedOriginal: false, // Authoritative user text!
        }));

        setSegmentsWithHistory(mappedSegments, true);
        showToast(`Aligned ${mappedSegments.length} authoritative lyric lines!`);
      }
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Alignment failed');
    } finally {
      setIsAnalyzingAudio(false);
    }
  };

  // AI Translation for a specific language (Section 24)
  const handleTranslateLanguage = async (
    targetLang: string,
    forceReplace = false
  ) => {
    try {
      setIsTranslating(true);
      showToast(`AI translating to ${targetLang.toUpperCase()}...`);

      const response = await aiSubtitleService.translate({
        segments: project.segments.map((s) => ({
          id: s.id,
          original: s.original,
          verseNumber: s.verseNumber,
        })),
        targetLanguage: targetLang,
        sourceLanguage: project.originalLanguage,
        contentType: project.contentType,
      });

      const updated = project.segments.map((seg) => {
        const existing = seg.translations[targetLang];
        const newTrans = response.translations[seg.id];
        if (newTrans) {
          if (!existing || forceReplace) {
            return {
              ...seg,
              translations: { ...seg.translations, [targetLang]: newTrans },
            };
          }
        }
        return seg;
      });

      setSegmentsWithHistory(updated, true);
      showToast(`Generated ${targetLang.toUpperCase()} translations!`);
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Translation failed');
    } finally {
      setIsTranslating(false);
    }
  };

  // AI Translate All Languages (Section 25)
  const handleTranslateAllLanguages = async () => {
    try {
      setIsTranslating(true);
      showToast('AI translating all configured languages in parallel...');

      const response = await aiSubtitleService.translateAll({
        segments: project.segments.map((s) => ({
          id: s.id,
          original: s.original,
          verseNumber: s.verseNumber,
        })),
        targetLanguages: project.availableTranslations,
        sourceLanguage: project.originalLanguage,
        contentType: project.contentType,
      });

      const updated = project.segments.map((seg) => {
        const currentTrans = { ...seg.translations };
        for (const [lang, langMap] of Object.entries(response.results)) {
          if (langMap[seg.id]) {
            currentTrans[lang] = langMap[seg.id];
          }
        }
        return {
          ...seg,
          translations: currentTrans,
        };
      });

      setSegmentsWithHistory(updated, true);
      showToast('All language translations synchronized!');
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Translate all failed');
    } finally {
      setIsTranslating(false);
    }
  };

  // Import SRT handler (Section 37)
  const handleImportSRT = (
    importedSegments: SubtitleSegment[],
    detectedBilingual: boolean
  ) => {
    setSegmentsWithHistory(importedSegments, true);
    if (detectedBilingual) {
      // Ensure target translation language is present in availableTranslations
      if (
        !project.availableTranslations.includes(
          project.settings.selectedTranslationLanguage
        )
      ) {
        setProject((prev) => ({
          ...prev,
          availableTranslations: [
            ...prev.availableTranslations,
            prev.settings.selectedTranslationLanguage,
          ],
        }));
      }
    }
    showToast(
      `Imported ${importedSegments.length} segments from SRT successfully!`
    );
  };

  // Save Project
  const handleSave = () => {
    setIsSaving(true);
    saveCurrentProject(project);
    setTimeout(() => {
      setIsSaving(false);
      showToast('Project saved successfully!');
    }, 300);
  };

  // Load Demo Project (Section 66)
  const handleLoadDemo = async () => {
    const demoAudio = await createDemoAudioTrack(DEMO_PROJECT.audioDuration);
    const freshDemo: SubtitleProject = {
      ...DEMO_PROJECT,
      audioUrl: demoAudio,
      updatedAt: Date.now(),
    };
    setProject(freshDemo);
    undoManagerRef.current = new UndoManager<SubtitleSegment[]>(
      freshDemo.segments
    );
    updateUndoRedoFlags();
    setCurrentTime(0);
    showToast('Loaded demo project!');
  };

  // Create Blank Project
  const handleNewProject = () => {
    const blank: SubtitleProject = {
      id: `project-${Date.now()}`,
      title: '',
      contentType: 'song',
      originalLanguage: 'auto',
      availableTranslations: ['id', 'en'],
      audioDuration: 60,
      segments: [
        {
          id: 1,
          start: 0,
          end: 4.5,
          original: 'First subtitle phrase',
          translations: {
            id: 'Frasa lirik pertama',
            en: 'First subtitle phrase',
          },
        },
      ],
      settings: {
        ...project.settings,
        displayMode: 'bilingual',
        selectedTranslationLanguage: 'id',
      },
      updatedAt: Date.now(),
    };
    setProject(blank);
    undoManagerRef.current = new UndoManager<SubtitleSegment[]>(blank.segments);
    updateUndoRedoFlags();
    setCurrentTime(0);
    showToast('Created new blank project');
  };

  // Check if active language already has translations
  const hasExistingTranslationsForSelected = project.segments.some(
    (s) => !!s.translations[project.settings.selectedTranslationLanguage]?.trim()
  );

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-neutral-900 border border-amber-500/50 text-amber-300 text-xs font-semibold px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 animate-bounce">
          <span className="w-2 h-2 rounded-full bg-amber-400"></span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <Header
        contentType={project.contentType}
        onContentTypeChange={(type) =>
          setProject((prev) => ({ ...prev, contentType: type }))
        }
        onNewProject={handleNewProject}
        onImportSrt={() => setIsImportSrtOpen(true)}
        onPasteLyrics={() => setIsPasteLyricsOpen(true)}
        onLoadDemo={handleLoadDemo}
        onOpenProjects={() => setIsProjectsOpen(true)}
        onOpenSettings={() => setIsStyleSettingsOpen(true)}
        onOpenApiKeyModal={() => setIsApiKeyModalOpen(true)}
        onSave={handleSave}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={handleUndo}
        onRedo={handleRedo}
        isSaving={isSaving}
      />

      {/* Main Studio Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-5 lg:p-6 space-y-5">
        {/* Project Title Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-1">
          <input
            type="text"
            value={project.title}
            onChange={(e) =>
              setProject((prev) => ({ ...prev, title: e.target.value }))
            }
            placeholder="Project Title..."
            className="bg-transparent text-lg sm:text-xl font-extrabold text-white border-b border-transparent hover:border-neutral-800 focus:border-amber-500 focus:outline-none px-1 py-0.5 max-w-md w-full transition"
          />

          {/* Studio Tab Switcher: Subtitle Editor vs SRT Output */}
          <div className="flex items-center bg-neutral-900 p-1 rounded-xl border border-neutral-800 text-xs">
            <button
              onClick={() => setActiveTab('editor')}
              className={`px-3 py-1.5 rounded-lg font-bold transition ${
                activeTab === 'editor'
                  ? 'bg-amber-500 text-neutral-950 shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Subtitle Timeline Editor
            </button>
            <button
              onClick={() => setActiveTab('srt')}
              className={`px-3 py-1.5 rounded-lg font-bold transition ${
                activeTab === 'srt'
                  ? 'bg-amber-500 text-neutral-950 shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              SRT Engine & Export
            </button>
          </div>
        </div>

        {/* TOP SECTION: Cinematic Subtitle Preview */}
        <SubtitlePreview
          currentTime={currentTime}
          segments={project.segments}
          settings={project.settings}
          availableTranslations={project.availableTranslations}
          originalLanguage={project.originalLanguage}
          videoUrl={project.videoUrl}
          onUpdateSettings={(updates) =>
            setProject((prev) => ({
              ...prev,
              settings: { ...prev.settings, ...updates },
            }))
          }
          onSelectSegment={(segId) => {
            const el = document.getElementById(`seg-${segId}`);
            if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
          }}
          onExportWebm={() => setIsExportWebmOpen(true)}
        />

        {/* MIDDLE SECTION: Audio Player & Waveform Timeline */}
        <AudioPlayer
          audioUrl={project.audioUrl}
          audioFileName={project.audioFileName}
          duration={project.audioDuration}
          currentTime={currentTime}
          segments={project.segments}
          onTimeUpdate={(t) => setCurrentTime(t)}
          onDurationChange={(d) =>
            setProject((prev) => ({ ...prev, audioDuration: d }))
          }
          onAudioUpload={handleAudioUpload}
          onSelectSegment={(segId) => {
            const el = document.getElementById(`seg-${segId}`);
            if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
          }}
          onAnalyzeAudio={handleAnalyzeAudio}
          isAnalyzing={isAnalyzingAudio}
        />

        {/* MULTILINGUAL LANGUAGE MANAGEMENT BAR */}
        <LanguageManagerBar
          originalLanguage={project.originalLanguage}
          selectedTranslationLanguage={project.settings.selectedTranslationLanguage}
          availableTranslations={project.availableTranslations}
          onOriginalLanguageChange={(lang) =>
            setProject((prev) => ({ ...prev, originalLanguage: lang }))
          }
          onSelectTranslationLanguage={(lang) =>
            setProject((prev) => ({
              ...prev,
              settings: { ...prev.settings, selectedTranslationLanguage: lang },
            }))
          }
          onAddTranslationLanguage={(lang) => {
            if (!project.availableTranslations.includes(lang)) {
              setProject((prev) => ({
                ...prev,
                availableTranslations: [...prev.availableTranslations, lang],
                settings: { ...prev.settings, selectedTranslationLanguage: lang },
              }));
              showToast(`Added ${lang.toUpperCase()} translation layer!`);
            }
          }}
          onRemoveTranslationLanguage={(lang) => {
            const remaining = project.availableTranslations.filter(
              (l) => l !== lang
            );
            if (remaining.length > 0) {
              setProject((prev) => ({
                ...prev,
                availableTranslations: remaining,
                settings: {
                  ...prev.settings,
                  selectedTranslationLanguage:
                    prev.settings.selectedTranslationLanguage === lang
                      ? remaining[0]
                      : prev.settings.selectedTranslationLanguage,
                },
              }));
            }
          }}
          onTranslateLanguage={handleTranslateLanguage}
          onTranslateAllLanguages={handleTranslateAllLanguages}
          isTranslating={isTranslating}
          hasExistingTranslations={hasExistingTranslationsForSelected}
        />

        {/* BOTTOM SECTION: Active Tab (Editor vs SRT Preview) */}
        {activeTab === 'editor' ? (
          <SubtitleTimelineList
            segments={project.segments}
            activeSegmentId={
              project.segments.find(
                (s) => currentTime >= s.start && currentTime <= s.end
              )?.id
            }
            currentTime={currentTime}
            selectedTranslationLanguage={
              project.settings.selectedTranslationLanguage
            }
            originalLanguage={project.originalLanguage}
            contentType={project.contentType}
            onUpdateSegment={handleUpdateSegment}
            onSplitSegment={handleSplitSegment}
            onMergeWithNext={handleMergeWithNext}
            onAddSegmentBelow={handleAddSegmentBelow}
            onDeleteSegment={handleDeleteSegment}
            onPlaySegment={(start) => setCurrentTime(start)}
            onGlobalOffset={handleGlobalOffset}
            onAddFirstSegment={() => handleAddSegmentBelow(0)}
          />
        ) : (
          <SrtOutputPanel
            segments={project.segments}
            availableTranslations={project.availableTranslations}
            selectedTranslationLanguage={
              project.settings.selectedTranslationLanguage
            }
            originalLanguage={project.originalLanguage}
            projectTitle={project.title}
            audioDuration={project.audioDuration}
            showVerseNumber={project.settings.showVerseNumber}
            onSelectTranslationLanguage={(lang) =>
              setProject((prev) => ({
                ...prev,
                settings: {
                  ...prev.settings,
                  selectedTranslationLanguage: lang,
                },
              }))
            }
            onTranslateMissing={() =>
              handleTranslateLanguage(
                project.settings.selectedTranslationLanguage,
                false
              )
            }
            onExportWebm={() => setIsExportWebmOpen(true)}
          />
        )}
      </main>

      {/* MODALS */}
      <ImportSrtModal
        isOpen={isImportSrtOpen}
        onClose={() => setIsImportSrtOpen(false)}
        onImport={handleImportSRT}
        targetLangCode={project.settings.selectedTranslationLanguage}
      />

      <PasteLyricsModal
        isOpen={isPasteLyricsOpen}
        onClose={() => setIsPasteLyricsOpen(false)}
        onAlignLyrics={handleAlignPastedLyrics}
        isAligning={isAnalyzingAudio}
      />

      <StyleSettingsModal
        isOpen={isStyleSettingsOpen}
        onClose={() => setIsStyleSettingsOpen(false)}
        settings={project.settings}
        onUpdateSettings={(updates) =>
          setProject((prev) => ({
            ...prev,
            settings: { ...prev.settings, ...updates },
          }))
        }
      />

      <ProjectsModal
        isOpen={isProjectsOpen}
        onClose={() => setIsProjectsOpen(false)}
        savedProjects={getSavedProjectsList()}
        onLoadProject={(id) => {
          showToast(`Loaded project #${id}`);
        }}
        onNewProject={handleNewProject}
        onLoadDemo={handleLoadDemo}
      />

      <ApiKeyModal
        isOpen={isApiKeyModalOpen}
        onClose={() => setIsApiKeyModalOpen(false)}
        onApiKeySaved={(key) => {
          if (key) {
            showToast('Kunci Gemini API pribadi berhasil disimpan!');
          } else {
            showToast('Menggunakan kunci server bawaan.');
          }
        }}
      />

      <ExportWebmModal
        isOpen={isExportWebmOpen}
        onClose={() => setIsExportWebmOpen(false)}
        project={project}
      />
    </div>
  );
}
