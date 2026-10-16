import { ChevronDown, CircleHelp } from 'lucide-react';

const faqs = [
  {
    question: 'What is BRX RE BG?',
    answer:
      'BRX RE BG is a browser-based video editing project focused on AI video background removal.',
  },
  {
    question: 'Do I need to install an application?',
    answer:
      'The goal is to provide a website that works in supported modern browsers, without requiring a separate desktop application.',
  },
  {
    question: 'Will every video format work?',
    answer:
      'Format support depends on your browser, processing pipeline and export capabilities. Supported formats will be identified in the editor.',
  },
  {
    question: 'Can I export transparent video?',
    answer:
      'Transparent export depends on the selected format and encoder support. The editor must verify transparency before reporting a successful export.',
  },
  {
    question: 'Are Pro subscriptions available?',
    answer:
      'Not yet. The Pro plan is a future feature and payment processing has not been activated.',
  },
];

export default function FAQSection() {
  return (
    <section className="brx-section brx-faq-section" id="faq">
      <div className="brx-container brx-faq-layout">
        <div className="brx-faq-intro">
          <div className="brx-eyebrow">
            <CircleHelp size={15} />
            <span>NEED TO KNOW</span>
          </div>

          <h2>
            Questions?
            <br />
            <span className="brx-text-gradient">We've got answers.</span>
          </h2>

          <p>
            A few useful details before you start creating.
          </p>
        </div>

        <div className="brx-faq-list">
          {faqs.map((faq) => (
            <details className="brx-faq-item" key={faq.question}>
              <summary>
                <span>{faq.question}</span>
                <ChevronDown size={19} />
              </summary>

              <p>{faq.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}