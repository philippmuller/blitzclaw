import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@blitzclaw/db";

// Make page dynamic (queries DB)
export const dynamic = "force-dynamic";

export default async function Home() {
  // Get available server count for display
  const availableServers = await prisma.serverPool.count({
    where: { status: "AVAILABLE" },
  });
  
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
              href="/pricing"
              className="px-4 py-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition"
            >
              Pricing
            </Link>
            <Link
              href="/guide"
              className="px-4 py-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition"
            >
              Agent?
            </Link>
            <Link
              href="/guides"
              className="px-4 py-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition"
            >
              Guides
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
            ⚡ Your assistant live in ~5 minutes
          </div>
          <h1 className="text-5xl md:text-6xl font-bold text-foreground mb-6 leading-tight">
            Your AI assistant, ready in a minute.
          </h1>
          <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
            No setup, no API keys, no server management. Just sign up, pick a plan, connect Telegram, and start chatting.
            <br />
            Powered by Claude. Plans from <span className="text-primary font-medium">$19/mo</span> with usage-based pricing after included credits.
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
          {/* Server availability */}
          <p className="mt-6 text-xs text-muted-foreground/70">
            {availableServers > 0 ? (
              <span className="text-green-500">● {availableServers} server{availableServers !== 1 ? 's' : ''} ready for instant deployment</span>
            ) : (
              <span className="text-amber-500">● High demand — join waitlist for next available slot</span>
            )}
          </p>
          
          <p className="mt-4 text-sm text-muted-foreground">
            Want the details?{" "}
            <Link href="/pricing" className="text-primary hover:underline">
              See pricing
            </Link>
            {" · "}
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
            <h3 className="text-lg font-semibold text-foreground mb-2">60‑Second Setup</h3>
            <p className="text-muted-foreground">
              No VMs, no config, no DevOps. Your assistant is live in about a minute.
            </p>
          </div>
          <div className="bg-card border border-border p-6 rounded-xl hover:border-primary/50 transition">
            <div className="text-3xl mb-4">🧠</div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Powered by Claude</h3>
            <p className="text-muted-foreground">
              The best AI for real work — writing, research, planning, and deep task execution.
            </p>
          </div>
          <div className="bg-card border border-border p-6 rounded-xl hover:border-primary/50 transition">
            <div className="text-3xl mb-4">🔋</div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Browser Automation</h3>
            <p className="text-muted-foreground">
              Screenshots, web scraping, and browser control included out of the box.
            </p>
          </div>
          <div className="bg-card border border-border p-6 rounded-xl hover:border-primary/50 transition">
            <div className="text-3xl mb-4">💬</div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Chat on Telegram</h3>
            <p className="text-muted-foreground">
              Your assistant lives where you already work. WhatsApp is next.
            </p>
          </div>
          <div className="bg-card border border-border p-6 rounded-xl hover:border-primary/50 transition">
            <div className="text-3xl mb-4">🔑</div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Secure by Default</h3>
            <p className="text-muted-foreground">
              Share secrets in the dashboard, not in chat. Your data stays in your instance.
            </p>
          </div>
          <div className="bg-card border border-border p-6 rounded-xl hover:border-primary/50 transition">
            <div className="text-3xl mb-4">💰</div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Usage-Based Pricing</h3>
            <p className="text-muted-foreground">
              $19 or $39/month includes hosting and credits. Pay only for what you use beyond that.
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
                <div className="text-6xl font-bold text-primary mb-2">~1 min</div>
                <p className="text-muted-foreground text-center max-w-xs">
                  Sign up, pick a plan, connect Telegram — your assistant is live.
                </p>
              </div>
              <p className="text-xs text-muted-foreground mt-4 text-center">
                Servers are pre-configured and waiting. Simple, secure, fast.
              </p>
            </div>
          </div>
        </div>

        {/* Get Started */}
        <div className="max-w-5xl mx-auto px-6 py-20">
          <h2 className="text-3xl font-bold text-foreground text-center mb-4">Get Started in 5 Minutes</h2>
          <p className="text-muted-foreground text-center mb-10">
            Watch the quick walkthrough, then follow the steps below.
          </p>
          <div className="flex flex-col items-center gap-10">
            <div className="w-full max-w-3xl">
              <div className="relative w-full pt-[56.25%] rounded-xl overflow-hidden border border-border bg-card">
                <iframe
                  src="https://www.loom.com/embed/52635d7f2e0b4b2d83ba406523930a5a"
                  title="BlitzClaw - Get Started in 5 Minutes"
                  className="absolute inset-0 h-full w-full"
                  allowFullScreen
                />
              </div>
            </div>
            <ol className="w-full max-w-3xl space-y-4 text-muted-foreground">
              <li className="bg-card border border-border rounded-xl p-4">
                <span className="text-foreground font-medium">1. Sign up</span> — Click "Create Your Own Agent" and sign in with Google or email
              </li>
              <li className="bg-card border border-border rounded-xl p-4">
                <span className="text-foreground font-medium">2. Pick a plan</span> — Basic ($19/mo) or Pro ($39/mo)
              </li>
              <li className="bg-card border border-border rounded-xl p-4">
                <span className="text-foreground font-medium">3. Create your Telegram bot</span> — Open Telegram, search @BotFather, send /newbot, copy the token
              </li>
              <li className="bg-card border border-border rounded-xl p-4">
                <span className="text-foreground font-medium">4. Connect</span> — Paste your bot token in the dashboard
              </li>
              <li className="bg-card border border-border rounded-xl p-4">
                <span className="text-foreground font-medium">5. Start chatting</span> — Open your bot in Telegram and say hi! 🎉
              </li>
            </ol>
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
                <h3 className="font-semibold text-foreground mb-1">Sign up & pick a plan</h3>
                <p className="text-muted-foreground">
                  Choose $19 or $39/month. Hosting and credits included — no API keys required.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4 p-6 bg-card border border-border rounded-xl">
              <div className="w-10 h-10 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold shrink-0">
                2
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1">Connect Telegram</h3>
                <p className="text-muted-foreground">
                  Use @BotFather to create a bot and paste the token. It’s quick.
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
                  Your assistant is live. Ask it to research, automate the browser, or run tasks. More chat apps coming soon.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* FAQ */}
        <div className="max-w-4xl mx-auto px-6 py-20">
          <h2 className="text-3xl font-bold text-foreground text-center mb-12">FAQ</h2>
          <div className="space-y-6">
            <div className="bg-card border border-border rounded-xl p-6">
              <h3 className="font-semibold text-foreground mb-2">Do I need my own API key?</h3>
              <p className="text-muted-foreground">
                No. BlitzClaw includes managed model access — you don&apos;t need to bring your own API keys.
              </p>
            </div>
            <div className="bg-card border border-border rounded-xl p-6">
              <h3 className="font-semibold text-foreground mb-2">Do I need to switch plans as my usage changes?</h3>
              <p className="text-muted-foreground">
                No plan switching is required for normal usage changes. Your usage is metered automatically after included credits.
              </p>
            </div>
            <div className="bg-card border border-border rounded-xl p-6">
              <h3 className="font-semibold text-foreground mb-2">Do I need to top up balance manually?</h3>
              <p className="text-muted-foreground">
                No. Billing is automatic via metered usage, so there&apos;s no separate wallet or manual top-up flow.
              </p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="max-w-4xl mx-auto px-6 py-20 text-center">
          <div className="bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 rounded-2xl p-12">
            <h2 className="text-3xl font-bold text-foreground mb-4">
              Ready to get your assistant live?
            </h2>
            <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
              Go from signup to Telegram chat in about a minute. No setup, no servers.
            </p>
            <SignedOut>
              <SignInButton mode="modal">
                <button className="px-8 py-4 bg-primary text-primary-foreground text-lg font-medium rounded-xl hover:bg-primary/90 transition">
                  Get Started — from $19/mo →
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
