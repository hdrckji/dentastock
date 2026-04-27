"use client";

import { useMemo, useState, useCallback } from "react";
import { ReorderMode } from "@/generated/prisma/enums";

type ProductSummary = {
  id: string;
  brand: string;
  description: string;
  ean: string;
  minimumStock: number;
  currentStock: number;
  categoryName: string;
  categoryId: string | null;
  imageUrl?: string | null;
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
};

export function Dashboard({ products, categories, suggestions }: DashboardProps) {
  const [message, setMessage] = useState<string>("");
  const [localProducts, setLocalProducts] = useState<ProductSummary[]>(products);

  const lowStockProducts = useMemo(
    () => localProducts.filter((p) => p.currentStock < p.minimumStock),
    [localProducts]
  );

  const maxCategoryStock = useMemo(
    () => Math.max(...categories.map((c) => c.totalStock), 1),
    [categories]
  );

  // ── Catalogue state ──────────────────────────────────────────────
  const [catalogFilter, setCatalogFilter] = useState<string>("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBrand, setEditBrand] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editMinStock, setEditMinStock] = useState(0);
  const [editCategoryId, setEditCategoryId] = useState<string>("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [movementProductId, setMovementProductId] = useState<string | null>(null);
  const [movementType, setMovementType] = useState<"IN" | "OUT">("IN");
  const [movementQty, setMovementQty] = useState(1);
  const [movementReason, setMovementReason] = useState("");
  const [savingMovement, setSavingMovement] = useState(false);
  const [quickMovementProductId, setQuickMovementProductId] = useState<string>("");
  const [quickMovementEanQuery, setQuickMovementEanQuery] = useState("");
  const [quickMovementType, setQuickMovementType] = useState<"IN" | "OUT">("IN");
  const [quickMovementQty, setQuickMovementQty] = useState(1);
  const [quickMovementReason, setQuickMovementReason] = useState("");
  const [savingQuickMovement, setSavingQuickMovement] = useState(false);

  const quickFilteredProducts = useMemo(() => {
    const query = quickMovementEanQuery.trim();
    if (!query) {
      return localProducts;
    }

    const lower = query.toLowerCase();
    return localProducts.filter(
      (product) =>
        product.ean.includes(query) ||
        product.brand.toLowerCase().includes(lower) ||
        product.description.toLowerCase().includes(lower)
    );
  }, [localProducts, quickMovementEanQuery]);

  const filteredProducts = useMemo(
    () =>
      catalogFilter === "all"
        ? localProducts
        : localProducts.filter(
            (p) => p.categoryId === catalogFilter || p.categoryName === catalogFilter
          ),
    [localProducts, catalogFilter]
  );

  const groupedByCategory = useMemo(() => {
    const groups = new Map<string, ProductSummary[]>();
    for (const p of filteredProducts) {
      const key = p.categoryName || "Sans catégorie";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(p);
    }
    return groups;
  }, [filteredProducts]);

  const startEdit = useCallback((p: ProductSummary) => {
    setEditingId(p.id);
    setEditBrand(p.brand);
    setEditDescription(p.description);
    setEditMinStock(p.minimumStock);
    setEditCategoryId(p.categoryId ?? "");
    setMovementProductId(null);
  }, []);

  const cancelEdit = useCallback(() => setEditingId(null), []);

  async function saveEdit(id: string) {
    setSavingEdit(true);
    const res = await fetch(`/api/products/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        brand: editBrand,
        description: editDescription,
        minimumStock: editMinStock,
        categoryId: editCategoryId || null,
      }),
    });
    setSavingEdit(false);
    if (!res.ok) {
      setMessage("Erreur lors de la modification du produit.");
      return;
    }
    setLocalProducts((prev) =>
      prev.map((p) =>
        p.id === id
          ? {
              ...p,
              brand: editBrand,
              description: editDescription,
              minimumStock: editMinStock,
              categoryId: editCategoryId || null,
              categoryName:
                categories.find((c) => c.id === editCategoryId)?.name ?? p.categoryName,
            }
          : p
      )
    );
    setEditingId(null);
    setMessage("Produit mis à jour.");
  }

  const startMovement = useCallback((id: string) => {
    setMovementProductId(id);
    setMovementType("IN");
    setMovementQty(1);
    setMovementReason("");
    setEditingId(null);
  }, []);

  const cancelMovement = useCallback(() => setMovementProductId(null), []);

  async function saveMovement() {
    if (!movementProductId) return;
    setSavingMovement(true);
    const res = await fetch("/api/movements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId: movementProductId,
        type: movementType,
        quantity: movementQty,
        reason: movementReason || undefined,
      }),
    });
    setSavingMovement(false);
    if (!res.ok) {
      setMessage("Erreur lors de l'enregistrement du mouvement.");
      return;
    }
    const delta = movementType === "IN" ? movementQty : -movementQty;
    setLocalProducts((prev) =>
      prev.map((p) =>
        p.id === movementProductId
          ? { ...p, currentStock: Math.max(0, p.currentStock + delta) }
          : p
      )
    );
    setMovementProductId(null);
    setMessage(`Mouvement ${movementType === "IN" ? "entrée" : "sortie"} enregistré.`);
  }

  async function saveQuickMovement() {
    if (!quickMovementProductId) {
      setMessage("Choisis un produit pour enregistrer le mouvement.");
      return;
    }

    setSavingQuickMovement(true);
    const res = await fetch("/api/movements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId: quickMovementProductId,
        type: quickMovementType,
        quantity: quickMovementQty,
        reason: quickMovementReason || undefined,
      }),
    });
    setSavingQuickMovement(false);

    if (!res.ok) {
      setMessage("Erreur lors de l'enregistrement du mouvement rapide.");
      return;
    }

    const delta = quickMovementType === "IN" ? quickMovementQty : -quickMovementQty;
    setLocalProducts((prev) =>
      prev.map((p) =>
        p.id === quickMovementProductId
          ? { ...p, currentStock: Math.max(0, p.currentStock + delta) }
          : p
      )
    );

    setQuickMovementQty(1);
    setQuickMovementReason("");
    setQuickMovementEanQuery("");
    setMessage(
      `Mouvement ${quickMovementType === "IN" ? "ajout en stock" : "retrait du stock"} enregistré.`
    );
  }

  return (
    <div className="space-y-8">
      <section className="panel quick-movement-panel">
        <h2>Stock rapide</h2>
        <p className="muted">Ajoute en stock ou retire du stock directement depuis le haut de page.</p>
        <div className="quick-movement-grid mt-4">
          <label>
            Recherche par EAN (scan)
            <input
              value={quickMovementEanQuery}
              onChange={(event) => {
                const value = event.target.value.replace(/\s+/g, "");
                setQuickMovementEanQuery(value);

                const exactMatch = localProducts.find((product) => product.ean === value);
                if (exactMatch) {
                  setQuickMovementProductId(exactMatch.id);
                }
              }}
              placeholder="Scanne ou tape le code EAN"
              inputMode="numeric"
            />
          </label>
          <label>
            Produit
            <select
              value={quickMovementProductId}
              onChange={(event) => setQuickMovementProductId(event.target.value)}
            >
              <option value="">Sélectionner un produit</option>
              {quickFilteredProducts.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.ean} - {product.brand} - {product.description}
                </option>
              ))}
            </select>
          </label>
          <label>
            Type de mouvement
            <select
              value={quickMovementType}
              onChange={(event) => setQuickMovementType(event.target.value as "IN" | "OUT")}
            >
              <option value="IN">Ajouter en stock</option>
              <option value="OUT">Retirer du stock</option>
            </select>
          </label>
          <label>
            Quantité
            <input
              type="number"
              min={1}
              value={quickMovementQty}
              onChange={(event) => setQuickMovementQty(Number(event.target.value))}
            />
          </label>
          <label>
            Motif (optionnel)
            <input
              value={quickMovementReason}
              onChange={(event) => setQuickMovementReason(event.target.value)}
              placeholder="Ex: livraison, usage cabinet"
            />
          </label>
        </div>
        <div className="quick-movement-actions mt-3">
          <button type="button" onClick={saveQuickMovement} disabled={savingQuickMovement}>
            {savingQuickMovement ? "Enregistrement..." : "Valider le mouvement"}
          </button>
          {quickMovementEanQuery && quickFilteredProducts.length === 0 ? (
            <p className="muted">Aucune référence trouvée pour cet EAN.</p>
          ) : null}
        </div>
      </section>

      {/* ── Catalogue en haut ─────────────────────────────────── */}
      <section className="panel">
        <h2>📦 Catalogue produits</h2>
        <p className="muted">
          Filtre par catégorie, modifie un article ou enregistre une entrée / sortie.
        </p>

        <div className="catalogue-filter-bar mt-4">
          <button
            type="button"
            className={`cat-pill${catalogFilter === "all" ? " cat-pill-active" : ""}`}
            onClick={() => setCatalogFilter("all")}
          >
            Toutes
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`cat-pill${catalogFilter === c.id ? " cat-pill-active" : ""}`}
              onClick={() => setCatalogFilter(c.id)}
            >
              {c.name}
            </button>
          ))}
        </div>

        {Array.from(groupedByCategory.entries()).map(([catName, prods]) => (
          <div key={catName} className="catalogue-group mt-5">
            <h3 className="catalogue-group-title">{catName}</h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Marque</th>
                    <th>Description</th>
                    <th>EAN</th>
                    <th>Stock actuel</th>
                    <th>Stock mini</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {prods.map((p) => (
                    <>
                      <tr
                        key={p.id}
                        className={p.currentStock < p.minimumStock ? "row-danger" : ""}
                      >
                        <td>
                          <strong>{p.brand}</strong>
                        </td>
                        <td>{p.description}</td>
                        <td>
                          <span>{p.ean}</span>
                        </td>
                        <td>
                          <span
                            className={
                              p.currentStock < p.minimumStock ? "badge-danger" : "badge-ok"
                            }
                          >
                            {p.currentStock}
                          </span>
                        </td>
                        <td>{p.minimumStock}</td>
                        <td>
                          <div className="action-btns">
                            <button
                              type="button"
                              className="btn-sm btn-edit"
                              onClick={() => startEdit(p)}
                            >
                              ✏️ Modifier
                            </button>
                            <button
                              type="button"
                              className="btn-sm btn-move"
                              onClick={() => startMovement(p.id)}
                            >
                              ↕️ Entrée / Sortie
                            </button>
                          </div>
                        </td>
                      </tr>

                      {editingId === p.id && (
                        <tr key={`edit-${p.id}`} className="edit-row">
                          <td colSpan={6}>
                            <div className="edit-panel">
                              <p className="kicker">Modifier le produit</p>
                              <div className="edit-grid">
                                <label>
                                  Marque
                                  <input
                                    value={editBrand}
                                    onChange={(e) => setEditBrand(e.target.value)}
                                  />
                                </label>
                                <label>
                                  Description
                                  <input
                                    value={editDescription}
                                    onChange={(e) => setEditDescription(e.target.value)}
                                  />
                                </label>
                                <label>
                                  Stock minimum
                                  <input
                                    type="number"
                                    min={0}
                                    value={editMinStock}
                                    onChange={(e) => setEditMinStock(Number(e.target.value))}
                                  />
                                </label>
                                <label>
                                  Catégorie
                                  <select
                                    value={editCategoryId}
                                    onChange={(e) => setEditCategoryId(e.target.value)}
                                  >
                                    <option value="">— Sans catégorie —</option>
                                    {categories.map((c) => (
                                      <option key={c.id} value={c.id}>
                                        {c.name}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                              </div>
                              <div className="action-btns mt-3">
                                <button
                                  type="button"
                                  onClick={() => saveEdit(p.id)}
                                  disabled={savingEdit}
                                >
                                  {savingEdit ? "Sauvegarde..." : "✅ Enregistrer"}
                                </button>
                                <button
                                  type="button"
                                  className="btn-cancel"
                                  onClick={cancelEdit}
                                >
                                  Annuler
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}

                      {movementProductId === p.id && (
                        <tr key={`mv-${p.id}`} className="edit-row">
                          <td colSpan={6}>
                            <div className="edit-panel">
                              <p className="kicker">Enregistrer un mouvement de stock</p>
                              <div className="edit-grid">
                                <label>
                                  Type
                                  <select
                                    value={movementType}
                                    onChange={(e) =>
                                      setMovementType(e.target.value as "IN" | "OUT")
                                    }
                                  >
                                    <option value="IN">Entrée</option>
                                    <option value="OUT">Sortie</option>
                                  </select>
                                </label>
                                <label>
                                  Quantité
                                  <input
                                    type="number"
                                    min={1}
                                    value={movementQty}
                                    onChange={(e) => setMovementQty(Number(e.target.value))}
                                  />
                                </label>
                                <label>
                                  Motif (optionnel)
                                  <input
                                    value={movementReason}
                                    onChange={(e) => setMovementReason(e.target.value)}
                                    placeholder="Ex : livraison fournisseur, utilisation patient…"
                                  />
                                </label>
                              </div>
                              <div className="action-btns mt-3">
                                <button
                                  type="button"
                                  onClick={saveMovement}
                                  disabled={savingMovement}
                                >
                                  {savingMovement
                                    ? "Enregistrement..."
                                    : "✅ Valider le mouvement"}
                                </button>
                                <button
                                  type="button"
                                  className="btn-cancel"
                                  onClick={cancelMovement}
                                >
                                  Annuler
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}

        {filteredProducts.length === 0 && (
          <p className="muted mt-4">Aucun produit dans cette catégorie.</p>
        )}
      </section>

      {/* ── Stock critique + Radar ───────────────────────────────── */}
      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <article className="panel">
          <h2>Mur du stock critique</h2>
          <p className="muted">Lecture rapide des références à traiter en priorité.</p>
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
                    <span>Stock : {item.currentStock}</span>
                    <span>Mini : {item.minimumStock}</span>
                    <span>Manque : {gap}</span>
                  </div>
                </article>
              );
            })}
            {lowStockProducts.length === 0 && (
              <article className="stock-card-ok">
                <strong>Tout est sous contrôle</strong>
                <p>Aucun produit n&apos;est sous le stock minimum actuellement.</p>
              </article>
            )}
          </div>
        </article>

        <article className="panel">
          <h2>Radar catégories</h2>
          <p className="muted">Repère visuel de la densité de stock par catégorie.</p>
          <div className="category-radar mt-4">
            {categories.map((category) => (
              <div key={category.id} className="category-radar-row">
                <div className="category-radar-head">
                  <span>{category.name}</span>
                  <small>
                    {category.totalStock} unités / {category.productCount} réfs
                  </small>
                </div>
                <div className="category-radar-track">
                  <div
                    className="category-radar-bar"
                    style={{
                      width: `${Math.max((category.totalStock / maxCategoryStock) * 100, 5)}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>

      {/* ── Commandes conseillées ────────────────────────────────── */}
      <section className="panel">
        <h2>Commandes conseillées</h2>
        <p className="muted">Synthèse rapide des besoins de réapprovisionnement.</p>
        <div className="suggestion-list mt-4">
          {suggestions.slice(0, 10).map((item) => (
            <div key={item.productId} className="suggestion-item">
              <div>
                <strong>{item.brand}</strong>
                <p>{item.description}</p>
              </div>
              <span>{item.suggestedQuantity}</span>
            </div>
          ))}
          {suggestions.length === 0 && (
            <p className="muted">Aucun réappro conseillé pour le moment.</p>
          )}
        </div>
      </section>

      {message && <p className="notice">{message}</p>}
    </div>
  );
}
