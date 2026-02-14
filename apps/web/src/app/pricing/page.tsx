import Link from "next/link";
import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";

export const metadata = {
  title: "Pricing | BlitzClaw",
  description: "Simple usage-based pricing for your AI assistant.",
};

const tiers = [
  {
  {
    name: "Basic",
    price: 19,
    currency: "$",
    description: "Everything you need",
    forWho: "For individuals getting started with AI assistants",
    features: [
      "Dedicated server — 2 vCPU, 2GB RAM",
      "All Claude models available",
      "Telegram integration",
      "Browser automation",
      "$5 in AI credits included",
      "No API key required (BlitzClaw handles model access)",
      "Usage is metered automatically after included credits",
      "No balance top-ups needed",
    ],
    notIncluded: [],
    cta: "Get Started",
    highlight: false,
  },
  {
    name: "Pro",
    price: 39,
    currency: "$",
    description: "More power for power users",
    forWho: "For professionals who need advanced capabilities",
    features: [
      "Dedicated server — 2 vCPU, 4GB RAM",
      "All Claude models available",
      "Telegram integration",
      "Advanced browser automation",
      "Priority support",
      "$15 in AI credits included",
      "No API key required (BlitzClaw handles model access)",
      "Usage is metered automatically after included credits",
      "No balance top-ups needed",
    ],
    notIncluded: [],
    cta: "Get Started",
    highlight: true,
  },
];

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="flex justify-between items-center p-6 max-w-7xl mx-auto">
        <Link href="/" className="text-2xl font-bold text-foreground flex items-center gap-2">
          <span>⚡</span> BlitzClaw
        </Link>
        <div className="flex items-center gap-4">
          <Link
            href="/guide"
            className="px-4 py-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition"
          >
            Guide
          </Link>
          <SignedOut>
            <SignInButton mode="modal">
              <button className="px-4 py-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition">
                Sign In
              </button>
            </SignInButton>
          </SignedOut>
          <SignedIn>
            <Link
              href="/dashboard"
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition font-medium"
            >
              Dashboard
            </Link>
          </SignedIn>
        </div>
      </nav>

      {/* Hero */}
      <div className="max-w-5xl mx-auto px-6 pt-12 pb-8 text-center">
        <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
          Simple, Transparent Pricing
        </h1>
        <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
          No API keys, no plan-switching to handle usage spikes, and no manual top-ups. Billing is automatic and usage-based.
        </p>
      </div>

      {/* Pricing Cards */}
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={`relative bg-card border rounded-2xl p-8 ${
                tier.highlight
                  ? "border-primary shadow-lg shadow-primary/10"
                  : "border-border"
              }`}
            >
              {tier.highlight && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <span className="bg-primary text-primary-foreground text-sm font-medium px-4 py-1 rounded-full">
                    Best Value
                  </span>
                </div>
              )}

              <div className="mb-6">
                <h2 className="text-2xl font-bold text-foreground">{tier.name}</h2>
                <p className="text-muted-foreground mt-1">{tier.description}</p>
              </div>

              <div className="mb-6">
                <span className="text-5xl font-bold text-foreground">{tier.currency}{tier.price}</span>
                <span className="text-muted-foreground">/month</span>
              </div>

              <p className="text-sm text-muted-foreground mb-6 pb-6 border-b border-border">
                {tier.forWho}
              </p>

              <ul className="space-y-3 mb-8">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm">
                    <span className="text-green-400 mt-0.5">✓</span>
                    <span className="text-foreground">{feature}</span>
                  </li>
                ))}
                {tier.notIncluded.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm">
                    <span className="text-muted-foreground mt-0.5">–</span>
                    <span className="text-muted-foreground">{item}</span>
                  </li>
                ))}
              </ul>

              <SignedOut>
                <SignInButton mode="modal">
                  <button
                    className={`w-full py-3 px-4 rounded-xl font-medium transition ${
                      tier.highlight
                        ? "bg-primary text-primary-foreground hover:bg-primary/90"
                        : "bg-secondary text-foreground hover:bg-secondary/80"
                    }`}
                  >
                    {tier.cta}
                  </button>
                </SignInButton>
              </SignedOut>
              <SignedIn>
                <Link
                  href="/onboarding"
                  className={`block w-full py-3 px-4 rounded-xl font-medium text-center transition ${
                    tier.highlight
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : "bg-secondary text-foreground hover:bg-secondary/80"
                  }`}
                >
                  {tier.cta}
                </Link>
              </SignedIn>
            </div>
          ))}
        </div>
      </div>

      {/* FAQ */}
      <div className="max-w-3xl mx-auto px-6 py-16">
        <h2 className="text-2xl font-bold text-foreground text-center mb-8">
          Frequently Asked Questions
        </h2>

        <div className="space-y-6">
          <div className="bg-card border border-border rounded-xl p-6">
            <h3 className="font-semibold text-foreground mb-2">
              Do I need my own API key?
            </h3>
            <p className="text-muted-foreground text-sm">
              No. BlitzClaw includes managed model access — you don&apos;t need to bring your own Anthropic or OpenAI key.
              Just sign up and start using your assistant.
            </p>
          </div>

          <div className="bg-card border border-border rounded-xl p-6">
            <h3 className="font-semibold text-foreground mb-2">
              Do I need to switch plans as my usage changes?
            </h3>
            <p className="text-muted-foreground text-sm">
              No plan switching is required for normal usage changes. Your usage is metered automatically after included credits,
              so you can keep using your assistant without manual plan juggling.
            </p>
          </div>

          <div className="bg-card border border-border rounded-xl p-6">
            <h3 className="font-semibold text-foreground mb-2">
              Do I need to top up balance manually?
            </h3>
            <p className="text-muted-foreground text-sm">
              No. Billing is automatic via metered usage. There&apos;s no separate wallet or top-up flow to maintain.
            </p>
          </div>

          <div className="bg-card border border-border rounded-xl p-6">
            <h3 className="font-semibold text-foreground mb-2">
              What AI models are available?
            </h3>
            <p className="text-muted-foreground text-sm">
              All plans include access to Claude Opus, Sonnet, and Haiku. You can switch models
              anytime based on your needs — Opus for complex tasks, Haiku for quick responses.
            </p>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="max-w-4xl mx-auto px-6 py-12 text-center">
        <div className="bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 rounded-2xl p-12">
          <h2 className="text-2xl font-bold text-foreground mb-4">
            Ready to get started?
          </h2>
          <p className="text-muted-foreground mb-8">
            Deploy your AI assistant in under 3 minutes.
          </p>
          <SignedOut>
            <SignInButton mode="modal">
              <button className="px-8 py-4 bg-primary text-primary-foreground text-lg font-medium rounded-xl hover:bg-primary/90 transition">
                Create Your Agent →
              </button>
            </SignInButton>
          </SignedOut>
          <SignedIn>
            <Link
              href="/onboarding"
              className="inline-block px-8 py-4 bg-primary text-primary-foreground text-lg font-medium rounded-xl hover:bg-primary/90 transition"
            >
              Create Your Agent →
            </Link>
          </SignedIn>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="max-w-7xl mx-auto px-6">
          {/* Independence Disclaimer */}
          <div className="mb-6 text-center">
            <p className="text-muted-foreground/60 text-xs">
              This platform is an independent product and is not affiliated with Anthropic, OpenAI, or Google. 
              We leverage various LLMs through our custom interface as part of our product offering.
            </p>
          </div>
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-muted-foreground text-sm">
              © 2026 BlitzClaw. Powered by <a href="https://openclaw.ai" className="text-primary hover:underline">OpenClaw</a>.
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <Link href="/terms" className="hover:text-foreground transition">Terms</Link>
              <Link href="/privacy" className="hover:text-foreground transition">Privacy</Link>
              <Link href="/impressum" className="hover:text-foreground transition">Impressum</Link>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
