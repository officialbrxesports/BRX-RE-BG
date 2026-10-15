import React, { useState, useEffect, useRef } from 'react';
import type { ProcessedFrame } from '../types';
import {
  Play,
  Pause,
  Download,
  Layers,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { triggerDownload } from '../utils/zipExport';

interface FrameGalleryProps {
  frames: ProcessedFrame[];
  targetFps: number;
}

type BackgroundMode = 'checker' | 'black' | 'white' | 'green';

const MIN_PLAYBACK_INTERVAL_MS = 20;

export const FrameGallery: React.FC<FrameGalleryProps> = ({
  frames,
  targetFps,
}) => {
  const [activeFrameIndex, setActiveFrameIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [backgroundMode, setBackgroundMode] =
    useState<BackgroundMode>('checker');

  const previousFirstFrameRef = useRef<number | null>(null);

  // Reset playback and selection when a new frame sequence arrives.
  useEffect(() => {
    const firstFrameIndex = frames[0]?.index ?? null;

    if (previousFirstFrameRef.current !== firstFrameIndex) {
      previousFirstFrameRef.current = firstFrameIndex;
      setActiveFrameIndex(0);
      setIsPlaying(false);
      return;
    }

    if (frames.length === 0) {
      setActiveFrameIndex(0);
      setIsPlaying(false);
      return;
    }

    setActiveFrameIndex((currentIndex) =>
      Math.min(currentIndex, frames.length - 1),
    );
  }, [frames]);

  // Stop playback when the component unmounts.
  useEffect(() => {
    return () => {
      setIsPlaying(false);
    };
  }, []);

  // Flipbook playback.
  useEffect(() => {
    if (!isPlaying || frames.length <= 1) {
      return;
    }

    const safeFps =
      Number.isFinite(targetFps) && targetFps > 0 ? targetFps : 15;

    const intervalMs = Math.max(
      MIN_PLAYBACK_INTERVAL_MS,
      Math.round(1000 / safeFps),
    );

    const timer = window.setInterval(() => {
      setActiveFrameIndex((previousIndex) => {
        if (previousIndex >= frames.length - 1) {
          return 0;
        }

        return previousIndex + 1;
      });
    }, intervalMs);

    return () => {
      window.clearInterval(timer);
    };
  }, [isPlaying, frames.length, targetFps]);

  if (frames.length === 0) {
    return null;
  }

  const safeActiveFrameIndex = Math.min(
    Math.max(activeFrameIndex, 0),
    frames.length - 1,
  );

  const currentFrame = frames[safeActiveFrameIndex];

  const handleDownloadSingle = (frame: ProcessedFrame) => {
    if (!frame?.blob) {
      return;
    }

    const filename = `frame_${String(frame.index + 1).padStart(4, '0')}.png`;

    triggerDownload(frame.blob, filename);
  };

  const handlePreviousFrame = () => {
    setIsPlaying(false);
    setActiveFrameIndex((previousIndex) =>
      Math.max(0, previousIndex - 1),
    );
  };

  const handleNextFrame = () => {
    setIsPlaying(false);
    setActiveFrameIndex((previousIndex) =>
      Math.min(frames.length - 1, previousIndex + 1),
    );
  };

  const handleSelectFrame = (index: number) => {
    setIsPlaying(false);
    setActiveFrameIndex(index);
  };

  const getBackgroundClass = (): string => {
    switch (backgroundMode) {
      case 'black':
        return 'bg-black';

      case 'white':
        return 'bg-white';

      case 'green':
        return 'bg-[#00b140]';

      case 'checker':
      default:
        return [
          'bg-[#141414]',
          'bg-[linear-gradient(45deg,#242424_25%,transparent_25%),linear-gradient(-45deg,#242424_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#242424_75%),linear-gradient(-45deg,transparent_75%,#242424_75%)]',
          'bg-[size:16px_16px]',
          'bg-[position:0_0,0_8px,8px_-8px,-8px_0]',
        ].join(' ');
    }
  };

  const backgroundClass = getBackgroundClass();

  return (
    <section
      className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 sm:p-5"
      aria-label="Transparent frame gallery"
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800/80 pb-3">
        <div className="flex items-center gap-2">
          <Layers
            className="h-4 w-4 text-emerald-400"
            aria-hidden="true"
          />

          <div>
            <h3 className="text-sm font-semibold text-zinc-100">
              Transparent Sequence Inspector
            </h3>

            <p className="mt-0.5 text-xs text-zinc-500">
              {frames.length} PNG {frames.length === 1 ? 'frame' : 'frames'}
            </p>
          </div>
        </div>

        {/* Preview background selector */}
        <div
          className="flex flex-wrap items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-950 p-1"
          aria-label="Preview background"
        >
          <span className="hidden px-1.5 text-[11px] text-zinc-500 sm:inline">
            Background:
          </span>

          {(
            [
              ['checker', 'Checker'],
              ['black', 'Black'],
              ['white', 'White'],
              ['green', 'Green'],
            ] as const
          ).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              aria-pressed={backgroundMode === mode}
              onClick={() => setBackgroundMode(mode)}
              className={`rounded px-2 py-1 text-[11px] transition ${
                backgroundMode === mode
                  ? 'bg-zinc-800 font-medium text-zinc-100'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Main preview */}
      <div
        className={`relative flex aspect-video items-center justify-center overflow-hidden rounded-xl border border-zinc-800 ${backgroundClass}`}
      >
        {currentFrame && (
          <img
            key={`${currentFrame.index}-${currentFrame.previewUrl}`}
            src={currentFrame.previewUrl}
            alt={`Transparent PNG frame ${currentFrame.index + 1}`}
            className="relative z-10 max-h-full max-w-full select-none object-contain"
            draggable={false}
          />
        )}

        {/* Frame information */}
        <div className="absolute left-3 top-3 z-20 rounded border border-white/10 bg-black/75 px-2 py-1 text-[11px] text-zinc-200 backdrop-blur">
          <span className="font-mono">
            Frame {safeActiveFrameIndex + 1} / {frames.length}
          </span>

          {currentFrame && (
            <span className="ml-2 font-mono text-zinc-400">
              {currentFrame.width} × {currentFrame.height}
            </span>
          )}
        </div>

        {/* Single-frame download */}
        <button
          type="button"
          onClick={() => handleDownloadSingle(currentFrame)}
          disabled={!currentFrame?.blob}
          className="absolute right-3 top-3 z-20 flex items-center gap-1.5 rounded border border-white/10 bg-black/75 px-2.5 py-1.5 text-xs text-zinc-200 transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
          title="Download this frame as a transparent PNG"
          aria-label={`Download frame ${(currentFrame?.index ?? 0) + 1} as PNG`}
        >
          <Download
            className="h-3.5 w-3.5 text-emerald-400"
            aria-hidden="true"
          />

          <span className="hidden sm:inline">Download PNG</span>
        </button>
      </div>

      {/* Playback and frame navigation */}
      <div className="flex items-center gap-2 rounded-lg border border-zinc-800/80 bg-zinc-950/70 p-3 sm:gap-3">
        <button
          type="button"
          onClick={() => setIsPlaying((playing) => !playing)}
          disabled={frames.length <= 1}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-emerald-500/40 bg-emerald-500/20 text-emerald-300 transition hover:bg-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-40"
          title={isPlaying ? 'Pause playback' : 'Play frame sequence'}
          aria-label={isPlaying ? 'Pause sequence' : 'Play sequence'}
        >
          {isPlaying ? (
            <Pause className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Play className="ml-0.5 h-4 w-4" aria-hidden="true" />
          )}
        </button>

        <button
          type="button"
          onClick={handlePreviousFrame}
          disabled={safeActiveFrameIndex === 0}
          className="shrink-0 p-1 text-zinc-400 transition hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-30"
          title="Previous frame"
          aria-label="Previous frame"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
        </button>

        <input
          type="range"
          min={0}
          max={Math.max(0, frames.length - 1)}
          value={safeActiveFrameIndex}
          aria-label="Select preview frame"
          aria-valuetext={`Frame ${safeActiveFrameIndex + 1} of ${frames.length}`}
          onChange={(event) =>
            handleSelectFrame(Number(event.target.value))
          }
          className="h-1.5 min-w-0 flex-1 cursor-pointer appearance-none rounded-lg bg-zinc-800 accent-emerald-500"
        />

        <button
          type="button"
          onClick={handleNextFrame}
          disabled={safeActiveFrameIndex >= frames.length - 1}
          className="shrink-0 p-1 text-zinc-400 transition hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-30"
          title="Next frame"
          aria-label="Next frame"
        >
          <ChevronRight className="h-5 w-5" aria-hidden="true" />
        </button>

        <span className="w-16 shrink-0 text-right font-mono text-xs text-zinc-400">
          {safeActiveFrameIndex + 1} / {frames.length}
        </span>
      </div>

      {/* Frame filmstrip */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-medium text-zinc-300">Filmstrip</h4>

          <span className="text-[11px] text-zinc-500">
            Select a frame to preview
          </span>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2">
          {frames.map((frame, index) => (
            <button
              key={`${frame.index}-${frame.previewUrl}`}
              type="button"
              aria-label={`Show frame ${frame.index + 1}`}
              aria-pressed={safeActiveFrameIndex === index}
              onClick={() => handleSelectFrame(index)}
              className={`relative h-12 w-16 shrink-0 overflow-hidden rounded-md border transition sm:h-14 sm:w-20 ${
                safeActiveFrameIndex === index
                  ? 'border-emerald-500 ring-2 ring-emerald-500/40'
                  : 'border-zinc-800 opacity-70 hover:border-zinc-600 hover:opacity-100'
              } ${backgroundClass}`}
            >
              <img
                src={frame.previewUrl}
                alt={`Thumbnail for frame ${frame.index + 1}`}
                loading="lazy"
                draggable={false}
                className="h-full w-full select-none object-contain"
              />

              <span className="absolute bottom-0 right-0 rounded-tl bg-black/75 px-1 text-[9px] font-mono text-zinc-200">
                {frame.index + 1}
              </span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
};