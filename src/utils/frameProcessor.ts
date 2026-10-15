import type { ImageSegmenter } from '@mediapipe/tasks-vision';
import type {
  ProcessedFrame,
  ProcessingProgressState,
  ProcessingResolution,
  ProcessingSettingsOptions,
  VideoMetadata,
} from '../types';
import { MAX_ARCHIVE_BUDGET_BYTES } from './browserCapabilities';
import { processFrameSegmentation } from './segmentationEngine';

export interface ProcessorCallbacks {
  onProgress: (state: ProcessingProgressState) => void;
  onFrameProcessed: (frame: ProcessedFrame) => void;
  onError: (error: string) => void;
  onBudgetExceeded: (retainedBytes: number, frameCount: number) => void;
}

export interface ProcessorController {
  cancel: () => void;
}

/**
 * Maximum output dimensions for each supported resolution.
 *
 * The source aspect ratio is preserved as closely as possible.
 * Smaller source videos are never enlarged.
 */
const RESOLUTION_LIMITS: Record<
  ProcessingResolution,
  { width: number; height: number }
> = {
  '480p': { width: 854, height: 480 },
  '720p': { width: 1280, height: 720 },
  '1080p': { width: 1920, height: 1080 },
};

const VIDEO_LOAD_TIMEOUT_MS = 15_000;
const VIDEO_SEEK_TIMEOUT_MS = 5_000;
const UI_YIELD_INTERVAL_MS = 8;

/**
 * Calculate output dimensions while preserving the source aspect ratio.
 *
 * The returned dimensions are even numbers for better compatibility
 * with canvas-based video processing.
 */
export function calculateDimensions(
  resolution: ProcessingResolution,
  sourceWidth: number,
  sourceHeight: number,
): { width: number; height: number } {
  if (
    !Number.isFinite(sourceWidth) ||
    !Number.isFinite(sourceHeight) ||
    sourceWidth < 1 ||
    sourceHeight < 1
  ) {
    return { width: 2, height: 2 };
  }

  const limits = RESOLUTION_LIMITS[resolution];

  if (!limits) {
    return { width: 2, height: 2 };
  }

  // Fit within the selected resolution without upscaling.
  const scale = Math.min(
    limits.width / sourceWidth,
    limits.height / sourceHeight,
    1,
  );

  const scaledWidth = sourceWidth * scale;
  const scaledHeight = sourceHeight * scale;

  const width = Math.max(
    2,
    Math.floor(scaledWidth / 2) * 2,
  );

  const height = Math.max(
    2,
    Math.floor(scaledHeight / 2) * 2,
  );

  return {
    width: Math.min(width, limits.width),
    height: Math.min(height, limits.height),
  };
}

export function startSequentialProcessing(
  videoMetadata: VideoMetadata,
  segmenter: ImageSegmenter,
  settings: ProcessingSettingsOptions,
  callbacks: ProcessorCallbacks,
): ProcessorController {
  let isCancelled = false;
  let retainedBytes = 0;
  let processedCount = 0;

  let activeVideo: HTMLVideoElement | null = null;
  let cancelPendingWait: (() => void) | null = null;
  let activeCleanup: () => void = () => {};

  const controller: ProcessorController = {
    cancel: () => {
      if (isCancelled) return;

      isCancelled = true;

      cancelPendingWait?.();
      activeVideo?.pause();
      activeCleanup();
    },
  };

  const execute = async (): Promise<void> => {
    if (isCancelled) return;

    if (
      !Number.isFinite(videoMetadata.duration) ||
      videoMetadata.duration <= 0
    ) {
      callbacks.onError('The selected video has an invalid duration.');
      return;
    }

    if (
      !Number.isFinite(settings.fps) ||
      settings.fps <= 0 ||
      settings.fps > 30
    ) {
      callbacks.onError(
        'Invalid processing FPS. Choose a value between 1 and 30.',
      );
      return;
    }

    const video = document.createElement('video');
    activeVideo = video;

    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';

    const sourceCanvas = document.createElement('canvas');
    const outputCanvas = document.createElement('canvas');

    const { width, height } = calculateDimensions(
      settings.resolution,
      videoMetadata.width,
      videoMetadata.height,
    );

    sourceCanvas.width = width;
    sourceCanvas.height = height;

    outputCanvas.width = width;
    outputCanvas.height = height;

    const sourceContext = sourceCanvas.getContext('2d', {
      willReadFrequently: true,
    });

    if (!sourceContext) {
      sourceCanvas.width = 0;
      sourceCanvas.height = 0;
      outputCanvas.width = 0;
      outputCanvas.height = 0;

      activeVideo = null;

      callbacks.onError(
        'Failed to acquire the canvas 2D context. Please try another browser.',
      );

      return;
    }

    const fps = settings.fps;
    const duration = videoMetadata.duration;
    const interval = 1 / fps;

    const totalFrames = Math.max(
      1,
      Math.ceil(duration * fps),
    );

    const startTime = performance.now();

    let isCleanedUp = false;

    const cleanup = (): void => {
      if (isCleanedUp) return;

      isCleanedUp = true;

      cancelPendingWait?.();
      cancelPendingWait = null;

      video.onloadeddata = null;
      video.onerror = null;

      video.pause();
      video.removeAttribute('src');

      try {
        video.load();
      } catch {
        // The browser may already have released the media resource.
      }

      sourceCanvas.width = 0;
      sourceCanvas.height = 0;

      outputCanvas.width = 0;
      outputCanvas.height = 0;

      if (activeVideo === video) {
        activeVideo = null;
      }

      if (activeCleanup === cleanup) {
        activeCleanup = () => {};
      }
    };

    activeCleanup = cleanup;

    /**
     * Wait for the video to load enough data to begin seeking.
     */
    const waitForVideoLoad = (): Promise<void> =>
      new Promise<void>((resolve, reject) => {
        let settled = false;

        const settle = (error?: Error): void => {
          if (settled) return;

          settled = true;

          window.clearTimeout(timeoutId);

          video.removeEventListener('loadeddata', onLoaded);
          video.removeEventListener('error', onError);

          if (cancelPendingWait === onCancel) {
            cancelPendingWait = null;
          }

          if (error) {
            reject(error);
          } else {
            resolve();
          }
        };

        const onLoaded = (): void => settle();

        const onError = (): void => {
          settle(
            new Error(
              'Failed to decode the video. The file may be damaged or unsupported.',
            ),
          );
        };

        const onCancel = (): void => settle();

        const timeoutId = window.setTimeout(() => {
          settle(
            new Error(
              'Timed out while loading the video. Please try a smaller or different video.',
            ),
          );
        }, VIDEO_LOAD_TIMEOUT_MS);

        cancelPendingWait = onCancel;

        video.addEventListener('loadeddata', onLoaded, {
          once: true,
        });

        video.addEventListener('error', onError, {
          once: true,
        });

        video.src = videoMetadata.objectUrl;

        try {
          video.load();
        } catch {
          // Setting src normally starts loading automatically.
        }

        if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
          settle();
        }
      });

    /**
     * Seek to a timestamp and wait for the browser to decode that frame.
     */
    const seekToTimestamp = (
      timestamp: number,
    ): Promise<void> =>
      new Promise<void>((resolve, reject) => {
        if (isCancelled) {
          resolve();
          return;
        }

        if (
          !video.seeking &&
          video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
          Math.abs(video.currentTime - timestamp) < 0.001
        ) {
          resolve();
          return;
        }

        let settled = false;

        const settle = (error?: Error): void => {
          if (settled) return;

          settled = true;

          window.clearTimeout(timeoutId);

          video.removeEventListener('seeked', onSeeked);
          video.removeEventListener('error', onVideoError);

          if (cancelPendingWait === onCancel) {
            cancelPendingWait = null;
          }

          if (error) {
            reject(error);
          } else {
            resolve();
          }
        };

        const onSeeked = (): void => settle();

        const onVideoError = (): void => {
          settle(
            new Error(
              'The browser encountered a video decoding error while seeking.',
            ),
          );
        };

        const onCancel = (): void => settle();

        const timeoutId = window.setTimeout(() => {
          settle(
            new Error(
              `Seeking to ${timestamp.toFixed(2)} seconds timed out.`,
            ),
          );
        }, VIDEO_SEEK_TIMEOUT_MS);

        cancelPendingWait = onCancel;

        video.addEventListener('seeked', onSeeked, {
          once: true,
        });

        video.addEventListener('error', onVideoError, {
          once: true,
        });

        try {
          video.currentTime = timestamp;
        } catch (error: unknown) {
          settle(
            error instanceof Error
              ? error
              : new Error('The browser could not seek this video.'),
          );
        }
      });

    try {
      await waitForVideoLoad();

      if (isCancelled) {
        cleanup();
        return;
      }

      if (
        video.videoWidth <= 0 ||
        video.videoHeight <= 0
      ) {
        throw new Error(
          'The browser could not read the video dimensions.',
        );
      }

      for (
        let frameIndex = 0;
        frameIndex < totalFrames;
        frameIndex++
      ) {
        if (isCancelled) {
          cleanup();
          return;
        }

        // Do not continue if the retained PNG frames have reached
        // the configured in-memory archive limit.
        if (retainedBytes >= MAX_ARCHIVE_BUDGET_BYTES) {
          cleanup();

          callbacks.onBudgetExceeded(
            retainedBytes,
            processedCount,
          );

          return;
        }

        const targetTimestamp = Math.min(
          frameIndex * interval,
          Math.max(0, duration - 0.001),
        );

        try {
          await seekToTimestamp(targetTimestamp);
        } catch (seekError: unknown) {
          if (isCancelled) {
            cleanup();
            return;
          }

          throw seekError instanceof Error
            ? seekError
            : new Error(
                'The browser could not seek to the requested video frame.',
              );
        }

        if (isCancelled) {
          cleanup();
          return;
        }

        if (
          video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA
        ) {
          throw new Error(
            'The video frame is not ready for processing.',
          );
        }

        // Decode the current video frame into the source canvas.
        sourceContext.drawImage(
          video,
          0,
          0,
          width,
          height,
        );

        let pngBlob: Blob;

        try {
          pngBlob = await processFrameSegmentation(
            segmenter,
            sourceCanvas,
            outputCanvas,
            {
              edgeSmoothing: settings.edgeSmoothing,
              threshold: settings.threshold,
            },
          );
        } catch (segmentationError: unknown) {
          if (isCancelled) {
            cleanup();
            return;
          }

          const message =
            segmentationError instanceof Error
              ? segmentationError.message
              : String(segmentationError);

          throw new Error(
            `Background removal failed on frame ${frameIndex + 1}: ${message}`,
          );
        }

        if (isCancelled) {
          cleanup();
          return;
        }

        const frameSize = pngBlob.size;

        if (
          retainedBytes + frameSize >
          MAX_ARCHIVE_BUDGET_BYTES
        ) {
          cleanup();

          callbacks.onBudgetExceeded(
            retainedBytes,
            processedCount,
          );

          return;
        }

        retainedBytes += frameSize;
        processedCount++;

        const previewUrl = URL.createObjectURL(pngBlob);

        const processedFrame: ProcessedFrame = {
          index: frameIndex,
          timestamp: targetTimestamp,
          blob: pngBlob,
          previewUrl,
          sizeBytes: frameSize,
          width,
          height,
        };

        callbacks.onFrameProcessed(processedFrame);

        const elapsedSeconds =
          (performance.now() - startTime) / 1000;

        const currentFps =
          elapsedSeconds > 0
            ? processedCount / elapsedSeconds
            : 0;

        const remainingFrames =
          totalFrames - processedCount;

        const remainingSeconds =
          currentFps > 0
            ? remainingFrames / currentFps
            : null;

        const percent = Math.min(
          100,
          Math.round(
            (processedCount / totalFrames) * 100,
          ),
        );

        callbacks.onProgress({
          currentFrame: processedCount,
          totalEstimatedFrames: totalFrames,
          percent,
          fps: Number(currentFps.toFixed(1)),
          elapsedSeconds: Math.round(elapsedSeconds),
          remainingSeconds:
            remainingSeconds !== null
              ? Math.round(remainingSeconds)
              : null,
          retainedBytes,
          maxBudgetBytes: MAX_ARCHIVE_BUDGET_BYTES,
          currentStatusText:
            `Processing frame ${processedCount} of ${totalFrames} (${percent}%)`,
        });

        // Yield to the browser so the UI remains responsive.
        await new Promise<void>((resolve) => {
          window.setTimeout(
            resolve,
            UI_YIELD_INTERVAL_MS,
          );
        });
      }

      cleanup();
    } catch (error: unknown) {
      cleanup();

      if (!isCancelled) {
        callbacks.onError(
          error instanceof Error
            ? error.message
            : String(error),
        );
      }
    }
  };

  void execute();

  return controller;
}