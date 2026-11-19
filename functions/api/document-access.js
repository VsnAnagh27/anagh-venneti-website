export async function onRequestPost({ request, env }) {
  const origin = request.headers.get('Origin');
  const allowed = (env.ALLOWED_ORIGIN || '').split(',').map(x => x.trim()).filter(Boolean);
  if (allowed.length && origin && !allowed.includes(origin)) return new Response('Origin not allowed', { status: 403 });
  let body;
  try { body = await request.json(); } catch { return new Response('Invalid JSON', { status: 400 }); }
  const name = String(body.name || '').trim().slice(0, 100);
  const document = String(body.document || '');
  if (!name || !['cv', 'thesis'].includes(document)) return new Response('Name and valid document are required', { status: 400 });
  const accessedAt = new Date().toISOString();
  await env.ACCESS_DB.prepare('INSERT INTO document_access (visitor_name, document, accessed_at, page) VALUES (?, ?, ?, ?)')
    .bind(name, document, accessedAt, String(body.page || '').slice(0, 200)).run();
  return Response.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
}
export async function onRequestGet() { return new Response('Method not allowed', { status: 405, headers: { Allow: 'POST' } }); }
