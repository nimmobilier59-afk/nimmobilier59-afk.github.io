const { jsPDF } = require('jspdf');
const RESEND_KEY = process.env.RESEND_KEY;

function generateMandatPDF(d, ref, dt) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210, M = 18, CW = 174;
  const NAV = [2, 22, 35], ACC = [110, 193, 228], LG = [240, 243, 246], MG = [150, 162, 172], BK = [20, 25, 30], WH = [255, 255, 255];
  let y = 0;

  // En-tête
  doc.setFillColor(...NAV); doc.rect(0, 0, W, 34, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(20); doc.setTextColor(...WH);
  doc.text('N20 IMMOBILIER', M, 15);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...ACC);
  doc.text('Votre partenaire de relocation a Geneve', M, 22);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(...WH);
  doc.text('MANDAT DE RECHERCHE', W - M, 13, { align: 'right' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...ACC);
  doc.text(`Ref. ${ref}  -  Date : ${dt}`, W - M, 22, { align: 'right' });
  y = 42;

  const chkPage = h => { if (y + h > 272) { doc.addPage(); y = 20; } };
  const sec = title => {
    chkPage(12);
    doc.setFillColor(...ACC); doc.rect(M, y, CW, 7, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...NAV);
    doc.text(title, M + 4, y + 5); y += 10;
  };
  const row = fields => {
    chkPage(16);
    const n = fields.length, cw = CW / n;
    doc.setFillColor(...LG); doc.rect(M, y, CW, 13, 'F');
    fields.forEach((f, i) => {
      const x = M + i * cw + 3;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(...MG);
      doc.text(String(f.l).toUpperCase(), x, y + 4.5);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...BK);
      doc.text(f.v || '—', x, y + 10, { maxWidth: cw - 6 });
    });
    y += 15;
  };
  const frow = (label, value) => {
    const lines = doc.splitTextToSize(value || '—', CW - 6);
    const h = Math.max(13, lines.length * 5 + 8);
    chkPage(h + 2);
    doc.setFillColor(...LG); doc.rect(M, y, CW, h, 'F');
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(...MG);
    doc.text(String(label).toUpperCase(), M + 3, y + 4.5);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...BK);
    doc.text(lines, M + 3, y + 10);
    y += h + 2;
  };
  const gap = () => { y += 3; };

  sec('1. DEMANDEUR');
  row([{ l: 'Nom', v: d.lastName }, { l: 'Prenom', v: d.firstName }, { l: 'Date de naissance', v: d.dob }, { l: "Nb d'enfants", v: d.children }]);
  gap(); frow('Adresse actuelle', d.currentAddress); gap();
  row([{ l: 'Telephone', v: d.phone }, { l: 'Email', v: d.email }]); gap();
  row([{ l: 'Bail a son nom', v: d.leaseInName }, { l: 'Resiliation necessaire', v: d.needTermination }]); gap();

  if (d.coVisible) {
    sec('2. CO-LOCATAIRE');
    row([{ l: 'Nom', v: d.coLastName }, { l: 'Prenom', v: d.coFirstName }, { l: 'Date de naissance', v: d.coDob }]);
    gap(); row([{ l: 'Telephone', v: d.coPhone }, { l: 'Email', v: d.coEmail }]); gap();
  }

  const sn = d.coVisible ? '3' : '2';
  sec(`${sn}. CRITERES DU BIEN`);
  row([{ l: 'Type de bien', v: d.propertyType }, { l: 'Pieces min.', v: d.minRooms }, { l: 'Budget max (CHF)', v: d.budget }, { l: "Date d'entree", v: d.moveIn }]);
  gap();
  const zones = [d.area1, d.area2, d.area3].filter(Boolean).join('  >  ') || '—';
  frow('Communes souhaitees', zones); gap();
  if (d.notes) { frow('Remarques complementaires', d.notes); gap(); }

  const as = d.coVisible ? '4' : '3';
  sec(`${as}. PIECES JOINTES`);
  const aList = [d.annex1, d.annex2, d.annex3].filter(Boolean);
  if (aList.length === 0) {
    chkPage(12);
    doc.setFont('helvetica', 'italic'); doc.setFontSize(8); doc.setTextColor(...MG);
    doc.text('Aucune piece jointe transmise.', M + 3, y + 6); y += 12;
  } else {
    aList.forEach((name, i) => {
      chkPage(12);
      doc.setFillColor(...LG); doc.rect(M, y, CW, 10, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...BK);
      doc.text(`Annexe ${i + 1} :`, M + 3, y + 6.5);
      doc.setFont('helvetica', 'normal'); doc.text(name, M + 30, y + 6.5, { maxWidth: CW - 33 });
      y += 12;
    });
  }
  gap();

  const ss = d.coVisible ? '5' : '4';
  chkPage(50);
  sec(`${ss}. SIGNATURE`);
  doc.setFillColor(...LG); doc.rect(M, y, CW, 40, 'F');
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...MG);
  doc.text('Le soussigne mandate N20 Immobilier pour effectuer des recherches conformement aux criteres definis ci-dessus.', M + 3, y + 8, { maxWidth: CW - 6 });
  doc.setDrawColor(...MG);
  doc.line(M + 3, y + 24, M + 74, y + 24); doc.line(M + 90, y + 24, W - M - 3, y + 24);
  doc.setFontSize(7); doc.setTextColor(...MG);
  doc.text('Lieu et date', M + 3, y + 29);
  doc.text('Signature du mandant', M + 90, y + 29);
  y += 46;

  const FY = 287;
  doc.setDrawColor(...ACC); doc.line(M, FY, W - M, FY);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...MG);
  doc.text('N20 Immobilier  -  contact@n20immobilier.ch  -  +41 76 419 20 21  -  www.n20immobilier.ch', W / 2, FY + 5, { align: 'center' });
  doc.text(`Ref. ${ref}  -  Genere le ${dt}`, W / 2, FY + 10, { align: 'center' });

  return doc.output('arraybuffer');
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

    // Générer le PDF mandat côté serveur
    const pdfBuffer = generateMandatPDF(d, ref, dt);
    const pdfBase64 = Buffer.from(pdfBuffer).toString('base64');

    // PDF mandat en première pièce jointe + annexes client
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
