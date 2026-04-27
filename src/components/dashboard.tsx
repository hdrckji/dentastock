"use client";

import { useMemo, useState } from "react";
import { ReorderMode } from "@/generated/prisma/enums";

type ProductSummary = {
  id: string;
  brand: string;
  description: string;
  ean: string;
  minimumStock: number;
  currentStock: number;
};

type Suggestion = {
  productId: string;
  ean: string;
  description: string;
  brand: string;
  minimumStock: number;
  currentStock: number;
  suggestedQuantity: number;
  mode: ReorderMode;
  supplierLeadTimeDays: number;
};

type DashboardProps = {
  products: ProductSummary[];
  suggestions: Suggestion[];
  config: {
    reorderMode: ReorderMode;
    advancedForecastHorizon: number;
    safetyDays: number;
  };
};

export function Dashboard({ products, suggestions, config }: DashboardProps) {
  const [savingConfig, setSavingConfig] = useState(false);
  const [creatingProduct, setCreatingProduct] = useState(false);
  const [mode, setMode] = useState<ReorderMode>(config.reorderMode);
  const [horizon, setHorizon] = useState<number>(config.advancedForecastHorizon);
  const [safetyDays, setSafetyDays] = useState<number>(config.safetyDays);
  const [message, setMessage] = useState<string>("");

  const lowStockCount = useMemo(
    () => products.filter((product) => product.currentStock < product.minimumStock).length,
    [products]
  );

  async function saveConfig() {
    setSavingConfig(true);
    setMessage("");

    const response = await fetch("/api/admin/reorder-mode", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        reorderMode: mode,
        advancedForecastHorizon: horizon,
        safetyDays,
      }),
    });

    setSavingConfig(false);

    if (!response.ok) {
      setMessage("Erreur lors de la sauvegarde du mode de proposition.");
      return;
    }

    setMessage("Configuration admin enregistrée. Recharge la page pour voir les nouveaux calculs.");
  }

  async function createProduct(formData: FormData) {
    setCreatingProduct(true);
    setMessage("");

    const payload = {
      brand: String(formData.get("brand") || ""),
      description: String(formData.get("description") || ""),
      ean: String(formData.get("ean") || ""),
      minimumStock: Number(formData.get("minimumStock") || 0),
      imageUrl: String(formData.get("imageUrl") || ""),
    };

    const response = await fetch("/api/products", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    setCreatingProduct(false);

    if (!response.ok) {
      setMessage("Creation produit impossible. Verifie EAN et champs obligatoires.");
      return;
    }

    setMessage("Produit cree. Recharge la page pour actualiser la liste.");
  }

  return (
    <div className="space-y-8">
      <section className="grid gap-4 sm:grid-cols-3">
        <article className="card">
          <p className="kicker">References</p>
          <p className="metric">{products.length}</p>
          <p className="muted">produits catalogues</p>
        </article>
        <article className="card">
          <p className="kicker">Tension stock</p>
          <p className="metric">{lowStockCount}</p>
          <p className="muted">sous stock minimum</p>
        </article>
        <article className="card">
          <p className="kicker">Propositions</p>
          <p className="metric">{suggestions.length}</p>
          <p className="muted">commandes suggerees</p>
        </article>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <article className="panel">
          <h2>Encoder une nouvelle reference</h2>
          <p className="muted">Marque, description, EAN, photo et stock minimum.</p>
          <form
            className="mt-5 grid gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              createProduct(new FormData(event.currentTarget));
            }}
          >
            <input name="brand" placeholder="Marque" required />
            <input name="description" placeholder="Description produit" required />
            <input name="ean" placeholder="EAN (8 a 14 chiffres)" required />
            <input name="minimumStock" type="number" min={0} placeholder="Stock minimum" required />
            <input name="imageUrl" placeholder="URL image (optionnel)" />
            <button type="submit" disabled={creatingProduct}>
              {creatingProduct ? "Creation..." : "Ajouter le produit"}
            </button>
          </form>
        </article>

        <article className="panel">
          <h2>Admin: mode de suggestion</h2>
          <p className="muted">Basculer entre logique simple et avancee.</p>
          <div className="mt-5 grid gap-3">
            <label>
              Mode
              <select value={mode} onChange={(event) => setMode(event.target.value as ReorderMode)}>
                <option value={ReorderMode.SIMPLE}>Simple (stock actuel &lt; stock mini)</option>
                <option value={ReorderMode.ADVANCED}>Avance (conso + delai fournisseur)</option>
              </select>
            </label>
            <label>
              Horizon conso (jours)
              <input
                type="number"
                min={7}
                max={180}
                value={horizon}
                onChange={(event) => setHorizon(Number(event.target.value))}
              />
            </label>
            <label>
              Jours de securite
              <input
                type="number"
                min={0}
                max={60}
                value={safetyDays}
                onChange={(event) => setSafetyDays(Number(event.target.value))}
              />
            </label>
            <button type="button" onClick={saveConfig} disabled={savingConfig}>
              {savingConfig ? "Sauvegarde..." : "Enregistrer"}
            </button>
          </div>
        </article>
      </section>

      <section className="panel">
        <h2>Propositions de commande</h2>
        <p className="muted">Regroupe les produits dont le stock est insuffisant.</p>
        <div className="table-wrap mt-4">
          <table>
            <thead>
              <tr>
                <th>Produit</th>
                <th>EAN</th>
                <th>Stock</th>
                <th>Mini cible</th>
                <th>A commander</th>
              </tr>
            </thead>
            <tbody>
              {suggestions.map((item) => (
                <tr key={item.productId}>
                  <td>
                    <strong>{item.brand}</strong>
                    <span>{item.description}</span>
                  </td>
                  <td>{item.ean}</td>
                  <td>{item.currentStock}</td>
                  <td>{item.minimumStock}</td>
                  <td>{item.suggestedQuantity}</td>
                </tr>
              ))}
              {suggestions.length === 0 ? (
                <tr>
                  <td colSpan={5}>Aucune suggestion pour le moment.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {message ? <p className="notice">{message}</p> : null}
    </div>
  );
}
