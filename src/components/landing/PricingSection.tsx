import {
  ArrowRight,
  Check,
  Crown,
  Sparkles,
} from 'lucide-react';

const plans = [
  {
    name: 'Free',
    description: 'Explore the essential editing workflow.',
    price: '$0',
    period: 'forever',
    features: [
      'Access to available editor tools',
      'Supported video formats',
      'Basic export options',
    ],
    featured: false,
  },
  {
    name: 'Pro',
    description: 'For creators who need more flexibility.',
    price: 'Coming soon',
    period: '',
    features: [
      'Planned advanced editing tools',
      'Expanded export options',
      'Future premium features',
    ],
    featured: true,
  },
];

export default function PricingSection() {
  return (
    <section className="brx-section brx-pricing-section" id="pricing">
      <div className="brx-container">
        <div className="brx-section-heading brx-section-heading-center">
          <div className="brx-eyebrow">
            <Crown size={15} />
            <span>SIMPLE PLANS</span>
          </div>

          <h2>
            Start creating.
            <br />
            <span className="brx-text-gradient">Upgrade when ready.</span>
          </h2>

          <p>
            Clear options without unnecessary complications.
          </p>
        </div>

        <div className="brx-pricing-grid">
          {plans.map((plan) => (
            <article
              className={`brx-pricing-card ${
                plan.featured ? 'brx-pricing-featured' : ''
              }`}
              key={plan.name}
            >
              {plan.featured && (
                <div className="brx-plan-ribbon">
                  <Sparkles size={13} />
                  FUTURE PLAN
                </div>
              )}

              <div className="brx-plan-heading">
                <h3>{plan.name}</h3>
                <p>{plan.description}</p>
              </div>

              <div className="brx-plan-price">
                <strong>{plan.price}</strong>
                {plan.period && <span>{plan.period}</span>}
              </div>

              <div className="brx-plan-divider" />

              <ul className="brx-plan-features">
                {plan.features.map((feature) => (
                  <li key={feature}>
                    <Check size={17} />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              {plan.featured ? (
                <button
                  className="brx-button brx-button-secondary brx-plan-button"
                  type="button"
                  disabled
                >
                  Coming Soon
                </button>
              ) : (
                <a
                  className="brx-button brx-button-primary brx-plan-button"
                  href="/editor"
                >
                  Get Started
                  <ArrowRight size={17} />
                </a>
              )}
            </article>
          ))}
        </div>

        <p className="brx-pricing-note">
          Pro access and payments are not active yet. Pricing and plan
          entitlements will be finalized before launch.
        </p>
      </div>
    </section>
  );
}