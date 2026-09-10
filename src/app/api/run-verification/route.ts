import { NextResponse } from "next/server";
import { runVerification } from "@/lib/genlayer-server";

export async function POST() {
  try {
    const result = await runVerification();
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
