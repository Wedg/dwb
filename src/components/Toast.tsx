"use client";

import { useEffect } from "react";

export type ToastMessage = { text: string; error?: boolean };

/**
 * A message pinned to the bottom of the screen, so it's visible wherever the
 * TD has scrolled to. Success messages fade on their own; errors stay until
 * tapped. Pass the state setter as `onClose` (it's stable across renders).
 */
export function Toast({ msg, onClose }: { msg: ToastMessage | null; onClose: (value: null) => void }) {
  useEffect(() => {
    if (!msg || msg.error) return;
    const timer = setTimeout(() => onClose(null), 4000);
    return () => clearTimeout(timer);
  }, [msg, onClose]);

  if (!msg) return null;
  return (
    <button
      type="button"
      role="status"
      onClick={() => onClose(null)}
      className={`fixed inset-x-4 bottom-4 z-20 mx-auto max-w-md rounded-xl border px-4 py-3 text-left text-sm shadow-lg ${
        msg.error
          ? "border-red-500 bg-[color:var(--card)] text-red-500"
          : "border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--foreground)]"
      }`}
    >
      {msg.text}
      {msg.error && <span className="ml-2 text-xs text-[color:var(--muted)]">(tap to dismiss)</span>}
    </button>
  );
}
