import Link from "next/link";

const pillars = [
  {
    title: "Capture with consent",
    body: "Collect reachable HTML, assets, and screenshots only after the user confirms permission."
  },
  {
    title: "Replay with context",
    body: "Generate a clone preview with asset rewriting, screenshot fallback, and transparent limitations."
  },
  {
    title: "Export for editing",
    body: "Package manifests, mirrored assets, and runnable previews for inspection and follow-on work."
  }
];

const workflow = [
  "Describe the site or transformation you want to create.",
  "Confirm permission and capture the source URL with Playwright.",
  "Inspect the manifest, assets, preview, and export package."
];

export default function HomePage() {
  return (
    <main className="marketing-shell">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Mirror Engine</p>
          <h1>Clone website experiences with guardrails, previews, and usable exports.</h1>
          <p className="lede">
            A premium workbench for permission-based website capture, replay, asset inspection,
            and export packaging.
          </p>
          <div className="hero-actions">
            <Link className="primary-button" href="/webgl-cloner">
              Open Workbench
            </Link>
            <a className="secondary-button" href="#workflow">
              View Plan
            </a>
          </div>
        </div>
        <div className="hero-panel" aria-hidden="true">
          <div className="orbital-grid" />
          <div className="signal-card">
            <span>Capture</span>
            <strong>Playwright + manifest</strong>
          </div>
          <div className="signal-card">
            <span>Replay</span>
            <strong>Patched preview route</strong>
          </div>
          <div className="signal-card">
            <span>Export</span>
            <strong>ZIP + accuracy report</strong>
          </div>
        </div>
      </section>

      <section className="info-band">
        {pillars.map((pillar) => (
          <article key={pillar.title}>
            <h2>{pillar.title}</h2>
            <p>{pillar.body}</p>
          </article>
        ))}
      </section>

      <section className="workflow" id="workflow">
        <div>
          <p className="eyebrow">Implementation Start</p>
          <h2>Phase 1 is wired around a deterministic capture MVP.</h2>
        </div>
        <ol>
          {workflow.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>
    </main>
  );
}
