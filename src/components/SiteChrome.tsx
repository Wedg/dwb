"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAdminMode } from "@/lib/adminClient";
import { BishopIcon } from "@/components/icons";

const PUBLIC_LINKS = [
  { href: "/brackets", label: "Brackets" },
  { href: "/matches", label: "Matches" },
];

// Only on a phone with the admin PIN saved (TD mode).
const TD_LINKS = [
  { href: "/players", label: "Players" },
  { href: "/control", label: "TD" },
];

const linkClassName = (active: boolean) =>
  `rounded-full px-3 py-1 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--background)] ${
    active
      ? "bg-[color:var(--highlight)] text-[color:var(--foreground)]"
      : "text-[color:var(--muted)] hover:bg-[color:var(--highlight)] hover:text-[color:var(--foreground)]"
  }`;

export function SiteNav() {
  const pathname = usePathname();
  const { isAdmin } = useAdminMode();
  const links = isAdmin ? [...PUBLIC_LINKS, ...TD_LINKS] : PUBLIC_LINKS;

  return (
    <header className="border-b border-[color:var(--border)] bg-[color:var(--background)]/90 backdrop-blur">
      <nav className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 text-sm font-medium sm:px-6 lg:px-8">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-full py-1 pl-1 pr-3 text-[color:var(--foreground)] transition hover:bg-[color:var(--highlight)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[color:var(--accent)] text-[color:var(--accent-contrast)]">
            <BishopIcon className="h-5 w-5" />
          </span>
          <span className="font-semibold">DwB</span>
        </Link>
        <div className="flex flex-wrap items-center gap-1">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={pathname === link.href ? "page" : undefined}
              className={linkClassName(pathname === link.href)}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  );
}

/** A quiet way in for the tournament director, and out again. */
export function SiteFooter() {
  const { isAdmin, signIn, signOut } = useAdminMode();
  return (
    <footer className="mx-auto w-full max-w-5xl px-4 pb-10 pt-6 text-center text-xs text-[color:var(--muted)]">
      {isAdmin ? (
        <p>
          TD mode is on for this phone.{" "}
          <button type="button" onClick={signOut} className="font-semibold underline-offset-4 hover:underline">
            Sign out
          </button>
        </p>
      ) : (
        <p>
          Tournament director?{" "}
          <button type="button" onClick={signIn} className="font-semibold underline-offset-4 hover:underline">
            Sign in
          </button>
        </p>
      )}
    </footer>
  );
}
