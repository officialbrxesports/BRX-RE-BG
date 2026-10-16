import { ArrowUp, Sparkles } from 'lucide-react';

export default function LandingFooter() {
  return (
    <footer className="brx-footer">
      <div className="brx-container">
        <div className="brx-footer-main">
          <a
            href="#home"
            className="brx-footer-brand"
            aria-label="BRX RE BG homepage"
          >
            <span className="brx-footer-logo">
              <Sparkles size={23} />
            </span>

            <span>
              <strong>
                BRX <span>RE BG</span>
              </strong>
              <small>VIDEO BACKGROUND STUDIO</small>
            </span>
          </a>

          <p>
            Make room for your creativity.
            <br />
            Create with BRX RE BG.
          </p>

          <a className="brx-footer-top" href="#home" aria-label="Back to top">
            <ArrowUp size={19} />
          </a>
        </div>

        <div className="brx-footer-bottom">
          <span>
            © {new Date().getFullYear()} BRX RE BG. All rights reserved.
          </span>

          <div>
            <a href="#features">Features</a>
            <a href="#pricing">Pricing</a>
            <a href="#faq">FAQ</a>
          </div>
        </div>
      </div>
    </footer>
  );
}