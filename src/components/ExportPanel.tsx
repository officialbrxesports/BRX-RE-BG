import React, { useState } from 'react';

import type {
  ProcessedFrame,
  ProcessingResolution,
  VideoMetadata,
} from '../types';

import {
  exportFramesToZip,
  triggerDownload,
} from '../utils/zipExport';

import type { ZipExportProgress } from '../utils/zipExport';

import {
  downloadVideoBlob,
  exportFramesToVideo,
} from '../utils/videoExport';

import { formatBytes } from '../utils/browserCapabilities';

import {
  Archive,
  FileArchive,
  Check,
  HardDrive,
  HelpCircle,
  AlertTriangle,
  Film,
  Download,
} from 'lucide-react';

interface ExportPanelProps {
  frames: ProcessedFrame[];
  videoMetadata: VideoMetadata;
  resolution: ProcessingResolution;
  fps: number;
  totalBytes: number;
}

function createSafeFilename(filename: string): string {
  const withoutExtension = filename.replace(/\.[^/.]+$/, '');

  const safeName = withoutExtension
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_')
    .replace(/[. ]+$/g, '')
    .trim();

  return safeName || 'video';
}

export const ExportPanel: React.FC<ExportPanelProps> = ({
  frames,
  videoMetadata,
  resolution,
  fps,
  totalBytes,
}) => {
  const [isExportingZip, setIsExportingZip] = useState(false);
  const [isExportingVideo, setIsExportingVideo] = useState(false);

  const [zipProgress, setZipProgress] =
    useState<ZipExportProgress | null>(null);

  const [videoProgress, setVideoProgress] = useState(0);

  const [zipComplete, setZipComplete] = useState(false);
  const [videoComplete, setVideoComplete] = useState(false);

  const [zipError, setZipError] = useState<string | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);

  const safeName = createSafeFilename(videoMetadata.name);

  const handleExportZip = async () => {
    if (frames.length === 0 || isExportingZip || isExportingVideo) {
      return;
    }

    try {
      setIsExportingZip(true);
      setZipComplete(false);
      setZipError(null);

      setZipProgress({
        percent: 0,
        currentFilename: 'Preparing PNG frames...',
      });

      const zipBlob = await exportFramesToZip(
        frames,
        {
          videoName: videoMetadata.name,
          resolution,
          fps,
        },
        (progress) => {
          setZipProgress(progress);
        },
      );

      if (!(zipBlob instanceof Blob) || zipBlob.size === 0) {
        throw new Error(
          'The ZIP archive is empty. Please process the video again.',
        );
      }

      triggerDownload(
        zipBlob,
        `${safeName}_transparent_frames_${resolution}.zip`,
      );

      setZipComplete(true);
    } catch (error) {
      setZipError(
        error instanceof Error
          ? error.message
          : 'An unexpected error occurred while creating the ZIP archive.',
      );
    } finally {
      setIsExportingZip(false);
      setZipProgress(null);
    }
  };

  const handleExportVideo = async () => {
    if (frames.length === 0 || isExportingVideo || isExportingZip) {
      return;
    }

    try {
      setIsExportingVideo(true);
      setVideoComplete(false);
      setVideoError(null);
      setVideoProgress(0);

      const videoBlob = await exportFramesToVideo(frames, {
        fps,
        filename: safeName,
        onProgress: setVideoProgress,
      });

      if (!videoBlob.size) {
        throw new Error('The exported video is empty.');
      }

      downloadVideoBlob(
        videoBlob,
        `${safeName}_background_removed_${resolution}`,
      );

      setVideoComplete(true);
    } catch (error) {
      setVideoError(
        error instanceof Error
          ? error.message
          : 'An unexpected error occurred during video export.',
      );
    } finally {
      setIsExportingVideo(false);
    }
  };

  const isExportDisabled =
    frames.length === 0 || isExportingZip || isExportingVideo;

  return (
    <section
      className="space-y-5 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 sm:p-5"
      aria-label="Export processed video"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800/80 pb-3">
        <div className="flex items-center gap-2">
          <Archive
            className="h-4 w-4 text-emerald-400"
            aria-hidden="true"
          />

          <h3 className="text-sm font-semibold text-zinc-100">
            Export & Production Packaging
          </h3>
        </div>

        <div className="flex items-center gap-1.5 font-mono text-xs text-zinc-400">
          <HardDrive
            className="h-3.5 w-3.5 text-zinc-500"
            aria-hidden="true"
          />

          <span>PNG Data: {formatBytes(totalBytes)}</span>
        </div>
      </div>

      {/* ZIP export */}
      <div className="flex flex-col items-center justify-between gap-4 rounded-xl border border-zinc-800/90 bg-zinc-950/80 p-4 sm:flex-row">
        <div className="min-w-0 space-y-1 text-center sm:text-left">
          <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
            <span className="font-semibold text-zinc-100">
              Transparent PNG Sequence
            </span>

            <span className="rounded border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 font-mono text-[11px] text-emerald-400">
              ZIP + manifest.json
            </span>
          </div>

          <p className="text-xs leading-relaxed text-zinc-400">
            Export {frames.length} numbered transparent PNG frames.
          </p>

          <p className="text-[11px] text-zinc-500">
            {resolution} · {fps} FPS · {formatBytes(totalBytes)} PNG data
          </p>
        </div>

        <button
          type="button"
          onClick={handleExportZip}
          disabled={isExportDisabled}
          className={`flex w-full shrink-0 items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-xs font-medium transition sm:w-auto ${
            isExportDisabled
              ? 'cursor-not-allowed bg-zinc-800 text-zinc-400'
              : zipComplete
                ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                : 'bg-emerald-500 font-semibold text-zinc-950 shadow-lg shadow-emerald-950/50 hover:bg-emerald-400'
          }`}
        >
          {isExportingZip ? (
            <>
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-zinc-400 border-t-transparent" />
              <span>Creating ZIP ({zipProgress?.percent ?? 0}%)</span>
            </>
          ) : zipComplete ? (
            <>
              <Check className="h-4 w-4" />
              <span>Download ZIP Again</span>
            </>
          ) : (
            <>
              <FileArchive className="h-4 w-4" />
              <span>Download ZIP</span>
            </>
          )}
        </button>
      </div>

      {/* Video export */}
      <div className="flex flex-col items-center justify-between gap-4 rounded-xl border border-sky-900/70 bg-sky-950/20 p-4 sm:flex-row">
        <div className="min-w-0 space-y-1 text-center sm:text-left">
          <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
            <span className="font-semibold text-zinc-100">
              Background-Removed Video
            </span>

            <span className="rounded border border-sky-500/20 bg-sky-500/10 px-2 py-0.5 font-mono text-[11px] text-sky-300">
              WebM
            </span>
          </div>

          <p className="text-xs leading-relaxed text-zinc-400">
            Combine the processed PNG frames into a downloadable video.
          </p>

          <p className="text-[11px] text-zinc-500">
            {resolution} · {fps} FPS · {frames.length} frames
          </p>
        </div>

        <button
          type="button"
          onClick={handleExportVideo}
          disabled={isExportDisabled}
          className={`flex w-full shrink-0 items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-xs font-semibold transition sm:w-auto ${
            isExportDisabled
              ? 'cursor-not-allowed bg-zinc-800 text-zinc-400'
              : videoComplete
                ? 'bg-sky-600 text-white hover:bg-sky-500'
                : 'bg-sky-500 text-zinc-950 shadow-lg shadow-sky-950/40 hover:bg-sky-400'
          }`}
        >
          {isExportingVideo ? (
            <>
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-zinc-400 border-t-transparent" />
              <span>Rendering ({videoProgress}%)</span>
            </>
          ) : videoComplete ? (
            <>
              <Check className="h-4 w-4" />
              <span>Download Video Again</span>
            </>
          ) : (
            <>
              <Film className="h-4 w-4" />
              <Download className="h-4 w-4" />
              <span>Download Video</span>
            </>
          )}
          {frames.length < Math.ceil(videoMetadata.duration * fps) && (
            <p className="mt-2 text-xs text-amber-400">
              Processing incomplete: {frames.length} of approximately{' '}
              {Math.ceil(videoMetadata.duration * fps)} frames are available.
              Exported video will be shorter than the original.
            </p>
          )}
        </button>
      </div>

      {/* ZIP progress */}
      {isExportingZip && zipProgress && (
        <div className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="min-w-0 truncate text-zinc-400">
              {zipProgress.currentFilename || 'Packaging archive...'}
            </span>

            <span className="shrink-0 font-mono text-emerald-400">
              {zipProgress.percent}%
            </span>
          </div>

          <div
            className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800"
            role="progressbar"
            aria-label="ZIP archive export progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.min(100, Math.max(0, zipProgress.percent))}
          >
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-150"
              style={{
                width: `${Math.min(100, Math.max(0, zipProgress.percent))}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Video progress */}
      {isExportingVideo && (
        <div className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-400">Rendering video frames...</span>
            <span className="font-mono text-sky-300">{videoProgress}%</span>
          </div>

          <div
            className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800"
            role="progressbar"
            aria-label="Video export progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={videoProgress}
          >
            <div
              className="h-full rounded-full bg-sky-500 transition-all duration-150"
              style={{ width: `${videoProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Errors */}
      {zipError && (
        <div
          className="flex items-start gap-2 rounded-lg border border-red-800/60 bg-red-950/40 p-3 text-sm text-red-200"
          role="alert"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />

          <div>
            <p className="font-medium">ZIP export failed</p>
            <p className="mt-1 break-words text-xs leading-relaxed">
              {zipError}
            </p>

            <button
              type="button"
              onClick={() => setZipError(null)}
              className="mt-2 text-xs text-red-300 underline underline-offset-2"
            >
              Dismiss error
            </button>
          </div>
        </div>
      )}

      {videoError && (
        <div
          className="flex items-start gap-2 rounded-lg border border-red-800/60 bg-red-950/40 p-3 text-sm text-red-200"
          role="alert"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />

          <div>
            <p className="font-medium">Video export failed</p>
            <p className="mt-1 break-words text-xs leading-relaxed">
              {videoError}
            </p>

            <button
              type="button"
              onClick={() => setVideoError(null)}
              className="mt-2 text-xs text-red-300 underline underline-offset-2"
            >
              Dismiss error
            </button>
          </div>
        </div>
      )}

      {/* Transparency limitation */}
      <div className="space-y-2 rounded-xl border border-zinc-800/80 bg-zinc-950/50 p-4">
        <div className="flex items-start gap-2 text-xs font-semibold text-zinc-300">
          <HelpCircle
            className="mt-0.5 h-4 w-4 shrink-0 text-amber-400"
            aria-hidden="true"
          />

          <span>Important: video transparency</span>
        </div>

        <p className="text-xs leading-relaxed text-zinc-400">
          ZIP export preserves the original transparent PNG frames. The
          separate WebM export uses your browser&apos;s MediaRecorder, which
          may flatten transparency or encode without an alpha channel.
          A WebM file should not be assumed to have a transparent background.
        </p>

        <p className="text-xs leading-relaxed text-zinc-400">
          For guaranteed transparent output, use a verified alpha-capable
          video encoder and codec. Browser support varies, so check the
          exported video in your target editor before using it.
        </p>
      </div>
    </section>
  );
};