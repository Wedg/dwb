export async function adminFetch<T = unknown>(url: string, body: unknown): Promise<T> {
  const pin = (typeof window !== "undefined" && (localStorage.getItem("dwb_admin_pin") || "")) as string;
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
      localStorage.removeItem("dwb_admin_pin");
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
  const current = localStorage.getItem("dwb_admin_pin");
  if (current) return true;
  const entered = prompt("Enter admin PIN");
  if (!entered) return false;
  localStorage.setItem("dwb_admin_pin", entered);
  return true;
}
