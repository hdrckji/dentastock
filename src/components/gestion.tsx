"use client";

import { useState } from "react";
import { ReorderMode } from "@/generated/prisma/enums";

type CategorySummary = {
  id: string;
  name: string;
};

type GestionProps = {
  categories: CategorySummary[];
  config: {
    reorderMode: ReorderMode;
    advancedForecastHorizon: number;
    safetyDays: number;
  };
};

export function Gestion({ categories, config }: GestionProps) {
  const [message, setMessage] = useState<string>("");

  // ── Création article ─────────────────────────────────────────────
  const [creatingProduct, setCreatingProduct] = useState(false);
  const [lookingUpEan, setLookingUpEan] = useState(false);
  const [ean, setEan] = useState("");
  const [brand, setBrand] = useState("");
  const [description, setDescription] = useState("");
  const [minimumStock, setMinimumStock] = useState<number>(0);
  const [imageUrl, setImageUrl] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");

  // ── Admin ────────────────────────────────────────────────────────
  const [savingConfig, setSavingConfig] = useState(false);
  const [mode, setMode] = useState<ReorderMode>(config.reorderMode);
  const [horizon, setHorizon] = useState<number>(config.advancedForecastHorizon);
  const [safetyDays, setSafetyDays] = useState<number>(config.safetyDays);

  async function lookupEan() {
    if (!/^\d{8,14}$/.test(ean.trim())) {
      setMessage("EAN invalide. Renseigne 8 à 14 chiffres.");
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
      setMessage("Aucune suggestion trouvée. Tu peux compléter les champs manuellement.");
      return;
    }
    if (!brand) setBrand(data.suggestion.brand || "");
    if (!description) setDescription(data.suggestion.description || "");
    if (!imageUrl) setImageUrl(data.suggestion.imageUrl || "");
    setMessage(`Suggestion chargée depuis ${data.suggestion.source}.`);
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
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setCreatingProduct(false);
    if (!response.ok) {
      setMessage("Création produit impossible. Vérifie EAN et champs obligatoires.");
      return;
    }
    setMessage("Article créé ! Retourne sur Stock & Catalogue pour le voir.");
    setEan("");
    setBrand("");
    setDescription("");
    setMinimumStock(0);
    setImageUrl("");
    setCategoryId("");
    setNewCategoryName("");
  }

  async function saveConfig() {
    setSavingConfig(true);
    setMessage("");
    const response = await fetch("/api/admin/reorder-mode", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reorderMode: mode, advancedForecastHorizon: horizon, safetyDays }),
    });
    setSavingConfig(false);
    if (!response.ok) {
      setMessage("Erreur lors de la sauvegarde du mode de proposition.");
      return;
    }
    setMessage("Configuration admin enregistrée.");
  }

  return (
    <div className="space-y-8">
      {/* ── Création article ──────────────────────────────────── */}
      <section className="panel panel-ean">
        <h2>➕ Ajouter un article</h2>
        <p className="muted">
          Étape 1 : entre le code EAN. Étape 2 : récupère une suggestion web. Étape 3 : valide et
          ajoute.
        </p>

        <div className="ean-row mt-5">
          <input
            value={ean}
            onChange={(e) => setEan(e.target.value)}
            placeholder="EAN (8 à 14 chiffres)"
          />
          <button type="button" onClick={lookupEan} disabled={lookingUpEan}>
            {lookingUpEan ? "Recherche…" : "Récupérer une suggestion"}
          </button>
        </div>

        <form
          className="mt-4 grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            createProduct();
          }}
        >
          <input
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            placeholder="Marque"
            required
          />
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description produit"
            required
          />
          <input
            value={minimumStock}
            onChange={(e) => setMinimumStock(Number(e.target.value))}
            type="number"
            min={0}
            placeholder="Stock minimum"
            required
          />
          <input
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="URL image (optionnel)"
          />

          {imageUrl && (
            <div className="image-preview">
              <img src={imageUrl} alt="Aperçu produit" />
            </div>
          )}

          <label>
            Catégorie existante
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">Sélectionner une catégorie</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          <input
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            placeholder="Ou créer une nouvelle catégorie"
          />

          <button type="submit" disabled={creatingProduct}>
            {creatingProduct ? "Création…" : "Ajouter au stock"}
          </button>
        </form>
      </section>

      {/* ── Réglages admin ────────────────────────────────────── */}
      <section className="panel panel-muted">
        <h2>⚙️ Réglages admin — suggestions de commande</h2>
        <p className="muted">
          Choisis comment les propositions de réapprovisionnement sont calculées.
        </p>
        <div className="mt-4 grid gap-3">
          <label>
            Mode
            <select value={mode} onChange={(e) => setMode(e.target.value as ReorderMode)}>
              <option value={ReorderMode.SIMPLE}>Simple (stock actuel &lt; stock mini)</option>
              <option value={ReorderMode.ADVANCED}>Avancé (conso + délai fournisseur)</option>
            </select>
          </label>
          <label>
            Horizon conso (jours)
            <input
              type="number"
              min={7}
              max={180}
              value={horizon}
              onChange={(e) => setHorizon(Number(e.target.value))}
            />
          </label>
          <label>
            Jours de sécurité
            <input
              type="number"
              min={0}
              max={60}
              value={safetyDays}
              onChange={(e) => setSafetyDays(Number(e.target.value))}
            />
          </label>
          <button type="button" onClick={saveConfig} disabled={savingConfig}>
            {savingConfig ? "Sauvegarde…" : "Enregistrer"}
          </button>
        </div>
      </section>

      {message && <p className="notice">{message}</p>}
    </div>
  );
}
