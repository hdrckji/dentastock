import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const createCategorySchema = z.object({
  name: z.string().trim().min(2, "Nom de categorie trop court"),
  colorHex: z
    .string()
    .trim()
    .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "Couleur invalide")
    .optional(),
});

export async function GET() {
  const categories = await prisma.category.findMany({
    orderBy: {
      name: "asc",
    },
  });

  return NextResponse.json({ categories });
}

export async function POST(req: Request) {
  const payload = await req.json();
  const parsed = createCategorySchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation invalide", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const normalizedName = parsed.data.name;

  const existing = await prisma.category.findUnique({
    where: {
      name: normalizedName,
    },
  });

  if (existing) {
    return NextResponse.json({ category: existing });
  }

  const category = await prisma.category.create({
    data: {
      name: normalizedName,
      colorHex: parsed.data.colorHex,
    },
  });

  return NextResponse.json({ category }, { status: 201 });
}
