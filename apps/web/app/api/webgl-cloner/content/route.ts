import { NextResponse } from "next/server";
import { contentRequestSchema } from "../../../../lib/webgl-cloner-route-helpers";

export async function POST(request: Request) {
  try {
    const body = contentRequestSchema.parse(await request.json());

    return NextResponse.json({
      model: "gemma-2b-unsloth-lora-placeholder",
      mode: body.mode,
      content: `Mirror Engine draft for: ${body.idea}`
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Content generation failed."
      },
      { status: 400 }
    );
  }
}
