const blockedHosts = new Set(["localhost", "127.0.0.1", "0.0.0.0"]);

export function assertSafeReferenceUrl(input: string) {
  const url = new URL(input);

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Only http and https URLs are allowed.");
  }

  if (blockedHosts.has(url.hostname)) {
    throw new Error("Local and loopback URLs are not allowed.");
  }

  if (url.hostname.endsWith(".local")) {
    throw new Error("Local network URLs are not allowed.");
  }
}

export function createCloneId(hostname: string) {
  const slug = hostname.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
  const token = Math.random().toString(16).slice(2, 10);
  return `${slug}-${token}`;
}
