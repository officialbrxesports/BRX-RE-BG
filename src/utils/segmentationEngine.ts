import {
  FilesetResolver,
  ImageSegmenter,
} from '@mediapipe/tasks-vision';

let segmenterInstance: ImageSegmenter | null = null;
let isLoading = false;
let loadError: string | null = null;
let loadGeneration = 0;
let activeLoadPromise: Promise<ImageSegmenter> | null = null;

const WASM_URL =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.0/wasm';

const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite';

export interface ModelLoadProgress {
  stage:
    | 'idle'
    | 'loading_wasm'
    | 'loading_model'
    | 'ready'
    | 'error';
  message: string;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function reportProgress(
  callback: ((progress: ModelLoadProgress) => void) | undefined,
  stage: ModelLoadProgress['stage'],
  message: string,
): void {
  callback?.({ stage, message });
}

/**
 * Initialize the MediaPipe segmentation model.
 *
 * Concurrent callers share the same initialization promise.
 * GPU initialization is attempted first, with CPU as a fallback.
 */
export async function initSegmentationModel(
  onProgress?: (progress: ModelLoadProgress) => void,
): Promise<ImageSegmenter> {
  if (segmenterInstance) {
    reportProgress(
      onProgress,
      'ready',
      'Selfie segmentation model is ready.',
    );

    return segmenterInstance;
  }

  if (activeLoadPromise) {
    return activeLoadPromise;
  }

  const generation = loadGeneration;

  isLoading = true;
  loadError = null;

  const assertCurrentLoad = (): void => {
    if (generation !== loadGeneration) {
      throw new Error(
        'Model initialization was cancelled.',
      );
    }
  };

  const loadPromise = (async (): Promise<ImageSegmenter> => {
    try {
      reportProgress(
        onProgress,
        'loading_wasm',
        'Loading the WebAssembly vision runtime...',
      );

      const vision = await FilesetResolver.forVisionTasks(
        WASM_URL,
      );

      assertCurrentLoad();

      reportProgress(
        onProgress,
        'loading_model',
        'Downloading and initializing the segmentation model...',
      );

      const commonOptions = {
        baseOptions: {
          modelAssetPath: MODEL_URL,
        },
        runningMode: 'IMAGE' as const,
        outputCategoryMask: false,
        outputConfidenceMasks: true,
      };

      let instance: ImageSegmenter;

      try {
        instance = await ImageSegmenter.createFromOptions(
          vision,
          {
            ...commonOptions,
            baseOptions: {
              ...commonOptions.baseOptions,
              delegate: 'GPU',
            },
          },
        );

        if (generation !== loadGeneration) {
          instance.close();
          assertCurrentLoad();
        }
      } catch (gpuError: unknown) {
        assertCurrentLoad();

        reportProgress(
          onProgress,
          'loading_model',
          'GPU initialization failed. Trying the CPU delegate...',
        );

        try {
          instance = await ImageSegmenter.createFromOptions(
            vision,
            {
              ...commonOptions,
              baseOptions: {
                ...commonOptions.baseOptions,
                delegate: 'CPU',
              },
            },
          );

          if (generation !== loadGeneration) {
            instance.close();
            assertCurrentLoad();
          }
        } catch (cpuError: unknown) {
          assertCurrentLoad();

          throw new Error(
            [
              'Segmentation model initialization failed.',
              `GPU: ${getErrorMessage(gpuError)}`,
              `CPU: ${getErrorMessage(cpuError)}`,
            ].join(' '),
          );
        }
      }

      assertCurrentLoad();

      segmenterInstance = instance;

      reportProgress(
        onProgress,
        'ready',
        'Segmentation model loaded successfully.',
      );

      return instance;
    } catch (error: unknown) {
      const message = getErrorMessage(error);

      if (generation === loadGeneration) {
        loadError =
          `Failed to load the segmentation model: ${message}. ` +
          'Check your internet connection and browser compatibility.';

        reportProgress(
          onProgress,
          'error',
          loadError,
        );

        throw new Error(loadError);
      }

      throw error;
    }
  })();

  activeLoadPromise = loadPromise;

  try {
    return await loadPromise;
  } finally {
    if (activeLoadPromise === loadPromise) {
      activeLoadPromise = null;
      isLoading = false;
    }
  }
}

/**
 * Release the active model and invalidate any pending initialization.
 */
export function releaseSegmentationModel(): void {
  loadGeneration++;

  const instance = segmenterInstance;
  segmenterInstance = null;

  isLoading = false;
  loadError = null;
  activeLoadPromise = null;

  if (instance) {
    try {
      instance.close();
    } catch (error: unknown) {
      console.warn(
        'Error releasing the segmentation model:',
        error,
      );
    }
  }
}

/**
 * Apply the segmentation mask to a video frame and return a transparent PNG.
 */
export async function processFrameSegmentation(
  segmenter: ImageSegmenter,
  sourceCanvas: HTMLCanvasElement,
  outputCanvas: HTMLCanvasElement,
  options: {
    edgeSmoothing: boolean;
    threshold: number;
  },
): Promise<Blob> {
  const width = sourceCanvas.width;
  const height = sourceCanvas.height;

  if (width < 1 || height < 1) {
    throw new Error(
      'Cannot process a canvas with invalid dimensions.',
    );
  }

  const threshold = Number.isFinite(options.threshold)
    ? Math.max(0, Math.min(1, options.threshold))
    : 0.5;

  const srcCtx = sourceCanvas.getContext('2d', {
    willReadFrequently: true,
  });

  if (!srcCtx) {
    throw new Error(
      'Could not acquire the source canvas 2D context.',
    );
  }

  outputCanvas.width = width;
  outputCanvas.height = height;

  const outCtx = outputCanvas.getContext('2d');

  if (!outCtx) {
    throw new Error(
      'Could not acquire the output canvas 2D context.',
    );
  }

  let result: ReturnType<ImageSegmenter['segment']> | null =
    null;

  try {
    // 1. Run MediaPipe segmentation.
    result = segmenter.segment(sourceCanvas);

    // 2. Read the source pixels.
    const imageData = srcCtx.getImageData(
      0,
      0,
      width,
      height,
    );

    const pixels = imageData.data;

    // 3. Apply the confidence mask, or the category mask if available.
    const confidenceMask =
      result.confidenceMasks?.[0] ?? null;

    if (confidenceMask) {
      const maskWidth = confidenceMask.width;
      const maskHeight = confidenceMask.height;

      if (maskWidth < 1 || maskHeight < 1) {
        throw new Error(
          'The segmentation model returned an invalid confidence mask.',
        );
      }

      const maskData =
        confidenceMask.getAsFloat32Array();

      if (
        maskData.length < maskWidth * maskHeight
      ) {
        throw new Error(
          'The confidence mask contains incomplete pixel data.',
        );
      }

      const scaleX = maskWidth / width;
      const scaleY = maskHeight / height;

      const smooth = options.edgeSmoothing;

      for (let y = 0; y < height; y++) {
        const maskY = Math.min(
          Math.floor(y * scaleY),
          maskHeight - 1,
        );

        const pixelRowOffset = y * width * 4;
        const maskRowOffset = maskY * maskWidth;

        for (let x = 0; x < width; x++) {
          const maskX = Math.min(
            Math.floor(x * scaleX),
            maskWidth - 1,
          );

          const confidence = maskData[
            maskRowOffset + maskX
          ];

          const alphaIndex =
            pixelRowOffset + x * 4 + 3;

          if (!Number.isFinite(confidence)) {
            pixels[alphaIndex] = 0;
            continue;
          }

          if (!smooth) {
            pixels[alphaIndex] =
              confidence >= threshold ? 255 : 0;

            continue;
          }

          // Smooth the transition around the threshold.
          const lower = Math.max(
            0,
            threshold - 0.15,
          );

          const upper = Math.min(
            1,
            threshold + 0.15,
          );

          let alpha: number;

          if (confidence <= lower) {
            alpha = 0;
          } else if (confidence >= upper) {
            alpha = 255;
          } else if (upper <= lower) {
            alpha = confidence >= threshold ? 255 : 0;
          } else {
            const normalized =
              (confidence - lower) / (upper - lower);

            // Smoothstep reduces abrupt alpha transitions.
            const smoothed =
              normalized *
              normalized *
              (3 - 2 * normalized);

            alpha = Math.round(
              Math.max(0, Math.min(1, smoothed)) * 255,
            );
          }

          pixels[alphaIndex] = alpha;
        }
      }

      confidenceMask.close();
    } else if (result.categoryMask) {
      const categoryMask = result.categoryMask;

      const maskWidth = categoryMask.width;
      const maskHeight = categoryMask.height;

      if (maskWidth < 1 || maskHeight < 1) {
        throw new Error(
          'The segmentation model returned an invalid category mask.',
        );
      }

      const maskData =
        categoryMask.getAsUint8Array();

      if (
        maskData.length < maskWidth * maskHeight
      ) {
        throw new Error(
          'The category mask contains incomplete pixel data.',
        );
      }

      const scaleX = maskWidth / width;
      const scaleY = maskHeight / height;

      for (let y = 0; y < height; y++) {
        const maskY = Math.min(
          Math.floor(y * scaleY),
          maskHeight - 1,
        );

        const pixelRowOffset = y * width * 4;
        const maskRowOffset = maskY * maskWidth;

        for (let x = 0; x < width; x++) {
          const maskX = Math.min(
            Math.floor(x * scaleX),
            maskWidth - 1,
          );

          const category =
            maskData[maskRowOffset + maskX];

          const alphaIndex =
            pixelRowOffset + x * 4 + 3;

          pixels[alphaIndex] =
            category > 0 ? 255 : 0;
        }
      }

      categoryMask.close();
    } else {
      throw new Error(
        'Segmentation returned no valid mask output.',
      );
    }

    // 4. Paint the frame with transparent background.
    outCtx.putImageData(imageData, 0, 0);

    // 5. Export the result as a lossless transparent PNG.
    return await new Promise<Blob>(
      (resolve, reject) => {
        outputCanvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(
                new Error(
                  'Failed to create a transparent PNG image.',
                ),
              );
            }
          },
          'image/png',
        );
      },
    );
  } finally {
    // Release any mask buffers that remain open if an error occurs.
    if (result) {
      try {
        for (const mask of result.confidenceMasks ?? []) {
          try {
            mask.close();
          } catch {
            // A mask may already have been closed.
          }
        }
      } catch {
        // Ignore mask cleanup errors.
      }

      try {
        result.categoryMask?.close();
      } catch {
        // A category mask may already have been closed.
      }
    }
  }
}