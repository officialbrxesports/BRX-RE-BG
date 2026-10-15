import React from 'react';
import { X, Shield, AlertTriangle, Cpu, HardDrive, Clock, FileVideo, Layers } from 'lucide-react';
import type { SystemCapabilities } from '../types';

interface LimitationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  capabilities: SystemCapabilities;
}

export const LimitationsModal: React.FC<LimitationsModalProps> = ({
  isOpen,
  onClose,
  capabilities,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div role="dialog" aria-modal="true" aria-labelledby="limitations-title" className="bg-zinc-950 border border-zinc-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <h3 id="limitations-title" className="font-bold text-base text-zinc-100">Technical Boundaries & Honest Limitations</h3>
              <p className="text-xs text-zinc-400">BRX Client-Side Architecture Guarantees</p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close limitations dialog"
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4 text-xs leading-relaxed text-zinc-300">
          {/* 1. Strict 60s limit */}
          <div className="p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-1.5">
            <div className="flex items-center space-x-2 text-zinc-100 font-semibold">
              <Clock className="w-4 h-4 text-amber-400" />
              <span>Strict 60-Second Video Limit</span>
            </div>
            <p className="text-zinc-400">
              BRX accepts videos up to 60.0 seconds and rejects longer clips as soon as duration metadata is read. This is an application input limit; it does not guarantee that every accepted video will process successfully on every device.
            </p>
          </div>

          {/* 2. 200 MiB Archive Budget */}
          <div className="p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-1.5">
            <div className="flex items-center space-x-2 text-zinc-100 font-semibold">
              <HardDrive className="w-4 h-4 text-blue-400" />
              <span>200 MiB Retained PNG Memory Budget</span>
            </div>
            <p className="text-zinc-400">
              BRX retains the encoded PNG Blobs for export and will not retain a frame that would take their combined size above 200 MiB. Processing stops before a frame would cross that boundary; the final retained total can be lower depending on frame sizes. This limit covers retained encoded PNG data, not video decoding, model memory, or temporary ZIP-generation memory.
            </p>
          </div>

          {/* 3. Honest Transparent Video Limitation */}
          <div className="p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-1.5">
            <div className="flex items-center space-x-2 text-zinc-100 font-semibold">
              <FileVideo className="w-4 h-4 text-emerald-400" />
              <span>Transparent Video vs. PNG Frame Sequence</span>
            </div>
            <p className="text-zinc-400">
              BRX does not export transparent MP4 or WebM video. It exports processed PNG frames in a ZIP archive with manifest metadata. Import the PNG sequence into an editor that supports image sequences and alpha.
            </p>
          </div>

          {/* 4. 4K Prohibition & No Fake Upscaling */}
          <div className="p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-1.5">
            <div className="flex items-center space-x-2 text-zinc-100 font-semibold">
              <Cpu className="w-4 h-4 text-purple-400" />
              <span>Disabled 4K & No Artificial Upscaling</span>
            </div>
            <p className="text-zinc-400">
              The active segmentation path supports 480p and capability-gated 720p output only. Native-resolution 4K segmentation is not implemented, so 4K is not an available setting; larger source frames are scaled to the selected processing dimensions.
            </p>
          </div>

          {/* 5. Person Segmentation Testing Disclaimer */}
          <div className="p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-1.5">
            <div className="flex items-center space-x-2 text-zinc-100 font-semibold">
              <Layers className="w-4 h-4 text-orange-400" />
              <span>Person-Segmentation Quality Notice</span>
            </div>
            <p className="text-zinc-400">
              The underlying segmentation uses Google&apos;s lightweight Selfie Segmenter tflite model designed for single or multiple people in foreground scenes. Edge accuracy around fine hair, motion blur, transparent clothing, or non-human subjects requires future benchmark verification and testing.
            </p>
          </div>

          {/* 6. Hardware Capability Diagnostics */}
          <div className="p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-1.5">
            <div className="flex items-center space-x-2 text-zinc-100 font-semibold">
              <Shield className="w-4 h-4 text-zinc-200" />
              <span>Your Detected Browser Capabilities</span>
            </div>
            <div className="font-mono text-[11px] text-zinc-400 space-y-1 pt-1">
              <div>CPU Logical Cores: {capabilities.hardwareConcurrency}</div>
              <div>
                Reported Device Memory:{' '}
                {capabilities.deviceMemoryGB !== null ? `${capabilities.deviceMemoryGB} GB` : 'Not exposed by browser API'}
              </div>
              <div>WebGL Hardware Acceleration: {capabilities.webGlSupported ? 'Supported' : 'Unavailable'}</div>
              <div>OffscreenCanvas: {capabilities.offscreenCanvasSupported ? 'Supported' : 'Unsupported'}</div>
              <div>
                720p HD Status:{' '}
                <span className={capabilities.canHandle720p ? 'text-emerald-400' : 'text-amber-400'}>
                  {capabilities.canHandle720p ? 'Eligible' : 'Gated / Not Recommended'}
                </span>
              </div>
              {capabilities.reasons720p.length > 0 && (
                <ul className="list-disc pl-4 text-zinc-500 text-[10px]">
                  {capabilities.reasons720p.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            type="button"
            aria-label="Close limitations dialog"
            onClick={onClose}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 rounded-lg text-xs font-medium transition"
          >
            Understood
          </button>
        </div>
      </div>
    </div>
  );
};



