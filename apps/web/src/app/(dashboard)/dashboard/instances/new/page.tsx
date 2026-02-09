"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PersonaPicker, SoulEditor, getPersonaTemplate } from "@/components";

type Step = "channel" | "persona" | "model" | "soul" | "confirm";
type Channel = "telegram" | "whatsapp";
type Persona = "assistant" | "developer" | "creative" | "custom";
type Model = "claude-opus-4-6" | "claude-sonnet-4-5" | "claude-haiku-4-5";

const MODELS: { id: Model; name: string; description: string; price: string }[] = [
  {
    id: "claude-opus-4-6",
    name: "Claude Opus 4",
    description: "Most intelligent. Best for complex tasks, coding, and deep analysis.",
    price: "$10/$50 per MTok",
  },
  {
    id: "claude-sonnet-4-5",
    name: "Claude Sonnet 4",
    description: "Balanced. Great for most tasks with good speed and quality.",
    price: "$6/$30 per MTok",
  },
  {
    id: "claude-haiku-4-5",
    name: "Claude 3.5 Haiku",
    description: "Fastest and cheapest. Good for simple tasks and high volume.",
    price: "$1.60/$8 per MTok",
  },
];

export default function NewInstancePage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("channel");
  const [channel, setChannel] = useState<Channel>("telegram");
  const [telegramToken, setTelegramToken] = useState("");
  const [persona, setPersona] = useState<Persona>("assistant");
  const [model, setModel] = useState<Model>("claude-opus-4-6");
  const [soulMd, setSoulMd] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePersonaSelect = (p: Persona) => {
    setPersona(p);
    if (p !== "custom") {
      setSoulMd(getPersonaTemplate(p));
    } else {
      setSoulMd("");
    }
  };

  const handleCreate = async () => {
    setCreating(true);
    setError(null);

    try {
      const res = await fetch("/api/instances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel_type: channel,
          persona_template: persona,
          model: model,
          soul_md: soulMd || undefined,
          telegramToken: channel === "telegram" ? telegramToken : undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || data.message || "Failed to create instance");
      }

      router.push(`/dashboard/instances/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create instance");
      setCreating(false);
    }
  };

  const steps: { id: Step; label: string }[] = [
    { id: "channel", label: "Channel" },
    { id: "persona", label: "Persona" },
    { id: "model", label: "Model" },
    { id: "soul", label: "SOUL.md" },
    { id: "confirm", label: "Confirm" },
  ];

  const stepIndex = steps.findIndex((s) => s.id === step);

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/instances"
          className="p-2 rounded-lg hover:bg-secondary text-muted-foreground"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Create Instance</h1>
          <p className="text-muted-foreground">Set up your new AI assistant</p>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center gap-2">
        {steps.map((s, i) => (
          <div key={s.id} className="flex items-center flex-1">
            <button
              onClick={() => i < stepIndex && setStep(s.id)}
              disabled={i > stepIndex}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition ${
                i === stepIndex
                  ? "bg-primary text-primary-foreground"
                  : i < stepIndex
                  ? "bg-green-600/20 text-green-400 hover:bg-green-600/30 cursor-pointer"
                  : "bg-secondary text-muted-foreground cursor-not-allowed"
              }`}
            >
              {i < stepIndex ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <span>{i + 1}</span>
              )}
              <span className="hidden sm:inline">{s.label}</span>
            </button>
            {i < steps.length - 1 && (
              <div className={`flex-1 h-0.5 mx-2 ${i < stepIndex ? "bg-green-600" : "bg-secondary"}`} />
            )}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <div className="bg-card border border-border rounded-xl p-6">
        {/* Channel Selection */}
        {step === "channel" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-2">Select Channel</h2>
              <p className="text-muted-foreground">
                Choose how you want to communicate with your AI assistant.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={() => setChannel("telegram")}
                className={`p-5 rounded-xl border text-left transition-all ${
                  channel === "telegram"
                    ? "border-primary bg-primary/10 ring-2 ring-primary/50"
                    : "border-border bg-card hover:border-primary/50"
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className="text-4xl">📱</div>
                  <div>
                    <h3 className="font-semibold text-foreground">Telegram</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Connect a Telegram bot. Fast setup, reliable messaging.
                    </p>
                  </div>
                </div>
              </button>

              <button
                disabled
                className="p-5 rounded-xl border border-border bg-secondary/50 text-left opacity-60 cursor-not-allowed"
              >
                <div className="flex items-start gap-4">
                  <div className="text-4xl">💬</div>
                  <div>
                    <h3 className="font-semibold text-muted-foreground">WhatsApp</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Coming soon. Connect via WhatsApp Web.
                    </p>
                    <span className="inline-block mt-2 text-xs px-2 py-1 bg-secondary rounded">
                      Coming Soon
                    </span>
                  </div>
                </div>
              </button>
            </div>

            {/* Telegram Bot Token Input */}
            {channel === "telegram" && (
              <div className="space-y-3">
                <label className="block">
                  <span className="text-sm font-medium text-foreground">Telegram Bot Token</span>
                  <p className="text-xs text-muted-foreground mt-1 mb-2">
                    Get this from <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">@BotFather</a> on Telegram
                  </p>
                  <input
                    type="text"
                    value={telegramToken}
                    onChange={(e) => setTelegramToken(e.target.value)}
                    placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
                    className="w-full px-4 py-2.5 bg-secondary border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 font-mono text-sm"
                  />
                </label>
              </div>
            )}

            <div className="flex justify-end">
              <button
                onClick={() => setStep("persona")}
                disabled={channel === "telegram" && !telegramToken.trim()}
                className="px-6 py-2.5 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {/* Persona Selection */}
        {step === "persona" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-2">Choose Persona</h2>
              <p className="text-muted-foreground">
                Select a template or create a custom personality for your AI.
              </p>
            </div>

            <PersonaPicker selected={persona} onSelect={handlePersonaSelect} />

            <div className="flex justify-between">
              <button
                onClick={() => setStep("channel")}
                className="px-6 py-2.5 border border-border text-foreground font-medium rounded-lg hover:bg-secondary transition"
              >
                Back
              </button>
              <button
                onClick={() => setStep("model")}
                className="px-6 py-2.5 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 transition"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {/* Model Selection */}
        {step === "model" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-2">Select AI Model</h2>
              <p className="text-muted-foreground">
                Choose the Claude model for your assistant. You can&apos;t change this later without recreating the instance.
              </p>
            </div>

            <div className="space-y-3">
              {MODELS.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setModel(m.id)}
                  className={`w-full p-4 rounded-xl border text-left transition-all ${
                    model === m.id
                      ? "border-primary bg-primary/10 ring-2 ring-primary/50"
                      : "border-border bg-card hover:border-primary/50"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-foreground">{m.name}</h3>
                      <p className="text-sm text-muted-foreground mt-1">{m.description}</p>
                    </div>
                    <span className="text-xs font-mono text-muted-foreground bg-secondary px-2 py-1 rounded">
                      {m.price}
                    </span>
                  </div>
                </button>
              ))}
            </div>

            <div className="flex justify-between">
              <button
                onClick={() => setStep("persona")}
                className="px-6 py-2.5 border border-border text-foreground font-medium rounded-lg hover:bg-secondary transition"
              >
                Back
              </button>
              <button
                onClick={() => setStep("soul")}
                className="px-6 py-2.5 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 transition"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {/* SOUL.md Editor */}
        {step === "soul" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-2">
                {persona === "custom" ? "Write Your SOUL.md" : "Review SOUL.md"}
              </h2>
              <p className="text-muted-foreground">
                {persona === "custom"
                  ? "Define your AI's personality, capabilities, and behavior."
                  : "Review and customize the template for your AI assistant."}
              </p>
            </div>

            <SoulEditor
              initialValue={soulMd}
              onChange={setSoulMd}
              showSaveButton={false}
            />

            <div className="flex justify-between">
              <button
                onClick={() => setStep("model")}
                className="px-6 py-2.5 border border-border text-foreground font-medium rounded-lg hover:bg-secondary transition"
              >
                Back
              </button>
              <button
                onClick={() => setStep("confirm")}
                className="px-6 py-2.5 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 transition"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {/* Confirmation */}
        {step === "confirm" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-2">Confirm & Create</h2>
              <p className="text-muted-foreground">
                Review your configuration before creating the instance.
              </p>
            </div>

            <div className="space-y-4 p-4 bg-secondary/50 rounded-lg">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Channel</span>
                <span className="font-medium text-foreground flex items-center gap-2">
                  {channel === "telegram" ? "📱" : "💬"}
                  {channel.charAt(0).toUpperCase() + channel.slice(1)}
                </span>
              </div>
              {channel === "telegram" && telegramToken && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Bot Token</span>
                  <span className="font-medium text-foreground font-mono text-sm">
                    {telegramToken.slice(0, 10)}...{telegramToken.slice(-4)}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Persona</span>
                <span className="font-medium text-foreground">
                  {persona.charAt(0).toUpperCase() + persona.slice(1)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Model</span>
                <span className="font-medium text-foreground">
                  {MODELS.find(m => m.id === model)?.name || model}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">SOUL.md</span>
                <span className="font-medium text-foreground">
                  {soulMd.length} characters
                </span>
              </div>
            </div>

            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}

            <div className="flex justify-between">
              <button
                onClick={() => setStep("soul")}
                disabled={creating}
                className="px-6 py-2.5 border border-border text-foreground font-medium rounded-lg hover:bg-secondary transition disabled:opacity-50"
              >
                Back
              </button>
              <button
                onClick={handleCreate}
                disabled={creating}
                className="px-6 py-2.5 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition disabled:opacity-50 flex items-center gap-2"
              >
                {creating ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Creating...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Create Instance
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
