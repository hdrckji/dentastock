"use client";

import { useState, useCallback, useEffect } from "react";
import { BarcodeScanner } from "@/components/barcode-scanner";

type Product = {
  id: string;
  brand: string;
  description: string;
  ean: string;
  currentStock: number;
  imageUrl: string | null;
  category: { id: string; name: string } | null;
};

type Movement = {
  id: string;
  type: "IN" | "OUT" | "ADJUSTMENT";
  quantity: number;
  reason: string | null;
  occurredAt: string;
  product: { brand: string; description: string; ean: string };
  lot: { batchNumber: string; expiresAt: string | null } | null;
};

export function MovementForm() {
  const [ean, setEan] = useState("");
  const [searching, setSearching] = useState(false);
  const [product, setProduct] = useState<Product | null>(null);
  const [notFound, setNotFound] = useState(false);

  const [movementType, setMovementType] = useState<"IN" | "OUT">("IN");
  const [quantity, setQuantity] = useState(1);
  const [expiresAt, setExpiresAt] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [flash, setFlash] = useState<{ text: string; ok: boolean } | null>(null);

  const [recentMovements, setRecentMovements] = useState<Movement[]>([]);

  async function loadRecent() {
    const res = await fetch("/api/movements?limit=8");
    if (res.ok) {
      const data = await res.json();
      setRecentMovements(data.movements ?? []);
    }
  }

  useEffect(() => {
    loadRecent();
  }, []);

  async function searchByEan(code: string) {
    const trimmed = code.trim();
    if (!trimmed) return;
    setSearching(true);
    setProduct(null);
    setNotFound(false);
    setFlash(null);

    const res = await fetch(`/api/products?ean=${encodeURIComponent(trimmed)}`);
    setSearching(false);

    if (!res.ok) {
      setNotFound(true);
      return;
    }
    const data = await res.json();
    if (data.products?.length > 0) {
      setProduct(data.products[0]);
    } else {
      setNotFound(true);
    }
  }

  const handleScan = useCallback((code: string) => {
    const trimmed = code.trim();
    setEan(trimmed);
    searchByEan(trimmed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit() {
    if (!product) return;
    setSubmitting(true);
    setFlash(null);

    const res = await fetch("/api/movements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId: product.id,
        type: movementType,
        quantity,
        reason: reason.trim() || undefined,
        expiresAt: movementType === "IN" && expiresAt ? expiresAt : undefined,
      }),
    });

    setSubmitting(false);

    if (!res.ok) {
      setFlash({ text: "Erreur lors de l'enregistrement. Réessaie.", ok: false });
      return;
    }

    const delta = movementType === "IN" ? quantity : -quantity;
    const newStock = product.currentStock + delta;
    setProduct((p) => (p ? { ...p, currentStock: newStock } : p));
    setFlash({
      text: `Mouvement enregistré. Stock actuel : ${newStock}`,
      ok: true,
    });
    setQuantity(1);
    setExpiresAt("");
    setReason("");
    loadRecent();
  }

  function clearProduct() {
    setProduct(null);
    setNotFound(false);
    setFlash(null);
    setEan("");
  }

  return (
    <div className="space-y-6">
      {/* ── Recherche EAN ────────────────────────────────── */}
      <section className="panel quick-movement-panel">
        <h2>Rechercher un produit</h2>
        <p className="muted">Scanne le code-barres ou entre l'EAN manuellement.</p>

        <div className="ean-scan-row mt-3">
          <input
            value={ean}
            onChange={(e) => setEan(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && searchByEan(ean)}
            placeholder="EAN (8 à 14 chiffres)"
            inputMode="numeric"
          />
          <BarcodeScanner onDetected={handleScan} buttonLabel="📷 Scanner" />
        </div>
        <button
          type="button"
          className="mt-2"
          style={{ width: "auto" }}
          onClick={() => searchByEan(ean)}
          disabled={searching}
        >
          {searching ? "Recherche…" : "Chercher"}
        </button>

        {notFound && (
          <p className="notice mt-3">
            Produit introuvable pour cet EAN.{" "}
            <a href="/gestion" style={{ color: "var(--primary-dark)", fontWeight: 600 }}>
              Crée-le dans Gestion &amp; Admin
            </a>{" "}
            puis reviens ici.
          </p>
        )}
      </section>

      {/* ── Fiche produit + formulaire ───────────────────── */}
      {product && (
        <section className="panel movement-panel">
          {/* Produit trouvé */}
          <div className="product-found-card">
            {product.imageUrl && (
              <img
                src={product.imageUrl}
                alt={product.description}
                className="product-thumb"
              />
            )}
            <div className="product-found-info">
              <strong>{product.brand}</strong>
              <span className="muted"> — {product.description}</span>
              <div className="product-found-meta">
                EAN {product.ean}
                {product.category && <> · {product.category.name}</>}
              </div>
            </div>
            <div className="product-found-right">
              <div className="stock-count-badge">{product.currentStock}<br /><small>en stock</small></div>
              <button type="button" className="btn-sm btn-cancel" onClick={clearProduct}>
                Changer
              </button>
            </div>
          </div>

          {/* Sélection type de mouvement */}
          <div className="movement-type-toggle mt-5">
            <button
              type="button"
              className={`type-btn ${movementType === "IN" ? "type-btn-in-active" : "type-btn-inactive"}`}
              onClick={() => setMovementType("IN")}
            >
              ↓ Entrée
            </button>
            <button
              type="button"
              className={`type-btn ${movementType === "OUT" ? "type-btn-out-active" : "type-btn-inactive"}`}
              onClick={() => setMovementType("OUT")}
            >
              ↑ Sortie
            </button>
          </div>

          {/* Champs */}
          <div className="mt-4 grid gap-3">
            <label>
              Quantité
              <input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
              />
            </label>

            {movementType === "IN" && (
              <label>
                Date de péremption (optionnel)
                <input
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                />
              </label>
            )}

            <label>
              Motif (optionnel)
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={
                  movementType === "IN"
                    ? "ex : livraison Strauss"
                    : "ex : utilisation salle 2"
                }
              />
            </label>

            <button type="button" onClick={submit} disabled={submitting}>
              {submitting
                ? "Enregistrement…"
                : movementType === "IN"
                  ? "Enregistrer l'entrée"
                  : "Enregistrer la sortie"}
            </button>
          </div>

          {flash && (
            <p className={`notice mt-3 ${flash.ok ? "" : "notice-error"}`}>
              {flash.text}
            </p>
          )}
        </section>
      )}

      {/* ── Derniers mouvements ──────────────────────────── */}
      {recentMovements.length > 0 && (
        <section className="panel">
          <h2>Derniers mouvements</h2>
          <div className="table-wrap mt-3">
            <table>
              <thead>
                <tr>
                  <th>Produit</th>
                  <th>Type</th>
                  <th>Qté</th>
                  <th>Motif</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {recentMovements.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <strong>{m.product.brand}</strong>
                      <span>{m.product.description}</span>
                    </td>
                    <td>
                      <span className={m.type === "IN" ? "badge-in" : m.type === "OUT" ? "badge-out" : "badge-adj"}>
                        {m.type === "IN" ? "Entrée" : m.type === "OUT" ? "Sortie" : "Ajust."}
                      </span>
                    </td>
                    <td>{m.quantity}</td>
                    <td>{m.reason ?? "—"}</td>
                    <td>
                      {new Date(m.occurredAt).toLocaleDateString("fr-BE", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
