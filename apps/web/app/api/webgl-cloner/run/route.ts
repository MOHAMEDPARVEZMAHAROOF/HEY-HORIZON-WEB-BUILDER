import { NextResponse } from "next/server";
import { parseRunRequest } from "../../../../lib/webgl-cloner-route-helpers";
import { createCloneRunPreview } from "../../../../lib/webgl-cloner";

export async function POST(request: Request) {
  try {
    const body = parseRunRequest(await request.json());
    const preview = await createCloneRunPreview(body);
    return NextResponse.json(preview);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Run preview failed."
      },
      { status: 400 }
    );
  }
}
