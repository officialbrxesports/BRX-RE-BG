import type { VideoExportCapability } from "@/types/video";

type VideoCompatibilityPanelProps = {
  capability: VideoExportCapability;
};

export default function VideoCompatibilityPanel({ capability }: VideoCompatibilityPanelProps) {
  return (
    <section className="mt-8 border-t border-white/[0.08] pt-7" aria-labelledby="video-export-heading">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Video compatibility</p>
          <h2 id="video-export-heading" className="mt-2 text-lg font-semibold text-white">Transparent video export</h2>
        </div>
        <span className="text-xs text-amber-200/90">
          {capability.status === "checking" ? "Checking browser compatibility" : "Unavailable in this browser"}
        </span>
      </div>
      <p className="mt-4 text-sm leading-6 text-slate-300" role="status" aria-live="polite">{capability.message}</p>
      <dl className="mt-5 grid grid-cols-2 gap-x-5 gap-y-4 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-slate-500">VP9 WebCodecs encoder</dt>
          <dd className="mt-1 font-medium text-white">{capability.vp9Encoder === null ? "Checking" : capability.vp9Encoder ? "Available" : "Unavailable"}</dd>
        </div>
        <div>
          <dt className="text-slate-500">VP9 alpha=keep</dt>
          <dd className="mt-1 font-medium text-white">{capability.vp9Alpha === null ? "Checking" : capability.vp9Alpha ? "Available, unverified" : "Unavailable"}</dd>
        </div>
        <div>
          <dt className="text-slate-500">VP9 WebCodecs decoder</dt>
          <dd className="mt-1 font-medium text-white">{capability.vp9Decoder === null ? "Checking" : capability.vp9Decoder ? "Available" : "Unavailable"}</dd>
        </div>
        <div>
          <dt className="text-slate-500">MediaRecorder VP9 MIME</dt>
          <dd className="mt-1 font-medium text-white">{capability.mediaRecorderWebm === null ? "Checking" : capability.mediaRecorderWebm ? "Listed, alpha unverified" : "Unavailable"}</dd>
        </div>
      </dl>
      <p className="mt-4 text-xs leading-5 text-slate-500">
        No alpha-verified WebM muxer and decode round-trip are implemented. MIME support or an encoder flag alone cannot prove transparent pixels survive. Audio is not included in the frame PNGs or ZIP. Use the existing transparent PNG and ZIP exports; no video download is offered.
      </p>
    </section>
  );
}