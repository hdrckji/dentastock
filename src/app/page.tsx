import { ReorderMode } from "@/generated/prisma/enums";
import { Dashboard } from "@/components/dashboard";
import { computeReorderSuggestions, getInventoryConfig } from "@/lib/reorder";
import { hasConfiguredDatabaseUrl, prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function Home() {
  let products: Array<{
    id: string;
    brand: string;
    description: string;
    ean: string;
    minimumStock: number;
    lots: Array<{
      quantityOnHand: number;
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
      [products, config, suggestions] = await Promise.all([
        prisma.product.findMany({
          include: { lots: true },
          orderBy: { createdAt: "desc" },
        }),
        getInventoryConfig(),
        computeReorderSuggestions(),
      ]);
    } catch {
      products = [];
      suggestions = [];
    }
  }

  const productSummaries = products.map((product) => ({
    id: product.id,
    brand: product.brand,
    description: product.description,
    ean: product.ean,
    minimumStock: product.minimumStock,
    currentStock: product.lots.reduce((sum, lot) => sum + lot.quantityOnHand, 0),
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
