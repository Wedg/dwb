import type { Metadata } from "next";

// The page itself is a client component, so its title lives here.
export const metadata: Metadata = { title: "TD Control" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
