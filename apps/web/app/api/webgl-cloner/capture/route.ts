import { NextResponse } from "next/server";
import { parseCaptureRequest } from "../../../../lib/webgl-cloner-route-helpers";
import { captureAuthorizedWebglSite } from "../../../../lib/webgl-cloner";

export async function POST(request: Request) {
  try {
    const body = parseCaptureRequest(await request.json());
    const manifest = await captureAuthorizedWebglSite(body);
    return NextResponse.json(manifest);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Capture failed."
      },
      { status: 400 }
    );
  }
}
