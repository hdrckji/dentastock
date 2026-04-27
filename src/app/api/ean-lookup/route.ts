import { NextResponse } from "next/server";

type EanSuggestion = {
  brand: string;
  description: string;
  imageUrl: string;
  source: string;
};

async function lookupOpenFoodFacts(ean: string): Promise<EanSuggestion | null> {
  const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${ean}.json`, {
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  const data = await response.json();

  if (!data?.product) {
    return null;
  }

  const product = data.product;
  const description =
    product.product_name_fr || product.product_name || product.generic_name_fr || product.generic_name;

  if (!description) {
    return null;
  }

  return {
    brand: product.brands || "Marque inconnue",
    description,
    imageUrl: product.image_front_url || product.image_url || "",
    source: "OpenFoodFacts",
  };
}

async function lookupUpcItemDb(ean: string): Promise<EanSuggestion | null> {
  const response = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${ean}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  const firstItem = data?.items?.[0];

  if (!firstItem?.title) {
    return null;
  }

  return {
    brand: firstItem.brand || "Marque inconnue",
    description: firstItem.title,
    imageUrl: firstItem.images?.[0] || "",
    source: "UPCItemDB",
  };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const ean = String(searchParams.get("ean") || "").trim();

  if (!/^\d{8,14}$/.test(ean)) {
    return NextResponse.json({ error: "EAN invalide" }, { status: 400 });
  }

  try {
    const openFood = await lookupOpenFoodFacts(ean);

    if (openFood) {
      return NextResponse.json({ found: true, suggestion: openFood });
    }

    const upc = await lookupUpcItemDb(ean);

    if (upc) {
      return NextResponse.json({ found: true, suggestion: upc });
    }

    return NextResponse.json({ found: false, suggestion: null });
  } catch {
    return NextResponse.json({ found: false, suggestion: null });
  }
}
