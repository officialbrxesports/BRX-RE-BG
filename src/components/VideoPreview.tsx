import React, { useEffect, useState } from 'react';
import type { VideoMetadata } from '../types';
import { formatDuration, LARGE_VIDEO_WARNING_BYTES } from '../utils/browserCapabilities';
import { FileVideo, Clock, Maximize2, Trash2, CheckCircle2 } from 'lucide-react';

interface VideoPreviewProps {
  metadata: VideoMetadata;
  onClear: () => void;
  isProcessing: boolean;
}

export const VideoPreview: React.FC<VideoPreviewProps> = ({ metadata, onClear, isProcessing }) => {
  const [previewError, setPreviewError] = useState<string | null>(null);
  useEffect(() => setPreviewError(null), [metadata.objectUrl]);
  return (
    <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl overflow-hidden p-4 sm:p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2 min-w-0">
          <FileVideo className="w-5 h-5 text-emerald-400 shrink-0" />
          <h4 className="text-sm font-semibold text-zinc-100 truncate" title={metadata.name}>
            {metadata.name}
          </h4>
        </div>
        {!isProcessing && (
          <button
            onClick={onClear}
            className="flex items-center space-x-1 px-2.5 py-1 text-xs text-zinc-400 hover:text-red-400 hover:bg-red-950/30 rounded border border-zinc-800 hover:border-red-800/40 transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Remove</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
        {/* Video element */}
        <div className="relative aspect-video bg-black/60 rounded-lg overflow-hidden border border-zinc-800 flex items-center justify-center">
          <video
            src={metadata.objectUrl}
            controls
            aria-label={`Preview selected video ${metadata.name}`}
            onError={() => setPreviewError('The browser could not continue decoding this video preview. Try another browser-compatible codec.')}
            playsInline
            muted
            className="max-h-full max-w-full object-contain"
          />
          {previewError && (
            <p className="mt-2 rounded-lg border border-red-800/60 bg-red-950/40 p-2 text-xs text-red-200" role="alert">
              {previewError}
            </p>
          )}
        </div>

        {/* Metadata stats */}
        <div className="space-y-3">
          {metadata.size >= LARGE_VIDEO_WARNING_BYTES && (
            <p className="rounded-lg border border-amber-800/50 bg-amber-950/30 p-3 text-xs leading-relaxed text-amber-200" role="note">
              This is a large local video. Decoding and segmentation require additional working memory beyond the retained PNG budget.
            </p>
          )}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-zinc-950/60 p-2.5 rounded-lg border border-zinc-800/80">
              <span className="text-zinc-500 block mb-0.5">Duration</span>
              <div className="flex items-center space-x-1 font-mono font-semibold text-zinc-200">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>{formatDuration(metadata.duration)}</span>
              </div>
            </div>

            <div className="bg-zinc-950/60 p-2.5 rounded-lg border border-zinc-800/80">
              <span className="text-zinc-500 block mb-0.5">Native Dimensions</span>
              <div className="flex items-center space-x-1 font-mono font-semibold text-zinc-200">
                <Maximize2 className="w-3.5 h-3.5 text-blue-400" />
                <span>
                  {metadata.width} &times; {metadata.height}
                </span>
              </div>
            </div>

            <div className="bg-zinc-950/60 p-2.5 rounded-lg border border-zinc-800/80">
              <span className="text-zinc-500 block mb-0.5">File Size</span>
              <span className="font-mono font-semibold text-zinc-200">{metadata.formattedSize}</span>
            </div>

            <div className="bg-zinc-950/60 p-2.5 rounded-lg border border-zinc-800/80">
              <span className="text-zinc-500 block mb-0.5">Aspect Ratio</span>
              <span className="font-mono font-semibold text-zinc-200">
                {metadata.aspectRatio.toFixed(2)} : 1
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2 p-2.5 rounded-lg bg-emerald-950/20 border border-emerald-800/30 text-emerald-300 text-xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Passed strict 60s safety check ({metadata.duration.toFixed(1)}s &le; 60.0s)</span>
          </div>
        </div>
      </div>
    </div>
  );
};


