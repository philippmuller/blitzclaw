import Link from "next/link";
import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";

export const metadata = {
  title: "Guides & Tips | BlitzClaw",
  description: "Get more out of your BlitzClaw assistant with these guides.",
};

export default function GuidesPage() {
  return (
    <main className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="flex justify-between items-center p-6 max-w-7xl mx-auto">
        <Link href="/" className="text-2xl font-bold text-foreground flex items-center gap-2">
          <span>⚡</span> BlitzClaw
        </Link>
        <div className="flex items-center gap-4">
          <Link
            href="/pricing"
            className="px-4 py-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition"
          >
            Pricing
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
      <div className="max-w-5xl mx-auto px-6 pt-12 pb-6 text-center">
        <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
          Guides &amp; Tips
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Get more out of your BlitzClaw assistant with these guides.
        </p>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-10 space-y-10">
        <section className="bg-card border border-border rounded-2xl p-8">
          <h2 className="text-2xl font-bold text-foreground mb-4">📁 File Sync with Syncthing</h2>
          <p className="text-muted-foreground mb-6">
            Your assistant can create files (plans, documents, code). With Syncthing, they
            automatically sync to your Mac or PC.
          </p>

          <h3 className="text-foreground font-semibold mb-3">Setup:</h3>
          <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
            <li>Ask your assistant: <span className="text-foreground">&quot;Install Syncthing and set up file sync&quot;</span></li>
            <li>Your assistant will give you a Device ID</li>
            <li>
              Install Syncthing on your computer:
              <ul className="list-disc list-inside mt-2 ml-4 space-y-1">
                <li>
                  Mac: <span className="text-foreground">brew install syncthing</span> or download from syncthing.net
                </li>
                <li>Windows: Download from syncthing.net</li>
              </ul>
            </li>
            <li>Open Syncthing (localhost:8384), add the Device ID</li>
            <li>Accept the shared folder request</li>
            <li>Done — files sync automatically!</li>
          </ol>

          <p className="text-muted-foreground mt-6">
            <span className="text-foreground font-semibold">Pro tip:</span> Your assistant&apos;s workspace is at
            <span className="text-foreground"> ~/.openclaw/workspace</span>. Ask it to save files there for easy access.
          </p>
        </section>

        <section className="bg-card border border-border rounded-2xl p-8">
          <h2 className="text-2xl font-bold text-foreground mb-4">💬 Connect Discord</h2>
          <p className="text-muted-foreground mb-6">
            Use your assistant via Discord alongside Telegram.
          </p>

          <h3 className="text-foreground font-semibold mb-3">Setup:</h3>
          <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
            <li>Go to discord.com/developers/applications</li>
            <li>Click &quot;New Application&quot; → name it → Create</li>
            <li>Go to &quot;Bot&quot; → &quot;Add Bot&quot; → Copy the token</li>
            <li>
              Go to &quot;OAuth2&quot; → &quot;URL Generator&quot;:
              <ul className="list-disc list-inside mt-2 ml-4 space-y-1">
                <li>Scopes: <span className="text-foreground">bot</span></li>
                <li>Permissions: Send Messages, Read Message History</li>
                <li>Copy the URL and open it to invite the bot to your server</li>
              </ul>
            </li>
            <li>Ask your BlitzClaw assistant: <span className="text-foreground">&quot;Add Discord channel with token: [YOUR_TOKEN]&quot;</span></li>
            <li>Done — message your bot on Discord!</li>
          </ol>

          <p className="text-muted-foreground mt-6">
            <span className="text-foreground font-semibold">Note:</span> Both Telegram and Discord work simultaneously.
            Same assistant, multiple channels.
          </p>
        </section>

        <section className="bg-card border border-border rounded-2xl p-8">
          <h2 className="text-2xl font-bold text-foreground mb-4">🔑 Using Secrets</h2>
          <p className="text-muted-foreground mb-6">
            Store sensitive info (API keys, passwords) securely in the dashboard — not in chat.
          </p>
          <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
            <li>Go to your BlitzClaw dashboard</li>
            <li>Click &quot;Secrets&quot;</li>
            <li>Add key-value pairs (e.g., <span className="text-foreground">OPENAI_KEY = sk-...</span>)</li>
            <li>Your assistant can access these without them appearing in chat history</li>
          </ol>
        </section>

        <section className="bg-card border border-border rounded-2xl p-8">
          <h2 className="text-2xl font-bold text-foreground mb-4">🌐 Browser Automation</h2>
          <p className="text-muted-foreground mb-6">
            Your assistant can browse the web, take screenshots, and interact with websites.
          </p>

          <h3 className="text-foreground font-semibold mb-3">Examples:</h3>
          <ul className="list-disc list-inside space-y-2 text-muted-foreground">
            <li>&quot;Take a screenshot of example.com&quot;</li>
            <li>&quot;Search Google for AI news and summarize the top 5 results&quot;</li>
            <li>
              &quot;Log into [site] and check my notifications&quot; (requires storing credentials in Secrets)
            </li>
          </ul>
        </section>
      </div>

      {/* Footer Links */}
      <div className="max-w-4xl mx-auto px-6 pb-16">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 text-sm">
          <Link href="/" className="text-muted-foreground hover:text-foreground transition">
            ← Back to Home
          </Link>
          <span className="text-muted-foreground/40">|</span>
          <Link href="/pricing" className="text-muted-foreground hover:text-foreground transition">
            View Pricing
          </Link>
        </div>
      </div>
    </main>
  );
}
