import { ReorderMode } from "@/generated/prisma/enums";
import { Dashboard } from "@/components/dashboard";
import { computeReorderSuggestions, getInventoryConfig } from "@/lib/reorder";
import { hasConfiguredDatabaseUrl, prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const defaultDentalCategories = [
  "Anesthesie",
  "Sterilisation",
  "Endodontie",
  "Implantologie",
  "Hygiene et prevention",
  "Consommables",
  "Radiologie",
  "Urgences",
];

export default async function Home() {
  let products: Array<{
    id: string;
    brand: string;
    description: string;
    ean: string;
    minimumStock: number;
    category: {
      name: string;
    } | null;
    lots: Array<{
      quantityOnHand: number;
    }>;
  }> = [];
  let categories: Array<{
    id: string;
    name: string;
    products: Array<{
      lots: Array<{
        quantityOnHand: number;
      }>;
    }>;
  }> = [];
  let config: {
    reorderMode: ReorderMode;
    advancedForecastHorizon: number;
    safetyDays: number;
  } = {
    reorderMode: ReorderMode.SIMPLE,
    advancedForecastHorizon: 30,
    safetyDays: 7,
  };
  let suggestions: Awaited<ReturnType<typeof computeReorderSuggestions>> = [];

  if (hasConfiguredDatabaseUrl) {
    try {
      const existingCategoryCount = await prisma.category.count();

      if (existingCategoryCount === 0) {
        await prisma.category.createMany({
          data: defaultDentalCategories.map((name) => ({ name })),
          skipDuplicates: true,
        });
      }

      [products, categories, config, suggestions] = await Promise.all([
        prisma.product.findMany({
          include: {
            lots: true,
            category: true,
          },
          orderBy: { createdAt: "desc" },
        }),
        prisma.category.findMany({
          include: {
            products: {
              include: {
                lots: true,
              },
            },
          },
          orderBy: {
            name: "asc",
          },
        }),
        getInventoryConfig(),
        computeReorderSuggestions(),
      ]);
    } catch {
      products = [];
      categories = [];
      suggestions = [];
    }
  }

  const productSummaries = products.map((product) => ({
    id: product.id,
    brand: product.brand,
    description: product.description,
    ean: product.ean,
    minimumStock: product.minimumStock,
    categoryName: product.category?.name || "Sans categorie",
    currentStock: product.lots.reduce((sum, lot) => sum + lot.quantityOnHand, 0),
  }));

  const categorySummaries = categories.map((category) => ({
    id: category.id,
    name: category.name,
    productCount: category.products.length,
    totalStock: category.products.reduce(
      (categorySum, product) =>
        categorySum + product.lots.reduce((productSum, lot) => productSum + lot.quantityOnHand, 0),
      0
    ),
  }));

  return (
    <div className="page-shell">
      <header className="hero">
        <p className="eyebrow">Cabinet Dentaire</p>
        <h1>DentaStock</h1>
        <p>
          Suivi des entrees/sorties, gestion des lots et propositions de commandes intelligentes pour
          ton cabinet.
        </p>
      </header>

      <Dashboard
        products={productSummaries}
        categories={categorySummaries}
        suggestions={suggestions}
        config={{
          reorderMode: config.reorderMode,
          advancedForecastHorizon: config.advancedForecastHorizon,
          safetyDays: config.safetyDays,
        }}
      />
    </div>
  );
}
