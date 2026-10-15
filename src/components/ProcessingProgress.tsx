import React from 'react';
import type { ProcessingProgressState } from '../types';
import { formatBytes } from '../utils/browserCapabilities';
import { StopCircle, RefreshCw, HardDrive, Clock, Zap, AlertTriangle } from 'lucide-react';

interface ProcessingProgressProps {
  progress: ProcessingProgressState;
  onCancel: () => void;
  onReset: () => void;
  isCompleted: boolean;
  isBudgetExceeded: boolean;
  isCancelled: boolean;
  isError: boolean;
}

export const ProcessingProgress: React.FC<ProcessingProgressProps> = ({
  progress,
  onCancel,
  onReset,
  isCompleted,
  isBudgetExceeded,
  isCancelled,
  isError,
}) => {
  const budgetRatio = Math.min(1, progress.retainedBytes / progress.maxBudgetBytes);
  const budgetPercent = Math.round(budgetRatio * 100);

  const budgetIsWarning = progress.retainedBytes > progress.maxBudgetBytes * 0.75;
  const budgetIsCritical = progress.retainedBytes >= progress.maxBudgetBytes;

  return (
    <div className="bg-zinc-900/70 border border-zinc-800 rounded-xl p-5 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold text-zinc-100 flex items-center space-x-2">
            {!isCompleted && !isCancelled && !isBudgetExceeded && !isError && (
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
            )}
            <span>
              {isCompleted
                ? 'Processing Finished'
                : isBudgetExceeded
                ? 'Budget Limit Reached'
                : isCancelled
                ? 'Processing Cancelled'
                : isError
                ? 'Processing Error'
                : 'Extracting Transparent Frames...'}
            </span>
          </h4>
          <p className="text-xs text-zinc-400 mt-0.5" role={isError ? "alert" : "status"} aria-live={isError ? "assertive" : "polite"}>{progress.currentStatusText}</p>
        </div>

        <div className="flex items-center space-x-2">
          {!isCompleted && !isCancelled && !isBudgetExceeded && !isError && (
            <button
              onClick={onCancel}
              className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-red-300 bg-red-950/40 hover:bg-red-950/70 border border-red-800/60 rounded-lg transition"
            >
              <StopCircle className="w-4 h-4 text-red-400" />
              <span>Cancel</span>
            </button>
          )}

          {(isCompleted || isCancelled || isBudgetExceeded || isError) && (
            <button
              onClick={onReset}
              className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-zinc-300 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 rounded-lg transition"
            >
              <RefreshCw className="w-3.5 h-3.5 text-zinc-400" />
              <span>Reset All</span>
            </button>
          )}
        </div>
      </div>

      {/* Main frame progress bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="text-zinc-400">
            Frame {progress.currentFrame} / {progress.totalEstimatedFrames}
          </span>
          <span className="text-emerald-400 font-semibold">{progress.percent}%</span>
        </div>
        <div className="w-full bg-zinc-800 rounded-full h-2.5 overflow-hidden" role="progressbar" aria-label="Video frame processing progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.percent}>
          <div
            className="bg-emerald-500 h-full rounded-full transition-all duration-200 ease-out"
            style={{ width: `${progress.percent}%` }}
          />
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
        <div className="bg-zinc-950/60 p-2.5 rounded-lg border border-zinc-800/80">
          <span className="text-zinc-500 block text-[11px] mb-0.5">Speed</span>
          <div className="flex items-center space-x-1 font-mono font-medium text-zinc-200">
            <Zap className="w-3 h-3 text-emerald-400" />
            <span>{progress.fps} FPS</span>
          </div>
        </div>

        <div className="bg-zinc-950/60 p-2.5 rounded-lg border border-zinc-800/80">
          <span className="text-zinc-500 block text-[11px] mb-0.5">Elapsed</span>
          <div className="flex items-center space-x-1 font-mono font-medium text-zinc-200">
            <Clock className="w-3 h-3 text-zinc-400" />
            <span>{progress.elapsedSeconds}s</span>
          </div>
        </div>

        <div className="bg-zinc-950/60 p-2.5 rounded-lg border border-zinc-800/80">
          <span className="text-zinc-500 block text-[11px] mb-0.5">Estimated Remaining</span>
          <span className="font-mono font-medium text-zinc-200">
            {progress.remainingSeconds !== null ? `${progress.remainingSeconds}s` : '--'}
          </span>
        </div>

        <div className="bg-zinc-950/60 p-2.5 rounded-lg border border-zinc-800/80">
          <span className="text-zinc-500 block text-[11px] mb-0.5">Retained PNGs</span>
          <span className="font-mono font-medium text-zinc-200">
            {progress.currentFrame} frames
          </span>
          <span className="block text-[11px] font-mono text-zinc-400">
            {formatBytes(progress.retainedBytes)} retained
          </span>
        </div>
      </div>

      {/* 200 MiB Archive Budget Bar */}
      <div className="space-y-1.5 pt-1 border-t border-zinc-800/60">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center space-x-1.5 text-zinc-300">
            <HardDrive
              className={`w-3.5 h-3.5 ${
                budgetIsCritical
                  ? 'text-red-400'
                  : budgetIsWarning
                  ? 'text-amber-400'
                  : 'text-blue-400'
              }`}
            />
            <span className="font-medium">Retained Memory Budget (200 MiB limit)</span>
          </div>
          <span className="font-mono text-[11px] text-zinc-400">
            {formatBytes(progress.retainedBytes)} / {formatBytes(progress.maxBudgetBytes)} ({budgetPercent}%)
          </span>
        </div>

        <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-200 ${
              budgetIsCritical
                ? 'bg-red-500'
                : budgetIsWarning
                ? 'bg-amber-500'
                : 'bg-blue-500'
            }`}
            style={{ width: `${budgetPercent}%` }}
          />
        </div>

        {budgetIsCritical && (
          <div className="flex items-center space-x-2 text-xs text-red-300 bg-red-950/40 border border-red-800/40 p-2 rounded-lg">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <span>
              200 MiB retained PNG budget reached. Frame extraction stopped to keep retained PNG data within the limit. Existing frames remain available below.
            </span>
          </div>
        )}
      </div>
    </div>
  );
};



