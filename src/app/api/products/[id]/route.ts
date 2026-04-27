import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma, hasConfiguredDatabaseUrl } from "@/lib/prisma";

const patchSchema = z.object({
  brand: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  minimumStock: z.number().int().min(0).optional(),
  imageUrl: z.string().url().optional().nullable(),
  categoryId: z.string().optional().nullable(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!hasConfiguredDatabaseUrl) {
    return NextResponse.json({ error: "DB not configured" }, { status: 503 });
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const data = parsed.data;

  try {
    const product = await prisma.product.update({
      where: { id },
      data: {
        ...(data.brand !== undefined && { brand: data.brand }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.minimumStock !== undefined && { minimumStock: data.minimumStock }),
        ...(data.imageUrl !== undefined && { imageUrl: data.imageUrl }),
        ...(data.categoryId !== undefined && {
          category: data.categoryId
            ? { connect: { id: data.categoryId } }
            : { disconnect: true },
        }),
      },
      include: { category: true },
    });

    return NextResponse.json(product);
  } catch {
    return NextResponse.json({ error: "Product not found or update failed" }, { status: 404 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!hasConfiguredDatabaseUrl) {
    return NextResponse.json({ error: "DB not configured" }, { status: 503 });
  }

  const { id } = await params;

  try {
    await prisma.product.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }
}
