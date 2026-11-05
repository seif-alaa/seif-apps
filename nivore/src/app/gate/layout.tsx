import type { Metadata } from "next";

export const metadata: Metadata = { robots: { index: false } };

export default function GateLayout({ children }: { children: React.ReactNode }) {
  return <main id="main" className="min-h-dvh bg-cream">{children}</main>;
}
