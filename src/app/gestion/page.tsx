import { ReorderMode } from "@/generated/prisma/enums";
import { Gestion } from "@/components/gestion";
import { getInventoryConfig } from "@/lib/reorder";
import { Nav } from "@/components/nav";
import { hasConfiguredDatabaseUrl, prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function GestionPage() {
  let categories: Array<{ id: string; name: string }> = [];
  let config = {
    reorderMode: ReorderMode.SIMPLE as ReorderMode,
    advancedForecastHorizon: 30,
    safetyDays: 7,
  };

  if (hasConfiguredDatabaseUrl) {
    try {
      [categories, config] = await Promise.all([
        prisma.category.findMany({ orderBy: { name: "asc" } }),
        getInventoryConfig(),
      ]);
    } catch {
      categories = [];
    }
  }

  return (
    <div className="page-shell">
      <header className="hero">
        <p className="eyebrow">Gestion &amp; Administration</p>
        <h1>DentaStock</h1>
        <p>Ajoute de nouveaux articles et configure les propositions de commande.</p>
      </header>

        <Nav />

      <Gestion categories={categories} config={config} />
    </div>
  );
}
