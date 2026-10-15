import React from 'react';
import { ShieldCheck, Lock } from 'lucide-react';

export const PrivacyNotice: React.FC = () => {
  return (
    <div className="bg-emerald-950/20 border border-emerald-800/30 rounded-xl p-3.5 sm:p-4 text-xs text-emerald-300/90 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
      <div className="flex items-start space-x-2.5">
        <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <p className="font-semibold text-emerald-200">
            Privacy Guarantee: 100% Client-Side Video Processing
          </p>
          <p className="text-zinc-400 text-[11px] leading-relaxed">
            Your video and output frames stay in this browser. Processing runs locally; the MediaPipe WebAssembly runtime and model are downloaded from public CDNs when the model is loaded.
          </p>
        </div>
      </div>
      <div className="flex items-center space-x-2 shrink-0 font-mono text-[10px] text-zinc-500 bg-zinc-950/60 px-2.5 py-1 rounded border border-zinc-800">
        <Lock className="w-3 h-3 text-emerald-400" />
        <span>No Video Upload</span>
      </div>
    </div>
  );
};

