import { NextResponse } from "next/server";
import { z } from "zod";
import { ReorderMode } from "@/generated/prisma/enums";
import { getInventoryConfig } from "@/lib/reorder";
import { prisma } from "@/lib/prisma";

const updateSchema = z.object({
  reorderMode: z.nativeEnum(ReorderMode),
  advancedForecastHorizon: z.number().int().min(7).max(180).optional(),
  safetyDays: z.number().int().min(0).max(60).optional(),
});

export async function GET() {
  const config = await getInventoryConfig();
  return NextResponse.json({ config });
}

export async function PUT(req: Request) {
  const payload = await req.json();
  const parsed = updateSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Parametres invalides", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const config = await prisma.inventoryConfig.upsert({
    where: { id: "default" },
    update: {
      reorderMode: parsed.data.reorderMode,
      advancedForecastHorizon: parsed.data.advancedForecastHorizon,
      safetyDays: parsed.data.safetyDays,
    },
    create: {
      id: "default",
      reorderMode: parsed.data.reorderMode,
      advancedForecastHorizon: parsed.data.advancedForecastHorizon ?? 30,
      safetyDays: parsed.data.safetyDays ?? 7,
    },
  });

  return NextResponse.json({ config });
}
