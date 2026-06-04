import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AgentationGuard } from "@/components/AgentationGuard";
import { HappySeedsWatermark } from "@/components/HappySeedsWatermark";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Belote en Ligne | Jeu de cartes multijoueur",
  description: "Jouez à la Belote Simple et Contrée en ligne avec vos amis. Interface élégante, temps réel, gratuit.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased font-[family-name:var(--font-geist-sans)]`}
      >
        {children}
        <HappySeedsWatermark />
        <AgentationGuard />
      </body>
    </html>
  );
}
