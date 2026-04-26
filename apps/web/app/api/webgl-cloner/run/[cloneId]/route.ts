import { NextResponse } from "next/server";
import { createCloneRunPreview } from "../../../../../lib/webgl-cloner";

type Context = {
  params: Promise<{
    cloneId: string;
  }>;
};

export async function GET(_request: Request, context: Context) {
  try {
    const { cloneId } = await context.params;
    const preview = await createCloneRunPreview({ cloneId });

    return new NextResponse(preview.html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8"
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Preview not available."
      },
      { status: 404 }
    );
  }
}
