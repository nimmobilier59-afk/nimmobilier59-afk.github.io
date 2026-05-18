const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const RESEND_KEY = process.env.RESEND_KEY;

const NAV = rgb(2/255, 22/255, 35/255);
const ACC = rgb(110/255, 193/255, 228/255);
const LG  = rgb(240/255, 243/255, 246/255);
const MG  = rgb(150/255, 162/255, 172/255);
const BK  = rgb(20/255, 25/255, 30/255);
const WH  = rgb(1, 1, 1);

async function generateMandatPDF(d, ref, dt) {
  const pdfDoc = await PDFDocument.create();
  const fontB = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontN = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const pageW = 595, pageH = 842;
  const M = 50, CW = pageW - M * 2;
  let page = pdfDoc.addPage([pageW, pageH]);
  let y = pageH;

  const addPage = () => {
    page = pdfDoc.addPage([pageW, pageH]);
    y = pageH - 30;
  };

  const chk = h => { if (y - h < 40) addPage(); };

  // ── EN-TÊTE ──
  page.drawRectangle({ x: 0, y: pageH - 80, width: pageW, height: 80, color: NAV });
  page.drawText('N20 IMMOBILIER', { x: M, y: pageH - 30, font: fontB, size: 18, color: WH });
  page.drawText('Votre partenaire de relocation a Geneve', { x: M, y: pageH - 46, font: fontN, size: 8, color: ACC });
  page.drawText('MANDAT DE RECHERCHE', { x: pageW - M - fontB.widthOfTextAtSize('MANDAT DE RECHERCHE', 13), y: pageH - 30, font: fontB, size: 13, color: WH });
  page.drawText(`Ref. ${ref}  -  ${dt}`, { x: pageW - M - fontN.widthOfTextAtSize(`Ref. ${ref}  -  ${dt}`, 8), y: pageH - 46, font: fontN, size: 8, color: ACC });
  y = pageH - 100;

  // ── Helpers ──
  const sec = (title) => {
    chk(24);
    page.drawRectangle({ x: M, y: y - 18, width: CW, height: 18, color: ACC });
    page.drawText(title, { x: M + 8, y: y - 13, font: fontB, size: 8, color: NAV });
    y -= 26;
  };

  const row = (label, value, shade) => {
    chk(28);
    page.drawRectangle({ x: M, y: y - 24, width: CW, height: 24, color: shade ? LG : rgb(0.98, 0.98, 0.99) });
    page.drawText(label.toUpperCase(), { x: M + 6, y: y - 10, font: fontN, size: 6.5, color: MG });
    const val = String(value || '—');
    page.drawText(val.length > 60 ? val.slice(0, 60) + '…' : val, { x: M + 6, y: y - 19, font: fontB, size: 8.5, color: BK });
    y -= 26;
  };

  const row2 = (f1, f2) => {
    chk(28);
    const hw = CW / 2;
    page.drawRectangle({ x: M, y: y - 24, width: CW, height: 24, color: LG });
    page.drawText(f1.l.toUpperCase(), { x: M + 6, y: y - 10, font: fontN, size: 6.5, color: MG });
    page.drawText(String(f1.v || '—'), { x: M + 6, y: y - 19, font: fontB, size: 8.5, color: BK });
    if (f2) {
      page.drawText(f2.l.toUpperCase(), { x: M + hw + 6, y: y - 10, font: fontN, size: 6.5, color: MG });
      page.drawText(String(f2.v || '—'), { x: M + hw + 6, y: y - 19, font: fontB, size: 8.5, color: BK });
    }
    y -= 26;
  };

  const gap = () => { y -= 6; };

  // ── 1. DEMANDEUR ──
  sec('1. DEMANDEUR');
  row2({ l: 'Nom', v: d.lastName }, { l: 'Prenom', v: d.firstName });
  row2({ l: 'Date de naissance', v: d.dob }, { l: "Nb d'enfants", v: d.children });
  row('Adresse actuelle', d.currentAddress, true);
  row2({ l: 'Telephone', v: d.phone }, { l: 'Email', v: d.email });
  row2({ l: 'Bail a son nom', v: d.leaseInName }, { l: 'Resiliation necessaire', v: d.needTermination });
  gap();

  // ── 2. CO-LOCATAIRE ──
  if (d.coVisible) {
    sec('2. CO-LOCATAIRE');
    row2({ l: 'Nom', v: d.coLastName }, { l: 'Prenom', v: d.coFirstName });
    row2({ l: 'Date de naissance', v: d.coDob }, { l: 'Telephone', v: d.coPhone });
    row('Email', d.coEmail, true);
    gap();
  }

  // ── CRITÈRES DU BIEN ──
  sec(`${d.coVisible ? '3' : '2'}. CRITERES DU BIEN`);
  row2({ l: 'Type de bien', v: d.propertyType }, { l: 'Pieces minimum', v: d.minRooms });
  row2({ l: 'Budget max (CHF/mois)', v: d.budget }, { l: "Date d'entree", v: d.moveIn });
  const zones = [d.area1, d.area2, d.area3].filter(Boolean).join('  >  ') || '—';
  row('Communes souhaitees', zones, true);
  if (d.notes) { row('Remarques', d.notes, false); }
  gap();

  // ── PIÈCES JOINTES ──
  sec(`${d.coVisible ? '4' : '3'}. PIECES JOINTES`);
  const annexes = [d.annex1, d.annex2, d.annex3].filter(Boolean);
  if (annexes.length === 0) {
    chk(20);
    page.drawText('Aucune piece jointe transmise.', { x: M + 6, y: y - 12, font: fontN, size: 8, color: MG });
    y -= 20;
  } else {
    annexes.forEach((name, i) => {
      chk(22);
      page.drawRectangle({ x: M, y: y - 20, width: CW, height: 20, color: i % 2 === 0 ? LG : rgb(0.98, 0.98, 0.99) });
      page.drawText(`Annexe ${i + 1} :`, { x: M + 6, y: y - 14, font: fontB, size: 8, color: BK });
      const n = String(name).length > 55 ? String(name).slice(0, 55) + '…' : String(name);
      page.drawText(n, { x: M + 70, y: y - 14, font: fontN, size: 8, color: BK });
      y -= 22;
    });
  }
  gap();

  // ── SIGNATURE ──
  chk(80);
  sec(`${d.coVisible ? '5' : '4'}. SIGNATURE`);
  page.drawRectangle({ x: M, y: y - 70, width: CW, height: 70, color: LG });
  page.drawText('Le soussigne mandate N20 Immobilier pour effectuer des recherches', { x: M + 8, y: y - 16, font: fontN, size: 7.5, color: MG });
  page.drawText('conformement aux criteres definis ci-dessus.', { x: M + 8, y: y - 26, font: fontN, size: 7.5, color: MG });
  page.drawLine({ start: { x: M + 8, y: y - 48 }, end: { x: M + 180, y: y - 48 }, thickness: 0.5, color: MG });
  page.drawLine({ start: { x: M + 220, y: y - 48 }, end: { x: M + CW - 8, y: y - 48 }, thickness: 0.5, color: MG });
  page.drawText('Lieu et date', { x: M + 8, y: y - 58, font: fontN, size: 7, color: MG });
  page.drawText('Signature du mandant', { x: M + 220, y: y - 58, font: fontN, size: 7, color: MG });
  y -= 80;

  // ── PIED DE PAGE ──
  page.drawLine({ start: { x: M, y: 30 }, end: { x: pageW - M, y: 30 }, thickness: 0.5, color: ACC });
  page.drawText('N20 Immobilier  -  contact@n20immobilier.ch  -  +41 76 419 20 21', { x: M, y: 18, font: fontN, size: 7, color: MG });
  page.drawText(`Ref. ${ref}  -  Genere le ${dt}`, { x: pageW - M - fontN.widthOfTextAtSize(`Ref. ${ref}  -  Genere le ${dt}`, 7), y: 18, font: fontN, size: 7, color: MG });

  return pdfDoc.save();
}

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
    const { d, ref, dt, attachments: clientAttachments } = JSON.parse(event.body);

    const pdfBytes = await generateMandatPDF(d, ref, dt);
    const pdfBase64 = Buffer.from(pdfBytes).toString('base64');

    const attachments = [
      { filename: `Mandat_Recherche_N20_${ref}.pdf`, content: pdfBase64 },
      ...(clientAttachments || []),
    ];

    const zones = [d.area1, d.area2, d.area3].filter(Boolean).join(' › ') || '—';
    const aList = [d.annex1, d.annex2, d.annex3].filter(Boolean)
      .map((n, i) => `<tr><td style="padding:8px 12px;color:#888;width:42%">Annexe ${i + 1}</td><td style="padding:8px 12px">${n}</td></tr>`)
      .join('') || '<tr><td colspan="2" style="padding:8px 12px;color:#aaa">Aucune annexe</td></tr>';

    const r = (l, v, w) => `<tr style="background:${w ? '#fff' : '#f8f9fb'}"><td style="padding:8px 12px;color:#888;width:42%">${l}</td><td style="padding:8px 12px">${v || '—'}</td></tr>`;
    const s = t => `<h3 style="margin:20px 0 12px;padding:8px 14px;background:#021623;color:#6EC1E4;border-radius:6px;font-size:12px;letter-spacing:1px;text-transform:uppercase">${t}</h3>`;

    const html = `<div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;color:#333;border-radius:10px;overflow:hidden;border:1px solid #e0e0e0"><div style="background:#021623;padding:28px 32px;text-align:center"><img src="https://nimmobilier59-afk.github.io/wp-content/uploads/2025/09/N20-Immobilier-.png" alt="N20 Immobilier" style="height:50px;display:block;margin:0 auto 14px"><p style="color:#6EC1E4;margin:0;font-size:13px;letter-spacing:2px;text-transform:uppercase">Nouveau Mandat de Recherche</p><p style="color:rgba(255,255,255,0.4);margin:6px 0 0;font-size:12px">Réf. ${ref} — ${dt}</p></div><div style="padding:24px 32px;background:#f8f9fb">${s('Demandeur')}<table style="width:100%;border-collapse:collapse;font-size:13px">${r('Nom complet', `<strong>${d.firstName} ${d.lastName}</strong>`, true)}${r('Date de naissance', d.dob, false)}${r('Adresse actuelle', d.currentAddress, true)}${r("Nombre d'enfants", d.children, false)}${r('Téléphone', d.phone, true)}${r('Email', d.email, false)}${r('Bail à son nom', d.leaseInName, true)}${r('Résiliation nécessaire', d.needTermination, false)}</table>${d.coVisible ? s('Co-locataire') + `<table style="width:100%;border-collapse:collapse;font-size:13px">${r('Nom complet', `${d.coFirstName} ${d.coLastName}`, true)}${r('Date de naissance', d.coDob, false)}${r('Téléphone', d.coPhone, true)}${r('Email', d.coEmail, false)}</table>` : ''}${s('Critères du bien')}<table style="width:100%;border-collapse:collapse;font-size:13px">${r('Type de bien', d.propertyType, true)}${r('Pièces minimum', d.minRooms, false)}${r('Budget max (CHF)', d.budget, true)}${r("Date d'entrée", d.moveIn, false)}${r('Communes souhaitées', zones, true)}${r('Remarques', d.notes || '—', false)}</table>${s('Pièces jointes')}<table style="width:100%;border-collapse:collapse;font-size:13px">${aList}</table></div><div style="background:#021623;padding:16px 32px;text-align:center"><p style="color:#6EC1E4;font-size:11px;margin:0">N20 Immobilier — contact@n20immobilier.ch — +41 76 419 20 21</p></div></div>`;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'N20 Immobilier <onboarding@resend.dev>',
        to: ['contact@n20immobilier.ch'],
        reply_to: d.email,
        subject: `Nouveau mandat de recherche — ${d.firstName} ${d.lastName} — Réf. ${ref}`,
        html,
        attachments,
      }),
    });

    const result = await res.json();
    if (!res.ok) throw new Error(JSON.stringify(result));

    return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};
