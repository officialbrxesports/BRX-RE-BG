import type { ProcessingResolution as SharedProcessingResolution, VideoMetadata as SharedVideoMetadata } from "./index";

export type VideoMetadata = Pick<SharedVideoMetadata, "width" | "height" | "duration">;
export type ProcessingResolution = SharedProcessingResolution;

export type ModelStatus = "idle" | "loading" | "ready" | "error";
export type ProcessingStatus = "idle" | "processing" | "complete" | "error" | "cancelled";
export type ExportStatus = "idle" | "exporting" | "complete" | "error" | "cancelled";
export type ArchiveStatus = "empty" | "recording" | "complete" | "cancelled" | "budget" | "error";
export type ArchiveExportStatus = "idle" | "exporting" | "complete" | "error" | "cancelled";

export type VideoExportCapability = {
  status: "checking" | "unavailable";
  message: string;
  vp9Encoder: boolean | null;
  vp9Alpha: boolean | null;
  vp9Decoder: boolean | null;
  mediaRecorderWebm: boolean | null;
};

export type WorkerIncomingMessage =
  | { type: "load" }
  | { type: "segment"; frameId: number; bitmap: ImageBitmap; timestamp: number };

export type WorkerMessage =
  | { type: "ready"; delegate: "GPU" | "CPU"; labels: string[] }
  | { type: "mask"; frameId: number; width: number; height: number; categories: Uint8Array }
  | { type: "error"; frameId?: number; message: string };

export type MaskMessage = Extract<WorkerMessage, { type: "mask" }>;

export type PendingFrame = {
  frameId: number;
  resolve: (result: MaskMessage) => void;
  reject: (error: Error) => void;
};

export type VideoPresentation =
  | { type: "frame"; mediaTime: number; presentedFrames: number; droppedFrames: number | null }
  | { type: "ended" };