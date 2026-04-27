import { NextResponse } from "next/server";
import { parseExportRequest } from "../../../../lib/webgl-cloner-route-helpers";
import { exportClonePackage } from "../../../../lib/webgl-cloner";

export async function POST(request: Request) {
  try {
    const body = parseExportRequest(await request.json());
    const file = await exportClonePackage(body);

    return new NextResponse(file.body, {
      headers: {
        "Content-Type": file.contentType,
        "Content-Disposition": `attachment; filename="${file.filename}"`
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Export failed."
      },
      { status: 400 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const cloneId = searchParams.get("cloneId");

    if (!cloneId) {
      return NextResponse.json({ error: "cloneId is required." }, { status: 400 });
    }

    const file = await exportClonePackage({ cloneId });
    return new NextResponse(file.body, {
      headers: {
        "Content-Type": file.contentType,
        "Content-Disposition": `attachment; filename="${file.filename}"`
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Export failed."
      },
      { status: 400 }
    );
  }
}
