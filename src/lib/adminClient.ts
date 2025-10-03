// src/lib/adminClient.ts
export async function adminFetch(url: string, body: any) {
  const pin = (typeof window !== 'undefined' && (localStorage.getItem('dwb_admin_pin') || '')) as string;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-admin-pin': pin || '',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(txt || `HTTP ${res.status}`);
  }
  return res.json();
}

export function ensurePin(): boolean {
  const current = localStorage.getItem('dwb_admin_pin');
  if (current) return true;
  const entered = prompt('Enter admin PIN');
  if (!entered) return false;
  localStorage.setItem('dwb_admin_pin', entered);
  return true;
}
