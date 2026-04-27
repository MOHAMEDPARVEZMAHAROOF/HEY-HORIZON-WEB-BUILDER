"use client";

import Link from "next/link";
import { useState } from "react";

type CaptureResponse = {
  cloneId: string;
  sourceUrl: string;
  previewUrl: string;
  exportUrl: string;
  manifestUrl: string;
  stats: {
    capturedAssets: number;
    downloadedAssets: number;
    modelCount: number;
    textureCount: number;
    scriptCount: number;
  };
  limitations: string[];
};

const modes = ["URL clone", "Prompt enhancer", "Transition chooser"] as const;

export function WebglClonerWorkbench() {
  const [idea, setIdea] = useState(
    "Clone this premium automotive launch site and turn the hero into a cinematic electric showroom."
  );
  const [url, setUrl] = useState("https://example.com");
  const [confirmedPermission, setConfirmedPermission] = useState(false);
  const [selectedMode, setSelectedMode] = useState<(typeof modes)[number]>("URL clone");
  const [status, setStatus] = useState("Idle");
  const [manifest, setManifest] = useState<CaptureResponse | null>(null);

  async function onCapture() {
    setStatus("Capturing");
    setManifest(null);

    const response = await fetch("/api/webgl-cloner/capture", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ url, confirmedPermission })
    });

    const payload = (await response.json()) as CaptureResponse & { error?: string };

    if (!response.ok) {
      setStatus(payload.error ?? "Capture failed");
      return;
    }

    setManifest(payload);
    setStatus("Ready");
  }

  return (
    <main className="workbench-shell">
      <section className="workbench-hero">
        <p className="eyebrow">Mirror Engine Workbench</p>
        <h1>Capture, inspect, replay, and export from one controlled surface.</h1>
        <p>
          This first implementation pass wires the real app flow and leaves room for progress
          streaming, deep capture, and AI-assisted editing.
        </p>
        <div className="workbench-actions">
          <Link className="secondary-button" href="/">
            Back to site
          </Link>
          <span className="status-chip">{status}</span>
        </div>
      </section>

      <section className="workbench-grid">
        <form
          className="capture-form"
          onSubmit={(event) => {
            event.preventDefault();
            void onCapture();
          }}
        >
          <label>
            <span className="field-label">Project idea</span>
            <textarea value={idea} onChange={(event) => setIdea(event.target.value)} />
          </label>

          <label>
            <span className="field-label">Mode</span>
            <select
              value={selectedMode}
              onChange={(event) => setSelectedMode(event.target.value as (typeof modes)[number])}
            >
              {modes.map((mode) => (
                <option key={mode} value={mode}>
                  {mode}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span className="field-label">3D website URL</span>
            <input value={url} onChange={(event) => setUrl(event.target.value)} />
          </label>

          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={confirmedPermission}
              onChange={(event) => setConfirmedPermission(event.target.checked)}
            />
            <span>I confirm I have permission to capture this website.</span>
          </label>

          <button className="primary-button" type="submit">
            Capture Website
          </button>
          <p className="field-note">
            Mirror Engine now fetches the source page, saves reachable assets locally, rewrites the
            preview to local routes, and prepares an export package for inspection.
          </p>
        </form>

        <section className="status-panel">
          <p className="eyebrow">Phase 1 Scope</p>
          <h2>What this build already wires</h2>
          <ul>
            <li>Permission-gated capture request</li>
            <li>Reachable HTML and asset mirroring</li>
            <li>Locally rewritten preview route</li>
            <li>Downloadable ZIP export and accuracy report</li>
          </ul>
        </section>

        <section className="manifest-panel">
          <p className="eyebrow">Latest Capture</p>
          {manifest ? (
            <>
              <h2>{manifest.cloneId}</h2>
              <p className="panel-copy">{manifest.sourceUrl}</p>
              <ul>
                <li>Assets: {manifest.stats.capturedAssets}</li>
                <li>Downloaded: {manifest.stats.downloadedAssets}</li>
                <li>Models: {manifest.stats.modelCount}</li>
                <li>Textures: {manifest.stats.textureCount}</li>
                <li>Scripts: {manifest.stats.scriptCount}</li>
              </ul>
              <div className="workbench-actions">
                <Link className="ghost-button" href={manifest.previewUrl}>
                  Open Preview
                </Link>
                <Link className="ghost-button" href={manifest.exportUrl}>
                  Export
                </Link>
                <Link className="ghost-button" href={manifest.manifestUrl}>
                  Open Manifest
                </Link>
              </div>
              {manifest.limitations.length > 0 ? (
                <>
                  <h3>Capture Notes</h3>
                  <ul>
                    {manifest.limitations.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </>
              ) : null}
            </>
          ) : (
            <>
              <h2>No capture yet</h2>
              <p className="panel-copy">
                Trigger a capture to populate the manifest area and verify the end-to-end shape.
              </p>
            </>
          )}
        </section>
      </section>
    </main>
  );
}
