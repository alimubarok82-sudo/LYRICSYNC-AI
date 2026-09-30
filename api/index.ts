import type { Request, Response } from 'express';
import { GoogleGenAI, Type } from '@google/genai';

const defaultApiKey = process.env.GEMINI_API_KEY || '';

function getAiClient(req: Request): { ai: GoogleGenAI; effectiveKey: string } {
  const customKey =
    (req.headers['x-gemini-api-key'] as string) ||
    (req.body && req.body.customApiKey ? String(req.body.customApiKey) : '');

  const effectiveKey = customKey && customKey.trim() ? customKey.trim() : defaultApiKey;

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

export default async function handler(req: Request, res: Response) {
  // CORS setup
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, x-gemini-api-key'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const url = req.url || '';

  // GET /api/ai/status
  if (url.includes('/api/ai/status') || url.endsWith('/status')) {
    return res.json({
      hasServerKey: Boolean(defaultApiKey && defaultApiKey.trim().length > 0),
    });
  }

  // POST /api/ai/test-key
  if (url.includes('/api/ai/test-key') || url.endsWith('/test-key')) {
    try {
      const { customApiKey } = req.body || {};
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

      const testCandidateModels = [
        'gemini-3.1-flash-lite',
        'gemini-3.8-flash',
        'gemini-flash-latest',
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
            if (
              msg.includes('API_KEY_INVALID') ||
              msg.includes('401') ||
              msg.includes('403') ||
              msg.includes('KEY_EXPIRED')
            ) {
              return res.status(400).json({
                error: 'Kunci API tidak valid atau akses ditolak oleh Google AI Studio. Pastikan kunci disalin dengan benar.',
              });
            }
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
  }

  // POST /api/ai/transcribe
  if (url.includes('/api/ai/transcribe') || url.endsWith('/transcribe')) {
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
      } = req.body || {};

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

      const candidateModels = ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'];

      let lastError: any = null;
      let response: any = null;

      for (const modelCandidate of candidateModels) {
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            if (attempt > 0) {
              await new Promise((r) => setTimeout(r, 1500));
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

      if (!response) {
        throw new Error(
          lastError?.message ||
            'Gagal memproses transkripsi audio. Silakan coba kembali atau gunakan tombol Paste Lyrics.'
        );
      }

      const text = response.text?.trim() || '{}';
      let parsed: any;
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = { segments: [] };
      }

      return res.json({
        segments: parsed.segments || [],
        detectedLanguage: parsed.detectedLanguage || originalLanguage,
      });
    } catch (err: any) {
      console.error('Transcription error:', err);
      return res.status(500).json({
        error: err.message || 'Failed to process audio transcription.',
      });
    }
  }

  // POST /api/ai/translate
  if (url.includes('/api/ai/translate') && !url.includes('translate-all')) {
    try {
      const { ai, effectiveKey } = getAiClient(req);

      if (!effectiveKey) {
        return res.status(500).json({
          error: 'Kunci Gemini API belum diatur. Masukkan kunci API Anda di menu Pengaturan Kunci API (BYOK).',
        });
      }

      const { segments, targetLanguage = 'id', sourceLanguage = 'ar', contentType = 'song' } = req.body || {};

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
4. Preserve proper names, honorifics, and repeated phrases consistently.
5. Keep translations concise and natural for subtitle reading.
6. Return exactly one translation per segment, preserving the segment id.`;

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
        throw new Error('Gagal menerjemahkan subtitle saat ini. Coba kembali beberapa detik lagi.');
      }

      const text = response.text?.trim() || '{}';
      let parsed: any;
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = { translations: [] };
      }

      const map: Record<number, string> = {};
      const items = Array.isArray(parsed.translations) ? parsed.translations : [];
      for (const item of items) {
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
  }

  // POST /api/ai/translate-all
  if (url.includes('/api/ai/translate-all')) {
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
      } = req.body || {};

      if (!Array.isArray(segments) || segments.length === 0) {
        return res.status(400).json({ error: 'Segments array is required.' });
      }

      const systemInstruction = `You are a professional multilingual subtitle translation engine.
Translate the supplied subtitle segments from ${sourceLanguage} simultaneously into these target languages: ${targetLanguages.join(', ')}.
Content category: "${contentType}".
Keep concise for cinematic subtitle pacing.
Output structured translations for each language keyed by language code and segment id.`;

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
        throw new Error('Gagal menerjemahkan semua bahasa.');
      }

      const text = response.text?.trim() || '{}';
      let parsed: any;
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = {};
      }

      const results: Record<string, Record<number, string>> = {};
      for (const lang of targetLanguages) {
        results[lang] = {};
      }

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
      } else {
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
  }

  // POST /api/ai/resync
  if (url.includes('/api/ai/resync') || url.endsWith('/resync')) {
    try {
      const { ai, effectiveKey } = getAiClient(req);

      if (!effectiveKey) {
        return res.status(500).json({
          error: 'Kunci Gemini API belum diatur. Masukkan kunci API Anda di menu Pengaturan Kunci API (BYOK).',
        });
      }

      const { segments, audioDuration = 60, contentType = 'song' } = req.body || {};

      if (!Array.isArray(segments) || segments.length === 0) {
        return res.status(400).json({ error: 'Segments array is required.' });
      }

      const systemInstruction = `You are an audio timing optimization engine.
Analyze the provided subtitle segments and recalculate optimal start and end timestamps.
Total audio duration: ${audioDuration} seconds.
Content type: "${contentType}".
CRITICAL: DO NOT modify any original text or translation text. ONLY return refined "start" and "end" timestamps in seconds with millisecond precision (e.g. 3.250). Ensure end > start, start >= 0, and chronological progression.`;

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
  }

  return res.status(404).json({ error: 'Endpoint not found' });
}
