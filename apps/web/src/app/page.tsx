import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@blitzclaw/db";

export default async function Home() {
  // Check if user is signed in and needs onboarding
  const { userId } = await auth();
  
  if (userId) {
    // Check if user has completed onboarding (has balance or instances)
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      include: { balance: true, instances: true },
    });
    
    const hasBalance = (user?.balance?.creditsCents ?? 0) > 0;
    const hasInstances = (user?.instances?.length ?? 0) > 0;
    
    // New user - redirect to onboarding
    if (!hasBalance && !hasInstances) {
      redirect("/onboarding");
    }
    
    // Existing user - redirect to dashboard
    redirect("/dashboard");
  }
  return (
    <main className="min-h-screen bg-background">
      {/* Gradient Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-background pointer-events-none" />
      
      <div className="relative">
        <nav className="flex justify-between items-center p-6 max-w-7xl mx-auto">
          <div className="text-2xl font-bold text-foreground flex items-center gap-2">
            <span>⚡</span> BlitzClaw
          </div>
          <div className="flex items-center gap-4">
            <SignedOut>
              <SignInButton mode="modal">
                <button className="px-4 py-2 text-foreground hover:bg-secondary rounded-lg transition">
                  Sign In
                </button>
              </SignInButton>
            </SignedOut>
            <SignedIn>
              <Link
                href="/dashboard"
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition"
              >
                Dashboard
              </Link>
              <UserButton afterSignOutUrl="/" />
            </SignedIn>
          </div>
        </nav>

        <div className="max-w-4xl mx-auto px-6 py-20 text-center">
          <div className="inline-block px-4 py-1.5 bg-primary/10 border border-primary/20 rounded-full text-sm text-primary mb-6">
            ⚡ Blazing fast AI deployment
          </div>
          <h1 className="text-5xl md:text-6xl font-bold text-foreground mb-6 leading-tight">
            Deploy Your AI Assistant in{" "}
            <span className="text-primary">Minutes</span>
          </h1>
          <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
            Your own OpenClaw instance. Telegram ready, WhatsApp coming soon.
            <br />
            Bring your own Anthropic key, or use our pay-as-you-go billing.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <SignedOut>
              <SignInButton mode="modal">
                <button className="px-8 py-4 bg-primary text-primary-foreground text-lg font-medium rounded-xl hover:bg-primary/90 transition shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30">
                  Get Started Free →
                </button>
              </SignInButton>
            </SignedOut>
            <SignedIn>
              <Link
                href="/dashboard"
                className="px-8 py-4 bg-primary text-primary-foreground text-lg font-medium rounded-xl hover:bg-primary/90 transition shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30"
              >
                Go to Dashboard →
              </Link>
            </SignedIn>
            <a
              href="#features"
              className="px-8 py-4 border border-border text-foreground text-lg font-medium rounded-xl hover:bg-secondary transition"
            >
              Learn More
            </a>
          </div>
        </div>

        {/* Features */}
        <div id="features" className="max-w-5xl mx-auto px-6 py-20 grid md:grid-cols-3 gap-8">
          <div className="bg-card border border-border p-6 rounded-xl hover:border-primary/50 transition">
            <div className="text-3xl mb-4">🚀</div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Instant Setup</h3>
            <p className="text-muted-foreground">
              From signup to chatting with your AI in under 5 minutes. No DevOps required.
            </p>
          </div>
          <div className="bg-card border border-border p-6 rounded-xl hover:border-primary/50 transition">
            <div className="text-3xl mb-4">💰</div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Flexible Pricing</h3>
            <p className="text-muted-foreground">
              BYOK: €14/mo with your Anthropic key. Or use our billing at API cost + small fee.
            </p>
          </div>
          <div className="bg-card border border-border p-6 rounded-xl hover:border-primary/50 transition">
            <div className="text-3xl mb-4">🔒</div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Your Own Instance</h3>
            <p className="text-muted-foreground">
              Dedicated server. Full isolation. Your data stays on your instance.
            </p>
          </div>
        </div>

        {/* How it works */}
        <div className="max-w-4xl mx-auto px-6 py-20">
          <h2 className="text-3xl font-bold text-foreground text-center mb-12">How It Works</h2>
          <div className="space-y-6">
            <div className="flex items-start gap-4 p-6 bg-card border border-border rounded-xl">
              <div className="w-10 h-10 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold shrink-0">
                1
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1">Choose your plan</h3>
                <p className="text-muted-foreground">
                  BYOK at €14/mo with your Anthropic API key, or use our managed billing with pay-as-you-go credits.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4 p-6 bg-card border border-border rounded-xl">
              <div className="w-10 h-10 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold shrink-0">
                2
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1">Create your AI instance</h3>
                <p className="text-muted-foreground">
                  Choose a persona template or create your own SOUL.md to define your AI&apos;s personality.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4 p-6 bg-card border border-border rounded-xl">
              <div className="w-10 h-10 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold shrink-0">
                3
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1">Connect Telegram</h3>
                <p className="text-muted-foreground">
                  Create a bot via BotFather, paste the token, and you&apos;re live!
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="max-w-4xl mx-auto px-6 py-20 text-center">
          <div className="bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 rounded-2xl p-12">
            <h2 className="text-3xl font-bold text-foreground mb-4">
              Ready to deploy your AI?
            </h2>
            <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
              Get your personal AI assistant running in minutes. No complex setup, no DevOps required.
            </p>
            <SignedOut>
              <SignInButton mode="modal">
                <button className="px-8 py-4 bg-primary text-primary-foreground text-lg font-medium rounded-xl hover:bg-primary/90 transition">
                  Start Now →
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
            {/* Security Disclaimer */}
            <div className="mb-6 p-4 bg-yellow-500/5 border border-yellow-500/20 rounded-lg">
              <p className="text-yellow-200/60 text-xs leading-relaxed text-center">
                ⚠️ BlitzClaw instances are for personal use. Security risks increase with skills/integrations you enable.
                We work to provide safe defaults but prompt injection and other vulnerabilities remain possible.
                This is an open-source project — use at your own risk.
              </p>
            </div>
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="text-muted-foreground text-sm">
                © 2026 BlitzClaw. All rights reserved.
              </div>
              <div className="flex items-center gap-6 text-sm text-muted-foreground">
                <Link href="/terms" className="hover:text-foreground transition">Terms</Link>
                <Link href="/privacy" className="hover:text-foreground transition">Privacy</Link>
                <Link href="/refund" className="hover:text-foreground transition">Refunds</Link>
                <a href="mailto:support@blitzclaw.com" className="hover:text-foreground transition">Support</a>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </main>
  );
}
