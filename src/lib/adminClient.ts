import { useCallback, useEffect, useState } from "react";

const PIN_KEY = "dwb_admin_pin";
const ADMIN_EVENT = "dwb-admin-change";

// Lets every open page (nav, Matches) update when the stored PIN changes.
function notifyAdminChange() {
  window.dispatchEvent(new Event(ADMIN_EVENT));
}

export async function adminFetch<T = unknown>(url: string, body: unknown): Promise<T> {
  const pin = (typeof window !== "undefined" && (localStorage.getItem(PIN_KEY) || "")) as string;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-admin-pin": pin || "",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    if (res.status === 403) {
      // Forget a mistyped PIN so the next action prompts for it again.
      localStorage.removeItem(PIN_KEY);
      notifyAdminChange();
      throw new Error("Wrong admin PIN. Try again and you'll be asked for it.");
    }
    const txt = await res.text();
    let message = txt;
    try {
      message = (JSON.parse(txt) as { error?: string }).error ?? txt;
    } catch {
      // not JSON; show the body as-is
    }
    throw new Error(message || `HTTP ${res.status}`);
  }
  if (res.status === 204) {
    return undefined as T;
  }
  return (await res.json()) as T;
}

export function ensurePin(): boolean {
  const current = localStorage.getItem(PIN_KEY);
  if (current) return true;
  const entered = prompt("Enter admin PIN");
  if (!entered) return false;
  localStorage.setItem(PIN_KEY, entered);
  notifyAdminChange();
  return true;
}

/**
 * TD mode: this phone has the admin PIN saved. Spectators never see the TD
 * tools; the TD's phone does. The PIN is only checked by the server when an
 * action runs, and a wrong one is forgotten then (see adminFetch).
 */
export function useAdminMode() {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const read = () => {
      try {
        setIsAdmin(!!localStorage.getItem(PIN_KEY));
      } catch {
        setIsAdmin(false);
      }
    };
    read();
    window.addEventListener("storage", read);
    window.addEventListener(ADMIN_EVENT, read);
    return () => {
      window.removeEventListener("storage", read);
      window.removeEventListener(ADMIN_EVENT, read);
    };
  }, []);

  const signIn = useCallback(() => {
    ensurePin();
  }, []);

  const signOut = useCallback(() => {
    try {
      localStorage.removeItem(PIN_KEY);
    } catch {
      // nothing stored
    }
    notifyAdminChange();
  }, []);

  return { isAdmin, signIn, signOut };
}
