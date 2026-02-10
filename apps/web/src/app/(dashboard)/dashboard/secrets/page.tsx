"use client";

import { useEffect, useState } from "react";

interface SecretRow {
  key: string;
  value: string;
  isNew: boolean;
  revealed: boolean;
}

interface RedactedSecret {
  redacted: string;
  length: number;
}

export default function SecretsPage() {
  const [instanceId, setInstanceId] = useState<string | null>(null);
  const [secrets, setSecrets] = useState<SecretRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [instances, setInstances] = useState<Array<{ id: string; status: string }>>([]);

  // Fetch user's instances
  useEffect(() => {
    async function fetchInstances() {
      try {
        const res = await fetch("/api/instances");
        if (res.ok) {
          const data = await res.json();
          setInstances(data.instances || []);
          // Select first active instance by default
          const activeInstance = data.instances?.find((i: { status: string }) => i.status === "ACTIVE");
          if (activeInstance) {
            setInstanceId(activeInstance.id);
          } else if (data.instances?.[0]) {
            setInstanceId(data.instances[0].id);
          }
        }
      } catch {
        setError("Failed to fetch instances");
      }
    }
    fetchInstances();
  }, []);

  // Fetch secrets when instance changes
  useEffect(() => {
    if (!instanceId) {
      setLoading(false);
      return;
    }

    async function fetchSecrets() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/instances/${instanceId}/secrets`);
        if (res.ok) {
          const data = await res.json();
          const loadedSecrets: SecretRow[] = Object.entries(
            data.secrets as Record<string, RedactedSecret>
          ).map(([key, info]) => ({
            key,
            value: "", // Don't expose actual value
            isNew: false,
            revealed: false,
            _redacted: info.redacted,
          })) as SecretRow[];
          setSecrets(loadedSecrets);
        } else {
          setError("Failed to load secrets");
        }
      } catch {
        setError("Failed to load secrets");
      } finally {
        setLoading(false);
      }
    }
    fetchSecrets();
  }, [instanceId]);

  const addRow = () => {
    setSecrets([...secrets, { key: "", value: "", isNew: true, revealed: true }]);
  };

  const removeRow = (index: number) => {
    setSecrets(secrets.filter((_, i) => i !== index));
  };

  const updateRow = (index: number, field: "key" | "value", value: string) => {
    const updated = [...secrets];
    updated[index] = { ...updated[index], [field]: value };
    setSecrets(updated);
  };

  const toggleReveal = (index: number) => {
    const updated = [...secrets];
    updated[index] = { ...updated[index], revealed: !updated[index].revealed };
    setSecrets(updated);
  };

  const handleSave = async () => {
    if (!instanceId) return;

    setError(null);
    setSuccess(null);
    setSaving(true);

    // Build secrets object, only including rows with actual values
    const secretsObj: Record<string, string> = {};
    for (const row of secrets) {
      if (row.key && row.value) {
        secretsObj[row.key] = row.value;
      } else if (row.key && !row.isNew) {
        // Existing secret without new value - preserve it
        // We'd need to fetch the actual value, but for now we require re-entering
      }
    }

    // Filter out empty rows for validation
    const nonEmptySecrets = secrets.filter((s) => s.key || s.value);
    for (const secret of nonEmptySecrets) {
      if (!secret.key) {
        setError("All secrets must have a key");
        setSaving(false);
        return;
      }
      if (secret.isNew && !secret.value) {
        setError(`Secret "${secret.key}" is missing a value`);
        setSaving(false);
        return;
      }
    }

    try {
      const res = await fetch(`/api/instances/${instanceId}/secrets`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secrets: secretsObj }),
      });

      const data = await res.json();

      if (res.ok) {
        if (data.syncedToServer) {
          setSuccess("✓ Secrets saved and synced to your instance");
        } else if (data.syncError) {
          setSuccess(`✓ Secrets saved (sync pending: ${data.syncError})`);
        } else {
          setSuccess("✓ Secrets saved. Will sync when instance is active.");
        }
        // Refresh to show redacted view
        const refreshRes = await fetch(`/api/instances/${instanceId}/secrets`);
        if (refreshRes.ok) {
          const refreshData = await refreshRes.json();
          const loadedSecrets: SecretRow[] = Object.entries(
            refreshData.secrets as Record<string, RedactedSecret>
          ).map(([key, info]) => ({
            key,
            value: "",
            isNew: false,
            revealed: false,
            _redacted: info.redacted,
          })) as SecretRow[];
          setSecrets(loadedSecrets);
        }
      } else {
        setError(data.error || "Failed to save secrets");
      }
    } catch {
      setError("Failed to save secrets");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">🔑 Secrets</h1>
          <p className="text-muted-foreground mt-1">Loading...</p>
        </div>
      </div>
    );
  }

  if (instances.length === 0) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">🔑 Secrets</h1>
          <p className="text-muted-foreground mt-1">
            Securely share API keys and tokens with your AI assistant.
          </p>
        </div>
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <p className="text-muted-foreground">
            No instances found. Create an instance first to add secrets.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">🔑 Secrets</h1>
        <p className="text-muted-foreground mt-1">
          Securely share API keys and tokens with your AI assistant.
        </p>
      </div>

      {/* Instance Selector */}
      {instances.length > 1 && (
        <div className="bg-card border border-border rounded-xl p-6">
          <label className="block text-sm font-medium text-foreground mb-2">
            Select Instance
          </label>
          <select
            value={instanceId || ""}
            onChange={(e) => setInstanceId(e.target.value)}
            className="w-full md:w-64 px-3 py-2 bg-secondary border border-border rounded-lg text-foreground"
          >
            {instances.map((inst) => (
              <option key={inst.id} value={inst.id}>
                {inst.id.slice(0, 8)}... ({inst.status})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Secrets Editor */}
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">Environment Secrets</h2>
          <button
            onClick={addRow}
            className="flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Secret
          </button>
        </div>

        <p className="text-sm text-muted-foreground mb-4">
          These secrets will be available at <code className="bg-secondary px-1 rounded">/root/.openclaw/secrets.env</code> on your instance.
          Your AI can source this file to access them.
        </p>

        {/* Feedback Messages */}
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 text-sm">
            {success}
          </div>
        )}

        {/* Secrets List */}
        <div className="space-y-3">
          {secrets.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No secrets yet. Click &quot;Add Secret&quot; to get started.
            </div>
          ) : (
            secrets.map((secret, index) => (
              <div
                key={index}
                className="flex items-center gap-3 p-3 bg-secondary/50 rounded-lg"
              >
                {/* Key Input */}
                <input
                  type="text"
                  placeholder="KEY_NAME"
                  value={secret.key}
                  onChange={(e) => updateRow(index, "key", e.target.value.toUpperCase())}
                  className="flex-1 min-w-0 px-3 py-2 bg-background border border-border rounded-lg text-foreground font-mono text-sm"
                />

                <span className="text-muted-foreground">=</span>

                {/* Value Input */}
                <div className="flex-[2] min-w-0 relative">
                  <input
                    type={secret.revealed ? "text" : "password"}
                    placeholder={secret.isNew ? "secret_value" : "••••••••"}
                    value={secret.value}
                    onChange={(e) => updateRow(index, "value", e.target.value)}
                    className="w-full px-3 py-2 pr-10 bg-background border border-border rounded-lg text-foreground font-mono text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => toggleReveal(index)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                    title={secret.revealed ? "Hide" : "Reveal"}
                  >
                    {secret.revealed ? (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>

                {/* Delete Button */}
                <button
                  onClick={() => removeRow(index)}
                  className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition"
                  title="Remove"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            ))
          )}
        </div>

        {/* Save Button */}
        <div className="mt-6 flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving || secrets.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Saving...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Save Secrets
              </>
            )}
          </button>
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-6">
        <h3 className="font-semibold text-blue-400 mb-2">💡 How it works</h3>
        <ul className="text-sm text-muted-foreground space-y-2">
          <li>• Secrets are stored securely in the database and synced to your instance via SSH</li>
          <li>• Your AI can access them by sourcing <code className="bg-secondary px-1 rounded">/root/.openclaw/secrets.env</code></li>
          <li>• Changes are applied immediately and OpenClaw is restarted</li>
          <li>• Use UPPER_SNAKE_CASE for key names (e.g., GITHUB_TOKEN, VERCEL_API_KEY)</li>
        </ul>
      </div>
    </div>
  );
}
