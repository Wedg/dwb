// src/lib/adminAuth.ts
export function requireAdminPin(req: Request) {
  const pinHeader = req.headers.get('x-admin-pin') ?? '';
  const ok = pinHeader && process.env.ADMIN_PIN && pinHeader === process.env.ADMIN_PIN;
  if (!ok) throw new Response('Forbidden: bad admin PIN', { status: 403 });
}
