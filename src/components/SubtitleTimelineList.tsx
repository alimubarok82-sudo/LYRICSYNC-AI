import React, { useState } from 'react';
import {
  Play,
  Scissors,
  Merge,
  Trash2,
  Plus,
  Clock,
  Search,
  AlertCircle,
  Hash,
  ChevronDown,
  ChevronUp,
  FastForward,
  Rewind,
  BookOpen,
} from 'lucide-react';
import { SubtitleSegment, SubtitleContentType } from '../types/subtitle';
import { formatSRTTime, parseSRTTime } from '../utils/srt';
import { isRtlLanguage, formatQuranVerseSymbol, getLanguageName } from '../utils/languages';

interface SubtitleTimelineListProps {
  segments: SubtitleSegment[];
  activeSegmentId?: number;
  currentTime: number;
  selectedTranslationLanguage: string;
  originalLanguage: string;
  contentType: SubtitleContentType;
  onUpdateSegment: (segmentId: number, updates: Partial<SubtitleSegment>) => void;
  onSplitSegment: (segmentId: number, splitTime?: number) => void;
  onMergeWithNext: (segmentId: number) => void;
  onAddSegmentBelow: (segmentId: number) => void;
  onDeleteSegment: (segmentId: number) => void;
  onPlaySegment: (start: number) => void;
  onGlobalOffset: (deltaSeconds: number) => void;
  onAddFirstSegment: () => void;
}

export const SubtitleTimelineList: React.FC<SubtitleTimelineListProps> = ({
  segments,
  activeSegmentId,
  currentTime,
  selectedTranslationLanguage,
  originalLanguage,
  contentType,
  onUpdateSegment,
  onSplitSegment,
  onMergeWithNext,
  onAddSegmentBelow,
  onDeleteSegment,
  onPlaySegment,
  onGlobalOffset,
  onAddFirstSegment,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingWarningId, setEditingWarningId] = useState<number | null>(null);
  const [showHarakatToolbar, setShowHarakatToolbar] = useState(false);

  // Common Arabic Quranic diacritics / symbols for quick typing
  const ARABIC_HARAKAT = [
    { label: 'َ  (Fatḥah)', char: '\u064E' },
    { label: 'ِ  (Kasrah)', char: '\u0650' },
    { label: 'ُ  (Ḍammah)', char: '\u064F' },
    { label: 'ْ  (Sukūn)', char: '\u0652' },
    { label: 'ّ  (Shaddah)', char: '\u0651' },
    { label: 'ً  (Tanwīn Fath)', char: '\u064B' },
    { label: 'ٍ  (Tanwīn Kasr)', char: '\u064D' },
    { label: 'ٌ  (Tanwīn Damm)', char: '\u064C' },
    { label: 'ٰ  (Alif Khanjariyyah)', char: '\u0670' },
    { label: '۝ (Verse End)', char: '۝' },
  ];

  const filteredSegments = segments.filter((s) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const origMatch = s.original.toLowerCase().includes(q);
    const transMatch = Object.values(s.translations).some((t) =>
      t.toLowerCase().includes(q)
    );
    return origMatch || transMatch;
  });

  const nudgeTime = (
    segId: number,
    field: 'start' | 'end',
    deltaSeconds: number
  ) => {
    const seg = segments.find((s) => s.id === segId);
    if (!seg) return;
    const newVal = Math.max(0, Number((seg[field] + deltaSeconds).toFixed(3)));
    onUpdateSegment(segId, { [field]: newVal });
  };

  const setFromCurrentTime = (segId: number, field: 'start' | 'end') => {
    onUpdateSegment(segId, { [field]: Number(currentTime.toFixed(3)) });
  };

  const handleOriginalChange = (seg: SubtitleSegment, newText: string) => {
    if (seg.isAiGeneratedOriginal && editingWarningId !== seg.id) {
      setEditingWarningId(seg.id);
    }
    onUpdateSegment(seg.id, { original: newText });
  };

  const handleTranslationChange = (segId: number, newText: string) => {
    const seg = segments.find((s) => s.id === segId);
    if (!seg) return;
    const updated = {
      ...seg.translations,
      [selectedTranslationLanguage]: newText,
    };
    onUpdateSegment(segId, { translations: updated });
  };

  const handleInsertChar = (segId: number, char: string) => {
    const seg = segments.find((s) => s.id === segId);
    if (!seg) return;
    onUpdateSegment(segId, { original: seg.original + char });
  };

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl flex flex-col shadow-xl overflow-hidden">
      {/* List Header & Global Timing Offset (Section 54) */}
      <div className="bg-neutral-950/80 p-3 sm:p-4 border-b border-neutral-800 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-neutral-200 tracking-wider">
              SUBTITLE TIMELINE & EDITOR
            </span>
            <span className="px-2 py-0.5 rounded-full bg-neutral-800 text-amber-400 font-mono text-xs border border-neutral-700">
              {segments.length} segments
            </span>
          </div>

          {/* Search bar */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-500" />
              <input
                type="text"
                placeholder="Search lyrics or translation..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-neutral-900 border border-neutral-800 rounded-lg pl-8 pr-3 py-1 text-xs text-neutral-200 focus:outline-none focus:border-amber-500 w-44 sm:w-56"
              />
            </div>

            <button
              onClick={() => onAddSegmentBelow(segments.length > 0 ? segments[segments.length - 1].id : 0)}
              className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs flex items-center gap-1 transition shadow-sm"
              title="Add a new subtitle segment"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Add Subtitle</span>
            </button>
          </div>
        </div>

        {/* Global Timing Offset Controls */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-neutral-800/80 text-xs">
          <div className="flex items-center gap-1.5 text-neutral-400">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-semibold text-[11px]">GLOBAL OFFSET:</span>
          </div>

          <div className="flex items-center gap-1 flex-wrap">
            <button
              onClick={() => onGlobalOffset(-0.5)}
              className="px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-mono text-[11px] border border-neutral-700 transition"
              title="Shift all subtitle timestamps back by 500ms"
            >
              -500ms
            </button>
            <button
              onClick={() => onGlobalOffset(-0.1)}
              className="px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-mono text-[11px] border border-neutral-700 transition"
              title="Shift all subtitle timestamps back by 100ms"
            >
              -100ms
            </button>
            <button
              onClick={() => onGlobalOffset(0.1)}
              className="px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-mono text-[11px] border border-neutral-700 transition"
              title="Shift all subtitle timestamps forward by 100ms"
            >
              +100ms
            </button>
            <button
              onClick={() => onGlobalOffset(0.5)}
              className="px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-mono text-[11px] border border-neutral-700 transition"
              title="Shift all subtitle timestamps forward by 500ms"
            >
              +500ms
            </button>
          </div>

          {/* Quick Arabic Harakat Keyboard toggle */}
          {contentType === 'quran' || originalLanguage === 'ar' ? (
            <button
              onClick={() => setShowHarakatToolbar(!showHarakatToolbar)}
              className="text-[11px] text-amber-400 hover:text-amber-300 flex items-center gap-1 transition"
            >
              <span>{showHarakatToolbar ? 'Hide Harakat Bar' : 'Show Arabic Harakat Bar'}</span>
            </button>
          ) : null}
        </div>

        {/* Arabic Harakat Toolbar */}
        {showHarakatToolbar && (
          <div className="bg-neutral-900 border border-neutral-800 p-2 rounded-xl flex flex-wrap gap-1.5 items-center">
            <span className="text-[11px] text-neutral-400 font-mono mr-1">Insert:</span>
            {ARABIC_HARAKAT.map((h) => (
              <button
                key={h.char}
                onClick={() => {
                  if (activeSegmentId) handleInsertChar(activeSegmentId, h.char);
                  else if (segments.length > 0) handleInsertChar(segments[0].id, h.char);
                }}
                className="px-2 py-1 bg-neutral-950 hover:bg-neutral-800 text-amber-300 border border-neutral-800 rounded font-arabic text-sm transition"
                title={h.label}
              >
                {h.char}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Segment Cards List */}
      <div className="p-3 sm:p-4 space-y-3 max-h-[580px] overflow-y-auto">
        {filteredSegments.length === 0 ? (
          <div className="text-center py-12 text-neutral-500 text-sm">
            {segments.length === 0 ? (
              <div className="space-y-3 max-w-sm mx-auto">
                <div className="w-12 h-12 rounded-2xl bg-neutral-800/80 border border-neutral-700/80 flex items-center justify-center mx-auto text-amber-400">
                  <Clock className="w-6 h-6" />
                </div>
                <p className="text-neutral-300 font-medium">Belum ada lirik/subtitle.</p>
                <p className="text-xs text-neutral-500">
                  Gunakan tombol "+ Tambah Manual" di bawah, "Paste Lyrics" di menu atas, atau "Import SRT".
                </p>
                <div className="pt-2 flex items-center justify-center gap-2">
                  <button
                    onClick={onAddFirstSegment}
                    className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700 font-medium text-xs transition"
                  >
                    + Tambah Manual
                  </button>
                </div>
              </div>
            ) : (
              <p>Tidak ada subtitle yang cocok dengan pencarian "{searchQuery}".</p>
            )}
          </div>
        ) : (
          filteredSegments.map((seg, idx) => {
            const isActive =
              currentTime >= seg.start && currentTime <= seg.end;
            const isRtl = isRtlLanguage(originalLanguage, seg.original);

            return (
              <div
                key={seg.id}
                id={`seg-${seg.id}`}
                className={`bg-neutral-950 border rounded-xl p-3 sm:p-4 transition-all duration-200 ${
                  isActive
                    ? 'border-amber-500/80 shadow-lg shadow-amber-500/10 ring-1 ring-amber-500/30'
                    : 'border-neutral-800/80 hover:border-neutral-700'
                }`}
              >
                {/* Segment Header: Index, Timecodes, Nudges, Play button */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-neutral-800/80 text-xs">
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-mono font-bold px-2 py-0.5 rounded text-xs ${
                        isActive
                          ? 'bg-amber-500 text-neutral-950'
                          : 'bg-neutral-800 text-neutral-300'
                      }`}
                    >
                      #{String(seg.id).padStart(2, '0')}
                    </span>

                    <button
                      onClick={() => onPlaySegment(seg.start)}
                      className="p-1 rounded bg-neutral-800 hover:bg-neutral-700 text-amber-400 transition"
                      title="Play this segment"
                    >
                      <Play className="w-3 h-3 fill-amber-400" />
                    </button>

                    {contentType === 'quran' && (
                      <div className="flex items-center gap-1 ml-2">
                        <span className="text-[11px] text-neutral-500">Verse:</span>
                        <input
                          type="number"
                          value={seg.verseNumber || ''}
                          placeholder="—"
                          onChange={(e) =>
                            onUpdateSegment(seg.id, {
                              verseNumber: e.target.value
                                ? parseInt(e.target.value, 10)
                                : undefined,
                            })
                          }
                          className="w-12 bg-neutral-900 border border-neutral-800 rounded px-1.5 py-0.5 text-[11px] text-amber-300 font-mono text-center focus:outline-none focus:border-amber-500"
                        />
                      </div>
                    )}
                  </div>

                  {/* Timestamps and Nudge Controls */}
                  <div className="flex flex-wrap items-center gap-3">
                    {/* START TIMECODE */}
                    <div className="flex items-center gap-1 bg-neutral-900 p-1 rounded-lg border border-neutral-800">
                      <span className="text-[10px] text-neutral-500 font-mono uppercase pl-1">
                        Start
                      </span>
                      <input
                        type="text"
                        value={formatSRTTime(seg.start)}
                        onChange={(e) => {
                          const val = parseSRTTime(e.target.value);
                          onUpdateSegment(seg.id, { start: val });
                        }}
                        className="w-24 bg-transparent text-neutral-200 font-mono text-xs text-center focus:outline-none focus:text-amber-400"
                      />
                      <button
                        onClick={() => nudgeTime(seg.id, 'start', -0.1)}
                        className="px-1 text-[10px] text-neutral-400 hover:text-white"
                        title="-100ms start"
                      >
                        -
                      </button>
                      <button
                        onClick={() => nudgeTime(seg.id, 'start', 0.1)}
                        className="px-1 text-[10px] text-neutral-400 hover:text-white"
                        title="+100ms start"
                      >
                        +
                      </button>
                      <button
                        onClick={() => setFromCurrentTime(seg.id, 'start')}
                        className="px-1.5 py-0.5 rounded bg-neutral-800 text-[10px] text-amber-300 hover:bg-neutral-700"
                        title="Set start from current playhead time"
                      >
                        Playhead
                      </button>
                    </div>

                    {/* END TIMECODE */}
                    <div className="flex items-center gap-1 bg-neutral-900 p-1 rounded-lg border border-neutral-800">
                      <span className="text-[10px] text-neutral-500 font-mono uppercase pl-1">
                        End
                      </span>
                      <input
                        type="text"
                        value={formatSRTTime(seg.end)}
                        onChange={(e) => {
                          const val = parseSRTTime(e.target.value);
                          onUpdateSegment(seg.id, { end: val });
                        }}
                        className="w-24 bg-transparent text-neutral-200 font-mono text-xs text-center focus:outline-none focus:text-amber-400"
                      />
                      <button
                        onClick={() => nudgeTime(seg.id, 'end', -0.1)}
                        className="px-1 text-[10px] text-neutral-400 hover:text-white"
                        title="-100ms end"
                      >
                        -
                      </button>
                      <button
                        onClick={() => nudgeTime(seg.id, 'end', 0.1)}
                        className="px-1 text-[10px] text-neutral-400 hover:text-white"
                        title="+100ms end"
                      >
                        +
                      </button>
                      <button
                        onClick={() => setFromCurrentTime(seg.id, 'end')}
                        className="px-1.5 py-0.5 rounded bg-neutral-800 text-[10px] text-amber-300 hover:bg-neutral-700"
                        title="Set end from current playhead time"
                      >
                        Playhead
                      </button>
                    </div>
                  </div>
                </div>

                {/* AI Original text edit warning notice (Section 19) */}
                {editingWarningId === seg.id && (
                  <div className="mt-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                      <span>
                        You are editing the original text. This will not change the audio timestamps.
                      </span>
                    </div>
                    <button
                      onClick={() => setEditingWarningId(null)}
                      className="text-neutral-400 hover:text-white text-[11px] underline"
                    >
                      Dismiss
                    </button>
                  </div>
                )}

                {/* DUAL TEXT EDITORS */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                  {/* ORIGINAL TEXT LAYER */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-neutral-400">
                      <span className="font-semibold text-neutral-300 flex items-center gap-1">
                        LAYER 1: ORIGINAL TEXT ({getLanguageName(originalLanguage)})
                      </span>
                      {isRtl && (
                        <span className="text-[10px] bg-neutral-900 px-1.5 py-0.5 rounded text-amber-400/80">
                          RTL
                        </span>
                      )}
                    </div>
                    <textarea
                      rows={2}
                      dir={isRtl ? 'rtl' : 'ltr'}
                      value={seg.original}
                      onChange={(e) => handleOriginalChange(seg, e.target.value)}
                      placeholder="Enter original lyrics or speech text..."
                      className={`w-full bg-neutral-900 border border-neutral-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-amber-500 transition resize-none ${
                        isRtl ? 'font-arabic text-base' : 'text-sm'
                      }`}
                    />
                  </div>

                  {/* TRANSLATION TEXT LAYER */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-neutral-400">
                      <span className="font-semibold text-amber-300 flex items-center gap-1">
                        LAYER 2: TRANSLATION (
                        {getLanguageName(selectedTranslationLanguage).toUpperCase()})
                      </span>
                    </div>
                    <textarea
                      rows={2}
                      value={seg.translations[selectedTranslationLanguage] || ''}
                      onChange={(e) => handleTranslationChange(seg.id, e.target.value)}
                      placeholder={`Enter ${getLanguageName(
                        selectedTranslationLanguage
                      )} translation...`}
                      className="w-full bg-neutral-900 border border-neutral-800 rounded-lg p-2.5 text-amber-100 text-sm focus:outline-none focus:border-amber-500 transition resize-none"
                    />
                  </div>
                </div>

                {/* Subtitle Row Actions: Split, Merge, Add Below, Delete */}
                <div className="flex flex-wrap items-center justify-between gap-2 mt-3 pt-2 border-t border-neutral-800/80 text-xs text-neutral-400">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onSplitSegment(seg.id, currentTime)}
                      className="flex items-center gap-1 px-2 py-1 rounded bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-neutral-800 transition"
                      title="Split subtitle into two at current playhead or midpoint"
                    >
                      <Scissors className="w-3 h-3 text-amber-400" />
                      <span>Split</span>
                    </button>

                    {idx < filteredSegments.length - 1 && (
                      <button
                        onClick={() => onMergeWithNext(seg.id)}
                        className="flex items-center gap-1 px-2 py-1 rounded bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-neutral-800 transition"
                        title="Merge with next subtitle"
                      >
                        <Merge className="w-3 h-3 text-blue-400" />
                        <span>Merge Next</span>
                      </button>
                    )}

                    <button
                      onClick={() => onAddSegmentBelow(seg.id)}
                      className="flex items-center gap-1 px-2 py-1 rounded bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-neutral-800 transition"
                      title="Insert a new subtitle directly below this"
                    >
                      <Plus className="w-3 h-3 text-emerald-400" />
                      <span>Add Below</span>
                    </button>
                  </div>

                  <button
                    onClick={() => onDeleteSegment(seg.id)}
                    className="flex items-center gap-1 px-2 py-1 rounded hover:bg-red-500/10 text-neutral-500 hover:text-red-400 transition"
                    title="Delete this subtitle (automatically renumbers timeline)"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
