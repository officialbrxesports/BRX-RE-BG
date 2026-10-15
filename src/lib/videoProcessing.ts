import type {
  MaskMessage,
  ProcessingResolution,
  VideoPresentation,
} from "@/types/video";

export {
  LARGE_VIDEO_WARNING_BYTES,
  MAX_VIDEO_DURATION_SECONDS,
  MAX_VIDEO_FILE_BYTES,
  MAX_VIDEO_HEIGHT,
  MAX_VIDEO_WIDTH,
} from "@/utils/browserCapabilities";

export const PREVIEW_MAX_WIDTH = 1280;
export const PREVIEW_MAX_HEIGHT = 720;

export const PROCESSING_480P_WIDTH = 854;
export const PROCESSING_480P_HEIGHT = 480;


export const PROCESSING_TIMEOUT_MS = 30_000;
export const PROCESSING_PLAYBACK_RATE = 0.25;

const FRAME_WAIT_TIMEOUT_MS = 15_000;

export function isVideoFile(file: File): boolean {
  const supportedExtension =
    /\.(mp4|webm|mov|m4v|ogv|ogg|avi|mkv)$/i.test(file.name);

  return file.type.startsWith("video/") || supportedExtension;
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "0:00";
  }

  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60);

  return `${minutes}:${remainder.toString().padStart(2, "0")}`;
}

export function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "The frame could not be processed.";
}

export function getPngFilename(value: string): string {
  const baseName = value
    .trim()
    .replace(/\.png$/i, "")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
    .replace(/[. ]+$/g, "")
    .slice(0, 120);

  return `${baseName || "processed-frame"}.png`;
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return "0 B";
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KiB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`;
}

export function getProcessingDimensions(
  width: number,
  height: number,
  resolution: ProcessingResolution,
): { width: number; height: number } {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    throw new Error("The video has invalid dimensions.");
  }

  const resolutionLimits: Record<
    ProcessingResolution,
    { width: number; height: number }
  > = {
    "480p": {
      width: PROCESSING_480P_WIDTH,
      height: PROCESSING_480P_HEIGHT,
    },
    "720p": {
      width: 1280,
      height: 720,
    },
    "1080p": {
      width: 1920,
      height: 1080,
    },
  };

  const limits = resolutionLimits[resolution];

  const scale = Math.min(
    limits.width / width,
    limits.height / height,
    1,
  );

  // Keep dimensions even for better video/canvas compatibility.
  const outputWidth = Math.max(
    2,
    Math.floor((width * scale) / 2) * 2,
  );

  const outputHeight = Math.max(
    2,
    Math.floor((height * scale) / 2) * 2,
  );

  return {
    width: outputWidth,
    height: outputHeight,
  };
}

export function waitForVideoFrame(
  video: HTMLVideoElement,
  signal: AbortSignal,
): Promise<void> {
  if (signal.aborted) {
    return Promise.reject(
      new DOMException("Frame processing cancelled.", "AbortError"),
    );
  }

  if (video.error) {
    return Promise.reject(
      new Error("The browser could not decode this video."),
    );
  }

  if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve, reject) => {
    let settled = false;

    const cleanup = () => {
      window.clearTimeout(timeout);
      video.removeEventListener("loadeddata", onLoaded);
      video.removeEventListener("error", onError);
      signal.removeEventListener("abort", onAbort);
    };

    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      cleanup();

      if (error) {
        reject(error);
      } else {
        resolve();
      }
    };

    const onLoaded = () => finish();

    const onError = () =>
      finish(
        new Error(
          "The browser could not decode this video. Try an MP4 or WebM with a supported codec.",
        ),
      );

    const onAbort = () =>
      finish(new DOMException("Frame processing cancelled.", "AbortError"));

    const timeout = window.setTimeout(
      () =>
        finish(
          new Error(
            "The browser could not decode a frame in time. Try a different video format or codec.",
          ),
        ),
      FRAME_WAIT_TIMEOUT_MS,
    );

    video.addEventListener("loadeddata", onLoaded, { once: true });
    video.addEventListener("error", onError, { once: true });
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

export function seekVideoToStart(
  video: HTMLVideoElement,
  signal: AbortSignal,
): Promise<void> {
  if (signal.aborted) {
    return Promise.reject(
      new DOMException("Frame processing cancelled.", "AbortError"),
    );
  }

  if (video.error) {
    return Promise.reject(
      new Error("The browser could not decode the video."),
    );
  }

  if (Math.abs(video.currentTime) < 0.001 && !video.seeking) {
    return waitForVideoFrame(video, signal);
  }

  return new Promise<void>((resolve, reject) => {
    let settled = false;

    const cleanup = () => {
      window.clearTimeout(timeout);
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
      signal.removeEventListener("abort", onAbort);
    };

    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      cleanup();

      if (error) {
        reject(error);
      } else {
        resolve();
      }
    };

    const onSeeked = () => {
      if (video.error) {
        finish(new Error("The browser could not decode the first video frame."));
        return;
      }

      void waitForVideoFrame(video, signal).then(
        () => finish(),
        (error: unknown) =>
          finish(
            error instanceof Error
              ? error
              : new Error("The first video frame could not be decoded."),
          ),
      );
    };

    const onError = () =>
      finish(new Error("The browser could not decode the first video frame."));

    const onAbort = () =>
      finish(new DOMException("Video processing cancelled.", "AbortError"));

    const timeout = window.setTimeout(
      () =>
        finish(
          new Error("The browser could not seek to the start of this video."),
        ),
      PROCESSING_TIMEOUT_MS,
    );

    video.addEventListener("seeked", onSeeked, { once: true });
    video.addEventListener("error", onError, { once: true });
    signal.addEventListener("abort", onAbort, { once: true });

    try {
      video.currentTime = 0;
    } catch {
      finish(new Error("The browser could not seek to the start of this video."));
    }
  });
}

export function waitForVideoPresentation(
  video: HTMLVideoElement,
  signal: AbortSignal,
): Promise<VideoPresentation> {
  if (signal.aborted) {
    return Promise.reject(
      new DOMException("Frame processing cancelled.", "AbortError"),
    );
  }

  if (video.error) {
    return Promise.reject(
      new Error("The browser failed to decode the video."),
    );
  }

  if (video.ended) {
    return Promise.resolve({ type: "ended" });
  }

  const hasQualityCounter =
    typeof video.getVideoPlaybackQuality === "function";

  const hasFrameCallback =
    typeof video.requestVideoFrameCallback === "function";

  if (!hasQualityCounter && !hasFrameCallback) {
    return Promise.reject(
      new Error(
        "This browser does not support frame-by-frame video processing.",
      ),
    );
  }

  return new Promise<VideoPresentation>((resolve, reject) => {
    let callbackId: number | null = null;
    let pollId: number | null = null;
    let settled = false;

    const initialQuality = hasQualityCounter
      ? video.getVideoPlaybackQuality()
      : null;

    const cleanup = () => {
      window.clearTimeout(timeout);

      if (pollId !== null) {
        window.clearInterval(pollId);
      }

      if (
        callbackId !== null &&
        typeof video.cancelVideoFrameCallback === "function"
      ) {
        video.cancelVideoFrameCallback(callbackId);
      }

      video.removeEventListener("ended", onEnded);
      video.removeEventListener("error", onError);
      signal.removeEventListener("abort", onAbort);
    };

    const settleResolve = (presentation: VideoPresentation) => {
      if (settled) return;

      settled = true;
      cleanup();

      if (presentation.type === "frame") {
        video.pause();
      }

      resolve(presentation);
    };

    const settleReject = (error: Error) => {
      if (settled) return;

      settled = true;
      cleanup();
      reject(error);
    };

    const onEnded = () =>
      settleResolve({ type: "ended" });

    const onError = () =>
      settleReject(
        new Error(
          "The browser failed to decode a video frame. The codec may be unsupported.",
        ),
      );

    const onAbort = () =>
      settleReject(
        new DOMException("Frame processing cancelled.", "AbortError"),
      );

    const timeout = window.setTimeout(
      () =>
        settleReject(
          new Error(
            "The video decoder stopped presenting frames. Check the video codec and try again.",
          ),
        ),
      PROCESSING_TIMEOUT_MS,
    );

    video.addEventListener("ended", onEnded, { once: true });
    video.addEventListener("error", onError, { once: true });
    signal.addEventListener("abort", onAbort, { once: true });

    if (hasQualityCounter && initialQuality) {
      pollId = window.setInterval(() => {
        const quality = video.getVideoPlaybackQuality();

        if (quality.totalVideoFrames > initialQuality.totalVideoFrames) {
          settleResolve({
            type: "frame",
            mediaTime: video.currentTime,
            presentedFrames: quality.totalVideoFrames,
            droppedFrames: quality.droppedVideoFrames,
          });
        }
      }, 4);
    } else if (hasFrameCallback) {
      callbackId = video.requestVideoFrameCallback((_now, metadata) => {
        settleResolve({
          type: "frame",
          mediaTime: metadata.mediaTime,
          presentedFrames: metadata.presentedFrames,
          droppedFrames: null,
        });
      });
    }

    void video.play().catch(() => {
      settleReject(
        new Error("The browser could not play this video for frame processing."),
      );
    });
  });
}

export function applySegmentationMask(
  video: HTMLVideoElement,
  outputCanvas: HTMLCanvasElement,
  maskCanvas: HTMLCanvasElement,
  result: MaskMessage,
  width: number,
  height: number,
  previousMaskImage: ImageData | null,
): ImageData {
  const outputContext = outputCanvas.getContext("2d");
  const maskContext = maskCanvas.getContext("2d");

  if (!outputContext || !maskContext) {
    throw new Error("The browser could not create the required 2D canvas.");
  }

  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1 ||
    result.width < 1 ||
    result.height < 1 ||
    result.categories.length !== result.width * result.height
  ) {
    throw new Error("The AI model returned an invalid foreground mask.");
  }

  if (outputCanvas.width !== width || outputCanvas.height !== height) {
    outputCanvas.width = width;
    outputCanvas.height = height;
  }

  if (
    maskCanvas.width !== result.width ||
    maskCanvas.height !== result.height
  ) {
    maskCanvas.width = result.width;
    maskCanvas.height = result.height;
  }

  const maskImage =
    previousMaskImage?.width === result.width &&
    previousMaskImage.height === result.height
      ? previousMaskImage
      : maskContext.createImageData(result.width, result.height);

  for (let index = 0; index < result.categories.length; index += 1) {
    const offset = index * 4;

    maskImage.data[offset] = 255;
    maskImage.data[offset + 1] = 255;
    maskImage.data[offset + 2] = 255;
    maskImage.data[offset + 3] =
      result.categories[index] === 1 ? 255 : 0;
  }

  maskContext.putImageData(maskImage, 0, 0);

  outputContext.clearRect(0, 0, width, height);
  outputContext.globalCompositeOperation = "source-over";
  outputContext.drawImage(video, 0, 0, width, height);
  outputContext.globalCompositeOperation = "destination-in";
  outputContext.drawImage(maskCanvas, 0, 0, width, height);
  outputContext.globalCompositeOperation = "source-over";

  return maskImage;
}
