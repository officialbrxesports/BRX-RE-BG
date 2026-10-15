import React from 'react';
import { ShieldCheck, Cpu, Info, Film } from 'lucide-react';
import type { SystemCapabilities } from '../types';

interface HeaderProps {
  capabilities: SystemCapabilities;
  onOpenLimitations: () => void;
}

export const Header: React.FC<HeaderProps> = ({ capabilities, onOpenLimitations }) => {
  return (
    <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Film className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold tracking-tight text-zinc-100 text-lg">BRX Background Remover</span>
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                v1.0 Local
              </span>
            </div>
            <p className="text-xs text-zinc-400 hidden sm:block">
              Client-side person segmentation & transparent PNG frame exporter
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 sm:space-x-3">
          {/* Privacy badge */}
          <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-emerald-950/40 border border-emerald-800/40 text-emerald-400 text-xs">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span className="font-medium hidden md:inline">100% On-Device Processing</span>
            <span className="font-medium md:hidden">Local</span>
          </div>

          {/* System capability badge */}
          <div
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs border ${
              capabilities.canHandle720p
                ? 'bg-zinc-900 border-zinc-700 text-zinc-300'
                : 'bg-amber-950/30 border-amber-800/30 text-amber-300'
            }`}
            title={`Cores: ${capabilities.hardwareConcurrency}, RAM: ${
              capabilities.deviceMemoryGB ? capabilities.deviceMemoryGB + ' GB' : 'Unspecified'
            }, WebGL: ${capabilities.webGlSupported ? 'Active' : 'Disabled'}`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span className="font-mono text-[11px]">
              {capabilities.canHandle720p ? '720p Ready' : '480p Recommended'}
            </span>
          </div>

          {/* Limitations button */}
          <button
            aria-label="View browser limits and specifications"
            onClick={onOpenLimitations}
            className="flex items-center space-x-1 px-2.5 py-1 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 rounded-md border border-zinc-800 transition"
          >
            <Info className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Limits & Specs</span>
          </button>
        </div>
      </div>
    </header>
  );
};
