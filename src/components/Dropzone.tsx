import React, { useRef, useState } from 'react';
import { UploadCloud, AlertCircle, FileVideo, Shield, Clock, HardDrive } from 'lucide-react';
import { MAX_VIDEO_DURATION_SECONDS } from '../utils/browserCapabilities';

interface DropzoneProps {
  onFileSelected: (file: File) => void;
  isLoading: boolean;
  validationError: string | null;
}

export const Dropzone: React.FC<DropzoneProps> = ({
  onFileSelected,
  isLoading,
  validationError,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (isLoading) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      onFileSelected(file);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) onFileSelected(file);
  };

  return (
    <div className="w-full space-y-4">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        role="button"
        tabIndex={isLoading ? -1 : 0}
        aria-disabled={isLoading}
        aria-busy={isLoading}
        aria-label="Choose a video file or drop it here"
        onKeyDown={(event) => {
          if (!isLoading && (event.key === "Enter" || event.key === " ")) {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onClick={() => {
          if (!isLoading) inputRef.current?.click();
        }}
        className={`relative border-2 border-dashed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 rounded-xl p-8 sm:p-12 text-center cursor-pointer transition-all ${
          isDragOver
            ? 'border-emerald-500 bg-emerald-950/20 shadow-lg shadow-emerald-950/40'
            : 'border-zinc-700/80 bg-zinc-900/40 hover:border-zinc-500 hover:bg-zinc-900/70'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".mp4,.webm,.mov,.m4v,video/mp4,video/webm,video/quicktime,video/x-m4v"
          onChange={handleInputChange}
          onClick={(event) => event.stopPropagation()}
          className="hidden"
          disabled={isLoading}
        />

        <div className="flex flex-col items-center justify-center space-y-4">
          <div
            className={`w-16 h-16 rounded-2xl flex items-center justify-center transition ${
              isDragOver
                ? 'bg-emerald-500/20 text-emerald-400 scale-110'
                : 'bg-zinc-800 text-zinc-300'
            }`}
          >
            {isLoading ? (
              <div className="w-7 h-7 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <UploadCloud className="w-8 h-8" />
            )}
          </div>

          <div className="space-y-1">
            <h3 className="text-base sm:text-lg font-semibold text-zinc-100">
              {isLoading ? 'Verifying video metadata...' : 'Drop video here or click to browse'}
            </h3>
            <p className="text-xs sm:text-sm text-zinc-400 max-w-md mx-auto">
              Select an MP4, WebM, MOV, or M4V video up to 3840 x 2160 featuring people to isolate them onto a transparent background.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 pt-2 text-xs">
            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded bg-zinc-800/80 text-zinc-300 border border-zinc-700/60 font-mono">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>Max duration: {MAX_VIDEO_DURATION_SECONDS}s strict</span>
            </span>
            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded bg-zinc-800/80 text-zinc-300 border border-zinc-700/60 font-mono">
              <FileVideo className="w-3.5 h-3.5 text-blue-400" />
              <span>Max video: 250 MiB</span>
            </span>
            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded bg-zinc-800/80 text-zinc-300 border border-zinc-700/60 font-mono">
              <HardDrive className="w-3.5 h-3.5 text-blue-400" />
              <span>Max archive: 200 MiB</span>
            </span>
            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded bg-zinc-800/80 text-zinc-300 border border-zinc-700/60 font-mono">
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              <span>Zero server upload</span>
            </span>
          </div>
        </div>
      </div>

      {validationError && (
        <div className="flex items-start space-x-3 p-4 rounded-lg bg-red-950/40 border border-red-800/50 text-red-200 text-sm" role="alert" aria-live="assertive">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-red-300">Video Validation Failed</p>
            <p className="text-xs sm:text-sm text-red-200/90 leading-relaxed">{validationError}</p>
          </div>
        </div>
      )}
    </div>
  );
};



