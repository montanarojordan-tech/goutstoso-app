import { useState, useCallback, useRef, useEffect } from "react";
import * as React from "react";
import { uid, chf, fmt, today, sum, genLot, exportCSV } from "../utils";
import { SOCIETE, CGV, INIT } from "../constants";
import { LOGO_B64, pdfLogo, IMG_LIMONTA_50CL, IMG_CLEMENTINO_50CL, IMG_LIMELO_50CL, IMG_LIMONTA_25CL, IMG_LIMELO_25CL, IMG_CLEMENTINO_25CL, IMG_COFFRET } from "../images";
import { Ic, Badge, Modal, F, Sel, Btn, Card, SectionTitle, getProchainRappelFn } from "../ui";
import { getImg, COULEURS, calcTotal, calcTotalNet } from "../helpers";
import { SignaturePad } from "../SignaturePad";

// ══════════════════════════════════════════════════════════════
// PAGE: FACTURES
// ══════════════════════════════════════════════════════════════

// Demande permission notification au démarrage
const demanderNotifications = async () => {
try {
if(typeof Notification !== "undefined" && Notification.permission === "default") {
await Notification.requestPermission();
}
} catch(e) {
// Silent fail - notification API not available (ex: Replit preview, some browsers)
console.log("Notifications non disponibles");
}
};

const envoyerNotifRappel = (facture, pv) => {
try {
if(typeof Notification !== "undefined" && Notification.permission === "granted") {
new Notification("⚠️ Facture en retard - GoûtStoso", {
body: facture.numero+" · "+(pv?.nom||"Client")+" · CHF "+parseFloat(facture.total||0).toFixed(2)+" - 30 jours de retard",
});
}
} catch(e) {}
};


export const Factures = ({st,setSt}) => {
const [modal,setModal] = useState(null);
const [view,setView] = useState(null);
const [filtre,setFiltre] = useState("toutes");
const [sigMode,setSigMode] = useState(false);
const [pjModal,setPjModal] = useState(false);
const [recoveryTokenF, setRecoveryTokenF] = useState("");

const emptyF = {partenaireId:st.partenaires[0]?.id||"",typeClient:"revendeur",lignes:[{produitId:"",qte:1}],lignesOffertes:[],comptOffert:"3900",notes:"",date:today(),envoyee:false};
const [form,setForm] = useState(emptyF);
const [modalRegroup,setModalRegroup] = useState(false);
const [selectedForRegroup,setSelectedForRegroup] = useState([]);

// Fonction pour regrouper plusieurs factures en une seule
const regrouperFactures = () => {
if(selectedForRegroup.length < 2) {
alert("Sélectionne au moins 2 factures à regrouper");
return;
}

const factures = selectedForRegroup.map(id=>(st.factures||[]).find(f=>f.id===id)).filter(Boolean);

// Vérifier que toutes sont du même partenaire
const partenaireId = factures[0].partenaireId;
if(!factures.every(f=>f.partenaireId===partenaireId)) {
  alert("Toutes les factures doivent être du même partenaire !");
  return;
}

// Vérifier qu'elles sont toutes en attente
if(!factures.every(f=>f.statut==="en attente")) {
  alert("Seules les factures en attente peuvent être regroupées");
  return;
}

const pv = st.partenaires.find(p=>p.id===partenaireId);
if(!window.confirm("Regrouper "+factures.length+" factures de "+(pv?.nom||"")+" en une seule ?\n\nLes factures originales seront supprimées.")) return;

// Fusionner les lignes : si même produit, additionner les quantités
const lignesFusionnees = {};
factures.forEach(f=>{
  (f.lignes||[]).filter(l=>l.produitId).forEach(l=>{
    if(lignesFusionnees[l.produitId]) {
      lignesFusionnees[l.produitId].qte += l.qte;
    } else {
      lignesFusionnees[l.produitId] = {produitId:l.produitId, qte:l.qte};
    }
  });
});
const lignes = Object.values(lignesFusionnees);

// Numéro de la nouvelle facture
const y = new Date().getFullYear();
const existing = (st.factures||[]).map(f=>f.numero);
let n = 1;
while(existing.includes("FAC-"+y+"-"+String(n).padStart(3,"0"))) n++;
const numero = "FAC-"+y+"-"+String(n).padStart(3,"0");

// Créer note récap
const noteRecap = "Facture mensuelle regroupant : "+factures.map(f=>f.numero).join(", ");

const nouvelleFacture = {
  id: uid(),
  numero,
  date: today(),
  partenaireId,
  typeClient: factures[0].typeClient || "revendeur",
  lignes,
  statut: "en attente",
  datePaiement: "",
  notes: noteRecap,
};

// Supprimer anciennes + ajouter nouvelle
setSt(p=>({
  ...p,
  factures: [...(p.factures||[]).filter(f=>!selectedForRegroup.includes(f.id)), nouvelleFacture],
}));

setSelectedForRegroup([]);
setModalRegroup(false);
alert("✅ Facture "+numero+" créée !\n\n"+factures.length+" factures regroupées.");

};

// Vérifier rappels au chargement
React.useEffect(()=>{
demanderNotifications();
const verifierRappels = () => {
(st.factures||[]).filter(f=>f.statut!=="payée").forEach(f=>{
const echeance = new Date(new Date(f.date).getTime()+30*86400000);
const retard = Math.floor((new Date()-echeance)/86400000);
const pv = st.partenaires.find(p=>p.id===f.partenaireId);
if(retard===30 || retard===60) {
envoyerNotifRappel(f, pv);
}
});
};
verifierRappels();
},[]);

const genNumero = () => {
const count = (st.factures||[]).length+1;
return "FAC-"+new Date().getFullYear()+"-"+String(count).padStart(3,"0");
};

const save = () => {
const lignesOk = form.lignes.filter(l=>l.produitId&&l.qte>0);
if(!form.partenaireId||!lignesOk.length) return;
const lignesOffertes = (form.lignesOffertes||[]).filter(l=>l.produitId&&l.qte>0);
const totalBrut = calcTotal(lignesOk, form.typeClient, st.produits);
const totalRabais = calcTotal(lignesOffertes, form.typeClient, st.produits);
const total = totalBrut - totalRabais;
if(form.id) {
setSt(p=>({...p,factures:p.factures.map(f=>f.id===form.id?{...form,lignes:lignesOk,lignesOffertes,total,totalRabais,comptOffert:form.comptOffert||"3900"}:f)}));
} else {
const numero = genNumero();
setSt(p=>({...p,factures:[...(p.factures||[]),{...form,id:uid(),numero,statut:"en attente",lignes:lignesOk,lignesOffertes,total,totalRabais,comptOffert:form.comptOffert||"3900",datePaiement:""}]}));
}
setModal(null);
};

const marquerPayee = (id) => setSt(p => {
  const facture = (p.factures||[]).find(f=>f.id===id);
  const rappels = facture?.rappels||[];
  const dernierRappel = rappels[rappels.length-1];
  const frais = dernierRappel ? (dernierRappel.degree>=3?25:dernierRappel.degree>=2?15:0) : 0;
  const pv = (p.partenaires||[]).find(par=>par.id===facture?.partenaireId);
  const newTransactions = frais>0 ? [
    ...p.transactions,
    {
      id: "rappel-"+id+"-"+Date.now(),
      date: today(),
      compte: "3750",
      libelle: "Frais de rappel",
      type: "recette",
      categorie: "Frais de rappel",
      montant: frais,
      description: "Frais rappel "+dernierRappel.degree+" — "+((facture?.numero)||"")+" ("+((pv?.nom)||"")+")",
      postfinance: true,
    }
  ] : p.transactions;
  return {
    ...p,
    factures: p.factures.map(f=>f.id===id?{...f,statut:"payée",datePaiement:today()}:f),
    transactions: newTransactions,
  };
});
const del = id => setSt(p=>({...p,factures:p.factures.filter(f=>f.id!==id)}));

const addLigne = () => setForm(p=>({...p,lignes:[...p.lignes,{produitId:"",qte:1}]}));
const updLigne = (i,k,v) => setForm(p=>({...p,lignes:p.lignes.map((l,j)=>j===i?{...l,[k]:v}:l)}));
const addLigneOfferte = () => setForm(p=>({...p,lignesOffertes:[...(p.lignesOffertes||[]),{produitId:"",qte:1,texte:"Offert avec votre commande"}]}));
const updLigneOfferte = (i,k,v) => setForm(p=>({...p,lignesOffertes:(p.lignesOffertes||[]).map((l,j)=>j===i?{...l,[k]:v}:l)}));
const delLigneOfferte = (i) => setForm(p=>({...p,lignesOffertes:(p.lignesOffertes||[]).filter((_,j)=>j!==i)}));

const getInfosRetard = (f) => {
if(f.statut==="payée") return null;
const echeance = new Date(new Date(f.date).getTime()+30*86400000);
const jours = Math.floor((new Date()-echeance)/86400000);
if(jours < 0) return null;
const rappels = f.rappels||[];
const dernierRappel = rappels[rappels.length-1];
const frais = dernierRappel ? (dernierRappel.degree>=3?25:dernierRappel.degree>=2?15:0) : 0;
const niveau = jours>=60?"critique":jours>=30?"rappel2":"rappel1";
return {jours, frais, niveau};
};
const getProchainRappel = (f) => getProchainRappelFn(f);

const envoyerEmail = (f, rappelDegree=null) => {
const pv = st.partenaires.find(p=>p.id===f.partenaireId);
if(!pv?.email) { alert("Aucun email pour ce partenaire"); return; }
const retard = getInfosRetard(f);
const pr = getProchainRappel(f);
const deg = rappelDegree || (pr?.degree||null);
const lignesTxt = (f.lignes||[]).filter(l=>l.produitId).map(l=>{
const p = st.produits.find(x=>x.id===l.produitId);
const pu = p?(f.typeClient==="revendeur"?p.prixRevendeur:p.prixClient):0;
return "- "+(p?.nom||"")+" "+(p?.variante||"")+" "+(p?.format||"")+" x"+l.qte+" = CHF "+(pu*l.qte).toFixed(2);
}).join("\n");
const total = calcTotalNet(f,st.produits);
const fraisDeg = deg===1?0:deg===2?15:deg===3?25:0;
const totalFinal = total+fraisDeg;
const echeance = new Date(new Date(f.date).getTime()+30*86400000).toISOString().slice(0,10);

const subject = deg
  ? "Rappel "+deg+" — Facture "+f.numero+" - Goutstoso"
  : "Facture "+f.numero+" - Goutstoso";

const contact = pv?.contact || pv?.nom || "";
const iban = "IBAN : CH23 0900 0000 1565 1485 8\nBanque : PostFinance\nTitulaire : Goûtstoso / Jordan Montanaro\nMontant : CHF ";
let bodyTxt = "";
if(deg===1) {
  bodyTxt =
    "Bonjour "+contact+",\n\n"+
    "Sauf erreur de notre part, notre facture N° "+f.numero+" du "+fmt(f.date)+" d'un montant de CHF "+total.toFixed(2)+" demeure impayée à ce jour.\n\n"+
    "Nous vous adressons ce premier rappel à titre gracieux, sans frais supplémentaires, et vous prions de bien vouloir procéder au règlement dans un délai de 10 jours à compter de la présente.\n\n"+
    "Passé ce délai, un deuxième rappel vous sera adressé, majoré de frais administratifs de CHF 15.00.\n\n"+
    "Coordonnées de paiement :\n"+iban+total.toFixed(2)+"\n\n"+
    "Si ce paiement a déjà été effectué, nous vous remercions de ne pas tenir compte de ce message.\n\n"+
    "Cordialement,\n\nJordan Montanaro\nGoûtstoso\nadmin@goutstoso.ch · www.goutstoso.ch";
} else if(deg===2) {
  bodyTxt =
    "Bonjour "+contact+",\n\n"+
    "Malgré notre premier rappel resté sans réponse, la facture N° "+f.numero+" du "+fmt(f.date)+" demeure toujours impayée.\n\n"+
    "Nous vous adressons ce deuxième rappel et vous demandons de procéder au règlement dans un délai de 10 jours, incluant les frais de rappel :\n\n"+
    "  Montant de la facture   CHF "+total.toFixed(2)+"\n"+
    "  Frais de rappel         CHF 15.00\n"+
    "  TOTAL DÛ                CHF "+totalFinal.toFixed(2)+"\n\n"+
    "Coordonnées de paiement :\n"+iban+totalFinal.toFixed(2)+"\n\n"+
    "Sans règlement dans ce délai, un troisième et dernier rappel vous sera adressé avec des frais de CHF 25.00, avant toute procédure de recouvrement.\n\n"+
    "Cordialement,\n\nJordan Montanaro\nGoûtstoso\nadmin@goutstoso.ch · www.goutstoso.ch";
} else if(deg===3) {
  bodyTxt =
    "Bonjour "+contact+",\n\n"+
    "En dépit de nos deux précédents rappels demeurés sans effet, la facture N° "+f.numero+" du "+fmt(f.date)+" reste impayée.\n\n"+
    "Ce troisième et dernier rappel exige le règlement immédiat du montant suivant :\n\n"+
    "  Montant de la facture   CHF "+total.toFixed(2)+"\n"+
    "  Frais de rappel         CHF 25.00\n"+
    "  TOTAL DÛ                CHF "+totalFinal.toFixed(2)+"\n\n"+
    "Coordonnées de paiement :\n"+iban+totalFinal.toFixed(2)+"\n\n"+
    "À défaut de paiement sous 10 jours, nous nous verrons dans l'obligation d'engager une procédure de recouvrement. L'ensemble des frais en découlant seront entièrement à votre charge.\n\n"+
    "Cordialement,\n\nJordan Montanaro\nGoûtstoso\nadmin@goutstoso.ch · www.goutstoso.ch";
} else {
  bodyTxt =
    "Bonjour "+contact+",\n\n"+
    "Veuillez trouver ci-joint notre facture N° "+f.numero+" du "+fmt(f.date)+".\n\n"+
    "Détail de la commande :\n"+lignesTxt+"\n\n"+
    "  TOTAL TTC               CHF "+total.toFixed(2)+"\n"+
    "  Conditions de paiement  30 jours nets\n\n"+
    "Coordonnées de paiement :\n"+iban+total.toFixed(2)+"\n\n"+
    "Pour toute question relative à cette facture, n'hésitez pas à nous contacter à admin@goutstoso.ch.\n\n"+
    "Nous vous remercions de votre confiance.\n\n"+
    "Cordialement,\n\nJordan Montanaro\nGoûtstoso\nadmin@goutstoso.ch · www.goutstoso.ch";
}

setSt(p=>({...p,factures:(p.factures||[]).map(x=>x.id===f.id?{...x,envoyee:true}:x)}));
sendEmail({to:pv.email||"",toName:pv?.contact||pv?.nom||"",subject,body:bodyTxt.replace(/\n/g,"<br>")});
};

const genererPDF = async (f) => {
try {
await new Promise((res,rej)=>{
if(window.jspdf){res();return;}
const s=document.createElement("script");
s.src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
s.onload=res;s.onerror=rej;document.head.appendChild(s);
});
const {jsPDF}=window.jspdf;
const doc=new jsPDF("p","mm","a4");
const W=210,mg=18;
const pv=st.partenaires.find(p=>p.id===f.partenaireId)||(st.clients||[]).find(c=>c.id===f.partenaireId);
const totalBrutPDF=calcTotal(f.lignes,f.typeClient,st.produits);
const totalRabaisPDF=calcTotal((f.lignesOffertes||[]).filter(l=>l.produitId&&l.qte>0),f.typeClient,st.produits);
const total=totalBrutPDF-totalRabaisPDF;
const retard=getInfosRetard(f);
const totalFinal=total+(retard?.frais||0);
const echeance=new Date(new Date(f.date).getTime()+30*86400000).toISOString().slice(0,10);

  // Bande jaune top
  doc.setFillColor(242,201,76);doc.rect(0,0,W,6,"F");

  // Header
  pdfLogo(doc,mg);
  doc.setFontSize(26);doc.setFont("helvetica","bold");doc.setTextColor(17,17,17);
  doc.text(retard?"RAPPEL":"FACTURE",W-mg,20,{align:"right"});
  doc.setFontSize(10);doc.setTextColor(212,160,23);
  doc.text(f.numero,W-mg,27,{align:"right"});
  doc.setFontSize(8);doc.setTextColor(120,120,120);doc.setFont("helvetica","normal");
  doc.text("Date : "+fmt(f.date),W-mg,33,{align:"right"});
  doc.text("Échéance : "+fmt(echeance),W-mg,38,{align:"right"});

  // Alerte retard
  if(retard) {
    doc.setFillColor(254,226,226);doc.setDrawColor(252,165,165);
    doc.roundedRect(mg,44,W-mg*2,10,2,2,"FD");
    doc.setFontSize(8);doc.setFont("helvetica","bold");doc.setTextColor(153,27,27);
    doc.text("⚠ PAIEMENT EN RETARD : "+retard.jours+" jours"+(retard.frais>0?" - Frais de rappel : CHF "+retard.frais.toFixed(2):""),W/2,51,{align:"center"});
  }

  // Sépar
  const yBase=retard?60:50;
  doc.setDrawColor(230,230,228);doc.setLineWidth(0.3);doc.line(mg,yBase,W-mg,yBase);

  // Parties
  let y=yBase+8;
  doc.setFontSize(7);doc.setFont("helvetica","bold");doc.setTextColor(156,163,175);
  doc.text("FOURNISSEUR",mg,y);doc.text("CLIENT",W/2+2,y);
  doc.setDrawColor(242,201,76);doc.setLineWidth(0.5);
  doc.line(mg,y+1,mg+20,y+1);doc.line(W/2+2,y+1,W/2+18,y+1);
  y+=6;
  doc.setFontSize(10);doc.setFont("helvetica","bold");doc.setTextColor(17,17,17);
  doc.text("Goûtstoso",mg,y);doc.text(pv?.nom||"",W/2+2,y);
  doc.setFontSize(8.5);doc.setFont("helvetica","normal");doc.setTextColor(107,114,128);
  ["Jordan Montanaro","Rue des Sources 19","2613 Villeret","admin@goutstoso.ch"].forEach((l,i)=>doc.text(l,mg,y+5+i*4.5));
  {const pvAddrLines=(pv?.npa||pv?.ville)?[pv?.adresse||"",[pv?.npa,pv?.ville].filter(Boolean).join(" ")].filter(Boolean):(pv?.adresse||"").split(", ").filter(Boolean);pvAddrLines.forEach((l,i)=>doc.text(l,W/2+2,y+5+i*4.5));}

  // Tableau
  y+=30;
  doc.setFillColor(17,17,17);doc.rect(mg,y,W-mg*2,8,"F");
  doc.setFontSize(7.5);doc.setFont("helvetica","bold");doc.setTextColor(242,201,76);
  doc.text("DÉSIGNATION",mg+3,y+5.5);
  doc.setTextColor(180,180,180);
  doc.text("QTÉ",130,y+5.5,{align:"center"});
  doc.text("PRIX U.",155,y+5.5,{align:"right"});
  doc.text("TOTAL CHF",W-mg-2,y+5.5,{align:"right"});
  y+=8;

  f.lignes.filter(l=>l.produitId).forEach((l,i)=>{
    const p2=st.produits.find(x=>x.id===l.produitId);
    const pu=p2?(f.typeClient==="revendeur"?p2.prixRevendeur:p2.prixClient):0;
    doc.setFillColor(i%2===0?250:255,i%2===0?250:255,i%2===0?248:255);
    doc.rect(mg,y,W-mg*2,11,"F");
    doc.setDrawColor(240,240,238);doc.setLineWidth(0.2);doc.rect(mg,y,W-mg*2,11,"S");
    doc.setFontSize(9);doc.setFont("helvetica","bold");doc.setTextColor(17,17,17);
    doc.text((p2?.nom||"")+" "+(p2?.variante||""),mg+3,y+5);
    doc.setFontSize(7.5);doc.setFont("helvetica","normal");doc.setTextColor(150,150,150);
    doc.text((p2?.format||"")+" · 30% vol.",mg+3,y+9);
    doc.setFontSize(9);doc.setTextColor(107,114,128);
    doc.text(String(l.qte),130,y+6,{align:"center"});
    doc.text("CHF "+pu.toFixed(2),155,y+6,{align:"right"});
    doc.setFont("helvetica","bold");doc.setTextColor(17,17,17);
    doc.text("CHF "+(pu*l.qte).toFixed(2),W-mg-2,y+6,{align:"right"});
    y+=11;
  });

  // Rabais — bouteilles offertes
  const offerts=(f.lignesOffertes||[]).filter(l=>l.produitId);
  if(offerts.length>0){
    y+=2;
    doc.setFillColor(254,242,242);doc.setDrawColor(252,165,165);doc.setLineWidth(0.3);
    doc.rect(mg,y,W-mg*2,7,"FD");
    doc.setFontSize(7);doc.setFont("helvetica","bold");doc.setTextColor(185,28,28);
    doc.text("RABAIS — BOUTEILLES OFFERTES",mg+3,y+4.5);
    y+=7;
    offerts.forEach((l,i)=>{
      const p2=st.produits.find(x=>x.id===l.produitId);
      const pu=p2?(f.typeClient==="revendeur"?p2.prixRevendeur:p2.prixClient):0;
      const rabais=pu*(l.qte||0);
      doc.setFillColor(i%2===0?255:252,i%2===0?245:248,i%2===0?245:248);
      doc.rect(mg,y,W-mg*2,11,"F");
      doc.setDrawColor(254,202,202);doc.setLineWidth(0.2);doc.rect(mg,y,W-mg*2,11,"S");
      doc.setFontSize(9);doc.setFont("helvetica","bold");doc.setTextColor(17,17,17);
      doc.text((p2?.nom||"")+" "+(p2?.variante||""),mg+3,y+5);
      doc.setFontSize(7.5);doc.setFont("helvetica","normal");doc.setTextColor(100,100,100);
      doc.text(l.texte||"Offert avec votre commande",mg+3,y+9);
      doc.setFontSize(9);doc.setTextColor(107,114,128);
      doc.text(String(l.qte),130,y+6,{align:"center"});
      doc.text("CHF "+pu.toFixed(2),155,y+6,{align:"right"});
      doc.setFont("helvetica","bold");doc.setTextColor(185,28,28);
      doc.text("- CHF "+rabais.toFixed(2),W-mg-2,y+6,{align:"right"});
      y+=11;
    });
  }
  y+=4;

  // Totaux
  const boxX=W/2+10,boxW=W/2-mg-10;
  const hasRabais=totalRabaisPDF>0;
  const hasRetard=retard?.frais>0;
  const boxRows=(hasRabais?3:2)+(hasRetard?1:0);
  const boxH=8+boxRows*6+10;
  doc.setFillColor(254,249,231);doc.setDrawColor(242,201,76);
  doc.roundedRect(boxX,y,boxW,boxH,3,3,"FD");
  doc.setFontSize(8.5);doc.setFont("helvetica","normal");doc.setTextColor(107,114,128);
  doc.text("Sous-total",boxX+4,y+8);doc.text("CHF "+totalBrutPDF.toFixed(2),boxX+boxW-4,y+8,{align:"right"});
  let rowY=y+14;
  if(hasRabais){
    doc.setTextColor(185,28,28);
    doc.text("Rabais bouteilles offertes",boxX+4,rowY);doc.text("- CHF "+totalRabaisPDF.toFixed(2),boxX+boxW-4,rowY,{align:"right"});
    rowY+=6;
    doc.setTextColor(107,114,128);
  }
  doc.text("TVA",boxX+4,rowY);doc.text("Non assujetti",boxX+boxW-4,rowY,{align:"right"});
  rowY+=6;
  if(hasRetard){
    doc.setTextColor(153,27,27);
    doc.text("Frais de rappel",boxX+4,rowY);doc.text("CHF "+retard.frais.toFixed(2),boxX+boxW-4,rowY,{align:"right"});
    rowY+=6;
  }
  doc.setDrawColor(242,201,76);doc.setLineWidth(0.3);doc.line(boxX+3,rowY,boxX+boxW-3,rowY);
  doc.setFontSize(11);doc.setFont("helvetica","bold");doc.setTextColor(17,17,17);
  doc.text(hasRetard?"TOTAL DÛ":"TOTAL CHF",boxX+4,rowY+8);doc.setTextColor(212,160,23);
  doc.text("CHF "+totalFinal.toFixed(2),boxX+boxW-4,rowY+8,{align:"right"});
  y+=retard?.frais>0?48:40;

  // IBAN
  doc.setFillColor(245,245,242);doc.roundedRect(mg,y,W-mg*2,18,3,3,"F");
  doc.setFontSize(7);doc.setFont("helvetica","bold");doc.setTextColor(156,163,175);
  doc.text("COORDONNÉES DE PAIEMENT",mg+4,y+5);
  doc.setFontSize(8.5);doc.setFont("helvetica","bold");doc.setTextColor(17,17,17);
  doc.text("IBAN : CH23 0900 0000 1565 1485 8",mg+4,y+11);
  doc.setFont("helvetica","normal");doc.setTextColor(107,114,128);
  doc.text("PostFinance · Goûtstoso / Jordan Montanaro · Paiement à 30 jours",mg+4,y+16);
  y+=20;

  // Signature fournisseur
  if(f.signFournisseur) {
    const sigW=70;
    doc.setFontSize(7);doc.setFont("helvetica","bold");doc.setTextColor(156,163,175);
    doc.text("SIGNATURE GOÛTSTOSO",mg,y+4);
    try { doc.addImage(f.signFournisseur,"PNG",mg,y+6,sigW,18); } catch(e){}
    doc.setDrawColor(200,200,200);doc.setLineWidth(0.2);doc.line(mg,y+26,mg+sigW,y+26);
    doc.setFontSize(7.5);doc.setFont("helvetica","normal");doc.setTextColor(107,114,128);
    doc.text("Jordan Montanaro / Goûtstoso",mg,y+30);
  }

  // Pied de page
  doc.setDrawColor(230,230,228);doc.setLineWidth(0.3);doc.line(mg,277,W-mg,277);
  doc.setFontSize(7.5);doc.setFont("helvetica","normal");doc.setTextColor(150,150,150);
  doc.text("Goûtstoso - Jordan Montanaro · Rue des Sources 19 · 2613 Villeret · admin@goutstoso.ch · www.goutstoso.ch",W/2,282,{align:"center"});
  doc.setFillColor(242,201,76);doc.rect(0,292,W,5,"F");

  // Annexes légales
  ajouterDocAnnexe(doc, "cgv", st);
  ajouterDocAnnexe(doc, "charte_alcool", st);

  doc.save(f.numero+(retard?"-RAPPEL":"")+".pdf");
} catch(e){alert("Erreur PDF : "+e.message);}

};

// ── GÉNÉRER LETTRE RAPPEL FORMELLE ──────────────────────────────
const genererRappelPDF = async (f) => {
const pr = getProchainRappel(f);
if(!pr || !pr.available) { alert("Aucun rappel disponible pour cette facture."); return; }
const deg = pr.degree;
const frais = pr.frais;
const pv = st.partenaires.find(p=>p.id===f.partenaireId);
const total = calcTotalNet(f,st.produits);
const totalFinal = total+frais;
const echeance = new Date(new Date(f.date).getTime()+30*86400000).toISOString().slice(0,10);
const dateRappel = today();
const newRappel = {degree:deg, date:dateRappel, frais};

// Enregistrer le rappel dans l'état
setSt(p=>({
  ...p,
  factures: p.factures.map(fac=>fac.id===f.id
    ? {...fac, rappels:[...(fac.rappels||[]), newRappel]}
    : fac
  )
}));

try {
  await new Promise((res,rej)=>{
    if(window.jspdf){res();return;}
    const s=document.createElement("script");
    s.src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
    s.onload=res;s.onerror=rej;document.head.appendChild(s);
  });
  const {jsPDF}=window.jspdf;
  const doc=new jsPDF("p","mm","a4");
  const W=210,mg=18;

  // Bande jaune top
  doc.setFillColor(242,201,76);doc.rect(0,0,W,6,"F");

  // Header
  pdfLogo(doc,mg);

  // Titre rappel
  const couleurDeg = deg===1?"#B45309":deg===2?"#C2410C":"#991B1B";
  const [cr,cg,cb] = deg===1?[180,67,9]:deg===2?[194,65,12]:[153,27,27];
  doc.setFontSize(28);doc.setFont("helvetica","bold");doc.setTextColor(cr,cg,cb);
  doc.text("RAPPEL N°"+deg,W-mg,20,{align:"right"});
  doc.setFontSize(10);doc.setTextColor(180,180,180);
  doc.text("Réf. facture : "+f.numero,W-mg,28,{align:"right"});
  doc.text("Date : "+fmt(dateRappel),W-mg,33,{align:"right"});

  // Ligne de séparation
  doc.setDrawColor(230,230,228);doc.setLineWidth(0.3);doc.line(mg,38,W-mg,38);

  // Adresses
  let y=46;
  doc.setFontSize(7);doc.setFont("helvetica","bold");doc.setTextColor(156,163,175);
  doc.text("EXPÉDITEUR",mg,y);doc.text("DESTINATAIRE",W/2+2,y);
  doc.setDrawColor(242,201,76);doc.setLineWidth(0.5);
  doc.line(mg,y+1,mg+20,y+1);doc.line(W/2+2,y+1,W/2+18,y+1);
  y+=6;
  doc.setFontSize(10);doc.setFont("helvetica","bold");doc.setTextColor(17,17,17);
  doc.text("Goûtstoso",mg,y);doc.text(pv?.nom||"",W/2+2,y);
  doc.setFontSize(8.5);doc.setFont("helvetica","normal");doc.setTextColor(107,114,128);
  ["Jordan Montanaro","Rue des Sources 19","2613 Villeret","admin@goutstoso.ch"].forEach((l,i)=>doc.text(l,mg,y+5+i*4.5));
  {const pvAddrLines=(pv?.npa||pv?.ville)?[pv?.adresse||"",[pv?.npa,pv?.ville].filter(Boolean).join(" ")].filter(Boolean):(pv?.adresse||"").split(", ").filter(Boolean);[...pvAddrLines,pv?.email||""].filter(Boolean).forEach((l,i)=>doc.text(l,W/2+2,y+5+i*4.5));}
  y+=32;

  // Tableau récap facture
  doc.setFillColor(17,17,17);doc.rect(mg,y,W-mg*2,8,"F");
  doc.setFontSize(7.5);doc.setFont("helvetica","bold");doc.setTextColor(242,201,76);
  doc.text("DÉSIGNATION",mg+3,y+5.5);
  doc.setTextColor(180,180,180);
  doc.text("FACTURE",130,y+5.5,{align:"center"});
  doc.text("ÉCHÉANCE",155,y+5.5,{align:"center"});
  doc.text("MONTANT CHF",W-mg-2,y+5.5,{align:"right"});
  y+=8;
  doc.setFillColor(250,250,248);doc.rect(mg,y,W-mg*2,11,"F");
  doc.setDrawColor(240,240,238);doc.setLineWidth(0.2);doc.rect(mg,y,W-mg*2,11,"S");
  doc.setFontSize(9);doc.setFont("helvetica","bold");doc.setTextColor(17,17,17);
  doc.text("Facture "+f.numero,mg+3,y+7);
  doc.setFontSize(8.5);doc.setFont("helvetica","normal");doc.setTextColor(107,114,128);
  doc.text(fmt(f.date),130,y+7,{align:"center"});
  doc.text(fmt(echeance),155,y+7,{align:"center"});
  doc.setFont("helvetica","bold");doc.setTextColor(17,17,17);
  doc.text("CHF "+total.toFixed(2),W-mg-2,y+7,{align:"right"});
  y+=18;

  // Boîte totaux
  const boxX=W/2+10,boxW=W/2-mg-10;
  doc.setFillColor(255,248,235);doc.setDrawColor(cr,cg,cb);doc.setLineWidth(0.5);
  doc.roundedRect(boxX,y,boxW,frais>0?44:28,3,3,"FD");
  doc.setFontSize(8.5);doc.setFont("helvetica","normal");doc.setTextColor(107,114,128);
  doc.text("Montant facture",boxX+4,y+9);doc.text("CHF "+total.toFixed(2),boxX+boxW-4,y+9,{align:"right"});
  if(frais>0){
    doc.setTextColor(cr,cg,cb);doc.setFont("helvetica","bold");
    doc.text("Frais de rappel n°"+deg,boxX+4,y+18);doc.text("CHF "+frais.toFixed(2),boxX+boxW-4,y+18,{align:"right"});
    doc.setDrawColor(cr,cg,cb);doc.setLineWidth(0.3);doc.line(boxX+3,y+23,boxX+boxW-3,y+23);
    doc.setFontSize(11);doc.setFont("helvetica","bold");doc.setTextColor(17,17,17);
    doc.text("TOTAL DÛ",boxX+4,y+32);doc.setTextColor(cr,cg,cb);
    doc.text("CHF "+totalFinal.toFixed(2),boxX+boxW-4,y+32,{align:"right"});
  } else {
    doc.setDrawColor(cr,cg,cb);doc.setLineWidth(0.3);doc.line(boxX+3,y+15,boxX+boxW-3,y+15);
    doc.setFontSize(11);doc.setFont("helvetica","bold");doc.setTextColor(17,17,17);
    doc.text("TOTAL DÛ",boxX+4,y+23);doc.setTextColor(cr,cg,cb);
    doc.text("CHF "+total.toFixed(2),boxX+boxW-4,y+23,{align:"right"});
  }
  y+=frais>0?54:38;

  // Texte corps du rappel
  doc.setFontSize(9.5);doc.setFont("helvetica","normal");doc.setTextColor(60,60,60);
  const lignesTxt1 = [];
  if(deg===1){
    lignesTxt1.push("Madame, Monsieur,","");
    lignesTxt1.push("Sauf erreur de notre part, la facture "+f.numero+" du "+fmt(f.date)+" d'un montant de");
    lignesTxt1.push("CHF "+total.toFixed(2)+" n'a pas encore été réglée à ce jour.");
    lignesTxt1.push("");
    lignesTxt1.push("Ce premier rappel vous est adressé à titre gracieux, sans aucuns frais supplémentaires.");
    lignesTxt1.push("Nous vous prions de bien vouloir procéder au règlement dans un délai de 10 jours.");
    lignesTxt1.push("");
    lignesTxt1.push("Sans paiement de votre part dans ce délai, un deuxième rappel vous sera adressé");
    lignesTxt1.push("avec des frais de rappel de CHF 15.00.");
  } else if(deg===2){
    lignesTxt1.push("Madame, Monsieur,","");
    lignesTxt1.push("Malgré notre premier rappel, la facture "+f.numero+" du "+fmt(f.date)+" reste impayée.");
    lignesTxt1.push("");
    lignesTxt1.push("Nous vous adressons ce deuxième rappel et vous demandons instamment de régler");
    lignesTxt1.push("la totalité de CHF "+totalFinal.toFixed(2)+" (facture + frais de rappel CHF 15.00) dans les 10 jours.");
    lignesTxt1.push("");
    lignesTxt1.push("Sans paiement dans ce délai, un troisième et dernier rappel vous sera adressé");
    lignesTxt1.push("avec des frais de CHF 25.00, avant toute procédure de recouvrement.");
  } else {
    lignesTxt1.push("Madame, Monsieur,","");
    lignesTxt1.push("En dépit de nos deux précédents rappels restés sans effet, la facture "+f.numero);
    lignesTxt1.push("du "+fmt(f.date)+" demeure impayée.");
    lignesTxt1.push("");
    lignesTxt1.push("Ce troisième et dernier rappel exige le règlement immédiat de CHF "+totalFinal.toFixed(2));
    lignesTxt1.push("(facture + frais de rappel CHF 25.00) dans un délai de 10 jours.");
    lignesTxt1.push("");
    lignesTxt1.push("Sans règlement dans ce délai, nous engagerons une procédure de recouvrement.");
    lignesTxt1.push("Les frais de recouvrement et intérêts légaux seront entièrement à votre charge.");
  }
  lignesTxt1.forEach((l,i)=>{ doc.text(l,mg,y+i*5.5); });
  y+=lignesTxt1.length*5.5+10;

  // IBAN
  doc.setFillColor(245,245,242);doc.roundedRect(mg,y,W-mg*2,20,3,3,"F");
  doc.setFontSize(7);doc.setFont("helvetica","bold");doc.setTextColor(156,163,175);
  doc.text("COORDONNÉES DE PAIEMENT",mg+4,y+5);
  doc.setFontSize(8.5);doc.setFont("helvetica","bold");doc.setTextColor(17,17,17);
  doc.text("IBAN : CH23 0900 0000 1565 1485 8",mg+4,y+12);
  doc.setFont("helvetica","normal");doc.setTextColor(107,114,128);
  doc.text("PostFinance · Goûtstoso / Jordan Montanaro · Montant : CHF "+totalFinal.toFixed(2),mg+4,y+17);
  y+=28;

  // Signature
  doc.setFontSize(8.5);doc.setFont("helvetica","normal");doc.setTextColor(107,114,128);
  doc.text("Cordialement,",mg,y);
  doc.setFont("helvetica","bold");doc.setTextColor(17,17,17);
  doc.text("Jordan Montanaro — Goûtstoso",mg,y+7);
  doc.setFont("helvetica","normal");doc.setTextColor(107,114,128);
  doc.text("admin@goutstoso.ch · www.goutstoso.ch",mg,y+12);

  // Pied de page
  doc.setDrawColor(230,230,228);doc.setLineWidth(0.3);doc.line(mg,277,W-mg,277);
  doc.setFontSize(7.5);doc.setFont("helvetica","normal");doc.setTextColor(150,150,150);
  doc.text("Goûtstoso - Jordan Montanaro · Rue des Sources 19 · 2613 Villeret · admin@goutstoso.ch",W/2,282,{align:"center"});
  doc.setFillColor(cr,cg,cb);doc.rect(0,292,W,5,"F");

  // Annexe légale
  ajouterDocAnnexe(doc, "cgv", st);

  doc.save("RAPPEL-"+deg+"-"+f.numero+".pdf");
  alert("✅ Rappel "+deg+" généré et enregistré !");
} catch(e){alert("Erreur PDF : "+e.message);}
};

// Filtres
const factures = (st.factures||[]).slice().reverse();
const filtrees = factures.filter(f=>{
if(filtre==="toutes") return true;
if(filtre==="attente") return f.statut==="en attente"&&!getInfosRetard(f);
if(filtre==="echues") return f.statut!=="payée"&&getInfosRetard(f);
if(filtre==="payees") return f.statut==="payée";
return true;
});
const nbEchues = factures.filter(f=>f.statut!=="payée"&&getInfosRetard(f)).length;

// Vue détail facture
if(view) {
const pv = st.partenaires.find(p=>p.id===view.partenaireId) || (st.clients||[]).find(c=>c.id===view.partenaireId);
const totalBrutView = calcTotal(view.lignes,view.typeClient,st.produits);
const totalRabaisView = calcTotal((view.lignesOffertes||[]).filter(l=>l.produitId&&l.qte>0),view.typeClient,st.produits);
const total = totalBrutView - totalRabaisView;
const retard = getInfosRetard(view);
const pr = getProchainRappel(view);
const totalFinal = total+(retard?.frais||0);
const echeance = new Date(new Date(view.date).getTime()+30*86400000).toISOString().slice(0,10);
const rappelsEnvoyes = view.rappels||[];


return (
  <div className="fade">
    <button onClick={()=>{setView(null);setPjModal(false);}} style={{display:"flex",alignItems:"center",gap:6,background:"none",border:"none",color:"#9CA3AF",fontSize:13,marginBottom:16,padding:0,cursor:"pointer"}}>← Retour</button>

    {/* Alerte retard + prochain rappel */}
    {retard&&(
      <div style={{background: pr?.degree===3?"#FEF2F2":pr?.degree===2?"#FFF7ED":"#FEF2F2",border:"1px solid "+(pr?.degree===3?"#FCA5A5":pr?.degree===2?"#FED7AA":"#FCA5A5"),borderRadius:12,padding:"10px 14px",marginBottom:14}}>
        <p style={{fontWeight:700,color:"#991B1B",fontSize:13}}>
          {pr?.degree===1?"🔔":pr?.degree===2?"⚠️":"🚨"} Retard : {retard.jours} jours — {pr?.available?"Rappel "+pr.degree+" disponible":pr?.daysLeft?"Rappel "+pr?.degree+" disponible dans "+pr?.daysLeft+"j":"3 rappels envoyés"}
        </p>
        <p style={{fontSize:11,color:"#B91C1C",marginTop:2}}>
          Échéance dépassée le {fmt(echeance)}
          {retard.frais>0?` · Frais en cours : CHF ${retard.frais}`:""}
        </p>
      </div>
    )}

    {/* Historique rappels */}
    {rappelsEnvoyes.length>0&&(
      <div style={{background:"#F9F9F6",border:"1px solid #E5E5E0",borderRadius:12,padding:"10px 14px",marginBottom:14}}>
        <p style={{fontWeight:700,fontSize:11,color:"#6B7280",textTransform:"uppercase",marginBottom:8}}>Historique des rappels</p>
        {rappelsEnvoyes.map((r,i)=>(
          <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 0",borderBottom:i<rappelsEnvoyes.length-1?"1px solid #EEEEEA":"none"}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <span style={{background:r.degree===1?"#FEF3C7":r.degree===2?"#FFEDD5":"#FEE2E2",color:r.degree===1?"#92400E":r.degree===2?"#9A3412":"#991B1B",borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:700}}>
                Rappel {r.degree}
              </span>
              <span style={{fontSize:12,color:"#374151"}}>Envoyé le {fmt(r.date)}</span>
            </div>
            <span style={{fontSize:12,fontWeight:600,color:r.frais}}>0?"#991B1B":"#6B7280"}}>{r.frais>0?"+ CHF "+r.frais.toFixed(2):"Sans frais"}</span>
          </div>
        ))}
      </div>
    )}

    {/* Bouton rappel disponible */}
    {pr?.available&&view.statut!=="payée"&&(
      <div style={{marginBottom:14}}>
        <button onClick={()=>genererRappelPDF(view)} style={{width:"100%",background:pr.degree===1?"#FEF3C7":pr.degree===2?"#FFEDD5":"#FEE2E2",border:"1.5px solid "+(pr.degree===1?"#F59E0B":pr.degree===2?"#F97316":"#EF4444"),borderRadius:12,padding:"13px",fontWeight:700,fontSize:13,color:pr.degree===1?"#92400E":pr.degree===2?"#9A3412":"#991B1B",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
          {pr.degree===1?"🔔":pr.degree===2?"⚠️":"🚨"} Générer Rappel {pr.degree}{pr.frais>0?" (+ CHF "+pr.frais.toFixed(2)+" frais)":""}
        </button>
        <button onClick={()=>envoyerEmail(view,pr.degree)} style={{width:"100%",marginTop:6,background:"none",border:"1px solid #E5E5E0",borderRadius:10,padding:"9px",fontSize:12,fontWeight:600,color:"#6B7280",cursor:"pointer"}}>
          ✉️ Envoyer Rappel {pr.degree} par email
        </button>
      </div>
    )}
    {pr&&!pr.available&&pr.degree&&view.statut!=="payée"&&(
      <div style={{background:"#F0FDF4",border:"1px solid #86EFAC",borderRadius:12,padding:"10px 14px",marginBottom:14}}>
        <p style={{fontSize:12,color:"#166534"}}>⏳ Rappel {pr.degree} disponible dans <strong>{pr.daysLeft} jour{pr.daysLeft>1?"s":""}</strong> (délai de 10 jours entre rappels)</p>
      </div>
    )}

    {/* Actions */}
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:10}}>
      <button onClick={()=>genererPDF(view)} style={{background:"#111",color:"#F2C94C",border:"none",borderRadius:12,padding:"13px",fontWeight:700,fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
        ⬇️ PDF
      </button>
      <button onClick={()=>setPjModal(true)} style={{background:"#FEF9E7",color:"#92400E",border:"1.5px solid #F2C94C",borderRadius:12,padding:"13px",fontWeight:600,fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
        ✉️ Email
      </button>
      <button onClick={()=>{setForm({...view,lignesOffertes:view.lignesOffertes||[]});setView(null);setModal("form");}} style={{background:"#F5F5F0",border:"1.5px solid #E5E5E0",borderRadius:12,padding:"13px",fontWeight:600,fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
        ✏️ Modifier
      </button>
    </div>

    {/* MODAL PIÈCES JOINTES */}
    {pjModal && (()=>{
      const bulletins = (st.contrats||[]).filter(c=>c.livraison && c.partenaireId===view.partenaireId);
      return (
        <>
          <div onClick={()=>setPjModal(false)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex:300}}/>
          <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:480,zIndex:310,background:"#fff",borderRadius:"20px 20px 0 0",padding:"20px 20px 32px",boxShadow:"0 -8px 40px rgba(0,0,0,.18)"}}>
            {/* Handle */}
            <div style={{width:36,height:4,borderRadius:2,background:"#DDD",margin:"0 auto 16px"}}/>
            <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,fontWeight:700,marginBottom:4}}>Pièces jointes</p>
            <p style={{fontSize:12,color:"#9CA3AF",marginBottom:16}}>Téléchargez les documents avant d'envoyer l'email.</p>

            {/* Facture */}
            <button onClick={()=>genererPDF(view)} style={{width:"100%",display:"flex",alignItems:"center",gap:12,background:"#F5F5F0",border:"1.5px solid #E5E5E0",borderRadius:12,padding:"12px 14px",marginBottom:8,cursor:"pointer",textAlign:"left"}}>
              <span style={{fontSize:22}}>📄</span>
              <div style={{flex:1}}>
                <p style={{fontWeight:700,fontSize:13,color:"#0A0A0A"}}>Facture {view.numero}</p>
                <p style={{fontSize:11,color:"#9CA3AF",marginTop:2}}>Télécharger le PDF</p>
              </div>
              <span style={{fontSize:18,color:"#F2C94C"}}>⬇</span>
            </button>

            {/* Bulletins de livraison */}
            {bulletins.length===0
              ? <div style={{background:"#F9F9F6",borderRadius:10,padding:"10px 14px",marginBottom:8,textAlign:"center"}}>
                  <p style={{fontSize:12,color:"#9CA3AF"}}>Aucun bon de livraison pour ce partenaire</p>
                </div>
              : bulletins.map(b=>(
                <button key={b.id} onClick={()=>{const pv2=st.partenaires.find(p=>p.id===b.partenaireId);genererBulletinPDF(b,pv2,st);}} style={{width:"100%",display:"flex",alignItems:"center",gap:12,background:"#F5F5F0",border:"1.5px solid #E5E5E0",borderRadius:12,padding:"12px 14px",marginBottom:8,cursor:"pointer",textAlign:"left"}}>
                  <span style={{fontSize:22}}>📋</span>
                  <div style={{flex:1}}>
                    <p style={{fontWeight:700,fontSize:13,color:"#0A0A0A"}}>{b.type==="depot-vente"?"Bon de dépôt":"Bon de livraison"} {b.numero}</p>
                    <p style={{fontSize:11,color:"#9CA3AF",marginTop:2}}>du {fmt(b.date||b.dateDebut)} · Télécharger le PDF</p>
                  </div>
                  <span style={{fontSize:18,color:"#F2C94C"}}>⬇</span>
                </button>
              ))
            }

            {/* Bouton email */}
            <button onClick={()=>{envoyerEmail(view,null);setPjModal(false);}} style={{width:"100%",background:"#F2C94C",border:"none",borderRadius:12,padding:"14px",fontWeight:700,fontSize:14,cursor:"pointer",marginTop:8,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
              ✉️ Composer l'email
            </button>
            <button onClick={()=>setPjModal(false)} style={{width:"100%",background:"none",border:"none",borderRadius:12,padding:"10px",fontWeight:500,fontSize:13,cursor:"pointer",color:"#9CA3AF",marginTop:4}}>
              Annuler
            </button>
          </div>
        </>
      );
    })()}
    <button onClick={async()=>{const pvLocal=(st.partenaires||[]).find(p=>p.id===view.partenaireId);const enriched={...view,clientNom:view.clientNom||pvLocal?.nom||"",lignes:(view.lignes||[]).map(l=>{const prod=(st.produits||[]).find(p=>p.id===l.produitId);return {...l,designation:prod?`${prod.nom}${prod.format?" · "+prod.format:""}`:l.produitId,prixUnitaire:prod?.prixRevendeur||0};})};const token=await envoyerPourSignature("facture","Facture "+view.numero,enriched,enriched.clientNom?pvLocal?.email||view.clientEmail||"":"");if(token)setSt(p=>({...p,factures:p.factures.map(f=>f.id===view.id?{...f,signingToken:token}:f)}));}} style={{width:"100%",marginBottom:view.signingToken?4:8,background:"linear-gradient(135deg,#0a0a0a,#1a1a1a)",border:"none",borderRadius:10,padding:"11px",fontWeight:700,fontSize:12,color:"#F2C94C",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
      🔏 Envoyer pour signature
    </button>
    {view.signingToken&&<button onClick={async()=>{try{const r=await fetch(`${SIGN_API}/sign/${view.signingToken}`);const d=await r.json();if(d.status!=="signed"){alert("Pas encore signé. Relancez une fois que votre partenaire a cliqué le lien.");return;}setSt(p=>({...p,factures:p.factures.map(f=>f.id===view.id?{...f,signFournisseur:d.signatureData,statut:"signée",signerNom:d.signerName,signingToken:null}:f)}));setView(v=>({...v,signFournisseur:d.signatureData,statut:"signée",signerNom:d.signerName,signingToken:null}));alert(`✅ ${d.signerName} a signé !\nLa signature est maintenant intégrée dans le PDF.`);}catch(e){alert("Erreur : "+e.message);}}} style={{width:"100%",marginBottom:4,background:"#DCFCE7",border:"1.5px solid #86EFAC",borderRadius:10,padding:"10px",fontWeight:700,fontSize:12,color:"#166534",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>🔄 Vérifier la signature</button>}
    {!view.signingToken&&!view.signFournisseur&&(<div style={{display:"flex",gap:6,marginBottom:8,alignItems:"center"}}>
      <input value={recoveryTokenF} onChange={e=>setRecoveryTokenF(e.target.value)} placeholder="Token de signature existant…" style={{flex:1,padding:"8px 10px",borderRadius:8,border:"1px solid #E5E7EB",fontSize:11,outline:"none",color:"#374151"}}/>
      <button onClick={async()=>{const t=recoveryTokenF.trim();if(!t)return;try{const r=await fetch(`${SIGN_API}/sign/${t}`);const d=await r.json();if(d.status!=="signed"){alert("Ce token n'est pas encore signé.");return;}setSt(p=>({...p,factures:p.factures.map(f=>f.id===view.id?{...f,signFournisseur:d.signatureData,statut:"signée",signerNom:d.signerName}:f)}));setView(v=>({...v,signFournisseur:d.signatureData,statut:"signée",signerNom:d.signerName}));setRecoveryTokenF("");alert(`✅ Signature de ${d.signerName} intégrée dans le PDF !`);}catch(e){alert("Erreur : "+e.message);}}} style={{padding:"8px 10px",borderRadius:8,background:"#F9F9F6",border:"1px solid #E5E7EB",fontSize:11,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap",color:"#374151"}}>🔍 Récupérer</button>
    </div>)}
    {view.statut!=="payée"&&(
      <div style={{marginBottom:8}}>
        {view.envoyee
          ? <div style={{background:"#EFF6FF",border:"1px solid #BFDBFE",borderRadius:10,padding:"10px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <p style={{fontSize:12,color:"#1E40AF",fontWeight:600}}>✉️ Facture envoyée</p>
              <button onClick={()=>setSt(p=>({...p,factures:p.factures.map(x=>x.id===view.id?{...x,envoyee:false}:x)}))} style={{fontSize:10,color:"#9CA3AF",background:"none",border:"none",cursor:"pointer",textDecoration:"underline"}}>Annuler</button>
            </div>
          : <button onClick={()=>{setSt(p=>({...p,factures:p.factures.map(x=>x.id===view.id?{...x,envoyee:true}:x)}));setView(v=>({...v,envoyee:true}));}} style={{width:"100%",background:"#EFF6FF",border:"1.5px solid #BFDBFE",borderRadius:10,padding:"10px",fontWeight:700,fontSize:13,color:"#1E40AF",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6,marginBottom:8}}>
              📤 Marquer comme envoyée
            </button>
        }
      </div>
    )}
    {view.statut!=="payée"&&(
      <div style={{marginBottom:16}}>
        <button onClick={()=>{marquerPayee(view.id);setView(null);}} style={{width:"100%",background:"#DCFCE7",border:"none",borderRadius:12,padding:"12px",fontWeight:700,fontSize:13,color:"#166534",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
          ✅ Marquer comme payée
        </button>
        {(view.rappels||[]).length>0&&(()=>{
          const lastR=(view.rappels||[])[view.rappels.length-1];
          const fraisR=lastR?.degree>=3?25:lastR?.degree>=2?15:0;
          return fraisR>0?(
            <p style={{fontSize:10,color:"#166534",textAlign:"center",marginTop:5}}>
              ↳ CHF {fraisR.toFixed(2)} frais de rappel seront enregistrés automatiquement en comptabilité (compte 3750)
            </p>
          ):null;
        })()}
      </div>
    )}

    {/* Document */}
    <div style={{background:"#fff",borderRadius:14,overflow:"hidden",boxShadow:"0 2px 16px rgba(0,0,0,.08)"}}>
      <div style={{background:"#F2C94C",height:4}}/>
      <div style={{padding:"16px 16px 0",display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
        <div>
          <img src={LOGO_B64} alt="" style={{width:40,height:37,objectFit:"contain",marginBottom:4}}/>
          <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:18,fontWeight:700,lineHeight:1}}>GoûtStoso</p>
          <p style={{fontSize:10,color:"#9CA3AF"}}>Liqueurs artisanales · Suisse</p>
        </div>
        <div style={{textAlign:"right"}}>
          <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,fontWeight:900}}>{retard?"RAPPEL":"FACTURE"}</p>
          <p style={{fontSize:12,fontWeight:700,color:"#D4A017",marginTop:2}}>{view.numero}</p>
          <p style={{fontSize:10,color:"#9CA3AF",marginTop:2}}>Émise le {fmt(view.date)}</p>
          <p style={{fontSize:10,color:retard?"#DC2626":"#9CA3AF"}}>Échéance {fmt(echeance)}</p>
          <div style={{marginTop:6}}><Badge c={view.statut==="payée"?"green":retard?"red":"yellow"}>{view.statut==="payée"?"Payée":retard?"En retard":"En attente"}</Badge></div>
        </div>
      </div>
      <div style={{margin:"12px 16px",height:1,background:"#F5F5F0"}}/>
      <div style={{padding:"0 16px 12px",display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <div>
          <p style={{fontSize:8,fontWeight:700,color:"#9CA3AF",textTransform:"uppercase",marginBottom:4}}>De</p>
          <p style={{fontWeight:700,fontSize:12}}>Goûtstoso</p>
          <p style={{fontSize:11,color:"#6B7280",lineHeight:1.7}}>Jordan Montanaro{"\n"}Rue des Sources 19{"\n"}2613 Villeret</p>
        </div>
        <div>
          <p style={{fontSize:8,fontWeight:700,color:"#9CA3AF",textTransform:"uppercase",marginBottom:4}}>Facturé à</p>
          <p style={{fontWeight:700,fontSize:12}}>{pv?.nom}</p>
          <p style={{fontSize:11,color:"#6B7280",lineHeight:1.7}}>{pv?.adresse}</p>
        </div>
      </div>
      <div style={{margin:"0 16px 12px"}}>
        <div style={{background:"#111",borderRadius:"8px 8px 0 0",padding:"7px 10px",display:"flex"}}>
          <span style={{flex:1,fontSize:8,fontWeight:700,color:"#F2C94C",textTransform:"uppercase"}}>Désignation</span>
          <span style={{width:24,fontSize:8,fontWeight:700,color:"#aaa",textTransform:"uppercase",textAlign:"center"}}>Qté</span>
          <span style={{width:54,fontSize:8,fontWeight:700,color:"#aaa",textTransform:"uppercase",textAlign:"right"}}>P.U.</span>
          <span style={{width:62,fontSize:8,fontWeight:700,color:"#F2C94C",textTransform:"uppercase",textAlign:"right"}}>Total</span>
        </div>
        {(view.lignes||[]).filter(l=>l.produitId).map((l,i)=>{
          const p=st.produits.find(x=>x.id===l.produitId);
          const pu=p?(view.typeClient==="revendeur"?p.prixRevendeur:p.prixClient):0;
          return (
            <div key={i} style={{background:i%2===0?"#FAFAF8":"#fff",padding:"8px 10px",display:"flex",alignItems:"center",border:"1px solid #F0F0EE",borderTop:"none"}}>
              <div style={{flex:1}}>
                <p style={{fontSize:12,fontWeight:600}}>{p?.nom} {p?.variante}</p>
                <p style={{fontSize:10,color:"#9CA3AF"}}>{p?.format} · 30% vol.</p>
              </div>
              <span style={{width:24,textAlign:"center",fontSize:12,color:"#6B7280"}}>{l.qte}</span>
              <span style={{width:54,textAlign:"right",fontSize:11,color:"#6B7280"}}>CHF {pu.toFixed(2)}</span>
              <span style={{width:62,textAlign:"right",fontSize:12,fontWeight:700}}>CHF {(pu*l.qte).toFixed(2)}</span>
            </div>
          );
        })}
        <div style={{height:2,background:"#F0F0EE",borderRadius:"0 0 6px 6px"}}/>
      </div>

      {/* Rabais — bouteilles offertes dans la vue détail */}
      {(view.lignesOffertes||[]).filter(l=>l.produitId).length>0&&(
        <div style={{margin:"0 16px 12px"}}>
          <div style={{background:"#FEE2E2",border:"1px solid #FCA5A5",borderRadius:"8px 8px 0 0",padding:"6px 10px"}}>
            <span style={{fontSize:8,fontWeight:700,color:"#991B1B",textTransform:"uppercase"}}>🏷 Rabais — bouteilles offertes</span>
          </div>
          {(view.lignesOffertes||[]).filter(l=>l.produitId).map((l,i)=>{
            const p=st.produits.find(x=>x.id===l.produitId);
            const pu=p?(view.typeClient==="revendeur"?p.prixRevendeur:p.prixClient):0;
            const rabais=pu*(l.qte||0);
            return (
              <div key={i} style={{background:i%2===0?"#FFF5F5":"#fff",padding:"8px 10px",display:"flex",alignItems:"center",border:"1px solid #FCA5A5",borderTop:"none"}}>
                <div style={{flex:1}}>
                  <p style={{fontSize:12,fontWeight:600}}>{p?.nom} {p?.variante}</p>
                  <p style={{fontSize:10,color:"#9CA3AF"}}>{l.texte||"Offert avec votre commande"}</p>
                </div>
                <span style={{width:24,textAlign:"center",fontSize:12,color:"#6B7280"}}>{l.qte}</span>
                <span style={{width:54,textAlign:"right",fontSize:11,color:"#9CA3AF"}}>CHF {pu.toFixed(2)}</span>
                <span style={{width:72,textAlign:"right",fontSize:12,fontWeight:700,color:"#DC2626"}}>- CHF {rabais.toFixed(2)}</span>
              </div>
            );
          })}
          <div style={{height:2,background:"#FCA5A5",borderRadius:"0 0 6px 6px"}}/>
        </div>
      )}

      <div style={{padding:"0 16px 12px",display:"flex",justifyContent:"flex-end"}}>
        <div style={{background:"#FEF9E7",border:"1px solid #F2C94C",borderRadius:10,padding:"10px 14px",minWidth:180}}>
          <div style={{display:"flex",justifyContent:"space-between",gap:14,marginBottom:3}}>
            <span style={{fontSize:11,color:"#6B7280"}}>Sous-total</span><span style={{fontSize:11}}>CHF {totalBrutView.toFixed(2)}</span>
          </div>
          {totalRabaisView>0&&(
            <div style={{display:"flex",justifyContent:"space-between",gap:14,marginBottom:3}}>
              <span style={{fontSize:11,color:"#DC2626",fontWeight:600}}>🏷 Rabais bouteilles</span>
              <span style={{fontSize:11,color:"#DC2626",fontWeight:600}}>- CHF {totalRabaisView.toFixed(2)}</span>
            </div>
          )}
          <div style={{display:"flex",justifyContent:"space-between",gap:14,marginBottom:retard?.frais}}>0?3:6}}>
            <span style={{fontSize:11,color:"#6B7280"}}>TVA</span><span style={{fontSize:11,color:"#9CA3AF"}}>Non assujetti</span>
          </div>
          {retard?.frais>0&&(
            <div style={{display:"flex",justifyContent:"space-between",gap:14,marginBottom:6}}>
              <span style={{fontSize:11,color:"#991B1B",fontWeight:600}}>Frais rappel</span>
              <span style={{fontSize:11,color:"#991B1B",fontWeight:600}}>CHF {retard.frais.toFixed(2)}</span>
            </div>
          )}
          <div style={{display:"flex",justifyContent:"space-between",gap:14,borderTop:"1px solid #F2C94C",paddingTop:7}}>
            <span style={{fontSize:13,fontWeight:700}}>Total CHF</span>
            <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:18,fontWeight:700,color:"#D4A017"}}>CHF {totalFinal.toFixed(2)}</span>
          </div>
        </div>
      </div>
      <div style={{background:"#F5F5F2",margin:"0 16px 12px",borderRadius:8,padding:"8px 12px"}}>
        <p style={{fontSize:11,fontWeight:700}}>IBAN : CH23 0900 0000 1565 1485 8</p>
        <p style={{fontSize:10,color:"#6B7280",marginTop:1}}>PostFinance · Goûtstoso / Jordan Montanaro · À 30 jours</p>
      </div>
      {/* Signature Fournisseur */}
      {view.signFournisseur&&(
        <div style={{padding:"8px 16px 12px",borderTop:"1px solid #F5F5F0",display:"flex",alignItems:"flex-end",gap:24}}>
          <div>
            <p style={{fontSize:8,fontWeight:700,color:"#9CA3AF",textTransform:"uppercase",marginBottom:4}}>Signature Goûtstoso</p>
            <img src={view.signFournisseur} alt="signature" style={{height:40,maxWidth:140,objectFit:"contain",display:"block"}}/>
            <div style={{width:140,height:1,background:"#ddd",marginTop:3}}/>
            <p style={{fontSize:8,color:"#9CA3AF",marginTop:2}}>Jordan Montanaro</p>
          </div>
        </div>
      )}
      <div style={{background:"#F2C94C",height:4}}/>
    </div>
    <details style={{background:"#F5F5F0",borderRadius:10,padding:"12px 14px",marginTop:14,fontSize:10,color:"#6B7280"}}>
      <summary style={{fontWeight:700,fontSize:13,color:"#111",cursor:"pointer",display:"flex",justifyContent:"space-between",listStyle:"none"}}>CGV - Annexe <span>▼</span></summary>
      <div style={{marginTop:10,lineHeight:1.7,whiteSpace:"pre-wrap"}}>{CGV}</div>
    </details>
  </div>
);

}

// Vue liste
return (
<div className="fade">
<SectionTitle action={
<div style={{display:"flex",gap:8}}>
<Btn icon="export" variant="ghost" small onClick={()=>exportCSV((st.factures||[]).map(f=>{
const pv=st.partenaires.find(p=>p.id===f.partenaireId);
const total=calcTotalNet(f,st.produits);
return {Numero:f.numero,Date:f.date,Client:pv?.nom,Total:total,Statut:f.statut};
}),"goutstoso_factures.csv")}>Export</Btn>
<Btn icon="plus" variant="ghost" small onClick={()=>{setSelectedForRegroup([]);setModalRegroup(true);}}>Regrouper</Btn>
<Btn icon="plus" onClick={()=>{setForm({...emptyF,id:null});setModal("form");}}>Nouvelle</Btn>
</div>
}>Factures</SectionTitle>

  {/* Alerte factures échues */}
  {nbEchues>0&&(
    <div style={{background:"#FEE2E2",border:"1px solid #FCA5A5",borderRadius:12,padding:"10px 14px",marginBottom:14,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
      <div>
        <p style={{fontWeight:700,color:"#991B1B",fontSize:13}}>⚠️ {nbEchues} facture{nbEchues>1?"s":""} en retard</p>
        <p style={{fontSize:11,color:"#B91C1C",marginTop:1}}>Cliquez pour voir et envoyer les rappels</p>
      </div>
      <button onClick={()=>setFiltre("echues")} style={{background:"#991B1B",color:"#fff",border:"none",borderRadius:8,padding:"7px 12px",fontSize:12,fontWeight:700,cursor:"pointer"}}>
        Voir
      </button>
    </div>
  )}

  {/* Filtres */}
  {(()=>{
    const nbRappels = (st.factures||[]).reduce((acc,f)=>acc+(f.rappels||[]).length,0);
    return (
      <div style={{display:"flex",gap:6,marginBottom:14,overflowX:"auto",paddingBottom:2}}>
        {[
          {id:"toutes",l:"Toutes"},
          {id:"attente",l:"En attente"},
          {id:"echues",l:`Échues${nbEchues>0?" ("+nbEchues+")":""}`},
          {id:"payees",l:"Payées"},
          {id:"rappels",l:`Rappels${nbRappels>0?" ("+nbRappels+")":""}`},
        ].map(f=>(
          <button key={f.id} onClick={()=>setFiltre(f.id)} style={{
            background:filtre===f.id?"#111":"#F5F5F0",
            color:filtre===f.id?"#F2C94C":"#6B7280",
            border:"none",borderRadius:20,padding:"6px 14px",
            fontSize:12,fontWeight:filtre===f.id?700:400,
            cursor:"pointer",whiteSpace:"nowrap",flexShrink:0,
          }}>{f.l}</button>
        ))}
      </div>
    );
  })()}

  {/* Vue Rappels envoyés */}
  {filtre==="rappels"&&(()=>{
    const tousRappels = [];
    (st.factures||[]).forEach(f=>{
      const pv = st.partenaires.find(p=>p.id===f.partenaireId);
      const total = calcTotal(f.lignes,f.typeClient,st.produits);
      (f.rappels||[]).forEach(r=>{
        tousRappels.push({...r, facture:f, pv, total});
      });
    });
    tousRappels.sort((a,b)=>new Date(b.date)-new Date(a.date));
    if(tousRappels.length===0) return (
      <div style={{textAlign:"center",padding:"40px 20px",color:"#9CA3AF"}}>
        <p style={{fontSize:40,marginBottom:12}}>🔔</p>
        <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,fontWeight:600,color:"#374151"}}>Aucun rappel envoyé</p>
        <p style={{fontSize:13,color:"#9CA3AF",marginTop:8}}>Les rappels générés depuis les factures échues apparaîtront ici.</p>
      </div>
    );
    const totalFrais = tousRappels.reduce((s,r)=>s+r.frais,0);
    const fraisEncaisses = tousRappels.filter(r=>r.facture.statut==="payée").reduce((s,r)=>s+r.frais,0);
    return (
      <div>
        {/* Résumé */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:14}}>
          <div style={{background:"#F9F9F6",border:"1px solid #E5E5E0",borderRadius:10,padding:"10px 12px",textAlign:"center"}}>
            <p style={{fontSize:22,fontWeight:700,fontFamily:"'Cormorant Garamond',serif"}}>{tousRappels.length}</p>
            <p style={{fontSize:10,color:"#6B7280",marginTop:2}}>Rappels envoyés</p>
          </div>
          <div style={{background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:10,padding:"10px 12px",textAlign:"center"}}>
            <p style={{fontSize:18,fontWeight:700,fontFamily:"'Cormorant Garamond',serif",color:"#991B1B"}}>CHF {totalFrais.toFixed(2)}</p>
            <p style={{fontSize:10,color:"#991B1B",marginTop:2}}>Frais facturés</p>
          </div>
          <div style={{background:"#F0FDF4",border:"1px solid #86EFAC",borderRadius:10,padding:"10px 12px",textAlign:"center"}}>
            <p style={{fontSize:18,fontWeight:700,fontFamily:"'Cormorant Garamond',serif",color:"#166534"}}>CHF {fraisEncaisses.toFixed(2)}</p>
            <p style={{fontSize:10,color:"#166534",marginTop:2}}>Frais encaissés</p>
          </div>
        </div>

        {/* Liste des rappels */}
        {tousRappels.map((r,i)=>{
          const coulBg = r.degree===1?"#FEF3C7":r.degree===2?"#FFEDD5":"#FEE2E2";
          const coulTxt = r.degree===1?"#92400E":r.degree===2?"#9A3412":"#991B1B";
          const icone = r.degree===1?"🔔":r.degree===2?"⚠️":"🚨";
          const estPayee = r.facture.statut==="payée";
          return (
            <Card key={i} style={{marginBottom:8,borderLeft:"3px solid "+(estPayee?"#22C55E":r.degree===3?"#EF4444":r.degree===2?"#F97316":"#F59E0B")}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",cursor:"pointer"}} onClick={()=>setView(r.facture)}>
                <div>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                    <span style={{background:coulBg,color:coulTxt,borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:700}}>
                      {icone} Rappel {r.degree}
                    </span>
                    <span style={{fontSize:12,fontWeight:600}}>{r.facture.numero}</span>
                    <Badge c={estPayee?"green":r.degree>=2?"red":"yellow"}>{estPayee?"Payée":"En attente"}</Badge>
                  </div>
                  <p style={{fontSize:12,color:"#6B7280"}}>{r.pv?.nom||"—"}</p>
                  <p style={{fontSize:11,color:"#9CA3AF",marginTop:2}}>Envoyé le {fmt(r.date)}</p>
                </div>
                <div style={{textAlign:"right"}}>
                  {r.frais>0
                    ? <p style={{fontSize:14,fontWeight:700,color:estPayee?"#166534":"#991B1B"}}>+CHF {r.frais.toFixed(2)}</p>
                    : <p style={{fontSize:12,color:"#9CA3AF"}}>Sans frais</p>
                  }
                  <p style={{fontSize:11,color:"#9CA3AF",marginTop:2}}>
                    Facture CHF {r.total.toFixed(2)}
                    {r.frais>0?` + ${r.frais} frais`:""}
                  </p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    );
  })()}

  {/* Liste factures normale */}
  {filtre!=="rappels"&&(filtrees.length===0
    ? <div style={{textAlign:"center",padding:"40px 20px",color:"#9CA3AF"}}>
        <p style={{fontSize:40,marginBottom:12}}>🧾</p>
        <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,fontWeight:600,color:"#374151"}}>Aucune facture</p>
        <button onClick={()=>{setForm({...emptyF,id:null});setModal("form");}} style={{marginTop:16,background:"#F2C94C",border:"none",borderRadius:12,padding:"12px 24px",fontWeight:700,fontSize:14,cursor:"pointer"}}>
          + Créer une facture
        </button>
      </div>
    : filtrees.map(f=>{
        const pv=st.partenaires.find(p=>p.id===f.partenaireId);
        const total=calcTotalNet(f,st.produits);
        const retard=getInfosRetard(f);
        const pr=getProchainRappel(f);
        const rappelsEnvoyes=f.rappels||[];
        return (
          <Card key={f.id} style={{marginBottom:10,borderLeft:retard?"3px solid #EF4444":f.statut==="payée"?"3px solid #22C55E":"3px solid #F2C94C"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}} onClick={()=>setView(f)}>
              <div style={{cursor:"pointer"}}>
                <p style={{fontWeight:700,fontSize:13}}>{f.numero}</p>
                <p style={{fontSize:12,color:"#6B7280",marginTop:1}}>{pv?.nom}</p>
                <p style={{fontSize:11,color:"#9CA3AF",marginTop:1}}>{fmt(f.date)}</p>
              </div>
              <div style={{textAlign:"right"}}>
                <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,fontWeight:700,color:retard?"#DC2626":f.statut==="payée"?"#166534":"#111"}}>
                  CHF {total.toFixed(2)}
                </p>
                <div style={{marginTop:4,display:"flex",gap:4,justifyContent:"flex-end",flexWrap:"wrap"}}>
                  <Badge c={f.statut==="payée"?"green":retard?"red":"yellow"}>
                    {f.statut==="payée"?"Payée":retard?`Retard ${retard.jours}j`:"En attente"}
                  </Badge>
                  {rappelsEnvoyes.length>0&&<Badge c="red">R{rappelsEnvoyes[rappelsEnvoyes.length-1].degree} envoyé</Badge>}
                </div>
              </div>
            </div>
            {/* Alerte rappel disponible sur la carte */}
            {pr?.available&&f.statut!=="payée"&&(
              <div style={{background:pr.degree===1?"#FEF3C7":pr.degree===2?"#FFEDD5":"#FEE2E2",borderRadius:8,padding:"5px 10px",marginBottom:6,fontSize:11,fontWeight:600,color:pr.degree===1?"#92400E":pr.degree===2?"#9A3412":"#991B1B"}}>
                {pr.degree===1?"🔔":pr.degree===2?"⚠️":"🚨"} Rappel {pr.degree} disponible{pr.frais>0?" · +CHF "+pr.frais:" · sans frais"}
              </div>
            )}
            <div style={{display:"flex",gap:6}}>
              <button onClick={()=>setView(f)} style={{flex:1,background:"#F5F5F0",border:"none",borderRadius:8,padding:"7px",fontSize:12,fontWeight:500,cursor:"pointer"}}>👁 Voir</button>
              {f.statut!=="payée"&&<button onClick={()=>marquerPayee(f.id)} style={{flex:1,background:"#DCFCE7",border:"none",borderRadius:8,padding:"7px",fontSize:12,fontWeight:600,color:"#166534",cursor:"pointer"}}>✅ Payée</button>}
              {pr?.available&&f.statut!=="payée"
                ? <button onClick={()=>genererRappelPDF(f)} style={{flex:1,background:pr.degree===1?"#FEF3C7":pr.degree===2?"#FFEDD5":"#FEE2E2",border:"none",borderRadius:8,padding:"7px",fontSize:12,fontWeight:700,color:pr.degree===1?"#92400E":pr.degree===2?"#9A3412":"#991B1B",cursor:"pointer"}}>
                    {pr.degree===1?"🔔":pr.degree===2?"⚠️":"🚨"} Rappel {pr.degree}
                  </button>
                : <button onClick={()=>envoyerEmail(f,null)} style={{flex:1,background:"#FEF9E7",border:"none",borderRadius:8,padding:"7px",fontSize:12,fontWeight:600,color:"#92400E",cursor:"pointer"}}>✉️ Email</button>
              }
              <button onClick={()=>{if(window.confirm("Supprimer ?"))del(f.id);}} style={{background:"#FEE2E2",border:"none",borderRadius:8,padding:"7px 10px",cursor:"pointer",display:"flex"}}><Ic n="trash" s={14}/></button>
            </div>
          </Card>
        );
      })
  )}

  {/* Modal nouvelle facture */}
  {modal==="form"&&(
    <Modal title={form.id?"Modifier facture":"Nouvelle facture"} onClose={()=>setModal(null)}>
      <div style={{display:"grid",gap:14}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <div>
            <label style={{fontSize:11,fontWeight:600,color:"#9CA3AF",textTransform:"uppercase",letterSpacing:".06em",display:"block",marginBottom:6}}>Client *</label>
            <select value={form.partenaireId} onChange={e=>setForm(p=>({...p,partenaireId:e.target.value}))} required
              style={{width:"100%",padding:"11px 10px",fontSize:14,border:"1.5px solid #E5E5E0",borderRadius:10,background:"#fff",color:"#111",outline:"none"}}>
              <option value="">- Client -</option>
              {st.partenaires.length>0&&<optgroup label="🏪 Dépôts-vente">{st.partenaires.map(p=><option key={p.id} value={p.id}>{p.nom}</option>)}</optgroup>}
              {(st.clients||[]).filter(c=>c.categorie==="partenaire").length>0&&<optgroup label="🤝 Partenaires">{(st.clients||[]).filter(c=>c.categorie==="partenaire").map(c=><option key={c.id} value={c.id}>{c.nom}</option>)}</optgroup>}
              {(st.clients||[]).filter(c=>c.categorie!=="partenaire").length>0&&<optgroup label="👤 Clients">{(st.clients||[]).filter(c=>c.categorie!=="partenaire").map(c=><option key={c.id} value={c.id}>{c.nom}</option>)}</optgroup>}
            </select>
          </div>
          <Sel label="Prix" value={form.typeClient} onChange={v=>setForm(p=>({...p,typeClient:v}))}
            options={[{v:"revendeur",l:"Prix pro"},{v:"client",l:"Prix public"}]}/>
        </div>
        <F label="Date" type="date" value={form.date} onChange={v=>setForm(p=>({...p,date:v}))}/>
        <div>
          <label style={{fontSize:11,fontWeight:600,color:"#9CA3AF",textTransform:"uppercase",letterSpacing:".06em",display:"block",marginBottom:8}}>Produits</label>
          {(form.lignes||[]).map((l,i)=>(
            <div key={i} style={{display:"grid",gridTemplateColumns:"1fr 60px auto",gap:8,marginBottom:8,alignItems:"flex-end"}}>
              <Sel label="" value={l.produitId} onChange={v=>updLigne(i,"produitId",v)}
                options={[{v:"",l:"- Produit -"},...st.produits.filter(p=>p.actif).map(p=>({v:p.id,l:`${p.nom} ${p.variante} ${p.format}`}))]}/>
              <input type="number" value={l.qte} min={1} onChange={e=>updLigne(i,"qte",+e.target.value)}
                style={{padding:"11px 8px",fontSize:16,border:"1.5px solid #E5E5E0",borderRadius:10,textAlign:"center",width:60}}/>
              <button onClick={()=>setForm(p=>({...p,lignes:p.lignes.filter((_,j)=>j!==i)}))} style={{background:"#FEE2E2",border:"none",borderRadius:8,padding:"10px 8px",cursor:"pointer",display:"flex"}}>
                <Ic n="trash" s={13}/>
              </button>
            </div>
          ))}
          <button onClick={addLigne} style={{background:"none",border:"1.5px dashed #E5E5E0",borderRadius:10,padding:"8px",width:"100%",color:"#9CA3AF",fontSize:13,cursor:"pointer",marginTop:2}}>
            + Ajouter un produit
          </button>
        </div>

        {/* Bouteilles offertes */}
        <div>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
            <span style={{fontSize:11,fontWeight:600,color:"#16A34A",textTransform:"uppercase",letterSpacing:".06em"}}>🎁 Bouteilles offertes</span>
            <span style={{fontSize:10,color:"#9CA3AF"}}>(n'affecte pas le total)</span>
          </div>
          {(form.lignesOffertes||[]).map((l,i)=>(
            <div key={i} style={{background:"#F0FDF4",border:"1px solid #BBF7D0",borderRadius:10,padding:"10px",marginBottom:8}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 50px auto",gap:8,marginBottom:6,alignItems:"flex-end"}}>
                <Sel label="" value={l.produitId} onChange={v=>updLigneOfferte(i,"produitId",v)}
                  options={[{v:"",l:"- Produit -"},...st.produits.filter(p=>p.actif).map(p=>({v:p.id,l:`${p.nom} ${p.variante} ${p.format}`}))]}/>
                <input type="number" value={l.qte} min={1} onChange={e=>updLigneOfferte(i,"qte",+e.target.value)}
                  style={{padding:"11px 8px",fontSize:16,border:"1.5px solid #BBF7D0",borderRadius:10,textAlign:"center",width:50,background:"#fff"}}/>
                <button onClick={()=>delLigneOfferte(i)} style={{background:"#FEE2E2",border:"none",borderRadius:8,padding:"10px 8px",cursor:"pointer",display:"flex"}}>
                  <Ic n="trash" s={13}/>
                </button>
              </div>
              <input value={l.texte||""} onChange={e=>updLigneOfferte(i,"texte",e.target.value)}
                placeholder="Texte à faire figurer sur la facture…"
                style={{width:"100%",padding:"8px 10px",fontSize:13,border:"1.5px solid #BBF7D0",borderRadius:8,background:"#fff",boxSizing:"border-box",color:"#374151"}}/>
            </div>
          ))}
          <button onClick={addLigneOfferte} style={{background:"none",border:"1.5px dashed #BBF7D0",borderRadius:10,padding:"8px",width:"100%",color:"#16A34A",fontSize:13,cursor:"pointer"}}>
            + Ajouter une bouteille offerte
          </button>
          {(form.lignesOffertes||[]).some(l=>l.produitId)&&(
            <div style={{marginTop:10,background:"#F0FDF4",border:"1px solid #BBF7D0",borderRadius:10,padding:"10px 12px"}}>
              <label style={{fontSize:11,fontWeight:600,color:"#166534",textTransform:"uppercase",letterSpacing:".05em",display:"block",marginBottom:6}}>Traitement comptable des bouteilles offertes</label>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                {[
                  {v:"3900",l:"🏷 Rabais accordé",desc:"Réduit le CA"},
                  {v:"6610",l:"🍾 Marketing / dégustation",desc:"Charge promo"},
                ].map(opt=>(
                  <button key={opt.v} onClick={()=>setForm(p=>({...p,comptOffert:opt.v}))}
                    style={{background:(form.comptOffert||"3900")===opt.v?"#166534":"#fff",color:(form.comptOffert||"3900")===opt.v?"#fff":"#374151",border:"1.5px solid "+((form.comptOffert||"3900")===opt.v?"#166534":"#D1FAE5"),borderRadius:8,padding:"8px 10px",cursor:"pointer",textAlign:"left"}}>
                    <p style={{fontSize:12,fontWeight:700,margin:0}}>{opt.l}</p>
                    <p style={{fontSize:10,opacity:.75,margin:0,marginTop:2}}>{opt.desc} · {opt.v}</p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Total preview */}
        {(form.lignes||[]).some(l=>l.produitId)&&(
          <div style={{background:"#FEF9E7",border:"1px solid #F2C94C",borderRadius:10,padding:"10px 14px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span style={{fontSize:13,fontWeight:600}}>Total facture</span>
            <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,fontWeight:700,color:"#D4A017"}}>
              CHF {calcTotal(form.lignes,form.typeClient,st.produits).toFixed(2)}
            </span>
          </div>
        )}
        <F label="Notes" value={form.notes||""} onChange={v=>setForm(p=>({...p,notes:v}))} placeholder="Informations complémentaires..."/>
      </div>
      <div style={{display:"flex",gap:10,marginTop:20}}>
        <Btn onClick={save} full icon="check">Créer la facture</Btn>
        <Btn onClick={()=>setModal(null)} variant="ghost" full>Annuler</Btn>
      </div>
    </Modal>
  )}

  {/* Modal Regrouper Factures */}
  {modalRegroup && (
    <Modal title="Regrouper des factures en une" onClose={()=>{setModalRegroup(false);setSelectedForRegroup([]);}}>
      <p style={{fontSize:12,color:"#737373",marginBottom:12}}>Sélectionne les factures d'un même partenaire à regrouper en une seule facture mensuelle.</p>
      
      {(() => {
        const facturesEnAttente = (st.factures||[]).filter(f=>f.statut==="en attente");
        // Grouper par partenaire
        const parPartenaire = {};
        facturesEnAttente.forEach(f=>{
          if(!parPartenaire[f.partenaireId]) parPartenaire[f.partenaireId] = [];
          parPartenaire[f.partenaireId].push(f);
        });
        
        if(facturesEnAttente.length === 0) {
          return <p style={{fontSize:12,color:"#737373",textAlign:"center",padding:"20px"}}>Aucune facture en attente</p>;
        }
        
        // Identifier le partenaire déjà sélectionné
        const selectedPartenaire = selectedForRegroup.length > 0 
          ? (st.factures||[]).find(f=>f.id===selectedForRegroup[0])?.partenaireId 
          : null;
        
        return Object.entries(parPartenaire).map(([pvId, facs])=>{
          const pv = st.partenaires.find(p=>p.id===pvId);
          const disabled = selectedPartenaire && selectedPartenaire !== pvId;
          return (
            <div key={pvId} style={{marginBottom:14,opacity:disabled?0.4:1}}>
              <p style={{fontSize:11,fontWeight:600,color:"#737373",textTransform:"uppercase",marginBottom:6}}>{pv?.nom||"-"}</p>
              {facs.map(f=>{
                const total = calcTotalNet(f,st.produits);
                const checked = selectedForRegroup.includes(f.id);
                return (
                  <label key={f.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",background:checked?"#FDF6E3":"#F4F4F2",border:"1px solid "+(checked?"#FCD34D":"#EAE7E0"),borderRadius:8,marginBottom:5,cursor:disabled?"not-allowed":"pointer"}}>
                    <input type="checkbox" checked={checked} disabled={disabled} onChange={e=>{
                      if(e.target.checked) {
                        setSelectedForRegroup(prev=>[...prev, f.id]);
                      } else {
                        setSelectedForRegroup(prev=>prev.filter(id=>id!==f.id));
                      }
                    }} style={{width:16,height:16}}/>
                    <div style={{flex:1}}>
                      <p style={{fontSize:12,fontWeight:600}}>{f.numero}</p>
                      <p style={{fontSize:10,color:"#737373",marginTop:1}}>{fmt(f.date)} · {(f.lignes||[]).filter(l=>l.produitId).length} produit(s)</p>
                    </div>
                    <span style={{fontSize:13,fontWeight:700}}>{chf(total)}</span>
                  </label>
                );
              })}
            </div>
          );
        });
      })()}
      
      {selectedForRegroup.length > 0 && (() => {
        const facs = selectedForRegroup.map(id=>(st.factures||[]).find(f=>f.id===id)).filter(Boolean);
        const totalCombine = sum(facs.map(f=>calcTotalNet(f,st.produits)));
        return (
          <div style={{background:"#0A0A0A",color:"#fff",borderRadius:10,padding:"12px",marginTop:12}}>
            <p style={{fontSize:11,color:"#E8B64C",fontWeight:600,textTransform:"uppercase"}}>Récapitulatif</p>
            <div style={{display:"flex",justifyContent:"space-between",marginTop:6}}>
              <span style={{fontSize:12}}>{selectedForRegroup.length} factures sélectionnées</span>
              <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,fontWeight:700,color:"#E8B64C"}}>{chf(totalCombine)}</span>
            </div>
          </div>
        );
      })()}
      
      <div style={{display:"flex",gap:10,marginTop:20}}>
        <Btn onClick={regrouperFactures} full icon="check">Regrouper ({selectedForRegroup.length})</Btn>
        <Btn onClick={()=>{setModalRegroup(false);setSelectedForRegroup([]);}} variant="ghost" full>Annuler</Btn>
      </div>
    </Modal>
  )}
</div>

);
};

