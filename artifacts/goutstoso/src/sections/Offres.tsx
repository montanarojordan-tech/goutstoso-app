import { useState, useCallback, useRef, useEffect } from "react";
import * as React from "react";
import { uid, chf, fmt, today, sum, genLot, exportCSV } from "../utils";
import { SOCIETE, CGV, INIT } from "../constants";
import { LOGO_B64, pdfLogo, IMG_LIMONTA_50CL, IMG_CLEMENTINO_50CL, IMG_LIMELO_50CL, IMG_LIMONTA_25CL, IMG_LIMELO_25CL, IMG_CLEMENTINO_25CL, IMG_COFFRET } from "../images";
import { Ic, Badge, Modal, F, Sel, Btn, Card, SectionTitle, getProchainRappelFn } from "../ui";
import { getImg, COULEURS, calcTotal, calcTotalNet } from "../helpers";
import { SignaturePad } from "../SignaturePad";

// ══════════════════════════════════════════════════════════════
// PAGE: OFFRES COMMERCIALES
// ══════════════════════════════════════════════════════════════

const genererOffrePDF = async (offre, st) => {
try {
  await new Promise((res,rej)=>{
    if((window as any).jspdf){res(null);return;}
    const s=document.createElement("script");
    s.src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
    s.onload=res;s.onerror=rej;document.head.appendChild(s);
  });
  const {jsPDF} = (window as any).jspdf;
  const doc = new jsPDF({unit:"mm",format:"a4"});
  const W = 210; const mg = 14;
  const clientNom = offre.clientNom || "Client";
  const clientContact = offre.clientContact || "";
  const clientAdr = offre.clientAdresse || "";
  const clientNpaVille = [offre.clientNpa,offre.clientVille].filter(Boolean).join(" ");
  const clientEmail = offre.clientEmail || "";
  const clientTel = offre.clientTel || "";
  const clientSite = offre.clientSite || "";
  const clientLogo = offre.clientLogo || "";

  // Bande jaune top + logo
  doc.setFillColor(242,201,76); doc.rect(0,0,W,6,"F");
  pdfLogo(doc,mg);

  // Bloc OFFRE
  doc.setFillColor(10,10,10); doc.roundedRect(W-90,12,76,28,3,3,"F");
  doc.setFont("helvetica","bold"); doc.setFontSize(13); doc.setTextColor(242,201,76);
  doc.text("OFFRE COMMERCIALE",W-52,22,{align:"center"});
  doc.setFontSize(10); doc.setTextColor(255,255,255);
  doc.text(offre.numero,W-52,28,{align:"center"});
  doc.setFontSize(8);
  doc.text("Du "+fmt(offre.date)+" · Valable jusqu'au "+fmt(offre.dateValidite||offre.date),W-52,34,{align:"center"});

  // Ligne séparatrice
  doc.setDrawColor(230,230,228); doc.setLineWidth(0.4); doc.line(mg,42,W-mg,42);

  // Bloc client - hauteur dynamique selon les lignes remplies
  let y = 50;
  const clientLines = [];
  if(clientContact) clientLines.push(clientContact);
  if(clientAdr) clientLines.push(clientAdr);
  if(clientNpaVille) clientLines.push(clientNpaVille);
  if(clientEmail) clientLines.push(clientEmail);
  if(clientTel) clientLines.push(clientTel);
  if(clientSite) clientLines.push(clientSite);
  const blockH = Math.max(26, 10 + clientLines.length * 6);

  doc.setFillColor(249,249,246); doc.rect(mg,y-4,86,blockH,"F");
  doc.setFont("helvetica","bold"); doc.setFontSize(8); doc.setTextColor(115,115,115);
  doc.text("DESTINATAIRE",mg+4,y+1);
  doc.setFont("helvetica","bold"); doc.setFontSize(10); doc.setTextColor(10,10,10);
  doc.text(clientNom,mg+4,y+8);
  doc.setFont("helvetica","normal"); doc.setFontSize(8); doc.setTextColor(80,80,80);
  let cy = y+15;
  clientLines.forEach(l=>{ doc.text(l,mg+4,cy); cy+=5.5; });

  // Logo client (coin supérieur droit du bloc destinataire)
  if(clientLogo){
    try {
      const logoFmt = clientLogo.startsWith("data:image/png")?"PNG":"JPEG";
      doc.addImage(clientLogo,logoFmt,mg+62,y-2,22,16);
    } catch(e){ /* ignore si format non supporté */ }
  }

  // Bloc infos offre (positionné par rapport à y original, hauteur fixe 26)
  doc.setFillColor(254,249,231); doc.rect(W-100,y-4,86,26,"F");
  doc.setFont("helvetica","bold"); doc.setFontSize(8); doc.setTextColor(146,64,14);
  doc.text("INFORMATIONS",W-96,y+1);
  doc.setFont("helvetica","normal"); doc.setFontSize(8); doc.setTextColor(80,80,80);
  doc.text("N° offre : "+offre.numero,W-96,y+8);
  doc.text("Date : "+fmt(offre.date),W-96,y+14);
  doc.text("Validité : "+fmt(offre.dateValidite||offre.date),W-96,y+20);

  // Intro — avance y selon la hauteur réelle du bloc client
  y += blockH + 8;
  if(offre.introText){
    doc.setFont("helvetica","italic"); doc.setFontSize(9); doc.setTextColor(60,60,60);
    const lines = doc.splitTextToSize(offre.introText, W-mg*2);
    doc.text(lines, mg, y);
    y += lines.length*5+4;
  }

  // Tableau produits
  y += 4;
  const cols = [{l:"Produit",w:52},{l:"Format",w:18},{l:"Alcool",w:15},{l:"Prix public",w:24},{l:"Prix partenaire",w:28},{l:"Qté",w:12},{l:"Total CHF",w:24}];
  const tableW = cols.reduce((s,c)=>s+c.w,0);
  const startX = (W-tableW)/2;

  // En-tête tableau
  doc.setFillColor(10,10,10);
  doc.rect(startX,y,tableW,8,"F");
  let cx = startX;
  cols.forEach(c=>{
    doc.setFont("helvetica","bold"); doc.setFontSize(7); doc.setTextColor(242,201,76);
    doc.text(c.l,cx+c.w/2,y+5.5,{align:"center"});
    cx+=c.w;
  });
  y+=8;

  // Lignes produits
  const lignesValides = (offre.lignes||[]).filter(l=>l.produitId);
  let totalPrix = 0; let totalPublic = 0;
  lignesValides.forEach((l,i)=>{
    const prod = (st.produits||[]).find(p=>p.id===l.produitId);
    if(!prod) return;
    const pPart = prod.prixRevendeur||0;
    const pPub = prod.prixClient||0;
    const total = pPart*(l.qte||0);
    totalPrix += total;
    totalPublic += pPub*(l.qte||0);
    const bg = i%2===0 ? [255,255,255] : [249,249,246];
    doc.setFillColor(bg[0],bg[1],bg[2]);
    doc.rect(startX,y,tableW,9,"F");
    doc.setDrawColor(235,235,230); doc.setLineWidth(0.2);
    doc.line(startX,y+9,startX+tableW,y+9);
    const vals = [
      prod.nom+" "+prod.variante,
      prod.format,
      prod.alcool||"30% vol.",
      "CHF "+pPub.toFixed(2),
      "CHF "+pPart.toFixed(2),
      String(l.qte||0),
      "CHF "+total.toFixed(2),
    ];
    cx = startX;
    vals.forEach((v,vi)=>{
      doc.setFont("helvetica",vi===0?"bold":"normal"); doc.setFontSize(8);
      doc.setTextColor(vi===0?10:60,vi===0?10:60,vi===0?10:60);
      doc.text(v,cx+cols[vi].w/2,y+5.5,{align:"center"});
      cx+=cols[vi].w;
    });
    y+=9;
  });

  // Total
  doc.setFillColor(10,10,10);
  doc.rect(startX,y,tableW,10,"F");
  doc.setFont("helvetica","bold"); doc.setFontSize(10); doc.setTextColor(242,201,76);
  doc.text("TOTAL PARTENAIRE (hors TVA)",startX+4,y+6.5);
  doc.text("CHF "+totalPrix.toFixed(2),startX+tableW-4,y+6.5,{align:"right"});
  y+=10;

  // Conditions
  y+=6;
  doc.setFillColor(249,249,246); doc.rect(mg,y,W-mg*2,22,"F");
  doc.setFont("helvetica","bold"); doc.setFontSize(8); doc.setTextColor(80,80,80);
  doc.text("CONDITIONS",mg+4,y+5);
  doc.setFont("helvetica","normal"); doc.setFontSize(7.5); doc.setTextColor(100,100,100);
  doc.text("• Prix en CHF, hors TVA (Goûtstoso non assujetti à la TVA)",mg+4,y+11);
  doc.text("• Offre valable jusqu'au "+fmt(offre.dateValidite||offre.date)+" · Paiement à 30 jours dès livraison",mg+4,y+16);
  doc.text("• Tarifs réservés aux partenaires revendeurs et dépositaires agréés Goûtstoso",mg+4,y+21);
  y+=28;

  // Notes
  if(offre.notes){
    doc.setFont("helvetica","italic"); doc.setFontSize(8); doc.setTextColor(80,80,80);
    const nlines = doc.splitTextToSize("Note : "+offre.notes,W-mg*2);
    doc.text(nlines,mg,y); y+=nlines.length*5+4;
  }

  // Signatures — deux colonnes
  y+=8;
  doc.setFont("helvetica","normal"); doc.setFontSize(8); doc.setTextColor(100,100,100);
  doc.text("Pour acceptation, veuillez retourner ce document signé.",mg,y);
  y+=10;

  const sigColW = (W - mg*2 - 10) / 2;
  const col1X = mg;
  const col2X = mg + sigColW + 10;

  // Colonne Goûtstoso (gauche)
  const hasJordanSig = !!offre.signJordan;
  doc.setFillColor(hasJordanSig?230:249,hasJordanSig?246:249,hasJordanSig?230:246);
  doc.rect(col1X,y,sigColW,36,"F");
  doc.setFont("helvetica","bold"); doc.setFontSize(8); doc.setTextColor(80,80,80);
  doc.text("GOÛTSTOSO",col1X+4,y+5);
  doc.setFont("helvetica","normal"); doc.setFontSize(7.5); doc.setTextColor(120,120,120);
  doc.text("Jordan Montanaro",col1X+4,y+10);
  if(hasJordanSig) {
    doc.text("Date : "+fmt(today()),col1X+4,y+17);
    try { doc.addImage(offre.signJordan,"PNG",col1X+4,y+17,sigColW-8,16); } catch(e){}
    doc.setTextColor(21,128,61); doc.setFont("helvetica","bold"); doc.setFontSize(7);
    doc.text("✓ Signé — Jordan Montanaro",col1X+4,y+35);
  } else {
    doc.text("Date : ___________________",col1X+4,y+17);
    doc.setDrawColor(180,180,175); doc.setLineWidth(0.5);
    doc.line(col1X+4,y+32,col1X+sigColW-4,y+32);
    doc.setFont("helvetica","normal"); doc.setFontSize(7); doc.setTextColor(160,160,160);
    doc.text("Signature",col1X+4,y+36);
  }

  // Colonne Partenaire (droite)
  const hasSig = !!offre.signClient;
  doc.setFillColor(hasSig?230:249,hasSig?246:249,hasSig?230:246);
  doc.rect(col2X,y,sigColW,36,"F");
  doc.setFont("helvetica","bold"); doc.setFontSize(8); doc.setTextColor(80,80,80);
  doc.text(clientNom.toUpperCase(),col2X+4,y+5);
  doc.setFont("helvetica","normal"); doc.setFontSize(7.5); doc.setTextColor(120,120,120);
  doc.text(clientContact||"Représentant autorisé",col2X+4,y+10);
  if(hasSig) {
    const dateSig = offre.signedAt ? fmt(offre.signedAt.slice(0,10)) : fmt(today());
    doc.text("Date : "+dateSig,col2X+4,y+17);
    try { doc.addImage(offre.signClient,"PNG",col2X+4,y+17,sigColW-8,16); } catch(e){}
    doc.setTextColor(21,128,61); doc.setFont("helvetica","bold"); doc.setFontSize(7);
    doc.text("✓ Signé électroniquement — "+(offre.signerNom||clientNom),col2X+4,y+35);
  } else {
    doc.text("Date : ___________________",col2X+4,y+17);
    doc.setDrawColor(180,180,175); doc.setLineWidth(0.5);
    doc.line(col2X+4,y+32,col2X+sigColW-4,y+32);
    doc.setFont("helvetica","normal"); doc.setFontSize(7); doc.setTextColor(160,160,160);
    doc.text("Signature & cachet",col2X+4,y+36);
  }
  y+=42;

  // Footer
  doc.setDrawColor(230,230,228); doc.setLineWidth(0.3); doc.line(mg,282,W-mg,282);
  doc.setFont("helvetica","normal"); doc.setFontSize(7); doc.setTextColor(150,150,150);
  doc.text("Goûtstoso - Jordan Montanaro · Rue des Sources 19 · 2613 Villeret · admin@goutstoso.ch · www.goutstoso.ch",W/2,286,{align:"center"});
  doc.setFillColor(242,201,76); doc.rect(0,292,W,5,"F");

  doc.save(offre.numero+".pdf");
} catch(e){ alert("Erreur PDF : "+e.message); }
};

// PDF fiche de prospection (catalogue sans quantités + cases à cocher intérêt)
const genererProspectionPDF = async (offre, produits) => {
try {
  await new Promise((res,rej)=>{
    if((window as any).jspdf){res(null);return;}
    const s=document.createElement("script");
    s.src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
    s.onload=res;s.onerror=rej;document.head.appendChild(s);
  });
  const {jsPDF}=(window as any).jspdf;
  const doc=new jsPDF({unit:"mm",format:"a4"});
  const W=210; const mg=14;
  doc.setFillColor(242,201,76); doc.rect(0,0,W,6,"F");
  pdfLogo(doc,mg);
  doc.setFillColor(10,10,10); doc.roundedRect(W-90,12,76,28,3,3,"F");
  doc.setFont("helvetica","bold"); doc.setFontSize(11); doc.setTextColor(242,201,76);
  doc.text("FICHE DE PROSPECTION",W-52,22,{align:"center"});
  doc.setFontSize(8); doc.setTextColor(255,255,255);
  doc.text("Tarifs partenaires "+new Date().getFullYear(),W-52,28,{align:"center"});
  doc.text("Confidentiel · Réservé revendeurs",W-52,33,{align:"center"});
  doc.setDrawColor(230,230,228); doc.setLineWidth(0.4); doc.line(mg,42,W-mg,42);
  let y=50;
  if(offre.clientNom){
    doc.setFillColor(249,249,246); doc.rect(mg,y-4,90,20,"F");
    doc.setFont("helvetica","bold"); doc.setFontSize(8); doc.setTextColor(115,115,115);
    doc.text("DESTINATAIRE",mg+4,y+1);
    doc.setFont("helvetica","bold"); doc.setFontSize(10); doc.setTextColor(10,10,10);
    doc.text(offre.clientNom,mg+4,y+8);
    if(offre.clientContact){doc.setFont("helvetica","normal");doc.setFontSize(8);doc.setTextColor(80,80,80);doc.text(offre.clientContact,mg+4,y+14);}
    y+=28;
  }
  doc.setFont("helvetica","italic"); doc.setFontSize(9); doc.setTextColor(60,60,60);
  const intro="Madame, Monsieur,\n\nNous avons le plaisir de vous présenter notre gamme de liqueurs artisanales Goûtstoso. Vous trouverez ci-dessous nos produits et tarifs préférentiels réservés aux partenaires revendeurs et dépositaires agréés.";
  const introLines=doc.splitTextToSize(intro,W-mg*2);
  doc.text(introLines,mg,y); y+=introLines.length*5+8;
  const cols=[{l:"Produit",w:58},{l:"Format",w:18},{l:"Alcool",w:16},{l:"Description",w:58},{l:"Prix public",w:22},{l:"Prix partenaire",w:28}];
  const tableW=cols.reduce((s,c)=>s+c.w,0);
  const startX=(W-tableW)/2;
  doc.setFillColor(10,10,10); doc.rect(startX,y,tableW,8,"F");
  let cx=startX;
  cols.forEach(c=>{doc.setFont("helvetica","bold");doc.setFontSize(7);doc.setTextColor(242,201,76);doc.text(c.l,cx+c.w/2,y+5.5,{align:"center"});cx+=c.w;});
  y+=8;
  const prodActifs=(produits||[]).filter(p=>p.actif&&!p.nom.includes("Coffret"));
  prodActifs.forEach((prod,i)=>{
    const bg=i%2===0?[255,255,255]:[249,249,246];
    doc.setFillColor(bg[0],bg[1],bg[2]); doc.rect(startX,y,tableW,10,"F");
    doc.setDrawColor(235,235,230); doc.setLineWidth(0.2); doc.line(startX,y+10,startX+tableW,y+10);
    const desc=(prod.description||"").substring(0,34);
    const vals=[prod.nom+" "+prod.variante,prod.format,prod.alcool||"30% vol.",desc+"…","CHF "+(prod.prixClient||0).toFixed(2),"CHF "+(prod.prixRevendeur||0).toFixed(2)];
    cx=startX;
    vals.forEach((v,vi)=>{
      doc.setFont("helvetica",vi===0?"bold":"normal"); doc.setFontSize(7.5);
      doc.setTextColor(vi===0?10:60,vi===0?10:60,vi===0?10:60);
      const mw=cols[vi].w-2;
      const fitted=doc.getTextWidth(v)>mw?doc.splitTextToSize(v,mw)[0]+"…":v;
      doc.text(fitted,cx+cols[vi].w/2,y+6.5,{align:"center"}); cx+=cols[vi].w;
    });
    y+=10;
  });
  y+=10;
  doc.setFont("helvetica","bold"); doc.setFontSize(11); doc.setTextColor(10,10,10);
  doc.text("RETOUR D'INTERET",mg,y); y+=8;
  doc.setFont("helvetica","normal"); doc.setFontSize(9); doc.setTextColor(60,60,60);
  doc.text("Veuillez cocher votre choix et retourner ce document a admin@goutstoso.ch",mg,y); y+=10;
  const checks=[
    {label:"Interesse(e) — je souhaite referencer vos produits",checked:false},
    {label:"Pas interesse(e) pour le moment",checked:false},
  ];
  checks.forEach(c=>{
    doc.setDrawColor(80,80,80); doc.setLineWidth(0.5);
    doc.rect(mg,y-4,5,5);
    doc.setFont("helvetica","normal");doc.setFontSize(10);doc.setTextColor(10,10,10);
    doc.text(c.label,mg+8,y);
    y+=10;
  });
  y+=4;
  doc.setFillColor(240,240,238); doc.rect(mg,y,W-mg*2,20,"F");
  doc.setFont("helvetica","normal"); doc.setFontSize(8); doc.setTextColor(100,100,100);
  doc.text("Nom & prénom : ___________________________   Fonction : ___________________________",mg+4,y+6);
  doc.text("Date : ___________________   Signature / cachet : ___________________________",mg+4,y+14);
  doc.setDrawColor(230,230,228); doc.setLineWidth(0.3); doc.line(mg,282,W-mg,282);
  doc.setFont("helvetica","normal"); doc.setFontSize(7); doc.setTextColor(150,150,150);
  doc.text("Goûtstoso - Jordan Montanaro · Rue des Sources 19 · 2613 Villeret · admin@goutstoso.ch · www.goutstoso.ch",W/2,286,{align:"center"});
  doc.setFillColor(242,201,76); doc.rect(0,292,W,5,"F");
  const fname=offre.clientNom?"Prospection-"+offre.clientNom.replace(/\s+/g,"-")+".pdf":"Fiche-Prospection-Goutstoso.pdf";
  doc.save(fname);
} catch(e){ alert("Erreur PDF : "+e.message); }
};

export const Offres = ({st, setSt}) => {
const [modal, setModal] = useState(null);
const [viewId, setViewId] = useState(null);
const [form, setForm] = useState<any>(null);
const [recoveryToken, setRecoveryToken] = useState("");
const [recoveryTokenProspect, setRecoveryTokenProspect] = useState("");
const [sigJordanMode, setSigJordanMode] = useState(false);

const offres = st.offres || [];
const view = viewId ? offres.find(o=>o.id===viewId) : null;

const nextNumero = () => {
  const y = new Date().getFullYear();
  const existing = offres.map(o=>o.numero||"");
  let n=1;
  while(existing.includes("OFF-"+y+"-"+String(n).padStart(3,"0"))) n++;
  return "OFF-"+y+"-"+String(n).padStart(3,"0");
};

const dateValiditeDefaut = () => {
  const d = new Date(); d.setDate(d.getDate()+30);
  return d.toISOString().slice(0,10);
};

const allProduitsLignes = (existingLignes=[]) =>
  (st.produits||[]).filter(p=>p.actif&&!p.nom.includes("Coffret")).map(p=>{
    const ex = existingLignes.find(l=>l.produitId===p.id);
    return {produitId:p.id, qte:ex?.qte||0};
  });

const emptyForm = () => ({
  id:null,
  numero:nextNumero(),
  date:today(),
  dateValidite:dateValiditeDefaut(),
  partenaireId:"",
  clientNom:"",
  clientContact:"",
  clientAdresse:"",
  clientNpa:"",
  clientVille:"",
  clientEmail:"",
  clientTel:"",
  clientSite:"",
  clientLogo:"",
  introText:"Nous avons le plaisir de vous soumettre notre offre commerciale pour nos liqueurs artisanales Goûtstoso. Vous trouverez ci-dessous notre tarification partenaire ainsi que le détail de nos produits disponibles.",
  lignes:allProduitsLignes(),
  notes:"",
  statut:"prospection",
  interetConfirme:false,
  typeContrat:"",
  contratId:"",
  commandeId:"",
});

const saveOffre = () => {
  if(!form.clientNom && !form.partenaireId){ alert("Renseigne au moins le nom du destinataire ou un partenaire"); return; }
  const lignesOk = (form.lignes||[]).filter(l=>l.produitId&&l.qte>0);
  const needsLignes = !["prospection","intérêt"].includes(form.statut);
  if(needsLignes && !lignesOk.length){ alert("Ajoute au moins un produit avec une quantité"); return; }
  const pv = (st.partenaires||[]).find(p=>p.id===form.partenaireId);
  const saved = {
    ...form,
    id: form.id||uid(),
    lignes: lignesOk,
    clientNom: form.clientNom||(pv?.nom||""),
    clientContact: form.clientContact||(pv?.contact||""),
    clientAdresse: form.clientAdresse||(pv?.adresse||""),
    clientNpa: form.clientNpa||(pv?.npa||""),
    clientVille: form.clientVille||(pv?.ville||""),
    clientEmail: form.clientEmail||(pv?.email||""),
    clientTel: form.clientTel||(pv?.tel||""),
    clientSite: form.clientSite||(pv?.site||""),
    clientLogo: form.clientLogo||(pv?.logo||""),
    createdAt: form.createdAt||today(),
    modifieLe: today(),
  };
  if(form.id){
    setSt(p=>({...p,offres:(p.offres||[]).map(o=>o.id===form.id?saved:o)}));
  } else {
    setSt(p=>({...p,offres:[...(p.offres||[]),saved]}));
  }
  setModal(null);
  setViewId(saved.id);
};

const SIGN_API = (process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : "https://goutstoso.replit.app") + "/api";

const envoyerPourSignature = async (documentType, documentTitle, documentData, email="") => {
  try {
    const r = await fetch(`${SIGN_API}/sign`, {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({documentType, documentTitle, documentData, expiresInDays:30}),
    });
    if(!r.ok) throw new Error("Erreur serveur");
    const {token, signingUrl} = await r.json();
    try { await navigator.clipboard.writeText(signingUrl); } catch(_){}
    const signature = `L'équipe Goûtstoso\n\nGoûtstoso · Administratif\nT : +41 79 522 06 56\nadmin@goutstoso.ch\nRue des Sources 19 · 2613 Villeret - SWITZERLAND\nwww.goutstoso.ch`;
    const emailBody = documentType==="prospection"
      ? `Madame, Monsieur,\n\nVous trouverez ci-joint notre offre de prospection présentant la gamme Goûtstoso et nos tarifs partenaires.\n\nSi vous êtes d'accord avec celle-ci, veuillez vous rendre sur le lien suivant pour accepter nos prix :\n\n${signingUrl}\n\nSi cela vous intéresse, veuillez nous envoyer votre commande en répondant à cet e-mail.\n\nNous restons à votre disposition pour tout renseignement complémentaire.\n\nCordialement,\n\n${signature}`
      : `Madame, Monsieur,\n\nNous avons le plaisir de vous faire parvenir notre ${documentTitle} relative à la vente de nos liqueurs artisanales Goûtstoso.\n\nVeuillez trouver ci-dessous le lien vous permettant de consulter l'offre dans son intégralité. Si celle-ci vous convient et que vous souhaitez la valider, nous vous invitons à apposer votre signature électronique directement en ligne :\n\n${signingUrl}\n\nCe lien est valable 30 jours. La signature est simple et rapide — aucune application n'est nécessaire.\n\nNous demeurons bien entendu à votre disposition pour tout renseignement complémentaire.\n\nCordialement,\n\n${signature}`;
    const sujet = documentType==="prospection"
      ? encodeURIComponent("Goûtstoso · Offre de prospection")
      : encodeURIComponent(`Signature requise — ${documentTitle}`);
    if(email) {
      const corps = encodeURIComponent(emailBody);
      window.open(`mailto:${email}?subject=${sujet}&body=${corps}`, "_blank");
    } else {
      alert(`✅ Lien de signature créé et copié !\n\n${signingUrl}`);
    }
    return token;
  } catch(e) {
    alert("Erreur lors de la création du lien : " + e.message);
    return null;
  }
};

const creerContactDepuisOffre = (offre) => {
  const nom = offre.clientNom || offre.clientContact || "";
  if(!nom){ alert("Aucun nom de client renseigné sur cette offre."); return; }
  const existe = (st.clients||[]).find((f:any)=>f.nom?.toLowerCase()===nom.toLowerCase());
  if(existe){ alert(`Le contact "${nom}" existe déjà dans les clients.`); return; }
  const nouveau = {
    id: uid(),
    nom,
    email: offre.clientEmail||"",
    telephone: offre.clientTel||"",
    adresse: offre.clientAdresse||"",
    npa: offre.clientNpa||"",
    ville: offre.clientVille||"",
    categorie: "Client",
    notes: offre.clientSite ? "Site : "+offre.clientSite : "",
  };
  setSt((p:any)=>({...p,clients:[...(p.clients||[]),nouveau]}));
  alert(`✅ Contact "${nom}" créé dans l'onglet Clients.`);
};

const supprimerOffre = (id) => {
  if(!window.confirm("Supprimer cette offre ?")) return;
  setSt(p=>({...p,offres:(p.offres||[]).filter(o=>o.id!==id)}));
  setViewId(null);
};

const creerContratDepotVente = (offre) => {
  if(!window.confirm("Créer un contrat de dépôt-vente depuis cette offre ?")) return;
  const y = new Date().getFullYear();
  const existing = (st.contrats||[]).filter(c=>c.numero?.startsWith("OFF-DEP-")).map(c=>c.numero);
  let n=1; while(existing.includes("OFF-DEP-"+y+"-"+String(n).padStart(3,"0"))) n++;
  const numero = "OFF-DEP-"+y+"-"+String(n).padStart(3,"0");
  const cid = uid();
  const newContrat = {
    id:cid, numero, type:"depot-vente",
    partenaireId:offre.partenaireId||"",
    clientNom:offre.clientNom, clientEmail:offre.clientEmail||"",
    clientAdresse:offre.clientAdresse||"", clientNpa:offre.clientNpa||"", clientVille:offre.clientVille||"",
    clientContact:offre.clientContact||"",
    dateDebut:today(), dateFin:"",
    commission:0,
    lignes:(offre.lignes||[]).filter(l=>l.qte>0).map(l=>({produitId:l.produitId,qte:l.qte,prixUnitaire:0})),
    notes:"Issu de l'offre "+offre.numero,
    statut:"brouillon",
    signFournisseur:null, signClient:null,
    lieuSignature:"Villeret",
    modeAcceptation:"signature",
    offreId:offre.id,
  };
  setSt(p=>({
    ...p,
    contrats:[...(p.contrats||[]),newContrat],
    offres:(p.offres||[]).map(o=>o.id===offre.id?{...o,typeContrat:"depot-vente",contratId:cid}:o),
  }));
  alert("✅ Contrat "+numero+" créé ! Va dans Partenaires → Contrats pour l'envoyer à la signature.");
};

const creerCommandeAchat = (offre) => {
  if(!window.confirm("Créer une commande achat ferme depuis cette offre ?")) return;
  const y = new Date().getFullYear();
  const existing = (st.commandes||[]).map(c=>c.numero);
  let n=1; while(existing.includes("CMD-"+y+"-"+String(n).padStart(3,"0"))) n++;
  const numero = "CMD-"+y+"-"+String(n).padStart(3,"0");
  const cid = uid();
  const lignesOk = (offre.lignes||[]).filter(l=>l.qte>0).map(l=>({produitId:l.produitId,qte:l.qte}));
  const newCmd = {
    id:cid, numero, date:today(),
    clientId:"", client:offre.clientNom,
    email:offre.clientEmail||"", telephone:"", adresse:offre.clientAdresse||"",
    npa:offre.clientNpa||"", ville:offre.clientVille||"",
    lignes:lignesOk,
    rabais:0, fraisPort:0, commissionShopify:0,
    source:"partenaire",
    statut:"en attente", envoyeeCompta:false,
    stockDeduit:true,
    notes:"Issue de l'offre "+offre.numero+" (achat ferme)",
    offreId:offre.id,
  };
  setSt(p=>{
    let newStocks = [...(p.stocks||[])];
    const newMouvements = [...(p.mouvementsStock||[])];
    lignesOk.forEach(l=>{
      let restant = parseInt(l.qte)||0;
      newStocks = newStocks.map(s=>{
        if(s.produitId!==l.produitId||restant<=0) return s;
        const dedd = Math.min(s.qte||0,restant);
        restant -= dedd;
        return {...s, qte:(s.qte||0)-dedd};
      });
      newMouvements.push({id:uid(),date:today(),type:"sortie",produitId:l.produitId,qte:-(parseInt(l.qte)||0),source:`Commande ${numero} (offre ${offre.numero})`,commandeId:cid});
    });
    return {
      ...p,
      stocks:newStocks,
      mouvementsStock:newMouvements,
      commandes:[...(p.commandes||[]),newCmd],
      offres:(p.offres||[]).map(o=>o.id===offre.id?{...o,typeContrat:"achat",commandeId:cid}:o),
    };
  });
  const details = lignesOk.map(l=>{
    const prod = st.produits.find(x=>x.id===l.produitId);
    return `• ${prod?.nom||""} ${prod?.variante||""} ${prod?.format||""} : -${l.qte}`;
  }).join("\n");
  alert(`✅ Commande ${numero} créée\n\n📦 Stock déduit :\n${details}\n\nRetrouve-la dans Ventes → Commandes.`);
};

const convertirEnCommande = (offre) => {
  creerCommandeAchat(offre);
};

const setStatut = (id, statut) => setSt(p=>({...p,offres:(p.offres||[]).map(o=>o.id===id?{...o,statut}:o)}));

const totalOffre = (offre) => {
  return (offre.lignes||[]).reduce((s,l)=>{
    const p=(st.produits||[]).find(x=>x.id===l.produitId);
    return s+(p?.prixRevendeur||0)*(l.qte||0);
  },0);
};

const statutConfig = {
  "prospection":{color:"#1E40AF",bg:"#DBEAFE",label:"🔍 Prospection"},
  "intérêt":{color:"#6D28D9",bg:"#EDE9FE",label:"✅ Intérêt confirmé"},
  "brouillon":{color:"#6B7280",bg:"#F3F4F6",label:"📝 Offre rédigée"},
  "envoyée":{color:"#92400E",bg:"#FEF9E7",label:"✉️ Offre envoyée"},
  "acceptée":{color:"#166534",bg:"#DCFCE7",label:"✍️ Signée ✓"},
  "refusée":{color:"#991B1B",bg:"#FEE2E2",label:"❌ Refusée"},
};

const updLigne = (i,v) => setForm(p=>({...p,lignes:p.lignes.map((l,j)=>j===i?{...l,qte:typeof v==="number"?v:parseInt(v.replace(/[^0-9]/g,""))||0}:l)}));

// Vue détail
if(view) return (
<div className="fade">
  <button onClick={()=>setViewId(null)} style={{display:"flex",alignItems:"center",gap:6,background:"none",border:"none",color:"#9CA3AF",fontSize:13,marginBottom:12,padding:0,cursor:"pointer"}}>← Retour</button>

  {/* ── PIPELINE ── */}
  {(()=>{
    const pipeline=[
      {key:"prospection",label:"Prospection",emoji:"🔍"},
      {key:"intérêt",label:"Intérêt",emoji:"💬"},
      {key:"offre",label:"Offre",emoji:"📋"},
      {key:"signée",label:"Signée",emoji:"✍️"},
    ];
    const ordre=["prospection","intérêt","brouillon","envoyée","acceptée"];
    const ci=ordre.indexOf(view.statut);
    const step=ci<=1?ci:ci<=3?2:3;
    return (
      <div style={{display:"flex",alignItems:"center",gap:0,marginBottom:16,background:"#F9F9F6",borderRadius:12,padding:"10px 8px"}}>
        {pipeline.map((s,i)=>{
          const done=i<step;
          const active=i===step;
          return (
            <React.Fragment key={s.key}>
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",flex:1,opacity:done||active?1:0.35}}>
                <div style={{width:30,height:30,borderRadius:"50%",background:done?"#166534":active?"#0A0A0A":"#E5E7EB",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,marginBottom:4,flexShrink:0}}>
                  {done?<span style={{color:"#fff",fontSize:12,fontWeight:700}}>✓</span>:<span>{s.emoji}</span>}
                </div>
                <p style={{fontSize:9,fontWeight:active||done?700:400,color:done?"#166534":active?"#0A0A0A":"#9CA3AF",textAlign:"center"}}>{s.label}</p>
              </div>
              {i<3&&<div style={{height:2,background:done?"#166534":"#E5E7EB",width:20,marginBottom:14,flexShrink:0}}/>}
            </React.Fragment>
          );
        })}
      </div>
    );
  })()}

  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4}}>
    <div style={{flex:1,minWidth:0}}>
      <h2 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,fontWeight:700}}>{view.numero}</h2>
      <p style={{fontSize:13,fontWeight:600,color:"#111",marginTop:2}}>{view.clientNom}</p>
    </div>
    <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6,flexShrink:0,marginLeft:10}}>
      {view.clientLogo && <img src={view.clientLogo} alt="logo" style={{height:36,maxWidth:80,objectFit:"contain",borderRadius:6,border:"1px solid #EAE7E0",background:"#fff",padding:3}}/>}
      <span style={{background:statutConfig[view.statut]?.bg||"#F3F4F6",color:statutConfig[view.statut]?.color||"#6B7280",borderRadius:20,padding:"4px 12px",fontSize:11,fontWeight:700}}>
        {statutConfig[view.statut]?.label||view.statut}
      </span>
    </div>
  </div>
  <p style={{fontSize:11,color:"#9CA3AF",marginBottom:10}}>Émise le {fmt(view.date)} · Valable jusqu'au {fmt(view.dateValidite||view.date)}</p>

  {/* ── ÉTAPE 1 : PROSPECTION ── */}
  {(view.statut==="prospection") && (
    <Card style={{padding:"14px",marginBottom:12,background:"#EFF6FF",border:"1.5px solid #BFDBFE"}}>
      <p style={{fontSize:12,fontWeight:700,color:"#1E40AF",marginBottom:10}}>🔍 Étape 1 — Prospection</p>
      <button onClick={()=>genererProspectionPDF(view,st.produits)} style={{width:"100%",background:"#1E40AF",color:"#fff",border:"none",borderRadius:9,padding:"10px",fontWeight:700,fontSize:12,cursor:"pointer",marginBottom:8,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
        📋 Télécharger la fiche produits (PDF)
      </button>
      {view.clientEmail&&(
        <button onClick={()=>{
          const sujet=encodeURIComponent("Goûtstoso · Fiche de prospection");
          const corps=encodeURIComponent(`Madame, Monsieur,\n\nNous avons le plaisir de vous faire parvenir notre fiche de prospection présentant la gamme Goûtstoso et nos tarifs partenaires.\n\nNous vous invitons à consulter le document joint et à nous retourner la fiche complétée (intérêt et type de collaboration souhaité) par retour d'email.\n\nNous sommes à votre disposition pour tout renseignement.\n\nCordialement,\nJordan Montanaro\nGoûtstoso\nadmin@goutstoso.ch · +41 79 522 06 56`);
          window.open(`mailto:${view.clientEmail}?subject=${sujet}&body=${corps}`,"_blank");
        }} style={{width:"100%",background:"#fff",border:"1.5px solid #BFDBFE",borderRadius:9,padding:"9px",fontWeight:600,fontSize:12,color:"#1E40AF",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
          ✉️ Envoyer la fiche par email
        </button>
      )}
      <div style={{marginTop:10,paddingTop:10,borderTop:"1px solid #BFDBFE"}}>
        <p style={{fontSize:11,color:"#374151",marginBottom:6,fontWeight:600}}>📲 Validation en ligne</p>
        <button onClick={async()=>{
          const enriched={...view,clientNom:view.clientNom||"",email:view.clientEmail||"",
            lignes:(st.produits||[]).filter((p:any)=>p.actif!==false).map((p:any)=>({
              designation:[p.nom,p.variante,p.format].filter(Boolean).join(" · "),
              prixUnitaire:p.prixRevendeur||0,
              qte:1,
            }))
          };
          const titre="Fiche de prospection Goûtstoso"+(view.clientNom?" — "+view.clientNom:"");
          const token=await envoyerPourSignature("prospection",titre,enriched,view.clientEmail||"");
          if(token) setSt(p=>({...p,offres:p.offres.map(o=>o.id===view.id?{...o,signingToken:token}:o)}));
        }} style={{width:"100%",background:"linear-gradient(135deg,#1E40AF,#1D4ED8)",color:"#fff",border:"none",borderRadius:9,padding:"10px",fontWeight:700,fontSize:12,cursor:"pointer",marginBottom:6,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
          🔏 Envoyer le lien de validation
        </button>
        {view.signingToken&&(
          <button onClick={async()=>{try{const r=await fetch(`${SIGN_API}/sign/${view.signingToken}`);const d=await r.json();if(d.status!=="signed"){alert("Pas encore validé. Relancez une fois que le prospect a cliqué le lien.");return;}setSt(p=>({...p,offres:p.offres.map(o=>o.id===view.id?{...o,signClient:d.signatureData,statut:"intérêt",signerNom:d.signerName,signingToken:null}:o)}));alert(`✅ ${d.signerName} a confirmé son intérêt !\nStatut passé à "Intérêt confirmé".`);}catch(e){alert("Erreur : "+e.message);}}}

            style={{width:"100%",marginBottom:6,background:"#DCFCE7",border:"1.5px solid #86EFAC",borderRadius:9,padding:"9px",fontWeight:700,fontSize:12,color:"#166534",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
            🔄 Vérifier la validation
          </button>
        )}
        {!view.signingToken&&(
          <div style={{display:"flex",gap:6,marginBottom:6,alignItems:"center"}}>
            <input value={recoveryTokenProspect} onChange={e=>setRecoveryTokenProspect(e.target.value)} placeholder="Token existant…" style={{flex:1,padding:"7px 10px",borderRadius:8,border:"1px solid #BFDBFE",fontSize:11,outline:"none",color:"#374151"}}/>
            <button onClick={async()=>{const t=recoveryTokenProspect.trim();if(!t)return;try{const r=await fetch(`${SIGN_API}/sign/${t}`);const d=await r.json();if(d.status!=="signed"){alert("Ce token n'est pas encore validé.");return;}setSt(p=>({...p,offres:p.offres.map(o=>o.id===view.id?{...o,signClient:d.signatureData,statut:"intérêt",signerNom:d.signerName}:o)}));setRecoveryTokenProspect("");alert(`✅ Intérêt de ${d.signerName} enregistré !`);}catch(e){alert("Erreur : "+e.message);}}}

              style={{padding:"7px 10px",borderRadius:8,background:"#EFF6FF",border:"1px solid #BFDBFE",fontSize:11,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap",color:"#1E40AF"}}>🔍 Récupérer</button>
          </div>
        )}
      </div>
      <div style={{marginTop:10,paddingTop:10,borderTop:"1px solid #BFDBFE"}}>
        <p style={{fontSize:11,color:"#374151",marginBottom:4,fontWeight:600}}>Le partenaire a confirmé son intérêt ?</p>
        <p style={{fontSize:10,color:"#6B7280",marginBottom:10}}>Choisis le type de collaboration souhaité :</p>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
          <button onClick={()=>setSt(p=>({...p,offres:p.offres.map(o=>o.id===view.id?{...o,statut:"intérêt",interetConfirme:true,typeContrat:"depot-vente"}:o)}))}
            style={{background:"#0A0A0A",color:"#F2C94C",border:"none",borderRadius:10,padding:"12px 8px",fontWeight:700,fontSize:11,cursor:"pointer",textAlign:"center",lineHeight:1.5}}>
            🏪 Dépôt-vente<br/>
            <span style={{fontSize:9,fontWeight:400,color:"#D4A017"}}>Contrat + commission</span>
          </button>
          <button onClick={()=>setSt(p=>({...p,offres:p.offres.map(o=>o.id===view.id?{...o,statut:"intérêt",interetConfirme:true,typeContrat:"achat"}:o)}))}
            style={{background:"#1E40AF",color:"#fff",border:"none",borderRadius:10,padding:"12px 8px",fontWeight:700,fontSize:11,cursor:"pointer",textAlign:"center",lineHeight:1.5}}>
            💳 Achat ferme<br/>
            <span style={{fontSize:9,fontWeight:400,color:"#93C5FD"}}>Commande + facture</span>
          </button>
        </div>
        <button onClick={()=>setSt(p=>({...p,offres:p.offres.map(o=>o.id===view.id?{...o,statut:"intérêt",interetConfirme:true,typeContrat:""}:o)}))}
          style={{width:"100%",background:"#F5F3FF",color:"#6D28D9",border:"1.5px solid #DDD6FE",borderRadius:9,padding:"9px",fontWeight:600,fontSize:11,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
          📋 À définir — Rédiger l'offre d'abord
        </button>
      </div>
    </Card>
  )}

  {/* ── ÉTAPE 2 : INTÉRÊT CONFIRMÉ → rédiger offre ── */}
  {(view.statut==="intérêt") && (
    <Card style={{padding:"14px",marginBottom:12,background:"#F5F3FF",border:"1.5px solid #DDD6FE"}}>
      <p style={{fontSize:12,fontWeight:700,color:"#6D28D9",marginBottom:6}}>✅ Étape 2 — Intérêt confirmé</p>
      {view.typeContrat==="depot-vente" && <div style={{background:"#0A0A0A",borderRadius:8,padding:"8px 10px",marginBottom:10,display:"flex",alignItems:"center",gap:6}}><span style={{fontSize:13}}>🏪</span><span style={{fontSize:11,fontWeight:700,color:"#F2C94C"}}>Dépôt-vente</span><button onClick={()=>setSt(p=>({...p,offres:p.offres.map(o=>o.id===view.id?{...o,typeContrat:""}:o)}))} style={{marginLeft:"auto",background:"none",border:"none",fontSize:9,color:"#9CA3AF",cursor:"pointer"}}>changer</button></div>}
      {view.typeContrat==="achat" && <div style={{background:"#1E40AF",borderRadius:8,padding:"8px 10px",marginBottom:10,display:"flex",alignItems:"center",gap:6}}><span style={{fontSize:13}}>💳</span><span style={{fontSize:11,fontWeight:700,color:"#fff"}}>Achat ferme</span><button onClick={()=>setSt(p=>({...p,offres:p.offres.map(o=>o.id===view.id?{...o,typeContrat:""}:o)}))} style={{marginLeft:"auto",background:"none",border:"none",fontSize:9,color:"#93C5FD",cursor:"pointer"}}>changer</button></div>}
      {!view.typeContrat && <div style={{background:"#F5F3FF",borderRadius:8,padding:"8px 10px",marginBottom:10,display:"flex",alignItems:"center",gap:6}}><span style={{fontSize:13}}>📋</span><span style={{fontSize:11,color:"#6D28D9"}}>Type à définir dans l'offre</span></div>}
      <p style={{fontSize:11,color:"#374151",marginBottom:10}}>Rédige l'offre commerciale avec les quantités souhaitées, puis envoie-la pour signature.</p>
      <button onClick={()=>{setForm({...view,statut:"brouillon",lignes:allProduitsLignes(view.lignes||[])});setModal("form");setViewId(null);}}

        style={{width:"100%",background:"#6D28D9",color:"#fff",border:"none",borderRadius:9,padding:"10px",fontWeight:700,fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
        📝 Rédiger l'offre commerciale
      </button>
    </Card>
  )}

  {/* ── OFFRE SIGNÉE : choisir le flux ── */}
  {view.statut==="acceptée" && !view.typeContrat && (
    <Card style={{padding:"14px",marginBottom:12,background:"#F0FDF4",border:"1.5px solid #86EFAC"}}>
      <p style={{fontSize:12,fontWeight:700,color:"#166534",marginBottom:4}}>🎉 Offre signée — Choisis le flux :</p>
      <p style={{fontSize:11,color:"#374151",marginBottom:12}}>Ce choix détermine les documents générés et le processus de facturation.</p>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <button onClick={()=>creerContratDepotVente(view)}
          style={{background:"#0A0A0A",color:"#F2C94C",border:"none",borderRadius:10,padding:"14px 8px",fontWeight:700,fontSize:12,cursor:"pointer",textAlign:"center",lineHeight:1.5}}>
          🏪 Dépôt-vente<br/>
          <span style={{fontSize:10,fontWeight:400,color:"#D4A017"}}>Contrat OFF-DEP-…<br/>+ signature par lien</span>
        </button>
        <button onClick={()=>creerCommandeAchat(view)}
          style={{background:"#1E40AF",color:"#fff",border:"none",borderRadius:10,padding:"14px 8px",fontWeight:700,fontSize:12,cursor:"pointer",textAlign:"center",lineHeight:1.5}}>
          💳 Achat ferme<br/>
          <span style={{fontSize:10,fontWeight:400,color:"#93C5FD"}}>Commande CMD-…<br/>+ confirmation + facture</span>
        </button>
      </div>
    </Card>
  )}

  {/* ── FLUX DÉPÔT-VENTE ACTIF ── */}
  {view.statut==="acceptée" && view.typeContrat==="depot-vente" && (
    <Card style={{padding:"12px 14px",marginBottom:12,background:"#0A0A0A",border:"none"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
        <p style={{fontSize:12,fontWeight:700,color:"#F2C94C"}}>🏪 Flux dépôt-vente</p>
        <button onClick={()=>setSt(p=>({...p,offres:p.offres.map(o=>o.id===view.id?{...o,typeContrat:"",contratId:""}:o)}))}
          style={{background:"none",border:"none",fontSize:10,color:"#6B7280",cursor:"pointer"}}>changer</button>
      </div>
      {view.contratId ? (
        <div>
          <p style={{fontSize:11,color:"#D1D5DB",marginBottom:8}}>Contrat créé — va dans <strong style={{color:"#F2C94C"}}>Partenaires → Contrats</strong> pour l'envoyer à la signature.</p>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
            <div style={{background:"#1F1F1F",borderRadius:8,padding:"8px",textAlign:"center"}}>
              <p style={{fontSize:9,color:"#9CA3AF",marginBottom:2}}>CONTRAT</p>
              <p style={{fontSize:11,fontWeight:700,color:"#F2C94C"}}>{(st.contrats||[]).find(c=>c.id===view.contratId)?.numero||"—"}</p>
            </div>
            <div style={{background:"#1F1F1F",borderRadius:8,padding:"8px",textAlign:"center"}}>
              <p style={{fontSize:9,color:"#9CA3AF",marginBottom:2}}>STATUT</p>
              <p style={{fontSize:11,fontWeight:700,color:"#D4A017"}}>{(st.contrats||[]).find(c=>c.id===view.contratId)?.statut||"brouillon"}</p>
            </div>
          </div>
        </div>
      ) : (
        <button onClick={()=>creerContratDepotVente(view)}
          style={{width:"100%",background:"#F2C94C",color:"#0A0A0A",border:"none",borderRadius:8,padding:"10px",fontWeight:700,fontSize:12,cursor:"pointer"}}>
          📋 Générer le contrat OFF-DEP
        </button>
      )}
    </Card>
  )}

  {/* ── FLUX ACHAT FERME ACTIF ── */}
  {view.statut==="acceptée" && view.typeContrat==="achat" && (
    <Card style={{padding:"12px 14px",marginBottom:12,background:"#1E3A8A",border:"none"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
        <p style={{fontSize:12,fontWeight:700,color:"#fff"}}>💳 Flux achat ferme</p>
        <button onClick={()=>setSt(p=>({...p,offres:p.offres.map(o=>o.id===view.id?{...o,typeContrat:"",commandeId:""}:o)}))}
          style={{background:"none",border:"none",fontSize:10,color:"#93C5FD",cursor:"pointer"}}>changer</button>
      </div>
      {(()=>{
        const cmd = (st.commandes||[]).find(c=>c.id===view.commandeId);
        if(!cmd) return (
          <button onClick={()=>creerCommandeAchat(view)}
            style={{width:"100%",background:"#F2C94C",color:"#0A0A0A",border:"none",borderRadius:8,padding:"10px",fontWeight:700,fontSize:12,cursor:"pointer"}}>
            📦 Créer la commande client
          </button>
        );
        const steps=[
          {l:"Commande",v:cmd.numero,ok:true,ic:"📦"},
          {l:"Confirmation",v:cmd.confirmationNumero||"—",ok:!!cmd.confirmationNumero,ic:"✅"},
          {l:"Facture",v:cmd.factureNumero||"—",ok:!!cmd.factureNumero,ic:"🧾"},
        ];
        return (
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6}}>
            {steps.map((s,i)=>(
              <div key={i} style={{background:s.ok?"#1E40AF":"#172554",borderRadius:8,padding:"8px",textAlign:"center",border:s.ok?"1px solid #3B82F6":"1px solid #1E3A8A"}}>
                <p style={{fontSize:13}}>{s.ic}</p>
                <p style={{fontSize:8,color:"#93C5FD",marginBottom:2}}>{s.l}</p>
                <p style={{fontSize:9,fontWeight:700,color:s.ok?"#fff":"#4B5563"}}>{s.v}</p>
              </div>
            ))}
          </div>
        );
      })()}
    </Card>
  )}

  {/* Bloc infos partenaire */}
  <Card style={{padding:"10px 14px",marginBottom:14,background:"#F9F9F6",border:"1px solid #EAE7E0"}}>
    <div style={{display:"grid",gridTemplateColumns:"auto 1fr",gap:"4px 12px",fontSize:11}}>
      {view.clientContact&&<><span style={{color:"#9CA3AF",fontWeight:600}}>Contact</span><span>{view.clientContact}</span></>}
      {(view.clientAdresse||view.clientNpa||view.clientVille)&&<><span style={{color:"#9CA3AF",fontWeight:600}}>Adresse</span><span>{[view.clientAdresse,[view.clientNpa,view.clientVille].filter(Boolean).join(" ")].filter(Boolean).join(", ")}</span></>}
      {view.clientEmail&&<><span style={{color:"#9CA3AF",fontWeight:600}}>Email</span><span>{view.clientEmail}</span></>}
      {view.clientTel&&<><span style={{color:"#9CA3AF",fontWeight:600}}>Tél.</span><span>{view.clientTel}</span></>}
      {view.clientSite&&<><span style={{color:"#9CA3AF",fontWeight:600}}>Site</span><span>{view.clientSite}</span></>}
    </div>
  </Card>

  {/* Actions */}
  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:8}}>
    <button onClick={()=>genererOffrePDF(view,st)} style={{background:"#111",color:"#F2C94C",border:"none",borderRadius:10,padding:"11px 4px",fontWeight:700,fontSize:11,cursor:"pointer"}}>📄 PDF offre</button>
    <button onClick={()=>{setForm({...view,lignes:allProduitsLignes(view.lignes||[])});setModal("form");setViewId(null);}} style={{background:"#FEF9E7",border:"1.5px solid #F2C94C",borderRadius:10,padding:"11px 4px",fontWeight:600,fontSize:11,cursor:"pointer",color:"#92400E"}}>✏️ Modifier</button>
    <button onClick={()=>supprimerOffre(view.id)} style={{background:"#FEE2E2",border:"none",borderRadius:10,padding:"11px 4px",fontWeight:600,fontSize:11,cursor:"pointer",color:"#991B1B"}}>🗑 Suppr.</button>
  </div>
  <button onClick={()=>creerContactDepuisOffre(view)} style={{width:"100%",marginBottom:8,background:"#EFF6FF",border:"1.5px solid #BFDBFE",borderRadius:10,padding:"10px",fontWeight:600,fontSize:12,color:"#1E40AF",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
    👤 Créer un contact depuis cette offre
  </button>

  {/* Signature Jordan */}
  {sigJordanMode
    ? <div style={{marginBottom:10}}>
        <p style={{fontWeight:700,fontSize:12,marginBottom:6}}>✍️ Ma signature (Goûtstoso)</p>
        <SignaturePad
          onSave={sig=>{setSt(p=>({...p,offres:p.offres.map(o=>o.id===view.id?{...o,signJordan:sig}:o)}));setSigJordanMode(false);}}

          onCancel={()=>setSigJordanMode(false)}/>
      </div>
    : <button onClick={()=>setSigJordanMode(true)} style={{width:"100%",marginBottom:8,background:view.signJordan?"#DCFCE7":"#F9F9F6",border:view.signJordan?"1.5px solid #86EFAC":"1px solid #E5E7EB",borderRadius:10,padding:"10px",fontWeight:600,fontSize:12,color:view.signJordan?"#166534":"#374151",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
        {view.signJordan?"✅ Ma signature enregistrée (modifier)":"✍️ Apposer ma signature (Goûtstoso)"}
      </button>}

  <button onClick={async()=>{const enriched={...view,lignes:(view.lignes||[]).map(l=>{const prod=(st.produits||[]).find(p=>p.id===l.produitId);return {...l,designation:prod?`${prod.nom}${prod.format?" · "+prod.format:""}`:l.produitId,prixUnitaire:prod?.prixRevendeur||0};})};const token=await envoyerPourSignature("offre","Offre "+view.numero,enriched,view.clientEmail||"");if(token)setSt(p=>({...p,offres:p.offres.map(o=>o.id===view.id?{...o,signingToken:token}:o)}));}} style={{width:"100%",marginBottom:view.signingToken?4:10,background:"linear-gradient(135deg,#0a0a0a,#1a1a1a)",border:"none",borderRadius:10,padding:"11px",fontWeight:700,fontSize:12,color:"#F2C94C",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
    🔏 Envoyer pour signature
  </button>
  {view.signingToken&&<button onClick={async()=>{try{const r=await fetch(`${SIGN_API}/sign/${view.signingToken}`);const d=await r.json();if(d.status!=="signed"){alert("Pas encore signé. Relancez une fois que votre partenaire a cliqué le lien.");return;}setSt(p=>({...p,offres:p.offres.map(o=>o.id===view.id?{...o,signClient:d.signatureData,statut:"acceptée",signerNom:d.signerName,signingToken:null}:o)}));alert(`✅ ${d.signerName} a signé !\nLa signature est maintenant intégrée dans le PDF.`);}catch(e){alert("Erreur : "+e.message);}}} style={{width:"100%",marginBottom:4,background:"#DCFCE7",border:"1.5px solid #86EFAC",borderRadius:10,padding:"10px",fontWeight:700,fontSize:12,color:"#166534",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>🔄 Vérifier la signature</button>}
  {!view.signingToken&&!view.signClient&&(<div style={{display:"flex",gap:6,marginBottom:10,alignItems:"center"}}>
    <input value={recoveryToken} onChange={e=>setRecoveryToken(e.target.value)} placeholder="Token de signature existant…" style={{flex:1,padding:"8px 10px",borderRadius:8,border:"1px solid #E5E7EB",fontSize:11,outline:"none",color:"#374151"}}/>
    <button onClick={async()=>{const t=recoveryToken.trim();if(!t)return;try{const r=await fetch(`${SIGN_API}/sign/${t}`);const d=await r.json();if(d.status!=="signed"){alert("Ce token n'est pas encore signé.");return;}setSt(p=>({...p,offres:p.offres.map(o=>o.id===view.id?{...o,signClient:d.signatureData,statut:"acceptée",signerNom:d.signerName}:o)}));setRecoveryToken("");alert(`✅ Signature de ${d.signerName} intégrée dans le PDF !`);}catch(e){alert("Erreur : "+e.message);}}} style={{padding:"8px 10px",borderRadius:8,background:"#F9F9F6",border:"1px solid #E5E7EB",fontSize:11,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap",color:"#374151"}}>🔍 Récupérer</button>
  </div>)}

  {/* Statut */}
  <div style={{display:"flex",gap:6,marginBottom:14,flexWrap:"wrap"}}>
    {["prospection","intérêt","brouillon","envoyée","acceptée","refusée"].map(s=>(
      <button key={s} onClick={()=>setStatut(view.id,s)}
        style={{padding:"5px 10px",borderRadius:20,fontSize:10,fontWeight:700,cursor:"pointer",
          background:view.statut===s?"#111":"#F3F4F6",color:view.statut===s?"#F2C94C":"#6B7280",
          border:view.statut===s?"none":"1px solid #E5E7EB"}}>
        {statutConfig[s]?.label||s}
      </button>
    ))}
  </div>

  {/* Convertir en commande */}
  {(view.statut==="envoyée"||view.statut==="acceptée") && (
    <button onClick={()=>convertirEnCommande(view)}
      style={{width:"100%",background:"#0A0A0A",color:"#FAFAF7",border:"none",borderRadius:10,padding:"11px",fontWeight:600,fontSize:12,cursor:"pointer",marginBottom:14,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
      🔄 Convertir en commande
    </button>
  )}

  {/* Intro */}
  {view.introText && (
    <Card style={{padding:"12px 14px",marginBottom:12,borderLeft:"3px solid #F2C94C"}}>
      <p style={{fontSize:12,color:"#374151",fontStyle:"italic",lineHeight:1.6}}>{view.introText}</p>
    </Card>
  )}

  {/* Tableau produits */}
  <Card style={{padding:0,overflow:"hidden",marginBottom:12}}>
    <div style={{background:"#0A0A0A",padding:"10px 14px",display:"grid",gridTemplateColumns:"1fr auto auto auto",gap:8,alignItems:"center"}}>
      <p style={{fontSize:10,fontWeight:700,color:"#F2C94C",textTransform:"uppercase"}}>Produit</p>
      <p style={{fontSize:10,fontWeight:700,color:"#9CA3AF",width:50,textAlign:"center"}}>Prix public</p>
      <p style={{fontSize:10,fontWeight:700,color:"#F2C94C",width:60,textAlign:"center"}}>Prix part.</p>
      <p style={{fontSize:10,fontWeight:700,color:"#9CA3AF",width:30,textAlign:"center"}}>Qté</p>
    </div>
    {(view.lignes||[]).map((l,i)=>{
      const prod=(st.produits||[]).find(p=>p.id===l.produitId);
      if(!prod) return null;
      const total=(prod.prixRevendeur||0)*(l.qte||0);
      return (
        <div key={i} style={{padding:"10px 14px",display:"grid",gridTemplateColumns:"1fr auto auto auto",gap:8,alignItems:"center",borderBottom:"1px solid #F5F5F0",background:i%2===0?"#fff":"#FAFAF8"}}>
          <div>
            <p style={{fontWeight:600,fontSize:13}}>{prod.nom} {prod.variante}</p>
            <p style={{fontSize:10,color:"#9CA3AF"}}>{prod.format} · {prod.alcool||"30% vol."}</p>
          </div>
          <p style={{fontSize:11,color:"#9CA3AF",width:50,textAlign:"center",textDecoration:"line-through"}}>CHF {(prod.prixClient||0).toFixed(2)}</p>
          <p style={{fontSize:12,fontWeight:700,color:"#166534",width:60,textAlign:"center"}}>CHF {(prod.prixRevendeur||0).toFixed(2)}</p>
          <p style={{fontSize:13,fontWeight:700,width:30,textAlign:"center"}}>{l.qte}</p>
        </div>
      );
    })}
    <div style={{padding:"12px 14px",background:"#0A0A0A",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
      <p style={{fontSize:12,fontWeight:600,color:"#9CA3AF"}}>TOTAL PARTENAIRE</p>
      <p style={{fontSize:16,fontWeight:700,color:"#F2C94C",fontFamily:"'Cormorant Garamond',serif"}}>{chf(totalOffre(view))}</p>
    </div>
  </Card>

  {/* Économie */}
  {(()=>{
    const pub = (view.lignes||[]).reduce((s,l)=>{const p=(st.produits||[]).find(x=>x.id===l.produitId);return s+(p?.prixClient||0)*(l.qte||0);},0);
    const part = totalOffre(view);
    const eco = pub-part;
    if(eco<=0) return null;
    return (
      <Card style={{padding:"10px 14px",background:"#F0FDF4",border:"1px solid #86EFAC",marginBottom:12}}>
        <p style={{fontSize:12,color:"#166534",fontWeight:600}}>🎁 Économie partenaire : <strong>{chf(eco)}</strong> vs prix public ({chf(pub)})</p>
      </Card>
    );
  })()}

  {view.notes&&<Card style={{padding:"10px 14px",marginBottom:12}}><p style={{fontSize:12,color:"#6B7280",fontStyle:"italic"}}>Note : {view.notes}</p></Card>}
</div>
);

return (
<div className="fade">
<SectionTitle action={<Btn icon="plus" onClick={()=>{setForm(emptyForm());setModal("form");}}>+ Prospection</Btn>}>Pipeline Offres</SectionTitle>

{/* Stats pipeline */}
{(()=>{
  const prospections=offres.filter(o=>o.statut==="prospection").length;
  const interets=offres.filter(o=>o.statut==="intérêt").length;
  const envoyees=offres.filter(o=>o.statut==="envoyée").length;
  const acceptees=offres.filter(o=>o.statut==="acceptée").length;
  const caPotentiel=sum(offres.filter(o=>o.statut!=="refusée").map(o=>totalOffre(o)));
  return (
    <>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8,marginBottom:8}}>
      {[
        {l:"Prospections",v:prospections,bg:"#DBEAFE",txt:"#1E40AF"},
        {l:"Intérêt",v:interets,bg:"#EDE9FE",txt:"#6D28D9"},
        {l:"Offres env.",v:envoyees,bg:"#FEF9E7",txt:"#92400E"},
        {l:"Signées",v:acceptees,bg:"#F0FDF4",txt:"#166534"},
      ].map((k,i)=>(
        <div key={i} style={{background:k.bg,borderRadius:12,padding:"10px 6px",textAlign:"center",border:"1px solid #EAE7E0"}}>
          <p style={{fontSize:18,fontWeight:700,fontFamily:"'Cormorant Garamond',serif",color:k.txt}}>{k.v}</p>
          <p style={{fontSize:8,color:k.txt,opacity:.8,marginTop:2,fontWeight:600,textTransform:"uppercase"}}>{k.l}</p>
        </div>
      ))}
    </div>
    <div style={{background:"#0A0A0A",borderRadius:12,padding:"10px",textAlign:"center",marginBottom:18}}>
      <p style={{fontSize:14,fontWeight:700,color:"#F2C94C",fontFamily:"'Cormorant Garamond',serif"}}>{chf(caPotentiel)}</p>
      <p style={{fontSize:8,color:"#E8B64C",marginTop:2,fontWeight:600,textTransform:"uppercase"}}>CA potentiel total</p>
    </div>
    </>
  );
})()}

{/* Liste */}
{offres.length===0 ? (
  <div style={{textAlign:"center",padding:"50px 20px",color:"#9CA3AF"}}>
    <p style={{fontSize:40,marginBottom:12}}>📋</p>
    <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,fontWeight:600,color:"#374151"}}>Aucune offre</p>
    <p style={{fontSize:13,marginTop:6}}>Crée ta première offre commerciale partenaire.</p>
  </div>
) : (
  <div style={{display:"grid",gap:10}}>
    {offres.slice().reverse().map(o=>{
      const sc=statutConfig[o.statut]||statutConfig["brouillon"];
      const total=totalOffre(o);
      const expired=o.dateValidite&&o.dateValidite<today()&&o.statut==="envoyée";
      return (
        <Card key={o.id} style={{padding:"14px 16px",cursor:"pointer",border:expired?"1.5px solid #FCA5A5":"1px solid #F0F0EC"}} onClick={()=>setViewId(o.id)}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                <p style={{fontWeight:700,fontSize:14}}>{o.numero}</p>
                <span style={{background:sc.bg,color:sc.color,borderRadius:20,padding:"2px 9px",fontSize:10,fontWeight:700}}>{sc.label}</span>
                {expired && <span style={{background:"#FEE2E2",color:"#991B1B",borderRadius:20,padding:"2px 8px",fontSize:10,fontWeight:700}}>⚠ EXPIRÉE</span>}
              </div>
              <p style={{fontSize:12,color:"#6B7280",marginTop:2}}>{o.clientNom}</p>
              <p style={{fontSize:10,color:"#9CA3AF",marginTop:1}}>Émise {fmt(o.date)} · Valable jusqu'au {fmt(o.dateValidite||o.date)}</p>
            </div>
            <div style={{textAlign:"right",flexShrink:0}}>
              <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:18,fontWeight:700,color:"#0A0A0A"}}>{chf(total)}</p>
              <p style={{fontSize:10,color:"#9CA3AF"}}>{(o.lignes||[]).length} produit(s)</p>
            </div>
          </div>
          <button onClick={e=>{e.stopPropagation();genererOffrePDF(o,st);}}

            style={{background:"#111",color:"#F2C94C",border:"none",borderRadius:8,padding:"6px 14px",fontSize:11,fontWeight:700,cursor:"pointer",marginTop:4}}>
            📄 PDF
          </button>
        </Card>
      );
    })}
  </div>
)}

{/* Modal création/édition */}
{modal==="form"&&form&&(
  <Modal title={form.id?"Modifier l'offre":"Nouvelle offre commerciale"} onClose={()=>setModal(null)}>
    <div style={{display:"grid",gap:14}}>

      {/* Numéro & dates */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
        <F label="N° offre" value={form.numero} onChange={v=>setForm(p=>({...p,numero:v}))}/>
        <F label="Date" type="date" value={form.date} onChange={v=>setForm(p=>({...p,date:v}))}/>
        <F label="Valable jusqu'au" type="date" value={form.dateValidite} onChange={v=>setForm(p=>({...p,dateValidite:v}))}/>
      </div>

      {/* Destinataire */}
      <div style={{background:"#F9F9F6",borderRadius:10,padding:"12px",border:"1px solid #EAE7E0"}}>
        <p style={{fontSize:11,fontWeight:700,color:"#374151",marginBottom:10,textTransform:"uppercase",letterSpacing:".04em"}}>Destinataire</p>

        {/* Sélecteur client existant */}
        <div style={{marginBottom:12}}>
          <label style={{fontSize:11,fontWeight:600,color:"#6B7280",textTransform:"uppercase",letterSpacing:".06em",display:"block",marginBottom:5}}>Choisir un client existant</label>
          <select value={form.partenaireId||""} onChange={e=>{
            const v=e.target.value;
            if(!v){setForm(p=>({...p,partenaireId:"",clientNom:"",clientContact:"",clientAdresse:"",clientNpa:"",clientVille:"",clientEmail:"",clientTel:"",clientSite:"",clientLogo:""}));return;}
            // Chercher d'abord dans les dépôts-vente, puis dans les clients
            const pv=(st.partenaires||[]).find(p=>p.id===v);
            const cl=(st.clients||[]).find(c=>c.id===v);
            if(pv){
              setForm(p=>({...p,partenaireId:v,clientNom:pv.nom,clientContact:pv.contact||"",clientAdresse:pv.adresse||"",clientNpa:pv.npa||"",clientVille:pv.ville||"",clientEmail:pv.email||"",clientTel:pv.tel||"",clientSite:pv.site||"",clientLogo:pv.logo||""}));
            } else if(cl){
              setForm(p=>({...p,partenaireId:v,clientNom:cl.nom,clientContact:"",clientAdresse:cl.adresse||"",clientNpa:cl.npa||"",clientVille:cl.ville||"",clientEmail:cl.email||"",clientTel:cl.telephone||"",clientSite:"",clientLogo:""}));
            }
          }} style={{width:"100%",padding:"10px 12px",fontSize:13,borderRadius:10,border:"1.5px solid #D1D5DB",background:"#fff",fontFamily:"inherit",color:"#111",boxSizing:"border-box" as any}}>
            <option value="">— Nouveau / saisie manuelle —</option>
            {(()=>{
              const depots=(st.partenaires||[]);
              const clientsTab=(st.clients||[]).slice().sort((a,b)=>a.nom.localeCompare(b.nom));
              const clientsCat=clientsTab.filter(c=>(c.categorie||"client")==="client");
              const partenairesCat=clientsTab.filter(c=>c.categorie==="partenaire");
              return (<>
                {depots.length>0&&<optgroup label="🏪 Dépôts-vente">
                  {depots.map(p=><option key={p.id} value={p.id}>{p.nom}{p.ville?" · "+p.ville:""}{p.contact?" ("+p.contact+")":""}</option>)}
                </optgroup>}
                {clientsCat.length>0&&<optgroup label="👤 Clients">
                  {clientsCat.map(c=><option key={c.id} value={c.id}>{c.nom}{c.ville?" · "+c.ville:""}{c.email?" · "+c.email:""}</option>)}
                </optgroup>}
                {partenairesCat.length>0&&<optgroup label="🤝 Partenaires (clients)">
                  {partenairesCat.map(c=><option key={c.id} value={c.id}>{c.nom}{c.ville?" · "+c.ville:""}{c.email?" · "+c.email:""}</option>)}
                </optgroup>}
              </>);
            })()}
          </select>
        </div>

        {/* Carte client sélectionné */}
        {form.partenaireId && (()=>{
          const pv=(st.partenaires||[]).find(p=>p.id===form.partenaireId);
          const cl=(st.clients||[]).find(c=>c.id===form.partenaireId);
          const entry=pv||cl;
          return entry?(
            <div style={{background:"#fff",borderRadius:10,padding:"10px 12px",border:"1.5px solid #F2C94C",marginBottom:12,display:"flex",alignItems:"center",gap:10}}>
              {(entry as any).logo&&<img src={(entry as any).logo} alt="" style={{height:40,maxWidth:64,objectFit:"contain",borderRadius:6,border:"1px solid #EAE7E0",background:"#fff",padding:3}}/>}
              <div style={{flex:1,minWidth:0}}>
                <p style={{fontSize:13,fontWeight:700,color:"#111",marginBottom:2}}>{entry.nom}</p>
                {((entry as any).contact||(entry as any).npa||entry.ville)&&<p style={{fontSize:11,color:"#6B7280"}}>{[(entry as any).contact,[((entry as any).npa||""),(entry.ville||"")].filter(Boolean).join(" ")].filter(Boolean).join(" · ")}</p>}
                {(entry.email||(entry as any).tel||(entry as any).telephone)&&<p style={{fontSize:11,color:"#6B7280"}}>{[entry.email,(entry as any).tel||(entry as any).telephone].filter(Boolean).join(" · ")}</p>}
              </div>
              <button onClick={()=>setForm(p=>({...p,partenaireId:"",clientNom:"",clientContact:"",clientAdresse:"",clientNpa:"",clientVille:"",clientEmail:"",clientTel:"",clientSite:"",clientLogo:""}))}
                style={{background:"#F3F4F6",border:"none",borderRadius:8,padding:"5px 10px",fontSize:12,cursor:"pointer",color:"#374151",flexShrink:0}}>✕</button>
            </div>
          ):null;
        })()}

        {/* Champs manuels (toujours visibles pour ajustement) */}
        <details open={!form.partenaireId} style={{marginBottom:8}}>
          <summary style={{fontSize:11,fontWeight:600,color:"#6B7280",cursor:"pointer",userSelect:"none",marginBottom:8,listStyle:"none",display:"flex",alignItems:"center",gap:5}}>
            <span style={{fontSize:10}}>▸</span>{form.partenaireId?"Modifier les coordonnées manuellement":"Saisir manuellement"}
          </summary>
          <div style={{display:"grid",gap:8,marginTop:8}}>
            <F label="Nom / Entreprise *" value={form.clientNom} onChange={v=>setForm(p=>({...p,clientNom:v}))} placeholder="Ex: Cave Paratte Vins"/>
            <F label="Personne de contact" value={form.clientContact||""} onChange={v=>setForm(p=>({...p,clientContact:v}))} placeholder="Ex: Marie Dupont"/>
            <F label="Adresse (rue)" value={form.clientAdresse||""} onChange={v=>setForm(p=>({...p,clientAdresse:v}))}/>
            <div style={{display:"grid",gridTemplateColumns:"1fr 2fr",gap:8}}>
              <F label="NPA" value={form.clientNpa||""} onChange={v=>setForm(p=>({...p,clientNpa:v}))} placeholder="2610"/>
              <F label="Ville" value={form.clientVille||""} onChange={v=>setForm(p=>({...p,clientVille:v}))} placeholder="Saint-Imier"/>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              <F label="Email" value={form.clientEmail||""} onChange={v=>setForm(p=>({...p,clientEmail:v}))}/>
              <F label="Téléphone" value={form.clientTel||""} onChange={v=>setForm(p=>({...p,clientTel:v}))}/>
            </div>
            <F label="Site web" value={form.clientSite||""} onChange={v=>setForm(p=>({...p,clientSite:v}))} placeholder="www.exemple.ch"/>
          </div>
        </details>

        {/* Logo partenaire */}
        <div style={{marginTop:4}}>
          <p style={{fontSize:11,fontWeight:600,color:"#374151",marginBottom:6}}>Logo du partenaire (optionnel)</p>
          <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
            {form.clientLogo&&<img src={form.clientLogo} alt="logo" style={{height:44,maxWidth:90,objectFit:"contain",borderRadius:8,border:"1px solid #EAE7E0",background:"#fff",padding:4}}/>}
            <label style={{background:"#F5F5F0",border:"1.5px dashed #D1D5DB",borderRadius:10,padding:"7px 12px",fontSize:11,fontWeight:600,cursor:"pointer",color:"#374151"}}>
              {form.clientLogo?"🔄 Remplacer":"📷 Charger un logo"}
              <input type="file" accept="image/*" style={{display:"none"}} onChange={e=>{
                const file=e.target.files?.[0]; if(!file) return;
                if(file.size>500000){alert("Image trop lourde (max 500 Ko)");return;}
                const r=new FileReader(); r.onload=ev=>setForm(p=>({...p,clientLogo:ev.target?.result as string})); r.readAsDataURL(file);
              }}/>
            </label>
            {form.clientLogo&&<button onClick={()=>setForm(p=>({...p,clientLogo:""}))} style={{background:"#FEE2E2",border:"none",borderRadius:8,padding:"5px 10px",fontSize:11,color:"#991B1B",cursor:"pointer"}}>✕</button>}
          </div>
        </div>
      </div>

      {/* Intro */}
      <div>
        <p style={{fontSize:11,fontWeight:600,color:"#374151",marginBottom:6}}>Texte d'introduction</p>
        <textarea value={form.introText||""} onChange={e=>setForm(p=>({...p,introText:e.target.value}))}
          style={{width:"100%",minHeight:70,padding:"8px 10px",fontSize:12,border:"1.5px solid #D1D5DB",borderRadius:10,resize:"vertical",fontFamily:"inherit",boxSizing:"border-box"}}/>
      </div>

      {/* Produits */}
      <div>
        <p style={{fontSize:11,fontWeight:700,color:"#374151",marginBottom:8,textTransform:"uppercase",letterSpacing:".04em"}}>Produits & quantités</p>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {(form.lignes||[]).map((l,i)=>{
          const prod=(st.produits||[]).find(p=>p.id===l.produitId);
          if(!prod) return null;
          const qte = l.qte||0;
          return (
            <div key={i} style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,background:qte}}>0?"#F0FDF4":"#fff",border:"1.5px solid "+(qte>0?"#86EFAC":"#EAE7E0"),borderRadius:10,padding:"10px 12px"}}>
              <div style={{flex:1,minWidth:0}}>
                <p style={{fontWeight:600,fontSize:13,color:"#111"}}>{prod.nom} {prod.variante}</p>
                <p style={{fontSize:10,color:"#9CA3AF"}}>{prod.format} · <span style={{color:"#166534",fontWeight:700}}>CHF {prod.prixRevendeur}</span><span style={{color:"#9CA3AF",textDecoration:"line-through",marginLeft:4}}>CHF {prod.prixClient}</span></p>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:0,flexShrink:0}}>
                <button type="button" onClick={()=>updLigne(i,Math.max(0,qte-1))}
                  style={{width:36,height:36,borderRadius:"8px 0 0 8px",border:"1.5px solid #D1D5DB",borderRight:"none",background:"#F5F5F0",fontSize:20,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:"#374151"}}>−</button>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={qte===0?"0":String(qte)}
                  onFocus={e=>e.target.select()}
                  onChange={e=>updLigne(i,e.target.value)}
                  style={{width:44,height:36,textAlign:"center",border:"1.5px solid #D1D5DB",borderLeft:"none",borderRight:"none",fontSize:16,fontWeight:700,color:"#111",background:qte>0?"#DCFCE7":"#fff",outline:"none"}}/>
                <button type="button" onClick={()=>updLigne(i,qte+1)}
                  style={{width:36,height:36,borderRadius:"0 8px 8px 0",border:"1.5px solid #D1D5DB",borderLeft:"none",background:"#0A0A0A",fontSize:20,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:"#F2C94C"}}>+</button>
              </div>
            </div>
          );
        })}
        </div>
        {(()=>{
          const total=sum((form.lignes||[]).map(l=>{const p=(st.produits||[]).find(x=>x.id===l.produitId);return (p?.prixRevendeur||0)*(l.qte||0);}));
          if(!total) return null;
          return (
            <div style={{background:"#0A0A0A",borderRadius:"0 0 10px 10px",padding:"10px 12px",display:"flex",justifyContent:"space-between"}}>
              <p style={{fontSize:12,color:"#9CA3AF",fontWeight:600}}>TOTAL PARTENAIRE</p>
              <p style={{fontSize:14,fontWeight:700,color:"#F2C94C"}}>{chf(total)}</p>
            </div>
          );
        })()}
      </div>

      {/* Notes */}
      <F label="Notes / remarques" value={form.notes||""} onChange={v=>setForm(p=>({...p,notes:v}))} placeholder="Conditions particulières, délai de livraison..."/>

      {/* Statut */}
      <Sel label="Statut" value={form.statut} onChange={v=>setForm(p=>({...p,statut:v}))}
        options={[{v:"prospection",l:"🔍 Prospection"},{v:"intérêt",l:"✅ Intérêt confirmé"},{v:"brouillon",l:"📝 Offre rédigée"},{v:"envoyée",l:"✉️ Offre envoyée"},{v:"acceptée",l:"✍️ Signée"},{v:"refusée",l:"❌ Refusée"}]}/>

      <Btn onClick={saveOffre} full icon="check">Enregistrer l'offre</Btn>
    </div>
  </Modal>
)}
</div>
);
};

