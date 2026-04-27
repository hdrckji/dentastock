import { NextResponse } from "next/server";

type EanSuggestion = {
  brand: string;
  description: string;
  imageUrl: string;
  source: string;
};

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

async function lookupSerpApi(ean: string): Promise<EanSuggestion | null> {
  const apiKey = process.env.SERPAPI_KEY;

  if (!apiKey) {
    return null;
  }

  const endpoints = [
    `https://serpapi.com/search.json?engine=google_shopping&q=${encodeURIComponent(ean)}&hl=fr&gl=fr&api_key=${encodeURIComponent(apiKey)}`,
    `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(ean)}&hl=fr&gl=fr&api_key=${encodeURIComponent(apiKey)}`,
  ];

  for (const url of endpoints) {
    const response = await fetch(url, { cache: "no-store" });

    if (!response.ok) {
      continue;
    }

    const data = await response.json();

    const shoppingItem = data?.shopping_results?.[0];
    if (shoppingItem?.title) {
      return {
        brand: normalizeText(shoppingItem.source) || "Marque inconnue",
        description: normalizeText(shoppingItem.title),
        imageUrl: normalizeText(shoppingItem.thumbnail),
        source: "Google Shopping (SerpAPI)",
      };
    }

    const webItem = data?.organic_results?.[0];
    const title = normalizeText(webItem?.title);
    const snippet = normalizeText(webItem?.snippet);
    if (title) {
      return {
        brand: "Marque inconnue",
        description: snippet ? `${title} - ${snippet}` : title,
        imageUrl: "",
        source: "Google Web (SerpAPI)",
      };
    }
  }

  return null;
}

async function lookupOpenFactsProduct(
  ean: string,
  baseUrl: string,
  source: string
): Promise<EanSuggestion | null> {
  const response = await fetch(`${baseUrl}/api/v2/product/${ean}.json`, {
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
    source,
  };
}

async function lookupOpenFacts(ean: string): Promise<EanSuggestion | null> {
  const providers = [
    { baseUrl: "https://world.openfoodfacts.org", source: "OpenFoodFacts" },
    { baseUrl: "https://world.openbeautyfacts.org", source: "OpenBeautyFacts" },
    { baseUrl: "https://world.openproductsfacts.org", source: "OpenProductsFacts" },
    { baseUrl: "https://world.openpetfoodfacts.org", source: "OpenPetFoodFacts" },
  ];

  for (const provider of providers) {
    const suggestion = await lookupOpenFactsProduct(ean, provider.baseUrl, provider.source);
    if (suggestion) {
      return suggestion;
    }
  }

  return null;
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
    const openFacts = await lookupOpenFacts(ean);

    if (openFacts) {
      return NextResponse.json({ found: true, suggestion: openFacts });
    }

    const upc = await lookupUpcItemDb(ean);

    if (upc) {
      return NextResponse.json({ found: true, suggestion: upc });
    }

    const serp = await lookupSerpApi(ean);

    if (serp) {
      return NextResponse.json({ found: true, suggestion: serp });
    }

    return NextResponse.json({ found: false, suggestion: null });
  } catch {
    return NextResponse.json({ found: false, suggestion: null });
  }
}
