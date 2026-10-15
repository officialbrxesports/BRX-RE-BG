import React, { useState, useEffect, useRef, useCallback } from 'react';
import type {
  ProcessedFrame,
  ProcessingProgressState,
  ProcessingSettingsOptions,
  ProcessingStatus,
  SystemCapabilities,
  VideoMetadata,
} from './types';
import {
  detectBrowserCapabilities,
  MAX_ARCHIVE_BUDGET_BYTES,
} from './utils/browserCapabilities';
import { loadAndValidateVideo } from './utils/videoUtils';
import { initSegmentationModel, releaseSegmentationModel } from './utils/segmentationEngine';
import type { ModelLoadProgress } from './utils/segmentationEngine';
import { startSequentialProcessing } from './utils/frameProcessor';
import type { ProcessorController } from './utils/frameProcessor';

import { Header } from './components/Header';
import { Dropzone } from './components/Dropzone';
import { VideoPreview } from './components/VideoPreview';
import { ProcessingSettings } from './components/ProcessingSettings';
import { ProcessingProgress } from './components/ProcessingProgress';
import { FrameGallery } from './components/FrameGallery';
import { ExportPanel } from './components/ExportPanel';
import { LimitationsModal } from './components/LimitationsModal';
import { PrivacyNotice } from './components/PrivacyNotice';

import { AlertCircle, Sparkles } from 'lucide-react';
import type { ImageSegmenter } from '@mediapipe/tasks-vision';

function createInitialProgressState(currentStatusText = 'Ready to process'): ProcessingProgressState {
  return {
    currentFrame: 0,
    totalEstimatedFrames: 0,
    percent: 0,
    fps: 0,
    elapsedSeconds: 0,
    remainingSeconds: null,
    retainedBytes: 0,
    maxBudgetBytes: MAX_ARCHIVE_BUDGET_BYTES,
    currentStatusText,
  };
}
export default function App() {
  // 1. Browser capability detection
  const [capabilities] = useState<SystemCapabilities>(() =>
    detectBrowserCapabilities()
  );

  // 2. Video state
  const [videoMetadata, setVideoMetadata] = useState<VideoMetadata | null>(null);
  const [isValidatingVideo, setIsValidatingVideo] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // 3. Settings state
  const [settings, setSettings] = useState<ProcessingSettingsOptions>(() => ({
    resolution: '480p',
    fps: 15,
    edgeSmoothing: true,
    threshold: 0.5,
  }));

  // 4. Model state
  const [segmenter, setSegmenter] = useState<ImageSegmenter | null>(null);
  const [modelLoadingText, setModelLoadingText] = useState<string>('');
  const [modelError, setModelError] = useState<string | null>(null);

  // 5. Processing state
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus>('idle');
  const [progressState, setProgressState] = useState<ProcessingProgressState>(createInitialProgressState);


  const [processedFrames, setProcessedFrames] = useState<ProcessedFrame[]>([]);
  const processorRef = useRef<ProcessorController | null>(null);
  const modelLoadRequestRef = useRef(0);
  const videoValidationRequestRef = useRef(0);
  const framesRef = useRef<ProcessedFrame[]>([]);
  framesRef.current = processedFrames;

  // 6. UI modals
  const [isLimitationsModalOpen, setIsLimitationsModalOpen] = useState(false);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      if (videoMetadata?.objectUrl) {
        URL.revokeObjectURL(videoMetadata.objectUrl);
      }
      framesRef.current.forEach((frame) => {
        URL.revokeObjectURL(frame.previewUrl);
      });
      if (processorRef.current) {
        processorRef.current.cancel();
      }
    };
  }, [videoMetadata?.objectUrl]);

  useEffect(() => () => {
    modelLoadRequestRef.current += 1;
    releaseSegmentationModel();
  }, []);

  // Handle file selection
  const handleFileSelected = async (file: File) => {
    const requestId = ++videoValidationRequestRef.current;
    modelLoadRequestRef.current += 1;
    setValidationError(null);
    setIsValidatingVideo(true);
    setVideoMetadata(null);
    setModelError(null);

    if (processorRef.current) {
      processorRef.current.cancel();
      processorRef.current = null;
    }

    // Clean up previous video and frames
    if (videoMetadata?.objectUrl) {
      URL.revokeObjectURL(videoMetadata.objectUrl);
    }
    processedFrames.forEach((f) => URL.revokeObjectURL(f.previewUrl));
    setProcessedFrames([]);
    setProcessingStatus('idle');
    setProgressState(createInitialProgressState());

    const result = await loadAndValidateVideo(file);
    if (requestId !== videoValidationRequestRef.current) {
      if (result.metadata?.objectUrl) URL.revokeObjectURL(result.metadata.objectUrl);
      return;
    }
    setIsValidatingVideo(false);

    if (!result.valid) {
      setValidationError(result.error || 'Video validation failed.');
      setVideoMetadata(null);
    } else if (result.metadata) {
      setVideoMetadata(result.metadata);
      setValidationError(null);
    }
  };

  // Clear current video
  const handleClearVideo = useCallback(() => {
    videoValidationRequestRef.current += 1;
    modelLoadRequestRef.current += 1;
    setIsValidatingVideo(false);
    if (processorRef.current) {
      processorRef.current.cancel();
      processorRef.current = null;
    }
    if (videoMetadata?.objectUrl) {
      URL.revokeObjectURL(videoMetadata.objectUrl);
    }
    processedFrames.forEach((f) => URL.revokeObjectURL(f.previewUrl));
    setProcessedFrames([]);
    setVideoMetadata(null);
    setValidationError(null);
    setProcessingStatus('idle');
    setProgressState(createInitialProgressState());
  }, [videoMetadata, processedFrames]);

  // Pre-load model or recover
  const ensureModel = async (): Promise<ImageSegmenter | null> => {
    if (segmenter) return segmenter;

    try {
      setModelError(null);
      const seg = await initSegmentationModel((progress: ModelLoadProgress) => {
        setModelLoadingText(progress.message);
      });
      setSegmenter(seg);
      return seg;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setModelError(msg);
      return null;
    }
  };

  // Start processing
  const handleStartProcessing = async () => {
    if (!videoMetadata) return;
    const modelLoadRequest = ++modelLoadRequestRef.current;

    // Reset previous frames
    processedFrames.forEach((f) => URL.revokeObjectURL(f.previewUrl));
    setProcessedFrames([]);
    setProgressState(createInitialProgressState('Preparing the segmentation model...'));
    setProcessingStatus('loading_model');

    const loadedSegmenter = await ensureModel();
    if (modelLoadRequest !== modelLoadRequestRef.current) return;
    if (!loadedSegmenter) {
      setProcessingStatus('model_error');
      return;
    }

    setProcessingStatus('processing');
    const controller = startSequentialProcessing(
      videoMetadata,
      loadedSegmenter,
      settings,
      {
        onFrameProcessed: (frame) => {
          setProcessedFrames((prev) => [...prev, frame]);
        },
        onProgress: (pState) => {
          setProgressState(pState);
          if (pState.percent === 100) {
            setProcessingStatus('completed');
          }
        },
        onError: (errText) => {
          setProcessingStatus('error');
          setProgressState((prev) => ({
            ...prev,
            currentStatusText: `Error: ${errText}`,
          }));
        },
        onBudgetExceeded: (bytes, count) => {
          setProcessingStatus('budget_exceeded');
          setProgressState((prev) => ({
            ...prev,
            retainedBytes: bytes,
            currentStatusText: `Stopped at ${count} frames: Retained PNG budget (200 MiB) reached.`,
          }));
        },
      }
    );

    processorRef.current = controller;
  };

  // Cancel processing
  const handleCancelProcessing = () => {
    modelLoadRequestRef.current += 1;
    if (processorRef.current) {
      processorRef.current.cancel();
      processorRef.current = null;
    }
    setProcessingStatus('cancelled');
    setProgressState((prev) => ({
      ...prev,
      currentStatusText: 'Processing cancelled by user. Retained frames available below.',
    }));
  };

  // Reset all
  const handleReset = () => {
    modelLoadRequestRef.current += 1;
    if (processorRef.current) {
      processorRef.current.cancel();
      processorRef.current = null;
    }
    processedFrames.forEach((f) => URL.revokeObjectURL(f.previewUrl));
    setProcessedFrames([]);
    setProcessingStatus('idle');
    setProgressState(createInitialProgressState('Ready'));

  };

  const isWorking = processingStatus === 'loading_model' || processingStatus === 'processing';
  const hasFrames = processedFrames.length > 0;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-emerald-500/30">
      <Header
        capabilities={capabilities}
        onOpenLimitations={() => setIsLimitationsModalOpen(true)}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        <PrivacyNotice />

        {/* Model recoverable error banner */}
        {modelError && (
          <div className="p-4 rounded-xl bg-red-950/40 border border-red-800/60 text-red-200 text-xs sm:text-sm space-y-2">
            <div className="flex items-center space-x-2 text-red-300 font-semibold">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>Model Initialization Warning</span>
            </div>
            <p className="text-zinc-300 leading-relaxed">{modelError}</p>
            <div className="pt-1">
              <button
                onClick={async () => {
                  const loadedSegmenter = await ensureModel();
                  if (loadedSegmenter) setProcessingStatus('idle');
                }}
                className="px-3 py-1.5 bg-red-900/60 hover:bg-red-900 text-red-100 rounded-lg text-xs font-medium border border-red-700/60 transition"
              >
                Retry Loading Segmentation Model
              </button>
            </div>
          </div>
        )}

        {/* Video Upload / Selection Section */}
        {!videoMetadata ? (
          <Dropzone
            onFileSelected={handleFileSelected}
            isLoading={isValidatingVideo}
            validationError={validationError}
          />
        ) : (
          <div className="space-y-6">
            <VideoPreview
              metadata={videoMetadata}
              onClear={handleClearVideo}
              isProcessing={isWorking}
            />

            {/* Settings & Action Section */}
            {processingStatus === 'idle' && (
              <div className="space-y-4">
                <ProcessingSettings
                  settings={settings}
                  onChange={setSettings}
                  capabilities={capabilities}
                  metadata={videoMetadata}
                  disabled={isWorking}
                />

                <div className="flex items-center justify-end space-x-3 pt-2">
                  <button
                    onClick={handleStartProcessing}
                    disabled={isWorking}
                    className="w-full sm:w-auto px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold text-sm flex items-center justify-center space-x-2 transition shadow-lg shadow-emerald-950/50"
                  >
                    <Sparkles className="w-4 h-4 text-zinc-950" />
                    <span>Extract Transparent Frames</span>
                  </button>
                </div>
              </div>
            )}

            {/* Model Loading State */}
            {processingStatus === 'loading_model' && (
              <div className="p-6 rounded-xl bg-zinc-900/60 border border-zinc-800 flex flex-col items-center justify-center space-y-3 text-center">
                <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-zinc-200">
                    Preparing Client-Side Vision Engine
                  </p>
                  <p className="text-xs text-zinc-400 font-mono">
                    {modelLoadingText || 'Downloading MediaPipe Selfie Segmenter model...'}
                  </p>
                  <button
                    type="button"
                    onClick={handleCancelProcessing}
                    className="mt-2 rounded-lg border border-red-800/60 bg-red-950/40 px-3 py-1.5 text-xs font-medium text-red-200 hover:bg-red-950/70"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Processing Progress */}
            {(processingStatus === 'processing' ||
              processingStatus === 'completed' ||
              processingStatus === 'cancelled' ||
              processingStatus === 'budget_exceeded' ||
              processingStatus === 'error') && (
              <ProcessingProgress
                progress={progressState}
                onCancel={handleCancelProcessing}
                onReset={handleReset}
                isCompleted={processingStatus === 'completed'}
                isBudgetExceeded={processingStatus === 'budget_exceeded'}
                isCancelled={processingStatus === 'cancelled'}
                isError={processingStatus === 'error'}
              />
            )}

            {/* Results: Frame gallery & Export */}
            {hasFrames && (
              <div className="space-y-6 pt-2">
                <FrameGallery frames={processedFrames} targetFps={settings.fps} />

                <ExportPanel
                  frames={processedFrames}
                  videoMetadata={videoMetadata}
                  resolution={settings.resolution}
                  fps={settings.fps}
                  totalBytes={progressState.retainedBytes}
                />
              </div>
            )}
          </div>
        )}
      </main>

      {/* Limitations Modal */}
      <LimitationsModal
        isOpen={isLimitationsModalOpen}
        onClose={() => setIsLimitationsModalOpen(false)}
        capabilities={capabilities}
      />
    </div>
  );
}







