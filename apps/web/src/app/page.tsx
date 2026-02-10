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
            <Link
              href="/guide"
              className="px-4 py-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition"
            >
              Startup Guide
            </Link>
            <Link
              href="/agents"
              className="px-4 py-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition"
            >
              What Are Agents?
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
                Create Your Agent →
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
        <div className="max-w-4xl mx-auto px-6 py-20 text-center">
          <div className="inline-block px-4 py-1.5 bg-primary/10 border border-primary/20 rounded-full text-sm text-primary mb-6">
            ⚡ Deploy in under 3 minutes
          </div>
          <h1 className="text-5xl md:text-6xl font-bold text-foreground mb-6 leading-tight">
            Your Personal AI Assistant
          </h1>
          <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
            Chat on Telegram. It learns your workflows, manages tasks, shares secrets securely, and gets things done.
            <br />
            From <span className="text-primary font-medium">€19/mo</span> all-in. As low as <span className="text-primary font-medium">€14/mo</span> with your own API key.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <SignedOut>
              <SignInButton mode="modal">
                <button className="px-8 py-4 bg-primary text-primary-foreground text-lg font-medium rounded-xl hover:bg-primary/90 transition shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30">
                  Get Started →
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
              href="#comparison"
              className="px-8 py-4 border border-border text-foreground text-lg font-medium rounded-xl hover:bg-secondary transition"
            >
              See How It Works
            </a>
          </div>
          <p className="mt-6 text-sm text-muted-foreground">
            New to AI assistants?{" "}
            <Link href="/guide" className="text-primary hover:underline">
              Getting started guide
            </Link>
            {" · "}
            <Link href="/agents" className="text-primary hover:underline">
              Learn about agents
            </Link>
          </p>
        </div>

        {/* Features */}
        <div id="features" className="max-w-5xl mx-auto px-6 py-20 grid md:grid-cols-3 gap-8">
          <div className="bg-card border border-border p-6 rounded-xl hover:border-primary/50 transition">
            <div className="text-3xl mb-4">🚀</div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Quick Setup</h3>
            <p className="text-muted-foreground">
              Get started in under 3 minutes. No VMs to manage, no infrastructure headaches.
            </p>
          </div>
          <div className="bg-card border border-border p-6 rounded-xl hover:border-primary/50 transition">
            <div className="text-3xl mb-4">🧠</div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Your Own Instance</h3>
            <p className="text-muted-foreground">
              Dedicated server with its own memory and context. Your assistant learns and remembers.
            </p>
          </div>
          <div className="bg-card border border-border p-6 rounded-xl hover:border-primary/50 transition">
            <div className="text-3xl mb-4">🔋</div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Batteries Included</h3>
            <p className="text-muted-foreground">
              Browser automation, web search, file access — ready to go out of the box.
            </p>
          </div>
          <div className="bg-card border border-border p-6 rounded-xl hover:border-primary/50 transition">
            <div className="text-3xl mb-4">💬</div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Chat on Telegram</h3>
            <p className="text-muted-foreground">
              Talk to your assistant in Telegram. WhatsApp coming soon.
            </p>
          </div>
          <div className="bg-card border border-border p-6 rounded-xl hover:border-primary/50 transition">
            <div className="text-3xl mb-4">🔑</div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Secure Secret Sharing</h3>
            <p className="text-muted-foreground">
              Share API keys and tokens via dashboard — no need to send secrets through chat.
            </p>
          </div>
          <div className="bg-card border border-border p-6 rounded-xl hover:border-primary/50 transition">
            <div className="text-3xl mb-4">💰</div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Simple Pricing</h3>
            <p className="text-muted-foreground">
              €14/mo for your server. Bring your own Anthropic API key — you control costs.
            </p>
          </div>
        </div>

        {/* Comparison Table */}
        <div id="comparison" className="max-w-4xl mx-auto px-6 py-20">
          <h2 className="text-3xl font-bold text-foreground text-center mb-4">Traditional Setup vs BlitzClaw</h2>
          <p className="text-muted-foreground text-center mb-12">Skip the DevOps. Get straight to chatting.</p>
          
          <div className="grid md:grid-cols-2 gap-8">
            {/* Traditional */}
            <div className="bg-card border border-border rounded-xl p-6">
              <h3 className="text-lg font-semibold text-muted-foreground mb-6">Traditional Method</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">Purchase a virtual machine</span>
                  <span className="text-foreground">15 min</span>
                </div>
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">Create SSH keys & store securely</span>
                  <span className="text-foreground">10 min</span>
                </div>
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">Connect to server via SSH</span>
                  <span className="text-foreground">5 min</span>
                </div>
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">Install Node.js and NPM</span>
                  <span className="text-foreground">5 min</span>
                </div>
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">Install OpenClaw</span>
                  <span className="text-foreground">7 min</span>
                </div>
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">Configure OpenClaw</span>
                  <span className="text-foreground">10 min</span>
                </div>
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">Connect AI provider</span>
                  <span className="text-foreground">4 min</span>
                </div>
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">Pair with Telegram</span>
                  <span className="text-foreground">4 min</span>
                </div>
                <div className="flex justify-between py-3 font-semibold">
                  <span className="text-foreground">Total</span>
                  <span className="text-red-400">~60 min</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-4">
                Non-technical? Multiply by 10× — you have to learn each step first.
              </p>
            </div>

            {/* BlitzClaw */}
            <div className="bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/30 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-primary mb-6">BlitzClaw</h3>
              <div className="flex flex-col items-center justify-center h-[280px]">
                <div className="text-6xl font-bold text-primary mb-2">&lt;3 min</div>
                <p className="text-muted-foreground text-center max-w-xs">
                  Pick a model, connect Telegram, deploy — done.
                </p>
              </div>
              <p className="text-xs text-muted-foreground mt-4 text-center">
                Servers are pre-configured and waiting. Simple, secure, fast.
              </p>
            </div>
          </div>
        </div>

        {/* Use Cases */}
        <div className="max-w-5xl mx-auto px-6 py-20">
          <h2 className="text-3xl font-bold text-foreground text-center mb-4">What Can Your Assistant Do?</h2>
          <p className="text-muted-foreground text-center mb-12">One assistant, thousands of use cases</p>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              "Read & summarize messages",
              "Draft replies",
              "Schedule meetings",
              "Remind you of deadlines",
              "Plan your week",
              "Take meeting notes",
              "Research competitors",
              "Generate invoices",
              "Track expenses",
              "Research travel",
              "Write contracts",
              "Monitor news",
              "Translate messages",
              "Answer support tickets",
              "Draft social posts",
              "Set and track goals",
            ].map((useCase) => (
              <div
                key={useCase}
                className="px-4 py-3 bg-card border border-border rounded-lg text-sm text-muted-foreground hover:border-primary/50 hover:text-foreground transition"
              >
                {useCase}
              </div>
            ))}
          </div>
          <p className="text-center text-muted-foreground mt-8 text-sm">
            Add any use case via natural language. Your assistant adapts to you.
          </p>
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
                <h3 className="font-semibold text-foreground mb-1">Sign up & subscribe</h3>
                <p className="text-muted-foreground">
                  Your subscription gets you a dedicated server. Bring your own Anthropic API key — you control your AI costs.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4 p-6 bg-card border border-border rounded-xl">
              <div className="w-10 h-10 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold shrink-0">
                2
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1">Create a Telegram bot</h3>
                <p className="text-muted-foreground">
                  Open @BotFather, create a bot, copy the token. Takes 30 seconds.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4 p-6 bg-card border border-border rounded-xl">
              <div className="w-10 h-10 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold shrink-0">
                3
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1">Start chatting</h3>
                <p className="text-muted-foreground">
                  Your assistant is live. Message it on Telegram and watch it work. Slack, Discord, and WhatsApp coming soon — included in your subscription.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="max-w-4xl mx-auto px-6 py-20 text-center">
          <div className="bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 rounded-2xl p-12">
            <h2 className="text-3xl font-bold text-foreground mb-4">
              Ready for your own AI assistant?
            </h2>
            <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
              Join in under 3 minutes. No DevOps required.
            </p>
            <SignedOut>
              <SignInButton mode="modal">
                <button className="px-8 py-4 bg-primary text-primary-foreground text-lg font-medium rounded-xl hover:bg-primary/90 transition">
                  Get Started — €14/mo →
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
                © 2026 BlitzClaw. Powered by <a href="https://openclaw.ai" className="text-primary hover:underline">OpenClaw</a>.
              </div>
              <div className="flex items-center gap-6 text-sm text-muted-foreground">
                <Link href="/terms" className="hover:text-foreground transition">Terms</Link>
                <Link href="/privacy" className="hover:text-foreground transition">Privacy</Link>
                <Link href="/refund" className="hover:text-foreground transition">Refunds</Link>
                <Link href="/impressum" className="hover:text-foreground transition">Impressum</Link>
                <a href="mailto:support@blitzclaw.com" className="hover:text-foreground transition">Support</a>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </main>
  );
}
