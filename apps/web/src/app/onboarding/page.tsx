"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle, Circle, Loader2, Bot, CreditCard, Sparkles, ExternalLink } from "lucide-react";

type Step = "billing" | "telegram" | "persona" | "launching";

interface OnboardingState {
  step: Step;
  hasSubscription: boolean;
  autoTopup: boolean;
  telegramToken: string;
  telegramBotName: string;
  persona: string;
  instanceId: string | null;
}

export default function OnboardingPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [state, setState] = useState<OnboardingState>({
    step: "billing",
    hasSubscription: false,
    autoTopup: true,
    telegramToken: "",
    telegramBotName: "",
    persona: "assistant",
    instanceId: null,
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if returning from Creem checkout
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
    
    try {
      const res = await fetch("/api/billing/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoTopup: state.autoTopup }),
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to start subscription");
      }
      
      const { checkoutUrl } = await res.json();
      
      // Save auto-topup preference
      localStorage.setItem("blitzclaw_auto_topup", state.autoTopup ? "true" : "false");
      
      // Redirect to Creem
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
    
    try {
      const res = await fetch("/api/instances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telegramToken: state.telegramToken,
          persona: state.persona,
          autoTopup: state.autoTopup,
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
          <p className="text-gray-400">Let's get your AI assistant running in minutes</p>
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
                <h2 className="text-2xl font-semibold">Set Up Billing</h2>
              </div>
              
              <div className="space-y-6">
                <div className="bg-gray-800 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-lg font-medium">BlitzClaw Subscription</span>
                    <span className="text-2xl font-bold">€20<span className="text-sm text-gray-400">/mo</span></span>
                  </div>
                  <ul className="text-gray-400 text-sm space-y-1">
                    <li>✓ €10 credits included each month</li>
                    <li>✓ Deploy your own AI assistant</li>
                    <li>✓ Telegram integration</li>
                    <li>✓ Usage-based pricing with 100% markup</li>
                  </ul>
                </div>

                <div className="bg-gray-800/50 rounded-lg p-4">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={state.autoTopup}
                      onChange={(e) => setState(s => ({ ...s, autoTopup: e.target.checked }))}
                      className="mt-1 w-5 h-5 rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <span className="font-medium">Keep me funded</span>
                      <p className="text-sm text-gray-400 mt-1">
                        Automatically add €25 when your balance falls below €5. 
                        You can change this anytime in settings.
                      </p>
                    </div>
                  </label>
                </div>

                <div className="text-sm text-gray-500 bg-gray-800/30 rounded-lg p-3">
                  <p className="mb-2">
                    <strong>Daily limit:</strong> €200/day maximum spend
                  </p>
                  <p>
                    <strong>Typical usage:</strong> €2-40/day depending on conversation volume
                  </p>
                </div>

                <button
                  onClick={handleSubscribe}
                  disabled={loading}
                  className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed rounded-lg font-medium flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      Continue to Payment
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
                    <li>Choose a name for your bot (e.g., "My AI Assistant")</li>
                    <li>Choose a username ending in "bot" (e.g., "my_ai_assistant_bot")</li>
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
      </div>
    </div>
  );
}
