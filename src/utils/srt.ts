import { SubtitleSegment, SubtitleDisplayMode, ValidationReport, ValidationIssue } from '../types/subtitle';
import { isRtlLanguage, formatQuranVerseSymbol } from './languages';

/**
 * Format seconds (e.g. 3.25) to standard SRT timestamp: HH:MM:SS,mmm
 */
export function formatSRTTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) seconds = 0;
  const totalMs = Math.round(seconds * 1000);
  const ms = totalMs % 1000;
  const totalSeconds = Math.floor(totalMs / 1000);
  const s = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const m = totalMinutes % 60;
  const h = Math.floor(totalMinutes / 60);

  const pad = (n: number, z = 2) => String(n).padStart(z, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms, 3)}`;
}

/**
 * Format seconds for player timecode display: MM:SS.mmm or HH:MM:SS.mmm
 */
export function formatPlayerTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) seconds = 0;
  const totalMs = Math.round(seconds * 1000);
  const ms = totalMs % 1000;
  const totalSeconds = Math.floor(totalMs / 1000);
  const s = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const m = totalMinutes % 60;
  const h = Math.floor(totalMinutes / 60);

  const pad = (n: number, z = 2) => String(n).padStart(z, '0');
  if (h > 0) {
    return `${pad(h)}:${pad(m)}:${pad(s)}.${pad(ms, 3)}`;
  }
  return `${pad(m)}:${pad(s)}.${pad(ms, 3)}`;
}

/**
 * Parse an SRT timestamp string (HH:MM:SS,mmm or HH:MM:SS.mmm) into seconds
 */
export function parseSRTTime(timeString: string): number {
  if (!timeString) return 0;
  const clean = timeString.trim().replace(',', '.');
  const parts = clean.split(':');
  if (parts.length === 3) {
    const hours = parseFloat(parts[0]);
    const minutes = parseFloat(parts[1]);
    const seconds = parseFloat(parts[2]);
    return hours * 3600 + minutes * 60 + seconds;
  }
  if (parts.length === 2) {
    const minutes = parseFloat(parts[0]);
    const seconds = parseFloat(parts[1]);
    return minutes * 60 + seconds;
  }
  const direct = parseFloat(clean);
  return isNaN(direct) ? 0 : direct;
}

/**
 * Generate standard SRT formatted text
 */
export function generateSRT(
  segments: SubtitleSegment[],
  mode: SubtitleDisplayMode = 'bilingual',
  translationLanguage = 'id',
  options: { showVerseNumber?: boolean } = {}
): string {
  if (!segments || segments.length === 0) return '';

  return segments
    .map((seg, index) => {
      const id = index + 1;
      const startTime = formatSRTTime(seg.start);
      const endTime = formatSRTTime(seg.end);
      const timecodeLine = `${startTime} --> ${endTime}`;

      let originalText = seg.original.trim();
      if (options.showVerseNumber && seg.verseNumber) {
        originalText += ` ${formatQuranVerseSymbol(seg.verseNumber)}`;
      }

      const translationText = (seg.translations[translationLanguage] || '').trim();

      let textBlock = '';
      if (mode === 'original') {
        textBlock = originalText;
      } else if (mode === 'translation') {
        textBlock = translationText || originalText; // fallback if empty
      } else {
        // Bilingual: Original first, translation second
        if (translationText) {
          textBlock = `${originalText}\n${translationText}`;
        } else {
          textBlock = originalText;
        }
      }

      return `${id}\n${timecodeLine}\n${textBlock}\n`;
    })
    .join('\n');
}

/**
 * Validate subtitle segments and timeline
 */
export function validateSubtitles(
  segments: SubtitleSegment[],
  mode: SubtitleDisplayMode = 'bilingual',
  translationLanguage = 'id',
  audioDuration = 0
): ValidationReport {
  const issues: ValidationIssue[] = [];
  let missingTranslationsCount = 0;

  if (segments.length === 0) {
    issues.push({
      type: 'warning',
      message: 'No subtitle segments found in the project.',
    });
    return { isValid: false, totalSegments: 0, issues, missingTranslationsCount: 0 };
  }

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const segId = seg.id;

    if (seg.start < 0) {
      issues.push({
        type: 'error',
        message: `Subtitle #${segId} start time cannot be negative (${seg.start.toFixed(3)}s).`,
        segmentId: segId,
      });
    }

    if (seg.end <= seg.start) {
      issues.push({
        type: 'error',
        message: `Subtitle #${segId} end time (${seg.end.toFixed(3)}s) must be greater than start time (${seg.start.toFixed(3)}s).`,
        segmentId: segId,
      });
    }

    if (audioDuration > 0 && seg.end > audioDuration + 1.0) {
      issues.push({
        type: 'warning',
        message: `Subtitle #${segId} end time (${seg.end.toFixed(3)}s) exceeds audio duration (${audioDuration.toFixed(3)}s).`,
        segmentId: segId,
      });
    }

    // Check chronological ordering and overlaps with previous segment
    if (i > 0) {
      const prev = segments[i - 1];
      if (seg.start < prev.start) {
        issues.push({
          type: 'error',
          message: `Subtitle #${segId} starts before previous subtitle #${prev.id}.`,
          segmentId: segId,
        });
      } else if (seg.start < prev.end - 0.05) {
        issues.push({
          type: 'warning',
          message: `Subtitle #${segId} overlaps with subtitle #${prev.id}.`,
          segmentId: segId,
        });
      }
    }

    // Empty text checks
    if (!seg.original.trim()) {
      issues.push({
        type: 'error',
        message: `Subtitle #${segId} has empty original text.`,
        segmentId: segId,
      });
    }

    // Missing translation check for bilingual mode
    if (mode === 'bilingual' || mode === 'translation') {
      const trans = seg.translations[translationLanguage];
      if (!trans || !trans.trim()) {
        missingTranslationsCount++;
        issues.push({
          type: 'warning',
          message: `Subtitle #${segId} is missing translation for selected language.`,
          segmentId: segId,
        });
      }
    }
  }

  const hasFatalErrors = issues.some((iss) => iss.type === 'error');

  return {
    isValid: !hasFatalErrors,
    totalSegments: segments.length,
    issues,
    missingTranslationsCount,
  };
}

/**
 * Parse an uploaded/pasted SRT file string into SubtitleSegment[]
 */
export function parseSRT(
  srtText: string,
  targetLangCode = 'id'
): { segments: SubtitleSegment[]; detectedBilingual: boolean } {
  const normalized = srtText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  const rawBlocks = normalized.split(/\n\s*\n/);
  const segments: SubtitleSegment[] = [];
  let detectedBilingual = false;

  let autoId = 1;

  for (const block of rawBlocks) {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) continue;

    let timeLineIndex = -1;
    for (let j = 0; j < lines.length; j++) {
      if (lines[j].includes('-->')) {
        timeLineIndex = j;
        break;
      }
    }

    if (timeLineIndex === -1) continue;

    const timeLine = lines[timeLineIndex];
    const [startPart, endPart] = timeLine.split('-->').map((s) => s.trim());
    const start = parseSRTTime(startPart);
    const end = parseSRTTime(endPart);

    const textLines = lines.slice(timeLineIndex + 1);
    if (textLines.length === 0) continue;

    let original = '';
    const translations: Record<string, string> = {};

    if (textLines.length >= 2) {
      const line1 = textLines[0];
      const line2 = textLines.slice(1).join(' ');

      // Check if line 1 looks like Arabic/RTL and line 2 looks like Latin/translation
      const line1IsRtl = isRtlLanguage('ar', line1);
      const line2IsRtl = isRtlLanguage('ar', line2);

      if (line1IsRtl && !line2IsRtl) {
        original = line1;
        translations[targetLangCode] = line2;
        detectedBilingual = true;
      } else {
        // Multi-line translation or bilingual: take line 1 as original, remainder as translation
        original = line1;
        translations[targetLangCode] = line2;
        detectedBilingual = true;
      }
    } else {
      original = textLines[0];
    }

    segments.push({
      id: autoId++,
      start,
      end,
      original,
      translations,
    });
  }

  return { segments, detectedBilingual };
}
