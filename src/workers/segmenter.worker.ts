import {
  FilesetResolver,
  ImageSegmenter,
  type ImageSegmenterResult,
} from "@mediapipe/tasks-vision";
import type { WorkerIncomingMessage } from "../types/video";

const TASKS_VISION_VERSION = "1.1.0";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/1/selfie_segmenter.tflite";

let segmenter: ImageSegmenter | undefined;
let lastTimestamp = -1;

self.onmessage = async (event: MessageEvent<WorkerIncomingMessage>) => {
  if (event.data.type === "load") {
    try {
      const wasmRoot = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${TASKS_VISION_VERSION}/wasm`;
      const vision = await FilesetResolver.forVisionTasks(wasmRoot);

      try {
        segmenter = await ImageSegmenter.createFromOptions(vision, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
          runningMode: "VIDEO",
          outputCategoryMask: true,
          outputConfidenceMasks: false,
        });
        self.postMessage({ type: "ready", delegate: "GPU", labels: segmenter.getLabels() });
      } catch {
        segmenter = await ImageSegmenter.createFromOptions(vision, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: "CPU" },
          runningMode: "VIDEO",
          outputCategoryMask: true,
          outputConfidenceMasks: false,
        });
        self.postMessage({ type: "ready", delegate: "CPU", labels: segmenter.getLabels() });
      }
    } catch (error) {
      self.postMessage({
        type: "error",
        message: error instanceof Error ? error.message : "The segmentation model could not be loaded.",
      });
    }
    return;
  }

  if (event.data.type === "segment") {
    const { bitmap, frameId } = event.data;
    const timestamp = Math.max(event.data.timestamp, lastTimestamp + 1);
    lastTimestamp = timestamp;

    try {
      if (!segmenter) {
        throw new Error("The model is not ready. Load the AI model and try again.");
      }

      segmenter.segmentForVideo(bitmap, timestamp, (result: ImageSegmenterResult) => {
        try {
          const categoryMask = result.categoryMask;
          if (!categoryMask) {
            throw new Error("The model did not return a segmentation mask for this frame.");
          }

          const categories = new Uint8Array(categoryMask.getAsUint8Array());
          self.postMessage({
            type: "mask",
            frameId,
            width: categoryMask.width,
            height: categoryMask.height,
            categories,
          }, {
            transfer: [categories.buffer],
          });
        } catch (error) {
          self.postMessage({
            type: "error",
            frameId,
            message: error instanceof Error ? error.message : "Could not apply the segmentation mask.",
          });
        } finally {
          result.confidenceMasks?.forEach((mask) => mask.close());
          result.categoryMask?.close();
          bitmap.close();
        }
      });
    } catch (error) {
      bitmap.close();
      self.postMessage({
        type: "error",
        frameId,
        message: error instanceof Error ? error.message : "Could not segment this video frame.",
      });
    }
  }
};
