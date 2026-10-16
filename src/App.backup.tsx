import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
} from 'react';

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

import {
  initSegmentationModel,
  releaseSegmentationModel,
} from './utils/segmentationEngine';

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

import {
  AlertCircle,
  Sparkles,
  X,
  Check,
  Crown,
  ShieldCheck,
  Zap,
} from 'lucide-react';

import type { ImageSegmenter } from '@mediapipe/tasks-vision';

/* =========================================================
   INITIAL STATE
========================================================= */

function createInitialProgressState(
  currentStatusText = 'Ready to process',
): ProcessingProgressState {
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

type Plan = 'free' | 'premium';

function readSavedPlan(): Plan {
  try {
    return localStorage.getItem('brx-demo-plan') === 'premium'
      ? 'premium'
      : 'free';
  } catch {
    return 'free';
  }
}

/* =========================================================
   APP
========================================================= */

export default function App() {
  /* -------------------------------------------------------
     1. BROWSER CAPABILITIES
  ------------------------------------------------------- */

  const [capabilities] = useState<SystemCapabilities>(() =>
    detectBrowserCapabilities(),
  );

  /* -------------------------------------------------------
     2. VIDEO STATE
  ------------------------------------------------------- */

  const [videoMetadata, setVideoMetadata] =
    useState<VideoMetadata | null>(null);

  const [isValidatingVideo, setIsValidatingVideo] =
    useState(false);

  const [validationError, setValidationError] =
    useState<string | null>(null);

  /* -------------------------------------------------------
     3. PROCESSING SETTINGS
  ------------------------------------------------------- */

  const [settings, setSettings] =
    useState<ProcessingSettingsOptions>(() => ({
      resolution: '480p',
      fps: 15,
      edgeSmoothing: true,
      threshold: 0.5,
    }));

  /* -------------------------------------------------------
     4. AI MODEL
  ------------------------------------------------------- */

  const [segmenter, setSegmenter] =
    useState<ImageSegmenter | null>(null);

  const [modelLoadingText, setModelLoadingText] = useState('');

  const [modelError, setModelError] =
    useState<string | null>(null);

  /* -------------------------------------------------------
     5. PROCESSING STATE
  ------------------------------------------------------- */

  const [processingStatus, setProcessingStatus] =
    useState<ProcessingStatus>('idle');

  const [progressState, setProgressState] =
    useState<ProcessingProgressState>(
      createInitialProgressState,
    );

  const [processedFrames, setProcessedFrames] =
    useState<ProcessedFrame[]>([]);

  /* -------------------------------------------------------
     6. MODALS AND PLANS
  ------------------------------------------------------- */

  const [isLimitationsModalOpen, setIsLimitationsModalOpen] =
    useState(false);

  const [isPlansOpen, setIsPlansOpen] = useState(false);

  const [selectedPlan, setSelectedPlan] =
    useState<Plan>(readSavedPlan);

  /* -------------------------------------------------------
     7. REFS

     Refs allow asynchronous operations to identify whether
     they still belong to the current request.
  ------------------------------------------------------- */

  const processorRef = useRef<ProcessorController | null>(null);

  const segmenterRef = useRef<ImageSegmenter | null>(null);

  const videoMetadataRef = useRef<VideoMetadata | null>(null);

  const framesRef = useRef<ProcessedFrame[]>([]);

  const settingsRef = useRef(settings);

  const processingStatusRef =
    useRef<ProcessingStatus>('idle');

  const modelLoadRequestRef = useRef(0);

  const videoValidationRequestRef = useRef(0);

  const processingRequestRef = useRef(0);

  const isStartingProcessingRef = useRef(false);

  const isMountedRef = useRef(true);

  /* -------------------------------------------------------
     8. SYNCHRONIZE REFS
  ------------------------------------------------------- */

  useEffect(() => {
    segmenterRef.current = segmenter;
  }, [segmenter]);

  useEffect(() => {
    videoMetadataRef.current = videoMetadata;
  }, [videoMetadata]);

  useEffect(() => {
    framesRef.current = processedFrames;
  }, [processedFrames]);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    processingStatusRef.current = processingStatus;
  }, [processingStatus]);

  /* -------------------------------------------------------
     9. SAFE STATUS UPDATE
  ------------------------------------------------------- */

  const updateProcessingStatus = useCallback(
    (status: ProcessingStatus) => {
      if (!isMountedRef.current) {
        return;
      }

      processingStatusRef.current = status;
      setProcessingStatus(status);
    },
    [],
  );

  /* -------------------------------------------------------
     10. FRAME CLEANUP
  ------------------------------------------------------- */

  const releaseFrameUrls = useCallback(
    (frames: ProcessedFrame[]) => {
      const released = new Set<string>();

      for (const frame of frames) {
        if (
          frame.previewUrl &&
          !released.has(frame.previewUrl)
        ) {
          released.add(frame.previewUrl);

          try {
            URL.revokeObjectURL(frame.previewUrl);
          } catch {
            // Ignore already-released URLs.
          }
        }
      }
    },
    [],
  );

  const clearProcessedFrames = useCallback(() => {
    const previousFrames = framesRef.current;

    framesRef.current = [];
    setProcessedFrames([]);

    releaseFrameUrls(previousFrames);
  }, [releaseFrameUrls]);

  /* -------------------------------------------------------
     11. CANCEL CURRENT PROCESSOR
  ------------------------------------------------------- */

  const cancelCurrentProcessor = useCallback(() => {
    const controller = processorRef.current;

    processorRef.current = null;

    if (controller) {
      try {
        controller.cancel();
      } catch (error) {
        console.error(
          'Failed to cancel the current processor:',
          error,
        );
      }
    }
  }, []);

  /* -------------------------------------------------------
     12. CLEANUP ON UNMOUNT
  ------------------------------------------------------- */

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;

      // Invalidate outstanding asynchronous requests.
      videoValidationRequestRef.current += 1;
      modelLoadRequestRef.current += 1;
      processingRequestRef.current += 1;

      cancelCurrentProcessor();

      const currentVideo = videoMetadataRef.current;

      if (currentVideo?.objectUrl) {
        URL.revokeObjectURL(currentVideo.objectUrl);
      }

      releaseFrameUrls(framesRef.current);

      framesRef.current = [];

      try {
        releaseSegmentationModel();
      } catch (error) {
        console.error(
          'Segmentation model cleanup failed:',
          error,
        );
      }
    };
  }, [cancelCurrentProcessor, releaseFrameUrls]);

  /* -------------------------------------------------------
     13. VIDEO VALIDATION
  ------------------------------------------------------- */

  const handleFileSelected = useCallback(
    async (file: File) => {
      const requestId =
        ++videoValidationRequestRef.current;

      // Invalidate any pending model-load or processing request.
      modelLoadRequestRef.current += 1;
      processingRequestRef.current += 1;

      isStartingProcessingRef.current = false;

      cancelCurrentProcessor();

      // Release old video.
      const previousVideo = videoMetadataRef.current;

      videoMetadataRef.current = null;
      setVideoMetadata(null);

      if (previousVideo?.objectUrl) {
        URL.revokeObjectURL(previousVideo.objectUrl);
      }

      // Release previous processed frames.
      clearProcessedFrames();

      setValidationError(null);
      setModelError(null);
      setModelLoadingText('');
      setIsValidatingVideo(true);

      setProgressState(
        createInitialProgressState(
          'Validating selected video...',
        ),
      );

      updateProcessingStatus('idle');

      try {
        const result = await loadAndValidateVideo(file);

        // Ignore results from an outdated validation request.
        if (
          !isMountedRef.current ||
          requestId !== videoValidationRequestRef.current
        ) {
          if (result.metadata?.objectUrl) {
            URL.revokeObjectURL(result.metadata.objectUrl);
          }

          return;
        }

        if (!result.valid || !result.metadata) {
          setValidationError(
            result.error || 'Video validation failed.',
          );

          setVideoMetadata(null);
          videoMetadataRef.current = null;

          return;
        }

        videoMetadataRef.current = result.metadata;

        setVideoMetadata(result.metadata);
        setValidationError(null);
      } catch (error) {
        if (
          !isMountedRef.current ||
          requestId !== videoValidationRequestRef.current
        ) {
          return;
        }

        setValidationError(
          error instanceof Error
            ? error.message
            : 'Unable to validate this video.',
        );
      } finally {
        if (
          isMountedRef.current &&
          requestId === videoValidationRequestRef.current
        ) {
          setIsValidatingVideo(false);
        }
      }
    },
    [
      cancelCurrentProcessor,
      clearProcessedFrames,
      updateProcessingStatus,
    ],
  );

  /* -------------------------------------------------------
     14. CLEAR VIDEO
  ------------------------------------------------------- */

  const handleClearVideo = useCallback(() => {
    videoValidationRequestRef.current += 1;
    modelLoadRequestRef.current += 1;
    processingRequestRef.current += 1;

    isStartingProcessingRef.current = false;

    cancelCurrentProcessor();

    const currentVideo = videoMetadataRef.current;

    videoMetadataRef.current = null;

    setVideoMetadata(null);

    if (currentVideo?.objectUrl) {
      URL.revokeObjectURL(currentVideo.objectUrl);
    }

    clearProcessedFrames();

    setIsValidatingVideo(false);
    setValidationError(null);
    setModelError(null);
    setModelLoadingText('');

    setProgressState(createInitialProgressState());

    updateProcessingStatus('idle');
  }, [
    cancelCurrentProcessor,
    clearProcessedFrames,
    updateProcessingStatus,
  ]);

  /* -------------------------------------------------------
     15. LOAD AI MODEL

     Multiple calls share a single pending load operation.
     Stale callers cannot start processing an outdated video.
  ------------------------------------------------------- */

  const modelPromiseRef =
    useRef<Promise<ImageSegmenter> | null>(null);

  const ensureModel = useCallback(async (): Promise<
    ImageSegmenter | null
  > => {
    if (segmenterRef.current) {
      return segmenterRef.current;
    }

    if (modelPromiseRef.current) {
      try {
        return await modelPromiseRef.current;
      } catch {
        return null;
      }
    }

    setModelError(null);
    setModelLoadingText('Initializing AI model...');

    const loadPromise = initSegmentationModel(
      (progress: ModelLoadProgress) => {
        if (isMountedRef.current) {
          setModelLoadingText(progress.message);
        }
      },
    );

    modelPromiseRef.current = loadPromise;

    try {
      const loadedSegmenter = await loadPromise;

      if (!isMountedRef.current) {
        return null;
      }

      segmenterRef.current = loadedSegmenter;
      setSegmenter(loadedSegmenter);

      setModelLoadingText('');

      return loadedSegmenter;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : String(error);

      if (isMountedRef.current) {
        setModelError(message);
        setModelLoadingText('');
      }

      return null;
    } finally {
      if (modelPromiseRef.current === loadPromise) {
        modelPromiseRef.current = null;
      }
    }
  }, []);

  /* -------------------------------------------------------
     16. START PROCESSING
  ------------------------------------------------------- */

  const handleStartProcessing = useCallback(async () => {
    // Prevent duplicate clicks from starting multiple jobs.
    if (isStartingProcessingRef.current) {
      return;
    }

    if (
      processingStatusRef.current === 'processing' ||
      processingStatusRef.current === 'loading_model'
    ) {
      return;
    }

    const currentVideo = videoMetadataRef.current;

    if (!currentVideo) {
      setValidationError(
        'Please select a valid video before processing.',
      );

      return;
    }

    isStartingProcessingRef.current = true;

    const requestId = ++processingRequestRef.current;

    const modelRequestId = ++modelLoadRequestRef.current;

    cancelCurrentProcessor();

    clearProcessedFrames();

    setModelError(null);
    setModelLoadingText('');

    setProgressState(
      createInitialProgressState(
        'Preparing the segmentation model...',
      ),
    );

    updateProcessingStatus('loading_model');

    try {
      const loadedSegmenter = await ensureModel();

      // The video may have changed while the model was loading.
      if (
        !isMountedRef.current ||
        requestId !== processingRequestRef.current ||
        modelRequestId !== modelLoadRequestRef.current ||
        videoMetadataRef.current !== currentVideo
      ) {
        return;
      }

      if (!loadedSegmenter) {
        updateProcessingStatus('model_error');

        setProgressState((previous) => ({
          ...previous,
          currentStatusText:
            'Unable to initialize the AI segmentation model.',
        }));

        return;
      }

      updateProcessingStatus('processing');

      const processingSettings = {
        ...settingsRef.current,
      };

      let terminalStateReached = false;

      const controller = startSequentialProcessing(
        currentVideo,
        loadedSegmenter,
        processingSettings,
        {
          onFrameProcessed: (frame) => {
            if (
              !isMountedRef.current ||
              requestId !== processingRequestRef.current
            ) {
              // Do not retain frames from obsolete processing.
              URL.revokeObjectURL(frame.previewUrl);
              return;
            }

            setProcessedFrames((previousFrames) => {
              const nextFrames = [...previousFrames, frame];

              framesRef.current = nextFrames;

              return nextFrames;
            });
          },

          onProgress: (nextProgressState) => {
            if (
              !isMountedRef.current ||
              requestId !== processingRequestRef.current
            ) {
              return;
            }

            setProgressState(nextProgressState);

            if (
              nextProgressState.percent >= 100 &&
              !terminalStateReached
            ) {
              terminalStateReached = true;

              updateProcessingStatus('completed');

              isStartingProcessingRef.current = false;

              if (processorRef.current === controller) {
                processorRef.current = null;
              }
            }
          },

          onError: (errorText) => {
            if (
              !isMountedRef.current ||
              requestId !== processingRequestRef.current
            ) {
              return;
            }

            terminalStateReached = true;

            updateProcessingStatus('error');

            setProgressState((previous) => ({
              ...previous,
              currentStatusText: `Error: ${errorText}`,
            }));

            isStartingProcessingRef.current = false;

            if (processorRef.current === controller) {
              processorRef.current = null;
            }
          },

          onBudgetExceeded: (bytes, count) => {
            if (
              !isMountedRef.current ||
              requestId !== processingRequestRef.current
            ) {
              return;
            }

            terminalStateReached = true;

            updateProcessingStatus('budget_exceeded');

            setProgressState((previous) => ({
              ...previous,
              retainedBytes: bytes,
              currentStatusText:
                `Stopped at ${count} frames: ` +
                'retained PNG budget reached.',
            }));

            isStartingProcessingRef.current = false;

            if (processorRef.current === controller) {
              processorRef.current = null;
            }
          },
        },
      );

      // Protect against a very fast synchronous completion.
      if (
        !terminalStateReached &&
        requestId === processingRequestRef.current
      ) {
        processorRef.current = controller;
      } else {
        controller.cancel();
      }
    } catch (error) {
      if (
        isMountedRef.current &&
        requestId === processingRequestRef.current
      ) {
        const message =
          error instanceof Error
            ? error.message
            : String(error);

        updateProcessingStatus('error');

        setProgressState((previous) => ({
          ...previous,
          currentStatusText: `Error: ${message}`,
        }));
      }
    } finally {
      if (requestId === processingRequestRef.current) {
        isStartingProcessingRef.current = false;
      }
    }
  }, [
    cancelCurrentProcessor,
    clearProcessedFrames,
    ensureModel,
    updateProcessingStatus,
  ]);

  /* -------------------------------------------------------
     17. CANCEL PROCESSING
  ------------------------------------------------------- */

  const handleCancelProcessing = useCallback(() => {
    const status = processingStatusRef.current;

    if (
      status !== 'loading_model' &&
      status !== 'processing'
    ) {
      return;
    }

    // Invalidate callbacks from the cancelled operation.
    processingRequestRef.current += 1;
    modelLoadRequestRef.current += 1;

    isStartingProcessingRef.current = false;

    cancelCurrentProcessor();

    updateProcessingStatus('cancelled');

    setProgressState((previous) => ({
      ...previous,
      currentStatusText:
        'Processing cancelled. Completed frames remain available.',
    }));
  }, [cancelCurrentProcessor, updateProcessingStatus]);

  /* -------------------------------------------------------
     18. RESET RESULTS
  ------------------------------------------------------- */

  const handleReset = useCallback(() => {
    processingRequestRef.current += 1;
    modelLoadRequestRef.current += 1;

    isStartingProcessingRef.current = false;

    cancelCurrentProcessor();

    clearProcessedFrames();

    setProgressState(
      createInitialProgressState('Ready to process'),
    );

    updateProcessingStatus('idle');
  }, [
    cancelCurrentProcessor,
    clearProcessedFrames,
    updateProcessingStatus,
  ]);

  /* -------------------------------------------------------
     19. PLAN PREVIEW
  ------------------------------------------------------- */

  const handleSelectPlan = useCallback((plan: Plan) => {
    setSelectedPlan(plan);

    try {
      localStorage.setItem('brx-demo-plan', plan);
    } catch {
      // The preview still works if localStorage is unavailable.
    }
  }, []);

  /* -------------------------------------------------------
     20. DERIVED STATE
  ------------------------------------------------------- */

  const isWorking =
    processingStatus === 'loading_model' ||
    processingStatus === 'processing';

  const hasFrames = processedFrames.length > 0;

  /* -------------------------------------------------------
     21. MAIN UI

     Existing branding, workspace components, and plans
     presentation are preserved.
  ------------------------------------------------------- */

  return (
    <div className="brx-app min-h-screen text-zinc-100 flex flex-col font-sans selection:bg-indigo-500/30">
      <Header
        capabilities={capabilities}
        onOpenLimitations={() =>
          setIsLimitationsModalOpen(true)
        }
        onOpenPlans={() => setIsPlansOpen(true)}
      />

      <main className="brx-main flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        {/* HERO / BRANDING */}

        <section
          id="home"
          className="brx-hero brx-hero-premium"
          aria-labelledby="brx-hero-title"
        >
          <div
            className="brx-hero-background-glow"
            aria-hidden="true"
          />

          <div className="brx-hero-brand-stage">
            <span className="brx-hero-badge">
              <Sparkles className="h-3.5 w-3.5" />
              BRX CREATIVE TECHNOLOGY
            </span>

            <div className="brx-panther-emblem">
              <div className="brx-panther-ring brx-panther-ring-outer" />
              <div className="brx-panther-ring brx-panther-ring-inner" />

              <div className="brx-panther-logo-glass">
                <img
                  src="/brand/brx-logo.png"
                  alt="BRX Panther logo"
                  className="brx-panther-logo-image"
                  width={240}
                  height={240}
                />
              </div>

              <span className="brx-emblem-light brx-emblem-light-left" />
              <span className="brx-emblem-light brx-emblem-light-right" />
            </div>

            <div className="brx-hero-brand-name">
              <span className="brx-brand-brx">BRX</span>
              <span className="brx-brand-divider" />
              <span className="brx-brand-panther">PANTHER</span>
            </div>

            <h1
              id="brx-hero-title"
              className="brx-hero-premium-title"
            >
              VIDEO BACKGROUND
              <span> REMOVER</span>
            </h1>

            <p className="brx-hero-premium-description">
              Your Media. No Background.
            </p>

            <p className="brx-hero-premium-subtitle">
              Create transparent video frames with browser-based
              AI processing.
            </p>

            <div className="brx-hero-trust">
              <span>
                <ShieldCheck />
                Private Processing
              </span>

              <span className="brx-trust-separator" />

              <span>
                <Zap />
                AI-Powered Workflow
              </span>

              <span className="brx-trust-separator" />

              <span>
                <Sparkles />
                Creative Freedom
              </span>
            </div>
          </div>
        </section>

        <PrivacyNotice />

        {/* MODEL ERROR */}

        {modelError && (
          <div
            className="brx-model-warning"
            role="alert"
            aria-live="assertive"
          >
            <div className="brx-model-warning-heading">
              <AlertCircle size={17} />
              <span>Model Initialization Warning</span>
            </div>

            <p>{modelError}</p>

            <button
              type="button"
              onClick={async () => {
                setModelError(null);

                const loadedSegmenter = await ensureModel();

                if (
                  loadedSegmenter &&
                  isMountedRef.current &&
                  processingStatusRef.current === 'model_error'
                ) {
                  updateProcessingStatus('idle');
                  setProgressState(
                    createInitialProgressState('Ready to process'),
                  );
                }
              }}
              disabled={isWorking}
              className="brx-secondary-action"
            >
              Retry Loading Segmentation Model
            </button>
          </div>
        )}

        {/* WORKSPACE */}

        <section
          id="workspace"
          className="brx-workspace-section"
          aria-labelledby="brx-workspace-title"
        >
          <div className="brx-section-heading">
            <div>
              <span className="brx-section-kicker">
                YOUR CREATIVE WORKSPACE
              </span>

              <h2 id="brx-workspace-title">
                Video <span>Workspace</span>
              </h2>

              <p>
                Upload your video and prepare transparent frames.
              </p>
            </div>

            <div className="brx-workspace-badge">
              <span className="brx-status-dot" />
              LOCAL PROCESSING
            </div>
          </div>

          {/* VIDEO UPLOAD */}

          {!videoMetadata ? (
            <div className="brx-upload-shell">
              <Dropzone
                onFileSelected={handleFileSelected}
                isLoading={isValidatingVideo}
                validationError={validationError}
              />
            </div>
          ) : (
            <div className="brx-workspace-content">
              {/* VIDEO PREVIEW */}

              <VideoPreview
                metadata={videoMetadata}
                onClear={handleClearVideo}
                isProcessing={isWorking}
              />

              {/* SETTINGS */}

              {processingStatus === 'idle' && (
                <div className="brx-processing-settings">
                  <ProcessingSettings
                    settings={settings}
                    onChange={setSettings}
                    capabilities={capabilities}
                    metadata={videoMetadata}
                    disabled={isWorking}
                  />

                  <div className="brx-processing-actions">
                    <button
                      type="button"
                      onClick={handleStartProcessing}
                      disabled={isWorking || isValidatingVideo}
                      className="brx-primary-action"
                    >
                      <Sparkles size={17} />
                      <span>Extract Transparent Frames</span>
                    </button>
                  </div>
                </div>
              )}

              {/* MODEL LOADING */}

              {processingStatus === 'loading_model' && (
                <div className="brx-processing-state">
                  <div className="brx-loading-spinner" />

                  <div className="brx-processing-state-copy">
                    <p className="brx-processing-state-title">
                      Preparing Client-Side Vision Engine
                    </p>

                    <p className="brx-processing-state-description">
                      {modelLoadingText ||
                        'Preparing the MediaPipe segmentation model...'}
                    </p>

                    <button
                      type="button"
                      onClick={handleCancelProcessing}
                      className="brx-cancel-action"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* PROCESSING PROGRESS */}

              {(
                processingStatus === 'processing' ||
                processingStatus === 'completed' ||
                processingStatus === 'cancelled' ||
                processingStatus === 'budget_exceeded' ||
                processingStatus === 'error'
              ) && (
                <ProcessingProgress
                  progress={progressState}
                  onCancel={handleCancelProcessing}
                  onReset={handleReset}
                  isCompleted={processingStatus === 'completed'}
                  isBudgetExceeded={
                    processingStatus === 'budget_exceeded'
                  }
                  isCancelled={processingStatus === 'cancelled'}
                  isError={processingStatus === 'error'}
                />
              )}

              {/* RESULTS */}

              {hasFrames && (
                <section
                  id="results"
                  className="brx-results-section"
                  aria-label="Processed frame results and export"
                >
                  <div className="brx-results-heading">
                    <span className="brx-section-kicker">
                      YOUR OUTPUT
                    </span>

                    <h2>
                      Processed <span>Frames</span>
                    </h2>

                    <p>
                      Review your processed frames and export
                      the available transparent PNG results.
                    </p>
                  </div>

                  <div className="brx-results-content">
                    <FrameGallery
                      frames={processedFrames}
                      targetFps={settings.fps}
                    />

                    <ExportPanel
                      frames={processedFrames}
                      videoMetadata={videoMetadata}
                      resolution={settings.resolution}
                      fps={settings.fps}
                      totalBytes={progressState.retainedBytes}
                    />
                  </div>
                </section>
              )}
            </div>
          )}
        </section>
      </main>

      {/* PLANS PREVIEW — NOT REAL BILLING */}

      {isPlansOpen && (
        <div
          className="brx-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setIsPlansOpen(false);
            }
          }}
        >
          <section
            className="brx-plans-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="brx-plans-title"
          >
            <div className="brx-plans-modal-header">
              <div>
                <div className="brx-modal-eyebrow">
                  <Crown size={16} />
                  BRX PANTHER MEMBERSHIP
                </div>

                <h2
                  id="brx-plans-title"
                  className="brx-plans-title"
                >
                  Choose your workspace
                </h2>

                <p className="brx-plans-description">
                  A plan preview for the next BRX release.
                </p>
              </div>

              <button
                type="button"
                className="brx-close-button"
                onClick={() => setIsPlansOpen(false)}
                aria-label="Close plans"
              >
                <X size={20} />
              </button>
            </div>

            <div className="brx-plan-grid">
              {/* FREE */}

              <article
                className={`brx-plan-card ${
                  selectedPlan === 'free'
                    ? 'brx-plan-selected'
                    : ''
                }`}
              >
                <div className="brx-plan-card-header">
                  <h3>Free</h3>

                  <span className="brx-plan-tag">
                    STARTER
                  </span>
                </div>

                <p className="brx-plan-price">
                  ₹0 <span>/ always</span>
                </p>

                <ul className="brx-plan-list">
                  <li>
                    <Check />
                    Core video background removal
                  </li>

                  <li>
                    <Check />
                    PNG frame ZIP export
                  </li>

                  <li>
                    <Check />
                    Browser-local processing
                  </li>

                  <li>
                    <Check />
                    Current device limits apply
                  </li>
                </ul>

                <button
                  type="button"
                  className="brx-plan-action"
                  onClick={() => handleSelectPlan('free')}
                >
                  {selectedPlan === 'free'
                    ? 'Current preview plan'
                    : 'Preview Free'}
                </button>
              </article>

              {/* PREMIUM */}

              <article
                className={`brx-plan-card brx-plan-premium ${
                  selectedPlan === 'premium'
                    ? 'brx-plan-selected'
                    : ''
                }`}
              >
                <div className="brx-plan-card-header">
                  <h3>Premium</h3>

                  <span className="brx-plan-tag brx-plan-tag-premium">
                    <Sparkles size={12} />
                    PRO
                  </span>
                </div>

                <p className="brx-plan-price">
                  Coming soon
                </p>

                <ul className="brx-plan-list">
                  <li>
                    <Check />
                    Planned advanced workflow controls
                  </li>

                  <li>
                    <Check />
                    Planned expanded export options
                  </li>

                  <li>
                    <Check />
                    Planned saved preferences
                  </li>

                  <li>
                    <ShieldCheck />
                    Account and billing not connected yet
                  </li>
                </ul>

                <button
                  type="button"
                  className="brx-plan-action brx-plan-action-premium"
                  onClick={() => handleSelectPlan('premium')}
                >
                  Preview Premium UI
                </button>
              </article>
            </div>

            <p className="brx-plan-disclaimer">
              <Zap size={15} />

              <span>
                Preview only: selecting a plan saves a local
                display preference. It does not create an account,
                unlock paid features, or charge money. Real
                subscriptions require a secure backend and
                payment provider.
              </span>
            </p>
          </section>
        </div>
      )}

      {/* LIMITATIONS */}

      <LimitationsModal
        isOpen={isLimitationsModalOpen}
        onClose={() => setIsLimitationsModalOpen(false)}
        capabilities={capabilities}
      />
    </div>
  );
}