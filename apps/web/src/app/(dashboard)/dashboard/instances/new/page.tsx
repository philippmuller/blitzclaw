"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PersonaPicker, SoulEditor, getPersonaTemplate } from "@/components";

type Step = "channel" | "persona" | "soul" | "confirm";
type Channel = "telegram" | "whatsapp";
type Persona = "assistant" | "developer" | "creative" | "custom";

export default function NewInstancePage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("channel");
  const [channel, setChannel] = useState<Channel>("telegram");
  const [persona, setPersona] = useState<Persona>("assistant");
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
          soul_md: soulMd || undefined,
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

            <div className="flex justify-end">
              <button
                onClick={() => setStep("persona")}
                className="px-6 py-2.5 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 transition"
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
                onClick={() => setStep("persona")}
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
              <div className="flex justify-between">
                <span className="text-muted-foreground">Persona</span>
                <span className="font-medium text-foreground">
                  {persona.charAt(0).toUpperCase() + persona.slice(1)}
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
