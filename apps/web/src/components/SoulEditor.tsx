"use client";

import { useState, useEffect } from "react";

interface SoulEditorProps {
  instanceId?: string;
  initialValue?: string;
  onSave?: (content: string) => Promise<void>;
  onChange?: (content: string) => void;
  readOnly?: boolean;
  showSaveButton?: boolean;
}

export function SoulEditor({
  instanceId,
  initialValue = "",
  onSave,
  onChange,
  readOnly = false,
  showSaveButton = true,
}: SoulEditorProps) {
  const [content, setContent] = useState(initialValue);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setContent(initialValue);
  }, [initialValue]);

  const handleChange = (value: string) => {
    setContent(value);
    setSaved(false);
    onChange?.(value);
  };

  const handleSave = async () => {
    if (!instanceId && !onSave) return;

    setSaving(true);
    setError(null);

    try {
      if (onSave) {
        await onSave(content);
      } else if (instanceId) {
        const res = await fetch(`/api/instances/${instanceId}/soul`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ soul_md: content }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Failed to save");
        }
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-secondary/50">
        <div className="flex items-center gap-2">
          <span className="text-lg">📜</span>
          <span className="font-medium">SOUL.md</span>
          <span className="text-xs text-muted-foreground">
            ({content.length.toLocaleString()} chars)
          </span>
        </div>
        
        {showSaveButton && !readOnly && (
          <div className="flex items-center gap-2">
            {saved && (
              <span className="text-sm text-green-400 flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Saved
              </span>
            )}
            {error && (
              <span className="text-sm text-red-400">{error}</span>
            )}
            <button
              onClick={handleSave}
              disabled={saving || readOnly}
              className="px-3 py-1.5 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition disabled:opacity-50 flex items-center gap-1"
            >
              {saving ? (
                <>
                  <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </button>
          </div>
        )}
      </div>
      
      <textarea
        value={content}
        onChange={(e) => handleChange(e.target.value)}
        readOnly={readOnly}
        placeholder={`# SOUL.md

Define your AI assistant's personality, capabilities, and behavior here.

Example:
---
You are a helpful personal assistant.

You help with:
- Daily planning and reminders
- Quick research and answers
- Writing and editing

Be warm but efficient. Respect the user's time.`}
        className="w-full min-h-[400px] p-4 bg-background font-mono text-sm resize-y focus:outline-none disabled:opacity-50"
        style={{ 
          lineHeight: "1.6",
        }}
      />
    </div>
  );
}
