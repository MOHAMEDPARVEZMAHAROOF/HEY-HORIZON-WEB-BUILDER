import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import {
  type CaptureRequest,
  type CaptureManifest,
  type ExportRequest,
  type RunRequest
} from "@heyhorizon/contracts";
import { assertSafeReferenceUrl, createCloneId } from "@heyhorizon/security";

const rootDir = path.resolve(process.cwd(), ".generated", "webgl-clones");
const maxHtmlBytes = 1_500_000;
const maxAssetBytes = 5_000_000;
const maxAssetCount = 24;

function cloneDir(cloneId: string) {
  return path.join(rootDir, cloneId);
}

function toPosixPath(input: string) {
  return input.split(path.sep).join("/");
}

function cloneAssetRoute(cloneId: string, assetRelativePath: string) {
  return `/api/webgl-cloner/assets/${cloneId}/${assetRelativePath}`;
}

type CapturedAsset = {
  sourceUrl: string;
  relativePath: string;
  size: number;
  contentType: string;
};

type CaptureContext = {
  assetDir: string;
  cloneId: string;
  downloadedAssets: CapturedAsset[];
  replacements: Map<string, string>;
  limitations: Set<string>;
  seenUrls: Set<string>;
};

type RenderSnapshot = {
  captureMethod: "http-fetch" | "playwright";
  renderedHtml: string;
  screenshotPath?: string;
  title?: string;
};

export async function captureAuthorizedWebglSite(input: CaptureRequest): Promise<CaptureManifest> {
  if (!input.confirmedPermission) {
    throw new Error("Permission confirmation is required.");
  }

  assertSafeReferenceUrl(input.url);

  const source = new URL(input.url);
  const cloneId = createCloneId(source.hostname);
  const outputDir = cloneDir(cloneId);
  const assetDir = path.join(outputDir, "assets");

  await mkdir(assetDir, { recursive: true });

  const response = await fetchWithLimit(source.toString(), maxHtmlBytes);
  const html = await response.text();
  const discoveredAssets = extractAssetUrls(html, source).slice(0, maxAssetCount);
  const downloadedAssets: CapturedAsset[] = [];
  const limitations = new Set<string>([
    "Authenticated, encrypted, signed, or private runtime assets are intentionally excluded."
  ]);
  const replacements = new Map<string, string>();
  const context: CaptureContext = {
    assetDir,
    cloneId,
    downloadedAssets,
    replacements,
    limitations,
    seenUrls: new Set<string>()
  };

  for (const assetUrl of discoveredAssets) {
    try {
      await captureAsset(assetUrl, context);
    } catch (error) {
      limitations.add(
        error instanceof Error
          ? `${new URL(assetUrl).pathname} skipped: ${error.message}`
          : `${new URL(assetUrl).pathname} skipped during capture.`
      );
    }
  }

  const mirroredHtml = rewriteHtmlForPreview(html, source, replacements);
  const renderSnapshot = await createRenderSnapshot({
    cloneId,
    outputDir,
    sourceUrl: source,
    html: mirroredHtml,
    limitations
  });
  const title = renderSnapshot.title ?? extractTitle(html) ?? `${source.hostname} capture`;

  const manifest: CaptureManifest = {
    cloneId,
    sourceUrl: input.url,
    sourceHost: source.hostname,
    title,
    previewUrl: `/api/webgl-cloner/run/${cloneId}`,
    exportUrl: `/api/webgl-cloner/export?cloneId=${cloneId}`,
    manifestUrl: cloneAssetRoute(cloneId, "manifest.json"),
    screenshotUrl: renderSnapshot.screenshotPath
      ? cloneAssetRoute(cloneId, renderSnapshot.screenshotPath)
      : null,
    captureMethod: renderSnapshot.captureMethod,
    createdAt: new Date().toISOString(),
    stats: {
      capturedAssets: discoveredAssets.length,
      downloadedAssets: downloadedAssets.length,
      modelCount: countAssetsByType(downloadedAssets, ["model/", ".glb", ".gltf", ".obj", ".fbx"]),
      textureCount: countAssetsByType(downloadedAssets, ["image/"]),
      scriptCount: countAssetsByType(downloadedAssets, ["javascript", ".js", ".mjs"])
    },
    limitations: Array.from(limitations)
  };

  const accuracyReport = {
    cloneId,
    sourceUrl: input.url,
    capturedAt: manifest.createdAt,
    captureMethod: renderSnapshot.captureMethod,
    htmlBytes: Buffer.byteLength(html, "utf8"),
    downloadedAssets: downloadedAssets.map((asset) => ({
      sourceUrl: asset.sourceUrl,
      relativePath: asset.relativePath,
      size: asset.size,
      contentType: asset.contentType
    })),
    limitations: manifest.limitations
  };

  await writeFile(path.join(outputDir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
  await writeFile(
    path.join(outputDir, "accuracy-report.json"),
    JSON.stringify(accuracyReport, null, 2),
    "utf8"
  );
  await writeFile(path.join(outputDir, "source.html"), html, "utf8");
  await writeFile(path.join(outputDir, "initial.html"), mirroredHtml, "utf8");
  await writeFile(path.join(outputDir, "rendered.html"), renderSnapshot.renderedHtml, "utf8");

  return manifest;
}

export async function createCloneRunPreview(input: RunRequest) {
  const manifest = await loadManifest(input.cloneId);
  const outputDir = cloneDir(input.cloneId);

  let html = renderPreviewHtml(manifest);

  try {
    html = await readFile(path.join(outputDir, "rendered.html"), "utf8");
  } catch {
    // Fall back to the shell preview when a rendered page is unavailable.
  }

  return {
    cloneId: manifest.cloneId,
    html,
    previewUrl: manifest.previewUrl,
    model: "http-fetch-mirror",
    adapterPath: path.join(outputDir, "rendered.html"),
    status: "rendered"
  };
}

export async function exportClonePackage(input: ExportRequest) {
  const outputDir = cloneDir(input.cloneId);
  await stat(outputDir);

  const files = await collectFiles(outputDir);
  const archive = await Promise.all(
    files.map(async (filePath) => ({
      name: toPosixPath(path.relative(outputDir, filePath)),
      data: await readFile(filePath)
    }))
  );

  return {
    filename: `${input.cloneId}.zip`,
    contentType: "application/zip",
    body: buildZipArchive(archive)
  };
}

export async function loadManifest(cloneId: string): Promise<CaptureManifest> {
  const manifestPath = safeReadPath(cloneId, ["manifest.json"]);
  const file = await readFile(manifestPath, "utf8");
  return JSON.parse(file) as CaptureManifest;
}

export async function readCloneAsset(cloneId: string, assetPath: string[]) {
  const resolvedPath = safeReadPath(cloneId, assetPath);
  const content = await readFile(resolvedPath);
  return {
    fileName: path.basename(resolvedPath),
    contentType: inferContentType(resolvedPath),
    buffer: content
  };
}

function safeReadPath(cloneId: string, assetPath: string[]) {
  const baseDir = cloneDir(cloneId);
  const resolvedPath = path.resolve(baseDir, ...assetPath);

  if (resolvedPath !== baseDir && !resolvedPath.startsWith(`${baseDir}${path.sep}`)) {
    throw new Error("Invalid asset path.");
  }

  return resolvedPath;
}

async function downloadAsset(assetUrl: string, assetDir: string): Promise<CapturedAsset> {
  const sourceUrl = new URL(assetUrl);
  const response = await fetchWithLimit(sourceUrl.toString(), maxAssetBytes);
  const contentType = response.headers.get("content-type") ?? "application/octet-stream";
  const data = Buffer.from(await response.arrayBuffer());
  const relativePath = createAssetPath(sourceUrl, contentType);
  const filePath = path.join(assetDir, relativePath);

  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, data);

  return {
    sourceUrl: sourceUrl.toString(),
    relativePath: toPosixPath(relativePath),
    size: data.byteLength,
    contentType
  };
}

async function captureAsset(assetUrl: string, context: CaptureContext) {
  const normalizedUrl = new URL(assetUrl).toString();

  if (context.seenUrls.has(normalizedUrl)) {
    return context.replacements.get(normalizedUrl);
  }

  context.seenUrls.add(normalizedUrl);

  const capturedAsset = await downloadAsset(normalizedUrl, context.assetDir);
  context.downloadedAssets.push(capturedAsset);
  const assetRoute = cloneAssetRoute(context.cloneId, capturedAsset.relativePath);
  context.replacements.set(capturedAsset.sourceUrl, assetRoute);

  if (capturedAsset.contentType.includes("text/css")) {
    const filePath = path.join(context.assetDir, capturedAsset.relativePath);
    const css = await readFile(filePath, "utf8");
    const rewrittenCss = await rewriteCssUrls(css, new URL(capturedAsset.sourceUrl), async (url) => {
      try {
        const localUrl = await captureAsset(url.toString(), context);
        return localUrl ?? url.toString();
      } catch (error) {
        context.limitations.add(
          error instanceof Error
            ? `${url.pathname} skipped from CSS: ${error.message}`
            : `${url.pathname} skipped from CSS.`
        );
        return url.toString();
      }
    });

    await writeFile(filePath, rewrittenCss, "utf8");
  }

  return assetRoute;
}

async function fetchWithLimit(url: string, maxBytes: number) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "MirrorEngine/1.0 (+permission-based capture)"
    }
  });

  if (!response.ok) {
    throw new Error(`Request failed with ${response.status}.`);
  }

  const contentLength = Number(response.headers.get("content-length") ?? "0");

  if (contentLength > maxBytes) {
    throw new Error(`Response exceeded ${maxBytes} byte limit.`);
  }

  return response;
}

async function createRenderSnapshot(input: {
  cloneId: string;
  outputDir: string;
  sourceUrl: URL;
  html: string;
  limitations: Set<string>;
}): Promise<RenderSnapshot> {
  try {
    const loadPlaywright = new Function(
      "specifier",
      "return import(specifier);"
    ) as (specifier: string) => Promise<{ chromium: { launch: (options: { headless: boolean }) => Promise<any> } }>;
    const playwright = await loadPlaywright("playwright");
    const browser = await playwright.chromium.launch({
      headless: true
    });

    try {
      const page = await browser.newPage({
        viewport: {
          width: 1440,
          height: 900
        }
      });

      await page.setContent(input.html, {
        waitUntil: "domcontentloaded"
      });
      await page.waitForTimeout(1200);

      const screenshotPath = path.join(input.outputDir, "screenshot.png");
      await page.screenshot({
        path: screenshotPath,
        fullPage: true
      });

      return {
        captureMethod: "playwright",
        renderedHtml: await page.content(),
        screenshotPath: "screenshot.png",
        title: await page.title()
      };
    } finally {
      await browser.close();
    }
  } catch (error) {
    input.limitations.add(
      error instanceof Error
        ? `Playwright render unavailable: ${error.message}`
        : "Playwright render unavailable in this runtime."
    );

    return {
      captureMethod: "http-fetch",
      renderedHtml: input.html
    };
  }
}

function extractAssetUrls(html: string, baseUrl: URL) {
  const assetUrls = new Set<string>();
  const attributePattern =
    /<(?:script|img|source|video|audio|link|model-viewer)\b[^>]*?\b(?:src|href|poster)=["']([^"'#?][^"']*|https?:\/\/[^"']+)["'][^>]*>/gi;
  let match: RegExpExecArray | null = null;

  while ((match = attributePattern.exec(html)) !== null) {
    const candidate = match[1]?.trim();

    if (!candidate) {
      continue;
    }

    try {
      const resolved = new URL(candidate, baseUrl);

      if (["http:", "https:"].includes(resolved.protocol)) {
        assetUrls.add(resolved.toString());
      }
    } catch {
      // Ignore malformed URLs found in source markup.
    }
  }

  return Array.from(assetUrls);
}

function extractTitle(html: string) {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return titleMatch?.[1]?.replace(/\s+/g, " ").trim();
}

function rewriteHtmlForPreview(html: string, baseUrl: URL, replacements: Map<string, string>) {
  const rewritten = html.replace(
    /(<(?:script|img|source|video|audio|link|model-viewer)\b[^>]*?\b(?:src|href|poster)=["'])([^"']+)(["'][^>]*>)/gi,
    (_match, prefix: string, assetPath: string, suffix: string) => {
      try {
        const absoluteUrl = new URL(assetPath, baseUrl).toString();
        const replacement = replacements.get(absoluteUrl);
        return `${prefix}${replacement ?? absoluteUrl}${suffix}`;
      } catch {
        return `${prefix}${assetPath}${suffix}`;
      }
    }
  );

  if (/<head[\s>]/i.test(rewritten)) {
    return rewritten.replace(
      /<head([^>]*)>/i,
      `<head$1><meta name="referrer" content="no-referrer" />`
    );
  }

  return rewritten;
}

async function rewriteCssUrls(
  css: string,
  baseUrl: URL,
  resolveUrl: (url: URL) => Promise<string>
) {
  const matches = Array.from(css.matchAll(/url\((['"]?)([^'")]+)\1\)/gi));
  const replacements = await Promise.all(
    matches.map(async (match) => {
      const quote = match[1] ?? "";
      const trimmed = (match[2] ?? "").trim();

      if (
        trimmed.startsWith("data:") ||
        trimmed.startsWith("blob:") ||
        trimmed.startsWith("javascript:")
      ) {
        return {
          original: match[0],
          replacement: `url(${quote}${trimmed}${quote})`
        };
      }

      try {
        const resolved = await resolveUrl(new URL(trimmed, baseUrl));
        return {
          original: match[0],
          replacement: `url(${quote}${resolved}${quote})`
        };
      } catch {
        return {
          original: match[0],
          replacement: `url(${quote}${trimmed}${quote})`
        };
      }
    })
  );

  let rewritten = css;

  for (const entry of replacements) {
    rewritten = rewritten.replace(entry.original, entry.replacement);
  }

  return rewritten;
}

function createAssetPath(sourceUrl: URL, contentType: string) {
  const pathname = sourceUrl.pathname === "/" ? "/index" : sourceUrl.pathname;
  const sanitizedPath = path.posix
    .normalize(
      pathname
        .replace(/^\/+/, "")
        .replace(/[^a-zA-Z0-9/._-]+/g, "-")
        .replace(/\/+/g, "/")
    )
    .replace(/^(\.\.(\/|$))+/, "")
    .replace(/^\/+/, "");
  const ext = path.extname(sanitizedPath) || inferExtension(contentType);
  const baseName = sanitizedPath.replace(/\.[a-zA-Z0-9]+$/, "") || "asset";
  const queryHash = sourceUrl.search ? createHash("sha1").update(sourceUrl.search).digest("hex").slice(0, 8) : "";
  const suffix = queryHash ? `-${queryHash}` : "";
  return `${baseName}${suffix}${ext}`;
}

function inferExtension(contentType: string) {
  if (contentType.includes("text/css")) return ".css";
  if (contentType.includes("javascript")) return ".js";
  if (contentType.includes("application/json")) return ".json";
  if (contentType.includes("image/png")) return ".png";
  if (contentType.includes("image/jpeg")) return ".jpg";
  if (contentType.includes("image/webp")) return ".webp";
  if (contentType.includes("image/svg+xml")) return ".svg";
  if (contentType.includes("model/gltf-binary")) return ".glb";
  if (contentType.includes("model/gltf+json")) return ".gltf";
  return ".bin";
}

function inferContentType(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();

  switch (ext) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".js":
    case ".mjs":
      return "text/javascript; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    case ".glb":
      return "model/gltf-binary";
    case ".gltf":
      return "model/gltf+json; charset=utf-8";
    default:
      return "application/octet-stream";
  }
}

function countAssetsByType(assets: CapturedAsset[], hints: string[]) {
  return assets.filter((asset) =>
    hints.some((hint) => asset.contentType.includes(hint) || asset.relativePath.endsWith(hint))
  ).length;
}

async function collectFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(directory, entry.name);
      return entry.isDirectory() ? collectFiles(fullPath) : [fullPath];
    })
  );

  return nested.flat().sort();
}

function renderPreviewHtml(manifest: CaptureManifest) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(manifest.title)}</title>
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
      <h1>${escapeHtml(manifest.sourceHost)}</h1>
      <p>Mirror Engine captured this page and prepared a local preview package.</p>
      <p>If the source relied on private APIs or runtime-protected assets, those pieces stay excluded by design.</p>
    </main>
  </body>
</html>`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function buildZipArchive(files: Array<{ name: string; data: Buffer }>) {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  files.forEach((file) => {
    const nameBuffer = Buffer.from(file.name, "utf8");
    const crc = crc32(file.data);
    const localHeader = Buffer.alloc(30);

    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(file.data.length, 18);
    localHeader.writeUInt32LE(file.data.length, 22);
    localHeader.writeUInt16LE(nameBuffer.length, 26);
    localHeader.writeUInt16LE(0, 28);

    localParts.push(localHeader, nameBuffer, file.data);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(file.data.length, 20);
    centralHeader.writeUInt32LE(file.data.length, 24);
    centralHeader.writeUInt16LE(nameBuffer.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);

    centralParts.push(centralHeader, nameBuffer);
    offset += localHeader.length + nameBuffer.length + file.data.length;
  });

  const centralDirectory = Buffer.concat(centralParts);
  const localDirectory = Buffer.concat(localParts);
  const endRecord = Buffer.alloc(22);

  endRecord.writeUInt32LE(0x06054b50, 0);
  endRecord.writeUInt16LE(0, 4);
  endRecord.writeUInt16LE(0, 6);
  endRecord.writeUInt16LE(files.length, 8);
  endRecord.writeUInt16LE(files.length, 10);
  endRecord.writeUInt32LE(centralDirectory.length, 12);
  endRecord.writeUInt32LE(localDirectory.length, 16);
  endRecord.writeUInt16LE(0, 20);

  return Buffer.concat([localDirectory, centralDirectory, endRecord]);
}

const crcTable = new Uint32Array(
  Array.from({ length: 256 }, (_, index) => {
    let crc = index;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 1) === 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }
    return crc >>> 0;
  })
);

function crc32(buffer: Buffer) {
  let crc = 0xffffffff;

  for (const byte of buffer) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}
