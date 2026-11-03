import type { Metadata } from "next";
import "./globals.css";
import { preferencesScript } from "@/lib/preferences/script";

export const metadata: Metadata = {
  title: "CatchUp AI | Autonomous Learning Recovery",
  description:
    "A next-generation learning recovery assistant. Visual hackathon starter; backend integration pending.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: preferencesScript }} /></head>
      <body>{children}</body>
    </html>
  );
}
