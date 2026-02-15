import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@blitzclaw/db";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "BlitzClaw — Dein KI-Assistent. Auf Telegram. Kein Server. Kein Setup. Einfach chatten.",
  description:
    "Recherche, Browser-Automatisierung, Tagesplanung — alles aus einem Chat. Powered by Claude. Kein Setup nötig.",
  openGraph: {
    title: "BlitzClaw — Dein KI-Assistent auf Telegram",
    description:
      "Recherche, Browser-Automatisierung, Tagesplanung — alles aus einem Chat. Powered by Claude. Kein Setup nötig.",
    type: "website",
    url: "https://www.blitzclaw.com/de",
  },
};

export const dynamic = "force-dynamic";

export default async function HomeDe() {
  const availableServers = await prisma.serverPool.count({
    where: { status: "AVAILABLE" },
  });

  const { userId } = await auth();

  if (userId) {
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      include: { balance: true, instances: true },
    });

    const hasInstances = (user?.instances?.length ?? 0) > 0;

    if (!hasInstances) {
      redirect("/onboarding");
    }
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-background pointer-events-none" />

      <div className="relative">
        {/* Nav */}
        <nav className="flex justify-between items-center p-6 max-w-7xl mx-auto">
          <Link href="/de" className="text-2xl font-bold text-foreground flex items-center gap-2">
            <span>⚡</span> BlitzClaw
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/pricing"
              className="px-4 py-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition"
            >
              Preise
            </Link>
            <Link
              href="/guide"
              className="px-4 py-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition"
            >
              Anleitung
            </Link>
            <Link
              href="/"
              className="px-4 py-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition text-sm"
            >
              EN
            </Link>
            <SignedOut>
              <SignInButton mode="modal">
                <button className="px-4 py-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition">
                  Anmelden
                </button>
              </SignInButton>
              <Link
                href="/onboarding"
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition font-medium"
              >
                Kostenlos starten
              </Link>
            </SignedOut>
            <SignedIn>
              <Link
                href="/dashboard"
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition font-medium"
              >
                Dashboard
              </Link>
              <UserButton afterSignOutUrl="/de" />
            </SignedIn>
          </div>
        </nav>

        {/* Hero */}
        <div className="max-w-4xl mx-auto px-6 pt-20 pb-12 text-center">
          <h1 className="text-5xl md:text-6xl font-bold text-foreground mb-6 leading-tight">
            Dein KI-Assistent.<br />Auf Telegram.<br />Kein Server. Kein Setup. Einfach chatten.
          </h1>
          <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
            Recherche, Browser-Automatisierung, Tagesplanung — alles aus einem
            Chat. Powered by Claude. Kein Setup nötig.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <SignedOut>
              <SignInButton mode="modal">
                <button className="px-8 py-4 bg-primary text-primary-foreground text-lg font-medium rounded-xl hover:bg-primary/90 transition shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30">
                  Kostenlos starten
                </button>
              </SignInButton>
            </SignedOut>
            <SignedIn>
              <Link
                href="/dashboard"
                className="px-8 py-4 bg-primary text-primary-foreground text-lg font-medium rounded-xl hover:bg-primary/90 transition shadow-lg shadow-primary/25"
              >
                Zum Dashboard →
              </Link>
            </SignedIn>
            <a
              href="#demo"
              className="px-8 py-4 border border-border text-foreground text-lg font-medium rounded-xl hover:bg-secondary transition"
            >
              Demo ansehen
            </a>
          </div>
          <p className="mt-6 text-xs text-muted-foreground/70">
            {availableServers > 0 ? (
              <span className="text-green-500">
                ● {availableServers} Server sofort verfügbar
              </span>
            ) : (
              <span className="text-amber-500">
                ● Hohe Nachfrage — Warteliste für den nächsten Platz
              </span>
            )}
          </p>
        </div>

        {/* Video */}
        <div id="demo" className="max-w-3xl mx-auto px-6 pb-20">
          <div className="relative w-full pt-[56.25%] rounded-xl overflow-hidden border border-border bg-card">
            <iframe
              src="https://www.loom.com/embed/52635d7f2e0b4b2d83ba406523930a5a"
              title="BlitzClaw Demo"
              className="absolute inset-0 h-full w-full"
              allowFullScreen
            />
          </div>
        </div>

        {/* 3 Feature Cards */}
        <div className="max-w-5xl mx-auto px-6 py-20 grid md:grid-cols-3 gap-8">
          <div className="bg-card border border-border p-6 rounded-xl hover:border-primary/50 transition">
            <div className="text-3xl mb-4">🏠</div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Dein eigener Server
            </h3>
            <p className="text-muted-foreground">
              Eine dedizierte Instanz in Deutschland. Nicht geteilt. Deine Daten
              bleiben in deiner Umgebung — immer.
            </p>
          </div>
          <div className="bg-card border border-border p-6 rounded-xl hover:border-primary/50 transition">
            <div className="text-3xl mb-4">🧠</div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Claude integriert
            </h3>
            <p className="text-muted-foreground">
              Keine API-Keys nötig. Aktuelle Claude-Modelle inklusive.
              Nutzungsbasierte Abrechnung nach deinem monatlichen Guthaben.
            </p>
          </div>
          <div className="bg-card border border-border p-6 rounded-xl hover:border-primary/50 transition">
            <div className="text-3xl mb-4">🌐</div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Browser-Automatisierung
            </h3>
            <p className="text-muted-foreground">
              Screenshots, Web Scraping, Website-Monitoring — alles eingebaut
              und ab Tag eins einsatzbereit.
            </p>
          </div>
        </div>

        {/* Comparison Table */}
        <div id="comparison" className="max-w-4xl mx-auto px-6 py-20">
          <h2 className="text-3xl font-bold text-foreground text-center mb-4">
            Klassisches Setup vs BlitzClaw
          </h2>
          <p className="text-muted-foreground text-center mb-12">
            Kein DevOps. Direkt loschatten.
          </p>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-card border border-border rounded-xl p-6">
              <h3 className="text-lg font-semibold text-muted-foreground mb-6">
                Klassische Methode
              </h3>
              <div className="space-y-3 text-sm">
                {[
                  ["Virtuellen Server kaufen", "15 Min"],
                  ["SSH-Keys erstellen & sichern", "10 Min"],
                  ["Per SSH verbinden", "5 Min"],
                  ["Node.js und NPM installieren", "5 Min"],
                  ["OpenClaw installieren", "7 Min"],
                  ["OpenClaw konfigurieren", "10 Min"],
                  ["KI-Anbieter verbinden", "4 Min"],
                  ["Telegram verknüpfen", "4 Min"],
                ].map(([step, time]) => (
                  <div
                    key={step}
                    className="flex justify-between py-2 border-b border-border"
                  >
                    <span className="text-muted-foreground">{step}</span>
                    <span className="text-foreground">{time}</span>
                  </div>
                ))}
                <div className="flex justify-between py-3 font-semibold">
                  <span className="text-foreground">Gesamt</span>
                  <span className="text-red-400">~60 Min</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-4">
                Nicht technisch? Rechne ×10 — jeden Schritt musst du erst
                lernen.
              </p>
            </div>

            <div className="bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/30 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-primary mb-6">
                BlitzClaw
              </h3>
              <div className="flex flex-col items-center justify-center h-[280px]">
                <div className="text-6xl font-bold text-primary mb-2">
                  ~1 Min
                </div>
                <p className="text-muted-foreground text-center max-w-xs">
                  Anmelden, Plan wählen, Telegram verbinden — dein Assistent ist
                  live.
                </p>
              </div>
              <p className="text-xs text-muted-foreground mt-4 text-center">
                Server sind vorkonfiguriert und warten. Einfach, sicher,
                schnell.
              </p>
            </div>
          </div>
        </div>

        {/* Use Case Stories */}
        <div className="max-w-5xl mx-auto px-6 py-20">
          <h2 className="text-3xl font-bold text-foreground text-center mb-4">
            Wofür andere es nutzen
          </h2>
          <p className="text-muted-foreground text-center mb-12">
            Echte Workflows, keine Feature-Listen.
          </p>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-card border border-border rounded-xl p-6">
              <div className="text-3xl mb-4">🎙️</div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Sprachnachricht → Recherche-Report
              </h3>
              <p className="text-muted-foreground">
                Schick eine Sprachnachricht mit deiner Frage. Bekomm einen
                strukturierten Report zurück — mit Quellen. Perfekt für
                unterwegs.
              </p>
            </div>
            <div className="bg-card border border-border rounded-xl p-6">
              <div className="text-3xl mb-4">👁️</div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Überwachen und benachrichtigen
              </h3>
              <p className="text-muted-foreground">
                Beobachte eine Website, Konkurrenz-Seite oder Jobbörse. Bekomm
                eine Telegram-Nachricht bei Änderungen. Läuft im Hintergrund.
              </p>
            </div>
            <div className="bg-card border border-border rounded-xl p-6">
              <div className="text-3xl mb-4">✉️</div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                E-Mail-Entwürfe in Sekunden
              </h3>
              <p className="text-muted-foreground">
                Leite eine E-Mail weiter, beschreib den gewünschten Ton. Bekomm
                eine fertige Antwort, die du direkt senden oder anpassen kannst.
              </p>
            </div>
          </div>
        </div>

        {/* Pricing Teaser */}
        <div className="max-w-4xl mx-auto px-6 py-20">
          <h2 className="text-3xl font-bold text-foreground text-center mb-12">
            Einfache Preise
          </h2>
          <div className="grid md:grid-cols-2 gap-8 max-w-2xl mx-auto">
            <div className="bg-card border border-border rounded-xl p-6 text-center">
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Basic
              </h3>
              <div className="text-4xl font-bold text-foreground mb-2">$19</div>
              <p className="text-muted-foreground text-sm mb-4">/Monat</p>
              <p className="text-muted-foreground text-sm">
                Dedizierter Server, Claude-Zugang, Browser-Automatisierung.
                Monatliches Guthaben inklusive.
              </p>
            </div>
            <div className="bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/30 rounded-xl p-6 text-center">
              <h3 className="text-lg font-semibold text-primary mb-2">Pro</h3>
              <div className="text-4xl font-bold text-foreground mb-2">$39</div>
              <p className="text-muted-foreground text-sm mb-4">/Monat</p>
              <p className="text-muted-foreground text-sm">
                Alles aus Basic, plus mehr Guthaben, Priority-Support und
                erweiterte Features.
              </p>
            </div>
          </div>
          <p className="text-center mt-8">
            <Link href="/pricing" className="text-primary hover:underline">
              Alle Preisdetails →
            </Link>
          </p>
        </div>

        {/* FAQ */}
        <div className="max-w-4xl mx-auto px-6 py-20">
          <h2 className="text-3xl font-bold text-foreground text-center mb-12">
            FAQ
          </h2>
          <div className="space-y-6">
            <div className="bg-card border border-border rounded-xl p-6">
              <h3 className="font-semibold text-foreground mb-2">
                Brauche ich API-Keys?
              </h3>
              <p className="text-muted-foreground">
                Nein. Claude ist inklusive — kein Anthropic-Account oder
                API-Keys nötig.
              </p>
            </div>
            <div className="bg-card border border-border rounded-xl p-6">
              <h3 className="font-semibold text-foreground mb-2">
                Wie funktioniert die Abrechnung?
              </h3>
              <p className="text-muted-foreground">
                Monatliches Abo deckt Hosting und enthaltenes Guthaben.
                Zusätzliche Nutzung wird automatisch abgerechnet — kein
                manuelles Aufladen.
              </p>
            </div>
            <div className="bg-card border border-border rounded-xl p-6">
              <h3 className="font-semibold text-foreground mb-2">
                Sind meine Daten sicher?
              </h3>
              <p className="text-muted-foreground">
                Deine Instanz läuft auf einem dedizierten Server in Deutschland.
                Deine Daten bleiben in deiner Umgebung — sie werden nicht mit
                anderen Nutzern geteilt.
              </p>
            </div>
            <div className="bg-card border border-border rounded-xl p-6">
              <h3 className="font-semibold text-foreground mb-2">
                Kann ich jederzeit kündigen?
              </h3>
              <p className="text-muted-foreground">
                Ja. Direkt im Dashboard kündigen. Keine Bindung, keine Fragen.
              </p>
            </div>
          </div>
        </div>

        {/* Final CTA */}
        <div className="max-w-4xl mx-auto px-6 py-20 text-center">
          <div className="bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 rounded-2xl p-12">
            <h2 className="text-3xl font-bold text-foreground mb-4">
              Kostenlos testen — $5 Startguthaben, keine Karte nötig
            </h2>
            <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
              Anmelden, Telegram verbinden, loschatten. Dein Assistent ist in
              unter einer Minute live.
            </p>
            <SignedOut>
              <SignInButton mode="modal">
                <button className="px-8 py-4 bg-primary text-primary-foreground text-lg font-medium rounded-xl hover:bg-primary/90 transition">
                  Kostenlos starten →
                </button>
              </SignInButton>
            </SignedOut>
            <SignedIn>
              <Link
                href="/dashboard"
                className="inline-block px-8 py-4 bg-primary text-primary-foreground text-lg font-medium rounded-xl hover:bg-primary/90 transition"
              >
                Zum Dashboard →
              </Link>
            </SignedIn>
          </div>
        </div>

        {/* Footer */}
        <footer className="border-t border-border py-8">
          <div className="max-w-7xl mx-auto px-6">
            <div className="mb-6 p-4 bg-yellow-500/5 border border-yellow-500/20 rounded-lg">
              <p className="text-yellow-200/60 text-xs leading-relaxed text-center">
                ⚠️ BlitzClaw-Instanzen sind für den persönlichen Gebrauch.
                Sicherheitsrisiken steigen mit aktivierten
                Skills/Integrationen. Wir arbeiten an sicheren Standardwerten,
                aber Prompt Injection und andere Schwachstellen bleiben möglich.
                Open-Source-Projekt — Nutzung auf eigene Verantwortung.
              </p>
            </div>
            <div className="mb-6 text-center">
              <p className="text-muted-foreground/60 text-xs">
                Diese Plattform ist ein unabhängiges Produkt und nicht mit
                Anthropic, OpenAI oder Google verbunden. Wir nutzen
                verschiedene LLMs über unser eigenes Interface als Teil unseres
                Produktangebots.
              </p>
            </div>
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="text-muted-foreground text-sm">
                © 2026 BlitzClaw. Powered by{" "}
                <a
                  href="https://openclaw.ai"
                  className="text-primary hover:underline"
                >
                  OpenClaw
                </a>
                .
              </div>
              <div className="flex items-center gap-6 text-sm text-muted-foreground">
                <Link
                  href="/terms"
                  className="hover:text-foreground transition"
                >
                  AGB
                </Link>
                <Link
                  href="/privacy"
                  className="hover:text-foreground transition"
                >
                  Datenschutz
                </Link>
                <Link
                  href="/refund"
                  className="hover:text-foreground transition"
                >
                  Erstattung
                </Link>
                <Link
                  href="/impressum"
                  className="hover:text-foreground transition"
                >
                  Impressum
                </Link>
                <a
                  href="mailto:support@blitzclaw.com"
                  className="hover:text-foreground transition"
                >
                  Support
                </a>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </main>
  );
}
