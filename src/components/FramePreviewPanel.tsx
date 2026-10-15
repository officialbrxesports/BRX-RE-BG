import type { RefObject } from "react";
import type { ProcessingStatus } from "@/types/video";

type FramePreviewPanelProps = {
  videoUrl: string;
  videoRef: RefObject<HTMLVideoElement | null>;
  outputCanvasRef: RefObject<HTMLCanvasElement | null>;
  processingStatus: ProcessingStatus;
  processedFrameCount: number;
  onLoadedMetadata: () => void;
  onVideoError: () => void;
};

export default function FramePreviewPanel({
  videoUrl,
  videoRef,
  outputCanvasRef,
  processingStatus,
  processedFrameCount,
  onLoadedMetadata,
  onVideoError,
}: FramePreviewPanelProps) {
  if (!videoUrl && processedFrameCount === 0) return null;

  return (
    <div className="mt-9 grid gap-5 sm:grid-cols-2">
      <section className="min-w-0" aria-label="Original video preview">
        <h2 className="mb-3 text-sm font-medium text-white">Original video · decoder frame</h2>
        {videoUrl && (
          <video
            ref={videoRef}
            className="max-h-80 w-full rounded-xl border border-white/10 bg-black object-contain"
            src={videoUrl}
            controls={processingStatus !== "processing"}
            preload="auto"
            playsInline
            muted
            onLoadedMetadata={onLoadedMetadata}
            onDurationChange={onLoadedMetadata}
            onError={onVideoError}
            aria-label="Original video preview"
          />
        )}
      </section>
      <section className="min-w-0" aria-label="Processed frame preview">
        <h2 className="mb-3 text-sm font-medium text-white">Background removed · latest completed frame</h2>
        <div className="checkerboard flex min-h-48 items-center justify-center overflow-hidden rounded-xl border border-white/10">
          <canvas
            ref={outputCanvasRef}
            className={`max-h-80 w-full object-contain ${processedFrameCount > 0 ? "" : "hidden"}`}
            aria-label="Latest AI-processed transparent video frame"
          />
          {processedFrameCount === 0 && (
            <p className="px-5 py-10 text-center text-sm text-slate-400">
              Start processing to preview transparent frames as they complete.
            </p>
          )}
        </div>
        <p className="mt-2 text-xs text-slate-500">Only the latest processed frame is retained for preview and PNG export.</p>
      </section>
    </div>
  );
}