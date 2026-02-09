"use client";

import { useState } from "react";

interface Model {
  id: string;
  name: string;
  description: string;
  price: string;
}

const MODELS: Model[] = [
  {
    id: "claude-opus-4-6",
    name: "Claude Opus 4.6",
    description: "Most intelligent",
    price: "$10/$50",
  },
  {
    id: "claude-sonnet-4-5",
    name: "Claude Sonnet 4.5",
    description: "Balanced",
    price: "$6/$30",
  },
  {
    id: "claude-haiku-4-5",
    name: "Claude Haiku 4.5",
    description: "Fastest",
    price: "$2/$10",
  },
];

interface ModelSelectorProps {
  instanceId: string;
  currentModel: string;
  onUpdate?: (model: string) => void;
}

export function ModelSelector({ instanceId, currentModel, onUpdate }: ModelSelectorProps) {
  const [selected, setSelected] = useState(currentModel);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleChange = async (modelId: string) => {
    if (modelId === selected) return;
    
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch(`/api/instances/${instanceId}/model`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: modelId }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to update model");
      }

      setSelected(modelId);
      setMessage({ type: "success", text: "Model updated! Changes take effect immediately." });
      onUpdate?.(modelId);
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Failed to update" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">AI Model</h3>
        {saving && (
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Saving...
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {MODELS.map((model) => (
          <button
            key={model.id}
            onClick={() => handleChange(model.id)}
            disabled={saving}
            className={`p-3 rounded-lg border text-left transition-all ${
              selected === model.id
                ? "border-primary bg-primary/10 ring-1 ring-primary/50"
                : "border-border bg-card hover:border-primary/50"
            } ${saving ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            <div className="font-medium text-foreground text-sm">{model.name}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{model.description}</div>
            <div className="text-xs font-mono text-muted-foreground mt-1">{model.price}</div>
          </button>
        ))}
      </div>

      {message && (
        <p className={`text-xs ${message.type === "success" ? "text-green-400" : "text-red-400"}`}>
          {message.text}
        </p>
      )}
    </div>
  );
}
