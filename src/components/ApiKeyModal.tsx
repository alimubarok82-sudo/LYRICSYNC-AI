import React, { useState, useEffect } from 'react';
import { Key, Eye, EyeOff, Check, X, Shield, ExternalLink, Loader2, Sparkles, Trash2 } from 'lucide-react';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApiKeySaved?: (key: string) => void;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onClose, onApiKeySaved }) => {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [serverHasKey, setServerHasKey] = useState<boolean | null>(null);

  useEffect(() => {
    if (isOpen) {
      const stored = localStorage.getItem('user_gemini_api_key') || '';
      setApiKey(stored);
      setTestResult(null);

      // Check if server already has default GEMINI_API_KEY
      fetch('/api/ai/status')
        .then((r) => r.json())
        .then((data) => {
          setServerHasKey(data.hasServerKey ?? false);
        })
        .catch(() => {
          setServerHasKey(true);
        });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    const trimmed = apiKey.trim();
    if (trimmed) {
      localStorage.setItem('user_gemini_api_key', trimmed);
    } else {
      localStorage.removeItem('user_gemini_api_key');
    }
    if (onApiKeySaved) {
      onApiKeySaved(trimmed);
    }
    onClose();
  };

  const handleClear = () => {
    setApiKey('');
    localStorage.removeItem('user_gemini_api_key');
    setTestResult(null);
    if (onApiKeySaved) {
      onApiKeySaved('');
    }
  };

  const handleTestKey = async () => {
    const keyToTest = apiKey.trim();
    if (!keyToTest) {
      setTestResult({
        success: false,
        message: 'Masukkan API Key terlebih dahulu sebelum menguji.',
      });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const res = await fetch('/api/ai/test-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customApiKey: keyToTest }),
      });

      const rawText = await res.text();
      let data: any = {};
      try {
        data = JSON.parse(rawText);
      } catch {
        // If response is HTML (e.g. 404 from static host/Vercel before function deployment)
        data = { error: rawText.includes('<html') ? 'Server backend /api belum aktif di hosting. Kunci Anda tetap valid untuk disimpan secara lokal.' : rawText };
      }

      if (res.ok && data.success) {
        setTestResult({
          success: true,
          message: 'Kunci API valid dan aktif! Siap digunakan untuk sinkronisasi audio dan terjemahan.',
        });
      } else {
        setTestResult({
          success: false,
          message: data.error || 'Kunci API tidak valid atau kuota habis.',
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Gagal menghubungi server untuk verifikasi kunci.',
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#111318] border border-neutral-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden p-6 relative">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center justify-center">
              <Key className="w-4 h-4" />
            </div>
            <h2 className="text-base font-bold text-white tracking-wide">
              Pengaturan Kunci API (BYOK)
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-neutral-800/80 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Server status alert */}
        <div className="mt-4 p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/50 flex items-start gap-2.5 text-xs text-emerald-200">
          <Shield className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-emerald-300">
              {serverHasKey ? 'Kunci Server Aktif: ' : 'Mode Kunci Mandiri: '}
            </span>
            {serverHasKey
              ? 'Server sudah memiliki GEMINI_API_KEY bawaan. Anda tetap bisa memasukkan kunci sendiri jika ingin menggunakan kuota pribadi tanpa terpengaruh batas kuota bersama.'
              : 'Masukkan kunci Gemini API Anda sendiri di bawah untuk mengaktifkan AI transkripsi dan terjemahan.'}
          </div>
        </div>

        {/* Input Field */}
        <div className="mt-5 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <label className="text-neutral-200 font-semibold flex items-center gap-1.5">
              <span>Gemini API Key:</span>
            </label>
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="text-purple-400 hover:text-purple-300 flex items-center gap-1 text-[11px] underline"
            >
              <span>Dapatkan Kunci Gratis</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.target.value);
                setTestResult(null);
              }}
              placeholder="AIzaSy..."
              className="w-full bg-[#181a20] border border-neutral-700/80 focus:border-purple-500 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-purple-500 transition pr-10 font-mono"
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-3 top-2.5 text-neutral-400 hover:text-white transition"
              title={showKey ? 'Sembunyikan' : 'Tampilkan'}
            >
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          <p className="text-[11px] text-neutral-400 leading-relaxed pt-1">
            Kunci hanya disimpan di penyimpanan lokal browser Anda (<span className="text-purple-300 font-mono">localStorage</span>) dan dikirim secara aman saat memproses sinkronisasi audio & lirik.
          </p>
        </div>

        {/* Test status banner */}
        {testResult && (
          <div
            className={`mt-3 p-2.5 rounded-xl text-xs flex items-start gap-2 ${
              testResult.success
                ? 'bg-emerald-950/50 border border-emerald-800 text-emerald-300'
                : 'bg-rose-950/50 border border-rose-800 text-rose-300'
            }`}
          >
            {testResult.success ? (
              <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <X className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            )}
            <span className="leading-snug">{testResult.message}</span>
          </div>
        )}

        {/* Actions Footer */}
        <div className="mt-6 pt-4 border-t border-neutral-800 flex items-center justify-between gap-3">
          {apiKey ? (
            <button
              type="button"
              onClick={handleClear}
              className="px-3 py-2 text-xs font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 border border-rose-900/40 rounded-xl transition flex items-center gap-1.5"
              title="Hapus Kunci Tersimpan"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Hapus</span>
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleTestKey}
              disabled={isTesting || !apiKey.trim()}
              className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              {isTesting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-400" />
                  <span>Menguji...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                  <span>Uji Kunci</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 text-white shadow-lg shadow-purple-600/30 transition flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Simpan</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
