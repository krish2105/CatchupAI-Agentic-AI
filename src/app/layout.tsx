import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CatchUp AI | Autonomous Learning Recovery",
  description:
    "A next-generation learning recovery assistant. Visual hackathon starter; backend integration pending.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: `try { const t = localStorage.getItem("catchup-orbital-theme"); if (t === "light" || t === "dark") document.documentElement.dataset.theme = t; } catch (_) {}` }} /></head>
      <body>{children}</body>
    </html>
  );
}
