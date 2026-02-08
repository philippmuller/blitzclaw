"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useClerk } from "@clerk/nextjs";

export function DeleteAccountButton() {
  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { signOut } = useClerk();

  const handleDelete = async () => {
    setIsDeleting(true);
    setError(null);

    try {
      const response = await fetch("/api/account/delete", {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete account");
      }

      // Sign out and redirect to home
      await signOut();
      router.push("/?deleted=true");
    } catch (err) {
      setError((err as Error).message);
      setIsDeleting(false);
    }
  };

  if (showConfirm) {
    return (
      <div className="space-y-4">
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
          <p className="text-red-400 font-medium mb-2">⚠️ Are you absolutely sure?</p>
          <p className="text-sm text-muted-foreground">
            This will permanently delete your account, cancel your subscription, 
            destroy all your instances, and erase all data. This cannot be undone.
          </p>
        </div>
        
        {error && (
          <p className="text-red-400 text-sm">{error}</p>
        )}
        
        <div className="flex gap-3">
          <button
            onClick={() => setShowConfirm(false)}
            disabled={isDeleting}
            className="px-4 py-2 bg-secondary text-foreground font-medium rounded-lg hover:bg-secondary/80 transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition disabled:opacity-50"
          >
            {isDeleting ? "Deleting..." : "Yes, Delete Everything"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => setShowConfirm(true)}
      className="px-4 py-2 bg-red-500/10 text-red-400 border border-red-500/30 font-medium rounded-lg hover:bg-red-500/20 transition"
    >
      Delete Account
    </button>
  );
}
