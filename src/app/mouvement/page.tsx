import { MovementForm } from "@/components/movement-form";
import { Nav } from "@/components/nav";

export const dynamic = "force-dynamic";

export default function MouvementPage() {
  return (
    <div className="page-shell">
      <header className="hero">
        <p className="eyebrow">Entrées &amp; Sorties</p>
        <h1>DentaStock</h1>
        <p>Enregistre rapidement un mouvement de stock par EAN ou scanner.</p>
      </header>

      <Nav />

      <MovementForm />
    </div>
  );
}
