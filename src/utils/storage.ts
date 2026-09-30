import { SubtitleProject, SubtitleSegment } from '../types/subtitle';
import { DEMO_PROJECT } from './demoData';

const CURRENT_PROJECT_KEY = 'lyricsync_current_project';
const SAVED_PROJECTS_LIST_KEY = 'lyricsync_saved_projects_list';

export function saveCurrentProject(project: SubtitleProject): void {
  try {
    // Avoid storing huge blob/data URLs in localStorage to prevent quota exhaustion
    const projectToStore = {
      ...project,
      audioUrl: project.audioUrl?.startsWith('blob:') ? undefined : project.audioUrl,
      updatedAt: Date.now(),
    };
    localStorage.setItem(CURRENT_PROJECT_KEY, JSON.stringify(projectToStore));

    // Also update saved projects list index
    const listRaw = localStorage.getItem(SAVED_PROJECTS_LIST_KEY);
    let list: Array<{ id: string; title: string; updatedAt: number; segmentCount: number }> = [];
    if (listRaw) {
      try {
        list = JSON.parse(listRaw);
      } catch {
        list = [];
      }
    }
    const existingIdx = list.findIndex((p) => p.id === project.id);
    const summary = {
      id: project.id,
      title: project.title,
      updatedAt: Date.now(),
      segmentCount: project.segments.length,
    };
    if (existingIdx >= 0) {
      list[existingIdx] = summary;
    } else {
      list.unshift(summary);
    }
    localStorage.setItem(SAVED_PROJECTS_LIST_KEY, JSON.stringify(list));
  } catch (err) {
    console.warn('Failed to save project to localStorage:', err);
  }
}

export function loadCurrentProject(): SubtitleProject {
  try {
    const raw = localStorage.getItem(CURRENT_PROJECT_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.segments)) {
        // If it was the old initial demo data before audio upload, reset to clean state
        if (
          parsed.id === 'demo-quran-surah-baqarah' ||
          parsed.audioFileName === 'Surah_Al_Baqarah_Recitation.mp3' ||
          parsed.segments.some((s: any) => s.verseNumber === 17)
        ) {
          localStorage.removeItem(CURRENT_PROJECT_KEY);
          return DEMO_PROJECT;
        }
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Failed to load current project from localStorage:', err);
  }
  return DEMO_PROJECT;
}

export function getSavedProjectsList(): Array<{
  id: string;
  title: string;
  updatedAt: number;
  segmentCount: number;
}> {
  try {
    const raw = localStorage.getItem(SAVED_PROJECTS_LIST_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn('Failed to get saved projects list:', err);
  }
  return [
    {
      id: DEMO_PROJECT.id,
      title: DEMO_PROJECT.title,
      updatedAt: DEMO_PROJECT.updatedAt,
      segmentCount: DEMO_PROJECT.segments.length,
    },
  ];
}

/**
 * Undo/Redo stack manager for segments
 */
export class UndoManager<T> {
  private past: T[] = [];
  private future: T[] = [];
  private current: T;

  constructor(initial: T) {
    this.current = JSON.parse(JSON.stringify(initial));
  }

  public get state(): T {
    return this.current;
  }

  public push(newState: T): void {
    // Only push if meaningfully different
    const currentJson = JSON.stringify(this.current);
    const newJson = JSON.stringify(newState);
    if (currentJson === newJson) return;

    this.past.push(JSON.parse(currentJson));
    if (this.past.length > 50) {
      this.past.shift();
    }
    this.current = JSON.parse(newJson);
    this.future = [];
  }

  public canUndo(): boolean {
    return this.past.length > 0;
  }

  public canRedo(): boolean {
    return this.future.length > 0;
  }

  public undo(): T | null {
    if (!this.canUndo()) return null;
    const prev = this.past.pop()!;
    this.future.push(this.current);
    this.current = prev;
    return JSON.parse(JSON.stringify(this.current));
  }

  public redo(): T | null {
    if (!this.canRedo()) return null;
    const next = this.future.pop()!;
    this.past.push(this.current);
    this.current = next;
    return JSON.parse(JSON.stringify(this.current));
  }
}
