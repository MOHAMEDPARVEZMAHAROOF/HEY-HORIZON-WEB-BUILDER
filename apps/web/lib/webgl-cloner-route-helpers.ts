import { z } from "zod";
import { captureRequestSchema, exportRequestSchema, runRequestSchema } from "@heyhorizon/contracts";

export const parseCaptureRequest = (body: unknown) => captureRequestSchema.parse(body);
export const parseRunRequest = (body: unknown) => runRequestSchema.parse(body);
export const parseExportRequest = (body: unknown) => exportRequestSchema.parse(body);

export const contentRequestSchema = z.object({
  idea: z.string().min(10),
  mode: z.enum(["prompt-enhancer", "transition-chooser", "content-draft"]).default("content-draft")
});
