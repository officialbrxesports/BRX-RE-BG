import type { SystemCapabilities } from "../types";

export const MAX_ARCHIVE_BUDGET_BYTES = 200 * 1024 * 1024;
export const MAX_VIDEO_DURATION_SECONDS = 60;
export const MAX_VIDEO_FILE_BYTES = 250 * 1024 * 1024;
export const LARGE_VIDEO_WARNING_BYTES = 100 * 1024 * 1024;

export const MAX_VIDEO_WIDTH = 3840;
export const MAX_VIDEO_HEIGHT = 2160;

export function detectBrowserCapabilities(): SystemCapabilities {
  const nav = typeof navigator !== "undefined" ? navigator : null;

  const deviceMemory =
    nav && "deviceMemory" in nav
      ? (nav as Navigator & { deviceMemory?: number }).deviceMemory ?? null
      : null;

  const concurrency = nav?.hardwareConcurrency ?? 2;

  let webGlSupported = false;

  if (typeof document !== "undefined") {
    try {
      const canvas = document.createElement("canvas");
      const gl =
        canvas.getContext("webgl2") ||
        canvas.getContext("webgl");

      webGlSupported = Boolean(gl);

      gl?.getExtension("WEBGL_lose_context")?.loseContext();
    } catch {
      webGlSupported = false;
    }
  }

  const offscreenCanvasSupported =
    typeof OffscreenCanvas !== "undefined";

  // These are recommendations, not hard resolution restrictions.
  const reasons720p: string[] = [];

  if (deviceMemory !== null && deviceMemory < 4) {
    reasons720p.push(
      "Your browser reports less than 4 GB of device memory. Processing may be slower."
    );
  }

  if (concurrency < 4) {
    reasons720p.push(
      "Your device reports fewer than 4 logical CPU threads. Processing may be slower."
    );
  }

  if (!webGlSupported) {
    reasons720p.push(
      "WebGL is unavailable. MediaPipe may need CPU processing if supported."
    );
  }

  if (reasons720p.length === 0) {
    reasons720p.push(
      "720p is available. Actual performance depends on your browser and device."
    );
  }

  // Do not lock 720p solely because a hardware estimate is unavailable.
  const canHandle720p = true;

  const reasons1080p: string[] = [];

  if (deviceMemory !== null && deviceMemory < 4) {
    reasons1080p.push(
      "The browser reports less than 4 GB of device memory. 1080p may use substantial memory."
    );
  }

  if (concurrency < 4) {
    reasons1080p.push(
      "The device reports fewer than 4 logical CPU threads. Processing may be slower."
    );
  }

  if (!webGlSupported) {
    reasons1080p.push(
      "WebGL is unavailable. GPU acceleration may not be available."
    );
  }

  if (reasons1080p.length === 0) {
    reasons1080p.push(
      "1080p is available. Processing speed and memory use depend on your device."
    );
  }

  // Make 1080p selectable; runtime processing and memory checks still apply.
  const canHandle1080p = true;

  return {
    deviceMemoryGB: deviceMemory,
    hardwareConcurrency: concurrency,
    webGlSupported,
    offscreenCanvasSupported,
    canHandle720p,
    reasons720p,
    canHandle1080p,
    reasons1080p,
  };
}

export function formatBytes(
  bytes: number,
  decimals = 1,
): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }

  const precision = Math.max(0, Math.min(6, Math.floor(decimals)));
  const units = ["B", "KiB", "MiB", "GiB", "TiB"];

  const unitIndex = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );

  return `${(bytes / 1024 ** unitIndex).toFixed(precision)} ${units[unitIndex]}`;
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "0.0s";
  }

  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;

  if (minutes > 0) {
    return `${minutes}:${remainder.toFixed(1).padStart(4, "0")}s`;
  }

  return `${remainder.toFixed(1)}s`;
}