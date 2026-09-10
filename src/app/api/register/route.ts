import { NextRequest, NextResponse } from "next/server";
import { registerAgent } from "@/lib/genlayer-server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { claimedModel, description } = body as {
      claimedModel?: string;
      description?: string;
    };

    if (!claimedModel || !description) {
      return NextResponse.json(
        { error: "claimedModel and description are required" },
        { status: 400 },
      );
    }

    const result = await registerAgent(claimedModel, description);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
