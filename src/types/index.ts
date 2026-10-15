export interface VideoMetadata {
  file: File;
  name: string;
  size: number;
  formattedSize: string;
  duration: number;
  width: number;
  height: number;
  aspectRatio: number;
  objectUrl: string;
}

export type ProcessingResolution = '480p' | '720p' | '1080p';

export interface ResolutionConfig {
  id: ProcessingResolution;
  label: string;
  width: number;
  height: number;
  enabled: boolean;
  reason?: string;
  badge?: string;
}

export interface SystemCapabilities {
  deviceMemoryGB: number | null;
  hardwareConcurrency: number;
  webGlSupported: boolean;
  offscreenCanvasSupported: boolean;

  canHandle720p: boolean;
  reasons720p: string[];

  canHandle1080p: boolean;
  reasons1080p: string[];
}

export interface ProcessedFrame {
  index: number;
  timestamp: number;
  blob: Blob;
  previewUrl: string;
  sizeBytes: number;
  width: number;
  height: number;
}

export type ProcessingStatus =
  | 'idle'
  | 'loading_model'
  | 'model_error'
  | 'ready'
  | 'processing'
  | 'paused'
  | 'completed'
  | 'cancelled'
  | 'budget_exceeded'
  | 'error';

export interface ProcessingProgressState {
  currentFrame: number;
  totalEstimatedFrames: number;
  percent: number;
  fps: number;
  elapsedSeconds: number;
  remainingSeconds: number | null;
  retainedBytes: number;
  maxBudgetBytes: number;
  currentStatusText: string;
}

export interface ProcessingSettingsOptions {
  resolution: ProcessingResolution;
  fps: number;
  edgeSmoothing: boolean;
  threshold: number;
}