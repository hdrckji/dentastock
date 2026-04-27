"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function Nav() {
  const pathname = usePathname();

  return (
    <nav className="app-nav">
      <Link href="/" className={`nav-link${pathname === "/" ? " nav-link-active" : ""}`}>
        📦 Stock &amp; Catalogue
      </Link>
      <Link href="/gestion" className={`nav-link${pathname === "/gestion" ? " nav-link-active" : ""}`}>
        ➕ Gestion &amp; Admin
      </Link>
    </nav>
  );
}
