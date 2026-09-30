import React, { useRef, useEffect, useState, useMemo } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  UploadCloud,
  Repeat,
  Sparkles,
} from 'lucide-react';
import { SubtitleSegment } from '../types/subtitle';
import { formatPlayerTime } from '../utils/srt';
import { extractWaveformData, generateFallbackWaveform } from '../utils/audio';

interface AudioPlayerProps {
  audioUrl?: string;
  audioFileName?: string;
  duration: number;
  currentTime: number;
  segments: SubtitleSegment[];
  onTimeUpdate: (time: number) => void;
  onDurationChange: (duration: number) => void;
  onAudioUpload: (file: File) => void;
  onSelectSegment: (segmentId: number) => void;
  onAnalyzeAudio?: () => void;
  isAnalyzing?: boolean;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  audioUrl,
  audioFileName,
  duration,
  currentTime,
  segments,
  onTimeUpdate,
  onDurationChange,
  onAudioUpload,
  onSelectSegment,
  onAnalyzeAudio,
  isAnalyzing,
}) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const waveformCanvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [volume, setVolume] = useState(0.9);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoopingSegment, setIsLoopingSegment] = useState(false);
  const [waveformPeaks, setWaveformPeaks] = useState<number[]>([]);

  // Find active segment
  const activeSegment = useMemo(() => {
    return segments.find((seg) => currentTime >= seg.start && currentTime <= seg.end);
  }, [segments, currentTime]);

  // Load waveform data whenever audioUrl changes
  useEffect(() => {
    if (!audioUrl) {
      setWaveformPeaks(generateFallbackWaveform(240));
      return;
    }

    let isCancelled = false;

    fetch(audioUrl)
      .then((res) => res.blob())
      .then(async (blob) => {
        if (isCancelled) return;
        const peaks = await extractWaveformData(blob, 240);
        if (!isCancelled) setWaveformPeaks(peaks);
      })
      .catch(() => {
        if (!isCancelled) setWaveformPeaks(generateFallbackWaveform(240));
      });

    return () => {
      isCancelled = true;
    };
  }, [audioUrl]);

  // Sync audio element time
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (Math.abs(audio.currentTime - currentTime) > 0.3) {
      audio.currentTime = currentTime;
    }
  }, [currentTime]);

  // Handle play/pause
  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.paused) {
      audio.play().then(() => setIsPlaying(true)).catch((err) => {
        console.warn('Playback error:', err);
      });
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  };

  // Skip to previous subtitle
  const handlePrevSubtitle = () => {
    if (segments.length === 0) return;
    const prevSegs = segments.filter((s) => s.start < currentTime - 0.2);
    if (prevSegs.length > 0) {
      const target = prevSegs[prevSegs.length - 1];
      seekTo(target.start);
      onSelectSegment(target.id);
    } else {
      seekTo(segments[0].start);
      onSelectSegment(segments[0].id);
    }
  };

  // Skip to next subtitle
  const handleNextSubtitle = () => {
    if (segments.length === 0) return;
    const nextSegs = segments.filter((s) => s.start > currentTime + 0.1);
    if (nextSegs.length > 0) {
      const target = nextSegs[0];
      seekTo(target.start);
      onSelectSegment(target.id);
    }
  };

  const seekTo = (timeInSeconds: number) => {
    const safeTime = Math.max(0, Math.min(timeInSeconds, duration || 1000));
    onTimeUpdate(safeTime);
    if (audioRef.current) {
      audioRef.current.currentTime = safeTime;
    }
  };

  const handleRateChange = (rate: number) => {
    setPlaybackRate(rate);
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
    }
  };

  const handleVolumeChange = (newVol: number) => {
    setVolume(newVol);
    setIsMuted(newVol === 0);
    if (audioRef.current) {
      audioRef.current.volume = newVol;
    }
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    if (isMuted) {
      audioRef.current.volume = volume || 0.8;
      setIsMuted(false);
    } else {
      audioRef.current.volume = 0;
      setIsMuted(true);
    }
  };

  // Time update from audio element
  const handleAudioTimeUpdate = () => {
    const audio = audioRef.current;
    if (!audio) return;

    const time = audio.currentTime;
    onTimeUpdate(time);

    // Segment loop check
    if (isLoopingSegment && activeSegment) {
      if (time >= activeSegment.end) {
        audio.currentTime = activeSegment.start;
      }
    }
  };

  const handleLoadedMetadata = () => {
    const audio = audioRef.current;
    if (audio && audio.duration && !isNaN(audio.duration) && audio.duration !== Infinity) {
      onDurationChange(audio.duration);
    }
  };

  // Draw Waveform onto Canvas
  useEffect(() => {
    const canvas = waveformCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    const peaks = waveformPeaks.length > 0 ? waveformPeaks : generateFallbackWaveform(200);
    const numBars = peaks.length;
    const barWidth = width / numBars;
    const safeDuration = duration > 0 ? duration : 60;
    const playheadX = (currentTime / safeDuration) * width;

    // 1. Draw segment background blocks
    segments.forEach((seg, idx) => {
      const segStartX = (seg.start / safeDuration) * width;
      const segEndX = (seg.end / safeDuration) * width;
      const segWidth = Math.max(2, segEndX - segStartX);

      const isActive = currentTime >= seg.start && currentTime <= seg.end;

      if (isActive) {
        ctx.fillStyle = 'rgba(230, 200, 106, 0.22)';
        ctx.fillRect(segStartX, 0, segWidth, height);
        ctx.strokeStyle = '#e6c86a';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(segStartX, 0, segWidth, height);
      } else {
        ctx.fillStyle =
          idx % 2 === 0 ? 'rgba(255, 255, 255, 0.04)' : 'rgba(255, 255, 255, 0.07)';
        ctx.fillRect(segStartX, 0, segWidth, height);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(segStartX, 0, segWidth, height);
      }

      // Draw segment label
      if (segWidth > 24) {
        ctx.fillStyle = isActive ? '#e6c86a' : 'rgba(255, 255, 255, 0.4)';
        ctx.font = '9px monospace';
        ctx.fillText(`#${seg.id}`, segStartX + 4, 12);
      }
    });

    // 2. Draw Waveform bars
    const centerY = height / 2;
    for (let i = 0; i < numBars; i++) {
      const x = i * barWidth;
      const peakVal = peaks[i] || 0.1;
      const barHeight = Math.max(3, peakVal * (height * 0.75));

      const isPlayed = x <= playheadX;
      ctx.fillStyle = isPlayed ? '#f59e0b' : '#52525b';
      ctx.fillRect(x + 0.5, centerY - barHeight / 2, Math.max(1, barWidth - 1), barHeight);
    }

    // 3. Draw Playhead line
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(playheadX, 0);
    ctx.lineTo(playheadX, height);
    ctx.stroke();

    // Playhead head marker
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(playheadX, 5, 4, 0, Math.PI * 2);
    ctx.fill();
  }, [waveformPeaks, currentTime, duration, segments, activeSegment]);

  // Click on waveform canvas to seek
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = waveformCanvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    const targetTime = ratio * (duration || 60);

    seekTo(targetTime);

    // Check if clicked inside a segment
    const clickedSeg = segments.find(
      (seg) => targetTime >= seg.start && targetTime <= seg.end
    );
    if (clickedSeg) {
      onSelectSegment(clickedSeg.id);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onAudioUpload(file);
    }
  };

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-3 sm:p-4 shadow-xl">
      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        src={audioUrl}
        onTimeUpdate={handleAudioTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => setIsPlaying(false)}
      />

      {/* Hidden file input for audio */}
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Audio metadata info & AI Analyze banner */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5 pb-2 border-b border-neutral-800 text-xs">
        <div className="flex items-center gap-2 overflow-hidden">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 transition"
          >
            <UploadCloud className="w-3.5 h-3.5 text-amber-400" />
            <span>Upload Audio (MP3/WAV)</span>
          </button>
          <span className="text-neutral-400 truncate max-w-xs" title={audioFileName}>
            {audioFileName || 'Belum ada file audio'}
          </span>
        </div>

        {onAnalyzeAudio && (
          <button
            onClick={onAnalyzeAudio}
            disabled={isAnalyzing}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-neutral-950 font-bold text-xs shadow-md transition disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{isAnalyzing ? 'Analyzing Audio...' : 'AI Lyrics Detect & Align'}</span>
          </button>
        )}
      </div>

      {/* Waveform Visualization Canvas */}
      <div className="relative w-full h-16 sm:h-20 bg-neutral-950 rounded-xl overflow-hidden mb-3 border border-neutral-800/80 cursor-pointer">
        <canvas
          ref={waveformCanvasRef}
          width={800}
          height={80}
          onClick={handleCanvasClick}
          className="w-full h-full block"
        />

        {/* Hover / Hint overlay */}
        <div className="absolute top-1 right-2 pointer-events-none text-[10px] text-neutral-500 font-mono">
          Waveform & Segment Timeline
        </div>
      </div>

      {/* Playhead Seekbar */}
      <div className="flex items-center gap-3 mb-3">
        <span className="text-xs font-mono font-bold text-amber-400 min-w-[5.5rem]">
          {formatPlayerTime(currentTime)}
        </span>

        <input
          type="range"
          min={0}
          max={duration || 100}
          step={0.01}
          value={currentTime}
          onChange={(e) => seekTo(parseFloat(e.target.value))}
          className="flex-1 h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
        />

        <span className="text-xs font-mono text-neutral-400 min-w-[5.5rem] text-right">
          {formatPlayerTime(duration)}
        </span>
      </div>

      {/* Controls Bar: Playback, Navigation, Speed, Loop, Volume */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Playback & Segment Navigation */}
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrevSubtitle}
            className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 transition"
            title="Previous Subtitle (←)"
          >
            <SkipBack className="w-4 h-4" />
          </button>

          <button
            onClick={togglePlay}
            className="w-10 h-10 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 flex items-center justify-center font-bold shadow-lg shadow-amber-500/20 transition transform active:scale-95"
            title="Play / Pause (Space)"
          >
            {isPlaying ? (
              <Pause className="w-5 h-5 fill-neutral-950" />
            ) : (
              <Play className="w-5 h-5 fill-neutral-950 translate-x-0.5" />
            )}
          </button>

          <button
            onClick={handleNextSubtitle}
            className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 transition"
            title="Next Subtitle (→)"
          >
            <SkipForward className="w-4 h-4" />
          </button>

          {/* Loop current segment toggle */}
          <button
            onClick={() => setIsLoopingSegment(!isLoopingSegment)}
            className={`p-2 rounded-xl border text-xs flex items-center gap-1 transition ${
              isLoopingSegment
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-semibold'
                : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-400 border-neutral-700'
            }`}
            title="Loop active subtitle segment for fine-tuning"
          >
            <Repeat className="w-4 h-4" />
            <span className="hidden sm:inline text-[11px]">Loop Seg</span>
          </button>
        </div>

        {/* Speed & Volume */}
        <div className="flex items-center gap-3">
          {/* Playback Speed selector */}
          <div className="flex items-center gap-1 bg-neutral-950 px-2 py-1 rounded-lg border border-neutral-800 text-xs">
            <span className="text-neutral-500 text-[11px]">Speed:</span>
            <select
              value={playbackRate}
              onChange={(e) => handleRateChange(parseFloat(e.target.value))}
              className="bg-transparent text-neutral-200 font-mono focus:outline-none cursor-pointer"
            >
              <option value={0.5} className="bg-neutral-900">0.5x</option>
              <option value={0.75} className="bg-neutral-900">0.75x</option>
              <option value={1} className="bg-neutral-900">1.0x</option>
              <option value={1.25} className="bg-neutral-900">1.25x</option>
              <option value={1.5} className="bg-neutral-900">1.5x</option>
              <option value={2} className="bg-neutral-900">2.0x</option>
            </select>
          </div>

          {/* Volume Slider */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={toggleMute}
              className="text-neutral-400 hover:text-white transition"
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-4 h-4 text-red-400" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={isMuted ? 0 : volume}
              onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
              className="w-16 h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-neutral-300"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
