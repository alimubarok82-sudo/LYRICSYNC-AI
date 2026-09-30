export interface LanguageOption {
  code: string;
  name: string;
  nativeName: string;
  isRtl?: boolean;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', isRtl: true },
  { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia' },
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'ms', name: 'Malay', nativeName: 'Bahasa Melayu' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
  { code: 'de', name: 'German', nativeName: 'Deutsch' },
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe' },
  { code: 'ur', name: 'Urdu', nativeName: 'اردو', isRtl: true },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
  { code: 'fa', name: 'Persian', nativeName: 'فارسی', isRtl: true },
  { code: 'ja', name: 'Japanese', nativeName: '日本語' },
  { code: 'ko', name: 'Korean', nativeName: '한국어' },
  { code: 'zh', name: 'Chinese', nativeName: '中文' },
  { code: 'other', name: 'Other', nativeName: 'Other' },
];

export const ORIGINAL_LANGUAGES: { code: string; name: string }[] = [
  { code: 'auto', name: 'Auto Detect' },
  ...SUPPORTED_LANGUAGES.map((l) => ({ code: l.code, name: l.name })),
];

// Helper to check if a language code or text requires RTL rendering
export function isRtlLanguage(langCode: string, text?: string): boolean {
  if (['ar', 'ur', 'fa', 'he'].includes(langCode.toLowerCase())) {
    return true;
  }
  if (text) {
    // Check for Arabic/Hebrew unicode ranges
    const rtlRegex = /[\u0591-\u07FF\uFB1D-\uFDFD\uFE70-\uFEFC]/;
    return rtlRegex.test(text);
  }
  return false;
}

// Convert western numbers to Eastern Arabic numerals for Quran verses
export function toArabicNumerals(num: number): string {
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return num
    .toString()
    .split('')
    .map((d) => arabicDigits[parseInt(d, 10)] ?? d)
    .join('');
}

// Format verse number with Quranic symbol ۝ (U+06DD)
export function formatQuranVerseSymbol(verseNumber: number): string {
  return `۝${toArabicNumerals(verseNumber)}`;
}

export function getLanguageName(code: string): string {
  const found = SUPPORTED_LANGUAGES.find((l) => l.code === code);
  return found ? found.name : code.toUpperCase();
}
