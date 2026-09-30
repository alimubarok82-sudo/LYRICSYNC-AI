import { SubtitleSegment } from '../types/subtitle';

export interface TranscriptionRequest {
  audioBase64?: string;
  audioMimeType?: string;
  duration?: number;
  userSuppliedLyrics?: string;
  contentType: 'song' | 'nasheed' | 'quran' | 'spoken';
  originalLanguage?: string;
}

export interface TranscriptionResponse {
  segments: Array<{
    id: number;
    start: number;
    end: number;
    original: string;
    verseNumber?: number;
  }>;
  detectedLanguage?: string;
}

export interface TranslationRequest {
  segments: Array<{
    id: number;
    original: string;
    verseNumber?: number;
  }>;
  targetLanguage: string;
  sourceLanguage?: string;
  contentType: 'song' | 'nasheed' | 'quran' | 'spoken';
}

export interface TranslationResponse {
  translations: Record<number, string>;
  targetLanguage: string;
}

export interface TranslateAllRequest {
  segments: Array<{
    id: number;
    original: string;
    verseNumber?: number;
  }>;
  targetLanguages: string[];
  sourceLanguage?: string;
  contentType: 'song' | 'nasheed' | 'quran' | 'spoken';
}

export interface TranslateAllResponse {
  results: Record<string, Record<number, string>>;
}

export interface ResyncRequest {
  segments: Array<{
    id: number;
    start: number;
    end: number;
    original: string;
  }>;
  audioDuration: number;
  contentType: string;
}

export interface ResyncResponse {
  segments: Array<{
    id: number;
    start: number;
    end: number;
  }>;
}

/**
 * Provider-Agnostic Transcription Interface
 */
export interface ITranscriptionProvider {
  name: string;
  transcribe(request: TranscriptionRequest): Promise<TranscriptionResponse>;
}

/**
 * Provider-Agnostic Translation Interface
 */
export interface ITranslationProvider {
  name: string;
  translate(request: TranslationRequest): Promise<TranslationResponse>;
  translateAll(request: TranslateAllRequest): Promise<TranslateAllResponse>;
}

async function handleApiResponse(res: Response, fallbackActionName: string) {
  const contentType = res.headers.get('content-type') || '';
  let responseBody: any = null;

  try {
    const rawText = await res.text();
    try {
      responseBody = JSON.parse(rawText);
    } catch {
      responseBody = rawText;
    }
  } catch {
    responseBody = null;
  }

  if (!res.ok) {
    let message = `${fallbackActionName} failed (${res.status})`;

    if (responseBody && typeof responseBody === 'object' && responseBody.error) {
      message = responseBody.error;
    } else if (typeof responseBody === 'string') {
      if (responseBody.includes('<!doctype') || responseBody.includes('<html')) {
        message = `Server sedang memproses beban tinggi (status ${res.status}). Silakan coba beberapa detik lagi.`;
      } else if (responseBody.trim()) {
        message = responseBody.slice(0, 250);
      }
    }

    // Clean up nested raw JSON string if present
    if (typeof message === 'string' && message.startsWith('{') && message.includes('"message"')) {
      try {
        const parsed = JSON.parse(message);
        if (parsed.error?.message) {
          message = parsed.error.message;
        }
      } catch {}
    }

    if (
      message.includes('Quota exceeded') ||
      message.includes('429') ||
      message.includes('RESOURCE_EXHAUSTED')
    ) {
      message = 'Batas kuota gratis Gemini tercapai sementara. Mohon tunggu sekitar 10-15 detik sebelum mencoba lagi.';
    } else if (
      message.includes('high demand') ||
      message.includes('503') ||
      message.includes('UNAVAILABLE')
    ) {
      message = 'Server AI sedang sangat sibuk (503). Mohon tunggu beberapa saat dan klik lagi.';
    } else if (
      message.includes('fetch failed') ||
      message.includes('ETIMEDOUT') ||
      message.includes('ECONNRESET')
    ) {
      message = 'Koneksi ke server AI terputus sesaat. Sistem telah mengoptimalkan koneksi, silakan coba klik lagi.';
    }

    throw new Error(message);
  }

  if (responseBody && typeof responseBody === 'object') {
    return responseBody;
  }

  throw new Error('Respon server tidak valid atau data kosong. Silakan coba kembali.');
}

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  try {
    const userApiKey = localStorage.getItem('user_gemini_api_key');
    if (userApiKey && userApiKey.trim()) {
      headers['x-gemini-api-key'] = userApiKey.trim();
    }
  } catch {}
  return headers;
}

/**
 * Gemini Provider implementation calling our server proxy endpoints
 */
export class GeminiSubtitleService implements ITranscriptionProvider, ITranslationProvider {
  public name = 'Gemini AI Engine';

  async transcribe(request: TranscriptionRequest): Promise<TranscriptionResponse> {
    const res = await fetch('/api/ai/transcribe', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(request),
    });

    return await handleApiResponse(res, 'AI Transcription');
  }

  async translate(request: TranslationRequest): Promise<TranslationResponse> {
    const res = await fetch('/api/ai/translate', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(request),
    });

    return await handleApiResponse(res, 'AI Translation');
  }

  async translateAll(request: TranslateAllRequest): Promise<TranslateAllResponse> {
    const res = await fetch('/api/ai/translate-all', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(request),
    });

    return await handleApiResponse(res, 'AI Batch Translation');
  }

  async resync(request: ResyncRequest): Promise<ResyncResponse> {
    const res = await fetch('/api/ai/resync', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(request),
    });

    return await handleApiResponse(res, 'AI Timestamp Resync');
  }
}

export const aiSubtitleService = new GeminiSubtitleService();
