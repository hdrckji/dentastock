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

  const maxCategoryStock = useMemo(
    () => Math.max(...categories.map((category) => category.totalStock), 1),
    [categories]
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
      <section className="stock-hero-grid">
        <article className="stock-focus card card-highlight">
          <p className="kicker">Pilotage stock</p>
          <p className="metric metric-big">{totalStock}</p>
          <p className="muted">unites disponibles en temps reel</p>
          <div className="stock-focus-pills">
            <span>{products.length} articles</span>
            <span>{categories.length} categories</span>
            <span>{suggestions.length} commandes conseillees</span>
          </div>
        </article>

        <article className="card stock-alert-card">
          <p className="kicker">Alerte immediate</p>
          <p className="metric">{lowStockCount}</p>
          <p className="muted">references sous le minimum</p>
        </article>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <article className="panel">
          <h2>Mur du stock critique</h2>
          <p className="muted">Lecture rapide des references a traiter en priorite.</p>
          <div className="stock-grid mt-4">
            {lowStockProducts.map((item) => {
              const gap = item.minimumStock - item.currentStock;
              return (
                <article key={item.id} className="stock-card-danger">
                  <header>
                    <p>{item.categoryName}</p>
                    <strong>{item.brand}</strong>
                  </header>
                  <p>{item.description}</p>
                  <div className="stock-inline-stats">
                    <span>Stock: {item.currentStock}</span>
                    <span>Mini: {item.minimumStock}</span>
                    <span>Manque: {gap}</span>
                  </div>
                </article>
              );
            })}
            {lowStockProducts.length === 0 ? (
              <article className="stock-card-ok">
                <strong>Tout est sous controle</strong>
                <p>Aucun produit n&apos;est sous le stock minimum actuellement.</p>
              </article>
            ) : null}
          </div>
        </article>

        <article className="panel">
          <h2>Radar categories</h2>
          <p className="muted">Repere visuel de la densite de stock par categorie.</p>
          <div className="category-radar mt-4">
            {categories.map((category) => (
              <div key={category.id} className="category-radar-row">
                <div className="category-radar-head">
                  <span>{category.name}</span>
                  <small>
                    {category.totalStock} unites / {category.productCount} refs
                  </small>
                </div>
                <div className="category-radar-track">
                  <div
                    className="category-radar-bar"
                    style={{ width: `${Math.max((category.totalStock / maxCategoryStock) * 100, 5)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <article className="panel panel-ean">
          <h2>Creation article guidee par EAN</h2>
          <p className="muted">
            Etape 1: entre le code EAN. Etape 2: recupere une suggestion web. Etape 3: valide et ajoute.
          </p>

          <div className="ean-row mt-5">
            <input
              value={ean}
              onChange={(event) => setEan(event.target.value)}
              placeholder="EAN (8 a 14 chiffres)"
              required
            />
            <button type="button" onClick={lookupEan} disabled={lookingUpEan}>
              {lookingUpEan ? "Recherche en cours..." : "Recuperer une suggestion"}
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

            {imageUrl ? (
              <div className="image-preview">
                <img src={imageUrl} alt="Apercu produit" />
              </div>
            ) : null}

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
              {creatingProduct ? "Creation..." : "Ajouter au stock"}
            </button>
          </form>
        </article>

        <article className="panel">
          <h2>Commande conseillee</h2>
          <p className="muted">Synthese rapide des besoins de reapprovisionnement.</p>
          <div className="suggestion-list mt-4">
            {suggestions.slice(0, 8).map((item) => (
              <div key={item.productId} className="suggestion-item">
                <div>
                  <strong>{item.brand}</strong>
                  <p>{item.description}</p>
                </div>
                <span>{item.suggestedQuantity}</span>
              </div>
            ))}
            {suggestions.length === 0 ? <p className="muted">Aucun reappro conseille pour le moment.</p> : null}
          </div>
        </article>
      </section>

      <details className="panel panel-muted">
        <summary>Reglages admin de suggestion</summary>
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
