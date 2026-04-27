import { NextResponse } from "next/server";
import { ReorderMode } from "@/generated/prisma/enums";
import { computeReorderSuggestions } from "@/lib/reorder";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const modeParam = searchParams.get("mode");

  const mode =
    modeParam === ReorderMode.SIMPLE || modeParam === ReorderMode.ADVANCED
      ? modeParam
      : undefined;

  const suggestions = await computeReorderSuggestions(mode);

  return NextResponse.json({
    modeUsed: mode ?? "from-config",
    count: suggestions.length,
    suggestions,
  });
}
