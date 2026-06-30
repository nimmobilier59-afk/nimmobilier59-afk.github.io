# Relais email N20 (Cloudflare Worker + Resend)

Le formulaire « Mandat de Recherche » (`/particulier/`) et « Mandat Professionnel »
(`/mandat-professionnel/`) envoient l'email via **ce Worker**, pas directement vers
Resend (impossible depuis un navigateur : CORS bloqué + clé exposée).

## 1. Révoquer l'ancienne clé Resend
La clé `re_EPVKU84J_…` était en clair dans le code public → **la révoquer** dans
Resend (API Keys) et en **créer une nouvelle**.

## 2. Vérifier le domaine dans Resend
Resend > Domains > ajouter `n20immobilier.ch` et valider les enregistrements DNS.
Sans ça, on ne peut pas envoyer vers une adresse arbitraire (mode test = uniquement
le propriétaire du compte), et `onboarding@resend.dev` ne suffit pas.

## 3. Déployer le Worker
1. Cloudflare Dashboard > **Workers & Pages** > **Create** > **Worker**.
2. Nommer p.ex. `n20-mailer`, déployer, puis **Edit code** : coller `n20-mailer.js`.
3. **Settings > Variables and Secrets** :
   - `RESEND_API_KEY` → **Secret** = la nouvelle clé Resend
   - `MAIL_FROM` → `N20 Immobilier <mandat@n20immobilier.ch>` (domaine vérifié)
   - `MAIL_TO` → `contact@n20immobilier.ch`
   - `ALLOWED_ORIGIN` → `https://nimmobilier59-afk.github.io`
4. **Deploy**. L'URL ressemble à `https://n20-mailer.<sous-domaine>.workers.dev`.

## 4. Brancher le front
Dans `particulier/index.html` et `mandat-professionnel/index.html`, remplacer la
valeur de `MAILER_URL` par l'URL du Worker déployé.

## Test
Soumettre un mandat de test → l'email (avec PDF + annexes) doit arriver sur `MAIL_TO`.
En cas d'échec, le formulaire affiche désormais une vraie erreur (il ne fait plus
semblant d'avoir réussi).
