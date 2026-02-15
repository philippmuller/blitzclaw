import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@blitzclaw/db";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "BlitzClaw — Your AI assistant. On Telegram. No servers. No setup. Just chat.",
  description:
    "Research, automate browsers, manage your day — all from a Telegram chat. Powered by Claude. No setup required.",
  openGraph: {
    title: "BlitzClaw — Your AI assistant on Telegram",
    description:
      "Research, automate browsers, manage your day — all from a chat. Powered by Claude. No setup required.",
    type: "website",
    url: "https://www.blitzclaw.com",
  },
  twitter: {
    card: "summary_large_image",
    title: "BlitzClaw — Your AI assistant on Telegram",
    description:
      "Research, automate browsers, manage your day — all from a chat. Powered by Claude.",
  },
};

export const dynamic = "force-dynamic";

export default async function Home() {
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
          <div className="text-2xl font-bold text-foreground flex items-center gap-2">
            <span>⚡</span> BlitzClaw
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/pricing"
              className="px-4 py-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition"
            >
              Pricing
            </Link>
            <Link
              href="/guide"
              className="px-4 py-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition"
            >
              Guide
            </Link>
            <Link
              href="/de"
              className="px-4 py-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition text-sm"
            >
              DE
            </Link>
            <SignedOut>
              <SignInButton mode="modal">
                <button className="px-4 py-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition">
                  Sign In
                </button>
              </SignInButton>
              <Link
                href="/onboarding"
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition font-medium"
              >
                Get Started Free
              </Link>
            </SignedOut>
            <SignedIn>
              <Link
                href="/dashboard"
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition font-medium"
              >
                Dashboard
              </Link>
              <UserButton afterSignOutUrl="/" />
            </SignedIn>
          </div>
        </nav>

        {/* Hero */}
        <div className="max-w-4xl mx-auto px-6 pt-20 pb-12 text-center">
          <h1 className="text-5xl md:text-6xl font-bold text-foreground mb-6 leading-tight">
            Your AI assistant.<br />On Telegram.<br />No servers. No setup. Just chat.
          </h1>
          <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
            Research, automate browsers, manage your day — all from a chat.
            Powered by Claude. No setup required.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <SignedOut>
              <SignInButton mode="modal">
                <button className="px-8 py-4 bg-primary text-primary-foreground text-lg font-medium rounded-xl hover:bg-primary/90 transition shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30">
                  Get Started Free
                </button>
              </SignInButton>
            </SignedOut>
            <SignedIn>
              <Link
                href="/dashboard"
                className="px-8 py-4 bg-primary text-primary-foreground text-lg font-medium rounded-xl hover:bg-primary/90 transition shadow-lg shadow-primary/25"
              >
                Go to Dashboard →
              </Link>
            </SignedIn>
            <a
              href="#demo"
              className="px-8 py-4 border border-border text-foreground text-lg font-medium rounded-xl hover:bg-secondary transition"
            >
              Watch Demo
            </a>
          </div>
          <p className="mt-6 text-xs text-muted-foreground/70">
            {availableServers > 0 ? (
              <span className="text-green-500">
                ● {availableServers} server{availableServers !== 1 ? "s" : ""}{" "}
                ready for instant deployment
              </span>
            ) : (
              <span className="text-amber-500">
                ● High demand — join waitlist for next available slot
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
              Your own server
            </h3>
            <p className="text-muted-foreground">
              A dedicated instance in Germany. Not shared. Your data stays in
              your environment — always.
            </p>
          </div>
          <div className="bg-card border border-border p-6 rounded-xl hover:border-primary/50 transition">
            <div className="text-3xl mb-4">🧠</div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Claude built in
            </h3>
            <p className="text-muted-foreground">
              No API keys needed. Latest Claude models included. Simple
              usage-based pricing after your monthly credits.
            </p>
          </div>
          <div className="bg-card border border-border p-6 rounded-xl hover:border-primary/50 transition">
            <div className="text-3xl mb-4">🌐</div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Browser automation
            </h3>
            <p className="text-muted-foreground">
              Screenshots, web scraping, website monitoring — built in and ready
              to go from day one.
            </p>
          </div>
        </div>

        {/* Comparison Table */}
        <div id="comparison" className="max-w-4xl mx-auto px-6 py-20">
          <h2 className="text-3xl font-bold text-foreground text-center mb-4">
            Traditional Setup vs BlitzClaw
          </h2>
          <p className="text-muted-foreground text-center mb-12">
            Skip the DevOps. Get straight to chatting.
          </p>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-card border border-border rounded-xl p-6">
              <h3 className="text-lg font-semibold text-muted-foreground mb-6">
                Traditional Method
              </h3>
              <div className="space-y-3 text-sm">
                {[
                  ["Purchase a virtual machine", "15 min"],
                  ["Create SSH keys & store securely", "10 min"],
                  ["Connect to server via SSH", "5 min"],
                  ["Install Node.js and NPM", "5 min"],
                  ["Install OpenClaw", "7 min"],
                  ["Configure OpenClaw", "10 min"],
                  ["Connect AI provider", "4 min"],
                  ["Pair with Telegram", "4 min"],
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
                  <span className="text-foreground">Total</span>
                  <span className="text-red-400">~60 min</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-4">
                Non-technical? Multiply by 10× — you have to learn each step
                first.
              </p>
            </div>

            <div className="bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/30 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-primary mb-6">
                BlitzClaw
              </h3>
              <div className="flex flex-col items-center justify-center h-[280px]">
                <div className="text-6xl font-bold text-primary mb-2">
                  ~1 min
                </div>
                <p className="text-muted-foreground text-center max-w-xs">
                  Sign up, pick a plan, connect Telegram — your assistant is
                  live.
                </p>
              </div>
              <p className="text-xs text-muted-foreground mt-4 text-center">
                Servers are pre-configured and waiting. Simple, secure, fast.
              </p>
            </div>
          </div>
        </div>

        {/* Use Case Stories */}
        <div className="max-w-5xl mx-auto px-6 py-20">
          <h2 className="text-3xl font-bold text-foreground text-center mb-4">
            What people use it for
          </h2>
          <p className="text-muted-foreground text-center mb-12">
            Real workflows, not feature lists.
          </p>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-card border border-border rounded-xl p-6">
              <div className="text-3xl mb-4">🎙️</div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Voice note → research report
              </h3>
              <p className="text-muted-foreground">
                Send a voice message with a question. Get a structured research
                report back — with sources. Perfect on the go.
              </p>
            </div>
            <div className="bg-card border border-border rounded-xl p-6">
              <div className="text-3xl mb-4">👁️</div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Monitor and alert
              </h3>
              <p className="text-muted-foreground">
                Watch a website, competitor page, or job board. Get a Telegram
                message when something changes. Runs on autopilot.
              </p>
            </div>
            <div className="bg-card border border-border rounded-xl p-6">
              <div className="text-3xl mb-4">✉️</div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Email drafts in seconds
              </h3>
              <p className="text-muted-foreground">
                Forward an email, describe the tone you want. Get a polished
                reply you can send as-is or tweak.
              </p>
            </div>
          </div>
        </div>

        {/* Pricing Teaser */}
        <div className="max-w-4xl mx-auto px-6 py-20">
          <h2 className="text-3xl font-bold text-foreground text-center mb-12">
            Simple pricing
          </h2>
          <div className="grid md:grid-cols-2 gap-8 max-w-2xl mx-auto">
            <div className="bg-card border border-border rounded-xl p-6 text-center">
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Basic
              </h3>
              <div className="text-4xl font-bold text-foreground mb-2">$19</div>
              <p className="text-muted-foreground text-sm mb-4">/month</p>
              <p className="text-muted-foreground text-sm">
                Dedicated server, Claude access, browser automation. Includes
                monthly credits.
              </p>
            </div>
            <div className="bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/30 rounded-xl p-6 text-center">
              <h3 className="text-lg font-semibold text-primary mb-2">Pro</h3>
              <div className="text-4xl font-bold text-foreground mb-2">$39</div>
              <p className="text-muted-foreground text-sm mb-4">/month</p>
              <p className="text-muted-foreground text-sm">
                Everything in Basic, plus more credits, priority support, and
                advanced features.
              </p>
            </div>
          </div>
          <p className="text-center mt-8">
            <Link href="/pricing" className="text-primary hover:underline">
              See full pricing details →
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
                Do I need API keys?
              </h3>
              <p className="text-muted-foreground">
                No. Claude is included — no Anthropic account or API keys
                required.
              </p>
            </div>
            <div className="bg-card border border-border rounded-xl p-6">
              <h3 className="font-semibold text-foreground mb-2">
                How does billing work?
              </h3>
              <p className="text-muted-foreground">
                Monthly subscription covers hosting and included credits.
                Additional usage is billed automatically — no manual top-ups.
              </p>
            </div>
            <div className="bg-card border border-border rounded-xl p-6">
              <h3 className="font-semibold text-foreground mb-2">
                Is my data secure?
              </h3>
              <p className="text-muted-foreground">
                Your instance runs on a dedicated server in Germany. Your data
                stays in your environment — it&apos;s not shared with other
                users.
              </p>
            </div>
            <div className="bg-card border border-border rounded-xl p-6">
              <h3 className="font-semibold text-foreground mb-2">
                Can I cancel anytime?
              </h3>
              <p className="text-muted-foreground">
                Yes. Cancel from your dashboard. No lock-in, no questions.
              </p>
            </div>
          </div>
        </div>

        {/* Final CTA */}
        <div className="max-w-4xl mx-auto px-6 py-20 text-center">
          <div className="bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 rounded-2xl p-12">
            <h2 className="text-3xl font-bold text-foreground mb-4">
              Try free — $5 in credits, no card required
            </h2>
            <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
              Sign up, connect Telegram, start chatting. Your assistant is live
              in under a minute.
            </p>
            <SignedOut>
              <SignInButton mode="modal">
                <button className="px-8 py-4 bg-primary text-primary-foreground text-lg font-medium rounded-xl hover:bg-primary/90 transition">
                  Get Started Free →
                </button>
              </SignInButton>
            </SignedOut>
            <SignedIn>
              <Link
                href="/dashboard"
                className="inline-block px-8 py-4 bg-primary text-primary-foreground text-lg font-medium rounded-xl hover:bg-primary/90 transition"
              >
                Go to Dashboard →
              </Link>
            </SignedIn>
          </div>
        </div>

        {/* Footer */}
        <footer className="border-t border-border py-8">
          <div className="max-w-7xl mx-auto px-6">
            <div className="mb-6 p-4 bg-yellow-500/5 border border-yellow-500/20 rounded-lg">
              <p className="text-yellow-200/60 text-xs leading-relaxed text-center">
                ⚠️ BlitzClaw instances are for personal use. Security risks
                increase with skills/integrations you enable. We work to provide
                safe defaults but prompt injection and other vulnerabilities
                remain possible. This is an open-source project — use at your
                own risk.
              </p>
            </div>
            <div className="mb-6 text-center">
              <p className="text-muted-foreground/60 text-xs">
                This platform is an independent product and is not affiliated
                with Anthropic, OpenAI, or Google. We use various LLMs through
                our custom interface as part of our product offering.
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
                  Terms
                </Link>
                <Link
                  href="/privacy"
                  className="hover:text-foreground transition"
                >
                  Privacy
                </Link>
                <Link
                  href="/refund"
                  className="hover:text-foreground transition"
                >
                  Refunds
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
