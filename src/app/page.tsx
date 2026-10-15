"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";
import Link from "next/link";
import FrameArchivePanel from "@/components/FrameArchivePanel";
import FramePngExportPanel from "@/components/FramePngExportPanel";
import FramePreviewPanel from "@/components/FramePreviewPanel";
import VideoCompatibilityPanel from "@/components/VideoCompatibilityPanel";
import {
  createFrameZip,
  FRAME_ARCHIVE_BUDGET_BYTES,
  fitsFrameArchiveBudget,
  type ArchivedFrame,
} from "@/lib/frameArchive";
import {
  applySegmentationMask,
  formatDuration,
  formatFileSize,
  getErrorMessage,
  getProcessingDimensions,
  isVideoFile,
  LARGE_VIDEO_WARNING_BYTES,
  MAX_VIDEO_DURATION_SECONDS,
  MAX_VIDEO_FILE_BYTES,
  MAX_VIDEO_HEIGHT,
  MAX_VIDEO_WIDTH,
  PROCESSING_PLAYBACK_RATE,
  seekVideoToStart,
  waitForVideoPresentation,
} from "@/lib/videoProcessing";
import type {
  ArchiveExportStatus,
  ArchiveStatus,
  ExportStatus,
  MaskMessage,
  ModelStatus,
  PendingFrame,
  ProcessingResolution,
  ProcessingStatus,
  VideoExportCapability,
  VideoMetadata,
  WorkerMessage,
} from "@/types/video";

export default function Home() {
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const outputCanvasRef = useRef<HTMLCanvasElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const workerMessageHandlerRef = useRef<((event: MessageEvent<WorkerMessage>) => void) | null>(null);
  const workerLoadTimeoutRef = useRef<number | null>(null);
  const metadataTimeoutRef = useRef<number | null>(null);
  const frameAbortControllerRef = useRef<AbortController | null>(null);
  const pendingFrameRef = useRef<PendingFrame | null>(null);
  const nextFrameIdRef = useRef(0);
  const exportJobRef = useRef(0);
  const downloadUrlRef = useRef<string | null>(null);
  const archiveRef = useRef<ArchivedFrame[]>([]);
  const archiveBytesRef = useRef(0);
  const archiveExportJobRef = useRef(0);
  const archiveAbortControllerRef = useRef<AbortController | null>(null);
  const archiveUrlRef = useRef<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [metadata, setMetadata] = useState<VideoMetadata | null>(null);
  const [metadataMessage, setMetadataMessage] = useState("Reading video metadata…");
  const [modelStatus, setModelStatus] = useState<ModelStatus>("idle");
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus>("idle");
  const [modelMessage, setModelMessage] = useState("");
  const [message, setMessage] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [exportStatus, setExportStatus] = useState<ExportStatus>("idle");
  const [exportMessage, setExportMessage] = useState("");
  const [exportFilename, setExportFilename] = useState("processed-frame");
  const [exportSize, setExportSize] = useState<number | null>(null);
  const [downloadUrl, setDownloadUrl] = useState("");
  const [processedDimensions, setProcessedDimensions] = useState<{ width: number; height: number } | null>(null);
  const [segmentationMaskDimensions, setSegmentationMaskDimensions] = useState<{ width: number; height: number } | null>(null);
  const [processedFrameCount, setProcessedFrameCount] = useState(0);
  const [timelineProgress, setTimelineProgress] = useState(0);
 const [canProcess720p, setCanProcess720p] = useState(false);
const [canProcess1080p, setCanProcess1080p] = useState(false);
  const [processingResolution, setProcessingResolution] = useState<ProcessingResolution>("480p");
  const [savedFrameCount, setSavedFrameCount] = useState(0);
  const [archiveBytes, setArchiveBytes] = useState(0);
  const [archiveStatus, setArchiveStatus] = useState<ArchiveStatus>("empty");
  const [archiveWarning, setArchiveWarning] = useState("");
  const [archiveExportStatus, setArchiveExportStatus] = useState<ArchiveExportStatus>("idle");
  const [archiveExportMessage, setArchiveExportMessage] = useState("");
  const [archiveExportUrl, setArchiveExportUrl] = useState("");
  const [archiveExportBytes, setArchiveExportBytes] = useState<number | null>(null);
  const [archiveExportProgress, setArchiveExportProgress] = useState(0);
  const [videoExportCapability, setVideoExportCapability] = useState<VideoExportCapability>({
    status: "checking",
    message: "Checking browser compatibility…",
    vp9Encoder: null,
    vp9Alpha: null,
    vp9Decoder: null,
    mediaRecorderWebm: null,
  });

  function clearMetadataTimeout() {
    if (metadataTimeoutRef.current !== null) {
      window.clearTimeout(metadataTimeoutRef.current);
      metadataTimeoutRef.current = null;
    }
  }

  function revokeDownloadUrl() {
    if (downloadUrlRef.current) {
      URL.revokeObjectURL(downloadUrlRef.current);
      downloadUrlRef.current = null;
    }
  }

  function clearExport() {
    exportJobRef.current += 1;
    revokeDownloadUrl();
    setDownloadUrl("");
    setExportStatus("idle");
    setExportMessage("");
    setExportSize(null);
  }

  function revokeArchiveUrl() {
    if (archiveUrlRef.current) {
      URL.revokeObjectURL(archiveUrlRef.current);
      archiveUrlRef.current = null;
    }
  }

  function resetArchive() {
    archiveExportJobRef.current += 1;
    archiveAbortControllerRef.current?.abort();
    archiveAbortControllerRef.current = null;
    revokeArchiveUrl();
    archiveRef.current = [];
    archiveBytesRef.current = 0;
    setSavedFrameCount(0);
    setArchiveBytes(0);
    setArchiveStatus("empty");
    setArchiveWarning("");
    setArchiveExportStatus("idle");
    setArchiveExportMessage("");
    setArchiveExportUrl("");
    setArchiveExportBytes(null);
    setArchiveExportProgress(0);
  }

  const stopWorker = useCallback(() => {
    if (workerLoadTimeoutRef.current !== null) {
      window.clearTimeout(workerLoadTimeoutRef.current);
      workerLoadTimeoutRef.current = null;
    }
    pendingFrameRef.current?.reject(new DOMException("Segmentation worker stopped.", "AbortError"));
    const worker = workerRef.current;
    if (worker && workerMessageHandlerRef.current) {
      worker.removeEventListener("message", workerMessageHandlerRef.current);
    }
    worker?.terminate();
    workerRef.current = null;
    workerMessageHandlerRef.current = null;
  }, []);

  useEffect(() => () => {
    clearMetadataTimeout();
    frameAbortControllerRef.current?.abort();
    stopWorker();
  }, [stopWorker]);

  useEffect(() => () => {
    exportJobRef.current += 1;
    if (downloadUrlRef.current) URL.revokeObjectURL(downloadUrlRef.current);
    archiveExportJobRef.current += 1;
    archiveAbortControllerRef.current?.abort();
    if (archiveUrlRef.current) URL.revokeObjectURL(archiveUrlRef.current);
    archiveRef.current = [];
    archiveBytesRef.current = 0;
  }, []);

  useEffect(() => {
    if (!videoUrl) return;
    return () => URL.revokeObjectURL(videoUrl);
  }, [videoUrl]);

  useEffect(() => {
    let active = true;
    async function checkVideoExportCapability() {
      if (typeof VideoEncoder === "undefined" || typeof VideoDecoder === "undefined") {
        setVideoExportCapability({
          status: "unavailable",
          message: "This browser does not expose both WebCodecs encoder and decoder APIs required for a verifiable output.",
          vp9Encoder: false,
          vp9Alpha: false,
          vp9Decoder: false,
          mediaRecorderWebm: typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported("video/webm;codecs=vp9"),
        });
        return;
      }
      const encoderConfig = { codec: "vp09.00.10.08", width: 320, height: 240, bitrate: 400_000, framerate: 24 };
      const [encoder, alphaEncoder, decoder] = await Promise.all([
        VideoEncoder.isConfigSupported(encoderConfig),
        VideoEncoder.isConfigSupported({ ...encoderConfig, alpha: "keep" }),
        VideoDecoder.isConfigSupported({ codec: "vp09.00.10.08" }),
      ]);
      const mediaRecorderWebm = typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported("video/webm;codecs=vp9");
      const vp9Encoder = Boolean(encoder.supported);
      const vp9Alpha = Boolean(alphaEncoder.supported);
      const vp9Decoder = Boolean(decoder.supported);
      const capabilityMessage = vp9Alpha
        ? "The browser reports a VP9 alpha encoder configuration, but this app has no muxer or decode-and-alpha round-trip verification; transparent video export remains unavailable."
        : "WebCodecs VP9 encoding is available, but the browser rejects the alpha=keep configuration. MediaRecorder MIME support does not prove alpha preservation, and this app has no verified alpha-capable WebM muxer.";
      if (active) setVideoExportCapability({ status: "unavailable", message: capabilityMessage, vp9Encoder, vp9Alpha, vp9Decoder, mediaRecorderWebm });
    }

    void checkVideoExportCapability().catch((error: unknown) => {
      if (active) setVideoExportCapability({
        status: "unavailable",
        message: `Browser capability checks failed: ${getErrorMessage(error)}`,
        vp9Encoder: false,
        vp9Alpha: false,
        vp9Decoder: false,
        mediaRecorderWebm: typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported("video/webm;codecs=vp9"),
      });
    });
    return () => { active = false; };
  }, []);

  function chooseFile(file?: File) {
    if (!file) return;
    if (processingStatus === "processing" || archiveExportStatus === "exporting") {
      setMessage("Cancel the active processing or ZIP export before choosing another video.");
      return;
    }
    clearMetadataTimeout();
    clearExport();
    resetArchive();
    frameAbortControllerRef.current?.abort();
    frameAbortControllerRef.current = null;
    videoRef.current?.pause();
    stopWorker();
    setSelectedFile(null);
    setVideoUrl("");
    setMetadata(null);
    setMetadataMessage("Reading video metadata…");
    setProcessedDimensions(null);
    setSegmentationMaskDimensions(null);
    setProcessedFrameCount(0);
    setTimelineProgress(0);
    setModelStatus("idle");
    setProcessingStatus("idle");
    setModelMessage("");
    setMessage("");
    const previousCanvas = outputCanvasRef.current;
    if (previousCanvas) {
      previousCanvas.width = 0;
      previousCanvas.height = 0;
    }
    if (!isVideoFile(file)) {
      setMessage("Choose a video file with a supported browser codec.");
      return;
    }
    if (file.size > MAX_VIDEO_FILE_BYTES) {
      setMessage("This preview is limited to 250 MiB. Choose a smaller video.");
      return;
    }
    try {
      setVideoUrl(URL.createObjectURL(file));
    } catch {
      setMessage("The browser could not open this video file. Choose another file or free browser storage.");
      return;
    }
    setSelectedFile(file);
    setExportFilename(`${file.name.replace(/\.[^.]+$/, "")}-frame`);
    metadataTimeoutRef.current = window.setTimeout(() => {
      metadataTimeoutRef.current = null;
      invalidateVideoEligibility("The browser could not read video metadata within 15 seconds. The file may be damaged or use an unsupported codec.");
      setVideoUrl("");
    }, 15_000);
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    chooseFile(event.target.files?.[0]);
    event.target.value = "";
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    if (processingStatus === "processing") {
      setMessage("Cancel processing before choosing another video.");
      return;
    }
    chooseFile(event.dataTransfer.files[0]);
  }

  function invalidateVideoEligibility(reason: string) {
    clearMetadataTimeout();
    frameAbortControllerRef.current?.abort();
    frameAbortControllerRef.current = null;
    videoRef.current?.pause();
    stopWorker();
    clearExport();
    setMetadata(null);
    setMetadataMessage(reason);
    setModelStatus("idle");
    setProcessingStatus((current) => current === "idle" ? current : "error");
    setArchiveStatus((current) => current === "empty" ? current : "error");
    if (archiveRef.current.length > 0) {
      setArchiveWarning(`Video processing stopped: ${reason} Previously saved PNG frames are retained and can still be exported.`);
    }
    setModelMessage("");
    setCanProcess720p(false);
    setCanProcess1080p(false);
    setProcessingResolution("480p");
    setMessage(reason);
  }

  function handleVideoMetadata() {
    clearMetadataTimeout();
    const video = videoRef.current;
    if (!video) return;

    if (!Number.isFinite(video.duration) || video.duration <= 0 || video.videoWidth === 0 || video.videoHeight === 0) {
      invalidateVideoEligibility("This video has invalid or unavailable duration or dimensions. Choose a decodable video.");
      return;
    }

    if (video.duration > MAX_VIDEO_DURATION_SECONDS) {
      invalidateVideoEligibility("Maximum video duration is 1 minute.");
      return;
    }

    if (video.videoWidth > MAX_VIDEO_WIDTH || video.videoHeight > MAX_VIDEO_HEIGHT) {
      invalidateVideoEligibility("This preview supports source video frames up to 3840 × 2160. Choose a lower-resolution source.");
      return;
    }

    const deviceMemory =
      (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 0;

    const hardwareConcurrency = navigator.hardwareConcurrency ?? 0;

    const supports720p =
      deviceMemory >= 4 &&
      hardwareConcurrency >= 4;

    const supports1080p =
      supports720p &&
      deviceMemory >= 8 &&
      hardwareConcurrency >= 8;

    setCanProcess720p(supports720p);
    setCanProcess1080p(supports1080p);
    setProcessingResolution("480p");

    setMetadata({
      width: video.videoWidth,
      height: video.videoHeight,
      duration: video.duration,
    });
    setMetadataMessage("");
    setMessage("");
  }

  function handleVideoError() {
    invalidateVideoEligibility("The browser cannot decode this video. Try an MP4 or WebM with a supported codec.");
    setVideoUrl("");
  }

  async function saveProcessedFrame(
    canvas: HTMLCanvasElement,
    frameCount: number,
    mediaTime: number,
    resolution: ProcessingResolution,
    signal: AbortSignal,
  ) {
    if (!fitsFrameArchiveBudget(archiveBytesRef.current, 1)) {
      setArchiveStatus("budget");
      setArchiveWarning(`Archive memory budget reached. The archive contains the ${archiveRef.current.length} saved frames; processing stopped before another frame could be saved.`);
      return false;
    }

    let blob: Blob;
    try {
      blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((result) => {
          if (result) resolve(result);
          else reject(new Error("The browser could not encode a processed frame as PNG."));
        }, "image/png");
      });
    } catch (error) {
      if (signal.aborted) return false;
      setArchiveStatus("error");
      setArchiveWarning(`Frame ${frameCount} was processed but could not be saved to the archive: ${getErrorMessage(error)}`);
      throw error;
    }
    if (signal.aborted) return false;

    if (blob.type !== "image/png") {
      setArchiveStatus("error");
      setArchiveWarning(`Frame ${frameCount} was processed but the browser did not encode it as PNG. Recording stopped.`);
      throw new Error("The browser returned an unexpected archive frame format.");
    }

    if (!fitsFrameArchiveBudget(archiveBytesRef.current, blob.size)) {
      setArchiveStatus("budget");
      setArchiveWarning(`Memory budget reached before frame ${frameCount} could be saved. The archive contains the ${archiveRef.current.length} earlier saved frames; processing stopped so no processed frame is silently skipped.`);
      return false;
    }

    const dimensions = getProcessingDimensions(metadata!.width, metadata!.height, resolution);
    const archivedFrame: ArchivedFrame = {
      fileName: `frames/frame_${String(frameCount).padStart(6, "0")}.png`,
      mediaTime,
      resolution,
      width: dimensions.width,
      height: dimensions.height,
      blob,
    };
    archiveRef.current.push(archivedFrame);
    archiveBytesRef.current += blob.size;
    setSavedFrameCount(archiveRef.current.length);
    setArchiveBytes(archiveBytesRef.current);
    setArchiveStatus("recording");

    if (archiveBytesRef.current / FRAME_ARCHIVE_BUDGET_BYTES >= 0.9) {
      setArchiveWarning(`Archive is using ${formatFileSize(archiveBytesRef.current)} of the ${formatFileSize(FRAME_ARCHIVE_BUDGET_BYTES)} limit. Recording will stop before a frame would exceed the limit.`);
    }
    return true;
  }

  function loadModel() {
    if (!selectedFile || !metadata || workerRef.current) return;
    const video = videoRef.current;
    if (!video || !Number.isFinite(video.duration) || video.duration <= 0) {
      invalidateVideoEligibility("Video duration metadata is missing or invalid. Reload the video and try again.");
      return;
    }
    if (video.duration > MAX_VIDEO_DURATION_SECONDS || metadata.duration > MAX_VIDEO_DURATION_SECONDS) {
      invalidateVideoEligibility("Maximum video duration is 1 minute.");
      return;
    }

    setModelStatus("loading");
    setModelMessage("Loading the person-segmentation model and browser runtime…");
    setMessage("");

    try {
      const worker = new Worker(new URL("../workers/segmenter.worker.ts", import.meta.url), {
        type: "module",
      });
      workerRef.current = worker;

      const onMessage = (event: MessageEvent<WorkerMessage>) => {
        if (workerRef.current !== worker) return;
        const result = event.data;
        if (result.type === "ready") {
          if (workerLoadTimeoutRef.current !== null) {
            window.clearTimeout(workerLoadTimeoutRef.current);
            workerLoadTimeoutRef.current = null;
          }
          setModelStatus("ready");
          setModelMessage(`AI model ready (${result.delegate} processing). Model classes: ${result.labels.join(", ") || "not provided"}.`);
          return;
        }
        if (result.type === "error") {
          if (result.frameId !== undefined) {
            const pending = pendingFrameRef.current;
            if (pending && pending.frameId === result.frameId) {
              pending.reject(new Error(result.message));
            } else if (pending) {
              pending.reject(new Error(`The worker returned an error for frame ${result.frameId} while waiting for frame ${pending.frameId}.`));
            }
            return;
          }

          if (workerLoadTimeoutRef.current !== null) {
            window.clearTimeout(workerLoadTimeoutRef.current);
            workerLoadTimeoutRef.current = null;
          }
          pendingFrameRef.current?.reject(new Error(result.message));
          setModelStatus("error");
          setProcessingStatus((current) => current === "processing" ? "error" : current);
          setModelMessage("");
          setMessage(`AI processing error: ${result.message}`);
          stopWorker();
          return;
        }
        if (result.type === "mask") {
          const pending = pendingFrameRef.current;
          if (pending?.frameId === result.frameId) {
            pending.resolve(result);
          } else if (pending) {
            pending.reject(new Error("The segmentation worker returned a result for the wrong frame."));
          }
        }
      };

      workerMessageHandlerRef.current = onMessage;
      worker.addEventListener("message", onMessage);
      worker.addEventListener("error", (event) => {
        if (workerRef.current !== worker) return;
        if (workerLoadTimeoutRef.current !== null) {
          window.clearTimeout(workerLoadTimeoutRef.current);
          workerLoadTimeoutRef.current = null;
        }
        pendingFrameRef.current?.reject(new Error(`The segmentation worker stopped: ${event.message}`));
        setModelStatus("error");
        setProcessingStatus((current) => current === "processing" ? "error" : current);
        setModelMessage("");
        setMessage(`The background-removal worker stopped: ${event.message}`);
        stopWorker();
      }, { once: true });
      worker.addEventListener("messageerror", () => {
        if (workerRef.current !== worker) return;
        pendingFrameRef.current?.reject(new Error("The browser could not read a message from the segmentation worker."));
        setModelStatus("error");
        setProcessingStatus((current) => current === "processing" ? "error" : current);
        setModelMessage("");
        setMessage("The segmentation worker returned an unreadable message. Reload the model and retry.");
        stopWorker();
      }, { once: true });
      workerLoadTimeoutRef.current = window.setTimeout(() => {
        if (workerRef.current !== worker) return;
        workerLoadTimeoutRef.current = null;
        setModelStatus("error");
        setModelMessage("");
        setMessage("The AI runtime or model did not finish loading within 90 seconds. Check your connection, then retry.");
        stopWorker();
      }, 90_000);
      worker.postMessage({ type: "load" });
    } catch (error) {
      stopWorker();
      setModelStatus("error");
      setModelMessage("");
      setMessage(`The browser could not start the AI worker: ${getErrorMessage(error)}`);
    }
  }

  function requestSegmentation(
    worker: Worker,
    bitmap: ImageBitmap,
    timestamp: number,
    signal: AbortSignal,
  ) {
    return new Promise<MaskMessage>((resolve, reject) => {
      if (signal.aborted) {
        bitmap.close();
        reject(new DOMException("Video processing cancelled.", "AbortError"));
        return;
      }
      if (pendingFrameRef.current) {
        bitmap.close();
        reject(new Error("A segmentation frame is already in progress."));
        return;
      }

      const frameId = ++nextFrameIdRef.current;
      let settled = false;
      let timeoutId = 0;
      const pending: PendingFrame = { frameId, resolve: () => {}, reject: () => {} };
      const cleanup = () => {
        window.clearTimeout(timeoutId);
        signal.removeEventListener("abort", onAbort);
        if (pendingFrameRef.current === pending) pendingFrameRef.current = null;
      };
      const settleResolve = (result: MaskMessage) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(result);
      };
      const settleReject = (error: Error) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(error);
      };
      const onAbort = () => settleReject(new DOMException("Video processing cancelled.", "AbortError"));

      pending.resolve = settleResolve;
      pending.reject = settleReject;
      pendingFrameRef.current = pending;
      signal.addEventListener("abort", onAbort, { once: true });
      timeoutId = window.setTimeout(() => {
        setModelStatus("error");
        settleReject(new Error(`The segmentation worker did not return frame ${frameId} within 30 seconds.`));
        stopWorker();
      }, 30_000);

      try {
        worker.postMessage({ type: "segment", frameId, bitmap, timestamp }, [bitmap]);
      } catch (error) {
        bitmap.close();
        settleReject(new Error(getErrorMessage(error)));
      }
    });
  }

  async function processVideo() {
    const video = videoRef.current;
    const worker = workerRef.current;
    if (!video || !worker || !metadata || frameAbortControllerRef.current) return;

    if (!Number.isFinite(video.duration) || video.duration <= 0) {
      invalidateVideoEligibility("Video duration metadata is missing or invalid. Reload the video and try again.");
      return;
    }
    if (video.duration > MAX_VIDEO_DURATION_SECONDS || metadata.duration > MAX_VIDEO_DURATION_SECONDS) {
      invalidateVideoEligibility("Maximum video duration is 1 minute.");
      return;
    }
    if (Math.abs(video.duration - metadata.duration) > 0.05) {
      handleVideoMetadata();
      setMessage("Video metadata changed. Review the updated duration before processing.");
      return;
    }

    if (
      typeof video.requestVideoFrameCallback !== "function" &&
      typeof video.getVideoPlaybackQuality !== "function"
    ) {
      setProcessingStatus("error");
      setMessage("This browser does not expose a reliable video-frame counter or frame callback, so full-video processing is unavailable.");
      return;
    }

    clearExport();
    resetArchive();
    setProcessedDimensions(null);
    setSegmentationMaskDimensions(null);
    setProcessedFrameCount(0);
    setTimelineProgress(0);
    const outputCanvas = outputCanvasRef.current;
    const outputContext = outputCanvas?.getContext("2d");
    if (!outputCanvas || !outputContext) {
      setProcessingStatus("error");
      setMessage("The browser could not create the processed preview canvas.");
      return;
    }
    outputContext.clearRect(0, 0, outputCanvas.width, outputCanvas.height);

    const controller = new AbortController();
    frameAbortControllerRef.current = controller;
    setProcessingStatus("processing");
    setModelMessage("Starting controlled playback and person segmentation…");
    setMessage("");

    const maskCanvas = document.createElement("canvas");
    const dimensions = getProcessingDimensions(metadata.width, metadata.height, processingResolution);
    let maskImage: ImageData | null = null;
    let frameCount = 0;
    let lastPresentedFrames: number | null = null;
    let lastDroppedFrames: number | null = null;
    let lastMediaTime = -1;
    let stoppedAtBudget = false;
    const originalPlaybackRate = video.playbackRate;
    try {
      video.playbackRate = PROCESSING_PLAYBACK_RATE;
      video.pause();
      await seekVideoToStart(video, controller.signal);

      while (!controller.signal.aborted) {
        const presentation = await waitForVideoPresentation(video, controller.signal);
        if (presentation.type === "ended") break;

        const { mediaTime, presentedFrames, droppedFrames } = presentation;
        const frameDelta = lastPresentedFrames === null ? 1 : presentedFrames - lastPresentedFrames;
        const droppedDelta = droppedFrames === null || lastDroppedFrames === null
          ? 0
          : droppedFrames - lastDroppedFrames;
        if (frameDelta < 0 || frameDelta > 1 || droppedDelta !== 0) {
          const previousMediaTime = lastMediaTime >= 0 ? `${lastMediaTime.toFixed(3)}s` : "start";
          throw new Error(`Frame presentation changed from ${lastPresentedFrames ?? "start"} to ${presentedFrames} (delta ${frameDelta}); media time ${previousMediaTime} to ${mediaTime.toFixed(3)}s; ${droppedDelta} newly dropped frame(s). This pass is incomplete; try a lower processing resolution or another browser.`);
        }
        if (lastPresentedFrames === null && mediaTime > 0.25) {
          throw new Error("The browser did not present the first frame near the start of the video. Processing stopped to avoid an incomplete result.");
        }
        if (mediaTime <= lastMediaTime) {
          throw new Error("The video decoder returned a repeated or out-of-order frame. Processing stopped without marking the video complete.");
        }

        const bitmap = await createImageBitmap(video, {
          resizeWidth: dimensions.width,
          resizeHeight: dimensions.height,
          resizeQuality: "high",
        });
        if (controller.signal.aborted) {
          bitmap.close();
          break;
        }

        const result = await requestSegmentation(worker, bitmap, mediaTime * 1000, controller.signal);
        if (controller.signal.aborted) break;
        setSegmentationMaskDimensions({ width: result.width, height: result.height });
        maskImage = applySegmentationMask(
          video,
          outputCanvas,
          maskCanvas,
          result,
          dimensions.width,
          dimensions.height,
          maskImage,
        );

        frameCount += 1;
        lastPresentedFrames = presentedFrames;
        lastDroppedFrames = droppedFrames;
        lastMediaTime = mediaTime;
        const progress = Math.min(100, (mediaTime / metadata.duration) * 100);
        setProcessedFrameCount(frameCount);
        setProcessedDimensions(dimensions);
        setTimelineProgress(progress);
        setModelMessage(`Processed ${frameCount} frames · ${formatDuration(mediaTime)} of ${formatDuration(metadata.duration)}`);

        const wasSaved = await saveProcessedFrame(
          outputCanvas,
          frameCount,
          mediaTime,
          processingResolution,
          controller.signal,
        );
        if (controller.signal.aborted) break;
        if (!wasSaved) {
          stoppedAtBudget = true;
          break;
        }
      }

      if (controller.signal.aborted) return;
      if (frameCount === 0) {
        throw new Error("The browser reached the end without presenting a decodable video frame.");
      }

      if (stoppedAtBudget) {
        setProcessingStatus("error");
        setModelMessage("");
        setMessage(archiveWarning || "Archive memory limit reached; processing stopped before another frame was discarded.");
        return;
      }

      setTimelineProgress(100);
      setProcessingStatus("complete");
      setArchiveStatus((current) => current === "recording" ? "complete" : current);
      setModelMessage("");
      setMessage(`Decoder reached the end at controlled ${PROCESSING_PLAYBACK_RATE}× playback. Processed ${frameCount} presented frames with no detected frame gaps; the exact encoded frame total is unavailable in this browser.`);
    } catch (error) {
      if (!controller.signal.aborted) {
        setProcessingStatus("error");
        setArchiveStatus((current) => current === "recording" ? "error" : current);
        setModelMessage("");
        setMessage(getErrorMessage(error));
      }
    } finally {
      video.pause();
      video.playbackRate = originalPlaybackRate;
      maskCanvas.width = 0;
      maskCanvas.height = 0;
      if (frameAbortControllerRef.current === controller) {
        frameAbortControllerRef.current = null;
      }
    }
  }

  function cancelProcessing() {
    const controller = frameAbortControllerRef.current;
    if (!controller) return;
    controller.abort();
    frameAbortControllerRef.current = null;
    stopWorker();
    videoRef.current?.pause();
    setModelStatus("idle");
    setProcessingStatus("cancelled");
    setArchiveStatus((current) => current === "recording" ? "cancelled" : current);
    setModelMessage("");
    setMessage(`Processing cancelled after ${processedFrameCount} frames. The last processed frame remains available; reload the model to restart.`);
  }

  function reset() {
    clearMetadataTimeout();
    clearExport();
    resetArchive();
    frameAbortControllerRef.current?.abort();
    frameAbortControllerRef.current = null;
    videoRef.current?.pause();
    stopWorker();
    setSelectedFile(null);
    setVideoUrl("");
    setMetadata(null);
    setProcessedDimensions(null);
    setSegmentationMaskDimensions(null);
    setProcessedFrameCount(0);
    setTimelineProgress(0);
    setModelStatus("idle");
    setProcessingStatus("idle");
    setModelMessage("");
    setMessage("");
    setCanProcess720p(false);
    setProcessingResolution("480p");
    const canvas = outputCanvasRef.current;
    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
    }
  }

  async function exportProcessedFrame() {
    const canvas = outputCanvasRef.current;
    if (!canvas || processingStatus === "processing" || processedFrameCount < 1 || canvas.width < 1 || canvas.height < 1) return;

    clearExport();
    const jobId = ++exportJobRef.current;
    setExportStatus("exporting");
    setExportMessage("Encoding the processed frame as a lossless PNG…");

    try {
      if (typeof canvas.toBlob !== "function") {
        throw new Error("PNG export is not supported by this browser.");
      }

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((result) => {
          if (result) resolve(result);
          else reject(new Error("The browser could not encode this frame as PNG. Try again."));
        }, "image/png");
      });

      if (jobId !== exportJobRef.current) return;
      if (blob.type !== "image/png") {
        throw new Error("The browser returned an unexpected image format. No file was created.");
      }

      const url = URL.createObjectURL(blob);
      downloadUrlRef.current = url;
      setDownloadUrl(url);
      setExportSize(blob.size);
      setExportStatus("complete");
      setExportMessage("Transparent PNG is ready to download.");
    } catch (error) {
      if (jobId !== exportJobRef.current) return;
      setExportStatus("error");
      setExportMessage(getErrorMessage(error));
    }
  }

  function cancelExport() {
    if (exportStatus !== "exporting") return;
    exportJobRef.current += 1;
    setExportStatus("cancelled");
    setExportMessage("Export cancelled. Any in-progress browser encoding will be discarded when it finishes.");
  }

  async function exportFrameArchive() {
    if (archiveAbortControllerRef.current || archiveRef.current.length === 0) return;

    archiveExportJobRef.current += 1;
    const jobId = archiveExportJobRef.current;
    const controller = new AbortController();
    archiveAbortControllerRef.current = controller;
    const frames = archiveRef.current.slice();
    const wasProcessingComplete = processingStatus === "complete";
    const warnings = [
      archiveStatus === "budget" ? archiveWarning : "",
      !wasProcessingComplete ? "Processing was cancelled or stopped before the video decoder reached its end; this archive contains only frames saved before the stop." : "",
      "The archive contains processed PNG image frames, not a transparent video. The exact encoded source-frame total is unavailable.",
    ].filter(Boolean);
    const frameSizes = frames.map((frame) => `${frame.fileName}: ${formatFileSize(frame.blob.size)} (${frame.blob.size} bytes)`);
    const readme = [
      "BRX Background Remover - Processed Frame Archive",
      "",
      `Original file: ${selectedFile?.name ?? "Unknown"}`,
      `Processing resolution: ${frames[0]?.resolution ?? processingResolution}`,
      `Frames saved: ${frames.length}`,
      `Encoded PNG bytes saved: ${archiveBytesRef.current}`,
      `Archive frame memory budget: ${FRAME_ARCHIVE_BUDGET_BYTES} bytes (${formatFileSize(FRAME_ARCHIVE_BUDGET_BYTES)})`,
      "",
      "Actual encoded frame sizes:",
      ...frameSizes,
      "",
      "Warnings and limitations:",
      ...warnings.map((warning) => `- ${warning}`),
      "- Frames are browser-decoded and segmented sequentially; the browser does not expose an authoritative encoded-frame total.",
      "- Only successfully segmented frames that fit within the encoded PNG memory budget are included.",
    ].join("\n");

    revokeArchiveUrl();
    setArchiveExportUrl("");
    setArchiveExportBytes(null);
    setArchiveExportProgress(0);
    setArchiveExportStatus("exporting");
    setArchiveExportMessage(`Creating ZIP from ${frames.length} saved PNG frames…`);

    try {
      const zipBlob = await createFrameZip(frames, readme, controller.signal, (count) => {
        if (jobId !== archiveExportJobRef.current) return;
        setArchiveExportProgress((count / frames.length) * 100);
        setArchiveExportMessage(`Added ${count} of ${frames.length} frame PNGs to the ZIP…`);
      });
      if (controller.signal.aborted || jobId !== archiveExportJobRef.current) return;
      if (zipBlob.type !== "application/zip" || zipBlob.size === 0) {
        throw new Error("The browser did not create a valid ZIP archive.");
      }

      const url = URL.createObjectURL(zipBlob);
      archiveUrlRef.current = url;
      setArchiveExportUrl(url);
      setArchiveExportBytes(zipBlob.size);
      setArchiveExportProgress(100);
      setArchiveExportStatus("complete");
      setArchiveExportMessage(`ZIP archive is ready with ${frames.length} processed PNG frames.`);
    } catch (error) {
      if (controller.signal.aborted || jobId !== archiveExportJobRef.current) return;
      setArchiveExportStatus("error");
      setArchiveExportMessage(`ZIP creation failed. Saved frame PNGs are preserved; retry is available. ${getErrorMessage(error)}`);
    } finally {
      if (archiveAbortControllerRef.current === controller) {
        archiveAbortControllerRef.current = null;
      }
    }
  }

  function cancelFrameArchiveExport() {
    const controller = archiveAbortControllerRef.current;
    if (!controller) return;
    archiveExportJobRef.current += 1;
    controller.abort();
    archiveAbortControllerRef.current = null;
    setArchiveExportStatus("cancelled");
    setArchiveExportMessage("ZIP creation cancelled. Saved processed PNG frames are preserved for another export attempt.");
  }

  const isReady = modelStatus === "ready" && Boolean(metadata);

  return (
    <main className="min-h-screen px-5 pb-16 pt-6 sm:px-8 sm:pt-8">
      <div className="mx-auto max-w-6xl">
        <header className="flex items-center justify-between border-b border-white/[0.08] pb-5">
          <Link className="flex items-center gap-3" href="/" aria-label="BRX Background Remover home">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-accent/25 bg-accent/10 text-sm font-bold tracking-tight text-accent">
              BRX
            </span>
            <span className="text-sm font-semibold tracking-wide text-white sm:text-base">
              Background Remover
            </span>
          </Link>
          <span className="hidden rounded-full border border-white/10 px-3 py-1.5 text-xs text-slate-400 sm:inline-flex">
            Frame-by-frame
          </span>
        </header>

        <section className="mx-auto max-w-4xl pt-14 sm:pt-20">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">
              Browser-based person segmentation
            </p>
            <h1 className="mt-5 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              Your subject, <span className="text-slate-400">in focus.</span>
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-slate-400 sm:text-lg">
              Process browser-decoded video frames locally and inspect the latest transparent result.
            </p>
          </div>

          <div
            className={`mt-9 rounded-2xl border border-dashed p-6 text-left transition-colors sm:p-8 ${
              isDragging
                ? "border-accent bg-accent/[0.08]"
                : "border-white/[0.16] bg-panel/80 hover:border-white/30"
            }`}
            onDragEnter={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                setIsDragging(false);
              }
            }}
            onDrop={handleDrop}
          >
            <input
              ref={inputRef}
              className="sr-only"
              type="file"
              accept="video/*,.mp4,.webm,.mov,.m4v,.ogv,.ogg,.avi,.mkv"
              disabled={processingStatus === "processing" || archiveExportStatus === "exporting"}
              onChange={handleFileChange}
              aria-label="Choose a video file"
            />
            <div className="text-center">
              <h2 className="break-all text-base font-medium text-white">
                {selectedFile ? selectedFile.name : "Drop your video here"}
              </h2>
              <p className="mt-2 text-sm text-slate-400">
                {selectedFile
                  ? `${(selectedFile.size / (1024 * 1024)).toFixed(1)} MiB`
                  : "Select or drag a video from your device"}
              </p>
              {selectedFile && selectedFile.size >= LARGE_VIDEO_WARNING_BYTES && (
                <p className="mt-2 text-xs leading-5 text-amber-200/80" role="note">
                  Large videos use more browser memory and may fail on devices with limited resources.
                </p>
              )}

              <div className="mt-5 flex flex-wrap justify-center gap-3">
                <button
                  className="rounded-lg border border-white/15 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/[0.09] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  type="button"
                  disabled={processingStatus === "processing" || archiveExportStatus === "exporting"}
                  onClick={() => inputRef.current?.click()}
                >
                  {selectedFile ? "Choose another video" : "Browse videos"}
                </button>
                {selectedFile && (
                  <button
                    className="rounded-lg border border-white/10 px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    type="button"
                    disabled={archiveExportStatus === "exporting"}
                    onClick={reset}
                  >
                    Reset
                  </button>
                )}
              </div>
              <p className="mt-4 text-xs text-slate-500">
                Up to 250 MiB · Up to 3840 x 2160 · Up to 60 seconds · Browser-supported codecs only
              </p>
            </div>
          </div>

          {metadata && (
            <section className="mt-5 rounded-2xl border border-white/[0.08] bg-panel/80 p-5 sm:p-6" aria-label="Video processing controls">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-white">Video settings</h2>
                  <p className="mt-1 text-xs text-slate-400">
                    {metadata.width} x {metadata.height} px · {formatDuration(metadata.duration)} · duration limit passed
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {modelStatus !== "ready" && (
                    <button
                      className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-[#a4b0ff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-wait disabled:opacity-60"
                      type="button"
                      disabled={modelStatus === "loading" || archiveExportStatus === "exporting"}
                      onClick={loadModel}
                    >
                      {modelStatus === "loading" ? "Loading AI model..." : modelStatus === "error" ? "Retry AI model" : "Load AI model"}
                    </button>
                  )}
                  {isReady && processingStatus !== "processing" && (
                    <button
                      className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-[#a4b0ff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60"
                      type="button"
                      disabled={archiveExportStatus === "exporting"}
                      onClick={() => { void processVideo(); }}
                    >
                      {processingStatus === "complete" ? "Process video again" : "Start frame processing"}
                    </button>
                  )}
                  {processingStatus === "processing" && (
                    <button
                      className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-4 py-2.5 text-sm font-medium text-rose-200 transition hover:bg-rose-500/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                      type="button"
                      onClick={cancelProcessing}
                    >
                      Cancel processing
                    </button>
                  )}
                </div>
              </div>

              <fieldset className="mt-5" disabled={processingStatus === "processing" || archiveExportStatus === "exporting"}>
                <legend className="text-xs font-medium text-slate-300">Processing resolution</legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    className={`rounded-lg border px-3 py-2 text-xs font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${processingResolution === "480p" ? "border-accent/50 bg-accent/10 text-accent" : "border-white/10 text-slate-300 hover:bg-white/[0.05]"}`}
                    type="button"
                    aria-pressed={processingResolution === "480p"}
                    onClick={() => setProcessingResolution("480p")}
                  >Up to 480p · recommended</button>
                  <button
                    className={`rounded-lg border px-3 py-2 text-xs font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${processingResolution === "720p" ? "border-accent/50 bg-accent/10 text-accent" : "border-white/10 text-slate-300 hover:bg-white/[0.05]"}`}
                    type="button"
                    disabled={!canProcess720p}
                    aria-pressed={processingResolution === "720p"}
                    title={canProcess720p ? "Available based on reported device memory and logical cores" : "720p requires reported memory of at least 4 GiB and at least 4 logical cores"}
                    onClick={() => setProcessingResolution("720p")}
                  >Up to 720p · {canProcess720p ? "available" : "not recommended on this device"}</button>
                  <span className="rounded-lg border border-white/[0.06] px-3 py-2 text-xs text-slate-500" aria-disabled="true" title="A native-resolution 4K segmentation pipeline is not implemented">4K · unavailable</span>
                </div>
                <button
                  className={`rounded-lg border px-3 py-2 text-xs font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                    processingResolution === "1080p"
                      ? "border-accent/50 bg-accent/10 text-accent"
                      : "border-white/10 text-slate-300 hover:bg-white/[0.05]"
                  }`}
                  type="button"
                  disabled={!canProcess1080p}
                  aria-pressed={processingResolution === "1080p"}
                  title={
                    canProcess1080p
                      ? "Available based on reported device memory and logical cores"
                      : "1080p requires reported memory of at least 8 GiB and at least 8 logical cores"
                  }
                  onClick={() => setProcessingResolution("1080p")}
                >
                  Up to 1080p ·{" "}
                  {canProcess1080p ? "available" : "not recommended on this device"}
                </button>
                <p className="mt-2 text-xs leading-5 text-slate-500">Output is capped at the selected size and never enlarged beyond the source. Capability checks are estimates; they do not guarantee processing performance.</p>
              </fieldset>
            </section>
          )}

  <p className="mt-4 min-h-5 text-sm text-slate-400" role={processingStatus === "error" || modelStatus === "error" ? "alert" : "status"} aria-live={processingStatus === "error" || modelStatus === "error" ? "assertive" : "polite"}>
            {message || modelMessage || (selectedFile && !metadata ? metadataMessage : "")}
          </p>

          {processingStatus !== "idle" && (
            <div className="mt-3">
              <p className="mb-2 text-xs font-medium text-slate-300" role="status">
                {processingStatus === "processing" ? "Processing frames" : processingStatus === "complete" ? "Processing complete" : processingStatus === "cancelled" ? "Processing cancelled; saved frames are retained" : "Processing stopped with an error"}
              </p>
              <div className="mb-2 flex flex-wrap justify-between gap-x-4 gap-y-1 text-xs text-slate-400">
                <span>{processedFrameCount} frames processed</span>
                <span>Total frame count unavailable from this browser</span>
              </div>
              <div
                className="h-1.5 overflow-hidden rounded-full bg-white/[0.08]"
                role="progressbar"
                aria-label="Video timeline processed"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(timelineProgress)}
                aria-valuetext={`${Math.round(timelineProgress)}% of video timeline reached`}
              >
                <div className="h-full rounded-full bg-accent transition-[width] duration-150" style={{ width: `${timelineProgress}%` }} />
              </div>
            </div>
          )}

          <FramePreviewPanel
            videoUrl={videoUrl}
            videoRef={videoRef}
            outputCanvasRef={outputCanvasRef}
            processingStatus={processingStatus}
            processedFrameCount={processedFrameCount}
            onLoadedMetadata={handleVideoMetadata}
            onVideoError={handleVideoError}
          />

          {selectedFile && (
            <FrameArchivePanel
              fileName={selectedFile.name}
              processingStatus={processingStatus}
              processedFrameCount={processedFrameCount}
              savedFrameCount={savedFrameCount}
              archiveBytes={archiveBytes}
              archiveStatus={archiveStatus}
              archiveWarning={archiveWarning}
              exportStatus={archiveExportStatus}
              exportMessage={archiveExportMessage}
              exportUrl={archiveExportUrl}
              exportBytes={archiveExportBytes}
              exportProgress={archiveExportProgress}
              onExport={exportFrameArchive}
              onCancelExport={cancelFrameArchiveExport}
            />
          )}

          <VideoCompatibilityPanel capability={videoExportCapability} />

          <FramePngExportPanel
            processedFrameCount={processedFrameCount}
            processingStatus={processingStatus}
            dimensions={processedDimensions}
            filename={exportFilename}
            status={exportStatus}
            size={exportSize}
            downloadUrl={downloadUrl}
            message={exportMessage}
            archiveIsExporting={archiveExportStatus === "exporting"}
            onFilenameChange={setExportFilename}
            onExport={exportProcessedFrame}
            onCancel={cancelExport}
          />

          <p className="mt-8 text-center text-xs leading-5 text-slate-500">
            Your video is processed in this browser and is not uploaded. The AI runtime and model download from jsDelivr and Google on request. This model segments people, not arbitrary objects.
          </p>
          <p className="mt-3 text-center text-xs leading-5 text-slate-500">
            Frames are segmented sequentially. Processed PNG blobs are retained up to a 200 MiB archive budget. This limit covers retained PNG data, not total browser or ZIP-generation memory; the browser does not expose an authoritative encoded frame total. This exports PNG frames, not a processed video.
          </p>
        </section>
      </div>
    </main>
  );
}