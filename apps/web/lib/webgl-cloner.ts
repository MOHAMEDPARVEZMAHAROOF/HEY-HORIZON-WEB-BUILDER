import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  type CaptureRequest,
  type CaptureManifest,
  type ExportRequest,
  type RunRequest
} from "@heyhorizon/contracts";
import { assertSafeReferenceUrl, createCloneId } from "@heyhorizon/security";

const rootDir = path.resolve(process.cwd(), ".generated", "webgl-clones");

function cloneDir(cloneId: string) {
  return path.join(rootDir, cloneId);
}

export async function captureAuthorizedWebglSite(input: CaptureRequest): Promise<CaptureManifest> {
  if (!input.confirmedPermission) {
    throw new Error("Permission confirmation is required.");
  }

  assertSafeReferenceUrl(input.url);

  const source = new URL(input.url);
  const cloneId = createCloneId(source.hostname);
  const outputDir = cloneDir(cloneId);

  await mkdir(path.join(outputDir, "assets"), { recursive: true });

  const manifest: CaptureManifest = {
    cloneId,
    sourceUrl: input.url,
    sourceHost: source.hostname,
    title: `${source.hostname} capture`,
    previewUrl: `/api/webgl-cloner/run/${cloneId}`,
    exportUrl: `/api/webgl-cloner/export?cloneId=${cloneId}`,
    manifestUrl: `/api/webgl-cloner/assets/${cloneId}/manifest.json`,
    createdAt: new Date().toISOString(),
    stats: {
      capturedAssets: 12,
      downloadedAssets: 8,
      modelCount: 1,
      textureCount: 3,
      scriptCount: 4
    },
    limitations: [
      "Deterministic scaffold response until Playwright capture is wired.",
      "Authenticated, encrypted, or signed assets are intentionally excluded."
    ]
  };

  await writeFile(path.join(outputDir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
  await writeFile(
    path.join(outputDir, "source.html"),
    renderPreviewHtml(manifest),
    "utf8"
  );

  return manifest;
}

export async function createCloneRunPreview(input: RunRequest) {
  const manifest = await loadManifest(input.cloneId);

  return {
    cloneId: manifest.cloneId,
    html: renderPreviewHtml(manifest),
    previewUrl: manifest.previewUrl,
    model: "deterministic-bootstrap",
    adapterPath: "not-configured",
    status: "rendered"
  };
}

export async function exportClonePackage(input: ExportRequest) {
  const manifest = await loadManifest(input.cloneId);

  return {
    filename: `${manifest.cloneId}.zip`,
    contentType: "application/zip",
    body: Buffer.from(
      JSON.stringify(
        {
          README: "Placeholder export. Replace with ZIP generation in the next pass.",
          manifest
        },
        null,
        2
      ),
      "utf8"
    )
  };
}

export async function loadManifest(cloneId: string): Promise<CaptureManifest> {
  const manifestPath = path.join(cloneDir(cloneId), "manifest.json");
  const file = await readFile(manifestPath, "utf8");
  return JSON.parse(file) as CaptureManifest;
}

export async function readCloneAsset(cloneId: string, assetPath: string[]) {
  const resolvedPath = path.join(cloneDir(cloneId), ...assetPath);
  const content = await readFile(resolvedPath);
  return {
    fileName: path.basename(resolvedPath),
    buffer: content
  };
}

export function renderPreviewHtml(manifest: CaptureManifest) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${manifest.title}</title>
    <style>
      :root { color-scheme: dark; }
      body {
        margin: 0;
        font-family: Arial, sans-serif;
        background: linear-gradient(180deg, #060d18 0%, #04070d 100%);
        color: #f4f7fb;
        min-height: 100vh;
        display: grid;
        place-items: center;
      }
      main {
        width: min(760px, calc(100% - 32px));
        border: 1px solid rgba(132, 177, 207, 0.22);
        background: rgba(8, 18, 32, 0.8);
        border-radius: 24px;
        padding: 28px;
      }
      p { color: #9db5ca; line-height: 1.6; }
    </style>
  </head>
  <body>
    <main>
      <h1>${manifest.sourceHost}</h1>
      <p>Mirror Engine preview bootstrap for ${manifest.cloneId}.</p>
      <p>This route is ready for HTML rewriting, runtime asset patching, and screenshot fallback.</p>
    </main>
  </body>
</html>`;
}
