import { useState } from 'react';
import {
  ArrowRight,
  Menu,
  Sparkles,
  X,
} from 'lucide-react';

import HeroSection from '../components/landing/HeroSection';
import FeaturesSection from '../components/landing/FeaturesSection';
import HowItWorks from '../components/landing/HowItWorks';
import PricingSection from '../components/landing/PricingSection';
import FAQSection from '../components/landing/FAQSection';
import LandingFooter from '../components/landing/LandingFooter';

import '../styles/landing.css';

const navigation = [
  { label: 'Features', href: '#features' },
  { label: 'How It Works', href: '#how-it-works' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'FAQ', href: '#faq' },
];

export default function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="brx-landing">
      <a className="brx-skip-link" href="#main-content">
        Skip to content
      </a>

      <header className="brx-site-header">
        <div className="brx-container brx-header-inner">
          <a href="#home" className="brx-brand" aria-label="BRX RE BG home">
            <span className="brx-brand-mark">
              <Sparkles size={23} />
            </span>

            <span className="brx-brand-copy">
              <strong>
                BRX <span>RE BG</span>
              </strong>
              <small>VIDEO BACKGROUND STUDIO</small>
            </span>
          </a>

          <nav className="brx-desktop-nav" aria-label="Main navigation">
            {navigation.map((item) => (
              <a href={item.href} key={item.label}>
                {item.label}
              </a>
            ))}
          </nav>

          <div className="brx-header-right">
            <a className="brx-header-cta" href="/editor">
              Start Editing
              <ArrowRight size={16} />
            </a>

            <button
              className="brx-mobile-menu-button"
              type="button"
              aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
            >
              {menuOpen ? <X size={23} /> : <Menu size={23} />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <nav className="brx-mobile-nav" aria-label="Mobile navigation">
            {navigation.map((item) => (
              <a
                href={item.href}
                key={item.label}
                onClick={() => setMenuOpen(false)}
              >
                {item.label}
              </a>
            ))}

            <a href="/editor" onClick={() => setMenuOpen(false)}>
              Start Editing <ArrowRight size={16} />
            </a>
          </nav>
        )}
      </header>

      <main id="main-content">
        <HeroSection />
        <FeaturesSection />
        <HowItWorks />
        <PricingSection />
        <FAQSection />
      </main>

      <LandingFooter />
    </div>
  );
}