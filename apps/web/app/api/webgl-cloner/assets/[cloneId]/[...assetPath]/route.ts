import { NextResponse } from "next/server";
import { readCloneAsset } from "../../../../../../lib/webgl-cloner";

type Context = {
  params: Promise<{
    cloneId: string;
    assetPath: string[];
  }>;
};

export async function GET(_request: Request, context: Context) {
  try {
    const { cloneId, assetPath } = await context.params;
    const asset = await readCloneAsset(cloneId, assetPath);

    return new NextResponse(asset.buffer, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `inline; filename="${asset.fileName}"`
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Asset not found."
      },
      { status: 404 }
    );
  }
}
