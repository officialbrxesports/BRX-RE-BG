import { formatFileSize, getPngFilename } from "@/lib/videoProcessing";
import { FRAME_ARCHIVE_BUDGET_BYTES } from "@/lib/frameArchive";
import type { ArchiveExportStatus, ArchiveStatus, ProcessingStatus } from "@/types/video";

type FrameArchivePanelProps = {
  fileName: string;
  processingStatus: ProcessingStatus;
  processedFrameCount: number;
  savedFrameCount: number;
  archiveBytes: number;
  archiveStatus: ArchiveStatus;
  archiveWarning: string;
  exportStatus: ArchiveExportStatus;
  exportMessage: string;
  exportUrl: string;
  exportBytes: number | null;
  exportProgress: number;
  onExport: () => void;
  onCancelExport: () => void;
};

export default function FrameArchivePanel({
  fileName,
  processingStatus,
  processedFrameCount,
  savedFrameCount,
  archiveBytes,
  archiveStatus,
  archiveWarning,
  exportStatus,
  exportMessage,
  exportUrl,
  exportBytes,
  exportProgress,
  onExport,
  onCancelExport,
}: FrameArchivePanelProps) {
  return (
    <section className="mt-8 border-t border-white/[0.08] pt-7" aria-labelledby="archive-heading">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Frame archive</p>
          <h2 id="archive-heading" className="mt-2 text-lg font-semibold text-white">Processed PNG frames</h2>
        </div>
        <span className="text-xs text-slate-500">
          {archiveStatus === "empty"
            ? "Waiting for processed frames"
            : archiveStatus === "recording"
              ? "Recording frames"
              : archiveStatus === "complete"
                ? "Recording complete"
                : archiveStatus === "cancelled"
                  ? "Processing cancelled · saved frames retained"
                  : archiveStatus === "budget"
                    ? "Stopped at archive budget"
                    : "Processing stopped · saved frames retained"}
        </span>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-x-5 gap-y-4 text-sm sm:grid-cols-4">
        <div><dt className="text-slate-500">Frames processed</dt><dd className="mt-1 font-medium text-white">{processedFrameCount}</dd></div>
        <div><dt className="text-slate-500">Frames saved</dt><dd className="mt-1 font-medium text-white">{savedFrameCount}</dd></div>
        <div><dt className="text-slate-500">Encoded PNG data</dt><dd className="mt-1 font-medium text-white">{formatFileSize(archiveBytes)}</dd></div>
        <div><dt className="text-slate-500">Remaining budget</dt><dd className="mt-1 font-medium text-white">{formatFileSize(Math.max(0, FRAME_ARCHIVE_BUDGET_BYTES - archiveBytes))}</dd></div>
      </dl>

      <p className="mt-4 text-xs leading-5 text-slate-500">
        Encoded PNG memory budget: {formatFileSize(FRAME_ARCHIVE_BUDGET_BYTES)}. Only successfully segmented PNG blobs are stored. ZIP is created locally and contains image frames, not a video.
      </p>
      {archiveWarning && <p className="mt-3 text-sm leading-5 text-amber-200/90" role="status">{archiveWarning}</p>}

      {savedFrameCount > 0 && (
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-ink transition hover:bg-[#a4b0ff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:bg-white/[0.08] disabled:text-slate-500"
            type="button"
            disabled={exportStatus === "exporting" || processingStatus === "processing"}
            onClick={onExport}
          >
            {exportStatus === "exporting" ? "Creating ZIP…" : exportStatus === "error" ? "Retry ZIP export" : "Export saved frames as ZIP"}
          </button>
          {exportStatus === "exporting" && (
            <button
              className="rounded-lg border border-white/15 px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              type="button"
              onClick={onCancelExport}
            >Cancel ZIP</button>
          )}
          {exportStatus === "complete" && exportUrl && (
            <a
              className="rounded-lg border border-accent/40 px-4 py-2.5 text-sm font-semibold text-accent transition hover:bg-accent/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              href={exportUrl}
              download={`${getPngFilename(fileName.replace(/\.[^.]+$/, "")).replace(/\.png$/i, "")}-frames.zip`}
            >Download ZIP</a>
          )}
          {exportBytes !== null && exportStatus === "complete" && (
            <span className="text-sm text-slate-400">Actual ZIP size: {formatFileSize(exportBytes)}</span>
          )}
        </div>
      )}

      {exportStatus === "exporting" && (
        <div className="mt-4">
          <div className="mb-2 flex justify-between gap-4 text-xs text-slate-400">
            <span>{exportMessage}</span><span>{Math.round(exportProgress)}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.08]" role="progressbar" aria-label="ZIP frame entries added" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(exportProgress)}>
            <div className="h-full rounded-full bg-accent transition-[width] duration-150" style={{ width: `${exportProgress}%` }} />
          </div>
        </div>
      )}
      {exportStatus !== "exporting" && exportMessage && (
        <p className="mt-3 text-sm text-slate-400" role={exportStatus === "error" ? "alert" : "status"} aria-live={exportStatus === "error" ? "assertive" : "polite"}>{exportMessage}</p>
      )}
    </section>
  );
}