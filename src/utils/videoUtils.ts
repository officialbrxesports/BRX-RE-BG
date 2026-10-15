import type { VideoMetadata } from '../types';
import {
  formatBytes,
  MAX_VIDEO_DURATION_SECONDS,
  MAX_VIDEO_FILE_BYTES,
  MAX_VIDEO_HEIGHT,
  MAX_VIDEO_WIDTH,
} from './browserCapabilities';

export interface VideoValidationResult {
  valid: boolean;
  error?: string;
  metadata?: VideoMetadata;
}

const SUPPORTED_VIDEO_MIME_TYPES = new Set([
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-m4v',
]);
const SUPPORTED_VIDEO_EXTENSION = /\.(mp4|webm|mov|m4v)$/i;

export function loadAndValidateVideo(file: File): Promise<VideoValidationResult> {
  return new Promise((resolve) => {
    if (file.size > MAX_VIDEO_FILE_BYTES) {
      resolve({ valid: false, error: `This video is ${(file.size / (1024 * 1024)).toFixed(1)} MiB. BRX accepts files up to 250 MiB.` });
      return;
    }

    const mimeType = file.type.toLowerCase().split(';')[0].trim();
    if (!SUPPORTED_VIDEO_EXTENSION.test(file.name) && !SUPPORTED_VIDEO_MIME_TYPES.has(mimeType)) {
      resolve({
        valid: false,
        error: `“${file.name}” is not a supported video format. Choose an MP4, WebM, MOV, or M4V file.`,
      });
      return;
    }

    let objectUrl: string;
    try {
      objectUrl = URL.createObjectURL(file);
    } catch {
      resolve({ valid: false, error: 'The selected file could not be opened by this browser.' });
      return;
    }

    const video = document.createElement('video');
    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;

    let settled = false;
    const cleanup = () => {
      window.clearTimeout(timeoutId);
      video.onloadedmetadata = null;
      video.onloadeddata = null;
      video.onerror = null;
      video.pause();
      video.removeAttribute('src');
      video.load();
    };
    const finish = (result: VideoValidationResult, retainObjectUrl = false) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (!retainObjectUrl) URL.revokeObjectURL(objectUrl);
      resolve(result);
    };
    const timeoutId = window.setTimeout(() => {
      finish({
        valid: false,
        error: 'Video metadata or its first frame could not be read in time. The file may be damaged or use an unsupported codec.',
      });
    }, 15_000);

    const createValidResult = (duration: number, width: number, height: number): VideoValidationResult => ({
      valid: true,
      metadata: {
        file,
        name: file.name,
        size: file.size,
        formattedSize: formatBytes(file.size),
        duration,
        width,
        height,
        aspectRatio: width / height,
        objectUrl,
      },
    });

    video.onloadedmetadata = () => {
      const duration = video.duration;
      const width = video.videoWidth;
      const height = video.videoHeight;

      if (!Number.isFinite(duration) || duration <= 0) {
        finish({ valid: false, error: 'The browser could not read a valid video duration. Try re-encoding the file.' });
        return;
      }
      if (duration > MAX_VIDEO_DURATION_SECONDS) {
        finish({
          valid: false,
          error: `Video duration is ${duration.toFixed(2)} seconds. BRX accepts videos up to 60.00 seconds.`,
        });
        return;
      }
      if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) {
        finish({ valid: false, error: 'The browser could not read the video dimensions. The file may be damaged or use an unsupported codec.' });
        return;
      }
      if (width > MAX_VIDEO_WIDTH || height > MAX_VIDEO_HEIGHT) {
        finish({ valid: false, error: `Source dimensions ${width} x ${height} exceed BRX maximum ${MAX_VIDEO_WIDTH} x ${MAX_VIDEO_HEIGHT}.` });
        return;
      }

      const result = createValidResult(duration, width, height);
      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        finish(result, true);
      } else {
        video.onloadeddata = () => finish(result, true);
      }
    };

    video.onerror = () => {
      finish({
        valid: false,
        error: `The browser could not decode “${file.name}”. The container or video codec may be unsupported; try an MP4 or WebM encoded with a browser-compatible codec.`,
      });
    };

    try {
      video.src = objectUrl;
    } catch {
      finish({ valid: false, error: 'The browser could not open this video file.' });
    }
  });
}

