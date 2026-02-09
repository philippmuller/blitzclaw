"use client";

import { useState, useEffect, Suspense } from "react";
import { useUser, useClerk } from "@clerk/nextjs";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle, Circle, Loader2, Bot, CreditCard, Sparkles, ExternalLink, Key } from "lucide-react";

type Step = "billing" | "telegram" | "persona" | "launching";

type Tier = "basic" | "pro";
type BillingMode = "byok" | "managed";

interface OnboardingState {
  step: Step;
  hasSubscription: boolean;
  hasOwnKey: boolean;
  billingMode: BillingMode;
  tier: Tier;
  autoTopup: boolean;
  anthropicKey: string;
  telegramToken: string;
  telegramBotName: string;
  persona: string;
  instanceId: string | null;
}

function OnboardingContent() {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [state, setState] = useState<OnboardingState>({
    step: "billing",
    hasSubscription: false,
    hasOwnKey: true, // Default to BYOK
    billingMode: "byok",
    tier: "basic",
    autoTopup: true,
    anthropicKey: "",
    telegramToken: "",
    telegramBotName: "",
    persona: "assistant",
    instanceId: null,
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if returning from checkout
  useEffect(() => {
    const subscription = searchParams.get("subscription");
    if (subscription === "success") {
      setState(s => ({ ...s, step: "telegram", hasSubscription: true }));
    }
  }, [searchParams]);

  // Check existing subscription on load
  useEffect(() => {
    if (isLoaded && user) {
      checkUserStatus();
    }
  }, [isLoaded, user]);

  async function checkUserStatus() {
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        if (data.balance && data.balance > 0) {
          setState(s => ({ ...s, hasSubscription: true, step: "telegram" }));
        }
        if (data.instances && data.instances.length > 0) {
          // Already has instance, go to dashboard
          router.push("/dashboard");
        }
      }
    } catch (e) {
      console.error("Failed to check user status:", e);
    }
  }

  async function handleSubscribe() {
    setLoading(true);
    setError(null);
    
    const effectiveBillingMode = state.hasOwnKey ? "byok" : "managed";
    const effectiveTier = state.hasOwnKey ? "byok" : state.tier;
    
    try {
      const res = await fetch("/api/billing/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          tier: effectiveTier, 
          autoTopup: state.autoTopup,
          anthropicKey: state.hasOwnKey ? state.anthropicKey : undefined,
        }),
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to start subscription");
      }
      
      const { checkoutUrl } = await res.json();
      
      // Save auto-topup preference and anthropic key for instance creation
      localStorage.setItem("blitzclaw_auto_topup", state.autoTopup ? "true" : "false");
      localStorage.setItem("blitzclaw_billing_mode", effectiveBillingMode);
      if (state.hasOwnKey && state.anthropicKey) {
        localStorage.setItem("blitzclaw_anthropic_key", state.anthropicKey);
      }
      
      // Redirect to Creem checkout
      window.location.href = checkoutUrl;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setLoading(false);
    }
  }

  async function handleValidateTelegram() {
    setLoading(true);
    setError(null);
    
    try {
      const res = await fetch("/api/telegram/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bot_token: state.telegramToken }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || "Invalid bot token");
      }
      
      setState(s => ({ ...s, telegramBotName: data.bot?.username || "your bot", step: "persona" }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid token");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateInstance() {
    setLoading(true);
    setError(null);
    setState(s => ({ ...s, step: "launching" }));
    
    // Get anthropic key from localStorage (saved during subscription)
    const anthropicKey = localStorage.getItem("blitzclaw_anthropic_key");
    
    try {
      const res = await fetch("/api/instances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telegramToken: state.telegramToken,
          persona: state.persona,
          autoTopup: state.autoTopup,
          anthropicKey: anthropicKey || undefined,
        }),
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create instance");
      }
      
      const { id } = await res.json();
      setState(s => ({ ...s, instanceId: id }));
      
      // Poll for instance to be ready
      pollInstanceStatus(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create instance");
      setState(s => ({ ...s, step: "persona" }));
      setLoading(false);
    }
  }

  async function pollInstanceStatus(instanceId: string) {
    const maxAttempts = 60; // 5 minutes
    let attempts = 0;
    
    const poll = async () => {
      try {
        const res = await fetch(`/api/instances/${instanceId}`);
        if (res.ok) {
          const instance = await res.json();
          if (instance.status === "ACTIVE") {
            router.push(`/dashboard?welcome=true`);
            return;
          }
        }
      } catch (e) {
        console.error("Poll error:", e);
      }
      
      attempts++;
      if (attempts < maxAttempts) {
        setTimeout(poll, 5000);
      } else {
        setError("Instance took too long to start. Check dashboard for status.");
        setLoading(false);
      }
    };
    
    poll();
  }

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-2xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold mb-2">Welcome to BlitzClaw</h1>
          <p className="text-gray-400">Let&apos;s get your AI assistant running in minutes</p>
          <button
            onClick={() => signOut({ redirectUrl: "/" })}
            className="mt-4 text-sm text-gray-500 hover:text-gray-300 underline"
          >
            Cancel and return to home
          </button>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center mb-12 gap-2">
          {[
            { key: "billing", label: "Billing" },
            { key: "telegram", label: "Telegram" },
            { key: "persona", label: "Persona" },
            { key: "launching", label: "Launch" },
          ].map((s, i) => {
            const isActive = state.step === s.key;
            const isPast = 
              (s.key === "billing" && ["telegram", "persona", "launching"].includes(state.step)) ||
              (s.key === "telegram" && ["persona", "launching"].includes(state.step)) ||
              (s.key === "persona" && state.step === "launching");
            
            return (
              <div key={s.key} className="flex items-center">
                <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${
                  isActive ? "bg-blue-600" : isPast ? "bg-green-600" : "bg-gray-800"
                }`}>
                  {isPast ? (
                    <CheckCircle className="w-4 h-4" />
                  ) : isActive ? (
                    <Circle className="w-4 h-4 fill-current" />
                  ) : (
                    <Circle className="w-4 h-4" />
                  )}
                  <span className="text-sm">{s.label}</span>
                </div>
                {i < 3 && <div className="w-8 h-px bg-gray-700 mx-1" />}
              </div>
            );
          })}
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-900/50 border border-red-700 rounded-lg text-red-200">
            {error}
          </div>
        )}

        {/* Step Content */}
        <div className="bg-gray-900 rounded-xl p-8 border border-gray-800">
          {/* STEP 1: Billing */}
          {state.step === "billing" && (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <CreditCard className="w-8 h-8 text-blue-500" />
                <h2 className="text-2xl font-semibold">Choose Your Plan</h2>
              </div>
              
              <div className="space-y-6">
                {/* Toggle: Do you have your own API key? */}
                <div className="p-4 bg-gray-800/50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Key className="w-5 h-5 text-gray-400" />
                      <span className="font-medium">I have my own Anthropic API key</span>
                    </div>
                    <button
                      onClick={() => setState(s => ({ ...s, hasOwnKey: !s.hasOwnKey }))}
                      className={`relative w-14 h-7 rounded-full transition-colors ${
                        state.hasOwnKey ? "bg-blue-600" : "bg-gray-600"
                      }`}
                    >
                      <span
                        className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform ${
                          state.hasOwnKey ? "translate-x-8" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* BYOK Mode */}
                {state.hasOwnKey && (
                  <div className="space-y-4">
                    <div className="p-5 rounded-xl border border-blue-500 bg-blue-900/20">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <span className="text-lg font-semibold">Bring Your Own Key</span>
                          <p className="text-sm text-gray-400 mt-1">You pay Anthropic directly for AI usage</p>
                        </div>
                        <span className="text-2xl font-bold">€14<span className="text-sm text-gray-400 font-normal">/mo</span></span>
                      </div>
                      <ul className="text-gray-400 text-sm space-y-1">
                        <li>✓ Dedicated server included</li>
                        <li>✓ Full control over your AI costs</li>
                        <li>✓ Use Claude Opus, Sonnet, or Haiku</li>
                      </ul>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Anthropic API Key</label>
                      <input
                        type="password"
                        value={state.anthropicKey}
                        onChange={(e) => setState(s => ({ ...s, anthropicKey: e.target.value }))}
                        placeholder="sk-ant-api03-..."
                        className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                      />
                      <p className="text-xs text-gray-500 mt-2">
                        Get your key at <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">console.anthropic.com</a>
                      </p>
                    </div>
                  </div>
                )}

                {/* Managed Mode */}
                {!state.hasOwnKey && (
                  <div className="space-y-4">
                    <div className="text-sm text-gray-400 mb-4">
                      No API key? No problem. We handle everything — just top up credits when you need them.
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Basic Tier */}
                      <button
                        onClick={() => setState(s => ({ ...s, tier: "basic" }))}
                        className={`p-5 rounded-xl border text-left transition-all ${
                          state.tier === "basic"
                            ? "border-blue-500 bg-blue-900/20 ring-2 ring-blue-500/50"
                            : "border-gray-700 bg-gray-800 hover:border-gray-600"
                        }`}
                      >
                        <div className="flex justify-between items-start mb-3">
                          <span className="text-lg font-semibold">Basic</span>
                          <span className="text-2xl font-bold">€19<span className="text-sm text-gray-400 font-normal">/mo</span></span>
                        </div>
                        <ul className="text-gray-400 text-sm space-y-1">
                          <li>✓ Dedicated server</li>
                          <li>✓ €10 credits included</li>
                          <li>✓ Top up anytime</li>
                        </ul>
                      </button>

                      {/* Pro Tier */}
                      <button
                        onClick={() => setState(s => ({ ...s, tier: "pro" }))}
                        className={`p-5 rounded-xl border text-left transition-all relative ${
                          state.tier === "pro"
                            ? "border-blue-500 bg-blue-900/20 ring-2 ring-blue-500/50"
                            : "border-gray-700 bg-gray-800 hover:border-gray-600"
                        }`}
                      >
                        <span className="absolute -top-2 right-3 bg-green-600 text-xs px-2 py-0.5 rounded-full">Best Value</span>
                        <div className="flex justify-between items-start mb-3">
                          <span className="text-lg font-semibold">Pro</span>
                          <span className="text-2xl font-bold">€119<span className="text-sm text-gray-400 font-normal">/mo</span></span>
                        </div>
                        <ul className="text-gray-400 text-sm space-y-1">
                          <li>✓ Dedicated server</li>
                          <li>✓ €100 credits included</li>
                          <li>✓ Priority support</li>
                        </ul>
                      </button>
                    </div>

                    <div className="text-sm text-yellow-200/80 bg-yellow-900/20 rounded-lg p-4 border border-yellow-800/50">
                      <p>
                        <strong>Coming Soon:</strong> Managed billing is not available yet. 
                        For now, toggle &quot;I have my own API key&quot; above and use BYOK mode.
                      </p>
                    </div>
                  </div>
                )}

                {/* Info Box */}
                <div className="text-sm text-gray-400 bg-gray-800/50 rounded-lg p-4">
                  <p>
                    Every plan runs on its own <strong className="text-gray-300">secure, isolated server</strong>. 
                    {state.hasOwnKey 
                      ? " With BYOK, typical AI usage costs $2-40/day depending on how much you chat."
                      : " Credits are used for AI responses. Top up via our dashboard when you run low."
                    }
                  </p>
                </div>

                <button
                  onClick={handleSubscribe}
                  disabled={
                    loading || 
                    (!state.hasOwnKey) || // Managed not available yet
                    (state.hasOwnKey && !state.anthropicKey.startsWith("sk-ant-"))
                  }
                  className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg font-medium flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : !state.hasOwnKey ? (
                    "Coming Soon"
                  ) : (
                    <>
                      Continue — €14/mo
                      <ExternalLink className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Telegram */}
          {state.step === "telegram" && (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <Bot className="w-8 h-8 text-blue-500" />
                <h2 className="text-2xl font-semibold">Create Telegram Bot</h2>
              </div>
              
              <div className="space-y-6">
                <div className="bg-gray-800 rounded-lg p-4">
                  <h3 className="font-medium mb-3">Instructions:</h3>
                  <ol className="text-gray-300 text-sm space-y-2 list-decimal list-inside">
                    <li>Open Telegram and search for <code className="bg-gray-700 px-1 rounded">@BotFather</code></li>
                    <li>Send <code className="bg-gray-700 px-1 rounded">/newbot</code></li>
                    <li>Choose a name for your bot (e.g., &quot;My AI Assistant&quot;)</li>
                    <li>Choose a username ending in &quot;bot&quot; (e.g., &quot;my_ai_assistant_bot&quot;)</li>
                    <li>Copy the API token BotFather gives you</li>
                  </ol>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Bot Token</label>
                  <input
                    type="text"
                    value={state.telegramToken}
                    onChange={(e) => setState(s => ({ ...s, telegramToken: e.target.value }))}
                    placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <button
                  onClick={handleValidateTelegram}
                  disabled={loading || !state.telegramToken.includes(":")}
                  className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg font-medium flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    "Validate & Continue"
                  )}
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Persona */}
          {state.step === "persona" && (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <Sparkles className="w-8 h-8 text-blue-500" />
                <h2 className="text-2xl font-semibold">Choose Persona</h2>
              </div>

              {state.telegramBotName && (
                <div className="mb-6 p-3 bg-green-900/30 border border-green-700 rounded-lg text-green-300 text-sm">
                  ✓ Connected to @{state.telegramBotName}
                </div>
              )}
              
              <div className="space-y-6">
                <div className="grid grid-cols-1 gap-3">
                  {[
                    { id: "assistant", name: "General Assistant", desc: "Helpful, balanced, professional" },
                    { id: "creative", name: "Creative Writer", desc: "Imaginative, expressive, artistic" },
                    { id: "coder", name: "Code Helper", desc: "Technical, precise, developer-focused" },
                    { id: "casual", name: "Casual Friend", desc: "Relaxed, friendly, conversational" },
                  ].map((p) => (
                    <label
                      key={p.id}
                      className={`flex items-center gap-4 p-4 rounded-lg border cursor-pointer transition-colors ${
                        state.persona === p.id
                          ? "border-blue-500 bg-blue-900/20"
                          : "border-gray-700 bg-gray-800 hover:border-gray-600"
                      }`}
                    >
                      <input
                        type="radio"
                        name="persona"
                        value={p.id}
                        checked={state.persona === p.id}
                        onChange={(e) => setState(s => ({ ...s, persona: e.target.value }))}
                        className="w-5 h-5 text-blue-600"
                      />
                      <div>
                        <div className="font-medium">{p.name}</div>
                        <div className="text-sm text-gray-400">{p.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>

                <button
                  onClick={handleCreateInstance}
                  disabled={loading}
                  className="w-full py-3 px-4 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg font-medium flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    "Launch My Assistant 🚀"
                  )}
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: Launching */}
          {state.step === "launching" && (
            <div className="text-center py-8">
              <Loader2 className="w-16 h-16 animate-spin text-blue-500 mx-auto mb-6" />
              <h2 className="text-2xl font-semibold mb-2">Launching Your Assistant</h2>
              <p className="text-gray-400 mb-6">
                Setting up your server and connecting to Telegram...
              </p>
              <div className="text-sm text-gray-500">
                This usually takes 1-2 minutes
              </div>
            </div>
          )}
        </div>

        {/* Security Disclaimer */}
        <div className="mt-8 p-4 bg-yellow-900/20 border border-yellow-800/50 rounded-lg">
          <p className="text-yellow-200/80 text-xs leading-relaxed">
            <strong>⚠️ Security Notice:</strong> BlitzClaw instances are for personal use. 
            Your assistant runs on a dedicated server with access to tools you enable. 
            Security risks increase with skills and integrations you add (email, file access, etc.). 
            We work to provide safe defaults, but prompt injection and other vulnerabilities remain possible. 
            This is an open-source, hacker-friendly project — use at your own risk and avoid storing 
            highly sensitive data. By continuing, you acknowledge these risks.
          </p>
        </div>
      </div>
    </div>
  );
}

// Wrap in Suspense for useSearchParams
export default function OnboardingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    }>
      <OnboardingContent />
    </Suspense>
  );
}
