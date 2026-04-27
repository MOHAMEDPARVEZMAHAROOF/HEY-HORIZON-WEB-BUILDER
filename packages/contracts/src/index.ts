import { z } from "zod";

export const captureRequestSchema = z.object({
  url: z.string().url(),
  confirmedPermission: z.boolean()
});

export const runRequestSchema = z.object({
  cloneId: z.string().min(3)
});

export const exportRequestSchema = z.object({
  cloneId: z.string().min(3)
});

export const captureManifestSchema = z.object({
  cloneId: z.string(),
  sourceUrl: z.string().url(),
  sourceHost: z.string(),
  title: z.string(),
  previewUrl: z.string(),
  exportUrl: z.string(),
  manifestUrl: z.string(),
  screenshotUrl: z.string().nullable().optional(),
  captureMethod: z.enum(["http-fetch", "playwright"]).optional(),
  createdAt: z.string(),
  stats: z.object({
    capturedAssets: z.number(),
    downloadedAssets: z.number(),
    modelCount: z.number(),
    textureCount: z.number(),
    scriptCount: z.number()
  }),
  limitations: z.array(z.string())
});

export type CaptureRequest = z.infer<typeof captureRequestSchema>;
export type RunRequest = z.infer<typeof runRequestSchema>;
export type ExportRequest = z.infer<typeof exportRequestSchema>;
export type CaptureManifest = z.infer<typeof captureManifestSchema>;
