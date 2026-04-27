import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const createProductSchema = z.object({
  brand: z.string().trim().min(1, "La marque est requise"),
  description: z.string().trim().min(1, "La description est requise"),
  ean: z.string().trim().regex(/^\d{8,14}$/, "EAN invalide (8 a 14 chiffres)"),
  minimumStock: z.number().int().min(0).default(0),
  imageUrl: z.string().url().optional().or(z.literal("")),
  categoryId: z.string().cuid().optional(),
  categoryName: z.string().trim().min(2).optional(),
  supplierIds: z.array(z.string().cuid()).default([]),
});

export async function GET() {
  const products = await prisma.product.findMany({
    include: {
      category: true,
      suppliers: {
        include: {
          supplier: true,
        },
      },
      lots: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const normalized = products.map((product) => ({
    id: product.id,
    brand: product.brand,
    description: product.description,
    ean: product.ean,
    minimumStock: product.minimumStock,
    imageUrl: product.imageUrl,
    category: product.category,
    suppliers: product.suppliers.map((item) => item.supplier),
    currentStock: product.lots.reduce((sum, lot) => sum + lot.quantityOnHand, 0),
  }));

  return NextResponse.json({ products: normalized });
}

export async function POST(req: Request) {
  const payload = await req.json();
  const parsed = createProductSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation invalide", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;

  const categoryRelation = data.categoryId
    ? { connect: { id: data.categoryId } }
    : data.categoryName
      ? {
          connectOrCreate: {
            where: { name: data.categoryName },
            create: { name: data.categoryName },
          },
        }
      : undefined;

  const product = await prisma.product.create({
    data: {
      brand: data.brand,
      description: data.description,
      ean: data.ean,
      minimumStock: data.minimumStock,
      imageUrl: data.imageUrl || null,
      category: categoryRelation,
      suppliers: {
        create: data.supplierIds.map((supplierId, index) => ({
          supplierId,
          isPrimary: index === 0,
        })),
      },
    },
  });

  return NextResponse.json({ product }, { status: 201 });
}
