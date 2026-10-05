export type SubtitleDisplayMode = 'original' | 'translation' | 'bilingual';
export type SubtitleContentType = 'song' | 'nasheed' | 'quran' | 'spoken';
export type SubtitlePosition = 'top' | 'center' | 'bottom';
export type SubtitleAlignment = 'left' | 'center' | 'right';
export type TextDirection = 'auto' | 'ltr' | 'rtl';

export interface SubtitleSegment {
  id: number;
  start: number; // In seconds with millisecond precision, e.g. 3.250
  end: number;   // In seconds with millisecond precision, e.g. 7.420
  original: string;
  translations: {
    [languageCode: string]: string;
  };
  verseNumber?: number;
  isAiGeneratedOriginal?: boolean;
}

export interface SubtitleStyleSettings {
  displayMode: SubtitleDisplayMode;
  selectedTranslationLanguage: string;
  originalFont: string;
  translationFont: string;
  originalFontSize: number;      // Desktop font size (e.g. 48px)
  translationFontSize: number;   // Desktop font size (e.g. 22px)
  originalWeight: string;        // '700'
  translationWeight: string;     // '600'
  originalColor: string;         // '#FFFFFF'
  translationColor: string;      // '#E6C86A'
  outline: boolean;
  shadow: boolean;
  lineSpacing: number;           // e.g. 12px
  position: SubtitlePosition;
  customPositionY?: number; // Custom vertical position in percentage (0 - 100%)
  alignment: SubtitleAlignment;
  direction: TextDirection;
  backgroundColor: 'black' | 'dark' | 'transparent' | 'custom';
  customBgColor?: string;
  backgroundImageUrl?: string | null;
  backgroundVideoUrl?: string | null;
  showVerseNumber: boolean;
  aspectRatio: '16:9' | '9:16' | 'cinema';
}

export interface SubtitleProject {
  id: string;
  title: string;
  contentType: SubtitleContentType;
  originalLanguage: string;
  availableTranslations: string[];
  audioDuration: number;
  audioFileName?: string;
  audioUrl?: string;
  videoUrl?: string;
  videoFileName?: string;
  segments: SubtitleSegment[];
  settings: SubtitleStyleSettings;
  updatedAt: number;
}

export interface ValidationIssue {
  type: 'error' | 'warning' | 'info';
  message: string;
  segmentId?: number;
}

export interface ValidationReport {
  isValid: boolean;
  totalSegments: number;
  issues: ValidationIssue[];
  missingTranslationsCount: number;
}
