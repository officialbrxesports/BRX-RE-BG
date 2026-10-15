import JSZip from 'jszip';

import type {
  ProcessedFrame,
  ProcessingResolution,
} from '../types';

export interface ZipExportProgress {
  percent: number;
  currentFilename: string;
}

interface ZipExportMetadata {
  videoName: string;
  resolution: ProcessingResolution;
  fps: number;
}

const MAX_ARCHIVE_BYTES = 200 * 1024 * 1024;

function createSafeName(filename: string): string {
  const name = filename.replace(/\.[^/.]+$/, '');

  return (
    name
      .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_')
      .replace(/[. ]+$/g, '')
      .trim() || 'video'
  );
}

function reportProgress(
  callback: ((progress: ZipExportProgress) => void) | undefined,
  percent: number,
  currentFilename: string,
): void {
  callback?.({
    percent: Math.min(100, Math.max(0, Math.round(percent))),
    currentFilename,
  });
}

export async function exportFramesToZip(
  frames: ProcessedFrame[],
  metadata: ZipExportMetadata,
  onProgress?: (progress: ZipExportProgress) => void,
): Promise<Blob> {
  if (frames.length === 0) {
    throw new Error('No processed frames available to export.');
  }

  if (!Number.isFinite(metadata.fps) || metadata.fps <= 0) {
    throw new Error('The export FPS value is invalid.');
  }

  let totalBytes = 0;

  for (const frame of frames) {
    if (!(frame.blob instanceof Blob) || frame.blob.size === 0) {
      throw new Error(
        `Frame ${frame.index + 1} is empty or unavailable.`,
      );
    }

    totalBytes += frame.blob.size;
  }

  if (totalBytes > MAX_ARCHIVE_BYTES) {
    throw new Error(
      'The PNG data exceeds BRX’s 200 MiB export budget. Reduce the number of frames or use a shorter video.',
    );
  }

  const zip = new JSZip();
  const safeName = createSafeName(metadata.videoName);
  const folderName = `${safeName}_transparent_frames`;
  const imageFolder = zip.folder(folderName);

  if (!imageFolder) {
    throw new Error('Could not create the ZIP archive folder.');
  }

  const paddingLength = Math.max(
    4,
    String(frames.length).length,
  );

  const manifestFrames: Array<{
    fileName: string;
    timestampSeconds: number;
    width: number;
    height: number;
    byteCount: number;
  }> = [];

  reportProgress(onProgress, 0, 'Preparing manifest.json');

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];

    const filename =
      `frame_${String(i + 1).padStart(paddingLength, '0')}.png`;

    imageFolder.file(filename, frame.blob);

    manifestFrames.push({
      fileName: filename,
      timestampSeconds: frame.timestamp,
      width: frame.width,
      height: frame.height,
      byteCount: frame.blob.size,
    });

    if (i % 5 === 0 || i === frames.length - 1) {
      reportProgress(
        onProgress,
        ((i + 1) / frames.length) * 40,
        filename,
      );

      // Yield briefly so the browser can update the progress UI.
      await new Promise<void>((resolve) => {
        window.setTimeout(resolve, 0);
      });
    }
  }

  const manifest = {
    generator: 'BRX Background Remover',
    exportedAt: new Date().toISOString(),
    sourceVideo: metadata.videoName,
    resolution: metadata.resolution,
    fps: metadata.fps,
    totalFrames: frames.length,
    totalPngBytes: totalBytes,
    transparency: 'PNG alpha channel',
    frames: manifestFrames,
    instructions: [
      'Import the numbered PNG files as an image sequence in a compatible video editor.',
      'Check that image-sequence import is enabled when the application provides that option.',
      'The archive contains transparent PNG images, not a transparent video file.',
    ],
  };

  imageFolder.file(
    'manifest.json',
    JSON.stringify(manifest, null, 2),
  );

  reportProgress(
    onProgress,
    45,
    'Generating ZIP archive...',
  );

  const zipBlob = await zip.generateAsync(
    {
      type: 'blob',
      compression: 'STORE',
    },
    (progress) => {
      reportProgress(
        onProgress,
        45 + progress.percent * 0.55,
        progress.currentFile || 'Generating ZIP archive...',
      );
    },
  );

  if (zipBlob.size === 0) {
    throw new Error('ZIP generation returned an empty archive.');
  }

  reportProgress(onProgress, 100, 'ZIP archive ready');

  return zipBlob;
}

export function triggerDownload(
  blob: Blob,
  filename: string,
): void {
  if (!(blob instanceof Blob) || blob.size === 0) {
    throw new Error('Cannot download an empty file.');
  }

  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.style.display = 'none';

  document.body.appendChild(anchor);

  try {
    anchor.click();
  } finally {
    window.setTimeout(() => {
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
    }, 1000);
  }
}