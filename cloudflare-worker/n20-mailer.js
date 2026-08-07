// N20 Immobilier — relais email pour les mandats (Cloudflare Worker)
// ---------------------------------------------------------------------------
// Pourquoi : un site statique ne peut PAS appeler Resend depuis le navigateur
// (CORS bloqué + clé API exposée). Ce Worker reçoit la requête du navigateur,
// garde la clé Resend côté serveur et relaie l'email vers Resend.
//
// Variables à définir dans Cloudflare (Worker > Settings > Variables and Secrets) :
//   RESEND_API_KEY    (Secret)  ex : re_xxxxxxxx
//   TURNSTILE_SECRET  (Secret)  OPTIONNEL — tant qu'il n'est pas défini, la
//                               vérification anti-robot est simplement ignorée.
//   MAIL_FROM         (Texte)   ex : N20 Immobilier <mandat@n20immobilier.ch>
//   MAIL_TO           (Texte)   ex : contact@n20immobilier.ch
//   ALLOWED_ORIGIN    (Texte)   liste d'origines séparées par des virgules
//
// Durcissement (2026-08-07) — le Worker était un relais ouvert : n'importe qui
// pouvait POSTer depuis un script et inonder la boîte de l'agence. Le CORS n'y
// changeait rien : c'est une règle appliquée par le navigateur, pas par le
// serveur. Trois barrières ajoutées, plus une quatrième prête à activer.
// ---------------------------------------------------------------------------

const LIMITE_PAYLOAD_MO = 25;   // au-delà, Resend refuserait de toute façon
const MAX_PAR_FENETRE  = 5;    // envois autorisés par IP et par fenêtre
const FENETRE_S        = 60;

export default {
  async fetch(request, env) {
    const allowed = (env.ALLOWED_ORIGIN || '*').split(',').map((o) => o.trim()).filter(Boolean);
    const reqOrigin = request.headers.get('Origin') || '';
    const toutesOrigines = allowed.includes('*');
    const origineAutorisee = toutesOrigines || allowed.includes(reqOrigin);
    const allowOrigin = toutesOrigines ? '*' : (origineAutorisee ? reqOrigin : allowed[0]);

    const cors = {
      'Access-Control-Allow-Origin': allowOrigin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Vary': 'Origin',
    };

    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (request.method !== 'POST')
      return new Response('Method Not Allowed', { status: 405, headers: cors });

    // ── 1. Origine ────────────────────────────────────────────────────────────
    // Un navigateur envoie toujours Origin sur une requête cross-origin : refuser
    // celles qui n'en ont pas, ou qui viennent d'ailleurs, écarte les scripts
    // basiques sans gêner un seul client légitime.
    if (!toutesOrigines && !origineAutorisee)
      return reply({ error: 'Origin not allowed' }, 403, cors);

    // ── 2. Taille ─────────────────────────────────────────────────────────────
    // Refus AVANT de lire le corps : inutile de mobiliser la mémoire pour un
    // envoi que Resend rejettera.
    const annonce = Number(request.headers.get('Content-Length') || 0);
    if (annonce > LIMITE_PAYLOAD_MO * 1048576)
      return reply({ error: 'Payload too large' }, 413, cors);

    // ── 3. Débit par adresse IP ───────────────────────────────────────────────
    // Un mandat légitime, c'est un envoi (deux si la reprise automatique s'est
    // déclenchée). La limite est donc très large pour un humain et coupe net une
    // boucle de script.
    // ⚠️ La liaison « ratelimit » native de Cloudflare a été essayée : elle est
    // bien présente mais renvoie toujours success:true sur le plan gratuit —
    // elle n'applique rien. On compte donc nous-mêmes via l'API Cache, qui est
    // disponible sans supplément. Compteur par IP et par fenêtre d'une minute.
    const ip = request.headers.get('CF-Connecting-IP') || 'inconnue';
    try {
      const fenetre = Math.floor(Date.now() / (FENETRE_S * 1000));
      const cle = new Request(`https://n20-limiteur/${encodeURIComponent(ip)}/${fenetre}`);
      const cache = caches.default;
      const vu = await cache.match(cle);
      const n = (vu ? Number(await vu.text()) || 0 : 0) + 1;
      if (n > MAX_PAR_FENETRE)
        return reply({ error: 'Trop de tentatives. Merci de patienter une minute.' }, 429, cors);
      await cache.put(cle, new Response(String(n), {
        headers: { 'Cache-Control': `max-age=${FENETRE_S}` },
      }));
    } catch (e) {
      // Le limiteur ne doit jamais faire perdre un dossier : en cas de
      // défaillance, on laisse passer.
      console.error('limiteur indisponible', e);
    }

    let p;
    try { p = await request.json(); }
    catch { return reply({ error: 'Invalid JSON' }, 400, cors); }

    if (!p.subject || !p.html)
      return reply({ error: 'Missing subject/html' }, 422, cors);

    // ── 4. Anti-robot (Turnstile) ─────────────────────────────────────────────
    // Tant que TURNSTILE_SECRET n'est pas défini côté Cloudflare, cette barrière
    // est inactive : le code est en place, il suffira d'ajouter le secret et le
    // widget dans les pages pour l'activer, sans redéploiement.
    if (env.TURNSTILE_SECRET) {
      const jeton = typeof p.turnstile === 'string' ? p.turnstile : '';
      if (!jeton) return reply({ error: 'Vérification anti-robot manquante.' }, 403, cors);
      const form = new FormData();
      form.append('secret', env.TURNSTILE_SECRET);
      form.append('response', jeton);
      const ip = request.headers.get('CF-Connecting-IP');
      if (ip) form.append('remoteip', ip);
      const v = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',
        { method: 'POST', body: form });
      const res = await v.json().catch(() => ({ success: false }));
      if (!res.success)
        return reply({ error: 'Vérification anti-robot échouée. Merci de réessayer.' }, 403, cors);
    }

    // reply_to vide/invalide (page en cache, POST direct) : on l'omet au lieu de
    // laisser Resend rejeter tout l'envoi.
    const replyTo = typeof p.reply_to === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.reply_to.trim())
      ? p.reply_to.trim() : undefined;

    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.MAIL_FROM,
        to: [env.MAIL_TO],
        ...(replyTo ? { reply_to: replyTo } : {}),
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
