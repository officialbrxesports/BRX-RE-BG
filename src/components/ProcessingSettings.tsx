import React from 'react';
import type {
  ProcessingSettingsOptions,
  SystemCapabilities,
  VideoMetadata,
} from '../types';
import { calculateDimensions } from '../utils/frameProcessor';
import { AlertTriangle, Lock, Sliders } from 'lucide-react';

interface ProcessingSettingsProps {
  settings: ProcessingSettingsOptions;
  onChange: (updated: ProcessingSettingsOptions) => void;
  capabilities: SystemCapabilities;
  metadata: VideoMetadata;
  disabled: boolean;
}

export const ProcessingSettings: React.FC<ProcessingSettingsProps> = ({
  settings,
  onChange,
  capabilities,
  metadata,
  disabled,
}) => {
  const currentDims = calculateDimensions(
    settings.resolution,
    metadata.width,
    metadata.height,
  );

  const estimatedFrames = Math.max(
    1,
    Math.floor(metadata.duration * settings.fps),
  );

  const canHandle1080p = capabilities.canHandle1080p;

  return (
    <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 sm:p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center space-x-2 border-b border-zinc-800/80 pb-3">
        <Sliders className="w-4 h-4 text-emerald-400" />

        <h3 className="text-sm font-semibold text-zinc-100">
          Extraction & Resolution Settings
        </h3>
      </div>

      {/* Resolution selection */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3 text-xs">
          <label className="font-medium text-zinc-300">
            Processing Resolution
          </label>

          <span className="text-zinc-400 font-mono text-right">
            Output: {currentDims.width} &times; {currentDims.height} px
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {/* 480p */}
          <button
            type="button"
            disabled={disabled}
            aria-pressed={settings.resolution === '480p'}
            onClick={() => {
              onChange({
                ...settings,
                resolution: '480p',
              });
            }}
            className={`p-3 rounded-lg border text-left transition relative flex flex-col justify-between ${
              settings.resolution === '480p'
                ? 'border-emerald-500 bg-emerald-950/20 text-zinc-100 ring-1 ring-emerald-500/50'
                : 'border-zinc-800 bg-zinc-950/40 text-zinc-400 hover:border-zinc-700'
            }`}
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-sm text-zinc-100">
                  Up to 480p SD
                </span>

                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Recommended
                </span>
              </div>

              <p className="text-xs text-zinc-400 mt-1">
                Lower processing load and smaller output frames. Smaller
                source videos retain their native dimensions when possible.
              </p>
            </div>

            <div className="mt-2 text-[11px] font-mono text-zinc-500">
              Fast inference
            </div>
          </button>

          {/* 720p */}
          <button
            type="button"
            disabled={disabled || !capabilities.canHandle720p}
            aria-pressed={settings.resolution === '720p'}
            onClick={() => {
              if (capabilities.canHandle720p && !disabled) {
                onChange({
                  ...settings,
                  resolution: '720p',
                });
              }
            }}
            title={
              !capabilities.canHandle720p
                ? capabilities.reasons720p.join(' ')
                : 'Process frames at up to 720p'
            }
            className={`p-3 rounded-lg border text-left transition relative flex flex-col justify-between ${
              !capabilities.canHandle720p
                ? 'border-zinc-800/60 bg-zinc-950/20 text-zinc-600 opacity-60 cursor-not-allowed'
                : settings.resolution === '720p'
                  ? 'border-emerald-500 bg-emerald-950/20 text-zinc-100 ring-1 ring-emerald-500/50'
                  : 'border-zinc-800 bg-zinc-950/40 text-zinc-400 hover:border-zinc-700'
            }`}
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-sm text-zinc-100">
                  Up to 720p HD
                </span>

                <span
                  className={`text-[10px] uppercase font-mono px-1.5 py-0.5 rounded border ${
                    capabilities.canHandle720p
                      ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                      : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                  }`}
                >
                  {capabilities.canHandle720p
                    ? 'Capability OK'
                    : 'Unavailable'}
                </span>
              </div>

              <p className="text-xs text-zinc-400 mt-1">
                Higher resolution for devices that meet the recommended
                capability requirements. Smaller sources are not enlarged.
              </p>
            </div>

            {!capabilities.canHandle720p && (
              <div className="mt-2 text-[11px] text-amber-400/90 flex items-start gap-1">
                <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />

                <span>
                  {capabilities.reasons720p.length > 0
                    ? capabilities.reasons720p.join(' ')
                    : 'Your device does not meet the recommended 720p requirements.'}
                </span>
              </div>
            )}
          </button>

          {/* 1080p */}
          <button
            type="button"
            disabled={disabled || !canHandle1080p}
            aria-pressed={settings.resolution === '1080p'}
            onClick={() => {
              if (canHandle1080p && !disabled) {
                onChange({
                  ...settings,
                  resolution: '1080p',
                });
              }
            }}
            title={
              !canHandle1080p
                ? capabilities.reasons1080p.join(' ')
                : 'Process frames at up to 1080p'
            }
            className={`p-3 rounded-lg border text-left transition relative flex flex-col justify-between ${
              !canHandle1080p
                ? 'border-zinc-800/60 bg-zinc-950/20 text-zinc-600 opacity-60 cursor-not-allowed'
                : settings.resolution === '1080p'
                  ? 'border-emerald-500 bg-emerald-950/20 text-zinc-100 ring-1 ring-emerald-500/50'
                  : 'border-zinc-800 bg-zinc-950/40 text-zinc-400 hover:border-zinc-700'
            }`}
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-sm text-zinc-100">
                  Up to 1080p Full HD
                </span>

                <span
                  className={`text-[10px] uppercase font-mono px-1.5 py-0.5 rounded border ${
                    canHandle1080p
                      ? 'bg-violet-500/10 text-violet-400 border-violet-500/20'
                      : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                  }`}
                >
                  {canHandle1080p ? 'Capability OK' : 'Restricted'}
                </span>
              </div>

              <p className="text-xs text-zinc-400 mt-1">
                Full HD frame processing for devices that meet the
                recommended memory and CPU requirements.
              </p>
            </div>

            {!canHandle1080p && (
              <div className="mt-2 text-[11px] text-amber-400/90 flex items-start gap-1">
                <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />

                <span>
                  {capabilities.reasons1080p.length > 0
                    ? capabilities.reasons1080p.join(' ')
                    : 'Your device does not meet the recommended 1080p requirements.'}
                </span>
              </div>
            )}
          </button>

          {/* 4K - currently unavailable */}
          <div
            aria-disabled="true"
            className="p-3 rounded-lg border border-zinc-800/40 bg-zinc-950/30 text-zinc-500 opacity-70 relative flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-sm text-zinc-400 flex items-center space-x-1.5">
                  <Lock className="w-3.5 h-3.5 text-zinc-500" />
                  <span>4K UHD</span>
                </span>

                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500 border border-zinc-700">
                  Disabled
                </span>
              </div>

              <p className="text-[11px] text-zinc-500 mt-1 leading-snug">
                Not available in the current processing pipeline. 4K source
                videos are reduced to the selected supported output resolution.
              </p>
            </div>

            <div className="mt-2 text-[10px] font-mono text-zinc-600">
              Stability boundary
            </div>
          </div>
        </div>

        <p className="text-[11px] text-zinc-500">
          Resolution limits describe maximum output dimensions, not a guarantee
          of processing speed or quality. The app currently exports extracted
          PNG frames in a ZIP archive, not a transparent video file.
        </p>
      </div>

      {/* Frame rate and extraction settings */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
        {/* FPS */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <label className="font-medium text-zinc-300">
              Extraction Frame Rate
            </label>

            <span className="text-zinc-400 font-mono">
              ~{estimatedFrames} frames
            </span>
          </div>

          <div className="grid grid-cols-4 gap-1.5">
            {[10, 15, 24, 30].map((rate) => (
              <button
                key={rate}
                type="button"
                disabled={disabled}
                aria-pressed={settings.fps === rate}
                onClick={() => {
                  onChange({
                    ...settings,
                    fps: rate,
                  });
                }}
                className={`py-2 px-1 text-center rounded text-xs font-mono font-medium transition ${
                  settings.fps === rate
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50'
                    : 'bg-zinc-950/60 text-zinc-400 border border-zinc-800 hover:border-zinc-700'
                }`}
              >
                {rate} FPS
              </button>
            ))}
          </div>

          <p className="text-[11px] text-zinc-500">
            Higher FPS creates more frames and increases archive size against
            the 200 MiB memory limit.
          </p>
        </div>

        {/* Edge smoothing and threshold */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-zinc-300">
              Edge Smoothing (Feathering)
            </label>

            <button
              type="button"
              role="switch"
              aria-label="Edge smoothing"
              aria-checked={settings.edgeSmoothing}
              disabled={disabled}
              onClick={() => {
                onChange({
                  ...settings,
                  edgeSmoothing: !settings.edgeSmoothing,
                });
              }}
              className={`w-11 h-6 rounded-full transition-colors relative focus:outline-none ${
                settings.edgeSmoothing ? 'bg-emerald-600' : 'bg-zinc-800'
              }`}
            >
              <span
                className={`w-4 h-4 rounded-full bg-white transition-transform block absolute top-1 ${
                  settings.edgeSmoothing ? 'left-6' : 'left-1'
                }`}
              />
            </button>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <label htmlFor="mask-threshold" className="text-zinc-400">
                Mask Cutoff Threshold
              </label>

              <span className="font-mono text-zinc-300">
                {settings.threshold.toFixed(2)}
              </span>
            </div>

            <input
              id="mask-threshold"
              type="range"
              min="0.2"
              max="0.8"
              step="0.05"
              value={settings.threshold}
              disabled={disabled}
              onChange={(event) => {
                onChange({
                  ...settings,
                  threshold: Number.parseFloat(event.target.value),
                });
              }}
              className="w-full accent-emerald-500 bg-zinc-800 h-1.5 rounded-lg appearance-none cursor-pointer"
            />

            <div className="flex justify-between text-[10px] text-zinc-500">
              <span>More Subject (0.2)</span>
              <span>Stricter Cut (0.8)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};