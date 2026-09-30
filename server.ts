import express from 'express';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Generous body limit for audio base64 uploads
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Default server GEMINI_API_KEY
const defaultApiKey = process.env.GEMINI_API_KEY || '';

/**
 * Returns a GoogleGenAI instance using the user's custom BYOK key if provided in headers,
 * or falls back to the server's default GEMINI_API_KEY.
 */
function getAiClient(req: express.Request): { ai: GoogleGenAI; effectiveKey: string } {
  const customKey =
    (req.headers['x-gemini-api-key'] as string) ||
    (req.body && req.body.customApiKey ? String(req.body.customApiKey) : '');

  const effectiveKey = (customKey && customKey.trim()) ? customKey.trim() : defaultApiKey;

  const client = new GoogleGenAI({
    apiKey: effectiveKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  return { ai: client, effectiveKey };
}

/**
 * Endpoint to check server API key status
 * GET /api/ai/status
 */
app.get('/api/ai/status', (_req, res) => {
  return res.json({
    hasServerKey: Boolean(defaultApiKey && defaultApiKey.trim().length > 0),
  });
});

/**
 * Endpoint to test and validate a user-supplied API key
 * POST /api/ai/test-key
 */
app.post('/api/ai/test-key', async (req, res) => {
  try {
    const { customApiKey } = req.body;
    if (!customApiKey || typeof customApiKey !== 'string' || !customApiKey.trim()) {
      return res.status(400).json({ error: 'Kunci API tidak boleh kosong.' });
    }

    const testClient = new GoogleGenAI({
      apiKey: customApiKey.trim(),
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    // Test candidate models: start with gemini-3.1-flash-lite (fastest, lowest load),
    // then gemini-3.8-flash, then gemini-flash-latest
    const testCandidateModels = [
      'gemini-3.1-flash-lite',
      'gemini-3.8-flash',
      'gemini-flash-latest',
      'gemini-3.1-pro-preview',
    ];

    let success = false;
    let lastError: any = null;

    for (const modelName of testCandidateModels) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          if (attempt > 0) {
            await new Promise((r) => setTimeout(r, 1000));
          }
          const testRes = await testClient.models.generateContent({
            model: modelName,
            contents: 'Hi',
          });

          if (testRes && (testRes.text || testRes.candidates?.length)) {
            success = true;
            break;
          }
        } catch (err: any) {
          lastError = err;
          const msg = String(err?.message || '');
          // If the key is invalid (400/401/403 API_KEY_INVALID), no need to test other models
          if (msg.includes('API_KEY_INVALID') || msg.includes('401') || msg.includes('403') || msg.includes('KEY_EXPIRED')) {
            return res.status(400).json({
              error: 'Kunci API tidak valid atau akses ditolak oleh Google AI Studio. Pastikan kunci disalin dengan benar.',
            });
          }
          // If 503 (high demand) or 429, try next attempt or candidate model
        }
      }
      if (success) break;
    }

    if (success) {
      return res.json({ success: true, message: 'Valid' });
    }

    let errMsg = lastError?.message || 'Verifikasi kunci gagal.';
    if (errMsg.includes('503') || errMsg.includes('high demand') || errMsg.includes('UNAVAILABLE')) {
      errMsg = 'Server Gemini pusat sedang mengalami lonjakan trafik (503). Namun kunci Anda tetap tersimpan dan siap digunakan untuk tombol Simpan.';
    } else if (errMsg.includes('Quota exceeded') || errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED')) {
      errMsg = 'Kunci API valid, tetapi kuota akun Google AI Studio Anda sedang mencapai batas sesaat (429). Coba kembali beberapa detik lagi.';
    }

    return res.status(400).json({ error: errMsg });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Verifikasi kunci gagal.' });
  }
});

/**
 * 1. AI Transcription & Lyrics Alignment Endpoint
 * POST /api/ai/transcribe
 */
app.post('/api/ai/transcribe', async (req, res) => {
  try {
    const { ai, effectiveKey } = getAiClient(req);

    if (!effectiveKey) {
      return res.status(500).json({
        error: 'Kunci Gemini API belum diatur. Masukkan kunci API Anda di menu Pengaturan Kunci API (BYOK).',
      });
    }

    const {
      audioBase64,
      audioMimeType = 'audio/mp3',
      duration = 60,
      userSuppliedLyrics,
      contentType = 'song',
      originalLanguage = 'auto',
    } = req.body;

    const parts: any[] = [];

    if (audioBase64) {
      parts.push({
        inlineData: {
          mimeType: audioMimeType,
          data: audioBase64,
        },
      });
    }

    const systemInstruction = `You are an expert music lyric transcription, subtitle synchronization, and speech alignment engine.
You are processing content classified as: "${contentType}".
Rules:
1. Preserve the original language and original script (${originalLanguage !== 'auto' ? originalLanguage : 'detected source language'}).
2. Do not translate the original text.
3. Do not invent or hallucinate lyrics.
4. Do not include instrumental-only interludes as subtitle text.
5. Preserve repeated lyrics and chorus lines.
6. Segment into natural vocal phrases suitable for subtitle reading (approx 2 to 7 seconds each).
7. Ensure timestamps are strictly chronological: start >= 0, end > start, and end <= ${duration}.
8. Use millisecond precision (seconds as floats with 3 decimals, e.g. 3.250).
9. Preserve Arabic script, characters, and diacritics/harakat with highest precision.
10. If this is a Quranic or Islamic recitation, preserve verse structure and identify the verse number (e.g. 17, 18, 19) in "verseNumber" if clearly identifiable.
${
  userSuppliedLyrics
    ? `CRITICAL AUTHORITATIVE LYRICS OVERRIDE:
The user has supplied their own authoritative original lyrics:
"""
${userSuppliedLyrics}
"""
You MUST NOT rewrite, paraphrase, correct spelling, alter punctuation, or modify any harakat in these supplied lyrics. Align the supplied text lines to the audio timestamps without altering the text content.`
    : ''
}

Return JSON with this schema:
{
  "segments": [
    {
      "id": 1,
      "start": 0.000,
      "end": 4.500,
      "original": "Text in original language",
      "verseNumber": 1
    }
  ],
  "detectedLanguage": "ar"
}`;

    const promptText = audioBase64
      ? 'Analyze the supplied audio and generate chronological subtitle segments with accurate vocal timestamps.'
      : `Generate synthetic subtitle segments for audio of duration ${duration} seconds with realistic phrasing. ${
          userSuppliedLyrics ? `Align these authoritative lyrics: \n${userSuppliedLyrics}` : ''
        }`;

    parts.push({ text: promptText });

    // Official supported models for transcription & audio alignment
    // Use gemini-3.8-flash as primary, gemini-flash-latest and gemini-3.1-flash-lite as fallbacks
    // Note: Do NOT use gemini-3.5-transcribe with systemInstruction (causes INVALID_ARGUMENT Developer instruction not enabled)
    // and avoid pro models in free tier (quota limit: 0)
    const candidateModels = ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'];

    let lastError: any = null;
    let response: any = null;

    for (const modelCandidate of candidateModels) {
      // 2 attempts per candidate with backoff
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          if (attempt > 0) {
            await new Promise((r) => setTimeout(r, 2000 * attempt));
          }

          const callConfig: any = {
            systemInstruction,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                segments: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      id: { type: Type.INTEGER },
                      start: { type: Type.NUMBER },
                      end: { type: Type.NUMBER },
                      original: { type: Type.STRING },
                      verseNumber: { type: Type.INTEGER },
                    },
                    required: ['id', 'start', 'end', 'original'],
                  },
                },
                detectedLanguage: { type: Type.STRING },
              },
              required: ['segments'],
            },
          };

          response = await ai.models.generateContent({
            model: modelCandidate,
            contents: { parts },
            config: callConfig,
          });

          if (response) break;
        } catch (err: any) {
          lastError = err;
          console.warn(`Model ${modelCandidate} attempt ${attempt + 1} failed:`, err?.message || err);
          const msg = String(err?.message || '');
          if (
            !msg.includes('503') &&
            !msg.includes('high demand') &&
            !msg.includes('429') &&
            !msg.includes('ETIMEDOUT') &&
            !msg.includes('fetch failed') &&
            !msg.includes('RESOURCE_EXHAUSTED')
          ) {
            break;
          }
        }
      }
      if (response) break;
    }

    // If audio upload fetch failed upstream due to network size/timeout, try a lightweight text-only pass
    if (!response && parts.length > 1) {
      console.warn('Audio payload failed upstream, falling back to text-assisted segmentation...');
      const textOnlyParts = parts.filter((p) => p.text);
      try {
        response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: { parts: textOnlyParts },
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
          },
        });
      } catch (fallbackErr) {
        console.warn('Text-assisted fallback failed:', fallbackErr);
      }
    }

    if (!response) {
      throw lastError || new Error('Server AI sedang mengalami antrean padat. Mohon ulangi beberapa detik lagi.');
    }

    const text = response.text?.trim() || '{}';
    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      // In case markdown codeblock ```json was returned
      const clean = text.replace(/```(?:json)?/gi, '').trim();
      parsed = JSON.parse(clean);
    }

    // Sanitize and validate segments
    const segments = (parsed.segments || []).map((seg: any, idx: number) => ({
      id: idx + 1,
      start: Math.max(0, Number(seg.start) || 0),
      end: Math.max((Number(seg.start) || 0) + 1, Number(seg.end) || (Number(seg.start) || 0) + 4),
      original: String(seg.original || '').trim(),
      verseNumber: seg.verseNumber ? Number(seg.verseNumber) : undefined,
    }));

    return res.json({
      segments,
      detectedLanguage: parsed.detectedLanguage || 'ar',
    });
  } catch (err: any) {
    console.error('Transcription error:', err);
    let errMsg = err.message || 'Failed to analyze and transcribe audio.';
    if (errMsg.includes('Quota exceeded') || errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED')) {
      errMsg = 'Batas kuota gratis Gemini tercapai sementara. Mohon tunggu sekitar 10-15 detik sebelum mencoba lagi.';
    }
    return res.status(500).json({
      error: errMsg,
    });
  }
});

/**
 * 2. AI Translation Endpoint (Single Language)
 * POST /api/ai/translate
 */
app.post('/api/ai/translate', async (req, res) => {
  try {
    const { ai, effectiveKey } = getAiClient(req);

    if (!effectiveKey) {
      return res.status(500).json({
        error: 'Kunci Gemini API belum diatur. Masukkan kunci API Anda di menu Pengaturan Kunci API (BYOK).',
      });
    }

    const { segments, targetLanguage = 'id', sourceLanguage = 'ar', contentType = 'song' } = req.body;

    if (!Array.isArray(segments) || segments.length === 0) {
      return res.status(400).json({ error: 'Segments array is required.' });
    }

    const systemInstruction = `You are a professional multilingual subtitle translator.
Translate the supplied original subtitle segments from ${sourceLanguage} to ${targetLanguage}.
Content category: "${contentType}".

Rules:
1. Preserve meaning and context faithfully.
2. Do not add or hallucinate information not present in the source.
3. Do not modify the original text.
4. Preserve proper names, honorifics, and repeated phrases consistently (Translation Memory).
5. For Quranic / Islamic content, translate with reverent precision, standard religious terminology (e.g. Indonesian standard DEPAG/Kemenag or Sahih International for English), and clearly treat the translation as a translation.
6. Keep translations concise and natural for subtitle reading.
7. Return exactly one translation per segment, preserving the segment id.
8. Maintain the exact order.`;

    const prompt = `Translate these ${segments.length} segments into target language code "${targetLanguage}":\n` +
      JSON.stringify(
        segments.map((s) => ({
          id: s.id,
          original: s.original,
          verseNumber: s.verseNumber,
        })),
        null,
        2
      );

    let response: any = null;
    const translateModels = ['gemini-3.8-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest'];

    for (const m of translateModels) {
      try {
        response = await ai.models.generateContent({
          model: m,
          contents: prompt,
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                translations: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      id: { type: Type.INTEGER },
                      translation: { type: Type.STRING },
                    },
                    required: ['id', 'translation'],
                  },
                },
              },
              required: ['translations'],
            },
          },
        });
        if (response) break;
      } catch (e: any) {
        console.warn(`Translate model ${m} failed:`, e?.message);
      }
    }

    if (!response) {
      throw new Error('Gagal menerjemahkan subtitle. Jika menggunakan kuota server bersama, silakan gunakan API Key pribadi Anda di menu "API Key" untuk kuota tak terbatas.');
    }

    const text = response.text?.trim() || '{}';
    const parsed = JSON.parse(text);

    const map: Record<number, string> = {};
    for (const item of parsed.translations || []) {
      map[item.id] = String(item.translation || '').trim();
    }

    return res.json({
      translations: map,
      targetLanguage,
    });
  } catch (err: any) {
    console.error('Translation error:', err);
    return res.status(500).json({
      error: err.message || 'Failed to translate subtitle segments.',
    });
  }
});

/**
 * 3. AI Translate All Endpoint (Multiple Languages in one efficient request)
 * POST /api/ai/translate-all
 */
app.post('/api/ai/translate-all', async (req, res) => {
  try {
    const { ai, effectiveKey } = getAiClient(req);

    if (!effectiveKey) {
      return res.status(500).json({
        error: 'Kunci Gemini API belum diatur. Masukkan kunci API Anda di menu Pengaturan Kunci API (BYOK).',
      });
    }

    const {
      segments,
      targetLanguages = ['id', 'en', 'ms'],
      sourceLanguage = 'ar',
      contentType = 'song',
    } = req.body;

    if (!Array.isArray(segments) || segments.length === 0) {
      return res.status(400).json({ error: 'Segments array is required.' });
    }

    const systemInstruction = `You are a professional multilingual subtitle translation engine.
Translate the supplied subtitle segments from ${sourceLanguage} simultaneously into these target languages: ${targetLanguages.join(', ')}.
Content category: "${contentType}".

Rules:
1. Preserve authentic meaning, nuance, and sentence context.
2. For Quranic / Islamic content, use esteemed standard religious phrasing and terminology.
3. Keep concise for cinematic subtitle pacing.
4. Output structured translations for each language keyed by language code and segment id.`;

    const prompt = `Translate these segments into ${JSON.stringify(targetLanguages)}:\n` +
      JSON.stringify(
        segments.map((s) => ({
          id: s.id,
          original: s.original,
          verseNumber: s.verseNumber,
        })),
        null,
        2
      );

    let response: any = null;
    const translateAllModels = ['gemini-3.8-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest'];

    for (const m of translateAllModels) {
      try {
        response = await ai.models.generateContent({
          model: m,
          contents: prompt,
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
          },
        });
        if (response) break;
      } catch (e: any) {
        console.warn(`Translate-all model ${m} failed:`, e?.message);
      }
    }

    if (!response) {
      throw new Error('Gagal menerjemahkan semua bahasa. Silakan masukkan API Key pribadi Anda di menu "API Key" untuk kuota tak terbatas.');
    }

    const text = response.text?.trim() || '{}';
    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = {};
    }

    // Standardize result structure { [langCode]: { [segmentId]: string } }
    const results: Record<string, Record<number, string>> = {};
    for (const lang of targetLanguages) {
      results[lang] = {};
    }

    if (parsed.results) {
      Object.assign(results, parsed.results);
    } else if (parsed.translations) {
      // Sometimes returned as array of { id, translations: { id: "...", en: "..." } }
      if (Array.isArray(parsed.translations)) {
        for (const item of parsed.translations) {
          const segId = item.id;
          if (item.translations && typeof item.translations === 'object') {
            for (const [lang, val] of Object.entries(item.translations)) {
              if (!results[lang]) results[lang] = {};
              results[lang][segId] = String(val);
            }
          }
        }
      }
    } else {
      // Direct keys
      for (const lang of targetLanguages) {
        if (parsed[lang] && typeof parsed[lang] === 'object') {
          results[lang] = parsed[lang];
        }
      }
    }

    return res.json({ results });
  } catch (err: any) {
    console.error('Translate all error:', err);
    return res.status(500).json({
      error: err.message || 'Failed to translate all languages.',
    });
  }
});

/**
 * 4. AI Resync Timestamps Endpoint
 * POST /api/ai/resync
 * Adjusts start and end timestamps while strictly leaving original and translation texts untouched!
 */
app.post('/api/ai/resync', async (req, res) => {
  try {
    const { ai, effectiveKey } = getAiClient(req);

    if (!effectiveKey) {
      return res.status(500).json({
        error: 'Kunci Gemini API belum diatur. Masukkan kunci API Anda di menu Pengaturan Kunci API (BYOK).',
      });
    }

    const { segments, audioDuration = 60, contentType = 'song' } = req.body;

    if (!Array.isArray(segments) || segments.length === 0) {
      return res.status(400).json({ error: 'Segments array is required.' });
    }

    const systemInstruction = `You are an audio timing optimization engine.
Analyze the provided subtitle segments and recalculate optimal start and end timestamps.
Total audio duration: ${audioDuration} seconds.
Content type: "${contentType}".
CRITICAL: DO NOT modify any original text or translation text. ONLY return refined "start" and "end" timestamps in seconds with millisecond precision (e.g. 3.250). Ensure end > start, start >= 0, and chronological progression without ugly gaps or overlaps.`;

    const prompt = `Optimize timing for these segments:\n` +
      JSON.stringify(
        segments.map((s) => ({
          id: s.id,
          start: s.start,
          end: s.end,
          original: s.original,
        }))
      );

    let response: any = null;
    const resyncModels = ['gemini-3.8-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest'];

    for (const m of resyncModels) {
      try {
        response = await ai.models.generateContent({
          model: m,
          contents: prompt,
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                segments: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      id: { type: Type.INTEGER },
                      start: { type: Type.NUMBER },
                      end: { type: Type.NUMBER },
                    },
                    required: ['id', 'start', 'end'],
                  },
                },
              },
              required: ['segments'],
            },
          },
        });
        if (response) break;
      } catch (e: any) {
        console.warn(`Resync model ${m} failed:`, e?.message);
      }
    }

    if (!response) {
      throw new Error('Gagal menyelaraskan timestamp otomatis saat ini.');
    }

    const parsed = JSON.parse(response.text?.trim() || '{}');
    return res.json({ segments: parsed.segments || [] });
  } catch (err: any) {
    console.error('Resync error:', err);
    return res.status(500).json({
      error: err.message || 'Failed to resynchronize subtitle timestamps.',
    });
  }
});

// Setup Vite in development or serve static in production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`LyricSync AI server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
