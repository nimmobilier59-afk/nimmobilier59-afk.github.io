// N20 Immobilier — relais email pour les mandats (Cloudflare Worker)
// ---------------------------------------------------------------------------
// Pourquoi : un site statique ne peut PAS appeler Resend depuis le navigateur
// (CORS bloqué + clé API exposée). Ce Worker reçoit la requête du navigateur,
// garde la clé Resend côté serveur et relaie l'email vers Resend.
//
// Variables à définir dans Cloudflare (Worker > Settings > Variables and Secrets) :
//   RESEND_API_KEY  (Secret)   ex : re_xxxxxxxx   ← la NOUVELLE clé Resend (l'ancienne doit être révoquée)
//   MAIL_FROM       (Texte)    ex : N20 Immobilier <mandat@n20immobilier.ch>  (domaine vérifié dans Resend)
//   MAIL_TO         (Texte)    ex : contact@n20immobilier.ch
//   ALLOWED_ORIGIN  (Texte)    ex : https://nimmobilier59-afk.github.io
// ---------------------------------------------------------------------------

export default {
  async fetch(request, env) {
    const cors = {
      'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Vary': 'Origin',
    };

    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (request.method !== 'POST')
      return new Response('Method Not Allowed', { status: 405, headers: cors });

    let p;
    try { p = await request.json(); }
    catch { return reply({ error: 'Invalid JSON' }, 400, cors); }

    if (!p.subject || !p.html)
      return reply({ error: 'Missing subject/html' }, 422, cors);

    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.MAIL_FROM,
        to: [env.MAIL_TO],
        reply_to: p.reply_to,
        subject: p.subject,
        html: p.html,
        attachments: Array.isArray(p.attachments) ? p.attachments : [],
      }),
    });

    const body = await r.text();
    return new Response(body, {
      status: r.status,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  },
};

function reply(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}
