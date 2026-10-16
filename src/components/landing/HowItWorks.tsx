import {
  ArrowRight,
  CheckCircle2,
  MousePointer2,
  Upload,
  WandSparkles,
} from 'lucide-react';

const steps = [
  {
    number: '01',
    icon: Upload,
    title: 'Upload your video',
    description:
      'Choose a supported video file from your device.',
  },
  {
    number: '02',
    icon: WandSparkles,
    title: 'Remove the background',
    description:
      'Use the editor to process your video with the available AI tools.',
  },
  {
    number: '03',
    icon: CheckCircle2,
    title: 'Preview and export',
    description:
      'Review the result and export using the formats your browser supports.',
  },
];

export default function HowItWorks() {
  return (
    <section className="brx-section brx-how-section" id="how-it-works">
      <div className="brx-container">
        <div className="brx-section-heading brx-section-heading-center">
          <div className="brx-eyebrow">
            <MousePointer2 size={15} />
            <span>YOUR WORKFLOW</span>
          </div>

          <h2>
            From raw footage
            <br />
            to <span className="brx-text-gradient">ready to create.</span>
          </h2>

          <p>Three straightforward steps to get started.</p>
        </div>

        <div className="brx-steps-grid">
          {steps.map((step, index) => {
            const Icon = step.icon;

            return (
              <article className="brx-step-card" key={step.number}>
                <div className="brx-step-top">
                  <span>{step.number}</span>

                  <div className="brx-step-icon">
                    <Icon size={25} strokeWidth={1.7} />
                  </div>
                </div>

                <h3>{step.title}</h3>

                <p>{step.description}</p>

                {index < steps.length - 1 && (
                  <ArrowRight
                    className="brx-step-arrow"
                    size={20}
                    aria-hidden="true"
                  />
                )}
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}