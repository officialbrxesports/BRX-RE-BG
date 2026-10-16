import {
  Cpu,
  Film,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

const features = [
  {
    icon: Sparkles,
    number: '01',
    title: 'AI Background Removal',
    description:
      'Designed to separate your subject from distracting video backgrounds.',
    tag: 'CORE FEATURE',
  },
  {
    icon: Film,
    number: '02',
    title: 'Creator-Focused Workflow',
    description:
      'A straightforward workspace for importing, previewing and preparing videos.',
    tag: 'EASY WORKFLOW',
  },
  {
    icon: Cpu,
    number: '03',
    title: 'Flexible Export Options',
    description:
      'A foundation for configurable resolution, frame rate and supported formats.',
    tag: 'EXPORT TOOLS',
  },
  {
    icon: ShieldCheck,
    number: '04',
    title: 'Privacy-Conscious',
    description:
      'Built with local processing and clear handling of your media in mind.',
    tag: 'PRIVACY',
  },
];

export default function FeaturesSection() {
  return (
    <section className="brx-section brx-features-section" id="features">
      <div className="brx-container">
        <div className="brx-section-heading">
          <div className="brx-eyebrow">
            <Sparkles size={15} />
            <span>MADE FOR CREATORS</span>
          </div>

          <h2>
            Everything you need.
            <br />
            <span className="brx-text-gradient">Nothing you don't.</span>
          </h2>

          <p>
            A focused editing experience that puts your creative work first.
          </p>
        </div>

        <div className="brx-features-grid">
          {features.map((feature) => {
            const Icon = feature.icon;

            return (
              <article className="brx-feature-card" key={feature.number}>
                <div className="brx-feature-card-top">
                  <div className="brx-feature-icon">
                    <Icon size={23} strokeWidth={1.7} />
                  </div>

                  <span className="brx-feature-number">
                    {feature.number}
                  </span>
                </div>

                <span className="brx-feature-tag">{feature.tag}</span>

                <h3>{feature.title}</h3>

                <p>{feature.description}</p>

                <div className="brx-feature-card-line" />
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}