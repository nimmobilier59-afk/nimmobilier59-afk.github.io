const RESEND_KEY = process.env.RESEND_KEY;

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  try {
    const { d, ref, dt, attachments, mandatType } = JSON.parse(event.body);

    const r = (l, v, w) => `<tr style="background:${w ? '#fff' : '#f8f9fb'}"><td style="padding:8px 12px;color:#888;width:42%">${l}</td><td style="padding:8px 12px">${v || '—'}</td></tr>`;
    const s = t => `<h3 style="margin:20px 0 12px;padding:8px 14px;background:#021623;color:#6EC1E4;border-radius:6px;font-size:12px;letter-spacing:1px;text-transform:uppercase">${t}</h3>`;
    const emailHeader = (label) => `<div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;color:#333;border-radius:10px;overflow:hidden;border:1px solid #e0e0e0"><div style="background:#021623;padding:28px 32px;text-align:center"><img src="https://n20immobilier.ch/wp-content/uploads/2025/09/N20-Immobilier-.png" alt="N20 Immobilier" style="height:50px;display:block;margin:0 auto 14px"><p style="color:#6EC1E4;margin:0;font-size:13px;letter-spacing:2px;text-transform:uppercase">${label}</p><p style="color:rgba(255,255,255,0.4);margin:6px 0 0;font-size:12px">Réf. ${ref} — ${dt}</p></div><div style="padding:24px 32px;background:#f8f9fb">`;
    const emailFooter = `</div><div style="background:#021623;padding:16px 32px;text-align:center"><p style="color:#6EC1E4;font-size:11px;margin:0">N20 Immobilier — contact@n20immobilier.ch — +41 76 418 21 23</p></div></div>`;

    let html, subject;

    if (mandatType === 'professional') {
      // ── Email mandat professionnel ────────────────────────────────────────
      html = emailHeader('Nouveau Mandat Professionnel')
        + s('Entreprise')
        + `<table style="width:100%;border-collapse:collapse;font-size:13px">`
        + r('Raison sociale', `<strong>${d.company}</strong>`, true)
        + r('Secteur d\'activité', d.sector, false)
        + r('Adresse du siège', d.address, true)
        + `</table>`
        + s('Contact')
        + `<table style="width:100%;border-collapse:collapse;font-size:13px">`
        + r('Nom', d.contactName, true)
        + r('Fonction', d.contactRole, false)
        + r('Email', d.email, true)
        + r('Téléphone', d.phone, false)
        + `</table>`
        + s('Nature du mandat')
        + `<table style="width:100%;border-collapse:collapse;font-size:13px">`
        + r('Type de demande', d.needTypeLabel, true)
        + r('Urgence', d.urgencyLabel, false)
        + r('Nombre de personnes', d.nbPersons, true)
        + `</table>`
        + s('Critères de recherche')
        + `<table style="width:100%;border-collapse:collapse;font-size:13px">`
        + r('Budget mensuel max (CHF)', d.budget, true)
        + r('Date d\'entrée souhaitée', d.moveIn, false)
        + r('Durée souhaitée', d.duration, true)
        + r('Zones / quartiers', d.areas, false)
        + r('Exigences particulières', d.notes || '—', true)
        + `</table>`
        + emailFooter;

      subject = `Nouveau mandat professionnel — ${d.company} — Réf. ${ref}`;

    } else {
      // ── Email mandat résidentiel (comportement original) ──────────────────
      const zones = [d.area1, d.area2, d.area3].filter(Boolean).join(' › ') || '—';
      const aList = [d.annex1, d.annex2, d.annex3].filter(Boolean)
        .map((n, i) => `<tr><td style="padding:8px 12px;color:#888;width:42%">Annexe ${i + 1}</td><td style="padding:8px 12px">${n}</td></tr>`)
        .join('') || '<tr><td colspan="2" style="padding:8px 12px;color:#aaa">Aucune annexe</td></tr>';

      html = emailHeader('Nouveau Mandat de Recherche')
        + s('Demandeur')
        + `<table style="width:100%;border-collapse:collapse;font-size:13px">`
        + r('Nom complet', `<strong>${d.firstName} ${d.lastName}</strong>`, true)
        + r('Date de naissance', d.dob, false)
        + r('Adresse actuelle', d.currentAddress, true)
        + r('Nombre d\'enfants', d.children, false)
        + r('Téléphone', d.phone, true)
        + r('Email', d.email, false)
        + r('Bail à son nom', d.leaseInName, true)
        + r('Résiliation nécessaire', d.needTermination, false)
        + `</table>`
        + (d.coVisible
          ? s('Co-locataire') + `<table style="width:100%;border-collapse:collapse;font-size:13px">`
            + r('Nom complet', `${d.coFirstName} ${d.coLastName}`, true)
            + r('Date de naissance', d.coDob, false)
            + r('Téléphone', d.coPhone, true)
            + r('Email', d.coEmail, false)
            + `</table>`
          : '')
        + s('Critères du bien')
        + `<table style="width:100%;border-collapse:collapse;font-size:13px">`
        + r('Type de bien', d.propertyType, true)
        + r('Pièces minimum', d.minRooms, false)
        + r('Budget max (CHF)', d.budget, true)
        + r('Date d\'entrée', d.moveIn, false)
        + r('Communes souhaitées', zones, true)
        + r('Remarques', d.notes || '—', false)
        + `</table>`
        + s('Pièces jointes')
        + `<table style="width:100%;border-collapse:collapse;font-size:13px">${aList}</table>`
        + emailFooter;

      subject = `Nouveau mandat de recherche — ${d.firstName} ${d.lastName} — Réf. ${ref}`;
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'N20 Immobilier <onboarding@resend.dev>',
        to: ['contact@n20immobilier.ch'],
        reply_to: d.email,
        subject,
        html,
        attachments: attachments || [],
      }),
    });

    const result = await res.json();
    if (!res.ok) throw new Error(JSON.stringify(result));

    return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};
