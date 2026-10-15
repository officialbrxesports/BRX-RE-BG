import {
  BufferTarget,
  CanvasSource,
  Output,
  Quality,
  WebMOutputFormat,
} from 'mediabunny';

import type { ProcessedFrame } from '../types';

export interface VideoExportOptions {
  fps: number;
  filename: string;
  backgroundColor?: string;
  onProgress?: (percent: number) => void;
}

function loadImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(blob);

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not load a processed PNG frame.'));
    };

    image.src = url;
  });
}

export async function exportFramesToVideo(
  frames: ProcessedFrame[],
  options: VideoExportOptions,
): Promise<Blob> {
  if (!frames.length) {
    throw new Error('No processed frames are available to export.');
  }

  const fps = options.fps;

  if (!Number.isFinite(fps) || fps < 1 || fps > 30) {
    throw new Error('Choose a frame rate between 1 and 30 FPS.');
  }

  if (!('VideoEncoder' in window)) {
    throw new Error(
      'Video encoding is not supported by this browser. Try an updated browser.',
    );
  }

  const width = frames[0].width;
  const height = frames[0].height;

  if (
    !width ||
    !height ||
    frames.some((frame) => frame.width !== width || frame.height !== height)
  ) {
    throw new Error('All processed frames must have the same dimensions.');
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d', { alpha: true });

  if (!context) {
    throw new Error('Could not initialize the video canvas.');
  }

  context.clearRect(0, 0, width, height);

  const target = new BufferTarget();

  const output = new Output({
    format: new WebMOutputFormat(),
    target,
  });

  const videoSource = new CanvasSource(canvas, {
    codec: 'vp9',
    alpha: 'keep',
    quality: new Quality('high'),
  });

  output.addVideoTrack(videoSource, {
    frameRate: fps,
  });

  let started = false;
  let finalized = false;

  try {
    await output.start();
    started = true;

    const frameDuration = 1 / fps;

    for (let index = 0; index < frames.length; index += 1) {
      const image = await loadImage(frames[index].blob);

      context.clearRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);

      const timestamp = index * frameDuration;

      await videoSource.add(timestamp, frameDuration);

      options.onProgress?.(
        Math.round(((index + 1) / frames.length) * 100),
      );
    }

    await output.finalize();
    finalized = true;

    if (!target.buffer || target.buffer.byteLength === 0) {
      throw new Error('The exported video is empty.');
    }

    return new Blob([target.buffer], {
      type: 'video/webm',
    });
  } catch (error) {
    if (started && !finalized) {
      try {
        await output.cancel();
      } catch {
        // Preserve the original export error.
      }
    }

    throw error instanceof Error
      ? error
      : new Error('Video export failed.');
  }
}

export function downloadVideoBlob(
  blob: Blob,
  filename: string,
): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = filename.endsWith('.webm')
    ? filename
    : `${filename}.webm`;

  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}