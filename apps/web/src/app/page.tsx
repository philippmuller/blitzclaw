import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";
import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <nav className="flex justify-between items-center p-6 max-w-7xl mx-auto">
        <div className="text-2xl font-bold text-blue-600">⚡ BlitzClaw</div>
        <div className="flex items-center gap-4">
          <SignedOut>
            <SignInButton mode="modal">
              <button className="px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition">
                Sign In
              </button>
            </SignInButton>
          </SignedOut>
          <SignedIn>
            <Link
              href="/dashboard"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Dashboard
            </Link>
            <UserButton afterSignOutUrl="/" />
          </SignedIn>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-20 text-center">
        <h1 className="text-5xl font-bold text-gray-900 mb-6">
          Deploy Your AI Assistant in{" "}
          <span className="text-blue-600">Seconds</span>
        </h1>
        <p className="text-xl text-gray-600 mb-10">
          One-click OpenClaw deployment. Telegram & WhatsApp ready.
          <br />
          Usage-based billing. No API keys needed.
        </p>
        <SignedOut>
          <SignInButton mode="modal">
            <button className="px-8 py-4 bg-blue-600 text-white text-lg rounded-xl hover:bg-blue-700 transition shadow-lg hover:shadow-xl">
              Get Started →
            </button>
          </SignInButton>
        </SignedOut>
        <SignedIn>
          <Link
            href="/dashboard"
            className="inline-block px-8 py-4 bg-blue-600 text-white text-lg rounded-xl hover:bg-blue-700 transition shadow-lg hover:shadow-xl"
          >
            Go to Dashboard →
          </Link>
        </SignedIn>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-10 grid md:grid-cols-3 gap-8">
        <div className="bg-white p-6 rounded-xl shadow-md">
          <div className="text-3xl mb-4">🚀</div>
          <h3 className="text-lg font-semibold mb-2">Instant Setup</h3>
          <p className="text-gray-600">
            From signup to chatting with your AI in under 5 minutes.
          </p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-md">
          <div className="text-3xl mb-4">💰</div>
          <h3 className="text-lg font-semibold mb-2">Pay as You Go</h3>
          <p className="text-gray-600">
            $10 minimum balance. Only pay for what you use.
          </p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-md">
          <div className="text-3xl mb-4">🔒</div>
          <h3 className="text-lg font-semibold mb-2">Your Own Instance</h3>
          <p className="text-gray-600">
            Dedicated server. Full isolation. Your data stays yours.
          </p>
        </div>
      </div>
    </main>
  );
}
