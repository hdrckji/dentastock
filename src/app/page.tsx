import { ReorderMode } from "@/generated/prisma/enums";
import { Dashboard } from "@/components/dashboard";
import { computeReorderSuggestions } from "@/lib/reorder";
import { Nav } from "@/components/nav";
import { hasConfiguredDatabaseUrl, prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const defaultDentalCategories = [
  "Gants",
  "Lingettes",
  "Anesthesie",
  "Protheses",
  "Consommables",
  "Endo",
  "Obturation",
  "Extraction",
  "Contention",
  "Sterilisation",
  "Implant & couronne",
  "Soins enfant",
  "Instruments",
  "Pansement",
  "Fonds de cavite",
  "Autres",
  "Echantillons",
  "Materiel de bureau",
];

export default async function Home() {
  let products: Array<{
    id: string;
    brand: string;
    description: string;
    ean: string;
    minimumStock: number;
    imageUrl: string | null;
    categoryId: string | null;
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
  let suggestions: Awaited<ReturnType<typeof computeReorderSuggestions>> = [];

  if (hasConfiguredDatabaseUrl) {
    try {
      await prisma.category.createMany({
        data: defaultDentalCategories.map((name) => ({ name })),
        skipDuplicates: true,
      });

      [products, categories, suggestions] = await Promise.all([
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
    imageUrl: product.imageUrl,
    categoryId: product.categoryId,
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

        <Nav />

      <Dashboard
        products={productSummaries}
        categories={categorySummaries}
        suggestions={suggestions}
      />
    </div>
  );
}
