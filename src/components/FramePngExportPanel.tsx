import { formatFileSize, getPngFilename } from "@/lib/videoProcessing";
import type { ExportStatus, ProcessingStatus } from "@/types/video";

type FramePngExportPanelProps = {
  processedFrameCount: number;
  processingStatus: ProcessingStatus;
  dimensions: { width: number; height: number } | null;
  filename: string;
  status: ExportStatus;
  size: number | null;
  downloadUrl: string;
  message: string;
  archiveIsExporting: boolean;
  onFilenameChange: (filename: string) => void;
  onExport: () => void;
  onCancel: () => void;
};

export default function FramePngExportPanel({
  processedFrameCount,
  processingStatus,
  dimensions,
  filename,
  status,
  size,
  downloadUrl,
  message,
  archiveIsExporting,
  onFilenameChange,
  onExport,
  onCancel,
}: FramePngExportPanelProps) {
  if (processedFrameCount === 0 || processingStatus === "processing") return null;

  return (
    <section className="mt-8 border-t border-white/[0.08] pt-7" aria-labelledby="export-heading">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Export</p>
          <h2 id="export-heading" className="mt-2 text-lg font-semibold text-white">Processed frame</h2>
        </div>
        <span className="text-xs text-slate-500">Current processed frame only · no video export</span>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="text-sm text-slate-300">
          Output format
          <select
            className="mt-2 block w-full rounded-lg border border-white/15 bg-[#101520] px-3 py-2.5 text-sm text-white"
            value="png"
            disabled
            aria-label="Output format"
          >
            <option value="png">PNG image · single frame · alpha supported</option>
          </select>
        </label>
        <label className="text-sm text-slate-300">
          Output dimensions
          <input
            className="mt-2 block w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-slate-300"
            value={`${dimensions?.width ?? 0} × ${dimensions?.height ?? 0} px · lossless`}
            readOnly
            aria-label="Output dimensions"
          />
        </label>
        <label className="text-sm text-slate-300">
          File name
          <div className="mt-2 flex items-center rounded-lg border border-white/15 bg-[#101520] pr-3 focus-within:outline focus-within:outline-2 focus-within:outline-accent">
            <input
              className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm text-white outline-none"
              value={filename}
              onChange={(event) => onFilenameChange(event.target.value)}
              maxLength={140}
              aria-label="Export file name"
            />
            <span className="text-sm text-slate-500">.png</span>
          </div>
        </label>
        <div className="text-sm text-slate-300">
          Frame rate
          <p className="mt-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5 text-slate-400">
            Not applicable · PNG frame
          </p>
        </div>
      </div>

      <p className="mt-4 text-xs leading-5 text-slate-500">
        PNG preserves the latest processed frame’s transparency. Resolution follows the selected processing cap (480p or capability-gated 720p). Full-video export, frame-rate conversion, and temporal smoothing are not implemented.
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-ink transition hover:bg-[#a4b0ff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:bg-white/[0.08] disabled:text-slate-500"
          type="button"
          onClick={onExport}
          disabled={status === "exporting" || archiveIsExporting}
        >
          {status === "exporting" ? "Encoding PNG…" : status === "error" ? "Retry export" : "Export PNG"}
        </button>
        {status === "exporting" && (
          <button
            className="rounded-lg border border-white/15 px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            type="button"
            onClick={onCancel}
          >Cancel export</button>
        )}
        {status === "complete" && downloadUrl && (
          <a
            className="rounded-lg border border-accent/40 px-4 py-2.5 text-sm font-semibold text-accent transition hover:bg-accent/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            href={downloadUrl}
            download={getPngFilename(filename)}
          >Download PNG</a>
        )}
        {size !== null && status === "complete" && (
          <span className="text-sm text-slate-400">Actual file size: {formatFileSize(size)}</span>
        )}
      </div>
      <p className="mt-3 min-h-5 text-sm text-slate-400" role={status === "error" ? "alert" : "status"} aria-live={status === "error" ? "assertive" : "polite"}>{message}</p>
    </section>
  );
}