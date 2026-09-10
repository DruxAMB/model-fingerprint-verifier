import { NextRequest, NextResponse } from "next/server";
import { submitResponses } from "@/lib/genlayer-server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { responses } = body as { responses?: string[] };

    if (!responses || !Array.isArray(responses) || responses.length === 0) {
      return NextResponse.json(
        { error: "responses array is required and must not be empty" },
        { status: 400 },
      );
    }

    const result = await submitResponses(responses);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
