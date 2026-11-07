import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="landing">
      <div className="landing-inner">
        <div className="landing-topline">
          <span className="brand-mark">F</span> FinSig
          <span className="landing-badge">PayPal + AI hackathon</span>
        </div>
        <p className="eyebrow">THE FINANCIAL SIGNAL BEHIND YOUR WORK</p>
        <h1>
          Know what your work is <em>really</em> earning.
        </h1>
        <p className="landing-lede">
          FinSig turns PayPal receipts, refunds, fees and work time into an explainable picture of
          independent income. AI helps organize and explain; verified code does the math.
        </p>
        <div className="landing-actions">
          <Link className="button button-primary" href="/demo">
            Try the interactive demo <span>↗</span>
          </Link>
          <a
            className="button button-quiet"
            href="https://github.com/dmrvcodes/finsig"
            target="_blank"
            rel="noreferrer"
          >
            View source on GitHub
          </a>
        </div>
        <div className="landing-foot">
          <span>
            <strong>01</strong> Trace every number to a source
          </span>
          <span>
            <strong>02</strong> Confirm AI suggestions yourself
          </span>
          <span>
            <strong>03</strong> Plan from verified cash flow
          </span>
        </div>
      </div>
    </main>
  );
}
