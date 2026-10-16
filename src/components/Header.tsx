import React from 'react';
import { ShieldCheck, Cpu, Info, Crown } from 'lucide-react';
import type { SystemCapabilities } from '../types';

interface HeaderProps {
  capabilities: SystemCapabilities;
  onOpenLimitations: () => void;
  onOpenPlans: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  capabilities,
  onOpenLimitations,
  onOpenPlans,
}) => {
  return (
    <header className="brx-header">
      <div className="brx-header-inner">
        {/* Minimal background remover header */}
        <div className="brx-editor-label">
          <ShieldCheck size={20} />
          <span>REMOVE BACKGROUND</span>
        </div>

        <div className="brx-header-actions">
          <div
            className="brx-device-status"
            title={`Cores: ${capabilities.hardwareConcurrency}; WebGL: ${
              capabilities.webGlSupported ? 'Active' : 'Disabled'
            }`}
          >
            <span
              className={`brx-status-dot ${
                capabilities.webGlSupported ? '' : 'brx-status-warning'
              }`}
            />
            <span>
              {capabilities.canHandle720p
                ? '720P READY'
                : '480P RECOMMENDED'}
            </span>
          </div>

          <button
            type="button"
            onClick={onOpenPlans}
            className="brx-header-plan"
          >
            <Crown size={15} />
            <span>Plans</span>
          </button>

          <button
            type="button"
            onClick={onOpenLimitations}
            className="brx-header-icon-button"
            aria-label="View browser limitations and specifications"
            title="Limits & Specifications"
          >
            <Info size={17} />
          </button>
        </div>
      </div>

      <div className="brx-header-bottom-line" />
    </header>
  );
};