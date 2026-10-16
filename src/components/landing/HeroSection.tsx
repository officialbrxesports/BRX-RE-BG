import {
  ArrowRight,
  Play,
  ShieldCheck,
  Sparkles,
  Upload,
} from 'lucide-react';

export default function HeroSection() {
  return (
    <section className="brx-hero" id="home">
      <div className="brx-hero-glow brx-hero-glow-red" />
      <div className="brx-hero-glow brx-hero-glow-gold" />

      <div className="brx-container brx-hero-grid">
        <div className="brx-hero-content">
          <div className="brx-eyebrow">
            <Sparkles size={15} />
            <span>THE NEXT GENERATION OF VIDEO EDITING</span>
          </div>

          <h1>
            Your Video.
            <br />
            <span className="brx-text-gradient">Your Vision.</span>
            <br />
            No Background.
          </h1>

          <p className="brx-hero-description">
            Remove distracting video backgrounds with AI.
            Create clean, professional visuals without complicated
            editing software.
          </p>

          <div className="brx-hero-actions">
            <a className="brx-button brx-button-primary" href="/editor">
              Start Editing
              <ArrowRight size={18} />
            </a>

            <a className="brx-button brx-button-secondary" href="#how-it-works">
              <Play size={16} />
              See How It Works
            </a>
          </div>

          <div className="brx-hero-trust">
            <div className="brx-trust-icon">
              <ShieldCheck size={18} />
            </div>

            <div>
              <strong>Built for creators</strong>
              <span>Simple workflow. More creative freedom.</span>
            </div>
          </div>
        </div>

        <div className="brx-hero-visual">
          <div className="brx-preview-card">
            <div className="brx-preview-topbar">
              <div className="brx-window-dots">
                <span />
                <span />
                <span />
              </div>

              <span className="brx-preview-label">AI VIDEO PREVIEW</span>

              <span className="brx-live-indicator">
                <span />
                PREVIEW
              </span>
            </div>

            <div className="brx-preview-stage">
              <div className="brx-preview-grid" />

              <div className="brx-preview-center">
                <div className="brx-preview-symbol">
                  <Sparkles size={35} strokeWidth={1.5} />
                </div>

                <h3>Your creativity,</h3>
                <h3 className="brx-gold-text">without limits.</h3>

                <p>
                  Your next video starts here.
                </p>
              </div>

              <div className="brx-preview-corner brx-corner-tl" />
              <div className="brx-preview-corner brx-corner-tr" />
              <div className="brx-preview-corner brx-corner-bl" />
              <div className="brx-preview-corner brx-corner-br" />

              <div className="brx-preview-chip">
                <Sparkles size={13} />
                AI-POWERED WORKFLOW
              </div>
            </div>

            <div className="brx-preview-bottom">
              <div>
                <span className="brx-preview-small-label">YOUR WORKSPACE</span>
                <strong>Ready for your next creation</strong>
              </div>

              <div className="brx-preview-upload-icon">
                <Upload size={19} />
              </div>
            </div>
          </div>

          <div className="brx-floating-badge brx-floating-badge-top">
            <span className="brx-floating-badge-icon">
              <Sparkles size={16} />
            </span>

            <div>
              <strong>AI-powered</strong>
              <span>Smarter editing</span>
            </div>
          </div>

          <div className="brx-floating-badge brx-floating-badge-bottom">
            <ShieldCheck size={19} />
            <span>Privacy-conscious design</span>
          </div>
        </div>
      </div>

      <div className="brx-hero-bottom">
        <span>CREATED FOR THE NEXT GENERATION</span>
        <div />
        <span>BRX RE BG</span>
      </div>
    </section>
  );
}