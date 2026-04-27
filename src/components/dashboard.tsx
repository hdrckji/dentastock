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
  categoryName: string;
};

type CategorySummary = {
  id: string;
  name: string;
  productCount: number;
  totalStock: number;
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
  categories: CategorySummary[];
  suggestions: Suggestion[];
  config: {
    reorderMode: ReorderMode;
    advancedForecastHorizon: number;
    safetyDays: number;
  };
};

export function Dashboard({ products, categories, suggestions, config }: DashboardProps) {
  const [savingConfig, setSavingConfig] = useState(false);
  const [creatingProduct, setCreatingProduct] = useState(false);
  const [lookingUpEan, setLookingUpEan] = useState(false);
  const [mode, setMode] = useState<ReorderMode>(config.reorderMode);
  const [horizon, setHorizon] = useState<number>(config.advancedForecastHorizon);
  const [safetyDays, setSafetyDays] = useState<number>(config.safetyDays);
  const [ean, setEan] = useState("");
  const [brand, setBrand] = useState("");
  const [description, setDescription] = useState("");
  const [minimumStock, setMinimumStock] = useState<number>(0);
  const [imageUrl, setImageUrl] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [message, setMessage] = useState<string>("");

  const lowStockCount = useMemo(
    () => products.filter((product) => product.currentStock < product.minimumStock).length,
    [products]
  );

  const totalStock = useMemo(
    () => products.reduce((sum, product) => sum + product.currentStock, 0),
    [products]
  );

  const lowStockProducts = useMemo(
    () => products.filter((product) => product.currentStock < product.minimumStock),
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

    setMessage("Configuration admin enregistree. Recharge la page pour actualiser les calculs.");
  }

  async function lookupEan() {
    if (!/^\d{8,14}$/.test(ean.trim())) {
      setMessage("EAN invalide. Renseigne 8 a 14 chiffres.");
      return;
    }

    setLookingUpEan(true);
    setMessage("");

    const response = await fetch(`/api/ean-lookup?ean=${encodeURIComponent(ean.trim())}`);

    setLookingUpEan(false);

    if (!response.ok) {
      setMessage("Recherche web impossible pour cet EAN.");
      return;
    }

    const data = await response.json();

    if (!data.found || !data.suggestion) {
      setMessage("Aucune suggestion trouvee. Tu peux completer les champs manuellement.");
      return;
    }

    if (!brand) {
      setBrand(data.suggestion.brand || "");
    }

    if (!description) {
      setDescription(data.suggestion.description || "");
    }

    if (!imageUrl) {
      setImageUrl(data.suggestion.imageUrl || "");
    }

    setMessage(`Suggestion chargee depuis ${data.suggestion.source}.`);
  }

  async function createProduct() {
    setCreatingProduct(true);
    setMessage("");

    const payload = {
      ean: ean.trim(),
      brand: brand.trim(),
      description: description.trim(),
      minimumStock,
      imageUrl: imageUrl.trim(),
      categoryId: categoryId || undefined,
      categoryName: newCategoryName.trim() || undefined,
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

    setMessage("Article cree. Recharge la page pour voir le stock mis a jour.");
    setEan("");
    setBrand("");
    setDescription("");
    setMinimumStock(0);
    setImageUrl("");
    setNewCategoryName("");
  }

  return (
    <div className="space-y-8">
      <section className="grid gap-4 sm:grid-cols-3">
        <article className="card">
          <p className="kicker">Stock total</p>
          <p className="metric">{totalStock}</p>
          <p className="muted">unites disponibles</p>
        </article>
        <article className="card">
          <p className="kicker">Alertes stock</p>
          <p className="metric">{lowStockCount}</p>
          <p className="muted">sous stock minimum</p>
        </article>
        <article className="card">
          <p className="kicker">References</p>
          <p className="metric">{products.length}</p>
          <p className="muted">articles actifs</p>
        </article>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <article className="panel">
          <h2>Stock critique a traiter</h2>
          <p className="muted">Vue prioritaire des references sous leur stock minimum.</p>
          <div className="table-wrap mt-4">
            <table>
              <thead>
                <tr>
                  <th>Produit</th>
                  <th>Categorie</th>
                  <th>Stock</th>
                  <th>Mini</th>
                </tr>
              </thead>
              <tbody>
                {lowStockProducts.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.brand}</strong>
                      <span>{item.description}</span>
                    </td>
                    <td>{item.categoryName}</td>
                    <td>{item.currentStock}</td>
                    <td>{item.minimumStock}</td>
                  </tr>
                ))}
                {lowStockProducts.length === 0 ? (
                  <tr>
                    <td colSpan={4}>Aucun produit en alerte actuellement.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </article>

        <article className="panel">
          <h2>Stock par categorie</h2>
          <p className="muted">Pour retrouver plus facilement les references.</p>
          <div className="table-wrap mt-4">
            <table>
              <thead>
                <tr>
                  <th>Categorie</th>
                  <th>Articles</th>
                  <th>Stock</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((category) => (
                  <tr key={category.id}>
                    <td>{category.name}</td>
                    <td>{category.productCount}</td>
                    <td>{category.totalStock}</td>
                  </tr>
                ))}
                {categories.length === 0 ? (
                  <tr>
                    <td colSpan={3}>Aucune categorie disponible.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </article>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <article className="panel">
          <h2>Creer un article (EAN d&apos;abord)</h2>
          <p className="muted">
            Commence par l&apos;EAN puis lance la suggestion web pour pre-remplir marque, description et photo.
          </p>

          <div className="ean-row mt-5">
            <input
              value={ean}
              onChange={(event) => setEan(event.target.value)}
              placeholder="EAN (8 a 14 chiffres)"
              required
            />
            <button type="button" onClick={lookupEan} disabled={lookingUpEan}>
              {lookingUpEan ? "Recherche..." : "Proposer via EAN"}
            </button>
          </div>

          <form
            className="mt-4 grid gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              createProduct();
            }}
          >
            <input value={brand} onChange={(event) => setBrand(event.target.value)} placeholder="Marque" required />
            <input
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Description produit"
              required
            />
            <input
              value={minimumStock}
              onChange={(event) => setMinimumStock(Number(event.target.value))}
              type="number"
              min={0}
              placeholder="Stock minimum"
              required
            />
            <input
              value={imageUrl}
              onChange={(event) => setImageUrl(event.target.value)}
              placeholder="URL image (optionnel)"
            />

            <label>
              Categorie existante
              <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
                <option value="">Selectionner une categorie</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>

            <input
              value={newCategoryName}
              onChange={(event) => setNewCategoryName(event.target.value)}
              placeholder="Ou creer une nouvelle categorie"
            />

            <button type="submit" disabled={creatingProduct}>
              {creatingProduct ? "Creation..." : "Ajouter l&apos;article"}
            </button>
          </form>
        </article>

        <article className="panel">
          <h2>Propositions de commande</h2>
          <p className="muted">Articles proposes a l&apos;achat selon le mode actif.</p>
          <p className="metric mt-3">{suggestions.length}</p>
          <p className="muted">produits a recommander</p>
        </article>
      </section>

      <details className="panel panel-muted">
        <summary>Administration du mode de suggestion</summary>
        <div className="mt-4 grid gap-3">
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
      </details>

      {message ? <p className="notice">{message}</p> : null}
    </div>
  );
}
