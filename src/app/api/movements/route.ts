import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma, hasConfiguredDatabaseUrl } from "@/lib/prisma";
import { MovementType } from "@/generated/prisma/enums";

export async function GET(request: NextRequest) {
  if (!hasConfiguredDatabaseUrl) {
    return NextResponse.json({ movements: [] });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? "10"), 50);

  const movements = await prisma.stockMovement.findMany({
    include: {
      product: { select: { brand: true, description: true, ean: true } },
      lot: { select: { batchNumber: true, expiresAt: true } },
    },
    orderBy: { occurredAt: "desc" },
    take: limit,
  });

  return NextResponse.json({ movements });
}

const movementSchema = z.object({
  productId: z.string().min(1),
  type: z.enum(["IN", "OUT", "ADJUSTMENT"]),
  quantity: z.number().int().positive(),
  reason: z.string().optional(),
  expiresAt: z.string().optional(),
});

export async function POST(request: NextRequest) {
  if (!hasConfiguredDatabaseUrl) {
    return NextResponse.json({ error: "DB not configured" }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = movementSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const { productId, type, quantity, reason, expiresAt } = parsed.data;

  // Ensure the product exists
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  // Get or create a default lot for simple IN/OUT without lot management
  let lot = await prisma.stockLot.findFirst({
    where: { productId, batchNumber: "DEFAULT" },
  });

  if (!lot) {
    lot = await prisma.stockLot.create({
      data: {
        productId,
        batchNumber: "DEFAULT",
        quantityOnHand: 0,
      },
    });
  }

  const delta = type === "OUT" ? -quantity : quantity;

  // Update lot quantity and record movement in a transaction
  const [movement] = await prisma.$transaction([
    prisma.stockMovement.create({
      data: {
        productId,
        lotId: lot.id,
        type: type as MovementType,
        quantity,
        reason,
      },
    }),
    prisma.stockLot.update({
      where: { id: lot.id },
      data: {
        quantityOnHand: { increment: delta },
        ...(type === "IN" && expiresAt
          ? { expiresAt: new Date(expiresAt) }
          : {}),
      },
    }),
  ]);

  return NextResponse.json(movement, { status: 201 });
}
