import { useState, useCallback, useRef, useEffect } from "react";
import * as React from "react";
import { uid, chf, fmt, today, sum, genLot, exportCSV } from "../src/utils";
import { SOCIETE, CGV, INIT } from "../src/constants";
import { LOGO_B64, pdfLogo, IMG_LIMONTA_50CL, IMG_CLEMENTINO_50CL, IMG_LIMELO_50CL, IMG_LIMONTA_25CL, IMG_LIMELO_25CL, IMG_CLEMENTINO_25CL, IMG_COFFRET } from "../src/images";
import { Ic, Badge, Modal, F, Sel, Btn, Card, SectionTitle, getProchainRappelFn } from "../src/ui";
import { getImg, COULEURS, calcTotal, calcTotalNet } from "../src/helpers";

const STYLE = `@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=Inter:wght@300;400;500;600;700&display=swap'); *{box-sizing:border-box;margin:0;padding:0;} @media (min-width: 1024px) { body, html, #root { background: #FAFAF7 !important; } .fade { max-width: 100% !important; } } :root{ --ink:#0A0A0A; --cream:#FAFAF7; --lemon:#E8B64C; --lemon2:#BC8F1C; --lemon-pale:#FDF6E3; --white:#FFFFFF; --gray:#737373; --gray-light:#F4F4F2; --gray-mid:#E7E5E0; --green:#15803D; --green-bg:#F0FDF4; --red:#B91C1C; --red-bg:#FEF2F2; --orange:#9A3412; --blue:#1E40AF; --blue-bg:#EFF6FF; --border:#EAE7E0; --shadow:0 1px 3px rgba(10,10,10,.04); --shadow-lg:0 4px 24px rgba(10,10,10,.08); --r:12px; --r-sm:8px; } html,body,#root{font-family:'Inter',system-ui,-apple-system,sans-serif;background:#FAFAF7 !important;color:#0A0A0A;min-height:100vh;-webkit-text-size-adjust:100%;overflow-x:hidden;max-width:100vw;letter-spacing:-0.011em;font-feature-settings:"cv11";} h1,h2,h3{font-family:'Cormorant Garamond',serif;letter-spacing:-0.02em;} p{letter-spacing:-0.006em;} input,select,textarea{font-family:'Inter',sans-serif;font-size:16px;border:1px solid #EAE7E0;border-radius:10px;padding:11px 14px;width:100%;background:#fff;color:#0A0A0A;outline:none;transition:all .15s;-webkit-appearance:none;letter-spacing:-0.006em;} input:focus,select:focus,textarea:focus{border-color:#0A0A0A;box-shadow:0 0 0 3px rgba(10,10,10,.08);} select{background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23737373' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 14px center;padding-right:36px;} button{cursor:pointer;font-family:'Inter',sans-serif;-webkit-tap-highlight-color:transparent;letter-spacing:-0.006em;transition:all .15s;} button:active{transform:scale(0.98);} *{max-width:100%;word-break:break-word;} ::-webkit-scrollbar{width:0;height:0;} .fade{animation:fadeUp .24s cubic-bezier(.16,1,.3,1) both;} @keyframes fadeUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}} @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`;


// ══════════════════════════════════════════════════════════════
// PAGE: TABLEAU DE BORD
// ══════════════════════════════════════════════════════════════
const Dashboard = ({st, setSt, setTab, authUser, sendEmail}) => {
const now = new Date();
const today_str = today();

// === CALCULS FINANCIERS ===
const recettes = sum((st.transactions||[]).filter(t=>t.type==="recette").map(t=>+t.montant));
const depenses = sum((st.transactions||[]).filter(t=>t.type==="depense").map(t=>+t.montant));
const resultat = recettes - depenses;
const soldeBancaire = parseFloat(st.soldeBancaire||0);

// Factures en attente
const facturesAttente = (st.factures||[]).filter(f=>f.statut==="en attente");
const caAttente = sum(facturesAttente.map(f=>{
return sum((f.lignes||[]).map(l=>{
const prod = st.produits.find(pr=>pr.id===l.produitId);
return ((f.typeClient==="revendeur"?prod?.prixRevendeur:prod?.prixClient)||0)*(l.qte||0);
}));
}));

// === ALERTES ===
const alertes = [];

// Factures échues — rappels intelligents
(st.factures||[]).filter(f=>f.statut!=="payée").forEach(f=>{
const pr = getProchainRappelFn(f);
if(!pr) return;
const pv = st.partenaires.find(p=>p.id===f.partenaireId);
const rappels = f.rappels||[];
const echeance = new Date(new Date(f.date).getTime()+30*86400000);
const joursRetard = Math.floor((now-echeance)/86400000);
if(pr.available) {
  alertes.push({
    type:"facture",
    priorite: pr.degree>=3?"haute": pr.degree>=2?"haute":"moyenne",
    icone: pr.degree===1?"🔔": pr.degree===2?"⚠️":"🚨",
    titre:"Rappel "+pr.degree+" disponible — "+f.numero,
    desc:(pv?.nom||"")+" · CHF "+(rappels.length>0?(parseFloat(f.total||0)+pr.frais).toFixed(2):parseFloat(f.total||0).toFixed(2))+(pr.frais>0?" (+ CHF "+pr.frais+" frais)":"")+" · "+joursRetard+"j de retard",
    action:"factures",
    id: f.id,
  });
} else if(pr.degree && pr.daysLeft>0) {
  alertes.push({
    type:"facture",
    priorite:"basse",
    icone:"⏳",
    titre:"Rappel "+pr.degree+" dans "+pr.daysLeft+"j — "+f.numero,
    desc:(pv?.nom||"")+" · Rappel "+(pr.degree-1)+" envoyé le "+fmt((rappels[rappels.length-1]||{}).date||""),
    action:"factures",
    id: f.id,
  });
}
});

// Offres qui expirent
(st.contrats||[]).filter(c=>c.type==="offre" && c.statut!=="signé" && c.statut!=="accepté").forEach(c=>{
const validite = parseInt(c.validiteOffre||30);
const dateExp = new Date(c.dateDebut);
dateExp.setDate(dateExp.getDate()+validite);
const joursRestants = Math.floor((dateExp - now)/86400000);
if(joursRestants <= 7 && joursRestants >= 0) {
alertes.push({
type: "offre",
priorite: joursRestants <= 3 ? "haute" : "moyenne",
icone: "⏳",
titre: "Offre "+c.numero+" expire dans "+joursRestants+"j",
desc: "Partenaire : "+(st.partenaires.find(p=>p.id===c.partenaireId)?.nom||""),
action: "contrats",
});
} else if(joursRestants < 0) {
alertes.push({
type: "offre",
priorite: "basse",
icone: "⚠️",
titre: "Offre "+c.numero+" expirée",
desc: "Expirée depuis "+Math.abs(joursRestants)+" jours",
action: "contrats",
});
}
});

// Offres à relancer (envoyées il y a 7j+ sans réponse, ou relancées il y a 7j+)
(st.offres||[]).filter(o=>
  o.statut==="envoyée" &&
  o.date
).forEach(o=>{
const dateRef = o.dateRelance || o.date;
const joursDepuis = Math.floor((now - new Date(dateRef))/86400000);
if(joursDepuis >= 7) {
  const descBase = o.dateRelance
    ? (o.clientNom||"Client inconnu")+" · Relancé le "+fmt(o.dateRelance)
    : (o.clientNom||"Client inconnu")+" · Envoyée le "+fmt(o.date);
  alertes.push({
    type:"offre_relance",
    priorite: joursDepuis >= 14 ? "haute" : "moyenne",
    icone: joursDepuis >= 14 ? "📣" : "🔁",
    titre:"Relancer — Offre "+o.numero+" sans réponse depuis "+joursDepuis+"j",
    desc: descBase,
    action:"offres",
    id: o.id,
  });
}
});


// Stock bas chez partenaires
const stocksBas = {};
(st.depotStocks||[]).filter(ds=>{
const restant = (ds.qteDeposee||0)-(ds.qteVendue||0)-(ds.qteRetournee||0);
return restant <= 2 && restant > 0;
}).forEach(ds=>{
const key = ds.partenaireId;
if(!stocksBas[key]) stocksBas[key] = [];
stocksBas[key].push(ds);
});
Object.entries(stocksBas).forEach(([pvId, items])=>{
const pv = st.partenaires.find(p=>p.id===pvId);
alertes.push({
type: "stock",
priorite: "moyenne",
icone: "📦",
titre: "Stock bas chez "+(pv?.nom||""),
desc: items.length+" produit(s) ≤2 unités",
action: "partenaires",
});
});

// Stock propre bas (global)
(st.produits||[]).filter(p=>p.actif && !p.nom.includes("Coffret")).forEach(p=>{
const stockPropre = sum((st.stocks||[]).filter(s=>s.produitId===p.id).map(s=>s.qte));
if(stockPropre <= 3 && stockPropre > 0) {
alertes.push({
type: "production",
priorite: stockPropre <= 1 ? "haute" : "moyenne",
icone: "🔥",
titre: "Production : "+p.nom+" "+p.format,
desc: "Il ne reste que "+stockPropre+" unités en stock propre",
action: "stocks",
});
}
});

// Factures fournisseurs échues ou bientôt
(st.facturesFournisseurs||[]).filter(f=>f.statut==="à payer").forEach(f=>{
const ech = new Date(f.dateEcheance||f.date);
const jours = Math.floor((ech - now)/86400000);
if(jours < 0) {
alertes.push({
type: "fournisseur",
priorite: "haute",
icone: "💸",
titre: "Facture "+f.fournisseur+" en retard",
desc: chf(f.montant)+" · échéance "+fmt(f.dateEcheance||f.date),
action: "fournisseurs",
});
} else if(jours <= 7) {
alertes.push({
type: "fournisseur",
priorite: "moyenne",
icone: "📥",
titre: "Facture "+f.fournisseur+" à payer",
desc: chf(f.montant)+" · dans "+jours+"j",
action: "fournisseurs",
});
}
});

// Commandes livrées sans facture
const cmdSansFacture = (st.commandes||[]).filter(c=>!c.factureNumero && (c.statut==="livrée"||c.statut==="retirée"));
if(cmdSansFacture.length > 0) {
alertes.push({
type: "compta",
priorite: "moyenne",
icone: "🧾",
titre: cmdSansFacture.length+" commande(s) livrée(s) sans facture",
desc: "Générer les factures pour les passer en comptabilité",
action: "commandes",
});
}

// Factures à envoyer (créées mais pas encore envoyées)
(st.factures||[]).filter(f=>f.envoyee===false && f.statut!=="payée").forEach(f=>{
const pv2 = st.partenaires.find(p=>p.id===f.partenaireId);
const total = calcTotalNet(f,st.produits);
alertes.push({
  type:"facture_a_envoyer",
  priorite:"haute",
  icone:"📤",
  titre:"Facture à envoyer : "+f.numero,
  desc:(pv2?.nom||"Client inconnu")+" · CHF "+total.toFixed(2)+" · "+fmt(f.date),
  action:"partenaires",
  id:f.id,
});
});

// Trier par priorité
const ordre = {haute: 0, moyenne: 1, basse: 2};
alertes.sort((a,b)=>ordre[a.priorite]-ordre[b.priorite]);

// === TOP PRODUITS MOIS COURANT ===
const moisCourant = today_str.slice(0,7);
const ventesMois = {};
(st.transactions||[]).filter(t=>t.type==="recette" && t.date?.startsWith(moisCourant)).forEach(t=>{
const cat = t.categorie||"Autre";
ventesMois[cat] = (ventesMois[cat]||0)+(+t.montant);
});
const topProduits = Object.entries(ventesMois).filter(([k])=>k.startsWith("Vente")).sort((a,b)=>b[1]-a[1]).slice(0,3);
const caMois = sum(Object.values(ventesMois));

// === NOMBRE CLIENTS / COMMANDES DU MOIS ===
const cmdMois = (st.commandes||[]).filter(c=>c.date?.startsWith(moisCourant));
const nbCmdMois = cmdMois.length;

// === VALEUR STOCK TOTAL ===
const valeurStock = sum((st.produits||[]).map(p=>{
const stockPropre = sum((st.stocks||[]).filter(s=>s.produitId===p.id).map(s=>s.qte));
const stockDepot = sum((st.depotStocks||[]).filter(d=>d.produitId===p.id).map(d=>(d.qteDeposee||0)-(d.qteVendue||0)-(d.qteRetournee||0)));
return (stockPropre+stockDepot)*(p.coutRevient||0);
}));

// === SUGGESTIONS DE PRODUCTION ===
const prodActifsDash = (st.produits||[]).filter((p:any)=>
  !p.nom.includes("Coffret") && (
    (st.stocks||[]).some((s:any)=>s.produitId===p.id) ||
    (st.depotStocks||[]).some((d:any)=>d.produitId===p.id)
  )
);
const prodRecettesDash = (st.production?.recettes || []) as any[];

// Groupes de produits (par nom, sans tenir compte du format)
const nomGroupesDash:string[] = [];
prodActifsDash.forEach((p:any)=>{
  if(!nomGroupesDash.includes(p.nom)) nomGroupesDash.push(p.nom);
});

// Ventes hebdo moyennes sur 13 semaines (depuis transactions)
const treizeSemAgo = new Date(now.getTime() - 13*7*24*3600*1000).toISOString().slice(0,10);
const ventesQteParProdDash:{[id:string]:number} = {};
(st.transactions||[]).filter((t:any)=>t.type==="recette" && t.date>=treizeSemAgo).forEach((t:any)=>{
  prodActifsDash.forEach((p:any)=>{
    const nomL = p.nom.toLowerCase();
    const descL = (t.description||t.categorie||"").toLowerCase();
    if(descL.includes(nomL.split(" ")[0]) || nomL.includes(descL.split(" ")[0])) {
      const px = parseFloat(p.prixClient||p.prixRevendeur)||0;
      const qte = px>0 ? Math.round(parseFloat(t.montant)/px) : 0;
      if(qte>0) ventesQteParProdDash[p.id] = (ventesQteParProdDash[p.id]||0)+qte;
    }
  });
});
const ventesHebdoDash = (id:string) => (ventesQteParProdDash[id]||0)/13;

const stockEffectifDash = (id:string) => {
  const propre = (st.stocks||[]).filter((s:any)=>s.produitId===id).reduce((a:number,s:any)=>a+(s.qte||0),0);
  const depot = (st.depotStocks||[]).filter((d:any)=>d.produitId===id).reduce((a:number,d:any)=>a+Math.max(0,(d.qteDeposee||0)-(d.qteVendue||0)-(d.qteRetournee||0)),0);
  return propre + depot;
};

const suggestionsProduction = nomGroupesDash.map((nom:string)=>{
  const nomL = nom.toLowerCase();
  const prods = prodActifsDash.filter((p:any)=>p.nom===nom);
  const p25 = prods.find((p:any)=>p.format?.includes("25")||p.format?.includes("250"));
  const p50 = prods.find((p:any)=>p.format?.includes("50")||p.format?.includes("500")) || (p25?undefined:prods[0]);
  const recette = prodRecettesDash.find((r:any)=>r.nom.toLowerCase()===nomL||nomL.includes(r.nom.toLowerCase())||r.nom.toLowerCase().includes(nomL));
  const couleur = recette?.couleur || "#F2C94C";
  const stock25 = p25 ? stockEffectifDash(p25.id) : 0;
  const stock50 = p50 ? stockEffectifDash(p50.id) : 0;
  const totalStock = stock25 + stock50;
  const hebdo25 = p25 ? ventesHebdoDash(p25.id) : 0;
  const hebdo50 = p50 ? ventesHebdoDash(p50.id) : 0;
  const hebdoTotal = hebdo25 + hebdo50;
  const cibleStock = Math.max(10, Math.ceil(hebdoTotal * 8 * 1.2));
  const niveau = totalStock < 10 ? "rouge" : totalStock < cibleStock ? "orange" : "vert";
  const manque = Math.max(0, cibleStock - totalStock);
  const rendement = recette?.rendementBouteilles || 5;
  const litresNecessaires = manque > 0 ? Math.ceil(manque / rendement) : 0;
  return {nom, couleur, totalStock, cibleStock, hebdoTotal, niveau, manque, litresNecessaires, dureeMac: recette?.dureeMacerationJours||30};
}).filter((s:any)=>s.niveau!=="vert");

const goPage = (p:string) => {
if(setTab) setTab(p);
};

return (
<div className="fade">
{/* HEADER ÉLÉGANT */}
<div style={{marginBottom:20}}>
<p style={{fontSize:11,color:"#737373",fontWeight:500,letterSpacing:"-0.005em"}}>
{new Date().toLocaleDateString("fr-CH",{weekday:"long",day:"numeric",month:"long"})}
</p>
<h1 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,fontWeight:600,letterSpacing:"-0.025em",marginTop:2}}>
Bonjour {authUser.display_name||authUser.username}
</h1>
</div>

  {/* ALERTES EN HAUT - prioritaires */}
  {alertes.length > 0 && (
    <div style={{marginBottom:18}}>
      <p style={{fontSize:10,fontWeight:600,color:"#737373",textTransform:"uppercase",letterSpacing:"0.04em",marginBottom:10}}>
        À faire ({alertes.length})
      </p>
      {alertes.slice(0,5).map((a,i)=>{
        const bg = a.priorite==="haute"?"#FEF2F2":a.priorite==="moyenne"?"#FDF6E3":"#F4F4F2";
        const border = a.priorite==="haute"?"#FECACA":a.priorite==="moyenne"?"#FCD34D":"#EAE7E0";
        const isRelance = a.type==="offre_relance";
        return (
          <div key={i} style={{background:bg,border:"1px solid "+border,borderRadius:10,padding:"10px 12px",marginBottom:6}}>
            <div onClick={()=>goPage(a.action)} style={{cursor:"pointer",display:"flex",alignItems:"center",gap:10}}>
              <span style={{fontSize:18,flexShrink:0}}>{a.icone}</span>
              <div style={{flex:1,minWidth:0}}>
                <p style={{fontSize:12,fontWeight:600,color:"#0A0A0A"}}>{a.titre}</p>
                <p style={{fontSize:10,color:"#737373",marginTop:2}}>{a.desc}</p>
              </div>
              {!isRelance && <span style={{color:"#737373",fontSize:16,flexShrink:0}}>›</span>}
            </div>
            {isRelance && (
              <div style={{marginTop:8,display:"flex",gap:6}}>
                <button
                  onClick={(e)=>{
                    e.stopPropagation();
                    const o = (st.offres||[]).find(x=>x.id===a.id);
                    if(!o){alert("Offre introuvable");return;}
                    const email = o.clientEmail;
                    if(!email){alert("Aucun email pour ce client");return;}
                    const contact = o.clientNom||"";
                    const dateEnvoi = new Date(o.date).toLocaleDateString("fr-CH",{day:"numeric",month:"long",year:"numeric"});
                    const expStr = o.dateValidite ? new Date(o.dateValidite).toLocaleDateString("fr-CH",{day:"numeric",month:"long",year:"numeric"}) : "date à confirmer";
                    const subj = "Relance — Offre "+o.numero+" - Goûtstoso";
                    const body =
                      "Bonjour "+contact+",\n\n"+
                      "Je me permets de revenir vers vous au sujet de notre offre commerciale N° "+o.numero+" que nous vous avons transmise le "+dateEnvoi+".\n\n"+
                      "Cette offre reste valable jusqu'au "+expStr+". Avez-vous eu l'occasion d'en prendre connaissance ? Nous sommes bien entendu disponibles pour répondre à toutes vos questions.\n\n"+
                      "N'hésitez pas à nous faire part de votre retour.\n\n"+
                      "Cordialement,\n\nJordan Montanaro\nGoûtstoso\nadmin@goutstoso.ch · www.goutstoso.ch";
                    sendEmail({to:email, toName:contact, subject:subj, body});
                    setSt(p=>({...p, offres:(p.offres||[]).map(x=>x.id===a.id?{...x,dateRelance:today()}:x)}));
                  }}
                  style={{flex:1,background:"#92400E",color:"#FEF9C3",border:"none",borderRadius:8,padding:"7px 10px",fontSize:11,fontWeight:700,cursor:"pointer"}}>
                  ✉️ Envoyer la relance
                </button>
                <button
                  onClick={(e)=>{
                    e.stopPropagation();
                    setSt(p=>({...p, offres:(p.offres||[]).map(x=>x.id===a.id?{...x,dateRelance:today()}:x)}));
                  }}
                  style={{background:"#D1FAE5",color:"#065F46",border:"1px solid #6EE7B7",borderRadius:8,padding:"7px 10px",fontSize:11,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap"}}>
                  ✅ Relancée
                </button>
              </div>
            )}
          </div>
        );
      })}
      {alertes.length > 5 && (
        <p style={{fontSize:11,color:"#737373",textAlign:"center",marginTop:4}}>
          +{alertes.length-5} autre(s) alerte(s)
        </p>
      )}
    </div>
  )}
  
  {alertes.length === 0 && (
    <div style={{background:"#F0FDF4",border:"1px solid #BBF7D0",borderRadius:10,padding:"14px",marginBottom:18,textAlign:"center"}}>
      <p style={{fontSize:24,marginBottom:6}}>✨</p>
      <p style={{fontSize:13,fontWeight:600,color:"#15803D"}}>Tout est à jour !</p>
      <p style={{fontSize:11,color:"#15803D",opacity:.8,marginTop:2}}>Aucune action en attente</p>
    </div>
  )}
  
  {/* SUGGESTIONS DE PRODUCTION */}
  {suggestionsProduction.length > 0 && (
    <div style={{marginBottom:18}}>
      <p style={{fontSize:10,fontWeight:600,color:"#737373",textTransform:"uppercase",letterSpacing:"0.04em",marginBottom:10}}>
        ⚡ Production à lancer ({suggestionsProduction.length})
      </p>
      {suggestionsProduction.map((s:any,i:number)=>{
        const isRouge = s.niveau==="rouge";
        const bg = isRouge ? "#FEF2F2" : "#FFF9EC";
        const border = isRouge ? "#FECACA" : "#FCD34D";
        const textColor = isRouge ? "#991B1B" : "#92400E";
        const icone = isRouge ? "🔴" : "🟡";
        return (
          <div key={i} onClick={()=>goPage("production")} style={{background:bg,border:"1px solid "+border,borderRadius:10,padding:"10px 12px",marginBottom:6,cursor:"pointer"}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
              <div style={{width:10,height:10,borderRadius:"50%",background:s.couleur,flexShrink:0}}/>
              <p style={{fontSize:13,fontWeight:700,color:"#0A0A0A",flex:1}}>{s.nom}</p>
              <span style={{fontSize:12}}>{icone}</span>
            </div>
            <p style={{fontSize:11,color:textColor,fontWeight:600,marginBottom:2}}>
              {isRouge ? "🚨 Stock critique" : "⚠️ Stock à renouveler"} — {s.totalStock} btl restantes
            </p>
            <p style={{fontSize:11,color:textColor}}>
              → Lancer <strong>{s.litresNecessaires}L d'alcool</strong> ({s.dureeMac}j de macération) pour atteindre {s.cibleStock} btl
            </p>
            {s.hebdoTotal > 0 && (
              <p style={{fontSize:10,color:"#9CA3AF",marginTop:2}}>Vitesse de vente : ~{s.hebdoTotal.toFixed(1)} btl/sem.</p>
            )}
          </div>
        );
      })}
    </div>
  )}

  {/* SITUATION FINANCIÈRE */}
  <div style={{background:"#0A0A0A",borderRadius:14,padding:"16px",marginBottom:14,color:"#fff"}}>
    <p style={{fontSize:10,color:"#E8B64C",fontWeight:600,textTransform:"uppercase",letterSpacing:"0.04em",marginBottom:4}}>Situation financière</p>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginTop:10}}>
      <div>
        <p style={{fontSize:10,color:"#A3A3A3"}}>Solde PostFinance</p>
        <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,fontWeight:700,color:"#fff",marginTop:2}}>{chf(soldeBancaire)}</p>
      </div>
      <div>
        <p style={{fontSize:10,color:"#A3A3A3"}}>À encaisser</p>
        <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,fontWeight:700,color:"#E8B64C",marginTop:2}}>{chf(caAttente)}</p>
        <p style={{fontSize:9,color:"#A3A3A3",marginTop:1}}>{facturesAttente.length} facture(s)</p>
      </div>
    </div>
    <div style={{marginTop:12,paddingTop:10,borderTop:"1px solid #333",display:"flex",justifyContent:"space-between",alignItems:"baseline"}}>
      <div>
        <p style={{fontSize:10,color:"#A3A3A3"}}>Résultat cumulé</p>
        <p style={{fontSize:14,fontWeight:700,color:resultat>=0?"#86EFAC":"#FCA5A5",marginTop:2}}>{resultat>=0?"+":""}{chf(resultat)}</p>
      </div>
      <div style={{textAlign:"right"}}>
        <p style={{fontSize:10,color:"#A3A3A3"}}>Valeur stock</p>
        <p style={{fontSize:14,fontWeight:700,color:"#fff",marginTop:2}}>{chf(valeurStock)}</p>
      </div>
    </div>
  </div>
  
  {/* MOIS COURANT */}
  <Card style={{marginBottom:14}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:10}}>
      <p style={{fontSize:11,fontWeight:600,color:"#737373",textTransform:"uppercase",letterSpacing:"0.04em"}}>
        Ce mois-ci
      </p>
      <p style={{fontSize:11,color:"#737373"}}>
        {new Date().toLocaleDateString("fr-CH",{month:"long",year:"numeric"})}
      </p>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
      <div style={{background:"#F4F4F2",borderRadius:8,padding:"10px 12px"}}>
        <p style={{fontSize:10,color:"#737373",fontWeight:500}}>Chiffre d'affaires</p>
        <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:17,fontWeight:700,marginTop:2}}>{chf(caMois)}</p>
      </div>
      <div style={{background:"#F4F4F2",borderRadius:8,padding:"10px 12px"}}>
        <p style={{fontSize:10,color:"#737373",fontWeight:500}}>Commandes web</p>
        <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:17,fontWeight:700,marginTop:2}}>{nbCmdMois}</p>
      </div>
    </div>
    {topProduits.length > 0 && (
      <div>
        <p style={{fontSize:10,color:"#737373",fontWeight:500,marginBottom:6}}>Top produits du mois</p>
        {topProduits.map(([cat, val])=>(
          <div key={cat} style={{display:"flex",justifyContent:"space-between",fontSize:11,padding:"4px 0"}}>
            <span style={{color:"#525252"}}>{cat.replace("Vente ","")}</span>
            <span style={{fontWeight:600}}>{chf(val)}</span>
          </div>
        ))}
      </div>
    )}
  </Card>
  
  {/* ACTIONS RAPIDES */}
  <Card style={{marginBottom:14}}>
    <p style={{fontSize:11,fontWeight:600,color:"#737373",textTransform:"uppercase",letterSpacing:"0.04em",marginBottom:10}}>
      Accès rapide
    </p>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
      <button onClick={()=>goPage("factures")} style={{background:"#F4F4F2",border:"none",borderRadius:8,padding:"10px",fontSize:12,fontWeight:500,cursor:"pointer",textAlign:"left"}}>
        📄 Nouvelle facture
      </button>
      <button onClick={()=>goPage("commandes")} style={{background:"#F4F4F2",border:"none",borderRadius:8,padding:"10px",fontSize:12,fontWeight:500,cursor:"pointer",textAlign:"left"}}>
        🛒 Nouvelle commande
      </button>
      <button onClick={()=>goPage("contrats")} style={{background:"#F4F4F2",border:"none",borderRadius:8,padding:"10px",fontSize:12,fontWeight:500,cursor:"pointer",textAlign:"left"}}>
        💼 Nouvelle offre
      </button>
      <button onClick={()=>goPage("compta")} style={{background:"#F4F4F2",border:"none",borderRadius:8,padding:"10px",fontSize:12,fontWeight:500,cursor:"pointer",textAlign:"left"}}>
        💰 Nouvelle écriture
      </button>
      <button onClick={()=>goPage("fournisseurs")} style={{background:"#F4F4F2",border:"none",borderRadius:8,padding:"10px",fontSize:12,fontWeight:500,cursor:"pointer",textAlign:"left",gridColumn:"1 / -1"}}>
        📥 Factures fournisseurs
      </button>
    </div>
  </Card>
</div>

);
};

// ══════════════════════════════════════════════════════════════
// PAGE: PRODUITS
// ══════════════════════════════════════════════════════════════

const Produits = ({st,setSt}) => {
const [modal,setModal] = useState(null);
const [selected,setSelected] = useState(null);
const empty = {nom:"",variante:"",format:"",description:"",alcool:"30% vol.",ingredients:"",prixClient:0,prixRevendeur:0,coutRevient:0,actif:true,
coutDetail:{bouteille:"",bouchon:"",etiquette:"",alcool:"",fruits:"",sucre:"",emballage:"",mainOeuvre:"",autres:""}};
const [form,setForm] = useState(empty);

const save = () => {
if(!form.nom) return;
// Calculate total cost from detail if provided
let totalCout = parseFloat(form.coutRevient)||0;
if(form.coutDetail) {
const detail = form.coutDetail;
const sumDetail = (parseFloat(detail.bouteille)||0)+(parseFloat(detail.bouchon)||0)+(parseFloat(detail.etiquette)||0)+(parseFloat(detail.alcool)||0)+(parseFloat(detail.fruits)||0)+(parseFloat(detail.sucre)||0)+(parseFloat(detail.emballage)||0)+(parseFloat(detail.mainOeuvre)||0)+(parseFloat(detail.autres)||0);
if(sumDetail>0) totalCout = sumDetail;
}
const cleaned = {...form, coutRevient: totalCout};
if(form.id) setSt(p=>({...p,produits:p.produits.map(x=>x.id===form.id?cleaned:x)}));
else setSt(p=>({...p,produits:[...p.produits,{...cleaned,id:uid()}]}));
setModal(null);
};
const del = id => setSt(p=>({...p,produits:p.produits.filter(x=>x.id!==id)}));

// Vue détail produit
if(selected) {
const p = selected;
const c = COULEURS[p.variante]||COULEURS["3 saveurs"];
const img = getImg(p);
const marge = p.prixClient - p.coutRevient;
const margePct = p.prixClient > 0 ? ((marge/p.prixClient)*100).toFixed(0) : 0;
return (
<div className="fade">
<button onClick={()=>setSelected(null)} style={{display:"flex",alignItems:"center",gap:6,background:"none",border:"none",color:"#9CA3AF",fontSize:13,fontWeight:500,marginBottom:16,padding:0,cursor:"pointer"}}>
← Retour au catalogue
</button>
<div style={{background:c.bg,borderRadius:20,overflow:"hidden",marginBottom:16}}>
{img && <div style={{display:"flex",justifyContent:"center",padding:"24px 0 0",background:c.light}}>
<img src={img} style={{height:220,objectFit:"contain"}}/>
</div>}
<div style={{padding:"20px 18px"}}>
<div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
<div>
<p style={{fontSize:11,fontWeight:700,color:c.accent,textTransform:"uppercase",letterSpacing:".1em"}}>{p.variante}</p>
<h2 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:32,fontWeight:700,lineHeight:1,color:"#111",marginTop:2}}>{p.nom}</h2>
<p style={{fontSize:13,color:"#6B7280",marginTop:2}}>{p.format} · {p.alcool}</p>
</div>
<Badge c={p.actif?"green":"gray"}>{p.actif?"Actif":"Inactif"}</Badge>
</div>
<p style={{fontSize:13,color:"#374151",lineHeight:1.7,marginTop:12}}>{p.description}</p>
{p.ingredients && <p style={{fontSize:11,color:"#9CA3AF",marginTop:8}}><strong>Ingrédients :</strong> {p.ingredients}</p>}
</div>
</div>

    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:16}}>
      {[
        {l:"Prix public",v:chf(p.prixClient),c:"#111",bg:"#fff"},
        {l:"Prix pro",v:chf(p.prixRevendeur),c:c.accent,bg:c.light},
        {l:"Marge",v:`${margePct}%`,c:"#166534",bg:"#DCFCE7"},
      ].map((k,i)=>(
        <div key={i} style={{background:k.bg,borderRadius:12,padding:"12px 10px",textAlign:"center",border:"1px solid #F0F0EE"}}>
          <p style={{fontSize:10,color:"#9CA3AF",fontWeight:600,textTransform:"uppercase",marginBottom:4}}>{k.l}</p>
          <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,fontWeight:700,color:k.c}}>{k.v}</p>
        </div>
      ))}
    </div>

    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
      <button onClick={()=>{setForm({...p,coutDetail:p.coutDetail||{bouteille:"",bouchon:"",etiquette:"",alcool:"",fruits:"",sucre:"",emballage:"",mainOeuvre:"",autres:""}});setModal("form");setSelected(null);}} style={{background:"#F5F5F0",border:"none",borderRadius:12,padding:"12px",fontWeight:600,fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
        <Ic n="edit" s={15}/> Modifier
      </button>
      <button onClick={()=>{del(p.id);setSelected(null);}} style={{background:"#FEE2E2",border:"none",borderRadius:12,padding:"12px",fontWeight:600,fontSize:13,color:"#991B1B",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
        <Ic n="trash" s={15}/> Supprimer
      </button>
    </div>
  </div>
);

}

return (
<div className="fade">
<SectionTitle action={<Btn icon="plus" onClick={()=>{setForm({...empty,id:null});setModal("form");}}>Nouveau</Btn>}>
Catalogue
</SectionTitle>

  {/* Grille produits */}
  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
    {st.produits.map(p=>{
      const c = COULEURS[p.variante]||COULEURS["3 saveurs"];
      const img = getImg(p);
      const qte = p.format.includes("×") ? 0 : sum((st.stocks||[]).filter(s=>s.produitId===p.id).map(s=>s.qte));
      return (
        <button key={p.id} onClick={()=>setSelected(p)} style={{background:"#fff",border:"none",borderRadius:16,overflow:"hidden",boxShadow:"0 2px 12px rgba(0,0,0,.06)",cursor:"pointer",textAlign:"left",padding:0}}>
          <div style={{background:c.light,height:140,display:"flex",alignItems:"center",justifyContent:"center",position:"relative"}}>
            {img
              ? <img src={img} style={{height:130,objectFit:"contain"}}/>
              : <span style={{fontSize:40}}>🍋</span>
            }
            {!p.actif && <div style={{position:"absolute",top:8,right:8}}><Badge c="gray">Inactif</Badge></div>}
          </div>
          <div style={{padding:"10px 12px"}}>
            <p style={{fontSize:10,fontWeight:700,color:c.accent,textTransform:"uppercase",letterSpacing:".08em"}}>{p.variante}</p>
            <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:17,fontWeight:700,color:"#111",lineHeight:1.2,marginTop:2}}>{p.nom}</p>
            <p style={{fontSize:11,color:"#9CA3AF",marginTop:2}}>{p.format}</p>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:8}}>
              <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:18,fontWeight:700,color:"#111"}}>CHF {p.prixClient}</p>
              <p style={{fontSize:11,color:"#9CA3AF"}}>Pro: CHF {p.prixRevendeur}</p>
            </div>
          </div>
        </button>
      );
    })}
  </div>

  {modal==="form"&&(
    <Modal title={form.id?"Modifier produit":"Nouveau produit"} onClose={()=>setModal(null)}>
      <div style={{display:"grid",gap:14}}>

        {/* Photo */}
        <div>
          <label style={{fontSize:11,fontWeight:600,color:"#9CA3AF",textTransform:"uppercase",letterSpacing:".06em",display:"block",marginBottom:8}}>Photo du produit</label>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            {form.photoUrl
              ? <img src={form.photoUrl} style={{width:60,height:80,objectFit:"contain",borderRadius:8,border:"1px solid #E5E5E0",background:"#F5F5F0"}}/>
              : <div style={{width:60,height:80,borderRadius:8,border:"2px dashed #E5E5E0",display:"flex",alignItems:"center",justifyContent:"center",background:"#F5F5F0",fontSize:24}}>📷</div>
            }
            <div style={{flex:1}}>
              <input type="file" accept="image/*" id="photo-upload" style={{display:"none"}}
                onChange={e=>{
                  const file = e.target.files[0];
                  if(!file) return;
                  const reader = new FileReader();
                  reader.onload = ev => setForm(p=>({...p,photoUrl:ev.target.result}));
                  reader.readAsDataURL(file);
                }}/>
              <label htmlFor="photo-upload" style={{display:"inline-flex",alignItems:"center",gap:6,background:"#F5F5F0",border:"none",borderRadius:10,padding:"8px 14px",fontWeight:600,fontSize:13,color:"#111",cursor:"pointer"}}>
                📁 Choisir une photo
              </label>
              {form.photoUrl && <button onClick={()=>setForm(p=>({...p,photoUrl:""}))} style={{display:"block",marginTop:6,background:"none",border:"none",color:"#9CA3AF",fontSize:11,cursor:"pointer"}}>Supprimer la photo</button>}
            </div>
          </div>
        </div>

        <F label="Nom du produit" value={form.nom} onChange={v=>setForm(p=>({...p,nom:v}))} required/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <F label="Variante / Parfum" value={form.variante||""} onChange={v=>setForm(p=>({...p,variante:v}))}/>
          <F label="Format (25cl, 50cl...)" value={form.format||""} onChange={v=>setForm(p=>({...p,format:v}))}/>
        </div>
        <F label="Description" value={form.description||""} onChange={v=>setForm(p=>({...p,description:v}))}/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <F label="Degré alcool" value={form.alcool||"30% vol."} onChange={v=>setForm(p=>({...p,alcool:v}))}/>
          <F label="Ingrédients" value={form.ingredients||""} onChange={v=>setForm(p=>({...p,ingredients:v}))}/>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <F label="Prix public (CHF)" type="number" value={form.prixClient||""} onChange={v=>setForm(p=>({...p,prixClient:parseFloat(String(v).replace(",","."))||0}))} required/>
          <F label="Prix pro (CHF)" type="number" value={form.prixRevendeur||""} onChange={v=>setForm(p=>({...p,prixRevendeur:parseFloat(String(v).replace(",","."))||0}))} required/>
        </div>

        {/* Détail du coût de revient */}
        <div style={{background:"#F4F4F2",borderRadius:12,padding:"14px 14px 10px",border:"1px solid #EAE7E0"}}>
          <p style={{fontSize:11,fontWeight:600,color:"#525252",textTransform:"uppercase",letterSpacing:"-0.005em",marginBottom:10}}>💰 Détail du coût de revient</p>
          <p style={{fontSize:10,color:"#737373",marginBottom:12}}>Remplis ce qui s'applique, le total sera calculé automatiquement</p>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <F label="Bouteille vide" type="number" value={form.coutDetail?.bouteille||""} onChange={v=>setForm(p=>({...p,coutDetail:{...(p.coutDetail||{}),bouteille:v}}))}/>
            <F label="Bouchon" type="number" value={form.coutDetail?.bouchon||""} onChange={v=>setForm(p=>({...p,coutDetail:{...(p.coutDetail||{}),bouchon:v}}))}/>
            <F label="Étiquette" type="number" value={form.coutDetail?.etiquette||""} onChange={v=>setForm(p=>({...p,coutDetail:{...(p.coutDetail||{}),etiquette:v}}))}/>
            <F label="Alcool" type="number" value={form.coutDetail?.alcool||""} onChange={v=>setForm(p=>({...p,coutDetail:{...(p.coutDetail||{}),alcool:v}}))}/>
            <F label="Fruits / arômes" type="number" value={form.coutDetail?.fruits||""} onChange={v=>setForm(p=>({...p,coutDetail:{...(p.coutDetail||{}),fruits:v}}))}/>
            <F label="Sucre" type="number" value={form.coutDetail?.sucre||""} onChange={v=>setForm(p=>({...p,coutDetail:{...(p.coutDetail||{}),sucre:v}}))}/>
            <F label="Emballage" type="number" value={form.coutDetail?.emballage||""} onChange={v=>setForm(p=>({...p,coutDetail:{...(p.coutDetail||{}),emballage:v}}))}/>
            <F label="Main d'œuvre" type="number" value={form.coutDetail?.mainOeuvre||""} onChange={v=>setForm(p=>({...p,coutDetail:{...(p.coutDetail||{}),mainOeuvre:v}}))}/>
            <F label="Autres" type="number" value={form.coutDetail?.autres||""} onChange={v=>setForm(p=>({...p,coutDetail:{...(p.coutDetail||{}),autres:v}}))}/>
          </div>
          {/* Récap live */}
          {(() => {
            const d = form.coutDetail||{};
            const total = (parseFloat(d.bouteille)||0)+(parseFloat(d.bouchon)||0)+(parseFloat(d.etiquette)||0)+(parseFloat(d.alcool)||0)+(parseFloat(d.fruits)||0)+(parseFloat(d.sucre)||0)+(parseFloat(d.emballage)||0)+(parseFloat(d.mainOeuvre)||0)+(parseFloat(d.autres)||0);
            if(total===0) return null;
            const margeP = form.prixClient?((form.prixClient-total)/form.prixClient*100).toFixed(1):0;
            const margePro = form.prixRevendeur?((form.prixRevendeur-total)/form.prixRevendeur*100).toFixed(1):0;
            return (
              <div style={{marginTop:12,padding:"10px 12px",background:"#fff",borderRadius:8,border:"1px solid #EAE7E0"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:6}}>
                  <span style={{fontSize:12,fontWeight:600}}>Coût total</span>
                  <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,fontWeight:700,color:"#0A0A0A"}}>CHF {total.toFixed(2)}</span>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,fontSize:11,paddingTop:6,borderTop:"1px solid #EAE7E0"}}>
                  <div>
                    <p style={{color:"#737373"}}>Marge public</p>
                    <p style={{fontWeight:700,color:margeP>30?"#15803D":margeP>15?"#9A3412":"#B91C1C"}}>{margeP}% · CHF {(form.prixClient-total).toFixed(2)}</p>
                  </div>
                  <div>
                    <p style={{color:"#737373"}}>Marge pro</p>
                    <p style={{fontWeight:700,color:margePro>30?"#15803D":margePro>15?"#9A3412":"#B91C1C"}}>{margePro}% · CHF {(form.prixRevendeur-total).toFixed(2)}</p>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </div>
      <div style={{display:"flex",gap:10,marginTop:20}}>
        <Btn onClick={save} full icon="check">Enregistrer</Btn>
        <Btn onClick={()=>setModal(null)} variant="ghost" full>Annuler</Btn>
      </div>
    </Modal>
  )}
</div>

);
};

// ══════════════════════════════════════════════════════════════
// PAGE: STOCKS
// ══════════════════════════════════════════════════════════════
const envoyerAlerteStock = (st) => {
const bas = st.produits.filter(p=>p.actif&&!p.nom.includes("Coffret")).filter(p=>{
const t=sum((st.stocks||[]).filter(s=>s.produitId===p.id).map(s=>s.qte));
return t<=3&&t>0;
});
const lignes = bas.map(p=>{
const t=sum((st.stocks||[]).filter(s=>s.produitId===p.id).map(s=>s.qte));
return "• "+p.nom+" "+p.variante+" "+p.format+" : "+t+" unités";
}).join("\n");
const subj = encodeURIComponent("⚠️ Alerte stock bas - GoûtStoso");
const body = encodeURIComponent(
"Bonjour Jordan,\n\n"+
"Une alerte stock bas vient d'être détectée. Les produits suivants ont atteint un niveau critique (≤ 3 unités) :\n\n"+
lignes+"\n\n"+
"Merci de planifier une production dès que possible afin d'éviter toute rupture.\n\n"+
"Bonne journée,\n"+
"Goûtstoso"
);
sendEmail({to:"admin@goutstoso.ch",subject:subj,body:bodyTxt||body||""});
};

const Stocks = ({st,setSt}) => {
const [modal,setModal] = useState(null);
const [form,setForm] = useState({produitId:"",qte:0,lot:genLot(),dateEntree:today(),notes:""});
const [ajustForm,setAjustForm] = useState({produitId:"",cibleQte:"",notes:""});

const save = () => {
if(!form.produitId||!form.qte) return;
const newEntry = {...form,id:uid(),qte:+form.qte};
setSt(p=>({...p,
  stocks:[...p.stocks,newEntry],
  mouvementsStock:[...(p.mouvementsStock||[]),{
    id:uid(),date:form.dateEntree,type:"entrée",
    produitId:form.produitId,qte:+form.qte,
    source:"Production / entrée manuelle",lot:form.lot||"",notes:form.notes||"",stockEntreeId:newEntry.id,
  }],
}));
setModal(null);
setForm({produitId:"",qte:0,lot:"",dateEntree:today(),notes:""});
};

const del = id => {
const s = (st.stocks||[]).find(x=>x.id===id);
if(!s) return;
setSt(p=>({...p,
  stocks:p.stocks.filter(x=>x.id!==id),
  mouvementsStock:[...(p.mouvementsStock||[]),{
    id:uid(),date:today(),type:"correction",
    produitId:s.produitId,qte:-(s.qte||0),
    source:"Suppression entrée de stock",lot:s.lot||"",
  }],
}));
};

const syncMouvements = () => {
let added = 0;
setSt(p=>{
  const dejaSynced = new Set(
    (p.mouvementsStock||[]).filter(m=>m.commandeId).map(m=>m.commandeId)
  );
  const newMouvements = [...(p.mouvementsStock||[])];
  (p.commandes||[]).filter(c=>c.stockDeduit).forEach(c=>{
    if(!dejaSynced.has(c.id)){
      (c.lignes||[]).filter(l=>l.produitId&&(parseInt(l.qte)||0)>0).forEach(l=>{
        newMouvements.push({
          id:uid(),date:c.date||today(),type:"sortie",
          produitId:l.produitId,qte:-(parseInt(l.qte)||0),
          source:`Commande ${c.numero}`,commandeId:c.id,
        });
        added++;
      });
    }
  });
  if(added===0) return p;
  return {...p,mouvementsStock:newMouvements};
});
if(added>0) alert(`✅ ${added} mouvement(s) synchronisé(s) depuis les commandes existantes.`);
else alert("✅ Tout est déjà à jour, aucun mouvement manquant.");
};

const ajuster = () => {
if(!ajustForm.produitId||ajustForm.cibleQte==="") return;
const cible = parseInt(ajustForm.cibleQte)||0;
const actuel = sum((st.stocks||[]).filter(s=>s.produitId===ajustForm.produitId).map(s=>s.qte));
const delta = cible - actuel;
if(delta===0) { setModal(null); return; }
const adjEntry = {id:uid(),produitId:ajustForm.produitId,qte:delta,lot:"",dateEntree:today(),notes:ajustForm.notes||""};
setSt(p=>({...p,
  stocks:[...(p.stocks||[]),adjEntry],
  mouvementsStock:[...(p.mouvementsStock||[]),{
    id:uid(),date:today(),type:"régularisation",
    produitId:ajustForm.produitId,qte:delta,
    source:"Régularisation manuelle"+(ajustForm.notes?" · "+ajustForm.notes:""),
  }],
}));
setModal(null);
setAjustForm({produitId:"",cibleQte:"",notes:""});
};

const exportStocks = () => {
const rows = st.produits.map(p=>{
const qte = sum((st.stocks||[]).filter(s=>s.produitId===p.id).map(s=>s.qte));
const enDepot = sum((st.depotStocks||[]).filter(d=>d.produitId===p.id).map(d=>d.qteDeposee-d.qteVendue-d.qteRetournee));
return {Produit:p.nom+" "+p.variante,Format:p.format,"Stock total":qte,"En dépôt":enDepot,"Stock propre":qte-enDepot,"Valeur (coût)":qte*(p.coutRevient||0)};
});
exportCSV(rows,"goutstoso_stocks.csv");
};

return (
<div className="fade">
{/* Alerte email stock bas */}
{st.produits.filter(p=>p.actif&&!p.nom.includes("Coffret")).some(p=>{
const total = sum((st.stocks||[]).filter(s=>s.produitId===p.id).map(s=>s.qte));
return total <= 3 && total > 0;
}) && (
<div style={{background:"#FEE2E2",border:"1px solid #FCA5A5",borderRadius:12,padding:"10px 14px",marginBottom:12,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
<div>
<p style={{fontWeight:700,color:"#991B1B",fontSize:13}}>⚠️ Stock bas détecté</p>
<p style={{fontSize:11,color:"#B91C1C",marginTop:1}}>
{st.produits.filter(p=>p.actif&&!p.nom.includes("Coffret")).filter(p=>{
const t=sum((st.stocks||[]).filter(s=>s.produitId===p.id).map(s=>s.qte));
return t<=3&&t>0;
}).map(p=>`${p.nom} ${p.variante} ${p.format}`).join(", ")}
</p>
</div>
<button onClick={()=>{
const prodsBas = st.produits.filter(p=>p.actif&&!p.nom.includes("Coffret")).filter(p=>{
const t=sum((st.stocks||[]).filter(s=>s.produitId===p.id).map(s=>s.qte));
return t<=3&&t>0;
});
const lignesBas = prodsBas.map(p=>{
const t=sum((st.stocks||[]).filter(s=>s.produitId===p.id).map(s=>s.qte));
return `• ${p.nom} ${p.variante} ${p.format} : ${t} unités restantes`;
}).join("\n");
const bodyAlerte =
"Bonjour Jordan,\n\n"+
"Une alerte stock bas vient d'être détectée. Les produits suivants ont atteint un niveau critique (≤ 3 unités) :\n\n"+
lignesBas+"\n\n"+
"Merci de planifier une production dès que possible afin d'éviter toute rupture.\n\n"+
"Bonne journée,\nGoûtstoso";
const subj2 = "⚠️ Alerte stock bas - Goûtstoso";
sendEmail({to:"admin@goutstoso.ch",subject:subj2,body:bodyAlerte});
}} style={{background:"#991B1B",color:"#fff",border:"none",borderRadius:8,padding:"7px 12px",fontSize:12,fontWeight:700,cursor:"pointer",flexShrink:0,marginLeft:8}}>
✉️ Alerter
</button>
</div>
)}

  <SectionTitle action={
    <div style={{display:"flex",gap:8}}>
      <Btn icon="export" variant="ghost" small onClick={exportStocks}>Export</Btn>
      <Btn variant="ghost" small onClick={()=>setModal("ajust")}>Ajuster</Btn>
      <Btn icon="plus" small onClick={()=>setModal("form")}>Entrée</Btn>
    </div>
  }>Stocks</SectionTitle>

  {/* Résumé par produit */}
  <div style={{display:"grid",gap:10,marginBottom:20}}>
    {st.produits.filter(p=>p.actif && !p.nom.includes("Coffret")).map(p=>{
      const total = sum((st.stocks||[]).filter(s=>s.produitId===p.id).map(s=>s.qte));
      const enDepot = sum((st.depotStocks||[]).filter(d=>d.produitId===p.id).map(d=>d.qteDeposee-d.qteVendue-d.qteRetournee));
      const propre = total - enDepot;
      const img = getImg(p);
      const c = COULEURS[p.variante]||{bg:"#F5F5F0",accent:"#6B7280",light:"#E5E5E0"};
      const alerte = total > 0 && total <= 3;
      return (
        <Card key={p.id} style={{padding:"12px 14px"}}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            {img
              ? <img src={img} style={{width:36,height:48,objectFit:"contain",borderRadius:6,background:c.light,padding:2}}/>
              : <div style={{width:36,height:48,borderRadius:6,background:c.light,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>🍋</div>
            }
            <div style={{flex:1}}>
              <p style={{fontWeight:700,fontSize:13,color:"#111"}}>{p.nom} <span style={{color:c.accent,fontWeight:400}}>{p.variante}</span></p>
              <p style={{fontSize:11,color:"#9CA3AF"}}>{p.format}</p>
            </div>
            {alerte && <span style={{background:"#FEE2E2",color:"#991B1B",borderRadius:6,padding:"2px 8px",fontSize:10,fontWeight:700}}>⚠ Bas</span>}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginTop:10}}>
            {[
              {l:"Total",v:total,c:"#111",bg:"#F5F5F0"},
              {l:"En dépôt",v:enDepot,c:"#1E3A5F",bg:"#DBEAFE"},
              {l:"Propre",v:propre,c:propre<5?"#991B1B":"#166534",bg:propre<5?"#FEE2E2":"#DCFCE7"},
            ].map((k,i)=>(
              <div key={i} style={{background:k.bg,borderRadius:8,padding:"8px",textAlign:"center"}}>
                <p style={{fontSize:9,color:"#9CA3AF",fontWeight:600,textTransform:"uppercase"}}>{k.l}</p>
                <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,fontWeight:700,color:k.c,lineHeight:1.2}}>{k.v}</p>
                <p style={{fontSize:9,color:"#9CA3AF"}}>unités</p>
              </div>
            ))}
          </div>
        </Card>
      );
    })}
  </div>

  {/* Mouvements de stock */}
  {(() => {
    const mouvements = (st.mouvementsStock||[]).slice().sort((a,b)=>(b.date||"").localeCompare(a.date||""));
    const typeStyle = (t) => t==="entrée"
      ? {bg:"#DCFCE7",color:"#166534",label:"↑ Entrée"}
      : t==="sortie"
      ? {bg:"#FEE2E2",color:"#991B1B",label:"↓ Sortie"}
      : t==="restauration"
      ? {bg:"#DBEAFE",color:"#1E40AF",label:"↩ Restauration"}
      : t==="régularisation"
      ? {bg:"#FEF3C7",color:"#92400E",label:"⚖ Régul."}
      : {bg:"#F4F4F2",color:"#525252",label:"✎ Correction"};

    return (
      <Card>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
          <h3 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:18}}>Mouvements de stock</h3>
          <button onClick={syncMouvements} style={{background:"#F4F4F2",border:"none",borderRadius:8,padding:"5px 10px",fontSize:11,fontWeight:600,color:"#525252",cursor:"pointer"}}>⟳ Sync</button>
        </div>
        {mouvements.length === 0 ? (
          <div style={{textAlign:"center",padding:"30px 20px",color:"#9CA3AF"}}>
            <p style={{fontSize:36,marginBottom:8}}>📦</p>
            <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:18,fontWeight:600,color:"#374151"}}>Aucun mouvement</p>
            <p style={{fontSize:12,marginTop:4}}>Enregistre ta première production pour commencer le suivi.</p>
            <button onClick={()=>setModal("form")} style={{marginTop:14,background:"#F2C94C",border:"none",borderRadius:12,padding:"11px 22px",fontWeight:700,fontSize:13,cursor:"pointer"}}>
              + Première entrée
            </button>
          </div>
        ) : (
          <div style={{display:"flex",flexDirection:"column",gap:0}}>
            {mouvements.map((m,i)=>{
              const prod = st.produits.find(x=>x.id===m.produitId);
              const ts = typeStyle(m.type);
              return (
                <div key={m.id} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 0",borderBottom:i<mouvements.length-1?"1px solid #F5F5F0":"none"}}>
                  {/* Badge type */}
                  <span style={{background:ts.bg,color:ts.color,borderRadius:6,padding:"3px 8px",fontSize:10,fontWeight:700,whiteSpace:"nowrap",flexShrink:0}}>{ts.label}</span>
                  {/* Infos */}
                  <div style={{flex:1,minWidth:0}}>
                    <p style={{fontSize:12,fontWeight:600,color:"#111",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                      {prod?.nom} {prod?.variante} {prod?.format}
                    </p>
                    <p style={{fontSize:10,color:"#9CA3AF",marginTop:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                      {fmt(m.date)}{m.lot?` · Lot ${m.lot}`:""} · {m.source}
                    </p>
                  </div>
                  {/* Qté */}
                  <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:18,fontWeight:700,color:ts.color,flexShrink:0}}>
                    {m.qte>0?"+":""}{m.qte}
                  </span>
                  {/* Supprimer si c'est une entrée manuelle */}
                  {m.stockEntreeId && (
                    <button onClick={()=>del(m.stockEntreeId)} style={{background:"#FEE2E2",border:"none",borderRadius:8,padding:5,cursor:"pointer",display:"flex",flexShrink:0}}>
                      <Ic n="trash" s={12}/>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    );
  })()}

  {/* Modal nouvelle entrée */}
  {modal==="form"&&(
    <Modal title="Nouvelle entrée de stock" onClose={()=>setModal(null)}>
      <div style={{display:"grid",gap:14}}>
        <Sel label="Produit" value={form.produitId} onChange={v=>setForm(p=>({...p,produitId:v}))} required
          options={[{v:"",l:"- Sélectionner un produit -"},...st.produits.filter(p=>p.actif && !p.nom.includes("Coffret")).map(p=>({v:p.id,l:`${p.nom} ${p.variante} ${p.format}`}))]}/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <F label="Quantité" type="number" value={form.qte} onChange={v=>setForm(p=>({...p,qte:v}))} required/>
          <F label="N° de lot" value={form.lot} onChange={v=>setForm(p=>({...p,lot:v}))} placeholder="ex: 01-03.2026"/>
        </div>
        <F label="Date d'entrée" type="date" value={form.dateEntree} onChange={v=>setForm(p=>({...p,dateEntree:v,lot:genLot(v)}))}/>
        <F label="Notes" value={form.notes} onChange={v=>setForm(p=>({...p,notes:v}))} placeholder="Observations, conditions..."/>
        <div style={{background:"#FEF9E7",borderRadius:10,padding:"10px 12px",fontSize:12,color:"#92400E"}}>
          💡 Tu peux enregistrer ta production par lot pour avoir une traçabilité complète.
        </div>
      </div>
      <div style={{display:"flex",gap:10,marginTop:20}}>
        <Btn onClick={save} full icon="check">Enregistrer</Btn>
        <Btn onClick={()=>setModal(null)} variant="ghost" full>Annuler</Btn>
      </div>
    </Modal>
  )}

  {/* Modal ajustement de stock */}
  {modal==="ajust"&&(
    <Modal title="Ajustement de stock" onClose={()=>setModal(null)}>
      <div style={{display:"grid",gap:14}}>
        <Sel label="Produit" value={ajustForm.produitId} onChange={v=>{
          const actuel = sum((st.stocks||[]).filter(s=>s.produitId===v).map(s=>s.qte));
          setAjustForm(p=>({...p,produitId:v,cibleQte:String(actuel)}));
        }} required
          options={[{v:"",l:"- Sélectionner un produit -"},...st.produits.filter(p=>p.actif && !p.nom.includes("Coffret")).map(p=>({v:p.id,l:`${p.nom} ${p.variante} ${p.format}`}))]}/>
        {ajustForm.produitId&&(()=>{
          const actuel = sum((st.stocks||[]).filter(s=>s.produitId===ajustForm.produitId).map(s=>s.qte));
          const cible = parseInt(ajustForm.cibleQte)||0;
          const delta = cible - actuel;
          return (
            <div style={{background:"#F5F5F0",borderRadius:10,padding:"10px 14px",display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,textAlign:"center"}}>
              <div>
                <p style={{fontSize:10,color:"#9CA3AF",fontWeight:600,textTransform:"uppercase"}}>Actuel</p>
                <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,fontWeight:700,color:"#111"}}>{actuel}</p>
              </div>
              <div>
                <p style={{fontSize:10,color:"#9CA3AF",fontWeight:600,textTransform:"uppercase"}}>Cible</p>
                <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,fontWeight:700,color:"#111"}}>{cible}</p>
              </div>
              <div>
                <p style={{fontSize:10,color:"#9CA3AF",fontWeight:600,textTransform:"uppercase"}}>Écart</p>
                <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,fontWeight:700,color:delta===0?"#9CA3AF":delta>0?"#166534":"#991B1B"}}>{delta>0?"+":""}{delta}</p>
              </div>
            </div>
          );
        })()}
        <F label="Nouveau stock (unités)" type="number" value={ajustForm.cibleQte} onChange={v=>setAjustForm(p=>({...p,cibleQte:v}))} required/>
        <F label="Motif (optionnel)" value={ajustForm.notes} onChange={v=>setAjustForm(p=>({...p,notes:v}))} placeholder="ex: Inventaire physique, casse, perte..."/>
        <div style={{background:"#FEF9E7",borderRadius:10,padding:"10px 12px",fontSize:12,color:"#92400E"}}>
          ⚖️ L'écart sera enregistré en "Régularisation" dans l'historique des mouvements.
        </div>
      </div>
      <div style={{display:"flex",gap:10,marginTop:20}}>
        <Btn onClick={ajuster} full icon="check">Valider l'ajustement</Btn>
        <Btn onClick={()=>setModal(null)} variant="ghost" full>Annuler</Btn>
      </div>
    </Modal>
  )}
</div>

);
};

// ══════════════════════════════════════════════════════════════
// PAGE: PARTENAIRES / POINTS DE VENTE
// ══════════════════════════════════════════════════════════════
const SignaturePad = ({onSave,onCancel}) => {
const canvasRef = useRef(null);
const [drawing,setDrawing] = useState(false);
const [hasSig,setHasSig] = useState(false);

const getPos = (e,canvas) => {
const r = canvas.getBoundingClientRect();
const src = e.touches?e.touches[0]:e;
return {x:(src.clientX-r.left)*(canvas.width/r.width),y:(src.clientY-r.top)*(canvas.height/r.height)};
};
const start = e => { e.preventDefault(); const c=canvasRef.current; const ctx=c.getContext("2d"); const p=getPos(e,c); ctx.beginPath(); ctx.moveTo(p.x,p.y); setDrawing(true); setHasSig(true); };
const draw = e => { e.preventDefault(); if(!drawing) return; const c=canvasRef.current; const ctx=c.getContext("2d"); ctx.strokeStyle="#111"; ctx.lineWidth=2.5; ctx.lineCap="round"; const p=getPos(e,c); ctx.lineTo(p.x,p.y); ctx.stroke(); };
const stop = e => { e.preventDefault(); setDrawing(false); };
const clear = () => { const c=canvasRef.current; c.getContext("2d").clearRect(0,0,c.width,c.height); setHasSig(false); };

return (
<div>
<p style={{fontSize:12,color:"#6B7280",marginBottom:8,textAlign:"center"}}>Signez dans le cadre ci-dessous</p>
<div style={{border:"2px solid #F2C94C",borderRadius:10,overflow:"hidden",background:"#fff",marginBottom:12}}>
<canvas ref={canvasRef} width={340} height={160} style={{width:"100%",height:160,touchAction:"none",display:"block"}}
onMouseDown={start} onMouseMove={draw} onMouseUp={stop}
onTouchStart={start} onTouchMove={draw} onTouchEnd={stop}/>
</div>
<div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
<Btn onClick={clear} variant="ghost" small>Effacer</Btn>
<Btn onClick={onCancel} variant="ghost" small>Annuler</Btn>
<Btn onClick={()=>hasSig&&onSave(canvasRef.current.toDataURL())} icon="check" small>Valider</Btn>
</div>
</div>
);
};

const genererBulletinPDF = async (c, pv, st) => {
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
const typeLabel = c.type==="depot-vente"?"BON DE DÉPÔT-VENTE":"BON DE LIVRAISON";

// Bande jaune
doc.setFillColor(242,201,76);doc.rect(0,0,W,6,"F");

// Header
pdfLogo(doc,mg);
doc.setFontSize(20);doc.setFont("helvetica","bold");doc.setTextColor(17,17,17);
doc.text(typeLabel,W-mg,20,{align:"right"});
doc.setFontSize(11);doc.setTextColor(212,160,23);
doc.text(c.numero,W-mg,28,{align:"right"});
doc.setFontSize(9);doc.setTextColor(120,120,120);doc.setFont("helvetica","normal");
doc.text("Date : "+fmt(c.dateDebut),W-mg,34,{align:"right"});

// Sépar
doc.setDrawColor(230,230,228);doc.setLineWidth(0.3);doc.line(mg,42,W-mg,42);

// Parties
let y=50;
doc.setFontSize(8);doc.setFont("helvetica","bold");doc.setTextColor(156,163,175);
doc.text("FOURNISSEUR",mg,y);doc.text("CLIENT",W/2+2,y);
doc.setDrawColor(242,201,76);doc.setLineWidth(0.5);
doc.line(mg,y+1,mg+22,y+1);doc.line(W/2+2,y+1,W/2+18,y+1);
y+=7;
doc.setFontSize(11);doc.setFont("helvetica","bold");doc.setTextColor(17,17,17);
doc.text("Goûtstoso",mg,y);doc.text(pv?.nom||"",W/2+2,y);
doc.setFontSize(9);doc.setFont("helvetica","normal");doc.setTextColor(107,114,128);
["Jordan Montanaro","Rue des Sources 19","2613 Villeret","admin@goutstoso.ch"].forEach((l,i)=>doc.text(l,mg,y+5+i*4.5));
{const pvAddrLines=(pv?.npa||pv?.ville)?[pv?.adresse||"",[pv?.npa,pv?.ville].filter(Boolean).join(" ")].filter(Boolean):(pv?.adresse||"").split(", ").filter(Boolean);pvAddrLines.forEach((l,i)=>doc.text(l,W/2+2,y+5+i*4.5));if(pv?.contact)doc.text(pv.contact,W/2+2,y+5+pvAddrLines.length*4.5);}

// Tableau produits
y+=32;
doc.setFillColor(17,17,17);doc.rect(mg,y,W-mg*2,9,"F");
doc.setFontSize(8);doc.setFont("helvetica","bold");doc.setTextColor(242,201,76);
doc.text("DÉSIGNATION",mg+3,y+6);
doc.setTextColor(180,180,180);
doc.text("LOT",120,y+6,{align:"center"});
doc.text("QUANTITÉ",W-mg-2,y+6,{align:"right"});
y+=9;

(c.lignes||[]).forEach((l,i)=>{
  const p=st.produits.find(x=>x.id===l.produitId);
  doc.setFillColor(i%2===0?250:255,i%2===0?250:255,i%2===0?248:255);
  doc.rect(mg,y,W-mg*2,12,"F");
  doc.setDrawColor(240,240,238);doc.setLineWidth(0.2);doc.rect(mg,y,W-mg*2,12,"S");
  doc.setFontSize(10);doc.setFont("helvetica","bold");doc.setTextColor(17,17,17);
  doc.text((p?.nom||"")+" "+(p?.variante||""),mg+3,y+5);
  doc.setFontSize(8);doc.setFont("helvetica","normal");doc.setTextColor(150,150,150);
  doc.text((p?.format||"")+" · 30% vol.",mg+3,y+10);
  doc.setFontSize(9);doc.setTextColor(107,114,128);
  doc.text(l.lot||genLot(c.dateDebut),120,y+7,{align:"center"});
  doc.setFont("helvetica","bold");doc.setFontSize(13);doc.setTextColor(17,17,17);
  doc.text(String(l.qte),W-mg-2,y+7,{align:"right"});
  y+=12;
});
y+=8;

// Notes
if(c.notes) {
  doc.setFillColor(254,249,231);doc.roundedRect(mg,y,W-mg*2,16,3,3,"F");
  doc.setFontSize(8);doc.setFont("helvetica","bold");doc.setTextColor(146,64,14);
  doc.text("NOTES",mg+4,y+5);
  doc.setFont("helvetica","normal");doc.setFontSize(9);doc.setTextColor(120,80,30);
  doc.text(c.notes,mg+4,y+11,{maxWidth:W-mg*2-8});
  y+=20;
}

// Conditions selon type
doc.setFillColor(245,245,242);doc.roundedRect(mg,y,W-mg*2,22,3,3,"F");
doc.setFontSize(8);doc.setFont("helvetica","bold");doc.setTextColor(80,80,80);
doc.text("CONDITIONS",mg+4,y+5);
doc.setFont("helvetica","normal");doc.setFontSize(8.5);doc.setTextColor(107,114,128);
if(c.type==="depot-vente") {
  doc.text("Marchandise déposée en dépôt-vente. Propriété de Goûtstoso jusqu'au paiement.",mg+4,y+11);
  doc.text("Facturation au prix professionnel après inventaire des ventes.",mg+4,y+16);
} else {
  doc.text("Marchandise livrée fermement. Facturation au prix professionnel.",mg+4,y+11);
  doc.text("Paiement à 30 jours - IBAN : CH23 0900 0000 1565 1485 8",mg+4,y+16);
}
y+=28;

// Signatures
doc.setFontSize(8);doc.setFont("helvetica","bold");doc.setTextColor(80,80,80);
doc.text("SIGNATURES",mg,y);y+=4;
const sigW = (W-mg*2-10)/2;
// Box fournisseur
doc.setDrawColor(200,200,200);doc.setLineWidth(0.3);
doc.roundedRect(mg,y,sigW,32,2,2,"S");
doc.setFontSize(7);doc.setFont("helvetica","bold");doc.setTextColor(150,150,150);
doc.text("Goûtstoso - Jordan Montanaro",mg+3,y+5);
// Box client
doc.roundedRect(mg+sigW+10,y,sigW,32,2,2,"S");
doc.text(pv?.nom||"Client",mg+sigW+13,y+5);
// Insert signature client si présente
if(c.signClient) {
  try { doc.addImage(c.signClient,"PNG",mg+sigW+13,y+8,sigW-6,20); } catch(e){}
}

// Pied de page
doc.setDrawColor(230,230,228);doc.setLineWidth(0.3);doc.line(mg,277,W-mg,277);
doc.setFontSize(7.5);doc.setFont("helvetica","normal");doc.setTextColor(150,150,150);
doc.text("Goûtstoso - Jordan Montanaro · Rue des Sources 19 · 2613 Villeret · admin@goutstoso.ch · www.goutstoso.ch",W/2,282,{align:"center"});
doc.setFillColor(242,201,76);doc.rect(0,292,W,5,"F");

// Annexes pour bon de livraison
ajouterDocAnnexe(doc, "consommation_responsable", st);
ajouterDocAnnexe(doc, "cgv", st);

doc.save(c.numero+".pdf");

} catch(e){alert("Erreur PDF : "+e.message);}
};

const ajouterDocAnnexe = (doc, docId, st) => {
const d = (st.documents||DOCS_DEFAUT)[docId];
if(!d || !d.contenu) return;
const W=210, mg=18;
doc.addPage();
doc.setFillColor(232,182,76);doc.rect(0,0,W,6,"F");
pdfLogo(doc,mg);
doc.setFontSize(12);doc.setFont("helvetica","bold");doc.setTextColor(17,17,17);
const titleLines = doc.splitTextToSize(d.titre,W-mg*2);
doc.text(titleLines,mg,41);
doc.setDrawColor(230,230,228);doc.setLineWidth(0.3);doc.line(mg,47,W-mg,47);
doc.setFontSize(8);doc.setFont("helvetica","normal");doc.setTextColor(60,60,60);
const contentLines = doc.splitTextToSize(d.contenu||"", W-mg*2);
let y=54;
contentLines.forEach(line=>{
if(y>275) {
doc.setDrawColor(230,230,228);doc.line(mg,280,W-mg,280);
doc.setFontSize(6);doc.setTextColor(150,150,150);
doc.text("Goûtstoso - Jordan Montanaro · admin@goutstoso.ch",W/2,285,{align:"center"});
doc.setFillColor(232,182,76);doc.rect(0,292,W,5,"F");
doc.addPage();
doc.setFillColor(232,182,76);doc.rect(0,0,W,6,"F");
doc.setFontSize(8);doc.setFont("helvetica","normal");doc.setTextColor(150,150,150);
doc.text(d.titre+" - suite",mg,15);
doc.setDrawColor(230,230,228);doc.line(mg,19,W-mg,19);
doc.setFontSize(8);doc.setTextColor(60,60,60);
y=26;
}
doc.text(line,mg,y);
y+=4;
});
doc.setDrawColor(230,230,228);doc.line(mg,280,W-mg,280);
doc.setFontSize(6);doc.setTextColor(150,150,150);
doc.text("Goûtstoso - Jordan Montanaro · admin@goutstoso.ch",W/2,285,{align:"center"});
doc.setFillColor(232,182,76);doc.rect(0,292,W,5,"F");
};

const genererContratPDF = async (c, pv, st) => {
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
const typeLabel = c.type==="depot-vente"?"CONTRAT DE DÉPÔT-VENTE":c.type==="partenariat"?"CONTRAT DE PARTENARIAT":c.type==="offre"?"OFFRE COMMERCIALE":"CONTRAT";

doc.setFillColor(242,201,76);doc.rect(0,0,W,6,"F");
pdfLogo(doc,mg);
doc.setFontSize(16);doc.setFont("helvetica","bold");doc.setTextColor(17,17,17);
doc.text(typeLabel,W-mg,20,{align:"right"});
doc.setFontSize(11);doc.setTextColor(212,160,23);
doc.text(c.numero,W-mg,28,{align:"right"});
doc.setFontSize(9);doc.setTextColor(120,120,120);doc.setFont("helvetica","normal");
doc.text("Du "+fmt(c.dateDebut)+(c.dateFin?" au "+fmt(c.dateFin):" - Indéterminée"),W-mg,34,{align:"right"});
if(c.type==="offre") {
  const validite = c.validiteOffre || 30;
  const dateExp = new Date(c.dateDebut);
  dateExp.setDate(dateExp.getDate()+parseInt(validite));
  doc.setFontSize(9);doc.setTextColor(185,28,28);doc.setFont("helvetica","bold");
  doc.text("Offre valable jusqu'au "+fmt(dateExp.toISOString().slice(0,10)),W-mg,40,{align:"right"});
}

doc.setDrawColor(230,230,228);doc.setLineWidth(0.3);doc.line(mg,42,W-mg,42);

let y=50;
doc.setFontSize(8);doc.setFont("helvetica","bold");doc.setTextColor(156,163,175);
doc.text("ENTRE",mg,y);doc.text("ET",W/2+2,y);
doc.setDrawColor(242,201,76);doc.setLineWidth(0.5);
doc.line(mg,y+1,mg+10,y+1);doc.line(W/2+2,y+1,W/2+8,y+1);
y+=7;
doc.setFontSize(11);doc.setFont("helvetica","bold");doc.setTextColor(17,17,17);
doc.text("Goûtstoso",mg,y);doc.text(pv?.nom||"",W/2+2,y);
doc.setFontSize(9);doc.setFont("helvetica","normal");doc.setTextColor(107,114,128);
["Jordan Montanaro","Rue des Sources 19","2613 Villeret","admin@goutstoso.ch"].forEach((l,i)=>doc.text(l,mg,y+5+i*4.5));
{const pvAddrLines=(pv?.npa||pv?.ville)?[pv?.adresse||"",[pv?.npa,pv?.ville].filter(Boolean).join(" ")].filter(Boolean):(pv?.adresse||"").split(", ").filter(Boolean);pvAddrLines.forEach((l,i)=>doc.text(l,W/2+2,y+5+i*4.5));}

y+=32;
if(c.commission>0) {
  doc.setFillColor(254,249,231);doc.roundedRect(mg,y,W-mg*2,10,2,2,"F");
  doc.setFontSize(10);doc.setFont("helvetica","bold");doc.setTextColor(146,64,14);
  doc.text("Commission partenaire : "+c.commission+"%",mg+4,y+7);
  y+=14;
}

// Produits
if((c.lignes||[]).filter(l=>l.produitId).length>0) {
  doc.setFontSize(9);doc.setFont("helvetica","bold");doc.setTextColor(80,80,80);
  doc.text("PRODUITS CONCERNÉS",mg,y);y+=5;
  doc.setFillColor(17,17,17);doc.rect(mg,y,W-mg*2,8,"F");
  doc.setFontSize(7.5);doc.setFont("helvetica","bold");doc.setTextColor(242,201,76);
  doc.text("DÉSIGNATION",mg+3,y+5.5);
  doc.setTextColor(180,180,180);
  doc.text("QTÉ",130,y+5.5,{align:"center"});
  doc.text("PRIX U.",155,y+5.5,{align:"right"});
  doc.text("TOTAL",W-mg-2,y+5.5,{align:"right"});
  y+=8;
  let total=0;
  (c.lignes||[]).filter(l=>l.produitId).forEach((l,i)=>{
    const p=st.produits.find(x=>x.id===l.produitId);
    const pu=l.prixUnitaire||(p?.prixRevendeur||0);
    const t=(l.qte||0)*pu; total+=t;
    doc.setFillColor(i%2===0?250:255,i%2===0?250:255,i%2===0?248:255);
    doc.rect(mg,y,W-mg*2,10,"F");
    doc.setFontSize(9);doc.setFont("helvetica","bold");doc.setTextColor(17,17,17);
    doc.text((p?.nom||"")+" "+(p?.variante||"")+" "+(p?.format||""),mg+3,y+6);
    doc.setFont("helvetica","normal");doc.setTextColor(107,114,128);
    doc.text(String(l.qte||0),130,y+6,{align:"center"});
    doc.text("CHF "+pu.toFixed(2),155,y+6,{align:"right"});
    doc.setFont("helvetica","bold");doc.setTextColor(17,17,17);
    doc.text("CHF "+t.toFixed(2),W-mg-2,y+6,{align:"right"});
    y+=10;
  });
  if(total>0) {
    y+=2;
    doc.setFillColor(254,249,231);doc.roundedRect(W/2+10,y,W/2-mg-10,10,2,2,"F");
    doc.setFontSize(11);doc.setFont("helvetica","bold");doc.setTextColor(17,17,17);
    doc.text("TOTAL : CHF "+total.toFixed(2),W-mg-3,y+7,{align:"right"});
    y+=14;
  }
}

if(c.notes) {
  y+=4;
  doc.setFontSize(9);doc.setFont("helvetica","bold");doc.setTextColor(80,80,80);
  doc.text("CONDITIONS PARTICULIÈRES",mg,y);y+=5;
  doc.setFillColor(245,245,242);doc.roundedRect(mg,y,W-mg*2,16,2,2,"F");
  doc.setFontSize(9);doc.setFont("helvetica","normal");doc.setTextColor(80,80,80);
  doc.text(c.notes,mg+4,y+7,{maxWidth:W-mg*2-8});
  y+=20;
}

// Mode d'acceptation pour offre
if(c.type==="offre" && c.modeAcceptation==="commande") {
  y+=4;
  doc.setFillColor(239,246,255);doc.roundedRect(mg,y,W-mg*2,28,3,3,"F");
  doc.setFontSize(9);doc.setFont("helvetica","bold");doc.setTextColor(30,64,175);
  doc.text("ACCEPTATION DE L'OFFRE",mg+4,y+7);
  doc.setFont("helvetica","normal");doc.setFontSize(8.5);doc.setTextColor(60,60,60);
  doc.text("Pour accepter cette offre, il vous suffit de nous retourner votre commande",mg+4,y+13);
  doc.text("par email à admin@goutstoso.ch en faisant référence à cette offre "+c.numero+".",mg+4,y+18);
  doc.text("Votre commande vaudra acceptation pleine et entière des présentes conditions.",mg+4,y+23);
  y+=34;
}

// Signatures (sauf si acceptation par commande)
if(!(c.type==="offre" && c.modeAcceptation==="commande")) {
y+=4;
doc.setFontSize(8);doc.setFont("helvetica","bold");doc.setTextColor(80,80,80);
doc.text("SIGNATURES",mg,y);y+=4;
const sigW = (W-mg*2-10)/2;
doc.setDrawColor(200,200,200);doc.setLineWidth(0.3);
doc.roundedRect(mg,y,sigW,32,2,2,"S");
doc.setFontSize(7);doc.setFont("helvetica","bold");doc.setTextColor(150,150,150);
doc.text("Goûtstoso - Jordan Montanaro",mg+3,y+5);
if(c.signFournisseur) {
  try { doc.addImage(c.signFournisseur,"PNG",mg+3,y+8,sigW-6,20); } catch(e){}
}
doc.roundedRect(mg+sigW+10,y,sigW,32,2,2,"S");
doc.text(pv?.nom||"Client",mg+sigW+13,y+5);
if(c.signClient) {
  try { doc.addImage(c.signClient,"PNG",mg+sigW+13,y+8,sigW-6,20); } catch(e){}
}
if(c.dateSignature) {
  y+=36;
  doc.setFontSize(8);doc.setFont("helvetica","normal");doc.setTextColor(150,150,150);
  doc.text("Signé le "+fmt(c.dateSignature)+" à "+(c.lieuSignature||"Villeret"),W/2,y,{align:"center"});
}

doc.setDrawColor(230,230,228);doc.setLineWidth(0.3);doc.line(mg,277,W-mg,277);
doc.setFontSize(7.5);doc.setFont("helvetica","normal");doc.setTextColor(150,150,150);
doc.text("Goûtstoso - Jordan Montanaro · Rue des Sources 19 · 2613 Villeret · admin@goutstoso.ch · www.goutstoso.ch",W/2,282,{align:"center"});
doc.setFillColor(242,201,76);doc.rect(0,292,W,5,"F");
} // fin if signatures

// Annexes légales
ajouterDocAnnexe(doc, "cgv", st);
if(c.type==="depot-vente"||c.type==="partenariat") {
  ajouterDocAnnexe(doc, "charte_alcool", st);
}

doc.save(c.numero+".pdf");

} catch(e){alert("Erreur PDF : "+e.message);}
};

const genererFicheMacerationPDF = async ({recette, litres, btl25, btl50, numLot, dateDebut, notes}) => {
try {
await new Promise((res,rej)=>{
if((window as any).jspdf){res(null);return;}
const s=document.createElement("script");
s.src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
s.onload=res;s.onerror=rej;document.head.appendChild(s);
});
const {jsPDF}=(window as any).jspdf;
const doc=new jsPDF("p","mm","a4");
const W=210,mg=18;

// Bande jaune
doc.setFillColor(242,201,76);doc.rect(0,0,W,6,"F");

// Logo
pdfLogo(doc,mg);

// Titre + numéro de lot
doc.setFontSize(20);doc.setFont("helvetica","bold");doc.setTextColor(17,17,17);
doc.text("FICHE DE MACÉRATION",W-mg,20,{align:"right"});
doc.setFontSize(14);doc.setTextColor(212,160,23);
doc.text("LOT : "+(numLot||genLot(dateDebut)),W-mg,29,{align:"right"});
doc.setFontSize(9);doc.setTextColor(120,120,120);doc.setFont("helvetica","normal");
doc.text("Date de début : "+fmt(dateDebut),W-mg,35,{align:"right"});

// Ligne séparatrice
doc.setDrawColor(230,230,228);doc.setLineWidth(0.3);doc.line(mg,42,W-mg,42);

// Infos recette
let y=50;
doc.setFontSize(8);doc.setFont("helvetica","bold");doc.setTextColor(156,163,175);
doc.text("PRODUCTEUR",mg,y);
doc.setDrawColor(242,201,76);doc.setLineWidth(0.5);doc.line(mg,y+1,mg+22,y+1);
y+=7;
doc.setFontSize(11);doc.setFont("helvetica","bold");doc.setTextColor(17,17,17);
doc.text("Goûtstoso — Jordan Montanaro",mg,y);
y+=5;
doc.setFontSize(9);doc.setFont("helvetica","normal");doc.setTextColor(107,114,128);
doc.text("Rue des Sources 19 · 2613 Villeret",mg,y);
y+=4;doc.text("admin@goutstoso.ch",mg,y);

// Encadré recette
y+=12;
doc.setFillColor(17,17,17);doc.rect(mg,y,W-mg*2,10,"F");
doc.setFontSize(9);doc.setFont("helvetica","bold");doc.setTextColor(242,201,76);
doc.text("RECETTE",mg+3,y+7);
doc.setTextColor(180,180,180);
doc.text((recette?.nom||"").toUpperCase()+" — "+(recette?.description||""),mg+30,y+7);
y+=10;

// Résumé batch
doc.setFillColor(250,250,248);doc.rect(mg,y,W-mg*2,22,"F");
doc.setDrawColor(230,230,228);doc.setLineWidth(0.2);doc.rect(mg,y,W-mg*2,22,"S");
y+=6;
const col=[(W-mg*2)/4,0,0,0];
col[1]=mg+col[0];col[2]=mg+col[0]*2;col[3]=mg+col[0]*3;
const vals=[
  {l:"Litres d'alcool 80°",v:litres.toFixed(1)+" L"},
  {l:"Bouteilles 250 ml",v:String(btl25||0)+" btl"},
  {l:"Bouteilles 500 ml",v:String(btl50||0)+" btl"},
  {l:"Durée macération",v:(recette?.dureeMacerationJours||"?")+"j"},
];
vals.forEach((item,i)=>{
  const x=mg+i*col[0];
  doc.setFontSize(7);doc.setFont("helvetica","normal");doc.setTextColor(156,163,175);
  doc.text(item.l,x+3,y);
  doc.setFontSize(11);doc.setFont("helvetica","bold");doc.setTextColor(17,17,17);
  doc.text(item.v,x+3,y+7);
});
y+=22;

// Prête le
doc.setFontSize(9);doc.setFont("helvetica","normal");doc.setTextColor(107,114,128);
const datePrete = dateDebut && recette?.dureeMacerationJours
  ? fmt(new Date(new Date(dateDebut).getTime()+recette.dureeMacerationJours*86400000).toISOString().slice(0,10))
  : "—";
doc.text("Date de fin prévue : "+datePrete,mg,y+6);
doc.setFontSize(9);doc.setTextColor(17,17,17);
if(recette?.titreAlcool) doc.text("Titre alcoométrique : "+recette.titreAlcool+"°",mg+85,y+6);
y+=16;

// Tableau ingrédients
doc.setFillColor(17,17,17);doc.rect(mg,y,W-mg*2,9,"F");
doc.setFontSize(8);doc.setFont("helvetica","bold");doc.setTextColor(242,201,76);
doc.text("INGRÉDIENT",mg+3,y+6);
doc.setTextColor(180,180,180);
doc.text("QUANTITÉ POUR "+litres.toFixed(1)+" L",W-mg-2,y+6,{align:"right"});
y+=9;

const affQte=(val,unite)=>{
  if(unite==="g"&&val>=1000) return `${(val/1000).toFixed(2)} kg`;
  if(unite==="L") return `${val.toFixed(2)} L`;
  if(unite==="ml") return `${val.toFixed(0)} ml`;
  return `${val%1===0?val:val.toFixed(1)} ${unite}`;
};

(recette?.ingredients||[]).forEach((ing,i)=>{
  const val = ing.parLitre ? ing.quantite*litres : ing.quantite;
  doc.setFillColor(i%2===0?250:255,i%2===0?250:255,i%2===0?248:255);
  doc.rect(mg,y,W-mg*2,10,"F");
  doc.setDrawColor(240,240,238);doc.setLineWidth(0.2);doc.rect(mg,y,W-mg*2,10,"S");
  doc.setFontSize(10);doc.setFont("helvetica","normal");doc.setTextColor(17,17,17);
  doc.text(ing.nom,mg+3,y+7);
  doc.setFont("helvetica","bold");doc.setFontSize(11);
  doc.text(affQte(val,ing.unite),W-mg-2,y+7,{align:"right"});
  y+=10;
});
y+=8;

// Marche à suivre
const etapes = recette?.marcheASuivre||[];
if(etapes.length>0){
  // Vérifier si on a besoin d'une nouvelle page
  if(y+10+(etapes.length*8)>270){doc.addPage();doc.setFillColor(242,201,76);doc.rect(0,0,W,6,"F");y=18;}
  y+=6;
  doc.setFillColor(17,17,17);doc.rect(mg,y,W-mg*2,9,"F");
  doc.setFontSize(8);doc.setFont("helvetica","bold");doc.setTextColor(242,201,76);
  doc.text("MARCHE À SUIVRE",mg+3,y+6);
  y+=9;
  etapes.forEach((etape,i)=>{
    const lignes=doc.splitTextToSize(`${i+1}. ${etape}`,W-mg*2-12);
    const h=Math.max(8,lignes.length*5+4);
    doc.setFillColor(i%2===0?250:255,i%2===0?250:255,i%2===0?248:255);
    doc.rect(mg,y,W-mg*2,h,"F");
    doc.setDrawColor(240,240,238);doc.setLineWidth(0.2);doc.rect(mg,y,W-mg*2,h,"S");
    // Numéro en doré
    doc.setFillColor(242,201,76);doc.circle(mg+5,y+h/2,3,"F");
    doc.setFontSize(7);doc.setFont("helvetica","bold");doc.setTextColor(17,17,17);
    doc.text(String(i+1),mg+5,y+h/2+2.5,{align:"center"});
    // Texte
    doc.setFontSize(8.5);doc.setFont("helvetica","normal");doc.setTextColor(30,30,30);
    doc.text(lignes,mg+11,y+5);
    y+=h;
    // Saut de page si nécessaire
    if(y>265&&i<etapes.length-1){doc.addPage();doc.setFillColor(242,201,76);doc.rect(0,0,W,6,"F");y=18;}
  });
  y+=4;
}

// Notes
if(notes){
  y+=2;
  doc.setFontSize(8);doc.setFont("helvetica","bold");doc.setTextColor(156,163,175);
  doc.text("NOTES",mg,y);
  doc.setDrawColor(242,201,76);doc.setLineWidth(0.5);doc.line(mg,y+1,mg+12,y+1);
  y+=6;
  doc.setFontSize(9);doc.setFont("helvetica","normal");doc.setTextColor(17,17,17);
  doc.text(notes,mg,y,{maxWidth:W-mg*2});
  y+=12;
}

// Ligne signature
y+=10;
if(y>270){doc.addPage();doc.setFillColor(242,201,76);doc.rect(0,0,W,6,"F");y=30;}
doc.setDrawColor(200,200,200);doc.setLineWidth(0.3);
doc.line(mg,y,mg+55,y);doc.line(W-mg-55,y,W-mg,y);
doc.setFontSize(8);doc.setTextColor(150,150,150);
doc.text("Préparé par",mg,y+4);doc.text("Contrôlé par",W-mg-55,y+4);

// Bande jaune bas
doc.setFillColor(242,201,76);doc.rect(0,291,W,6,"F");

const nomFichier = "Fiche_maceration_"+(numLot||genLot(dateDebut)).replace(/[^a-zA-Z0-9]/g,"_")+".pdf";
doc.save(nomFichier);
} catch(e:any){alert("Erreur PDF : "+e.message);}
};

const Partenaires = ({st,setSt}) => {
const [modal,setModal] = useState(null);
const [selected,setSelected] = useState(null);
const [view,setView] = useState(null);
const [sigMode,setSigMode] = useState(false);
const [form,setForm] = useState({nom:"",adresse:"",npa:"",ville:"",contact:"",tel:"",email:"",site:"",type:"depot-vente",commission:0,statut:"actif"});
const [livForm,setLivForm] = useState({type:"depot-vente",date:today(),lignes:[{produitId:"",qte:1}],notes:""});
const [signingBulletin,setSigningBulletin] = useState(null);
const [showContratDetail,setShowContratDetail] = useState(false);

const savePV = () => {
if(!form.nom) return;
if(form.id) setSt(p=>({...p,partenaires:p.partenaires.map(x=>x.id===form.id?form:x)}));
else setSt(p=>({...p,partenaires:[...p.partenaires,{...form,id:uid()}]}));
setModal(null);
};

const supprimerPV = (pv) => {
const hasStock = (st.depotStocks||[]).some(d=>d.partenaireId===pv.id&&(d.qteDeposee>0||d.qteVendue>0));
const hasContrats = (st.contrats||[]).some(c=>c.partenaireId===pv.id);
let msg = `Supprimer "${pv.nom}" définitivement ?`;
if(hasStock||hasContrats) msg += "\n\n⚠️ Attention : les bulletins et stocks associés seront aussi supprimés.";
if(!window.confirm(msg)) return;
setSt(p=>({
  ...p,
  partenaires:p.partenaires.filter(x=>x.id!==pv.id),
  depotStocks:(p.depotStocks||[]).filter(d=>d.partenaireId!==pv.id),
  contrats:(p.contrats||[]).filter(c=>c.partenaireId!==pv.id),
}));
setView(null);
};

const addLigne = () => setLivForm(p=>({...p,lignes:[...p.lignes,{produitId:"",qte:1}]}));
const updLigne = (i,k,v) => setLivForm(p=>({...p,lignes:p.lignes.map((l,j)=>j===i?{...l,[k]:v}:l)}));
const delLigne = i => setLivForm(p=>({...p,lignes:p.lignes.filter((_,j)=>j!==i)}));

const saveLivraison = (sig) => {
const pv = selected;
if(!pv) { alert("Aucun partenaire sélectionné"); return; }
const lignesValides = (livForm.lignes||[]).filter(l=>l.produitId&&l.qte>0);
if(!lignesValides.length) {
alert("⚠️ Tu dois ajouter au moins un produit avec une quantité !");
return;
}
// Générer numéro unique en regardant les contrats existants
const y = new Date().getFullYear();
const prefix = livForm.type==="depot-vente"?"DPT":"LIV";
const existingNums = (st.contrats||[]).map(c=>c.numero||"");
let n = 1;
while(existingNums.includes(prefix+"-"+y+"-"+String(n).padStart(3,"0"))) n++;
const num = prefix+"-"+y+"-"+String(n).padStart(3,"0");

// Mettre à jour le stock dépôt
const newDepots = [...(st.depotStocks||[])];
lignesValides.forEach(l=>{
  const existing = newDepots.find(d=>d.partenaireId===pv.id&&d.produitId===l.produitId);
  if(existing) {
    existing.qteDeposee += +l.qte;
    existing.dateInventaire = livForm.date;
  } else {
    newDepots.push({id:uid(),partenaireId:pv.id,produitId:l.produitId,qteDeposee:+l.qte,qteVendue:0,qteRetournee:0,dateDepot:livForm.date,dateInventaire:livForm.date});
  }
});

// Créer le document livraison
const doc = {
  id:uid(), numero:num, type:livForm.type,
  partenaireId:pv.id, date:livForm.date,
  lignes:lignesValides, notes:livForm.notes,
  signature:sig||null, statut:sig?"signé":"en attente",
  createdAt:today(),
};

// Auto-créer la facture si livraison ferme signée
let autoFac = null;
let autoFacNum = "";
if(livForm.type==="livraison" && sig) {
  const yF = new Date().getFullYear();
  const existingFacNums = (st.factures||[]).map(f=>f.numero);
  let fn=1;
  while(existingFacNums.includes("FAC-"+yF+"-"+String(fn).padStart(3,"0"))) fn++;
  autoFacNum = "FAC-"+yF+"-"+String(fn).padStart(3,"0");
  autoFac = {
    id:uid(), numero:autoFacNum, date:livForm.date,
    partenaireId:pv.id, typeClient:"revendeur",
    lignes:lignesValides, statut:"en attente",
    notes:"Facture auto — "+num, envoyee:false, bulletinId:doc.id,
  };
}

setSt(p=>({...p,
  depotStocks:newDepots,
  contrats:[...p.contrats,{
    id:doc.id, numero:doc.numero, type:doc.type,
    partenaireId:doc.partenaireId, dateSignature:sig?doc.date:null,
    dateDebut:doc.date, dateFin:"", commission:pv.commission||0,
    statut:doc.statut, lignes:doc.lignes, notes:doc.notes,
    signClient:doc.signature, signFournisseur:null,
    lieuSignature:"", livraison:true,
  }],
  factures: autoFac ? [...(p.factures||[]), autoFac] : (p.factures||[]),
}));

setModal(null);
setSigMode(false);
setLivForm({type:"depot-vente",date:today(),lignes:[{produitId:"",qte:1}],notes:""});
if(autoFac) {
  alert(num+" enregistré avec signature.\n✅ Facture "+autoFacNum+" créée — pensez à l'envoyer (alerte sur l'Accueil).");
} else {
  alert(num+" enregistré"+(sig?" avec signature":"")+".");
}

};

const doInventaire = (pv) => {
// Générer la facture pour les ventes
const depots = (st.depotStocks||[]).filter(d=>d.partenaireId===pv.id);
const vendus = depots.filter(d=>d.qteVendue>0);
if(!vendus.length){ alert("Aucune vente à facturer."); return; }
const num = "FAC-"+new Date().getFullYear()+"-"+String((st.factures||[]).length+1).padStart(3,"0");
const lignes = vendus.map(d=>({produitId:d.produitId,qte:d.qteVendue}));
const newFac = {id:uid(),numero:num,date:today(),partenaireId:pv.id,typeClient:"revendeur",lignes,statut:"en attente",datePaiement:"",notes:"Inventaire dépôt-vente",envoyee:false};
// Réduire qteDeposee pour les ventes + retraits, et réinitialiser les compteurs
// Supprimer les lignes vides, garder celles avec du stock restant
const newDepots = (st.depotStocks||[]).map(d=>{
if(d.partenaireId!==pv.id) return d;
const resteApresOp = d.qteDeposee - d.qteVendue - (d.qteRetournee||0);
return {...d, qteDeposee: resteApresOp, qteVendue: 0, qteRetournee: 0, dateInventaire: today()};
}).filter(d=>d.qteDeposee>0); // supprimer les lignes vides après inventaire
setSt(p=>({...p,factures:[...(p.factures||[]),newFac],depotStocks:newDepots}));
alert("Facture "+num+" créée ! 📤 Pensez à l'envoyer au partenaire.\nLe stock a été mis à jour.");
};

const envoyerBulletin = (contrat) => {
const pv = st.partenaires.find(p=>p.id===contrat.partenaireId);
const lignesTxt = (contrat.lignes||[]).map(l=>{
const prod = st.produits.find(p=>p.id===l.produitId);
return `• ${prod?.nom} ${prod?.variante} ${prod?.format} x${l.qte}`;
}).join("\n");
const typeLabel = contrat.type==="depot-vente"?"Bon de dépôt-vente":"Bon de livraison";
const subj = encodeURIComponent(`${typeLabel} ${contrat.numero} - Goutstoso`);
const contact = pv?.contact || pv?.nom || "";
const bodyStr =
`Bonjour ${contact},\n\n`+
`Veuillez trouver ci-joint le ${typeLabel} N° ${contrat.numero} du ${fmt(contrat.dateDebut)}.\n\n`+
`Détail des produits :\n${lignesTxt}\n\n`+
(contrat.statut==="signé"
  ? `Ce document est signé et enregistré dans nos dossiers.\n\n`
  : `Si ce document n'a pas encore été signé, merci de nous le retourner signé dans les plus brefs délais.\n\n`
)+
`Pour toute question, n'hésitez pas à nous contacter à admin@goutstoso.ch.\n\n`+
`Cordialement,\n\nJordan Montanaro\nGoûtstoso\nadmin@goutstoso.ch · www.goutstoso.ch`;
if(!pv?.email) { alert("Aucun email pour ce partenaire"); return; }
sendEmail({to:pv?.email||"",toName:contact,subject:decodeURIComponent(subj),body:bodyStr});
};

// Vue liste des bulletins d'un partenaire
if(view) {
const pv = view;
const docs = (st.contrats||[]).filter(c=>c.partenaireId===pv.id&&c.livraison);
const depots = (st.depotStocks||[]).filter(d=>d.partenaireId===pv.id);

if(signingBulletin) return (
<div className="fade">
<button onClick={()=>setSigningBulletin(null)} style={{display:"flex",alignItems:"center",gap:6,background:"none",border:"none",color:"#9CA3AF",fontSize:13,marginBottom:16,padding:0,cursor:"pointer"}}>← Retour</button>
<div style={{background:"#FEF9E7",borderRadius:12,padding:"12px 14px",marginBottom:16,border:"1.5px solid #F2C94C"}}>
  <p style={{fontWeight:700,fontSize:13}}>✍️ Signature client</p>
  <p style={{fontSize:11,color:"#92400E",marginTop:4}}>{signingBulletin.numero} — {pv.nom}</p>
</div>
<SignaturePad
  onSave={(sig)=>{
    setSt(p=>({...p,contrats:p.contrats.map(c=>c.id===signingBulletin.id?{...c,signClient:sig,statut:"signé"}:c)}));
    setSigningBulletin(null);
  }}
  onCancel={()=>setSigningBulletin(null)}
/>
{signingBulletin.signClient&&(
  <div style={{marginTop:12,padding:"10px 12px",background:"#F5F5F0",borderRadius:10}}>
    <p style={{fontSize:11,color:"#6B7280",marginBottom:6}}>Signature actuelle :</p>
    <img src={signingBulletin.signClient} alt="sig" style={{height:36,maxWidth:160,objectFit:"contain"}}/>
    <button onClick={()=>{
      setSt(p=>({...p,contrats:p.contrats.map(c=>c.id===signingBulletin.id?{...c,signClient:null,statut:"en attente"}:c)}));
      setSigningBulletin(null);
    }} style={{display:"block",marginTop:8,background:"#FEE2E2",border:"none",borderRadius:8,padding:"6px 12px",fontSize:11,color:"#991B1B",cursor:"pointer"}}>Effacer</button>
  </div>
)}
</div>
);

return (
<>
<div className="fade">
<button onClick={()=>setView(null)} style={{display:"flex",alignItems:"center",gap:6,background:"none",border:"none",color:"#9CA3AF",fontSize:13,marginBottom:16,padding:0,cursor:"pointer"}}>← Retour</button>

{/* Carte identité partenaire */}
<div style={{background:"#111",borderRadius:14,padding:"16px",marginBottom:14}}>
  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
    <div style={{flex:1,minWidth:0}}>
      {pv.logo && <img src={pv.logo} alt="logo" style={{height:40,maxWidth:90,objectFit:"contain",borderRadius:8,border:"1px solid rgba(255,255,255,.15)",background:"#fff",padding:4,marginBottom:8,display:"block"}}/>}
      <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,fontWeight:700,color:"#fff",lineHeight:1.2}}>{pv.nom}</p>
      {(pv.adresse||pv.npa||pv.ville) && (
        <p style={{fontSize:11,color:"#9CA3AF",marginTop:4}}>
          📍 {[pv.adresse,[pv.npa,pv.ville].filter(Boolean).join(" ")].filter(Boolean).join(", ")}
        </p>
      )}
    </div>
    <Badge c={pv.statut==="actif"?"green":"gray"}>{pv.statut}</Badge>
  </div>
  <div style={{borderTop:"1px solid rgba(255,255,255,.1)",paddingTop:10,display:"flex",flexDirection:"column",gap:6}}>
    {pv.contact && <p style={{fontSize:12,color:"#D1D5DB"}}>👤 {pv.contact}</p>}
    {pv.tel && (
      <a href={"tel:"+pv.tel} style={{fontSize:12,color:"#A3E635",textDecoration:"none"}}>📞 {pv.tel}</a>
    )}
    {pv.email && (
      <a href={"mailto:"+pv.email} style={{fontSize:12,color:"#60A5FA",textDecoration:"none",wordBreak:"break-all"}}>✉️ {pv.email}</a>
    )}
    {pv.site && (
      <a href={pv.site.startsWith("http")?pv.site:"https://"+pv.site} target="_blank" rel="noreferrer" style={{fontSize:12,color:"#C4B5FD",textDecoration:"none"}}>🌐 {pv.site}</a>
    )}
    {pv.commission>0 && <p style={{fontSize:11,color:"#FCD34D",marginTop:2}}>Commission : {pv.commission}%</p>}
  </div>
</div>

    {/* Contrat actif */}
    {(()=>{
      const contratsDepot = (st.contrats||[]).filter(c=>c.partenaireId===pv.id&&!c.livraison).slice().reverse();
      const contrat = contratsDepot.find(c=>c.statut==="signé"||c.statut==="actif") || contratsDepot[0];
      if(!contrat) return (
        <div style={{background:"#F5F5F0",borderRadius:12,padding:"12px 14px",marginBottom:12,border:"1px solid #EAE7E0",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <p style={{fontSize:12,color:"#9CA3AF"}}>Aucun contrat enregistré</p>
        </div>
      );
      const isActif = contrat.statut==="signé"||contrat.statut==="actif";
      return (
        <div style={{marginBottom:12}}>
          <div onClick={()=>setShowContratDetail(!showContratDetail)} style={{background:isActif?"#F0FDF4":"#FEF9E7",borderRadius:showContratDetail?12:12,padding:"12px 14px",border:"1px solid "+(isActif?"#BBF7D0":"#FDE68A"),cursor:"pointer"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{flex:1}}>
                <p style={{fontSize:10,fontWeight:600,color:"#6B7280",textTransform:"uppercase",letterSpacing:"0.04em",marginBottom:2}}>Contrat · Appuyer pour voir</p>
                <p style={{fontSize:13,fontWeight:700}}>{contrat.numero} · {contrat.type}</p>
                <p style={{fontSize:11,color:"#6B7280",marginTop:2}}>Depuis {fmt(contrat.dateDebut)}{contrat.dateFin?" · Fin: "+fmt(contrat.dateFin):""}{contrat.commission>0?" · Commission: "+contrat.commission+"%":""}</p>
              </div>
              <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6}}>
                <Badge c={isActif?"green":contrat.statut==="résilié"?"red":"gray"}>{contrat.statut||"brouillon"}</Badge>
                <span style={{fontSize:11,color:"#9CA3AF"}}>{showContratDetail?"▲":"▼"}</span>
              </div>
            </div>
          </div>
          {showContratDetail && (
            <div style={{background:"#fff",border:"1px solid #EAE7E0",borderTop:"none",borderRadius:"0 0 12px 12px",padding:"12px 14px"}}>
              {contratsDepot.map((c,idx)=>{
                const isCurr = c.id===contrat.id;
                const lignesProd = (c.lignes||[]).filter(l=>l.produitId);
                return (
                  <div key={c.id} style={{paddingBottom:idx<contratsDepot.length-1?12:0,borderBottom:idx<contratsDepot.length-1?"1px solid #F5F5F0":"none",marginBottom:idx<contratsDepot.length-1?12:0}}>
                    {contratsDepot.length>1 && <p style={{fontSize:10,fontWeight:700,color:"#9CA3AF",marginBottom:6}}>{isCurr?"▶ ACTUEL ":""}CONTRAT {idx+1}</p>}
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:8}}>
                      <div style={{background:"#F9F9F6",borderRadius:8,padding:"8px 10px"}}>
                        <p style={{fontSize:9,color:"#9CA3AF",fontWeight:600,textTransform:"uppercase"}}>Type</p>
                        <p style={{fontSize:12,fontWeight:600,marginTop:2}}>{c.type}</p>
                      </div>
                      <div style={{background:"#F9F9F6",borderRadius:8,padding:"8px 10px"}}>
                        <p style={{fontSize:9,color:"#9CA3AF",fontWeight:600,textTransform:"uppercase"}}>Statut</p>
                        <p style={{fontSize:12,fontWeight:600,marginTop:2}}>{c.statut||"brouillon"}</p>
                      </div>
                      <div style={{background:"#F9F9F6",borderRadius:8,padding:"8px 10px"}}>
                        <p style={{fontSize:9,color:"#9CA3AF",fontWeight:600,textTransform:"uppercase"}}>Début</p>
                        <p style={{fontSize:12,fontWeight:600,marginTop:2}}>{fmt(c.dateDebut)}</p>
                      </div>
                      {c.dateFin && <div style={{background:"#F9F9F6",borderRadius:8,padding:"8px 10px"}}>
                        <p style={{fontSize:9,color:"#9CA3AF",fontWeight:600,textTransform:"uppercase"}}>Fin</p>
                        <p style={{fontSize:12,fontWeight:600,marginTop:2}}>{fmt(c.dateFin)}</p>
                      </div>}
                      {c.commission>0 && <div style={{background:"#F9F9F6",borderRadius:8,padding:"8px 10px"}}>
                        <p style={{fontSize:9,color:"#9CA3AF",fontWeight:600,textTransform:"uppercase"}}>Commission</p>
                        <p style={{fontSize:12,fontWeight:600,marginTop:2}}>{c.commission}%</p>
                      </div>}
                      {c.lieuSignature && <div style={{background:"#F9F9F6",borderRadius:8,padding:"8px 10px"}}>
                        <p style={{fontSize:9,color:"#9CA3AF",fontWeight:600,textTransform:"uppercase"}}>Lieu signature</p>
                        <p style={{fontSize:12,fontWeight:600,marginTop:2}}>{c.lieuSignature}</p>
                      </div>}
                    </div>
                    {lignesProd.length>0 && (
                      <div style={{marginBottom:8}}>
                        <p style={{fontSize:10,fontWeight:600,color:"#6B7280",marginBottom:6}}>Produits concernés</p>
                        {lignesProd.map((l,i)=>{
                          const p = st.produits.find(x=>x.id===l.produitId);
                          return <p key={i} style={{fontSize:11,color:"#374151",marginBottom:3}}>• {p?.nom} {p?.variante} {p?.format}</p>;
                        })}
                      </div>
                    )}
                    {c.notes && <p style={{fontSize:11,color:"#6B7280",fontStyle:"italic"}}>📝 {c.notes}</p>}
                    <div style={{display:"flex",gap:8,marginTop:8}}>
                      {c.signClient && <span style={{fontSize:10,color:"#166534",background:"#DCFCE7",borderRadius:20,padding:"3px 10px",fontWeight:600}}>✅ Signé client</span>}
                      {c.signFournisseur && <span style={{fontSize:10,color:"#166534",background:"#DCFCE7",borderRadius:20,padding:"3px 10px",fontWeight:600}}>✅ Signé fournisseur</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      );
    })()}

    {/* Factures liées */}
    {(()=>{
      const facturesPV = (st.factures||[]).filter(f=>f.partenaireId===pv.id).slice().reverse();
      return (
        <div style={{marginBottom:16}}>
          <h3 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:18,marginBottom:10}}>Factures</h3>
          {facturesPV.length===0
            ? <p style={{fontSize:12,color:"#9CA3AF",textAlign:"center",padding:"10px 0"}}>Aucune facture pour ce dépôt</p>
            : facturesPV.slice(0,8).map(f=>{
                const total = calcTotalNet(f,st.produits);
                const isPaid = f.statut==="payée";
                const isToSend = f.envoyee===false && !isPaid;
                return (
                  <Card key={f.id} style={{marginBottom:8,padding:"12px 14px",background:isToSend?"#FFFBEB":isPaid?"#F0FDF4":"#fff",border:"1px solid "+(isToSend?"#FDE68A":isPaid?"#BBF7D0":"#EAE7E0")}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <div style={{flex:1,minWidth:0}}>
                        <p style={{fontSize:13,fontWeight:700}}>{f.numero}</p>
                        <p style={{fontSize:11,color:"#6B7280",marginTop:2}}>{fmt(f.date)} · CHF {total.toFixed(2)}</p>
                        {isToSend && <p style={{fontSize:10,color:"#92400E",fontWeight:700,marginTop:3}}>📤 À envoyer</p>}
                        {f.envoyee && !isPaid && <p style={{fontSize:10,color:"#1E40AF",fontWeight:600,marginTop:3}}>✉️ Envoyée — en attente de paiement</p>}
                      </div>
                      <Badge c={isPaid?"green":f.envoyee?"blue":"yellow"}>{isPaid?"Payée":f.envoyee?"Envoyée":"En attente"}</Badge>
                    </div>
                  </Card>
                );
              })
          }
        </div>
      );
    })()}

    {/* Stock en dépôt */}
    <Card style={{marginBottom:16}}>
      <h3 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:17,marginBottom:10}}>Stock en dépôt</h3>
      {depots.length===0
        ? <p style={{fontSize:12,color:"#9CA3AF",textAlign:"center",padding:"10px 0"}}>Aucun stock déposé</p>
        : depots.map(d=>{
            const p = st.produits.find(x=>x.id===d.produitId);
            const reste = d.qteDeposee - d.qteVendue - d.qteRetournee;
            return (
              <div key={d.id} style={{padding:"10px 0",borderBottom:"1px solid #F5F5F0"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                  <div style={{flex:1,minWidth:0}}>
                    <p style={{fontSize:13,fontWeight:600}}>{p?.nom} {p?.variante} {p?.format}</p>
                    <p style={{fontSize:10,color:"#9CA3AF",marginTop:1}}>
                      Déposé: {d.qteDeposee} · Vendu: {d.qteVendue} · Retourné: {d.qteRetournee||0}
                    </p>
                  </div>
                  <div style={{background:reste<=2?"#FEE2E2":"#DCFCE7",borderRadius:8,padding:"6px 10px",textAlign:"center",marginLeft:10}}>
                    <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,fontWeight:700,color:reste<=2?"#991B1B":"#166534",lineHeight:1}}>{reste}</p>
                    <p style={{fontSize:9,color:"#9CA3AF"}}>restant</p>
                  </div>
                </div>
                <div style={{display:"flex",gap:6}}>
                  <button onClick={()=>{
                    const n = parseInt(window.prompt("Nombre de ventes à ajouter pour "+p?.nom+" "+p?.variante+" "+p?.format+" ?","1"));
                    if(!n||n<1) return;
                    if(n>reste){alert("Maximum "+reste+" disponibles");return;}
                    setSt(p2=>({...p2,depotStocks:p2.depotStocks.map(x=>x.id===d.id?{...x,qteVendue:x.qteVendue+n}:x)}));
                  }} style={{flex:2,background:"#166534",color:"#fff",border:"none",borderRadius:8,padding:"7px",fontSize:11,fontWeight:600,cursor:"pointer"}}>
                    + Vente
                  </button>
                  <button onClick={()=>{
                    const n = parseInt(window.prompt("Nombre de retours pour "+p?.nom+" "+p?.variante+" "+p?.format+" ?","1"));
                    if(!n||n<1) return;
                    if(n>reste){alert("Maximum "+reste+" disponibles");return;}
                    setSt(p2=>({...p2,depotStocks:p2.depotStocks.map(x=>x.id===d.id?{...x,qteRetournee:(x.qteRetournee||0)+n}:x)}));
                  }} style={{flex:1,background:"#F5F5F0",border:"none",borderRadius:8,padding:"7px",fontSize:11,fontWeight:500,cursor:"pointer"}}>
                    ↩ Retour
                  </button>
                  <button onClick={()=>{
                    if(d.qteVendue===0 && (d.qteRetournee||0)===0) {
                      if(!window.confirm("Supprimer cette ligne de dépôt ?")) return;
                      setSt(p2=>({...p2,depotStocks:p2.depotStocks.filter(x=>x.id!==d.id)}));
                    } else {
                      if(!window.confirm("Réinitialiser les ventes/retours de cette ligne ?")) return;
                      setSt(p2=>({...p2,depotStocks:p2.depotStocks.map(x=>x.id===d.id?{...x,qteVendue:0,qteRetournee:0}:x)}));
                    }
                  }} style={{background:"#FEE2E2",border:"none",borderRadius:8,padding:"7px 10px",cursor:"pointer",display:"flex"}}>
                    <Ic n="trash" s={13}/>
                  </button>
                </div>
              </div>
            );
          })
      }
    </Card>

    {/* Actions */}
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
      <button onClick={()=>{setSelected(pv);setModal("livraison");}} style={{background:"#F2C94C",border:"none",borderRadius:12,padding:"12px",fontWeight:700,fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
        📦 Nouvelle livraison
      </button>
      <button onClick={()=>doInventaire(pv)} style={{background:"#DCFCE7",border:"none",borderRadius:12,padding:"12px",fontWeight:600,fontSize:13,color:"#166534",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
        📋 Faire l'inventaire
      </button>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
      <button onClick={()=>{setForm({...pv});setView(null);setModal("form");}} style={{background:"#F5F5F0",border:"none",borderRadius:12,padding:"12px",fontWeight:600,fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
        <Ic n="edit" s={14}/> Modifier
      </button>
      <button onClick={()=>supprimerPV(pv)} style={{background:"#FEE2E2",color:"#991B1B",border:"none",borderRadius:12,padding:"12px",fontWeight:600,fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
        <Ic n="trash" s={14}/> Supprimer
      </button>
    </div>

    {/* Bulletins */}
    <h3 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:18,marginBottom:10}}>Bulletins</h3>
    {docs.length===0
      ? <p style={{fontSize:12,color:"#9CA3AF",textAlign:"center",padding:"20px 0"}}>Aucun bulletin</p>
      : docs.slice().reverse().map(c=>(
          <Card key={c.id} style={{marginBottom:8,padding:"12px 14px"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
              <div style={{flex:1}}>
                <p style={{fontWeight:700,fontSize:13}}>{c.numero}</p>
                <p style={{fontSize:11,color:"#9CA3AF"}}>{c.type==="depot-vente"?"Dépôt-vente":"Livraison ferme"} · {fmt(c.dateDebut)}</p>
                <p style={{fontSize:11,color:"#6B7280",marginTop:2}}>{(c.lignes||[]).length} produit(s)</p>
              </div>
              <Badge c={c.statut==="signé"?"green":"yellow"}>{c.statut}</Badge>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
              <button onClick={()=>genererBulletinPDF(c,pv,st)} style={{background:"#111",color:"#F2C94C",border:"none",borderRadius:8,padding:"8px",fontSize:11,fontWeight:700,cursor:"pointer"}}>📄 PDF</button>
              <button onClick={()=>envoyerBulletin(c)} style={{background:"#F5F5F0",border:"none",borderRadius:8,padding:"8px",fontSize:11,fontWeight:600,cursor:"pointer"}}>✉️ Envoyer</button>
              <button onClick={()=>setSigningBulletin(c)} style={{background:c.signClient?"#DCFCE7":"#FEF9E7",color:c.signClient?"#166534":"#92400E",border:"none",borderRadius:8,padding:"8px",fontSize:11,fontWeight:600,cursor:"pointer"}}>{c.signClient?"✅ Signé":"✍️ Signer"}</button>
              <button onClick={()=>{
                if(window.confirm("Modifier ce bulletin ? La signature sera perdue.")) {
                  // Reload livraison form with this data
                  setLivForm({type:c.type,date:c.dateDebut,lignes:c.lignes||[{produitId:"",qte:1}],notes:c.notes||""});
                  setSt(p=>({...p,contrats:p.contrats.filter(x=>x.id!==c.id)}));
                  // Restore stock that was deposited
                  const newDepots = [...(st.depotStocks||[])];
                  (c.lignes||[]).forEach(l=>{
                    const ex = newDepots.find(d=>d.partenaireId===c.partenaireId&&d.produitId===l.produitId);
                    if(ex) ex.qteDeposee = Math.max(0, ex.qteDeposee - (+l.qte));
                  });
                  setSt(p=>({...p,depotStocks:newDepots}));
                  setSelected(pv);
                  setModal("livraison");
                  setView(null);
                }
              }} style={{background:"#F5F5F0",border:"none",borderRadius:8,padding:"7px",fontSize:11,fontWeight:600,cursor:"pointer"}}>✏️ Modifier</button>
              <button onClick={()=>{
                if(window.confirm("Supprimer définitivement ce bulletin ? Le stock déposé sera retiré.")) {
                  // Restore stock
                  const newDepots = (st.depotStocks||[]).map(d=>{
                    if(d.partenaireId!==c.partenaireId) return d;
                    const ligne = (c.lignes||[]).find(l=>l.produitId===d.produitId);
                    if(!ligne) return d;
                    return {...d, qteDeposee: Math.max(0, d.qteDeposee - (+ligne.qte))};
                  }).filter(d=>d.qteDeposee>0||d.qteVendue>0);
                  setSt(p=>({...p,
                    contrats:p.contrats.filter(x=>x.id!==c.id),
                    depotStocks:newDepots,
                  }));
                }
              }} style={{background:"#FEE2E2",border:"none",borderRadius:8,padding:"7px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
                <Ic n="trash" s={13}/>
              </button>
            </div>
          </Card>
        ))
    }

  </div>

  {/* Modal livraison — inclus dans la vue détail aussi */}
  {modal==="livraison"&&selected&&(
    <Modal title={`Livraison - ${selected.nom}`} onClose={()=>{setModal(null);setSigMode(false);}}>
      {!sigMode ? (
        <div style={{display:"grid",gap:14}}>
          <Sel label="Type de document" value={livForm.type} onChange={v=>setLivForm(p=>({...p,type:v}))}
            options={[{v:"depot-vente",l:"📋 Bon de dépôt-vente"},{v:"livraison",l:"🚚 Bon de livraison ferme"}]}/>
          <F label="Date" type="date" value={livForm.date} onChange={v=>setLivForm(p=>({...p,date:v}))}/>
          <div>
            <label style={{fontSize:11,fontWeight:600,color:"#9CA3AF",textTransform:"uppercase",letterSpacing:".06em",display:"block",marginBottom:8}}>Produits</label>
            {livForm.lignes.map((l,i)=>(
              <div key={i} style={{display:"grid",gridTemplateColumns:"1fr auto auto",gap:8,marginBottom:8,alignItems:"flex-end"}}>
                <Sel label="" value={l.produitId} onChange={v=>updLigne(i,"produitId",v)}
                  options={[{v:"",l:"- Produit -"},...(st.produits||[]).filter(p=>p.actif&&!p.nom.includes("Coffret")).map(p=>({v:p.id,l:`${p.nom} ${p.variante} ${p.format}`}))]}/>
                <div style={{width:60}}>
                  <input type="number" value={l.qte} min={1} onChange={e=>updLigne(i,"qte",+e.target.value)}
                    style={{width:60,padding:"11px 8px",fontSize:16,border:"1.5px solid #E5E5E0",borderRadius:10,textAlign:"center"}}/>
                </div>
                <button onClick={()=>delLigne(i)} style={{background:"#FEE2E2",border:"none",borderRadius:8,padding:"10px 8px",cursor:"pointer",display:"flex",alignItems:"center"}}>
                  <Ic n="trash" s={14}/>
                </button>
              </div>
            ))}
            <button onClick={addLigne} style={{background:"none",border:"1.5px dashed #E5E5E0",borderRadius:10,padding:"8px",width:"100%",color:"#9CA3AF",fontSize:13,cursor:"pointer",marginTop:2}}>
              + Ajouter un produit
            </button>
          </div>
          <F label="Notes" value={livForm.notes||""} onChange={v=>setLivForm(p=>({...p,notes:v}))} placeholder="Observations..."/>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginTop:4}}>
            <button onClick={()=>saveLivraison(null)} style={{background:"#F5F5F0",border:"none",borderRadius:12,padding:"13px",fontWeight:600,fontSize:13,cursor:"pointer"}}>
              Enregistrer sans signature
            </button>
            <button onClick={()=>{
              const lignesValides = (livForm.lignes||[]).filter(l=>l.produitId&&l.qte>0);
              if(!lignesValides.length) { alert("⚠️ Ajoute au moins un produit avec quantité avant de signer"); return; }
              setSigMode(true);
            }} style={{background:"#F2C94C",border:"none",borderRadius:12,padding:"13px",fontWeight:700,fontSize:13,cursor:"pointer"}}>
              ✍️ Faire signer
            </button>
          </div>
        </div>
      ) : (
        <div>
          <div style={{background:"#FEF9E7",borderRadius:10,padding:"10px 12px",marginBottom:14,fontSize:12,color:"#92400E"}}>
            <p style={{fontWeight:700}}>{livForm.type==="depot-vente"?"Bon de dépôt-vente":"Bon de livraison"} · {fmt(livForm.date)}</p>
            <p style={{marginTop:4}}>
              {livForm.lignes.filter(l=>l.produitId).map(l=>{
                const p = (st.produits||[]).find(x=>x.id===l.produitId);
                return `${p?.nom} ${p?.variante} ${p?.format} × ${l.qte}`;
              }).join(" · ")}
            </p>
          </div>
          <SignaturePad onSave={sig=>saveLivraison(sig)} onCancel={()=>setSigMode(false)}/>
        </div>
      )}
    </Modal>
  )}

</>
);

}

return (
<div className="fade">
<SectionTitle action={<Btn icon="plus" onClick={()=>{setForm({nom:"",adresse:"",npa:"",ville:"",contact:"",tel:"",email:"",site:"",type:"depot-vente",commission:0,statut:"actif",id:null,logo:null});setModal("form");}}>Nouveau</Btn>}>
Dépôts-vente
</SectionTitle>

  {st.partenaires.length===0
    ? <div style={{textAlign:"center",padding:"40px 20px",color:"#9CA3AF"}}>
        <p style={{fontSize:40,marginBottom:12}}>🏪</p>
        <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,fontWeight:600,color:"#374151"}}>Aucun dépôt-vente</p>
        <p style={{fontSize:13,marginTop:6}}>Ajoute ton premier point de vente pour commencer.</p>
      </div>
    : st.partenaires.map(pv=>{
        const depots = (st.depotStocks||[]).filter(d=>d.partenaireId===pv.id);
        const totalProduits = sum(depots.map(d=>d.qteDeposee-d.qteVendue-d.qteRetournee));
        const caGenere = sum(depots.map(d=>{
          const p = st.produits.find(x=>x.id===d.produitId);
          return d.qteVendue*(p?.prixRevendeur||0);
        }));
        return (
          <Card key={pv.id} style={{marginBottom:10,cursor:"pointer"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
              <div onClick={()=>setView(pv)} style={{flex:1}}>
                <p style={{fontWeight:700,fontSize:14}}>{pv.nom}</p>
                <p style={{fontSize:11,color:"#6B7280",marginTop:2}}>{pv.adresse}</p>
              </div>
              <div style={{display:"flex",gap:6,alignItems:"center"}}>
                <Badge c={pv.statut==="actif"?"green":"gray"}>{pv.statut}</Badge>
                <button onClick={()=>{setForm({...pv});setModal("form");}} style={{background:"#F5F5F0",border:"none",borderRadius:8,padding:6,cursor:"pointer",display:"flex"}}><Ic n="edit" s={14}/></button>
                <button onClick={e=>{e.stopPropagation();supprimerPV(pv);}} style={{background:"#FEE2E2",border:"none",borderRadius:8,padding:6,cursor:"pointer",display:"flex"}}><Ic n="trash" s={14}/></button>
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}} onClick={()=>setView(pv)}>
              {[
                {l:"En dépôt",v:totalProduits+" u.",c:"#1E3A5F",bg:"#DBEAFE"},
                {l:"CA généré",v:chf(caGenere),c:"#166534",bg:"#DCFCE7"},
                {l:"Type",v:pv.type==="depot-vente"?"Dépôt":"Livraison",c:"#92400E",bg:"#FEF9E7"},
              ].map((k,i)=>(
                <div key={i} style={{background:k.bg,borderRadius:8,padding:"7px 8px",textAlign:"center"}}>
                  <p style={{fontSize:9,color:"#9CA3AF",fontWeight:600,textTransform:"uppercase"}}>{k.l}</p>
                  <p style={{fontSize:12,fontWeight:700,color:k.c,marginTop:2}}>{k.v}</p>
                </div>
              ))}
            </div>
            <button onClick={()=>{setSelected(pv);setModal("livraison");}} style={{width:"100%",marginTop:10,background:"#F2C94C",border:"none",borderRadius:10,padding:"10px",fontWeight:700,fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
              📦 Nouvelle livraison
            </button>
          </Card>
        );
      })
  }

  {/* Modal nouveau partenaire */}
  {modal==="form"&&(
    <Modal title={form.id?"Modifier partenaire":"Nouveau partenaire"} onClose={()=>setModal(null)}>
      <div style={{display:"grid",gap:14}}>
        {/* Logo */}
        <div>
          <p style={{fontSize:11,fontWeight:600,color:"#374151",marginBottom:8}}>Logo du partenaire</p>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            {form.logo && <img src={form.logo} alt="logo" style={{height:50,maxWidth:100,objectFit:"contain",borderRadius:8,border:"1px solid #EAE7E0",background:"#fff",padding:4}}/>}
            <label style={{background:"#F5F5F0",border:"1.5px dashed #D1D5DB",borderRadius:10,padding:"8px 14px",fontSize:12,fontWeight:600,cursor:"pointer",color:"#374151"}}>
              {form.logo ? "🔄 Remplacer" : "📷 Ajouter un logo"}
              <input type="file" accept="image/*" style={{display:"none"}} onChange={e=>{
                const file=e.target.files?.[0]; if(!file) return;
                if(file.size>500000){alert("Image trop lourde (max 500 Ko)");return;}
                const r=new FileReader(); r.onload=ev=>setForm(p=>({...p,logo:ev.target?.result as string})); r.readAsDataURL(file);
              }}/>
            </label>
            {form.logo && <button onClick={()=>setForm(p=>({...p,logo:null}))} style={{background:"#FEE2E2",border:"none",borderRadius:8,padding:"6px 10px",fontSize:11,color:"#991B1B",cursor:"pointer"}}>✕ Retirer</button>}
          </div>
        </div>
        <F label="Nom de l'entreprise" value={form.nom} onChange={v=>setForm(p=>({...p,nom:v}))} required/>
        <F label="Adresse (rue)" value={form.adresse||""} onChange={v=>setForm(p=>({...p,adresse:v}))}/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 2fr",gap:10}}>
          <F label="NPA" value={form.npa||""} onChange={v=>setForm(p=>({...p,npa:v}))} placeholder="2610"/>
          <F label="Ville" value={form.ville||""} onChange={v=>setForm(p=>({...p,ville:v}))} placeholder="Saint-Imier"/>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <F label="Contact (personne)" value={form.contact||""} onChange={v=>setForm(p=>({...p,contact:v}))}/>
          <F label="Téléphone" value={form.tel||""} onChange={v=>setForm(p=>({...p,tel:v}))}/>
        </div>
        <F label="Email" value={form.email||""} onChange={v=>setForm(p=>({...p,email:v}))}/>
        <F label="Site web" value={form.site||""} onChange={v=>setForm(p=>({...p,site:v}))} placeholder="www.exemple.ch"/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <Sel label="Type" value={form.type||"depot-vente"} onChange={v=>setForm(p=>({...p,type:v}))}
            options={[{v:"depot-vente",l:"Dépôt-vente"},{v:"livraison",l:"Livraison ferme"}]}/>
          <F label="Commission (%)" type="number" value={form.commission||""} onChange={v=>setForm(p=>({...p,commission:v}))}/>
        </div>
        <Sel label="Statut" value={form.statut} onChange={v=>setForm(p=>({...p,statut:v}))}
          options={[{v:"actif",l:"Actif"},{v:"inactif",l:"Inactif"}]}/>
      </div>
      <div style={{display:"flex",gap:10,marginTop:20}}>
        <Btn onClick={savePV} full icon="check">Enregistrer</Btn>
        <Btn onClick={()=>setModal(null)} variant="ghost" full>Annuler</Btn>
      </div>
    </Modal>
  )}

  {/* Modal livraison */}
  {modal==="livraison"&&selected&&(
    <Modal title={`Livraison - ${selected.nom}`} onClose={()=>{setModal(null);setSigMode(false);}}>
      {!sigMode ? (
        <div style={{display:"grid",gap:14}}>
          <Sel label="Type de document" value={livForm.type} onChange={v=>setLivForm(p=>({...p,type:v}))}
            options={[{v:"depot-vente",l:"📋 Bon de dépôt-vente"},{v:"livraison",l:"🚚 Bon de livraison ferme"}]}/>
          <F label="Date" type="date" value={livForm.date} onChange={v=>setLivForm(p=>({...p,date:v}))}/>

          <div>
            <label style={{fontSize:11,fontWeight:600,color:"#9CA3AF",textTransform:"uppercase",letterSpacing:".06em",display:"block",marginBottom:8}}>Produits</label>
            {livForm.lignes.map((l,i)=>(
              <div key={i} style={{display:"grid",gridTemplateColumns:"1fr auto auto",gap:8,marginBottom:8,alignItems:"flex-end"}}>
                <Sel label="" value={l.produitId} onChange={v=>updLigne(i,"produitId",v)}
                  options={[{v:"",l:"- Produit -"},...st.produits.filter(p=>p.actif&&!p.nom.includes("Coffret")).map(p=>({v:p.id,l:`${p.nom} ${p.variante} ${p.format}`}))]}/>
                <div style={{width:60}}>
                  <input type="number" value={l.qte} min={1} onChange={e=>updLigne(i,"qte",+e.target.value)}
                    style={{width:60,padding:"11px 8px",fontSize:16,border:"1.5px solid #E5E5E0",borderRadius:10,textAlign:"center"}}/>
                </div>
                <button onClick={()=>delLigne(i)} style={{background:"#FEE2E2",border:"none",borderRadius:8,padding:"10px 8px",cursor:"pointer",display:"flex",alignItems:"center"}}>
                  <Ic n="trash" s={14}/>
                </button>
              </div>
            ))}
            <button onClick={addLigne} style={{background:"none",border:"1.5px dashed #E5E5E0",borderRadius:10,padding:"8px",width:"100%",color:"#9CA3AF",fontSize:13,cursor:"pointer",marginTop:2}}>
              + Ajouter un produit
            </button>
          </div>

          <F label="Notes" value={livForm.notes||""} onChange={v=>setLivForm(p=>({...p,notes:v}))} placeholder="Observations..."/>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginTop:4}}>
            <button onClick={()=>saveLivraison(null)} style={{background:"#F5F5F0",border:"none",borderRadius:12,padding:"13px",fontWeight:600,fontSize:13,cursor:"pointer"}}>
              Enregistrer sans signature
            </button>
            <button onClick={()=>{
              const lignesValides = (livForm.lignes||[]).filter(l=>l.produitId&&l.qte>0);
              if(!lignesValides.length) { alert("⚠️ Ajoute au moins un produit avec quantité avant de signer"); return; }
              setSigMode(true);
            }} style={{background:"#F2C94C",border:"none",borderRadius:12,padding:"13px",fontWeight:700,fontSize:13,cursor:"pointer"}}>
              ✍️ Faire signer
            </button>
          </div>
        </div>
      ) : (
        <div>
          <div style={{background:"#FEF9E7",borderRadius:10,padding:"10px 12px",marginBottom:14,fontSize:12,color:"#92400E"}}>
            <p style={{fontWeight:700}}>
              {livForm.type==="depot-vente"?"Bon de dépôt-vente":"Bon de livraison"} · {fmt(livForm.date)}
            </p>
            <p style={{marginTop:4}}>
              {livForm.lignes.filter(l=>l.produitId).map(l=>{
                const p = st.produits.find(x=>x.id===l.produitId);
                return `${p?.nom} ${p?.variante} ${p?.format} × ${l.qte}`;
              }).join(" · ")}
            </p>
          </div>
          <SignaturePad
            onSave={sig=>saveLivraison(sig)}
            onCancel={()=>setSigMode(false)}
          />
        </div>
      )}
    </Modal>
  )}
</div>

);
};

// ══════════════════════════════════════════════════════════════
// PAGE: CONTRATS - Version simplifiée et robuste
// ══════════════════════════════════════════════════════════════
const Contrats = ({st,setSt}) => {
const [modal,setModal] = useState(null);
const [viewId,setViewId] = useState(null);
const [sigMode,setSigMode] = useState(null); // "fournisseur" | "client" | null
const [form,setForm] = useState(null);
const [filtreC,setFiltreC] = useState("tous");
const [recoveryTokenC, setRecoveryTokenC] = useState("");

// Toujours récupérer le contrat frais depuis le state
const view = viewId ? (st.contrats||[]).find(c=>c.id===viewId) : null;

const emptyC = () => ({
id:null,
numero:"",
type:"depot-vente",
partenaireId:st.partenaires[0]?.id||"",
dateDebut:today(),
dateFin:"",
commission:0,
lignes:[{produitId:"",qte:0,prixUnitaire:0}],
notes:"",
statut:"brouillon",
signFournisseur:null,
signClient:null,
lieuSignature:"Villeret",
modeAcceptation:"signature",
validiteOffre:"30",
});

const genNumero = (type) => {
const prefix = type==="depot-vente"?"DPV":type==="partenariat"?"PAR":type==="offre"?"OFF":"CTR";
const existingNums = (st.contrats||[]).filter(c=>c.type===type&&!c.livraison).map(c=>c.numero);
let n = 1;
while(existingNums.includes(`${prefix}-${new Date().getFullYear()}-${String(n).padStart(3,"0")}`)) n++;
return `${prefix}-${new Date().getFullYear()}-${String(n).padStart(3,"0")}`;
};

const save = () => {
if(!form.partenaireId) { alert("Sélectionne un partenaire"); return; }
const numero = form.numero || genNumero(form.type);
const cleanForm = {...form, numero};
if(form.id) {
setSt(p=>({...p,contrats:(p.contrats||[]).map(c=>c.id===form.id?cleanForm:c)}));
} else {
cleanForm.id = uid();
setSt(p=>({...p,contrats:[...(p.contrats||[]),cleanForm]}));
}
setModal(null);
setForm(null);
};

const supprimer = (id) => {
if(!window.confirm("Supprimer définitivement ce contrat ?")) return;
setSt(p=>({...p,contrats:(p.contrats||[]).filter(c=>c.id!==id)}));
setViewId(null);
};

const signer = (sig) => {
if(!view) return;
const updated = {
...view,
signFournisseur: sigMode==="fournisseur"?sig:view.signFournisseur,
signClient: sigMode==="client"?sig:view.signClient,
dateSignature: today(),
};
if(updated.signFournisseur && updated.signClient) updated.statut = "signé";
else if(updated.signFournisseur || updated.signClient) updated.statut = "en attente signature";
setSt(p=>({...p,contrats:(p.contrats||[]).map(c=>c.id===view.id?updated:c)}));
setSigMode(null);
};

const effacerSignature = (target) => {
if(!view) return;
if(!window.confirm("Effacer cette signature ?")) return;
const updated = {
...view,
signFournisseur: target==="fournisseur"?null:view.signFournisseur,
signClient: target==="client"?null:view.signClient,
};
updated.statut = (updated.signFournisseur&&updated.signClient)?"signé":(updated.signFournisseur||updated.signClient)?"en attente signature":"brouillon";
setSt(p=>({...p,contrats:(p.contrats||[]).map(c=>c.id===view.id?updated:c)}));
};

const addLigne = () => setForm(p=>({...p,lignes:[...(p.lignes||[]),{produitId:"",qte:0,prixUnitaire:0}]}));
const updLigne = (i,k,v) => setForm(p=>({...p,lignes:p.lignes.map((l,j)=>j===i?{...l,[k]:v}:l)}));
const delLigne = (i) => setForm(p=>({...p,lignes:p.lignes.filter((_,j)=>j!==i)}));

const envoyerContrat = (c) => {
const pv = st.partenaires.find(p=>p.id===c.partenaireId);
const contact = pv?.contact || pv?.nom || "";
const typeL = c.type==="depot-vente"?"Contrat de dépôt-vente":c.type==="partenariat"?"Contrat de partenariat":c.type==="offre"?"Offre commerciale":"Contrat";
const subj = typeL+" "+c.numero+" - Goûtstoso";
let bodyTxt = "Bonjour "+contact+",\n\n";
if(c.type==="offre") {
  const validite = c.validiteOffre || 30;
  const dateExp = new Date(c.dateDebut);
  dateExp.setDate(dateExp.getDate()+parseInt(validite));
  bodyTxt +=
    "Suite à notre échange, nous avons le plaisir de vous soumettre notre offre commerciale N° "+c.numero+", dont vous trouverez le détail en pièce jointe.\n\n"+
    "Cette offre est valable jusqu'au "+fmt(dateExp.toISOString().slice(0,10))+".\n\n";
  if(c.modeAcceptation==="commande") {
    bodyTxt += "Pour accepter cette offre, il vous suffit de nous retourner votre commande par email à admin@goutstoso.ch en faisant référence au numéro "+c.numero+". Votre commande vaudra acceptation de l'ensemble des conditions.\n\n";
  } else {
    bodyTxt += "Pour accepter cette offre, nous vous remercions de nous retourner le document signé, par email ou par courrier postal.\n\n";
  }
  bodyTxt += "Nous demeurons à votre entière disposition pour toute question ou information complémentaire.\n\n";
} else {
  bodyTxt +=
    "Veuillez trouver ci-joint le "+typeL+" N° "+c.numero+".\n\n"+
    "Nous vous remercions de prendre connaissance de ce document et de nous le retourner signé dans les meilleurs délais si cela n'a pas encore été fait.\n\n"+
    "Pour toute question, n'hésitez pas à nous contacter.\n\n";
}
bodyTxt += "Cordialement,\n\nJordan Montanaro\nGoûtstoso\nadmin@goutstoso.ch · www.goutstoso.ch";
if(!pv?.email) { alert("Aucun email pour ce partenaire"); return; }
sendEmail({to:pv?.email||"",toName:contact,subject:subj,body:bodyTxt});
};

const totalContrat = (c) => {
try {
return sum((c?.lignes||[]).filter(l=>l&&l.produitId).map(l=>{
const p = st.produits.find(x=>x.id===l.produitId);
const pu = parseFloat(l.prixUnitaire||0) || parseFloat(p?.prixRevendeur||0);
return parseFloat(l.qte||0)*pu;
}));
} catch(e) { return 0; }
};

const badgeC = (s) => s==="signé"?"green":s==="brouillon"?"gray":s==="actif"?"blue":"yellow";

// Vue signature
if(view && sigMode) return (
<div className="fade">
<button onClick={()=>setSigMode(null)} style={{display:"flex",alignItems:"center",gap:6,background:"none",border:"none",color:"#9CA3AF",fontSize:13,marginBottom:16,padding:0,cursor:"pointer"}}>← Retour</button>
<div style={{background:"#FEF9E7",borderRadius:12,padding:"12px 14px",marginBottom:16,border:"1.5px solid #F2C94C"}}>
<p style={{fontWeight:700,fontSize:13}}>Signature - {sigMode==="fournisseur"?"GoûtStoso (Fournisseur)":"Client"}</p>
<p style={{fontSize:11,color:"#92400E",marginTop:4}}>{view.numero}</p>
</div>
<SignaturePad onSave={signer} onCancel={()=>setSigMode(null)}/>
</div>
);

// Vue détail
if(view) {
const pv = st.partenaires.find(p=>p.id===view.partenaireId);
const total = totalContrat(view);
const typeL = view.type==="depot-vente"?"Dépôt-vente":view.type==="partenariat"?"Partenariat":"Contrat";

return (
  <div className="fade">
    <button onClick={()=>setViewId(null)} style={{display:"flex",alignItems:"center",gap:6,background:"none",border:"none",color:"#9CA3AF",fontSize:13,marginBottom:12,padding:0,cursor:"pointer"}}>← Retour aux contrats</button>

    {/* Header */}
    <div style={{background:"#111",borderRadius:14,padding:"14px 16px",marginBottom:12}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
        <div>
          <p style={{fontSize:10,color:"#F2C94C",fontWeight:700,textTransform:"uppercase",letterSpacing:".08em"}}>{typeL}</p>
          <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,fontWeight:700,color:"#fff",marginTop:2}}>{view.numero}</p>
        </div>
        <Badge c={badgeC(view.statut)}>{view.statut}</Badge>
      </div>
    </div>

    {/* Actions principales */}
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginBottom:8}}>
      <button onClick={()=>genererContratPDF(view,pv,st)} style={{background:"#111",color:"#F2C94C",border:"none",borderRadius:10,padding:"11px 4px",fontWeight:700,fontSize:11,cursor:"pointer"}}>📄 PDF</button>
      <button onClick={()=>envoyerContrat(view)} style={{background:"#FEF9E7",color:"#92400E",border:"1.5px solid #F2C94C",borderRadius:10,padding:"11px 4px",fontWeight:700,fontSize:11,cursor:"pointer"}}>✉️ Email</button>
      <button onClick={()=>{setForm({...view});setModal("form");setViewId(null);}} style={{background:"#F5F5F0",border:"none",borderRadius:10,padding:"11px 4px",fontWeight:600,fontSize:11,cursor:"pointer"}}>✏️ Modifier</button>
    </div>
    <button onClick={async()=>{const pvLocal=(st.partenaires||[]).find(p=>p.id===view.partenaireId);const enriched={...view,partenaireNom:view.partenaireNom||pvLocal?.nom||"",lignes:(view.lignes||[]).map(l=>{const prod=(st.produits||[]).find(p=>p.id===l.produitId);return {...l,designation:prod?`${prod.nom}${prod.format?" · "+prod.format:""}`:l.produitId};})};const token=await envoyerPourSignature("contrat","Contrat "+view.numero,enriched,pvLocal?.email||view.partenaireEmail||"");if(token)setSt(p=>({...p,contrats:p.contrats.map(c=>c.id===view.id?{...c,signingToken:token}:c)}));}} style={{width:"100%",marginBottom:view.signingToken?4:8,background:"linear-gradient(135deg,#0a0a0a,#1a1a1a)",border:"none",borderRadius:10,padding:"11px",fontWeight:700,fontSize:12,color:"#F2C94C",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
      🔏 Envoyer pour signature
    </button>
    {view.signingToken&&<button onClick={async()=>{try{const r=await fetch(`${SIGN_API}/sign/${view.signingToken}`);const d=await r.json();if(d.status!=="signed"){alert("Pas encore signé. Relancez une fois que votre partenaire a cliqué le lien.");return;}setSt(p=>({...p,contrats:p.contrats.map(c=>c.id===view.id?{...c,signClient:d.signatureData,statut:"signé",signerNom:d.signerName,signingToken:null}:c)}));alert(`✅ ${d.signerName} a signé !\nLa signature est maintenant intégrée dans le PDF.`);}catch(e){alert("Erreur : "+e.message);}}} style={{width:"100%",marginBottom:4,background:"#DCFCE7",border:"1.5px solid #86EFAC",borderRadius:10,padding:"10px",fontWeight:700,fontSize:12,color:"#166534",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>🔄 Vérifier la signature</button>}
    {!view.signingToken&&!view.signClient&&(<div style={{display:"flex",gap:6,marginBottom:8,alignItems:"center"}}>
      <input value={recoveryTokenC} onChange={e=>setRecoveryTokenC(e.target.value)} placeholder="Token de signature existant…" style={{flex:1,padding:"8px 10px",borderRadius:8,border:"1px solid #E5E7EB",fontSize:11,outline:"none",color:"#374151"}}/>
      <button onClick={async()=>{const t=recoveryTokenC.trim();if(!t)return;try{const r=await fetch(`${SIGN_API}/sign/${t}`);const d=await r.json();if(d.status!=="signed"){alert("Ce token n'est pas encore signé.");return;}setSt(p=>({...p,contrats:p.contrats.map(c=>c.id===view.id?{...c,signClient:d.signatureData,statut:"signé",signerNom:d.signerName}:c)}));setRecoveryTokenC("");alert(`✅ Signature de ${d.signerName} intégrée dans le PDF !`);}catch(e){alert("Erreur : "+e.message);}}} style={{padding:"8px 10px",borderRadius:8,background:"#F9F9F6",border:"1px solid #E5E7EB",fontSize:11,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap",color:"#374151"}}>🔍 Récupérer</button>
    </div>)}
    {/* CONVERSION pour offre → commande */}
    {view.type==="offre" && (
      <button onClick={()=>{
        // Convertir offre en commande
        if(!window.confirm("Convertir cette offre en commande ?")) return;
        const pv = st.partenaires.find(p=>p.id===view.partenaireId);
        const existingNums = (st.commandes||[]).map(c=>c.numero);
        const y = new Date().getFullYear();
        let n = 1;
        while(existingNums.includes("CMD-"+y+"-"+String(n).padStart(3,"0"))) n++;
        const numero = "CMD-"+y+"-"+String(n).padStart(3,"0");
        const newCmd = {
          id: uid(),
          numero,
          date: today(),
          clientId: "",
          client: pv?.nom||"",
          email: pv?.email||"",
          telephone: pv?.tel||"",
          adresse: pv?.adresse||"",
          npa: pv?.npa||"",
          ville: pv?.ville||"",
          lignes: (view.lignes||[]).filter(l=>l.produitId).map(l=>({produitId:l.produitId,qte:l.qte})),
          rabais: 0,
          fraisPort: 0,
          commissionShopify: 0,
          statut: "en attente",
          envoyeeCompta: false,
          notes: "Commande issue de l'offre "+view.numero,
          offreId: view.id,
        };
        setSt(p=>({
          ...p,
          commandes: [...(p.commandes||[]), newCmd],
          contrats: p.contrats.map(c=>c.id===view.id?{...c,statut:"accepté"}:c),
        }));
        alert("Commande "+numero+" créée depuis l'offre !\nRetrouve-la dans Plus → Commandes");
      }} style={{width:"100%",background:"#0A0A0A",color:"#FAFAF7",border:"none",borderRadius:10,padding:"11px",fontWeight:600,fontSize:12,cursor:"pointer",marginBottom:8,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
        🔄 Convertir en commande
      </button>
    )}
    
    {/* CONVERSION dépôt-vente → facture (après inventaire) */}
    {(view.type==="depot-vente" || view.type==="partenariat" || view.type==="autre") && view.lignes?.some(l=>l.produitId) && (
      <button onClick={()=>{
        if(!window.confirm("Créer une facture à partir de ce "+view.type+" ?\nLa facture sera au prix professionnel.")) return;
        const existingNums = (st.factures||[]).map(f=>f.numero);
        const y = new Date().getFullYear();
        let n = 1;
        while(existingNums.includes("FAC-"+y+"-"+String(n).padStart(3,"0"))) n++;
        const numero = "FAC-"+y+"-"+String(n).padStart(3,"0");
        const newFac = {
          id: uid(),
          numero,
          date: today(),
          partenaireId: view.partenaireId,
          typeClient: "revendeur",
          lignes: (view.lignes||[]).filter(l=>l.produitId).map(l=>({produitId:l.produitId,qte:l.qte})),
          statut: "en attente",
          datePaiement: "",
          notes: "Facture issue du "+view.type+" "+view.numero,
          contratId: view.id,
        };
        setSt(p=>({...p, factures:[...(p.factures||[]),newFac]}));
        alert("Facture "+numero+" créée !\nRetrouve-la dans Factures");
      }} style={{width:"100%",background:"#0A0A0A",color:"#FAFAF7",border:"none",borderRadius:10,padding:"11px",fontWeight:600,fontSize:12,cursor:"pointer",marginBottom:8,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
        📄 Créer une facture à partir de ce contrat
      </button>
    )}
    
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14}}>
      {view.statut!=="résilié"&&(
        <button onClick={()=>{
          if(!window.confirm("Résilier ce contrat ? Il sera archivé mais pas supprimé.")) return;
          setSt(p=>({...p,contrats:(p.contrats||[]).map(x=>x.id===view.id?{...x,statut:"résilié",dateResiliation:today()}:x)}));
          setViewId(null);
        }} style={{background:"#FFF7ED",color:"#C2410C",border:"1.5px solid #FED7AA",borderRadius:10,padding:"10px",fontWeight:600,fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
          🚫 Résilier
        </button>
      )}
      <button onClick={()=>supprimer(view.id)} style={{background:"#FEE2E2",color:"#991B1B",border:"none",borderRadius:10,padding:"10px",fontWeight:600,fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6,gridColumn:view.statut==="résilié"?"1/-1":"auto"}}>
        <Ic n="trash" s={14}/> Supprimer
      </button>
    </div>

    {/* Infos */}
    <Card style={{marginBottom:12,padding:"12px 14px"}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
        <div>
          <p style={{fontSize:9,color:"#9CA3AF",fontWeight:700,textTransform:"uppercase"}}>Début</p>
          <p style={{fontSize:12,fontWeight:600,marginTop:2}}>{fmt(view.dateDebut)}</p>
        </div>
        <div>
          <p style={{fontSize:9,color:"#9CA3AF",fontWeight:700,textTransform:"uppercase"}}>Fin</p>
          <p style={{fontSize:12,fontWeight:600,marginTop:2}}>{view.dateFin?fmt(view.dateFin):"Indéterminée"}</p>
        </div>
      </div>
      <div style={{borderTop:"1px solid #F5F5F0",paddingTop:10}}>
        <p style={{fontSize:9,color:"#9CA3AF",fontWeight:700,textTransform:"uppercase",marginBottom:4}}>Partenaire</p>
        <p style={{fontSize:13,fontWeight:700}}>{pv?.nom||"-"}</p>
        {pv?.adresse&&<p style={{fontSize:11,color:"#6B7280"}}>{pv.adresse}</p>}
      </div>
      {view.commission>0&&(
        <div style={{marginTop:8,padding:"6px 10px",background:"#FEF9E7",borderRadius:8}}>
          <p style={{fontSize:11,color:"#92400E"}}>Commission : <strong>{view.commission}%</strong></p>
        </div>
      )}
    </Card>

    {/* Produits */}
    {(view.lignes||[]).filter(l=>l.produitId).length>0&&(
      <Card style={{marginBottom:12,padding:"12px 14px"}}>
        <p style={{fontSize:11,fontWeight:700,color:"#9CA3AF",textTransform:"uppercase",marginBottom:8}}>Produits</p>
        {(view.lignes||[]).filter(l=>l.produitId).map((l,i)=>{
          const p = st.produits.find(x=>x.id===l.produitId);
          const pu = l.prixUnitaire||(p?.prixRevendeur||0);
          return (
            <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 0",borderBottom:"1px solid #F5F5F0"}}>
              <div>
                <p style={{fontSize:12,fontWeight:600}}>{p?.nom} {p?.variante}</p>
                <p style={{fontSize:10,color:"#9CA3AF"}}>{p?.format} · Qté {l.qte||0}</p>
              </div>
              <span style={{fontWeight:700,fontSize:12}}>{chf(pu*(l.qte||0))}</span>
            </div>
          );
        })}
        {total>0&&(
          <div style={{display:"flex",justifyContent:"space-between",paddingTop:8,marginTop:4,borderTop:"2px solid #F2C94C"}}>
            <span style={{fontWeight:700}}>Total</span>
            <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:18,fontWeight:700,color:"#D4A017"}}>{chf(total)}</span>
          </div>
        )}
      </Card>
    )}

    {/* Notes */}
    {view.notes&&(
      <Card style={{marginBottom:12,padding:"10px 14px",background:"#F5F5F0"}}>
        <p style={{fontSize:10,color:"#9CA3AF",fontWeight:700,textTransform:"uppercase",marginBottom:4}}>Notes</p>
        <p style={{fontSize:12,color:"#374151"}}>{view.notes}</p>
      </Card>
    )}

    {/* Signatures */}
    <Card style={{marginBottom:14,padding:"12px 14px"}}>
      <p style={{fontSize:11,fontWeight:700,color:"#9CA3AF",textTransform:"uppercase",marginBottom:10}}>Signatures</p>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        {[
          {label:"Goûtstoso",sig:view.signFournisseur,target:"fournisseur"},
          {label:pv?.nom||"Client",sig:view.signClient,target:"client"},
        ].map(({label,sig,target})=>(
          <div key={target} style={{border:"1.5px solid #E5E5E0",borderRadius:10,overflow:"hidden"}}>
            <p style={{fontSize:9,fontWeight:700,color:"#9CA3AF",textTransform:"uppercase",padding:"5px 8px",borderBottom:"1px solid #F5F5F0",background:"#F5F5F0"}}>{label}</p>
            {sig ? (
              <div>
                <img src={sig} style={{width:"100%",height:55,objectFit:"contain",padding:4}}/>
                <button onClick={()=>effacerSignature(target)} style={{width:"100%",background:"#FEE2E2",color:"#991B1B",border:"none",borderTop:"1px solid #FCA5A5",padding:"5px",fontSize:10,fontWeight:600,cursor:"pointer"}}>Effacer</button>
              </div>
            ) : (
              <button onClick={()=>setSigMode(target)} style={{width:"100%",height:75,background:"none",border:"none",color:"#9CA3AF",fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
                ✍️ Signer
              </button>
            )}
          </div>
        ))}
      </div>
      {view.dateSignature&&<p style={{fontSize:10,color:"#9CA3AF",textAlign:"center",marginTop:8}}>Signé le {fmt(view.dateSignature)} · {view.lieuSignature||"Villeret"}</p>}
    </Card>

    {/* CGV */}
    <details style={{background:"#F5F5F0",borderRadius:10,padding:"10px 14px",fontSize:11,color:"#6B7280"}}>
      <summary style={{fontWeight:700,fontSize:12,color:"#111",cursor:"pointer"}}>CGV - Annexe</summary>
      <div style={{marginTop:8,lineHeight:1.6,whiteSpace:"pre-wrap",fontSize:10}}>{CGV}</div>
    </details>
  </div>
);

}

// Vue liste — refonte complète
const today_d = new Date();
const contratsListe = (st.contrats||[]).filter(c=>!c.livraison);

const getStatutContrat = (c) => {
  if(c.statut==="résilié") return "résilié";
  if(c.statut==="brouillon") return "brouillon";
  if(c.dateFin) {
    const fin = new Date(c.dateFin);
    if(fin < today_d) return "expiré";
    const diff = Math.round((fin - today_d)/(1000*60*60*24));
    if(diff<=30) return "expire_bientot";
  }
  if(c.statut==="signé"||c.statut==="actif") return "actif";
  return c.statut||"brouillon";
};

const nbExpires = contratsListe.filter(c=>getStatutContrat(c)==="expiré").length;
const nbResilies = contratsListe.filter(c=>getStatutContrat(c)==="résilié").length;
const filtresC = [
  {id:"tous", l:`Tous (${contratsListe.length})`},
  {id:"actif", l:"Actifs"},
  {id:"brouillon", l:"Brouillons"},
  {id:"expiré", l:nbExpires>0?`Expirés (${nbExpires})`:"Expirés"},
  {id:"résilié", l:nbResilies>0?`Résiliés (${nbResilies})`:"Résiliés"},
];

const contratsFiltres = contratsListe.filter(c=>{
  if(filtreC==="tous") return true;
  const s = getStatutContrat(c);
  if(filtreC==="actif") return s==="actif"||s==="expire_bientot";
  return s===filtreC;
}).slice().reverse();

const renouveler = (c) => {
  if(!window.confirm("Renouveler ce contrat ? Un nouveau contrat sera créé avec les mêmes termes.")) return;
  const prefix = c.type==="depot-vente"?"DPV":c.type==="partenariat"?"PAR":c.type==="offre"?"OFF":"CTR";
  const existing = (st.contrats||[]).filter(x=>x.type===c.type&&!x.livraison).map(x=>x.numero);
  let n=1; while(existing.includes(`${prefix}-${new Date().getFullYear()}-${String(n).padStart(3,"0")}`)) n++;
  const numero = `${prefix}-${new Date().getFullYear()}-${String(n).padStart(3,"0")}`;
  const duree = c.dateDebut&&c.dateFin ? Math.round((new Date(c.dateFin)-new Date(c.dateDebut))/(1000*60*60*24)) : 60;
  const newDebut = today();
  const newFin = c.dateFin ? new Date(new Date().getTime()+duree*86400000).toISOString().slice(0,10) : "";
  const newC = {...c, id:uid(), numero, dateDebut:newDebut, dateFin:newFin, statut:"brouillon", signFournisseur:null, signClient:null, dateSignature:null};
  setSt(p=>({...p, contrats:[...(p.contrats||[]),newC]}));
  alert("Contrat "+numero+" créé ! Ouvre-le pour le signer.");
};

const resilier = (c) => {
  if(!window.confirm("Résilier ce contrat ? Il sera archivé mais pas supprimé.")) return;
  setSt(p=>({...p, contrats:(p.contrats||[]).map(x=>x.id===c.id?{...x,statut:"résilié",dateResiliation:today()}:x)}));
  setViewId(null);
};

return (
<div className="fade">
<SectionTitle action={<Btn icon="plus" onClick={()=>{setForm(emptyC());setModal("form");}}>Nouveau</Btn>}>
Contrats
</SectionTitle>

  {/* Alertes expiration */}
  {(()=>{
    const urgents = contratsListe.filter(c=>getStatutContrat(c)==="expire_bientot");
    if(!urgents.length) return null;
    return (
      <div style={{background:"#FEF3C7",border:"1px solid #FCD34D",borderRadius:12,padding:"10px 14px",marginBottom:14}}>
        <p style={{fontWeight:700,color:"#92400E",fontSize:13}}>⏰ {urgents.length} contrat{urgents.length>1?"s":""} expire{urgents.length>1?"nt":""} bientôt</p>
        {urgents.map(c=>{
          const pv=st.partenaires.find(p=>p.id===c.partenaireId);
          const jours=Math.round((new Date(c.dateFin)-today_d)/(1000*60*60*24));
          return <p key={c.id} style={{fontSize:11,color:"#92400E",marginTop:2}}>· {c.numero} — {pv?.nom} — dans {jours} jour{jours>1?"s":""}</p>;
        })}
      </div>
    );
  })()}

  {/* Filtres */}
  <div style={{display:"flex",gap:6,marginBottom:14,overflowX:"auto",paddingBottom:2}}>
    {filtresC.map(f=>(
      <button key={f.id} onClick={()=>setFiltreC(f.id)} style={{
        background:filtreC===f.id?"#111":"#F5F5F0",
        color:filtreC===f.id?"#F2C94C":"#6B7280",
        border:"none",borderRadius:20,padding:"6px 14px",
        fontSize:12,fontWeight:filtreC===f.id?700:400,
        cursor:"pointer",whiteSpace:"nowrap",flexShrink:0,
      }}>{f.l}</button>
    ))}
  </div>

  {contratsFiltres.length===0 ? (
    <div style={{textAlign:"center",padding:"40px 20px",color:"#9CA3AF"}}>
      <p style={{fontSize:40,marginBottom:12}}>📄</p>
      <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,fontWeight:600,color:"#374151"}}>Aucun contrat</p>
      <p style={{fontSize:13,marginTop:6,marginBottom:16}}>Créez votre premier contrat de dépôt-vente ou de partenariat.</p>
      <button onClick={()=>{setForm(emptyC());setModal("form");}} style={{background:"#F2C94C",border:"none",borderRadius:12,padding:"12px 24px",fontWeight:700,fontSize:14,cursor:"pointer"}}>
        + Nouveau contrat
      </button>
    </div>
  ) : contratsFiltres.map(c=>{
    const pv = st.partenaires.find(p=>p.id===c.partenaireId);
    const statut = getStatutContrat(c);
    const typeIcon = c.type==="depot-vente"?"📋":c.type==="partenariat"?"🤝":c.type==="offre"?"💼":"📄";
    const typeL = c.type==="depot-vente"?"Dépôt-vente":c.type==="partenariat"?"Partenariat":c.type==="offre"?"Offre":"Autre";
    const coulBord = statut==="actif"?"#22C55E":statut==="expire_bientot"?"#F59E0B":statut==="expiré"||statut==="résilié"?"#9CA3AF":"#F2C94C";
    const jours = c.dateFin ? Math.round((new Date(c.dateFin)-today_d)/(1000*60*60*24)) : null;
    return (
      <Card key={c.id} style={{marginBottom:10,borderLeft:"3px solid "+coulBord}}>
        <div onClick={()=>setViewId(c.id)} style={{cursor:"pointer",marginBottom:10}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:3}}>
                <span style={{fontSize:13}}>{typeIcon}</span>
                <p style={{fontWeight:700,fontSize:13}}>{c.numero}</p>
              </div>
              <p style={{fontSize:13,color:"#374151",fontWeight:500}}>{pv?.nom||"—"}</p>
              <p style={{fontSize:11,color:"#9CA3AF",marginTop:2}}>{typeL} · Début {fmt(c.dateDebut)}</p>
              {c.dateFin&&<p style={{fontSize:11,marginTop:2,color:statut==="expire_bientot"?"#92400E":statut==="expiré"?"#6B7280":"#6B7280"}}>
                Fin {fmt(c.dateFin)}{statut==="expire_bientot"?" · ⚠️ "+jours+"j restants":statut==="expiré"?" · Expiré":""}
              </p>}
            </div>
            <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6,marginLeft:8}}>
              <Badge c={statut==="actif"||statut==="expire_bientot"?"green":statut==="brouillon"?"yellow":statut==="résilié"?"gray":"gray"}>
                {statut==="expire_bientot"?"Expire bientôt":statut==="actif"?"Actif":statut==="brouillon"?"Brouillon":statut==="résilié"?"Résilié":"Expiré"}
              </Badge>
              <div style={{display:"flex",gap:4,alignItems:"center"}}>
                <span style={{fontSize:9,color:"#9CA3AF"}}>Sig:</span>
                <div style={{width:9,height:9,borderRadius:"50%",background:c.signFournisseur?"#22C55E":"#E5E7EB"}} title="Goûtstoso"/>
                <div style={{width:9,height:9,borderRadius:"50%",background:c.signClient?"#22C55E":"#E5E7EB"}} title="Client"/>
              </div>
            </div>
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
          <button onClick={()=>setViewId(c.id)} style={{background:"#111",color:"#F2C94C",border:"none",borderRadius:8,padding:"8px",fontSize:11,fontWeight:700,cursor:"pointer"}}>👁 Voir</button>
          <button onClick={()=>envoyerContrat(c)} style={{background:"#FEF9E7",color:"#92400E",border:"none",borderRadius:8,padding:"8px",fontSize:11,fontWeight:600,cursor:"pointer"}}>✉️ Email</button>
          <button onClick={()=>renouveler(c)} style={{background:"#EFF6FF",color:"#1D4ED8",border:"none",borderRadius:8,padding:"8px",fontSize:11,fontWeight:600,cursor:"pointer"}}>🔄 Renouveler</button>
          <button onClick={()=>supprimer(c.id)} style={{background:"#FEE2E2",border:"none",borderRadius:8,padding:"8px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}><Ic n="trash" s={13}/></button>
        </div>
      </Card>
    );
  })}

  {/* Modal création/édition — formulaire repensé */}
  {modal==="form"&&form&&(
    <Modal title={form.id?"Modifier contrat":"Nouveau contrat"} onClose={()=>{setModal(null);setForm(null);}}>
      <div style={{display:"grid",gap:14}}>

        {/* Type avec icônes */}
        <div>
          <label style={{fontSize:11,fontWeight:600,color:"#9CA3AF",textTransform:"uppercase",display:"block",marginBottom:8}}>Type de contrat</label>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            {[
              {v:"depot-vente",l:"Dépôt-vente",icon:"📋",desc:"Produits en consignation"},
              {v:"partenariat",l:"Partenariat",icon:"🤝",desc:"Revendeur régulier"},
              {v:"offre",l:"Offre commerciale",icon:"💼",desc:"Proposition tarifaire"},
              {v:"autre",l:"Autre",icon:"📄",desc:"Contrat libre"},
            ].map(t=>(
              <button key={t.v} onClick={()=>setForm(p=>({...p,type:t.v}))} style={{
                background:form.type===t.v?"#111":"#F9F9F6",
                color:form.type===t.v?"#F2C94C":"#374151",
                border:form.type===t.v?"2px solid #F2C94C":"1.5px solid #E5E5E0",
                borderRadius:10,padding:"10px 8px",cursor:"pointer",textAlign:"left",
              }}>
                <p style={{fontSize:18,marginBottom:2}}>{t.icon}</p>
                <p style={{fontSize:12,fontWeight:700}}>{t.l}</p>
                <p style={{fontSize:10,opacity:.7,marginTop:1}}>{t.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {form.type==="offre" && (
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <Sel label="Acceptation" value={form.modeAcceptation||"signature"} onChange={v=>setForm(p=>({...p,modeAcceptation:v}))}
              options={[{v:"signature",l:"✍️ Signature"},{v:"commande",l:"📧 Commande email"}]}/>
            <F label="Validité (jours)" type="number" value={form.validiteOffre||"30"} onChange={v=>setForm(p=>({...p,validiteOffre:v}))}/>
          </div>
        )}

        <Sel label="Partenaire *" value={form.partenaireId} onChange={v=>setForm(p=>({...p,partenaireId:v}))} required
          options={[{v:"",l:"— Sélectionner un partenaire —"},...st.partenaires.map(p=>({v:p.id,l:p.nom}))]}/>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <F label="Date début" type="date" value={form.dateDebut} onChange={v=>setForm(p=>({...p,dateDebut:v}))}/>
          <F label="Date fin (optionnel)" type="date" value={form.dateFin||""} onChange={v=>setForm(p=>({...p,dateFin:v}))}/>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <F label="Commission (%)" type="number" value={form.commission||""} onChange={v=>setForm(p=>({...p,commission:v}))} placeholder="0"/>
          <F label="Lieu signature" value={form.lieuSignature||"Villeret"} onChange={v=>setForm(p=>({...p,lieuSignature:v}))}/>
        </div>

        <div>
          <label style={{fontSize:11,fontWeight:600,color:"#9CA3AF",textTransform:"uppercase",display:"block",marginBottom:8}}>Produits concernés (optionnel)</label>
          {(form.lignes||[]).map((l,i)=>(
            <div key={i} style={{display:"grid",gridTemplateColumns:"1fr 55px 55px 36px",gap:6,marginBottom:8,alignItems:"flex-end"}}>
              <Sel label="" value={l.produitId} onChange={v=>{
                const p=st.produits.find(x=>x.id===v);
                updLigne(i,"produitId",v);
                if(p) updLigne(i,"prixUnitaire",p.prixRevendeur);
              }} options={[{v:"",l:"— Produit —"},...st.produits.filter(p=>p.actif).map(p=>({v:p.id,l:`${p.nom} ${p.variante} ${p.format}`}))]}/>
              <input type="number" value={l.qte||0} placeholder="Qté" onChange={e=>updLigne(i,"qte",+e.target.value)}
                style={{padding:"11px 4px",fontSize:13,border:"1.5px solid #E5E5E0",borderRadius:10,textAlign:"center"}}/>
              <input type="number" value={l.prixUnitaire||0} placeholder="CHF" onChange={e=>updLigne(i,"prixUnitaire",+e.target.value)}
                style={{padding:"11px 4px",fontSize:12,border:"1.5px solid #E5E5E0",borderRadius:10,textAlign:"center"}}/>
              <button onClick={()=>delLigne(i)} style={{background:"#FEE2E2",border:"none",borderRadius:8,padding:"10px 6px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
                <Ic n="trash" s={13}/>
              </button>
            </div>
          ))}
          <button onClick={addLigne} style={{background:"none",border:"1.5px dashed #E5E5E0",borderRadius:10,padding:"9px",width:"100%",color:"#9CA3AF",fontSize:13,cursor:"pointer"}}>
            + Ajouter un produit
          </button>
        </div>

        <F label="Conditions particulières / Notes" value={form.notes||""} onChange={v=>setForm(p=>({...p,notes:v}))} placeholder="Ex: renouvellement automatique, clause spéciale..."/>

        <Sel label="Statut initial" value={form.statut} onChange={v=>setForm(p=>({...p,statut:v}))}
          options={[{v:"brouillon",l:"📝 Brouillon"},{v:"en attente signature",l:"✍️ En attente signature"},{v:"signé",l:"✅ Signé"},{v:"actif",l:"🟢 Actif"},{v:"terminé",l:"🔘 Terminé"}]}/>
      </div>
      <div style={{display:"flex",gap:10,marginTop:20}}>
        <Btn onClick={save} full icon="check">Enregistrer</Btn>
        <Btn onClick={()=>{setModal(null);setForm(null);}} variant="ghost" full>Annuler</Btn>
      </div>
    </Modal>
  )}
</div>

);
};

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


const Factures = ({st,setSt}) => {
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
            <span style={{fontSize:12,fontWeight:600,color:r.frais>0?"#991B1B":"#6B7280"}}>{r.frais>0?"+ CHF "+r.frais.toFixed(2):"Sans frais"}</span>
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
          <div style={{display:"flex",justifyContent:"space-between",gap:14,marginBottom:retard?.frais>0?3:6}}>
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

// ══════════════════════════════════════════════════════════════
// PAGE: COMPTABILITÉ - Plan comptable suisse PME simplifié
// ══════════════════════════════════════════════════════════════

const PLAN_COMPTABLE = {
// PRODUITS (ventes & recettes)
"3001":"Vente Limonta",
"3002":"Vente Limelo",
"3003":"Vente Clementino",
"3004":"Vente Coffrets",
"3400":"Ventes de prestations",
"3600":"Frais d'expédition facturés",
"3700":"Autres produits d'exploitation",
"3750":"Frais de rappel encaissés",
"3800":"Produits divers",
"3900":"Rabais accordés sur ventes",
// CHARGES (matières & production)
"4000":"Achats de matériel",
"4010":"Achat matières premières (fruits, alcool)",
"4020":"Sucre et additifs",
"4200":"Bouteilles / Bouchons",
"4210":"Étiquettes",
"4220":"Emballages",
"4400":"Prestations / travaux de tiers",
// AUTRES CHARGES
"5000":"Salaires",
"5201":"Dédouanement",
"6000":"Charges de locaux",
"6200":"Transport",
"6300":"Assurances",
"6400":"Électricité",
"6510":"Téléphone",
"6512":"Internet",
"6513":"Frais de port / expédition",
"6530":"Services juridiques / comptables",
"6600":"Annonces publicitaires",
"6610":"Marketing / réseaux sociaux",
"6700":"Commissions bancaires / Shopify",
"6800":"Amortissements",
"6900":"Charges financières",
"8900":"Impôts",
};

const CATEGORIES_RECETTE = ["Vente Limonta","Vente Limelo","Vente Clementino","Vente Coffrets","Dépôt-vente","Vente directe","Frais expédition facturés","Frais de rappel","Autres"];
const CATEGORIES_DEPENSE = ["Matières premières","Bouteilles","Étiquettes","Emballages","Dédouanement","Marketing","Frais d'expédition (envois)","Transport","Matériel","Commissions","Services","Salaires","Frais bancaires","Autres"];

const Comptabilite = ({st,setSt}) => {
const [modal,setModal] = useState(null);
const [onglet,setOnglet] = useState("dashboard");
const [periode,setPeriode] = useState(new Date().getFullYear()+"");
const emptyT = {date:today(),type:"recette",compte:"3001",libelle:"",categorie:"Vente Limonta",montant:"",description:"",postfinance:true,justificatif:"",justificatifNom:""};
const [form,setForm] = useState(emptyT);
const [soldeModal,setSoldeModal] = useState(false);
const [nouveauSolde,setNouveauSolde] = useState(st.soldeBancaire||0);
const emptyR = () => ({id:null as any,nom:"",montant:"" as any,frequence:"mensuelle",compte:"6100",categorie:"Loyer",prochainPaiement:today(),actif:true});
const [rModal,setRModal] = useState(false);
const [rForm,setRForm] = useState<any>(emptyR());

// Saisie automatique depuis factures payées
React.useEffect(()=>{
const facturesPayees = (st.factures||[]).filter(f=>f.statut==="payée"&&f.datePaiement);
const existingIds = (st.transactions||[]).map(t=>t.factureId).filter(Boolean);
const nouvelles = [];
facturesPayees.forEach(f=>{
if(existingIds.includes(f.id)) return;
const total = calcTotalNet(f,st.produits);
const pv = st.partenaires.find(p=>p.id===f.partenaireId);
// Déterminer le compte selon le produit principal
const ligne1 = f.lignes.find(l=>l.produitId);
const prod = ligne1 ? st.produits.find(x=>x.id===ligne1.produitId) : null;
const compte = prod?.nom==="Limonta"?"3001":
prod?.nom==="Limelo"?"3002":
prod?.nom==="Clementino"?"3003":
prod?.nom?.includes("Coffret")?"3004":"3001";
const categorie = prod?.nom==="Limonta"?"Vente Limonta":
prod?.nom==="Limelo"?"Vente Limelo":
prod?.nom==="Clementino"?"Vente Clementino":
prod?.nom?.includes("Coffret")?"Vente Coffrets":"Vente Limonta";
// Recette brute (avant rabais)
nouvelles.push({
id:uid(),
factureId:f.id,
date:f.datePaiement,
compte,
libelle:`Paiement ${f.numero}`,
type:"recette",
categorie,
montant:total,
description:`Facture ${f.numero} - ${pv?.nom||""}`,
postfinance:true,
});
// Écriture séparée pour les bouteilles offertes selon choix comptable
if(f.totalRabais && f.totalRabais>0) {
  const cptOffert = f.comptOffert||"3900";
  const isMarketing = cptOffert==="6610";
  nouvelles.push({
    id:uid(),
    factureId:f.id,
    date:f.datePaiement,
    compte:cptOffert,
    libelle:isMarketing?`Dégustation / promo ${f.numero}`:`Rabais bouteilles offertes ${f.numero}`,
    type:"depense",
    categorie:isMarketing?"Marketing / réseaux sociaux":"Rabais accordés sur ventes",
    montant:f.totalRabais,
    description:(isMarketing?"Dégustation / marketing":"Rabais bouteilles offertes")+` — Facture ${f.numero} - ${pv?.nom||""}`,
    postfinance:false,
  });
}
});
if(nouvelles.length) {
setSt(p=>({...p,transactions:[...(p.transactions||[]),...nouvelles]}));
}
},[(st.factures||[]).filter(f=>f.statut==="payée").length]);

const save = () => {
if(!form.montant) return;
const montant = parseFloat(String(form.montant).replace(",","."))||0;
const cleaned = {...form, montant};
// Helper: calcul l'impact (signé) d'une transaction sur le solde
const impactOf = (t) => {
if(!t || !t.postfinance) return 0;
const m = parseFloat(t.montant)||0;
return t.type==="recette" ? m : -m;
};
if(form.id) {
// Modification: annuler ancien impact, ajouter nouveau
const ancienne = (st.transactions||[]).find(t=>t.id===form.id);
const diff = impactOf(cleaned) - impactOf(ancienne);
setSt(p=>({...p,
transactions:p.transactions.map(t=>t.id===form.id?cleaned:t),
soldeBancaire: parseFloat((parseFloat(p.soldeBancaire||0)+diff).toFixed(2)),
}));
} else {
cleaned.id = uid();
const diff = impactOf(cleaned);
setSt(p=>({...p,
transactions:[...(p.transactions||[]),cleaned],
soldeBancaire: parseFloat((parseFloat(p.soldeBancaire||0)+diff).toFixed(2)),
}));
}
setModal(null);
setForm(emptyT);
};

const del = id => {
const t = (st.transactions||[]).find(x=>x.id===id);
setSt(p=>{
const newState = {...p, transactions: p.transactions.filter(x=>x.id!==id)};
if(t?.postfinance) {
const m = parseFloat(t.montant)||0;
const diff = t.type==="recette" ? -m : m; // annuler l'impact
newState.soldeBancaire = parseFloat((parseFloat(p.soldeBancaire||0)+diff).toFixed(2));
}
return newState;
});
};

// Filtrer par période
const transByPeriode = (st.transactions||[]).filter(t=>{
if(periode==="tout") return true;
const y = t.date?.slice(0,4);
if(periode.length===4) return y===periode;
if(periode.length===7) return t.date?.startsWith(periode);
return true;
});

const recettes = sum(transByPeriode.filter(t=>t.type==="recette").map(t=>+t.montant));
const depenses = sum(transByPeriode.filter(t=>t.type==="depense").map(t=>+t.montant));
const resultat = recettes - depenses;

// Données par mois (pour graphique)
const parMois = {};
transByPeriode.forEach(t=>{
const m = t.date?.slice(0,7); if(!m) return;
if(!parMois[m]) parMois[m] = {recettes:0,depenses:0};
if(t.type==="recette") parMois[m].recettes += +t.montant;
else parMois[m].depenses += +t.montant;
});
const moisTries = Object.keys(parMois).sort();
const maxValue = Math.max(...Object.values(parMois).map(m=>Math.max(m.recettes,m.depenses)), 100);

// Compte de résultat par catégorie
const parCategorie = {};
transByPeriode.forEach(t=>{
const key = t.type+"-"+(t.categorie||"Autres");
if(!parCategorie[key]) parCategorie[key] = {type:t.type,cat:t.categorie||"Autres",total:0,count:0};
parCategorie[key].total += +t.montant;
parCategorie[key].count++;
});
const catRecettes = Object.values(parCategorie).filter(c=>c.type==="recette").sort((a,b)=>b.total-a.total);
const catDepenses = Object.values(parCategorie).filter(c=>c.type==="depense").sort((a,b)=>b.total-a.total);

// Bilan simplifié
const factAttente = (st.factures||[]).filter(f=>f.statut!=="payée");
// Créances clients = factures en attente + commandes Shopify non payées
const creancesFactures = sum(factAttente.map(f=>calcTotalNet(f,st.produits)));
const cmdNonPayees = (st.commandes||[]).filter(c=>c.statut!=="payée"&&c.statut!=="livrée"&&c.statut!=="retirée");
const creancesCommandes = sum(cmdNonPayees.map(c=>{
const t = sum((c.lignes||[]).filter(l=>l.produitId).map(l=>{
const p = st.produits.find(x=>x.id===l.produitId);
return (c.typeClient==="revendeur"?(p?.prixRevendeur||0):(p?.prixClient||0))*(l.qte||0);
}));
return t - (parseFloat(c.rabais)||0) + (parseFloat(c.fraisPort)||0);
}));
const creancesClients = creancesFactures + creancesCommandes;
const valeurStock = sum(st.produits.filter(p=>!p.nom.includes("Coffret")).map(p=>{
const qte = sum((st.stocks||[]).filter(s=>s.produitId===p.id).map(s=>s.qte));
return qte*(p.coutRevient||0);
}));

// Export CSV
const exportCompta = () => {
const rows = transByPeriode.slice().sort((a,b)=>a.date.localeCompare(b.date)).map(t=>({
Date:t.date,
Compte:t.compte,
Libelle:t.libelle,
Categorie:t.categorie,
Type:t.type,
Montant:(t.type==="depense"?"-":"+")+parseFloat(t.montant).toFixed(2),
Description:t.description,
}));
exportCSV(rows,"goutstoso_compta_"+periode+".csv");
};

// Périodes dispo
const annees = [...new Set((st.transactions||[]).map(t=>t.date?.slice(0,4)).filter(Boolean))].sort().reverse();
const mois = [...new Set((st.transactions||[]).map(t=>t.date?.slice(0,7)).filter(Boolean))].sort().reverse();

return (
<div className="fade">
<SectionTitle action={
<div style={{display:"flex",gap:8}}>
<Btn icon="export" variant="ghost" small onClick={exportCompta}>Export</Btn>
<Btn icon="plus" small onClick={()=>{setForm(emptyT);setModal("form");}}>Écriture</Btn>
</div>
}>Comptabilité</SectionTitle>

  {/* Solde bancaire cliquable */}
  <Card style={{marginBottom:14,background:"#0A0A0A",padding:"12px 14px",cursor:"pointer"}} onClick={()=>setSoldeModal(true)}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}>
      <div style={{minWidth:0,flex:1}}>
        <p style={{fontSize:9,color:"#E8B64C",fontWeight:600,textTransform:"uppercase",letterSpacing:"0.04em"}}>Solde PostFinance</p>
        <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:19,fontWeight:700,color:"#fff",lineHeight:1,marginTop:3}}>{chf(st.soldeBancaire)}</p>
        <p style={{fontSize:9,color:"#737373",marginTop:3}}>Cliquer pour modifier</p>
      </div>
      <div style={{textAlign:"right",minWidth:0,flexShrink:0}}>
        <p style={{fontSize:9,color:"#A3A3A3",textTransform:"uppercase"}}>Résultat</p>
        <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:17,fontWeight:700,color:resultat>=0?"#86EFAC":"#FCA5A5",marginTop:2}}>
          {resultat>=0?"+":""}{chf(resultat)}
        </p>
      </div>
    </div>
  </Card>

  {/* Filtre période */}
  <div style={{display:"flex",gap:5,marginBottom:12,overflowX:"auto",paddingBottom:2,WebkitOverflowScrolling:"touch"}}>
    <button onClick={()=>setPeriode("tout")} style={{background:periode==="tout"?"#0A0A0A":"transparent",color:periode==="tout"?"#FAFAF7":"#525252",border:periode==="tout"?"none":"1px solid #EAE7E0",borderRadius:16,padding:"4px 10px",fontSize:11,fontWeight:periode==="tout"?600:500,cursor:"pointer",whiteSpace:"nowrap",flexShrink:0}}>Tout</button>
    {annees.map(a=>(
      <button key={a} onClick={()=>setPeriode(a)} style={{background:periode===a?"#0A0A0A":"transparent",color:periode===a?"#FAFAF7":"#525252",border:periode===a?"none":"1px solid #EAE7E0",borderRadius:16,padding:"4px 10px",fontSize:11,fontWeight:periode===a?600:500,cursor:"pointer",whiteSpace:"nowrap",flexShrink:0}}>{a}</button>
    ))}
    {mois.slice(0,6).map(m=>(
      <button key={m} onClick={()=>setPeriode(m)} style={{background:periode===m?"#0A0A0A":"transparent",color:periode===m?"#FAFAF7":"#525252",border:periode===m?"none":"1px solid #EAE7E0",borderRadius:16,padding:"4px 10px",fontSize:11,fontWeight:periode===m?600:500,cursor:"pointer",whiteSpace:"nowrap",flexShrink:0}}>{new Date(m+"-01").toLocaleDateString("fr-CH",{month:"short",year:"2-digit"})}</button>
    ))}
  </div>

  {/* 3 KPIs */}
  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginBottom:14}}>
    <Card style={{padding:"8px 5px",textAlign:"center",background:"#DCFCE7"}}>
      <p style={{fontSize:8,color:"#166534",fontWeight:700,textTransform:"uppercase"}}>Recettes</p>
      <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:15,fontWeight:700,color:"#166534",marginTop:2}}>{chf(recettes)}</p>
    </Card>
    <Card style={{padding:"8px 5px",textAlign:"center",background:"#FEE2E2"}}>
      <p style={{fontSize:8,color:"#991B1B",fontWeight:700,textTransform:"uppercase"}}>Dépenses</p>
      <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:15,fontWeight:700,color:"#991B1B",marginTop:2}}>{chf(depenses)}</p>
    </Card>
    <Card style={{padding:"8px 5px",textAlign:"center",background:resultat>=0?"#DBEAFE":"#FEE2E2"}}>
      <p style={{fontSize:8,color:resultat>=0?"#1E3A5F":"#991B1B",fontWeight:700,textTransform:"uppercase"}}>Résultat</p>
      <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:15,fontWeight:700,color:resultat>=0?"#1E3A5F":"#991B1B",marginTop:2}}>{chf(resultat)}</p>
    </Card>
  </div>

  {/* Onglets */}
  <div style={{display:"flex",gap:5,marginBottom:14,overflowX:"auto",paddingBottom:2,WebkitOverflowScrolling:"touch"}}>
    {[
      {id:"dashboard",l:"Aperçu"},
      {id:"tresorerie",l:"Trésor."},
      {id:"rentabilite",l:"Rent."},
      {id:"journal",l:"Journal"},
      {id:"resultat",l:"Résultat"},
      {id:"bilan",l:"Bilan"},
      {id:"recurrentes",l:"Récurr."},
    ].map(o=>(
      <button key={o.id} onClick={()=>setOnglet(o.id)} style={{background:onglet===o.id?"#0A0A0A":"transparent",color:onglet===o.id?"#FAFAF7":"#525252",border:onglet===o.id?"none":"1px solid #EAE7E0",borderRadius:8,padding:"6px 9px",fontSize:10.5,fontWeight:onglet===o.id?600:500,cursor:"pointer",whiteSpace:"nowrap",flexShrink:0,letterSpacing:"-0.01em"}}>
        {o.l}
      </button>
    ))}
  </div>

  {/* DASHBOARD - Graphique évolution */}
  {onglet==="dashboard"&&(
    <div>
      <Card style={{marginBottom:14}}>
        <h3 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:17,marginBottom:12}}>Évolution mensuelle</h3>
        {moisTries.length===0
          ? <p style={{fontSize:12,color:"#9CA3AF",textAlign:"center",padding:"20px 0"}}>Aucune donnée pour cette période</p>
          : (
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {moisTries.map(m=>{
                const mois = parMois[m];
                const label = new Date(m+"-01").toLocaleDateString("fr-CH",{month:"short",year:"2-digit"});
                const wR = Math.max((mois.recettes/maxValue)*100, 0);
                const wD = Math.max((mois.depenses/maxValue)*100, 0);
                const res = mois.recettes - mois.depenses;
                return (
                  <div key={m}>
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:4}}>
                      <span style={{fontWeight:600}}>{label}</span>
                      <span style={{color:res>=0?"#166534":"#991B1B",fontWeight:700}}>{res>=0?"+":""}{chf(res)}</span>
                    </div>
                    <div style={{display:"flex",gap:4,alignItems:"center"}}>
                      <div style={{flex:1,background:"#F5F5F0",borderRadius:4,overflow:"hidden",height:18,position:"relative"}}>
                        <div style={{background:"#22C55E",height:"100%",width:wR+"%",transition:"width .4s"}}/>
                      </div>
                      <span style={{fontSize:10,color:"#166534",fontWeight:600,minWidth:60,textAlign:"right"}}>{chf(mois.recettes)}</span>
                    </div>
                    <div style={{display:"flex",gap:4,alignItems:"center",marginTop:2}}>
                      <div style={{flex:1,background:"#F5F5F0",borderRadius:4,overflow:"hidden",height:18,position:"relative"}}>
                        <div style={{background:"#EF4444",height:"100%",width:wD+"%",transition:"width .4s"}}/>
                      </div>
                      <span style={{fontSize:10,color:"#991B1B",fontWeight:600,minWidth:60,textAlign:"right"}}>{chf(mois.depenses)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        }
        <div style={{display:"flex",gap:16,marginTop:12,justifyContent:"center",fontSize:11,color:"#6B7280"}}>
          <div style={{display:"flex",alignItems:"center",gap:4}}><span style={{width:10,height:10,background:"#22C55E",borderRadius:2}}/>Recettes</div>
          <div style={{display:"flex",alignItems:"center",gap:4}}><span style={{width:10,height:10,background:"#EF4444",borderRadius:2}}/>Dépenses</div>
        </div>
      </Card>

      {/* Alertes */}
      <Card style={{marginBottom:14}}>
        <h3 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:17,marginBottom:10}}>Points d'attention</h3>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {(factAttente.length>0 || cmdNonPayees.length>0) && (
            <div style={{background:"#FEF9E7",borderRadius:8,padding:"10px 12px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                <p style={{fontSize:12,fontWeight:600,color:"#92400E"}}>Créances clients</p>
                <span style={{fontWeight:700,color:"#92400E",fontSize:14}}>{chf(creancesClients)}</span>
              </div>
              {factAttente.length>0 && (
                <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:"#92400E",marginBottom:2,paddingLeft:8}}>
                  <span>📄 {factAttente.length} facture(s) partenaires</span>
                  <span>{chf(creancesFactures)}</span>
                </div>
              )}
              {cmdNonPayees.length>0 && (
                <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:"#92400E",paddingLeft:8}}>
                  <span>🛒 {cmdNonPayees.length} commande(s) web</span>
                  <span>{chf(creancesCommandes)}</span>
                </div>
              )}
            </div>
          )}
          <div style={{background:"#DBEAFE",borderRadius:8,padding:"10px 12px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <p style={{fontSize:12,fontWeight:600,color:"#1E3A5F"}}>Valeur stock</p>
              <p style={{fontSize:10,color:"#9CA3AF",marginTop:1}}>Coût de revient total</p>
            </div>
            <span style={{fontWeight:700,color:"#1E3A5F",fontSize:14}}>{chf(valeurStock)}</span>
          </div>
        </div>
      </Card>

      {/* Valorisation détaillée du stock */}
      <Card style={{marginBottom:14}}>
        <h3 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:17,marginBottom:12}}>Valorisation du stock</h3>
        {(()=>{
          const lignes = st.produits.filter(p=>p.actif && !p.nom.includes("Coffret")).map(p=>{
            const total = sum((st.stocks||[]).filter(s=>s.produitId===p.id).map(s=>s.qte));
            const enDepot = sum((st.depotStocks||[]).filter(d=>d.produitId===p.id).map(d=>d.qteDeposee-d.qteVendue-d.qteRetournee));
            const propre = total - enDepot;
            const cout = p.coutRevient||0;
            return {p, total, enDepot, propre, valTotal:total*cout, valPropre:propre*cout, valDepot:enDepot*cout, cout};
          });
          const totVal = sum(lignes.map(l=>l.valTotal));
          const totPropre = sum(lignes.map(l=>l.valPropre));
          const totDepot = sum(lignes.map(l=>l.valDepot));
          return (
            <>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14}}>
                <div style={{background:"#F0FDF4",borderRadius:10,padding:"10px",textAlign:"center"}}>
                  <p style={{fontSize:9,color:"#166534",fontWeight:600,textTransform:"uppercase"}}>Stock propre</p>
                  <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,fontWeight:700,color:"#166534"}}>{chf(totPropre)}</p>
                </div>
                <div style={{background:"#DBEAFE",borderRadius:10,padding:"10px",textAlign:"center"}}>
                  <p style={{fontSize:9,color:"#1E40AF",fontWeight:600,textTransform:"uppercase"}}>En dépôt</p>
                  <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,fontWeight:700,color:"#1E40AF"}}>{chf(totDepot)}</p>
                </div>
              </div>
              <p style={{fontSize:9,fontWeight:600,color:"#9CA3AF",textTransform:"uppercase",marginBottom:8,letterSpacing:"0.05em"}}>Détail par produit</p>
              {lignes.map(({p,total,enDepot,propre,valTotal,cout})=>(
                <div key={p.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:"1px solid #F5F5F0"}}>
                  <div style={{flex:1,minWidth:0}}>
                    <p style={{fontSize:12,fontWeight:600,color:"#111"}}>{p.nom} <span style={{color:"#9CA3AF",fontWeight:400}}>{p.variante}</span> <span style={{fontSize:10,color:"#9CA3AF"}}>{p.format}</span></p>
                    <p style={{fontSize:10,color:"#9CA3AF",marginTop:1}}>{total} u. total · {propre} propre · {enDepot} en dépôt · coût {chf(cout)}/u</p>
                  </div>
                  <p style={{fontSize:14,fontWeight:700,color:"#374151",flexShrink:0,marginLeft:8}}>{chf(valTotal)}</p>
                </div>
              ))}
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:12,paddingTop:10,borderTop:"2px solid #EAE7E0"}}>
                <p style={{fontWeight:700,fontSize:13}}>Total actif stock</p>
                <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,fontWeight:700,color:"#0A0A0A"}}>{chf(totVal)}</p>
              </div>
              <p style={{fontSize:9,color:"#9CA3AF",marginTop:6,textAlign:"center"}}>Valorisé au coût de revient · Compte 1200</p>
            </>
          );
        })()}
      </Card>
    </div>
  )}

  {/* JOURNAL */}
  {onglet==="journal"&&(
    <div style={{display:"flex",flexDirection:"column",gap:6}}>
      {transByPeriode.length===0
        ? <div style={{textAlign:"center",padding:"30px",color:"#9CA3AF"}}>
            <p>Aucune écriture</p>
          </div>
        : transByPeriode.slice().sort((a,b)=>b.date.localeCompare(a.date)).map((t,i)=>(
            <div key={t.id} style={{background:"#fff",border:"1px solid #EAE7E0",borderLeft:"3px solid "+(t.type==="recette"?"#22C55E":"#EF4444"),borderRadius:10,padding:"10px 12px"}}>
              {/* Ligne 1: libellé + montant */}
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8,marginBottom:4}}>
                <p style={{fontSize:13,fontWeight:600,color:"#0A0A0A",flex:1,minWidth:0,wordBreak:"break-word"}}>{t.description||t.libelle}</p>
                <p style={{fontSize:14,fontWeight:700,color:t.type==="recette"?"#15803D":"#B91C1C",whiteSpace:"nowrap",flexShrink:0}}>
                  {t.type==="recette"?"+":"-"}{chf(t.montant)}
                </p>
              </div>
              {/* Ligne 2: date, compte, catégorie */}
              <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap",marginBottom:8}}>
                <span style={{fontSize:10,color:"#737373"}}>{fmt(t.date)}</span>
                <span style={{fontSize:9,background:"#F4F4F2",borderRadius:4,padding:"1px 6px",fontFamily:"monospace",color:"#525252"}}>{t.compte}</span>
                <span style={{fontSize:10,color:"#737373"}}>{t.categorie}</span>
                {t.postfinance && <span style={{fontSize:9,background:"#DBEAFE",color:"#1E40AF",borderRadius:4,padding:"1px 6px"}}>💳 PF</span>}
              </div>
              {/* Justificatif badge */}
              {t.justificatif && (
                <div style={{marginBottom:6}}>
                  <button onClick={()=>{ const w=window.open(); w.document.write('<html><body style="margin:0"><iframe src="'+t.justificatif+'" width="100%" height="100%" style="border:none"></iframe></body></html>'); w.document.close(); }}
                    style={{background:"#EFF6FF",color:"#1D4ED8",border:"1px solid #BFDBFE",borderRadius:6,padding:"4px 10px",fontSize:11,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",gap:5}}>
                    📎 <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:180}}>{t.justificatifNom||"Justificatif"}</span>
                  </button>
                </div>
              )}
              {/* Ligne 3: actions */}
              <div style={{display:"flex",gap:6,justifyContent:"flex-end"}}>
                <button onClick={()=>{setForm({...t,montant:String(t.montant),justificatif:t.justificatif||"",justificatifNom:t.justificatifNom||""});setModal("form");}} style={{background:"#F4F4F2",border:"none",borderRadius:8,padding:"6px 10px",cursor:"pointer",display:"flex",alignItems:"center",gap:4,fontSize:11,fontWeight:500}}>
                  <Ic n="edit" s={12}/> Modifier
                </button>
                <button onClick={()=>{if(window.confirm("Supprimer ?"))del(t.id);}} style={{background:"#FEE2E2",color:"#991B1B",border:"none",borderRadius:8,padding:"6px 10px",cursor:"pointer",display:"flex",alignItems:"center",gap:4,fontSize:11,fontWeight:500}}>
                  <Ic n="trash" s={12}/>
                </button>
                {(t.factureId||t.commandeId||t.factureFournisseurId) && (
                  <span style={{fontSize:9,color:"#737373",background:"#F4F4F2",borderRadius:4,padding:"4px 8px",fontWeight:600}}>AUTO</span>
                )}
              </div>
            </div>
          ))
      }
    </div>
  )}

  {/* COMPTE DE RÉSULTAT */}
  {onglet==="resultat"&&(
    <div>
      <Card style={{marginBottom:12}}>
        <h3 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:17,marginBottom:10,color:"#166534"}}>↗ Recettes</h3>
        {catRecettes.length===0?<p style={{fontSize:12,color:"#9CA3AF"}}>Aucune recette</p>:
          catRecettes.map(c=>{
            const pct = recettes>0?((c.total/recettes)*100).toFixed(0):0;
            return (
              <div key={c.cat} style={{marginBottom:8}}>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:3}}>
                  <span style={{fontWeight:500}}>{c.cat}</span>
                  <span style={{fontWeight:700,color:"#166534"}}>{chf(c.total)} <span style={{color:"#9CA3AF",fontSize:10,fontWeight:400}}>({pct}%)</span></span>
                </div>
                <div style={{background:"#F5F5F0",borderRadius:4,height:6,overflow:"hidden"}}>
                  <div style={{background:"#22C55E",height:"100%",width:pct+"%"}}/>
                </div>
              </div>
            );
          })
        }
        <div style={{borderTop:"2px solid #166534",paddingTop:8,marginTop:8,display:"flex",justifyContent:"space-between",fontWeight:700}}>
          <span>Total recettes</span><span style={{color:"#166534"}}>{chf(recettes)}</span>
        </div>
      </Card>
      <Card style={{marginBottom:12}}>
        <h3 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:17,marginBottom:10,color:"#991B1B"}}>↘ Dépenses</h3>
        {catDepenses.length===0?<p style={{fontSize:12,color:"#9CA3AF"}}>Aucune dépense</p>:
          catDepenses.map(c=>{
            const pct = depenses>0?((c.total/depenses)*100).toFixed(0):0;
            return (
              <div key={c.cat} style={{marginBottom:8}}>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:3}}>
                  <span style={{fontWeight:500}}>{c.cat}</span>
                  <span style={{fontWeight:700,color:"#991B1B"}}>{chf(c.total)} <span style={{color:"#9CA3AF",fontSize:10,fontWeight:400}}>({pct}%)</span></span>
                </div>
                <div style={{background:"#F5F5F0",borderRadius:4,height:6,overflow:"hidden"}}>
                  <div style={{background:"#EF4444",height:"100%",width:pct+"%"}}/>
                </div>
              </div>
            );
          })
        }
        <div style={{borderTop:"2px solid #991B1B",paddingTop:8,marginTop:8,display:"flex",justifyContent:"space-between",fontWeight:700}}>
          <span>Total dépenses</span><span style={{color:"#991B1B"}}>{chf(depenses)}</span>
        </div>
      </Card>
      <Card style={{background:resultat>=0?"#DCFCE7":"#FEE2E2",border:"2px solid "+(resultat>=0?"#22C55E":"#EF4444")}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{fontSize:14,fontWeight:700,color:resultat>=0?"#166534":"#991B1B"}}>RÉSULTAT NET</span>
          <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:19,fontWeight:700,color:resultat>=0?"#166534":"#991B1B"}}>{resultat>=0?"+":""}{chf(resultat)}</span>
        </div>
      </Card>
    </div>
  )}

  {/* TRÉSORERIE - Prévisions */}
  {onglet==="tresorerie" && (
    <div>
      <Card style={{marginBottom:12,background:"#0A0A0A",color:"#fff"}}>
        <p style={{fontSize:10,color:"#E8B64C",fontWeight:600,textTransform:"uppercase",letterSpacing:"0.04em"}}>Solde actuel</p>
        <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:34,fontWeight:700,color:"#fff",marginTop:4}}>{chf(st.soldeBancaire||0)}</p>
        <p style={{fontSize:11,color:"#A3A3A3",marginTop:2}}>PostFinance · aujourd'hui</p>
      </Card>

      {(() => {
        const now = new Date();
        // Entrées prévues : factures partenaires en attente ou envoyées
        const facEntrees = (st.factures||[]).filter(f=>f.statut==="en attente"||f.statut==="envoyée").map(f=>{
          const montant = sum((f.lignes||[]).map(l=>{
            const p = st.produits.find(pr=>pr.id===l.produitId);
            return ((f.typeClient==="revendeur"?p?.prixRevendeur:p?.prixClient)||0)*(l.qte||0);
          }));
          const dateEcheance = new Date(f.date);
          dateEcheance.setDate(dateEcheance.getDate()+30);
          return {
            type: "entree",
            source: "Facture "+f.numero,
            montant,
            date: dateEcheance,
          };
        });

        // Entrées prévues : commandes directes sans facture encore encaissée
        const cmdEntrees = (st.commandes||[]).filter(c=>!c.factureNumero && c.statut!=="payée").map(c=>{
          const produitsTotal = sum((c.lignes||[]).filter(l=>l.produitId).map(l=>{
            const p2 = st.produits.find(x=>x.id===l.produitId);
            return (c.typeClient==="revendeur"?(p2?.prixRevendeur||0):(p2?.prixClient||0))*(l.qte||0);
          }));
          const net = produitsTotal - (parseFloat(c.rabais)||0) + (parseFloat(c.fraisPort)||0) - (parseFloat(c.commissionShopify)||0);
          return {
            type: "entree",
            source: "Commande "+c.numero+" ("+c.source+")",
            montant: Math.max(0, net),
            date: new Date(c.date),
          };
        });

        // Entrées prévues : dépenses récurrentes comme sorties (si elles tombent dans la période)
        const recurrSorties = (st.depensesRecurrentes||[]).filter(r=>r.actif!==false).flatMap(r=>{
          const items:any[] = [];
          const d = new Date(r.prochainPaiement||today());
          const d90 = new Date(now); d90.setDate(d90.getDate()+90);
          let cur = new Date(d);
          let iter = 0;
          while(cur <= d90 && iter < 12) {
            items.push({type:"sortie",source:"🔄 "+r.nom,montant:parseFloat(r.montant)||0,date:new Date(cur)});
            if(r.frequence==="mensuelle") cur.setMonth(cur.getMonth()+1);
            else if(r.frequence==="trimestrielle") cur.setMonth(cur.getMonth()+3);
            else cur.setFullYear(cur.getFullYear()+1);
            iter++;
          }
          return items;
        });

        const entreesPrevues = [...facEntrees, ...cmdEntrees];

        // Sorties prévues : factures fournisseurs à payer + dépenses récurrentes
        const sortiesPrevues = [
          ...(st.facturesFournisseurs||[]).filter(f=>f.statut==="à payer").map(f=>({
            type: "sortie" as const,
            source: f.fournisseur+(f.numero?" #"+f.numero:""),
            montant: parseFloat(f.montant)||0,
            date: new Date(f.dateEcheance || f.date),
          })),
          ...recurrSorties,
        ];

        const tousFlux = [...entreesPrevues, ...sortiesPrevues].sort((a,b)=>a.date-b.date);
        
        // Projections 30 / 60 / 90 jours
        const proj30 = new Date(now); proj30.setDate(proj30.getDate()+30);
        const proj60 = new Date(now); proj60.setDate(proj60.getDate()+60);
        const proj90 = new Date(now); proj90.setDate(proj90.getDate()+90);
        
        const flux30 = tousFlux.filter(f=>f.date<=proj30);
        const flux60 = tousFlux.filter(f=>f.date<=proj60);
        const flux90 = tousFlux.filter(f=>f.date<=proj90);
        
        const calcSolde = (flux) => {
          const entrees = sum(flux.filter(f=>f.type==="entree").map(f=>f.montant));
          const sorties = sum(flux.filter(f=>f.type==="sortie").map(f=>f.montant));
          return {
            entrees,
            sorties,
            solde: parseFloat(st.soldeBancaire||0) + entrees - sorties,
          };
        };
        
        const s30 = calcSolde(flux30);
        const s60 = calcSolde(flux60);
        const s90 = calcSolde(flux90);

        return (
          <>
            <Card style={{marginBottom:12}}>
              <h3 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:15,marginBottom:14,letterSpacing:"-0.015em"}}>Prévisions de trésorerie</h3>
              
              {[
                {label:"Dans 30 jours",data:s30,date:proj30},
                {label:"Dans 60 jours",data:s60,date:proj60},
                {label:"Dans 90 jours",data:s90,date:proj90},
              ].map((p,i)=>(
                <div key={i} style={{padding:"12px 0",borderBottom:i<2?"1px solid #EAE7E0":"none"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:4}}>
                    <p style={{fontSize:12,fontWeight:600}}>{p.label}</p>
                    <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,fontWeight:700,color:p.data.solde>=0?"#15803D":"#B91C1C"}}>{chf(p.data.solde)}</p>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:"#737373"}}>
                    <span>📅 {p.date.toLocaleDateString("fr-CH",{day:"numeric",month:"short"})}</span>
                    <span>+{chf(p.data.entrees)} · -{chf(p.data.sorties)}</span>
                  </div>
                </div>
              ))}
            </Card>

            {/* Flux à venir */}
            <Card style={{marginBottom:12}}>
              <h3 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:15,marginBottom:10,letterSpacing:"-0.015em"}}>Flux à venir</h3>
              {tousFlux.length === 0 ? (
                <p style={{fontSize:12,color:"#737373",textAlign:"center",padding:"10px 0"}}>Aucun flux prévu</p>
              ) : tousFlux.slice(0,10).map((f,i)=>{
                const jours = Math.floor((f.date - now)/86400000);
                return (
                  <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:i<Math.min(tousFlux.length,10)-1?"1px solid #F4F4F2":"none"}}>
                    <div>
                      <p style={{fontSize:12,fontWeight:500}}>
                        <span style={{color:f.type==="entree"?"#15803D":"#B91C1C",marginRight:6}}>{f.type==="entree"?"↗":"↘"}</span>
                        {f.source}
                      </p>
                      <p style={{fontSize:10,color:"#737373",marginTop:2}}>
                        {jours < 0 ? `Échu depuis ${Math.abs(jours)}j` : jours === 0 ? "Aujourd'hui" : `Dans ${jours}j`} · {f.date.toLocaleDateString("fr-CH",{day:"numeric",month:"short"})}
                      </p>
                    </div>
                    <p style={{fontSize:13,fontWeight:700,color:f.type==="entree"?"#15803D":"#B91C1C"}}>
                      {f.type==="entree"?"+":"-"}{chf(f.montant)}
                    </p>
                  </div>
                );
              })}
            </Card>

            {/* Alerte si solde négatif */}
            {(s30.solde < 0 || s60.solde < 0 || s90.solde < 0) && (
              <Card style={{background:"#FEF2F2",border:"1px solid #FECACA"}}>
                <p style={{fontSize:12,fontWeight:700,color:"#B91C1C",marginBottom:4}}>⚠️ Attention trésorerie</p>
                <p style={{fontSize:11,color:"#B91C1C"}}>
                  Ton solde projeté devient négatif. Pense à relancer les factures impayées ou négocier les échéances fournisseurs.
                </p>
              </Card>
            )}
          </>
        );
      })()}
    </div>
  )}

  {/* RENTABILITÉ */}
  {onglet==="rentabilite"&&(
    <div>
      {/* TOTAL MARGE BRUTE — basé sur les écritures comptables */}
      {(()=>{
        // Un compte par famille de produit
        const ca3001 = sum(transByPeriode.filter(t=>t.type==="recette"&&t.compte==="3001").map(t=>+t.montant));
        const ca3002 = sum(transByPeriode.filter(t=>t.type==="recette"&&t.compte==="3002").map(t=>+t.montant));
        const ca3003 = sum(transByPeriode.filter(t=>t.type==="recette"&&t.compte==="3003").map(t=>+t.montant));
        const ca3004 = sum(transByPeriode.filter(t=>t.type==="recette"&&t.compte==="3004").map(t=>+t.montant));
        const caTotal = ca3001+ca3002+ca3003+ca3004;
        let totalUnites=0, totalMarge=0;
        // Bouteilles (compte unique par produit)
        st.produits.filter(p=>p.actif&&!p.nom.includes("Coffret")).forEach(p=>{
          const caP = p.nom==="Limonta"?ca3001:p.nom==="Limelo"?ca3002:p.nom==="Clementino"?ca3003:0;
          const prix = p.prixClient||1;
          const units = Math.round(caP/prix);
          totalUnites += units;
          totalMarge += caP - units*(p.coutRevient||0);
        });
        // Coffrets (partagent 3004)
        const coffretsProd = st.produits.filter(p=>p.actif&&p.nom.includes("Coffret"));
        if(coffretsProd.length>0 && ca3004>0) {
          const prixMoy = sum(coffretsProd.map(p=>p.prixClient||0))/coffretsProd.length;
          const coutMoy = sum(coffretsProd.map(p=>p.coutRevient||0))/coffretsProd.length;
          const unitsCoffrets = prixMoy>0?Math.round(ca3004/prixMoy):0;
          totalUnites += unitsCoffrets;
          totalMarge += ca3004 - unitsCoffrets*coutMoy;
        }
        const pct = caTotal>0?Math.round((totalMarge/caTotal)*100):0;
        return (
          <div style={{background:"linear-gradient(135deg,#1a1a1a 0%,#2d2d2d 100%)",borderRadius:14,padding:"16px",marginBottom:12,color:"#fff"}}>
            <p style={{fontSize:10,fontWeight:600,color:"#F2C94C",textTransform:"uppercase",letterSpacing:".08em",marginBottom:2}}>
              Marge brute réelle {periode==="tout"?"— toutes périodes":`— ${periode}`}
            </p>
            <p style={{fontSize:9,color:"#888",marginBottom:10}}>Source : écritures comptables uniquement</p>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
              <div style={{textAlign:"center"}}>
                <p style={{fontSize:17,fontWeight:800,color:"#F2C94C",lineHeight:1}}>{totalUnites}</p>
                <p style={{fontSize:9,color:"#aaa",marginTop:3}}>unités (estimé)</p>
              </div>
              <div style={{textAlign:"center"}}>
                <p style={{fontSize:15,fontWeight:800,color:"#fff",lineHeight:1}}>{chf(caTotal)}</p>
                <p style={{fontSize:9,color:"#aaa",marginTop:3}}>CA comptabilisé</p>
              </div>
              <div style={{textAlign:"center"}}>
                <p style={{fontSize:15,fontWeight:800,color:totalMarge>0?"#4ADE80":"#F87171",lineHeight:1}}>{chf(totalMarge)}</p>
                <p style={{fontSize:9,color:"#aaa",marginTop:3}}>marge brute ({pct}%)</p>
              </div>
            </div>
            {caTotal===0&&<p style={{fontSize:11,color:"#aaa",textAlign:"center",marginTop:8}}>Aucune écriture de vente sur cette période — ajoute des transactions dans Comptabilité</p>}
          </div>
        );
      })()}
      <Card style={{marginBottom:12}}>
        <h3 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:16,marginBottom:4,letterSpacing:"-0.015em"}}>Marges & volumes par produit</h3>
        <p style={{fontSize:11,color:"#737373",marginBottom:14}}>CA & marge réels depuis les écritures comptables · marges théoriques par prix</p>
        {(()=>{
          // Pré-calcul des CA par compte depuis transactions
          const ca3001 = sum(transByPeriode.filter(t=>t.type==="recette"&&t.compte==="3001").map(t=>+t.montant));
          const ca3002 = sum(transByPeriode.filter(t=>t.type==="recette"&&t.compte==="3002").map(t=>+t.montant));
          const ca3003 = sum(transByPeriode.filter(t=>t.type==="recette"&&t.compte==="3003").map(t=>+t.montant));
          const ca3004 = sum(transByPeriode.filter(t=>t.type==="recette"&&t.compte==="3004").map(t=>+t.montant));
          const nbCoffrets = Math.max(1, st.produits.filter(p=>p.actif&&p.nom.includes("Coffret")).length);

          return st.produits.filter(p=>p.actif).map((p,idx,arr)=>{
            const isCoffret = p.nom.includes("Coffret");
            const prevIsCoffret = idx>0 && arr[idx-1].nom.includes("Coffret");
            const showDivider = isCoffret && !prevIsCoffret;
            const cout = p.coutRevient||0;
            const margeP = p.prixClient-cout;
            const margePPct = p.prixClient?((margeP/p.prixClient)*100).toFixed(0):0;
            const margePro = p.prixRevendeur-cout;
            const margeProPct = p.prixRevendeur?((margePro/p.prixRevendeur)*100).toFixed(0):0;
            const c = COULEURS[p.variante]||{accent:"#737373"};

            // CA depuis les transactions (compte produit)
            const caP = isCoffret
              ? ca3004/nbCoffrets
              : p.nom==="Limonta"?ca3001:p.nom==="Limelo"?ca3002:p.nom==="Clementino"?ca3003:0;
            const totalUnites = p.prixClient>0?Math.round(caP/p.prixClient):0;
            const margeGeneree = caP - totalUnites*cout;

            return (
              <React.Fragment key={p.id}>
                {showDivider && (
                  <div style={{display:"flex",alignItems:"center",gap:8,padding:"10px 0 6px",margin:"4px 0"}}>
                    <div style={{flex:1,height:1,background:"#EAE7E0"}}/>
                    <span style={{fontSize:10,fontWeight:700,color:"#737373",textTransform:"uppercase",letterSpacing:".07em"}}>🎁 Coffrets</span>
                    <div style={{flex:1,height:1,background:"#EAE7E0"}}/>
                  </div>
                )}
                <div style={{padding:"12px 0",borderBottom:"1px solid #EAE7E0"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:6}}>
                    <p style={{fontSize:13,fontWeight:600}}>{p.nom} <span style={{color:c.accent,fontWeight:400,fontSize:12}}>{p.variante}</span> {p.format}</p>
                    <p style={{fontSize:11,color:"#737373"}}>Coût: <strong>{chf(cout)}</strong></p>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,fontSize:11,marginBottom:8}}>
                    <div style={{background:"#F4F4F2",borderRadius:6,padding:"6px 8px"}}>
                      <p style={{color:"#737373",fontSize:10,fontWeight:500}}>PUBLIC {chf(p.prixClient)}</p>
                      <p style={{fontWeight:700,color:margePPct>30?"#15803D":margePPct>15?"#9A3412":"#B91C1C",marginTop:2}}>
                        {margePPct}% <span style={{fontSize:10,fontWeight:400}}>· {chf(margeP)}/u</span>
                      </p>
                    </div>
                    <div style={{background:"#F4F4F2",borderRadius:6,padding:"6px 8px"}}>
                      <p style={{color:"#737373",fontSize:10,fontWeight:500}}>PRO {chf(p.prixRevendeur)}</p>
                      <p style={{fontWeight:700,color:margeProPct>30?"#15803D":margeProPct>15?"#9A3412":"#B91C1C",marginTop:2}}>
                        {margeProPct}% <span style={{fontSize:10,fontWeight:400}}>· {chf(margePro)}/u</span>
                      </p>
                    </div>
                  </div>
                  {caP>0 ? (
                    <div style={{background:"#EFF6FF",borderRadius:6,padding:"7px 10px",display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:4}}>
                      <div style={{textAlign:"center"}}>
                        <p style={{fontSize:8,color:"#1E40AF",fontWeight:600,textTransform:"uppercase"}}>Vendues</p>
                        <p style={{fontSize:14,fontWeight:700,color:"#1E40AF",marginTop:1}}>{totalUnites}</p>
                        <p style={{fontSize:8,color:"#6B7280"}}>{isCoffret?"estimé*":"estimé"}</p>
                      </div>
                      <div style={{textAlign:"center"}}>
                        <p style={{fontSize:8,color:"#1E40AF",fontWeight:600,textTransform:"uppercase"}}>CA</p>
                        <p style={{fontSize:13,fontWeight:700,color:"#1E40AF",marginTop:1}}>{chf(caP)}</p>
                        {isCoffret&&<p style={{fontSize:8,color:"#6B7280"}}>réparti /coffret</p>}
                      </div>
                      <div style={{textAlign:"center"}}>
                        <p style={{fontSize:8,color:margeGeneree>0?"#15803D":"#B91C1C",fontWeight:600,textTransform:"uppercase"}}>Marge</p>
                        <p style={{fontSize:13,fontWeight:700,color:margeGeneree>0?"#15803D":"#B91C1C",marginTop:1}}>{chf(margeGeneree)}</p>
                      </div>
                    </div>
                  ) : (
                    <p style={{fontSize:10,color:"#9CA3AF",textAlign:"center",padding:"2px 0"}}>Aucune écriture comptable sur cette période</p>
                  )}
                </div>
              </React.Fragment>
            );
          });
        })()}
      </Card>

      {/* Analyse prix recommandés */}
      <Card style={{marginBottom:12}}>
        <h3 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:15,marginBottom:6,letterSpacing:"-0.015em"}}>💡 Analyse des prix</h3>
        <p style={{fontSize:11,color:"#737373",marginBottom:14}}>Basé sur ton coût de revient, tes charges et les standards du marché suisse</p>
        {st.produits.filter(p=>p.actif).map((p,idx,arr)=>{
          const isCoffret = p.nom.includes("Coffret");
          const prevIsCoffret = idx>0 && arr[idx-1].nom.includes("Coffret");
          const showDividerA = isCoffret && !prevIsCoffret;
          const cout = p.coutRevient||0;
          if(cout===0) return (
            <div key={p.id} style={{padding:"10px 12px",background:"#F4F4F2",borderRadius:8,marginBottom:8,fontSize:11,color:"#737373"}}>
              <strong>{p.nom} {p.variante} {p.format}</strong> - Saisis d'abord le coût de revient dans la fiche produit
            </div>
          );

          // Calculs prix recommandés
          const plancher = cout * 1.5;
          const recommPro = cout * 2;
          const recommPublic = cout * 3;
          const premium = cout * 4;

          // Fourchettes marché suisse
          const fourchette = isCoffret
            ? (p.variante.toLowerCase().includes("verres")?{min:60,max:100}:{min:50,max:90})
            : (p.format==="25cl"?{min:18,max:28}:p.format==="50cl"?{min:28,max:42}:{min:20,max:35});

          // Analyse prix actuel
          const ecartPublic = p.prixClient - recommPublic;
          const ecartPro = p.prixRevendeur - recommPro;
          const margePublicPct = p.prixClient?((p.prixClient-cout)/p.prixClient*100).toFixed(0):0;
          const margeProPct = p.prixRevendeur?((p.prixRevendeur-cout)/p.prixRevendeur*100).toFixed(0):0;

          // Verdict
          const dansFourchette = p.prixClient>=fourchette.min && p.prixClient<=fourchette.max;
          let verdict = {color:"#15803D",bg:"#F0FDF4",border:"#BBF7D0",icon:"✅",msg:"Prix bien positionné"};
          if(margePublicPct<40) verdict = {color:"#B91C1C",bg:"#FEF2F2",border:"#FECACA",icon:"🔴",msg:"Marge trop faible - Augmente le prix"};
          else if(margePublicPct>75 && !dansFourchette && p.prixClient>fourchette.max) verdict = {color:"#9A3412",bg:"#FDF6E3",border:"#FCD34D",icon:"⚠️",msg:"Prix au-dessus du marché"};
          else if(margePublicPct<55) verdict = {color:"#9A3412",bg:"#FDF6E3",border:"#FCD34D",icon:"⚠️",msg:"Marge un peu juste"};

          const c = COULEURS[p.variante]||{accent:"#737373"};

          return (
            <React.Fragment key={p.id}>
              {showDividerA && (
                <div style={{display:"flex",alignItems:"center",gap:8,padding:"10px 0 6px"}}>
                  <div style={{flex:1,height:1,background:"#EAE7E0"}}/>
                  <span style={{fontSize:10,fontWeight:700,color:"#737373",textTransform:"uppercase",letterSpacing:".07em"}}>🎁 Coffrets</span>
                  <div style={{flex:1,height:1,background:"#EAE7E0"}}/>
                </div>
              )}
            <div style={{padding:"12px",background:"#fff",border:"1px solid #EAE7E0",borderRadius:10,marginBottom:10}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:10,paddingBottom:8,borderBottom:"1px solid #F4F4F2"}}>
                <p style={{fontSize:13,fontWeight:600}}>{p.nom} <span style={{color:c.accent,fontWeight:400,fontSize:12}}>{p.variante}</span> {p.format}</p>
                <p style={{fontSize:10,color:"#737373"}}>Coût: <strong>{chf(cout)}</strong></p>
              </div>

              {/* Verdict */}
              <div style={{background:verdict.bg,border:"1px solid "+verdict.border,borderRadius:8,padding:"8px 10px",marginBottom:10}}>
                <p style={{fontSize:12,fontWeight:600,color:verdict.color}}>{verdict.icon} {verdict.msg}</p>
                <p style={{fontSize:10,color:verdict.color,marginTop:2,opacity:.85}}>
                  Actuel public: {chf(p.prixClient)} ({margePublicPct}%) · pro: {chf(p.prixRevendeur)} ({margeProPct}%)
                </p>
              </div>

              {/* Suggestions prix */}
              <div style={{marginBottom:8}}>
                <p style={{fontSize:9,fontWeight:600,color:"#737373",textTransform:"uppercase",marginBottom:6}}>Prix suggérés PUBLIC</p>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4,fontSize:10}}>
                  <div style={{background:"#FEF2F2",padding:"6px 4px",borderRadius:6,textAlign:"center"}}>
                    <p style={{color:"#B91C1C",fontWeight:600,fontSize:8}}>PLANCHER</p>
                    <p style={{fontWeight:700,marginTop:2}}>{chf(plancher)}</p>
                    <p style={{color:"#737373",fontSize:8}}>marge 33%</p>
                  </div>
                  <div style={{background:"#FDF6E3",padding:"6px 4px",borderRadius:6,textAlign:"center"}}>
                    <p style={{color:"#9A3412",fontWeight:600,fontSize:8}}>PRO</p>
                    <p style={{fontWeight:700,marginTop:2}}>{chf(recommPro)}</p>
                    <p style={{color:"#737373",fontSize:8}}>marge 50%</p>
                  </div>
                  <div style={{background:"#F0FDF4",padding:"6px 4px",borderRadius:6,textAlign:"center",border:"1.5px solid #BBF7D0"}}>
                    <p style={{color:"#15803D",fontWeight:600,fontSize:8}}>PUBLIC ⭐</p>
                    <p style={{fontWeight:700,marginTop:2}}>{chf(recommPublic)}</p>
                    <p style={{color:"#737373",fontSize:8}}>marge 66%</p>
                  </div>
                  <div style={{background:"#EFF6FF",padding:"6px 4px",borderRadius:6,textAlign:"center"}}>
                    <p style={{color:"#1E40AF",fontWeight:600,fontSize:8}}>PREMIUM</p>
                    <p style={{fontWeight:700,marginTop:2}}>{chf(premium)}</p>
                    <p style={{color:"#737373",fontSize:8}}>marge 75%</p>
                  </div>
                </div>
              </div>

              {/* Fourchette marché */}
              <div style={{background:"#F4F4F2",borderRadius:6,padding:"6px 10px",fontSize:10,color:"#525252"}}>
                📊 Marché suisse {isCoffret?"coffrets":("liqueurs artisanales "+p.format)} : <strong>{chf(fourchette.min)} - {chf(fourchette.max)}</strong>
                {dansFourchette?" ✓ Ton prix est dans la fourchette":" ⚠ Ton prix est hors fourchette"}
              </div>
            </div>
            </React.Fragment>
          );
        })}

        {/* Note méthodologique */}
        <div style={{marginTop:14,padding:"10px 12px",background:"#F4F4F2",borderRadius:8,fontSize:10,color:"#737373",lineHeight:1.5}}>
          <p style={{fontWeight:600,color:"#525252",marginBottom:4}}>📌 Comment lire ces suggestions</p>
          <p>• <strong>Plancher</strong> : en-dessous, tu ne gagnes pas assez pour être rentable</p>
          <p>• <strong>Pro</strong> : prix recommandé pour tes revendeurs (dépôt-vente, boutiques)</p>
          <p>• <strong>Public</strong> : prix standard pour les liqueurs artisanales premium</p>
          <p>• <strong>Premium</strong> : positionnement haut de gamme (si histoire forte, packaging luxe)</p>
          <p style={{marginTop:4,fontStyle:"italic"}}>Les fourchettes marché sont basées sur les liqueurs artisanales suisses (Studer, Humbel, Morand, Etter, etc.)</p>
        </div>
      </Card>

      {/* Top 5 ventes */}
      <Card style={{marginBottom:12}}>
        <h3 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:15,marginBottom:14,letterSpacing:"-0.015em"}}>Top produits (CA {periode==="tout"?"global":periode})</h3>
        {(() => {
          const ventesParProd = {};
          transByPeriode.filter(t=>t.type==="recette").forEach(t=>{
            const cat = t.categorie||"Autres";
            if(!ventesParProd[cat]) ventesParProd[cat] = 0;
            ventesParProd[cat] += +t.montant;
          });
          const total = sum(Object.values(ventesParProd));
          const sorted = Object.entries(ventesParProd).filter(([k])=>k.startsWith("Vente")).sort((a,b)=>b[1]-a[1]);
          if(sorted.length===0) return <p style={{fontSize:12,color:"#737373",textAlign:"center",padding:"10px 0"}}>Aucune vente sur cette période</p>;
          return sorted.map(([cat,val])=>{
            const pct = total?((val/total)*100).toFixed(0):0;
            return (
              <div key={cat} style={{marginBottom:10}}>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:4}}>
                  <span style={{fontWeight:500}}>{cat}</span>
                  <span style={{fontWeight:700}}>{chf(val)} <span style={{color:"#737373",fontSize:10,fontWeight:400}}>({pct}%)</span></span>
                </div>
                <div style={{background:"#F4F4F2",borderRadius:4,height:6,overflow:"hidden"}}>
                  <div style={{background:"#0A0A0A",height:"100%",width:pct+"%"}}/>
                </div>
              </div>
            );
          });
        })()}
      </Card>

      {/* Point mort */}
      <Card style={{marginBottom:12,background:"#FDF6E3",border:"1px solid #FCD34D"}}>
        <h3 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:15,marginBottom:8,letterSpacing:"-0.015em",color:"#9A3412"}}>⚡ Point mort mensuel</h3>
        {(() => {
          const chargesFixes = (() => {
            const categoriesFixes = ["Services","Salaires","Frais bancaires","Assurances","Locaux","Téléphone","Internet"];
            return sum(transByPeriode.filter(t=>t.type==="depense"&&categoriesFixes.includes(t.categorie)).map(t=>+t.montant));
          })();
          const moisPeriode = periode==="tout"?12:periode.length===4?12:1;
          const chargesMensuelles = chargesFixes/moisPeriode;
          const margeMoyenne = st.produits.filter(p=>p.actif)
            .reduce((acc,p)=>{
              const m = p.prixClient-(p.coutRevient||0);
              return acc+m;
            },0) / Math.max(1, st.produits.filter(p=>p.actif).length);
          const bouteillesNecessaires = margeMoyenne>0?Math.ceil(chargesMensuelles/margeMoyenne):0;
          return (
            <div>
              <p style={{fontSize:12,color:"#9A3412",marginBottom:8}}>Pour couvrir tes charges fixes mensuelles :</p>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:6}}>
                <span style={{fontSize:11,color:"#737373"}}>Charges fixes / mois</span>
                <span style={{fontWeight:600}}>{chf(chargesMensuelles)}</span>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:10}}>
                <span style={{fontSize:11,color:"#737373"}}>Marge moyenne / bouteille</span>
                <span style={{fontWeight:600}}>{chf(margeMoyenne)}</span>
              </div>
              <div style={{background:"#fff",borderRadius:8,padding:"12px",textAlign:"center"}}>
                <p style={{fontSize:10,color:"#737373",fontWeight:500,textTransform:"uppercase"}}>Tu dois vendre</p>
                <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:32,fontWeight:700,color:"#9A3412",lineHeight:1,margin:"4px 0"}}>
                  {bouteillesNecessaires}
                </p>
                <p style={{fontSize:11,color:"#737373"}}>bouteilles par mois pour être rentable</p>
              </div>
            </div>
          );
        })()}
      </Card>

      {/* Analyse coûts */}
      <Card>
        <h3 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:15,marginBottom:12,letterSpacing:"-0.015em"}}>Répartition des dépenses</h3>
        {catDepenses.length===0?<p style={{fontSize:12,color:"#737373",textAlign:"center",padding:"10px 0"}}>Aucune dépense</p>:
          catDepenses.slice(0,8).map(c=>{
            const pct = depenses?((c.total/depenses)*100).toFixed(0):0;
            return (
              <div key={c.cat} style={{marginBottom:8}}>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:3}}>
                  <span>{c.cat}</span>
                  <span style={{fontWeight:600}}>{chf(c.total)} <span style={{color:"#737373",fontSize:10,fontWeight:400}}>({pct}%)</span></span>
                </div>
                <div style={{background:"#F4F4F2",borderRadius:4,height:5,overflow:"hidden"}}>
                  <div style={{background:"#B91C1C",height:"100%",width:pct+"%",opacity:.7}}/>
                </div>
              </div>
            );
          })
        }
      </Card>
    </div>
  )}

  {/* BILAN SIMPLIFIÉ */}
  {onglet==="bilan"&&(
    <div>
      <Card style={{marginBottom:12}}>
        <h3 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:17,marginBottom:10,color:"#1E3A5F"}}>💰 Actif (ce que je possède)</h3>
        <div style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid #F5F5F0"}}>
          <div>
            <p style={{fontSize:13,fontWeight:500}}>Compte bancaire PostFinance</p>
            <p style={{fontSize:10,color:"#9CA3AF"}}>Liquidités</p>
          </div>
          <span style={{fontWeight:700,fontSize:14}}>{chf(st.soldeBancaire)}</span>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid #F5F5F0"}}>
          <div>
            <p style={{fontSize:13,fontWeight:500}}>Créances clients</p>
            <p style={{fontSize:10,color:"#9CA3AF"}}>Factures en attente de paiement</p>
          </div>
          <span style={{fontWeight:700,fontSize:14}}>{chf(creancesClients)}</span>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",padding:"8px 0"}}>
          <div>
            <p style={{fontSize:13,fontWeight:500}}>Stocks de produits finis</p>
            <p style={{fontSize:10,color:"#9CA3AF"}}>Valeur au coût de revient</p>
          </div>
          <span style={{fontWeight:700,fontSize:14}}>{chf(valeurStock)}</span>
        </div>
        <div style={{borderTop:"2px solid #1E3A5F",paddingTop:8,marginTop:8,display:"flex",justifyContent:"space-between",fontWeight:700}}>
          <span>TOTAL ACTIF</span><span style={{color:"#1E3A5F",fontSize:16}}>{chf(st.soldeBancaire+creancesClients+valeurStock)}</span>
        </div>
      </Card>

      <Card>
        <h3 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:17,marginBottom:10,color:"#92400E"}}>📉 Passif (ce que je dois)</h3>
        <p style={{fontSize:12,color:"#9CA3AF",textAlign:"center",padding:"10px 0"}}>Aucune dette enregistrée</p>
        <div style={{borderTop:"2px solid #92400E",paddingTop:8,marginTop:8,display:"flex",justifyContent:"space-between",fontWeight:700}}>
          <span>TOTAL PASSIF</span><span style={{color:"#92400E",fontSize:16}}>{chf(0)}</span>
        </div>
      </Card>

      <Card style={{marginTop:12,background:"#FEF9E7",border:"2px solid #F2C94C"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <p style={{fontSize:13,fontWeight:700,color:"#92400E"}}>PATRIMOINE NET</p>
            <p style={{fontSize:10,color:"#9CA3AF",marginTop:1}}>Actif - Passif</p>
          </div>
          <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,fontWeight:700,color:"#D4A017"}}>
            {chf(st.soldeBancaire+creancesClients+valeurStock)}
          </span>
        </div>
      </Card>
    </div>
  )}

  {/* DÉPENSES RÉCURRENTES */}
  {onglet==="recurrentes"&&(
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <div>
          <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:19,fontWeight:700}}>Dépenses récurrentes</p>
          <p style={{fontSize:11,color:"#737373",marginTop:2}}>Loyer, assurances, abonnements… apparaissent dans la trésorerie prévisionnelle.</p>
        </div>
        <Btn icon="plus" small onClick={()=>{setRForm(emptyR());setRModal(true);}}>Ajouter</Btn>
      </div>

      {(st.depensesRecurrentes||[]).length===0 ? (
        <div style={{textAlign:"center",padding:"40px 20px",color:"#737373"}}>
          <p style={{fontSize:36,marginBottom:8}}>🔄</p>
          <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:18,color:"#374151",fontWeight:600}}>Aucune dépense récurrente</p>
          <p style={{fontSize:12,marginTop:6}}>Ajoute tes charges fixes pour les voir dans la trésorerie prévisionnelle.</p>
        </div>
      ) : (
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {(st.depensesRecurrentes||[]).map((r:any)=>{
            const prochaineDate = new Date(r.prochainPaiement);
            const jours = Math.floor((prochaineDate.getTime() - Date.now())/86400000);
            const enRetard = jours < 0;
            const urgent = jours <= 7 && jours >= 0;
            return (
              <Card key={r.id} style={{padding:"12px 14px",opacity:r.actif===false?.5:1,borderLeft:enRetard?"3px solid #B91C1C":urgent?"3px solid #E8B64C":"3px solid #D1D5DB"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:3}}>
                      <p style={{fontSize:13,fontWeight:700}}>{r.nom}</p>
                      <span style={{fontSize:9,background:"#F4F4F2",borderRadius:4,padding:"1px 6px",fontFamily:"monospace",color:"#525252"}}>{r.compte}</span>
                    </div>
                    <p style={{fontSize:11,color:"#737373"}}>{r.frequence} · {r.categorie}</p>
                    <p style={{fontSize:10,color:enRetard?"#B91C1C":urgent?"#9A3412":"#525252",marginTop:3,fontWeight:enRetard||urgent?600:400}}>
                      {enRetard
                        ? `⚠️ Dû depuis ${Math.abs(jours)}j — ${fmt(r.prochainPaiement)}`
                        : jours===0 ? "🔴 Dû aujourd'hui"
                        : urgent ? `🟡 Dans ${jours}j — ${fmt(r.prochainPaiement)}`
                        : `Prochain : ${fmt(r.prochainPaiement)}`
                      }
                    </p>
                  </div>
                  <div style={{textAlign:"right",flexShrink:0}}>
                    <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:18,fontWeight:700,color:"#B91C1C"}}>{chf(r.montant)}</p>
                    <div style={{display:"flex",gap:5,marginTop:6,justifyContent:"flex-end"}}>
                      <button onClick={()=>{
                        const conf = window.confirm(`Comptabiliser "${r.nom}" — ${chf(r.montant)} ?\nUne écriture de dépense sera créée.`);
                        if(!conf) return;
                        const newTrans = {id:uid(),date:today(),compte:r.compte,libelle:r.nom,type:"depense",categorie:r.categorie,montant:parseFloat(r.montant)||0,description:"Dépense récurrente : "+r.nom,postfinance:true};
                        const next = new Date(r.prochainPaiement);
                        if(r.frequence==="mensuelle") next.setMonth(next.getMonth()+1);
                        else if(r.frequence==="trimestrielle") next.setMonth(next.getMonth()+3);
                        else next.setFullYear(next.getFullYear()+1);
                        const nextStr = next.toISOString().slice(0,10);
                        setSt((p:any)=>({...p,
                          transactions:[...(p.transactions||[]),newTrans],
                          soldeBancaire:parseFloat((parseFloat(p.soldeBancaire||0)-(parseFloat(r.montant)||0)).toFixed(2)),
                          depensesRecurrentes:(p.depensesRecurrentes||[]).map((x:any)=>x.id===r.id?{...x,prochainPaiement:nextStr}:x),
                        }));
                      }} style={{background:"#15803D",color:"#fff",border:"none",borderRadius:7,padding:"5px 9px",fontSize:10,fontWeight:600,cursor:"pointer"}}>✓ Payer</button>
                      <button onClick={()=>{setRForm({...r,montant:String(r.montant)});setRModal(true);}} style={{background:"#F4F4F2",border:"none",borderRadius:7,padding:"5px 9px",fontSize:10,cursor:"pointer"}}>✏️</button>
                      <button onClick={()=>{if(window.confirm("Supprimer cette dépense récurrente ?"))setSt((p:any)=>({...p,depensesRecurrentes:(p.depensesRecurrentes||[]).filter((x:any)=>x.id!==r.id)}));}} style={{background:"#FEE2E2",color:"#991B1B",border:"none",borderRadius:7,padding:"5px 9px",fontSize:10,cursor:"pointer"}}>🗑</button>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Résumé mensuel */}
      {(st.depensesRecurrentes||[]).filter((r:any)=>r.actif!==false).length>0 && (
        <Card style={{marginTop:14,background:"#FEF9E7",border:"1px solid #FCD34D",padding:"12px 14px"}}>
          <p style={{fontSize:10,fontWeight:600,color:"#9A3412",textTransform:"uppercase",marginBottom:8}}>Charge mensuelle équivalente</p>
          {(() => {
            const total = (st.depensesRecurrentes||[]).filter((r:any)=>r.actif!==false).reduce((acc:number,r:any)=>{
              const m = parseFloat(r.montant)||0;
              return acc + (r.frequence==="mensuelle"?m:r.frequence==="trimestrielle"?m/3:m/12);
            },0);
            return <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:24,fontWeight:700,color:"#9A3412"}}>{chf(total)}<span style={{fontSize:12,color:"#9CA3AF",fontWeight:400}}> / mois</span></p>;
          })()}
        </Card>
      )}

      {/* Modal */}
      {rModal&&(
        <Modal title={rForm.id?"Modifier dépense récurrente":"Nouvelle dépense récurrente"} onClose={()=>setRModal(false)}>
          <div style={{display:"grid",gap:12}}>
            <F label="Nom de la dépense" value={rForm.nom} onChange={(v:string)=>setRForm((p:any)=>({...p,nom:v}))} required placeholder="Ex: Loyer atelier, Assurance responsabilité..."/>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <F label="Montant (CHF)" type="number" value={rForm.montant||""} onChange={(v:string)=>setRForm((p:any)=>({...p,montant:v}))} required/>
              <Sel label="Fréquence" value={rForm.frequence} onChange={(v:string)=>setRForm((p:any)=>({...p,frequence:v}))}
                options={[{v:"mensuelle",l:"Mensuelle"},{v:"trimestrielle",l:"Trimestrielle"},{v:"annuelle",l:"Annuelle"}]}/>
            </div>
            <F label="Prochain paiement" type="date" value={rForm.prochainPaiement} onChange={(v:string)=>setRForm((p:any)=>({...p,prochainPaiement:v}))}/>
            <Sel label="Catégorie" value={rForm.categorie} onChange={(v:string)=>setRForm((p:any)=>({...p,categorie:v}))}
              options={CATEGORIES_DEPENSE.map(c=>({v:c,l:c}))}/>
            <Sel label="Compte comptable" value={rForm.compte} onChange={(v:string)=>setRForm((p:any)=>({...p,compte:v}))}
              options={Object.entries(PLAN_COMPTABLE).filter(([k])=>!k.startsWith("3")).map(([k,vl])=>({v:k,l:k+" - "+vl}))}/>
          </div>
          <div style={{display:"flex",gap:10,marginTop:20}}>
            <Btn onClick={()=>{
              if(!rForm.nom||!rForm.montant){alert("Nom et montant obligatoires");return;}
              const cleaned = {...rForm,montant:parseFloat(String(rForm.montant).replace(",","."))||0};
              if(cleaned.id) {
                setSt((p:any)=>({...p,depensesRecurrentes:(p.depensesRecurrentes||[]).map((x:any)=>x.id===cleaned.id?cleaned:x)}));
              } else {
                cleaned.id = uid();
                setSt((p:any)=>({...p,depensesRecurrentes:[...(p.depensesRecurrentes||[]),cleaned]}));
              }
              setRModal(false);
            }} full icon="check">Enregistrer</Btn>
            <Btn onClick={()=>setRModal(false)} variant="ghost" full>Annuler</Btn>
          </div>
        </Modal>
      )}
    </div>
  )}

  {/* Modal nouvelle écriture */}
  {modal==="form"&&(
    <Modal title={form.id?"Modifier écriture":"Nouvelle écriture"} onClose={()=>setModal(null)}>
      <div style={{display:"grid",gap:14}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <Sel label="Type" value={form.type} onChange={v=>{
            const firstCat = v==="recette"?CATEGORIES_RECETTE[0]:CATEGORIES_DEPENSE[0];
            setForm(p=>({...p,type:v,categorie:firstCat,compte:v==="recette"?"3001":"4000"}));
          }} options={[{v:"recette",l:"Recette (+)"},{v:"depense",l:"Dépense (-)"}]}/>
          <F label="Date" type="date" value={form.date} onChange={v=>setForm(p=>({...p,date:v}))}/>
        </div>
        <F label="Montant (CHF)" type="number" value={form.montant||""} onChange={v=>setForm(p=>({...p,montant:v}))} required/>
        <Sel label="Catégorie" value={form.categorie} onChange={v=>{
          const compteAuto = v==="Frais de rappel"?"3750":form.compte;
          setForm(p=>({...p,categorie:v,compte:compteAuto,libelle:v==="Frais de rappel"?"Frais de rappel":(PLAN_COMPTABLE[compteAuto]||p.libelle)}));
        }} options={(form.type==="recette"?CATEGORIES_RECETTE:CATEGORIES_DEPENSE).map(c=>({v:c,l:c}))}/>
        <Sel label="Compte comptable" value={form.compte} onChange={v=>setForm(p=>({...p,compte:v,libelle:PLAN_COMPTABLE[v]||""}))}
          options={Object.entries(PLAN_COMPTABLE).filter(([k])=>form.type==="recette"?k.startsWith("3"):!k.startsWith("3")).map(([k,v])=>({v:k,l:k+" - "+v}))}/>
        <F label="Description" value={form.description} onChange={v=>setForm(p=>({...p,description:v}))} placeholder="Précisions (optionnel)"/>
        {/* Justificatif PDF / image */}
        <div style={{background:"#F8F7F5",border:"1.5px dashed #D1D5DB",borderRadius:10,padding:"12px 14px"}}>
          <p style={{fontSize:11,fontWeight:600,color:"#374151",marginBottom:8}}>📎 Justificatif (reçu, facture, relevé…)</p>
          {form.justificatif ? (
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <button onClick={()=>{ const w=window.open(); w.document.write('<html><body style="margin:0"><iframe src="'+form.justificatif+'" width="100%" height="100%" style="border:none"></iframe></body></html>'); w.document.close(); }}
                style={{flex:1,background:"#DBEAFE",color:"#1D4ED8",border:"none",borderRadius:8,padding:"8px 12px",fontSize:12,fontWeight:600,cursor:"pointer",textAlign:"left",display:"flex",alignItems:"center",gap:6,overflow:"hidden"}}>
                📄 <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{form.justificatifNom||"Justificatif"}</span>
              </button>
              <button onClick={()=>setForm(p=>({...p,justificatif:"",justificatifNom:""}))}
                style={{background:"#FEE2E2",color:"#991B1B",border:"none",borderRadius:8,padding:"8px 10px",cursor:"pointer",fontSize:12,fontWeight:600,flexShrink:0}}>✕</button>
            </div>
          ) : (
            <label style={{display:"block",cursor:"pointer"}}>
              <div style={{background:"#fff",border:"1px solid #E5E7EB",borderRadius:8,padding:"10px 14px",display:"flex",alignItems:"center",gap:8,fontSize:12,color:"#6B7280"}}>
                <span style={{fontSize:18}}>📎</span>
                <span>Choisir un fichier PDF ou image</span>
              </div>
              <input type="file" accept="image/*,application/pdf" style={{display:"none"}} onChange={e=>{
                const file = e.target.files?.[0]; if(!file) return;
                if(file.size > 8*1024*1024){alert("Fichier trop grand (max 8 Mo)");return;}
                const reader = new FileReader();
                reader.onload = ev => setForm(p=>({...p,justificatif:ev.target.result as string,justificatifNom:file.name}));
                reader.readAsDataURL(file);
                e.target.value="";
              }}/>
            </label>
          )}
        </div>
        <label style={{display:"flex",alignItems:"center",gap:10,padding:"12px",background:form.postfinance?"#DCFCE7":"#F5F5F0",borderRadius:10,cursor:"pointer",border:form.postfinance?"1.5px solid #86EFAC":"1.5px solid #E5E5E0"}}>
          <input type="checkbox" checked={form.postfinance||false} onChange={e=>setForm(p=>({...p,postfinance:e.target.checked}))} style={{width:18,height:18}}/>
          <div>
            <p style={{fontSize:12,fontWeight:600,color:form.postfinance?"#166534":"#374151"}}>💳 Impact sur le solde PostFinance</p>
            <p style={{fontSize:10,color:"#6B7280",marginTop:2}}>
              {form.postfinance 
                ? (form.type==="recette"?"✓ Le solde sera augmenté":"✓ Le solde sera diminué")
                : "Cochez si cette opération passe par PostFinance"}
            </p>
          </div>
        </label>
      </div>
      <div style={{display:"flex",gap:10,marginTop:20}}>
        <Btn onClick={save} full icon="check">Enregistrer</Btn>
        <Btn onClick={()=>setModal(null)} variant="ghost" full>Annuler</Btn>
      </div>
    </Modal>
  )}

  {/* Modal modifier solde */}
  {soldeModal&&(
    <Modal title="Solde PostFinance" onClose={()=>setSoldeModal(false)}>
      <div style={{display:"grid",gap:14}}>
        {/* État actuel */}
        <div style={{background:"#F4F4F2",borderRadius:10,padding:"12px"}}>
          <p style={{fontSize:10,color:"#737373",fontWeight:600,textTransform:"uppercase"}}>Solde actuel</p>
          <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:24,fontWeight:700,marginTop:4}}>{chf(st.soldeBancaire||0)}</p>
        </div>
        
        {/* Saisie manuelle */}
        <F label="Définir manuellement (CHF)" type="number" value={nouveauSolde||""} onChange={v=>setNouveauSolde(v)} placeholder="Ex: 1250.00"/>
        <p style={{fontSize:10,color:"#737373"}}>Utilise cette option si tu veux forcer le solde à une valeur précise (ex: copier depuis ton app PostFinance).</p>
        
        {/* Recalcul automatique */}
        {(() => {
          // Calculer le solde théorique à partir des écritures + solde initial
          const impactTotal = (st.transactions||[]).filter(t=>t.postfinance).reduce((acc,t)=>{
            const m = parseFloat(t.montant)||0;
            return acc + (t.type==="recette"?m:-m);
          },0);
          // Solde initial estimé = solde actuel - impact = solde de départ
          // Pour le recalcul, on propose: solde initial + tous les impacts postfinance
          const impactPostfinance = impactTotal;
          return (
            <div style={{background:"#EFF6FF",border:"1px solid #BFDBFE",borderRadius:10,padding:"12px"}}>
              <p style={{fontSize:11,fontWeight:600,color:"#1E40AF",marginBottom:6}}>🔄 Recalcul depuis les écritures</p>
              <p style={{fontSize:10,color:"#1E40AF",marginBottom:8,lineHeight:1.5}}>
                Impact cumulé des écritures "PostFinance" : <strong>{impactPostfinance>=0?"+":""}{chf(impactPostfinance)}</strong>
              </p>
              <p style={{fontSize:10,color:"#1E40AF",marginBottom:8}}>
                Si tu as un solde de départ connu, saisis-le ci-dessous et clique "Recalculer".
              </p>
              <F label="Solde de départ (CHF)" type="number" value={nouveauSolde||""} onChange={v=>setNouveauSolde(v)}/>
              <button onClick={()=>{
                const depart = parseFloat(String(nouveauSolde).replace(",","."))||0;
                const final = parseFloat((depart + impactPostfinance).toFixed(2));
                if(window.confirm("Nouveau solde calculé : "+chf(final)+"\n(Départ "+chf(depart)+" + impacts "+(impactPostfinance>=0?"+":"")+chf(impactPostfinance)+")\n\nAppliquer ?")) {
                  setSt(p=>({...p, soldeBancaire: final}));
                  setSoldeModal(false);
                  setNouveauSolde("");
                }
              }} style={{width:"100%",background:"#1E40AF",color:"#fff",border:"none",borderRadius:8,padding:"9px",fontWeight:600,fontSize:12,cursor:"pointer",marginTop:8}}>
                🔄 Recalculer le solde
              </button>
            </div>
          );
        })()}
      </div>
      <div style={{display:"flex",gap:10,marginTop:20}}>
        <Btn onClick={()=>{
          const v = parseFloat(String(nouveauSolde).replace(",","."))||0;
          setSt(p=>({...p,soldeBancaire:v}));
          setSoldeModal(false);
          setNouveauSolde("");
        }} full icon="check">Définir le solde</Btn>
        <Btn onClick={()=>setSoldeModal(false)} variant="ghost" full>Annuler</Btn>
      </div>
    </Modal>
  )}
</div>

);
};

const genererConfirmationCommandePDF = async (cmd, st) => {
try {
  await new Promise((res,rej)=>{
    if((window as any).jspdf){res(null);return;}
    const s=document.createElement("script");
    s.src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
    s.onload=res;s.onerror=rej;document.head.appendChild(s);
  });
  const {jsPDF}=(window as any).jspdf;
  const doc=new jsPDF({unit:"mm",format:"a4"});
  const W=210; const mg=16;
  // En-tête
  doc.setFillColor(242,201,76); doc.rect(0,0,W,6,"F");
  pdfLogo(doc,mg);
  // Titre document
  doc.setFillColor(10,10,10); doc.roundedRect(W-86,12,72,24,3,3,"F");
  doc.setFont("helvetica","bold"); doc.setFontSize(10); doc.setTextColor(242,201,76);
  doc.text("CONFIRMATION DE COMMANDE",W-50,21,{align:"center"});
  doc.setFontSize(8); doc.setTextColor(255,255,255);
  doc.text(cmd.confirmationNumero||cmd.numero,W-50,27,{align:"center"});
  doc.text("Du "+fmt(cmd.date),W-50,32,{align:"center"});
  doc.setDrawColor(220,220,215); doc.setLineWidth(0.3); doc.line(mg,42,W-mg,42);
  let y=52;
  // Client
  doc.setFont("helvetica","bold"); doc.setFontSize(8); doc.setTextColor(150,150,150);
  doc.text("DESTINATAIRE",mg,y);
  doc.setFont("helvetica","bold"); doc.setFontSize(11); doc.setTextColor(10,10,10);
  doc.text(cmd.client||"",mg,y+7);
  doc.setFont("helvetica","normal"); doc.setFontSize(8); doc.setTextColor(100,100,100);
  if(cmd.email) doc.text(cmd.email,mg,y+12);
  if(cmd.adresse) doc.text([cmd.adresse,[cmd.npa,cmd.ville].filter(Boolean).join(" ")].filter(Boolean).join(", "),mg,y+17);
  y+=28;
  // Tableau produits
  const cols=[{l:"Produit",w:80},{l:"Format",w:22},{l:"Qte",w:14},{l:"Prix unit.",w:28},{l:"Total",w:28}];
  const tW=cols.reduce((s,c)=>s+c.w,0);
  const sx=(W-tW)/2;
  doc.setFillColor(10,10,10); doc.rect(sx,y,tW,8,"F");
  let cx=sx;
  cols.forEach(c=>{doc.setFont("helvetica","bold");doc.setFontSize(7);doc.setTextColor(242,201,76);doc.text(c.l,cx+c.w/2,y+5.5,{align:"center"});cx+=c.w;});
  y+=8;
  let grandTotal=0;
  (cmd.lignes||[]).filter(l=>l.produitId&&l.qte>0).forEach((l,i)=>{
    const prod=(st.produits||[]).find(p=>p.id===l.produitId);
    const pu=cmd.typeClient==="revendeur"?(prod?.prixRevendeur||0):(prod?.prixClient||0);
    const tot=pu*(l.qte||0);
    grandTotal+=tot;
    const bg=i%2===0?[255,255,255]:[248,248,245];
    doc.setFillColor(bg[0],bg[1],bg[2]); doc.rect(sx,y,tW,9,"F");
    const vals=[prod?.nom+" "+(prod?.variante||""),prod?.format||"",String(l.qte),"CHF "+pu.toFixed(2),"CHF "+tot.toFixed(2)];
    cx=sx;
    vals.forEach((v,vi)=>{
      doc.setFont("helvetica",vi===0?"bold":"normal");doc.setFontSize(7.5);doc.setTextColor(vi===0?10:60,vi===0?10:60,vi===0?10:60);
      doc.text(v,cx+cols[vi].w/2,y+6,{align:"center"});cx+=cols[vi].w;
    });
    y+=9;
  });
  y+=4;
  doc.setFillColor(10,10,10); doc.rect(sx,y,tW,10,"F");
  doc.setFont("helvetica","bold");doc.setFontSize(10);doc.setTextColor(242,201,76);
  doc.text("TOTAL COMMANDE : CHF "+grandTotal.toFixed(2),W/2,y+7,{align:"center"});
  y+=18;
  // Conditions
  doc.setFillColor(254,249,231); doc.rect(mg,y,W-mg*2,18,"F");
  doc.setFont("helvetica","bold"); doc.setFontSize(8); doc.setTextColor(146,64,14);
  doc.text("CONDITIONS",mg+4,y+5);
  doc.setFont("helvetica","normal"); doc.setFontSize(7); doc.setTextColor(100,100,100);
  const prixLabel=cmd.typeClient==="revendeur"?"Prix partenaire / pro · ":"Prix public · ";
  doc.text(prixLabel+"Paiement par virement : IBAN CH23 0900 0000 1565 1485 8 (PostFinance)",mg+4,y+11);
  doc.text("Livraison dans les 5-7 jours ouvrables apres confirmation · Retour sous 14 jours en etat d'origine",mg+4,y+16);
  y+=24;
  // Signature Goûtstoso (pas de signature client sur une confirmation)
  doc.setFillColor(248,248,245); doc.rect(mg,y,W-mg*2,28,"F");
  doc.setFont("helvetica","bold"); doc.setFontSize(8); doc.setTextColor(80,80,80);
  doc.text("Pour Goûtstoso — Jordan Montanaro",mg+4,y+6);
  doc.setFont("helvetica","normal"); doc.setFontSize(7); doc.setTextColor(150,150,150);
  doc.text("Confirmée le "+fmt(cmd.date),mg+4,y+11);
  if(cmd.signJordan) {
    try { doc.addImage(cmd.signJordan,"PNG",mg+4,y+13,52,13); } catch(e){}
  } else {
    doc.text("_____________________________",mg+4,y+23);
  }
  // Pied
  doc.setDrawColor(220,220,215); doc.setLineWidth(0.3); doc.line(mg,280,W-mg,280);
  doc.setFont("helvetica","normal"); doc.setFontSize(7); doc.setTextColor(150,150,150);
  doc.text("Goûtstoso · Jordan Montanaro · Rue des Sources 19 · 2613 Villeret · admin@goutstoso.ch",W/2,284,{align:"center"});
  doc.setFillColor(242,201,76); doc.rect(0,291,W,5,"F");
  // CGV en annexe
  ajouterDocAnnexe(doc, "cgv", st);
  const fname="Confirmation-Commande-"+cmd.numero+".pdf";
  doc.save(fname);
} catch(e){ alert("Erreur PDF : "+(e as any).message); }
};

const genererBulletinLivraisonCommandePDF = async (cmd, st) => {
try {
  await new Promise((res,rej)=>{
    if((window as any).jspdf){res(null);return;}
    const s=document.createElement("script");
    s.src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
    s.onload=res;s.onerror=rej;document.head.appendChild(s);
  });
  const {jsPDF}=(window as any).jspdf;
  const doc=new jsPDF({unit:"mm",format:"a4"});
  const W=210; const mg=16;
  // En-tête
  doc.setFillColor(242,201,76); doc.rect(0,0,W,6,"F");
  pdfLogo(doc,mg);
  // Titre
  doc.setFillColor(10,10,10); doc.roundedRect(W-86,12,72,24,3,3,"F");
  doc.setFont("helvetica","bold"); doc.setFontSize(10); doc.setTextColor(242,201,76);
  doc.text("BON DE LIVRAISON",W-50,21,{align:"center"});
  doc.setFontSize(8); doc.setTextColor(255,255,255);
  doc.text(cmd.blNumero||cmd.numero,W-50,27,{align:"center"});
  doc.text("Du "+fmt(cmd.date),W-50,32,{align:"center"});
  doc.setDrawColor(220,220,215); doc.setLineWidth(0.3); doc.line(mg,42,W-mg,42);
  let y=52;
  // Parties
  doc.setFont("helvetica","bold"); doc.setFontSize(7.5); doc.setTextColor(150,150,150);
  doc.text("EXPÉDITEUR",mg,y); doc.text("DESTINATAIRE",W/2+2,y);
  doc.setDrawColor(242,201,76); doc.setLineWidth(0.4);
  doc.line(mg,y+1,mg+18,y+1); doc.line(W/2+2,y+1,W/2+22,y+1);
  y+=6;
  doc.setFont("helvetica","bold"); doc.setFontSize(10); doc.setTextColor(17,17,17);
  doc.text("Goûtstoso",mg,y); doc.text(cmd.client||"",W/2+2,y);
  doc.setFont("helvetica","normal"); doc.setFontSize(8); doc.setTextColor(107,114,128);
  ["Jordan Montanaro","Rue des Sources 19","2613 Villeret","admin@goutstoso.ch"].forEach((l,i)=>doc.text(l,mg,y+5+i*4.5));
  if(cmd.adresse) doc.text(cmd.adresse,W/2+2,y+5);
  if(cmd.npa||cmd.ville) doc.text([cmd.npa,cmd.ville].filter(Boolean).join(" "),W/2+2,y+9.5);
  if(cmd.telephone) doc.text("Tél : "+cmd.telephone,W/2+2,y+14);
  if(cmd.email) doc.text(cmd.email,W/2+2,y+18.5);
  y+=32;
  // Tableau produits (sans prix — bon de livraison)
  const cols=[{l:"Désignation",w:100},{l:"Format",w:26},{l:"Quantité",w:26},{l:"Réceptionné",w:26}];
  const tW=cols.reduce((s,c)=>s+c.w,0); const sx=(W-tW)/2;
  doc.setFillColor(10,10,10); doc.rect(sx,y,tW,8,"F");
  let cx=sx;
  cols.forEach(c=>{doc.setFont("helvetica","bold");doc.setFontSize(7);doc.setTextColor(242,201,76);doc.text(c.l,cx+c.w/2,y+5.5,{align:"center"});cx+=c.w;});
  y+=8;
  (cmd.lignes||[]).filter(l=>l.produitId&&l.qte>0).forEach((l,i)=>{
    const prod=(st.produits||[]).find(p=>p.id===l.produitId);
    const bg=i%2===0?[255,255,255]:[248,248,245];
    doc.setFillColor(bg[0],bg[1],bg[2]); doc.rect(sx,y,tW,10,"F");
    doc.setDrawColor(235,235,232); doc.setLineWidth(0.15); doc.rect(sx,y,tW,10,"S");
    const vals=[(prod?.nom||"")+" "+(prod?.variante||""),prod?.format||"",String(l.qte),""];
    cx=sx;
    vals.forEach((v,vi)=>{
      doc.setFont("helvetica",vi===0?"bold":"normal"); doc.setFontSize(8); doc.setTextColor(vi===0?10:80,vi===0?10:80,vi===0?10:80);
      doc.text(v,cx+cols[vi].w/2,y+6.5,{align:"center"}); cx+=cols[vi].w;
    });
    y+=10;
  });
  y+=8;
  // Zone signature
  doc.setFillColor(250,250,248); doc.roundedRect(mg,y,W-mg*2,50,3,3,"F");
  doc.setDrawColor(220,220,215); doc.setLineWidth(0.3); doc.roundedRect(mg,y,W-mg*2,50,3,3,"S");
  doc.setFont("helvetica","bold"); doc.setFontSize(8); doc.setTextColor(100,100,100);
  doc.text("RÉCEPTION — SIGNATURE DU DESTINATAIRE",mg+4,y+7);
  doc.setFont("helvetica","normal"); doc.setFontSize(7); doc.setTextColor(150,150,150);
  doc.text("Je soussigné(e) reconnais avoir bien reçu les marchandises listées ci-dessus, en bon état.",mg+4,y+13);
  const nomReception = cmd.blReceptionnaire ? "Nom : "+cmd.blReceptionnaire : "Nom : ___________________________";
  const dateReception = cmd.blDate ? "   Date : "+fmt(cmd.blDate) : "   Date : _______________";
  doc.text(nomReception+dateReception,mg+4,y+24);
  doc.text("Signature :",mg+4,y+32);
  if(cmd.blSignature) {
    try { doc.addImage(cmd.blSignature,"PNG",mg+30,y+22,60,24); } catch(_){}
  } else {
    doc.setDrawColor(200,200,200); doc.setLineWidth(0.2); doc.rect(mg+30,y+22,70,24,"S");
  }
  // Tampon Goûtstoso
  doc.setFont("helvetica","bold"); doc.setFontSize(7); doc.setTextColor(150,150,150);
  doc.text("Expédié par Goûtstoso le "+fmt(cmd.date),W-mg-4,y+32,{align:"right"});
  y+=58;
  // Pied
  doc.setDrawColor(220,220,215); doc.setLineWidth(0.3); doc.line(mg,280,W-mg,280);
  doc.setFont("helvetica","normal"); doc.setFontSize(7); doc.setTextColor(150,150,150);
  doc.text("Goûtstoso · Jordan Montanaro · Rue des Sources 19 · 2613 Villeret · admin@goutstoso.ch",W/2,284,{align:"center"});
  doc.setFillColor(242,201,76); doc.rect(0,291,W,5,"F");
  doc.save("BL-"+cmd.numero+".pdf");
} catch(e){ alert("Erreur PDF : "+(e as any).message); }
};

const genererFactureDepuisCommande = (cmd, st, setSt) => {
  const y = new Date().getFullYear();
  const existing = (st.factures||[]).map(f=>f.numero);
  let n=1; while(existing.includes("FAC-"+y+"-"+String(n).padStart(3,"0"))) n++;
  const numero = "FAC-"+y+"-"+String(n).padStart(3,"0");
  const typeClient = cmd.typeClient||"revendeur";
  const lignesOk = (cmd.lignes||[]).filter(l=>l.produitId&&l.qte>0).map(l=>{
    const prod=(st.produits||[]).find(p=>p.id===l.produitId);
    const pu = prod?(typeClient==="revendeur"?(prod.prixRevendeur||0):(prod.prixClient||0)):0;
    return {produitId:l.produitId,designation:prod?prod.nom+" "+(prod.variante||""):l.produitId,qte:l.qte,prix:pu};
  });
  const brut = lignesOk.reduce((s,l)=>s+l.qte*l.prix,0);
  const rabais = parseFloat(cmd.rabais)||0;
  const total = Math.max(0, brut - rabais);
  const newFac = {
    id:uid(), numero, date:today(), dateEcheance:"", statut:"en attente",
    typeClient,
    clientNom:cmd.client, clientEmail:cmd.email||"",
    clientAdresse:cmd.adresse||"", clientNpa:cmd.npa||"", clientVille:cmd.ville||"",
    partenaireId:cmd.partenaireId||"",
    lignes:lignesOk, lignesOffertes:[], total,
    totalRabais:rabais, comptOffert:"3800",
    notes:"Issue de la commande "+cmd.numero, commandeId:cmd.id,
  };
  setSt((p:any)=>({
    ...p,
    factures:[...(p.factures||[]),newFac],
    commandes:p.commandes.map((c:any)=>c.id===cmd.id?{...c,factureNumero:numero}:c),
  }));
  alert("✅ Facture "+numero+" créée ! Retrouve-la dans Comptabilité → Factures.\n\nUne fois marquée payée, les écritures comptables seront générées automatiquement.");
};

// ══════════════════════════════════════════════════════════════
// PAGE: COMMANDES (ventes en ligne Shopify)
// ══════════════════════════════════════════════════════════════
const Commandes = ({st,setSt}) => {
const [modal,setModal] = useState(null);
const [viewId,setViewId] = useState(null);
const [filtre,setFiltre] = useState("toutes");
const [signingBL,setSigningBL] = useState(false);
const [sigJordanCmd,setSigJordanCmd] = useState(false);
const [blReceptionnaire,setBlReceptionnaire] = useState("");
const [blDateSaisie,setBlDateSaisie] = useState(today());

const genBLNumero = () => {
  const y = new Date().getFullYear();
  const existing = (st.commandes||[]).filter(c=>c.blNumero).map(c=>c.blNumero);
  let n=1; while(existing.includes("BL-"+y+"-"+String(n).padStart(3,"0"))) n++;
  return "BL-"+y+"-"+String(n).padStart(3,"0");
};

const view = viewId ? (st.commandes||[]).find(c=>c.id===viewId) : null;

const emptyC = () => ({
id:null,
numero:"",
date:today(),
clientId:"",
client:"",
email:"",
telephone:"",
adresse:"",
npa:"",
ville:"",
lignes:[{produitId:"",qte:1}],
rabais:0,
fraisPort:0,
commissionShopify:0,
source:"direct",
typeClient:"revendeur",
statut:"en attente",
envoyeeCompta:false,
notes:"",
});
const [form,setForm] = useState(emptyC());

const genNumero = () => {
const y = new Date().getFullYear();
const existing = (st.commandes||[]).map(c=>c.numero);
let n=1;
while(existing.includes("CMD-"+y+"-"+String(n).padStart(3,"0"))) n++;
return "CMD-"+y+"-"+String(n).padStart(3,"0");
};

const envoyerConfirmationEmail = (c) => {
if(!c.email) { alert("Ce client n'a pas d'email enregistré."); return; }
const calc = calcCommande(c);
const lignesTxt = (c.lignes||[]).filter(l=>l.produitId).map(l=>{
const p = st.produits.find(x=>x.id===l.produitId);
const pu = c.typeClient==="revendeur"?(p?.prixRevendeur||0):(p?.prixClient||0);
return "  • "+(p?.nom||"")+" "+(p?.variante||"")+" "+(p?.format||"")+" × "+l.qte+" = CHF "+(pu*l.qte).toFixed(2);
}).join("\n");
const subject = "Confirmation de commande "+c.numero+" — Goûtstoso";
const body =
`Bonjour ${c.client},\n\n`+
`Nous avons bien reçu votre commande et nous vous en remercions.\n\n`+
`Voici le récapitulatif :\n\n`+
`N° de commande : ${c.numero}\n`+
`Date : ${fmt(c.date)}\n\n`+
`Produits commandés :\n${lignesTxt}\n\n`+
(parseFloat(c.rabais)>0?`  Rabais : -CHF ${parseFloat(c.rabais).toFixed(2)}\n`:"")+
(parseFloat(c.fraisPort)>0?`  Frais de port : +CHF ${parseFloat(c.fraisPort).toFixed(2)}\n`:"")+
`TOTAL : CHF ${calc.totalClient.toFixed(2)}\n\n`+
`Nous préparons votre commande et vous tiendrons informé(e) dès l'expédition.\n\n`+
`Pour toute question, n'hésitez pas à nous contacter à admin@goutstoso.ch.\n\n`+
`Cordialement,\n\nJordan Montanaro\nGoûtstoso\nadmin@goutstoso.ch · www.goutstoso.ch`;
setSt(p=>({...p,commandes:(p.commandes||[]).map(x=>x.id===c.id?{...x,confirmationEnvoyee:today()}:x)}));
sendEmail({to:c.email,toName:c.client,subject,body});
};

const envoyerEmailSatisfaction = (c) => {
if(!c.email) { alert("Ce client n'a pas d'email"); return; }

const subject = "Merci pour votre commande — Goûtstoso";
const body =
`Bonjour ${c.client},\n\n`+
`Nous vous remercions chaleureusement de votre commande N° ${c.numero}.\n\n`+
`Chaque bouteille Goûtstoso est le fruit d'un savoir-faire artisanal : macérations longues, fruits soigneusement sélectionnés et assemblages travaillés avec passion. Nous espérons que nos liqueurs vous apporteront de beaux moments de dégustation.\n\n`+
`Votre avis nous tient à cœur.\n\n`+
`Si vous avez quelques minutes, nous serions ravis que vous partagiez votre expérience :\n\n`+
`  • Laisser un avis Google : https://g.page/r/CXbd92zwMoz_EAE/review\n`+
`  • Nous taguer sur Instagram : @goutstoso\n`+
`  • Répondre directement à cet email\n\n`+
`À très bientôt,\n\n`+
`Jordan Montanaro\nGoûtstoso\nadmin@goutstoso.ch · www.goutstoso.ch\n\n`+
`─────────────────────────────────\n`+
`L'abus d'alcool est dangereux pour la santé. À consommer avec modération.`;

sendEmail({to:c.email||"",toName:c?.contact||"",subject,body});

// Marquer comme envoyé
setSt(p=>({...p,commandes:p.commandes.map(x=>x.id===c.id?{...x,emailSatisfactionEnvoye:today()}:x)}));

};

const calcCommande = (c) => {
const produitsTotal = sum((c.lignes||[]).filter(l=>l.produitId).map(l=>{
const p = st.produits.find(x=>x.id===l.produitId);
const pu = c.typeClient==="revendeur" ? (p?.prixRevendeur||0) : (p?.prixClient||0);
return pu*(l.qte||0);
}));
const sousTotal = produitsTotal - (parseFloat(c.rabais)||0);
const totalClient = sousTotal + (parseFloat(c.fraisPort)||0);
const commission = parseFloat(c.commissionShopify)||0;
const netRecu = totalClient - commission;
return {produitsTotal,sousTotal,totalClient,commission,netRecu};
};

const save = () => {
if(!form.client) { alert("Indique le nom du client"); return; }
const lignesOk = (form.lignes||[]).filter(l=>l.produitId&&l.qte>0);
if(!lignesOk.length) { alert("Ajoute au moins un produit"); return; }
const numero = form.numero || genNumero();
let clientId = form.clientId;
if(!clientId && form.client) {
  const matched = (st.clients||[]).find(c=>c.nom.toLowerCase().trim()===form.client.toLowerCase().trim());
  if(matched) clientId = matched.id;
}
const cleaned = {...form, numero, lignes:lignesOk, clientId};
if(form.id) {
  // Modification : pas de re-déduction (gestion manuelle des ajustements)
  setSt(p=>({...p,commandes:(p.commandes||[]).map(c=>c.id===form.id?cleaned:c)}));
} else {
  // Nouvelle commande : déduire le stock immédiatement
  cleaned.id = uid();
  cleaned.stockDeduit = true;
  setSt(p=>{
    let newStocks = [...(p.stocks||[])];
    const newMouvements = [...(p.mouvementsStock||[])];
    lignesOk.forEach(l=>{
      let restant = parseInt(l.qte)||0;
      newStocks = newStocks.map(s=>{
        if(s.produitId!==l.produitId || restant<=0) return s;
        const dedd = Math.min(s.qte||0, restant);
        restant -= dedd;
        return {...s, qte:(s.qte||0)-dedd};
      });
      newMouvements.push({id:uid(),date:cleaned.date||today(),type:"sortie",produitId:l.produitId,qte:-(parseInt(l.qte)||0),source:`Commande ${cleaned.numero}`,commandeId:cleaned.id});
    });
    return {...p, stocks:newStocks, mouvementsStock:newMouvements, commandes:[...(p.commandes||[]),cleaned]};
  });
  const details = lignesOk.map(l=>{
    const prod = st.produits.find(x=>x.id===l.produitId);
    return `• ${prod?.nom||""} ${prod?.variante||""} ${prod?.format||""} : -${l.qte}`;
  }).join("\n");
  alert(`✅ Commande ${numero} créée\n\n📦 Stock déduit :\n${details}`);
}
setModal(null);
};

const envoyerCompta = (c) => {
if(c.envoyeeCompta) {
if(!window.confirm("Cette commande a déjà été envoyée en compta. Renvoyer ?")) return;
}
const calc = calcCommande(c);
const newTrans = [];
const dateOp = c.date || today();

// Recettes par produit
(c.lignes||[]).forEach(l=>{
  const p = st.produits.find(x=>x.id===l.produitId);
  if(!p) return;
  const montant = (c.typeClient==="revendeur"?(p.prixRevendeur||0):(p.prixClient||0))*(l.qte||0);
  const compte = p.nom==="Limonta"?"3001":p.nom==="Limelo"?"3002":p.nom==="Clementino"?"3003":p.nom.includes("Coffret")?"3004":"3001";
  const cat = p.nom==="Limonta"?"Vente Limonta":p.nom==="Limelo"?"Vente Limelo":p.nom==="Clementino"?"Vente Clementino":p.nom.includes("Coffret")?"Vente Coffrets":"Vente Limonta";
  newTrans.push({
    id:uid(),
    commandeId:c.id,
    date:dateOp,
    compte,
    libelle:"Vente "+p.nom+" "+p.variante,
    type:"recette",
    categorie:cat,
    montant,
    description:(c.source==="shopify"?"Shopify":c.source==="prestataire"?"Pro":"Direct")+" "+c.numero+" - "+p.nom+" "+p.variante+" x"+l.qte,
    postfinance:true,
  });
});

// Recette : frais de port facturés (3600)
if(parseFloat(c.fraisPort)>0) {
  newTrans.push({
    id:uid(),
    commandeId:c.id,
    date:dateOp,
    compte:"3600",
    libelle:"Frais expédition clients",
    type:"recette",
    categorie:"Frais expédition facturés",
    montant:parseFloat(c.fraisPort),
    description:(c.source==="shopify"?"Shopify":c.source==="prestataire"?"Pro":"Direct")+" "+c.numero+" - Port facturé",
    postfinance:true,
  });
}

// Dépense : commission Shopify (6700)
if(parseFloat(c.commissionShopify)>0) {
  newTrans.push({
    id:uid(),
    commandeId:c.id,
    date:dateOp,
    compte:"6700",
    libelle:"Commission Shopify",
    type:"depense",
    categorie:"Commissions",
    montant:parseFloat(c.commissionShopify),
    description:(c.source==="shopify"?"Shopify":c.source==="prestataire"?"Pro":"Direct")+" "+c.numero+" - Commission",
    postfinance:true,
  });
}

// Dépense : rabais accordé (optionnel, compte 3900 ou noter)
if(parseFloat(c.rabais)>0) {
  newTrans.push({
    id:uid(),
    commandeId:c.id,
    date:dateOp,
    compte:"3800",
    libelle:"Rabais accordé",
    type:"depense",
    categorie:"Autres",
    montant:parseFloat(c.rabais),
    description:(c.source==="shopify"?"Shopify":c.source==="prestataire"?"Pro":"Direct")+" "+c.numero+" - Rabais",
    postfinance:false,
  });
}

// Nettoyer anciennes transactions de cette commande
const oldTrans = (st.transactions||[]).filter(t=>t.commandeId!==c.id);

setSt(p=>({...p,
  transactions:[...oldTrans,...newTrans],
  commandes:p.commandes.map(x=>x.id===c.id?{...x,envoyeeCompta:true}:x),
}));
alert(newTrans.length+" écriture(s) créée(s) en compta !");

};

const supprimer = (id) => {
const cmd = (st.commandes||[]).find(c=>c.id===id);
const stockMsg = cmd?.stockDeduit ? "\nLe stock déduit sera restauré." : "";
if(!window.confirm(`Supprimer cette commande ? Les écritures compta liées seront aussi supprimées.${stockMsg}`)) return;
setSt(p=>{
  let newStocks = [...(p.stocks||[])];
  const newMouvements = [...(p.mouvementsStock||[])];
  if(cmd?.stockDeduit) {
    (cmd.lignes||[]).filter(l=>l.produitId&&(l.qte||0)>0).forEach(l=>{
      let aRestorer = parseInt(l.qte)||0;
      let done = false;
      newStocks = newStocks.map(s=>{
        if(s.produitId!==l.produitId||done) return s;
        done = true;
        return {...s, qte:(s.qte||0)+aRestorer};
      });
      newMouvements.push({id:uid(),date:today(),type:"restauration",produitId:l.produitId,qte:+(parseInt(l.qte)||0),source:`Suppression commande ${cmd.numero}`,commandeId:id});
    });
  }
  return {
    ...p,
    stocks: newStocks,
    mouvementsStock: newMouvements,
    commandes: p.commandes.filter(c=>c.id!==id),
    transactions: (p.transactions||[]).filter(t=>t.commandeId!==id),
  };
});
setViewId(null);
};

const toggleStatut = (c) => {
const cycle = ["en attente","en attente retrait","expédiée","livrée","retirée","payée"];
const idx = cycle.indexOf(c.statut);
const newStatut = cycle[(idx+1)%cycle.length] || "en attente";

const STATUTS_SORTIS = ["expédiée","livrée","retirée","payée"];
const vaEtreEnvoye = STATUTS_SORTIS.includes(newStatut);
const etaitEnvoye = c.stockDeduit === true;

setSt(p=>{
  let newStocks = p.stocks ? [...p.stocks] : [];
  let stockDeduit = c.stockDeduit || false;
  const newMouvements = [...(p.mouvementsStock||[])];

  if(!etaitEnvoye && vaEtreEnvoye) {
    // Décrémentation : distribuer sur les entrées de stock disponibles
    (c.lignes||[]).filter(l=>l.produitId&&(l.qte||0)>0).forEach(l=>{
      let restant = parseInt(l.qte)||0;
      newStocks = newStocks.map(s=>{
        if(s.produitId!==l.produitId || restant<=0) return s;
        const dedd = Math.min(s.qte||0, restant);
        restant -= dedd;
        return {...s, qte: (s.qte||0) - dedd};
      });
      // Mouvement de sortie par ligne
      newMouvements.push({
        id:uid(), date:today(), type:"sortie",
        produitId:l.produitId, qte:-(parseInt(l.qte)||0),
        source:`Commande ${c.numero}`, commandeId:c.id,
      });
    });
    stockDeduit = true;
  } else if(etaitEnvoye && !vaEtreEnvoye) {
    // Restauration stock si on revient en arrière
    (c.lignes||[]).filter(l=>l.produitId&&(l.qte||0)>0).forEach(l=>{
      let aRestorer = parseInt(l.qte)||0;
      let done = false;
      newStocks = newStocks.map(s=>{
        if(s.produitId!==l.produitId || done) return s;
        done = true;
        return {...s, qte: (s.qte||0) + aRestorer};
      });
      // Mouvement de restauration par ligne
      newMouvements.push({
        id:uid(), date:today(), type:"restauration",
        produitId:l.produitId, qte:+(parseInt(l.qte)||0),
        source:`Annulation sortie — Commande ${c.numero}`, commandeId:c.id,
      });
    });
    stockDeduit = false;
  }

  return {
    ...p,
    stocks: newStocks,
    mouvementsStock: newMouvements,
    commandes: p.commandes.map(x=>x.id===c.id?{...x,statut:newStatut,stockDeduit}:x),
  };
});

// Confirmation visible si stock déduit
if(!etaitEnvoye && vaEtreEnvoye) {
  const lignes = (c.lignes||[]).filter(l=>l.produitId&&(l.qte||0)>0);
  const details = lignes.map(l=>{
    const prod = st.produits.find(x=>x.id===l.produitId);
    return `• ${prod?.nom||""} ${prod?.variante||""} ${prod?.format||""} : -${l.qte}`;
  }).join("\n");
  alert(`📦 Stock mis à jour — ${c.numero}\n\n${details}\n\nStatut → ${newStatut}`);
}
};

const addLigne = () => setForm(p=>({...p,lignes:[...p.lignes,{produitId:"",qte:1}]}));
const updLigne = (i,k,v) => setForm(p=>({...p,lignes:p.lignes.map((l,j)=>j===i?{...l,[k]:v}:l)}));
const delLigne = (i) => setForm(p=>({...p,lignes:p.lignes.filter((_,j)=>j!==i)}));

const commandes = (st.commandes||[]).slice().reverse();
const filtrees = commandes.filter(c=>{
if(filtre==="toutes") return true;
if(filtre==="sans-facture") return !c.factureNumero;
if(filtre==="avec-facture") return !!c.factureNumero;
return true;
});
const nbSansFacture = commandes.filter(c=>!c.factureNumero && (c.statut==="livrée"||c.statut==="retirée")).length;

const badgeStatut = (s) => s==="en attente"?"yellow":s==="en attente retrait"?"yellow":s==="expédiée"?"blue":s==="livrée"?"green":s==="retirée"?"green":s==="payée"?"green":"gray";

// Vue détail
if(view) {
const calc = calcCommande(view);

// Signature Jordan (confirmation) en plein écran
if(sigJordanCmd) {
  return (
    <div className="fade">
      <button onClick={()=>setSigJordanCmd(false)} style={{display:"flex",alignItems:"center",gap:6,background:"none",border:"none",color:"#9CA3AF",fontSize:13,marginBottom:16,padding:0,cursor:"pointer"}}>← Retour</button>
      <div style={{background:"#EFF6FF",borderRadius:12,padding:"12px 14px",marginBottom:16,border:"1.5px solid #BFDBFE"}}>
        <p style={{fontWeight:700,fontSize:13}}>✍️ Signature Goûtstoso</p>
        <p style={{fontSize:11,color:"#1E40AF",marginTop:4}}>{view.confirmationNumero||view.numero} — {view.client}</p>
        <p style={{fontSize:10,color:"#6B7280",marginTop:2}}>Signez ci-dessous pour valider la confirmation de commande</p>
      </div>
      <SignaturePad
        onSave={(sig:any)=>{
          setSt((p:any)=>({...p,commandes:p.commandes.map((c:any)=>c.id===view.id?{...c,signJordan:sig}:c)}));
          setSigJordanCmd(false);
        }}
        onCancel={()=>setSigJordanCmd(false)}
      />
      {view.signJordan && (
        <div style={{marginTop:12,padding:"10px 12px",background:"#F0FDF4",borderRadius:10,border:"1px solid #BBF7D0"}}>
          <p style={{fontSize:11,color:"#166534",fontWeight:600,marginBottom:6}}>✓ Signature actuelle :</p>
          <img src={view.signJordan} alt="signature" style={{height:40,maxWidth:180,objectFit:"contain",display:"block"}}/>
        </div>
      )}
    </div>
  );
}

// Signature BL en plein écran
if(signingBL) {
  const blNum = view.blNumero || genBLNumero();
  return (
    <div className="fade">
      <button onClick={()=>setSigningBL(false)} style={{display:"flex",alignItems:"center",gap:6,background:"none",border:"none",color:"#9CA3AF",fontSize:13,marginBottom:16,padding:0,cursor:"pointer"}}>← Retour</button>
      <div style={{background:"#FEF9E7",borderRadius:12,padding:"12px 14px",marginBottom:16,border:"1.5px solid #F2C94C"}}>
        <p style={{fontWeight:700,fontSize:13}}>📦 Signature bon de livraison</p>
        <p style={{fontSize:11,color:"#92400E",marginTop:4}}>{blNum} — {view.client}</p>
        <p style={{fontSize:10,color:"#6B7280",marginTop:2}}>{view.numero} · {(view.lignes||[]).filter(l=>l.produitId).length} produit(s)</p>
      </div>
      <div style={{background:"#fff",borderRadius:12,padding:"14px",marginBottom:12,border:"1px solid #E5E7EB"}}>
        <p style={{fontSize:11,fontWeight:700,color:"#374151",marginBottom:10}}>Informations du réceptionnaire</p>
        <div style={{marginBottom:10}}>
          <label style={{fontSize:11,color:"#6B7280",display:"block",marginBottom:4}}>Nom et prénom *</label>
          <input
            value={blReceptionnaire}
            onChange={(e:any)=>setBlReceptionnaire(e.target.value)}
            placeholder="Ex : Marie Dupont"
            style={{width:"100%",padding:"9px 12px",borderRadius:8,border:"1.5px solid #E5E7EB",fontSize:13,outline:"none",boxSizing:"border-box"}}
          />
        </div>
        <div>
          <label style={{fontSize:11,color:"#6B7280",display:"block",marginBottom:4}}>Date de réception</label>
          <input
            type="date"
            value={blDateSaisie}
            onChange={(e:any)=>setBlDateSaisie(e.target.value)}
            style={{width:"100%",padding:"9px 12px",borderRadius:8,border:"1.5px solid #E5E7EB",fontSize:13,outline:"none",boxSizing:"border-box"}}
          />
        </div>
      </div>
      <SignaturePad
        onSave={(sig)=>{
          const num = view.blNumero || genBLNumero();
          const dateRetention = blDateSaisie || today();
          const receptionnaire = blReceptionnaire.trim();
          setSt((p:any)=>({...p,commandes:p.commandes.map((c:any)=>c.id===view.id?{...c,blSignature:sig,blNumero:num,blDate:dateRetention,blReceptionnaire:receptionnaire,blSigne:true}:c)}));
          setSigningBL(false);
        }}
        onCancel={()=>setSigningBL(false)}
      />
      {view.blSignature && (
        <div style={{marginTop:12,padding:"10px 12px",background:"#F0FDF4",borderRadius:10,border:"1px solid #BBF7D0"}}>
          <p style={{fontSize:11,color:"#166534",fontWeight:600,marginBottom:6}}>✓ Signature actuelle :</p>
          {view.blReceptionnaire&&<p style={{fontSize:11,color:"#166534",marginBottom:4}}>{view.blReceptionnaire} · {fmt(view.blDate)}</p>}
          <img src={view.blSignature} alt="signature" style={{height:40,maxWidth:180,objectFit:"contain",display:"block"}}/>
        </div>
      )}
    </div>
  );
}

return (
<div className="fade">
<button onClick={()=>setViewId(null)} style={{display:"flex",alignItems:"center",gap:6,background:"none",border:"none",color:"#9CA3AF",fontSize:13,marginBottom:12,padding:0,cursor:"pointer"}}>← Retour</button>

    <div style={{background:"#111",borderRadius:14,padding:"14px 16px",marginBottom:12}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
        <div>
          <p style={{fontSize:10,color:"#F2C94C",fontWeight:700,textTransform:"uppercase",letterSpacing:".08em"}}>{view.source==="direct"?"🤝 Commande directe":view.source==="shopify"?"🛒 Shopify":"🏢 Pro / Prestataire"}</p>
          <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,fontWeight:700,color:"#fff",marginTop:2}}>{view.numero}</p>
          <p style={{fontSize:11,color:"#aaa",marginTop:4}}>{fmt(view.date)}</p>
        </div>
        <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6}}>
          <Badge c={badgeStatut(view.statut)}>{view.statut}</Badge>
          {view.factureNumero && <span style={{fontSize:9,color:"#F2C94C",background:"#ffffff15",borderRadius:6,padding:"3px 7px",fontWeight:700}}>🧾 {view.factureNumero}</span>}
        </div>
      </div>
    </div>

    {/* Confirmation de commande */}
    <div style={{background:"#EFF6FF",border:"1.5px solid #BFDBFE",borderRadius:12,padding:"12px 14px",marginBottom:12}}>
      <p style={{fontSize:11,fontWeight:700,color:"#1E40AF",textTransform:"uppercase",letterSpacing:".05em",marginBottom:8}}>✅ Confirmation de commande</p>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
        <button onClick={async()=>{
          const y2=new Date().getFullYear();
          const ex=(st.commandes||[]).filter(c=>c.confirmationNumero).map(c=>c.confirmationNumero);
          let n=1; while(ex.includes("CONF-"+y2+"-"+String(n).padStart(3,"0"))) n++;
          const confNum="CONF-"+y2+"-"+String(n).padStart(3,"0");
          setSt((p:any)=>({...p,commandes:p.commandes.map(c=>c.id===view.id?{...c,confirmationNumero:confNum}:c)}));
          await genererConfirmationCommandePDF({...view,confirmationNumero:confNum},st);
        }} style={{background:"#1E40AF",color:"#fff",border:"none",borderRadius:8,padding:"10px",fontWeight:700,fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:5}}>
          📄 {view.confirmationNumero?"Re-télécharger":"Générer PDF"}
        </button>
        <button onClick={()=>envoyerConfirmationEmail(view)} style={{background:view.confirmationEnvoyee?"#F0FDF4":"#fff",color:view.confirmationEnvoyee?"#166534":"#1E40AF",border:"1.5px solid "+(view.confirmationEnvoyee?"#86EFAC":"#BFDBFE"),borderRadius:8,padding:"10px",fontWeight:700,fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:5}}>
          {view.confirmationEnvoyee ? "✓ Email envoyé" : "✉️ Envoyer email"}
        </button>
      </div>
      <button onClick={()=>setSigJordanCmd(true)} style={{width:"100%",marginTop:6,background:view.signJordan?"#DCFCE7":"#F0F9FF",border:view.signJordan?"1.5px solid #86EFAC":"1.5px solid #BAE6FD",borderRadius:8,padding:"8px",fontWeight:600,fontSize:11,color:view.signJordan?"#166534":"#0369A1",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:5}}>
        {view.signJordan?"✅ Ma signature enregistrée (modifier)":"✍️ Signer en tant que Goûtstoso"}
      </button>
      {view.confirmationNumero && <p style={{fontSize:10,color:"#3B82F6",marginTop:6,textAlign:"center"}}>{view.confirmationNumero}</p>}
    </div>

    {/* Bulletin de livraison */}
    <div style={{background:view.blSigne?"#F0FDF4":"#FFFBEB",border:"1.5px solid "+(view.blSigne?"#86EFAC":"#F2C94C"),borderRadius:12,padding:"12px 14px",marginBottom:12}}>
      <p style={{fontSize:11,fontWeight:700,color:view.blSigne?"#166534":"#92400E",textTransform:"uppercase",letterSpacing:".05em",marginBottom:8}}>
        {view.blSigne?"✅":"📦"} Bulletin de livraison
      </p>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
        <button onClick={async()=>{
          const num = view.blNumero || genBLNumero();
          if(!view.blNumero) setSt((p:any)=>({...p,commandes:p.commandes.map((c:any)=>c.id===view.id?{...c,blNumero:num}:c)}));
          await genererBulletinLivraisonCommandePDF({...view,blNumero:num},st);
        }} style={{background:"#92400E",color:"#fff",border:"none",borderRadius:8,padding:"10px",fontWeight:700,fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:5}}>
          📄 {view.blNumero?"Re-télécharger":"Générer BL"}
        </button>
        <button onClick={()=>{setBlReceptionnaire(view.blReceptionnaire||"");setBlDateSaisie(view.blDate||today());setSigningBL(true);}} style={{background:view.blSigne?"#166534":"#fff",color:view.blSigne?"#fff":"#92400E",border:"1.5px solid "+(view.blSigne?"#166534":"#F2C94C"),borderRadius:8,padding:"10px",fontWeight:700,fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:5}}>
          {view.blSigne?"✍️ Re-signer":"✍️ Signer sur place"}
        </button>
      </div>
      {view.blNumero && <p style={{fontSize:10,color:"#D97706",marginTop:6,textAlign:"center"}}>{view.blNumero}{view.blDate?" · "+fmt(view.blDate):""}</p>}
      {view.blSignature && (
        <div style={{marginTop:8,padding:"6px 8px",background:"#fff",borderRadius:8,border:"1px solid #D1FAE5",display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:10,color:"#166534",fontWeight:600}}>✓ Signé :</span>
          <img src={view.blSignature} alt="signature" style={{height:28,maxWidth:120,objectFit:"contain",flex:1}}/>
          <button onClick={()=>{if(!window.confirm("Supprimer la signature du BL ?"))return;setSt((p:any)=>({...p,commandes:p.commandes.map((c:any)=>c.id===view.id?{...c,blSignature:null,blSigne:false,blReceptionnaire:"",blDate:""}:c)}));}} style={{background:"#FEE2E2",border:"none",borderRadius:6,padding:"4px 7px",cursor:"pointer",fontSize:11,color:"#991B1B",fontWeight:700,flexShrink:0}}>🗑</button>
        </div>
      )}
    </div>

    {/* Actions */}
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:8}}>
      <button onClick={()=>{setForm({...view,typeClient:view.typeClient||"revendeur"});setModal("form");setViewId(null);}} style={{background:"#F5F5F0",border:"none",borderRadius:10,padding:"10px",fontWeight:600,fontSize:12,cursor:"pointer"}}>✏️ Modifier</button>
      <button onClick={()=>supprimer(view.id)} style={{background:"#FEE2E2",color:"#991B1B",border:"none",borderRadius:10,padding:"10px",fontWeight:600,fontSize:12,cursor:"pointer"}}>🗑 Supprimer</button>
    </div>
    {/* Créer la facture (pour commandes sans offreId) */}
    {!view.offreId && (
      <button onClick={()=>!view.factureNumero?genererFactureDepuisCommande(view,st,setSt):alert("Facture "+view.factureNumero+" déjà créée dans Comptabilité → Factures")}
        style={{width:"100%",background:view.factureNumero?"#166534":"#0A0A0A",color:view.factureNumero?"#fff":"#F2C94C",border:"none",borderRadius:10,padding:"11px",fontWeight:700,fontSize:12,cursor:"pointer",marginBottom:8,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
        🧾 {view.factureNumero?"Facture "+view.factureNumero+" créée ✓":"Créer la facture"}
      </button>
    )}
    {/* Indicateur stock déduit */}
    {view.stockDeduit
      ? <div style={{background:"#F0FDF4",border:"1px solid #BBF7D0",borderRadius:8,padding:"7px 12px",marginBottom:8,display:"flex",alignItems:"center",gap:6,fontSize:11,color:"#15803D",fontWeight:600}}>
          📦 Stock déduit automatiquement à l'expédition
        </div>
      : (view.statut==="en attente"||view.statut==="en attente retrait") && (
          <div style={{background:"#F8F8F6",border:"1px solid #E5E5E0",borderRadius:8,padding:"7px 12px",marginBottom:8,display:"flex",alignItems:"center",gap:6,fontSize:11,color:"#737373"}}>
            📦 Le stock sera déduit automatiquement au passage en "expédiée"
          </div>
        )
    }

    {/* ── Flux achat ferme (si issue d'une offre) ── */}
    {view.offreId && (
      <Card style={{padding:"12px 14px",marginBottom:12,background:"#0F172A",border:"none"}}>
        <p style={{fontSize:11,fontWeight:700,color:"#F2C94C",marginBottom:8}}>📦 Flux achat ferme · Documents</p>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginBottom:8}}>
          {[
            {ic:"📦",l:"Commande",v:view.numero,ok:true},
            {ic:"✅",l:"Confirmation",v:view.confirmationNumero||"—",ok:!!view.confirmationNumero},
            {ic:"🧾",l:"Facture",v:view.factureNumero||"—",ok:!!view.factureNumero},
          ].map((s,i)=>(
            <div key={i} style={{background:s.ok?"#1E3A8A":"#1E293B",borderRadius:8,padding:"8px",textAlign:"center",border:s.ok?"1px solid #3B82F6":"1px solid #334155"}}>
              <p style={{fontSize:12}}>{s.ic}</p>
              <p style={{fontSize:8,color:"#94A3B8",marginBottom:2}}>{s.l}</p>
              <p style={{fontSize:9,fontWeight:700,color:s.ok?"#fff":"#475569"}}>{s.v}</p>
            </div>
          ))}
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:6}}>
          <button onClick={async()=>{
            const y2=new Date().getFullYear();
            const ex=(st.commandes||[]).filter(c=>c.confirmationNumero).map(c=>c.confirmationNumero);
            let n=1; while(ex.includes("CONF-"+y2+"-"+String(n).padStart(3,"0"))) n++;
            const confNum="CONF-"+y2+"-"+String(n).padStart(3,"0");
            setSt((p:any)=>({...p,commandes:p.commandes.map(c=>c.id===view.id?{...c,confirmationNumero:confNum}:c)}));
            await genererConfirmationCommandePDF({...view,confirmationNumero:confNum},st);
          }} style={{background:"#1E40AF",color:"#fff",border:"none",borderRadius:8,padding:"9px",fontWeight:700,fontSize:11,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
            ✅ {view.confirmationNumero?"Retélécharger la confirmation":"Générer confirmation de commande"}
          </button>
          <button onClick={()=>!view.factureNumero?genererFactureDepuisCommande(view,st,setSt):alert("Facture "+view.factureNumero+" déjà créée dans Comptabilité → Factures")}
            style={{background:view.factureNumero?"#166534":"#0A0A0A",color:view.factureNumero?"#fff":"#F2C94C",border:"none",borderRadius:8,padding:"9px",fontWeight:700,fontSize:11,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
            🧾 {view.factureNumero?"Facture "+view.factureNumero+" créée":"Créer la facture"}
          </button>
        </div>
      </Card>
    )}

    {view.email && (view.statut==="livrée"||view.statut==="retirée"||view.statut==="expédiée") && (
      <button onClick={()=>envoyerEmailSatisfaction(view)} style={{width:"100%",background:view.emailSatisfactionEnvoye?"#F5F5F0":"linear-gradient(135deg,#E8B64C,#D4A017)",color:view.emailSatisfactionEnvoye?"#525252":"#fff",border:"none",borderRadius:10,padding:"12px",fontWeight:600,fontSize:12,cursor:"pointer",marginBottom:12}}>
        {view.emailSatisfactionEnvoye ? `✓ Email satisfaction envoyé le ${fmt(view.emailSatisfactionEnvoye)}` : "✨ Envoyer email de satisfaction"}
      </button>
    )}

    {/* Client */}
    <Card style={{marginBottom:12,padding:"12px 14px"}}>
      <p style={{fontSize:10,color:"#9CA3AF",fontWeight:700,textTransform:"uppercase",marginBottom:4}}>Client</p>
      <p style={{fontSize:13,fontWeight:700}}>{view.client}</p>
      {view.email && <p style={{fontSize:11,color:"#6B7280",marginTop:2}}>✉️ {view.email}</p>}
      {view.telephone && <p style={{fontSize:11,color:"#6B7280",marginTop:1}}>📞 {view.telephone}</p>}
      {(view.adresse || view.npa || view.ville) && (
        <p style={{fontSize:11,color:"#6B7280",marginTop:2,lineHeight:1.5}}>
          📍 {view.adresse}{view.adresse && (view.npa||view.ville) ? ", " : ""}{view.npa} {view.ville}
        </p>
      )}
    </Card>

    {/* Produits */}
    <Card style={{marginBottom:12,padding:"12px 14px"}}>
      <p style={{fontSize:10,color:"#9CA3AF",fontWeight:700,textTransform:"uppercase",marginBottom:8}}>Produits</p>
      {(view.lignes||[]).filter(l=>l.produitId).map((l,i)=>{
        const p = st.produits.find(x=>x.id===l.produitId);
        return (
          <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid #F5F5F0"}}>
            <div>
              <p style={{fontSize:12,fontWeight:600}}>{p?.nom} {p?.variante}</p>
              <p style={{fontSize:10,color:"#9CA3AF"}}>{p?.format} · Qté {l.qte} · {chf(view.typeClient==="revendeur"?p?.prixRevendeur:p?.prixClient)}/u</p>
            </div>
            <span style={{fontWeight:700,fontSize:12}}>{chf((view.typeClient==="revendeur"?(p?.prixRevendeur||0):(p?.prixClient||0))*l.qte)}</span>
          </div>
        );
      })}
    </Card>

    {/* Récap financier */}
    <Card style={{marginBottom:12,padding:"12px 14px",background:"#FEF9E7"}}>
      <p style={{fontSize:10,color:"#92400E",fontWeight:700,textTransform:"uppercase",marginBottom:8}}>Récapitulatif</p>
      <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:4}}>
        <span>Sous-total produits</span><span style={{fontWeight:600}}>{chf(calc.produitsTotal)}</span>
      </div>
      {parseFloat(view.rabais)>0 && (
        <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:4,color:"#991B1B"}}>
          <span>Rabais</span><span style={{fontWeight:600}}>-{chf(view.rabais)}</span>
        </div>
      )}
      {parseFloat(view.fraisPort)>0 && (
        <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:4}}>
          <span>Frais de port</span><span style={{fontWeight:600}}>+{chf(view.fraisPort)}</span>
        </div>
      )}
      <div style={{display:"flex",justifyContent:"space-between",borderTop:"1px solid #F2C94C",paddingTop:6,marginTop:6}}>
        <span style={{fontWeight:700}}>Total client</span>
        <span style={{fontWeight:700,fontFamily:"'Cormorant Garamond',serif",fontSize:18,color:"#D4A017"}}>{chf(calc.totalClient)}</span>
      </div>
      {parseFloat(view.commissionShopify)>0 && (
        <div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginTop:6,color:"#991B1B"}}>
          <span>Commission Shopify</span><span>-{chf(view.commissionShopify)}</span>
        </div>
      )}
      <div style={{display:"flex",justifyContent:"space-between",borderTop:"2px solid #F2C94C",paddingTop:6,marginTop:6}}>
        <span style={{fontWeight:700,color:"#166534"}}>Net reçu</span>
        <span style={{fontWeight:700,fontFamily:"'Cormorant Garamond',serif",fontSize:18,color:"#166534"}}>{chf(calc.netRecu)}</span>
      </div>
    </Card>

    {view.notes && (
      <Card style={{padding:"10px 14px",background:"#F5F5F0"}}>
        <p style={{fontSize:10,color:"#9CA3AF",fontWeight:700,textTransform:"uppercase",marginBottom:4}}>Notes</p>
        <p style={{fontSize:12}}>{view.notes}</p>
      </Card>
    )}
  </div>
);

}

// Vue liste
return (
<div className="fade">
<SectionTitle action={<Btn icon="plus" onClick={()=>{setForm(emptyC());setModal("form");}}>Nouvelle</Btn>}>
Commandes
</SectionTitle>

  {nbSansFacture>0 && (
    <div style={{background:"#FEF9E7",border:"1px solid #F2C94C",borderRadius:12,padding:"10px 14px",marginBottom:14}}>
      <p style={{fontWeight:700,color:"#92400E",fontSize:12}}>🧾 {nbSansFacture} commande{nbSansFacture>1?"s":""} livrée{nbSansFacture>1?"s":""} sans facture</p>
    </div>
  )}

  <div style={{display:"flex",gap:6,marginBottom:14,overflowX:"auto"}}>
    {[
      {id:"toutes",l:"Toutes"},
      {id:"sans-facture",l:`Sans facture${nbSansFacture>0?" ("+nbSansFacture+")":""}`},
      {id:"avec-facture",l:"Facturées"},
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

  {filtrees.length===0 ? (
    <div style={{textAlign:"center",padding:"40px 20px",color:"#9CA3AF"}}>
      <p style={{fontSize:40,marginBottom:12}}>🛒</p>
      <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,fontWeight:600,color:"#374151"}}>Aucune commande</p>
      <p style={{fontSize:13,marginTop:6}}>Saisis ta première commande Shopify</p>
      <button onClick={()=>{setForm(emptyC());setModal("form");}} style={{marginTop:16,background:"#F2C94C",border:"none",borderRadius:12,padding:"12px 24px",fontWeight:700,fontSize:14,cursor:"pointer"}}>
        + Nouvelle commande
      </button>
    </div>
  ) : filtrees.map(c=>{
    const calc = calcCommande(c);
    return (
      <Card key={c.id} style={{marginBottom:10,padding:"12px 14px",borderLeft:c.factureNumero?"3px solid #22C55E":"3px solid #F2C94C"}}>
        <div onClick={()=>setViewId(c.id)} style={{cursor:"pointer"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <p style={{fontWeight:700,fontSize:13}}>{c.numero}</p>
                <span style={{fontSize:9,fontWeight:700,padding:"2px 6px",borderRadius:4,background:c.source==="direct"?"#EFF6FF":c.source==="shopify"?"#FFF7ED":"#F0FDF4",color:c.source==="direct"?"#1D4ED8":c.source==="shopify"?"#9A3412":"#15803D"}}>{c.source==="direct"?"DIRECT":c.source==="shopify"?"SHOPIFY":"PRO"}</span>
              </div>
              <p style={{fontSize:12,color:"#6B7280",marginTop:1}}>{c.client}</p>
              <p style={{fontSize:11,color:"#9CA3AF",marginTop:1}}>{fmt(c.date)} · {(c.lignes||[]).length} produit{c.lignes?.length>1?"s":""}</p>
            </div>
            <div style={{textAlign:"right"}}>
              <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:18,fontWeight:700,color:"#D4A017"}}>{chf(calc.totalClient)}</p>
              <div style={{marginTop:4,display:"flex",flexDirection:"column",alignItems:"flex-end",gap:3}}>
                <Badge c={badgeStatut(c.statut)}>{c.statut}</Badge>
                {c.factureNumero && <span style={{fontSize:9,color:"#166534",background:"#DCFCE7",borderRadius:4,padding:"2px 6px",fontWeight:700}}>🧾 {c.factureNumero}</span>}
              </div>
            </div>
          </div>
        </div>
        <div style={{display:"flex",gap:6,marginTop:8}}>
          {!c.factureNumero && (
            <button onClick={()=>genererFactureDepuisCommande(c,st,setSt)} style={{flex:1,background:"#0A0A0A",color:"#F2C94C",border:"none",borderRadius:8,padding:"7px",fontSize:11,fontWeight:700,cursor:"pointer"}}>🧾 Créer la facture</button>
          )}
          <button onClick={()=>setViewId(c.id)} style={{flex:1,background:"#F5F5F0",border:"none",borderRadius:8,padding:"7px",fontSize:11,fontWeight:600,cursor:"pointer"}}>👁 Voir</button>
          <button onClick={()=>supprimer(c.id)} style={{background:"#FEE2E2",border:"none",borderRadius:8,padding:"7px 10px",cursor:"pointer",display:"flex"}}><Ic n="trash" s={13}/></button>
        </div>
      </Card>
    );
  })}

  {/* Modal */}
  {modal==="form" && (
    <Modal title={form.id?"Modifier commande":"Nouvelle commande"} onClose={()=>setModal(null)}>
      <div style={{display:"grid",gap:14}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <Sel label="Source" value={form.source||"direct"} onChange={v=>setForm(p=>({...p,source:v}))}
            options={[{v:"direct",l:"🤝 Commande directe"},{v:"prestataire",l:"🏢 Prestataire/Pro"},{v:"shopify",l:"🛒 Shopify"}]}/>
          <Sel label="Prix" value={form.typeClient||"revendeur"} onChange={v=>setForm(p=>({...p,typeClient:v}))}
            options={[{v:"revendeur",l:"💼 Prix pro"},{v:"client",l:"🏷 Prix public"}]}/>
          <F label="N° commande" value={form.numero||""} onChange={v=>setForm(p=>({...p,numero:v}))} placeholder="Auto"/>
          <F label="Date" type="date" value={form.date} onChange={v=>setForm(p=>({...p,date:v}))}/>
        </div>
        <div>
          <label style={{fontSize:11,fontWeight:600,color:"#9CA3AF",textTransform:"uppercase",display:"block",marginBottom:6}}>Client / Prestataire</label>
          <select value={form.clientId||""} onChange={e=>{
            const v=e.target.value;
            if(v==="nouveau") {
              setForm(p=>({...p,clientId:"",client:"",email:"",telephone:"",adresse:"",npa:"",ville:""}));
            } else if(v) {
              const pv2 = st.partenaires.find(x=>x.id===v);
              if(pv2) { setForm(p=>({...p,clientId:v,client:pv2.nom,email:pv2.email||"",telephone:pv2.tel||"",adresse:pv2.adresse||"",npa:pv2.npa||"",ville:pv2.ville||""})); return; }
              const cl = (st.clients||[]).find(x=>x.id===v);
              if(cl) setForm(p=>({...p,clientId:v,client:cl.nom,email:cl.email||"",telephone:cl.telephone||"",adresse:cl.adresse||"",npa:cl.npa||"",ville:cl.ville||""}));
            } else {
              setForm(p=>({...p,clientId:""}));
            }
          }} style={{width:"100%",padding:"11px 10px",fontSize:14,border:"1.5px solid #E5E5E0",borderRadius:10,background:"#fff",color:"#111",outline:"none",marginBottom:8}}>
            <option value="">- Saisir manuellement -</option>
            <option value="nouveau">+ Nouveau (à enregistrer)</option>
            {st.partenaires.length>0 && <optgroup label="🏪 Dépôts-vente">{st.partenaires.map(p=><option key={p.id} value={p.id}>{p.nom}</option>)}</optgroup>}
            {(st.clients||[]).filter(c=>c.categorie==="partenaire").length>0 && <optgroup label="🤝 Partenaires">{(st.clients||[]).filter(c=>c.categorie==="partenaire").map(c=><option key={c.id} value={c.id}>{c.nom}</option>)}</optgroup>}
            {(st.clients||[]).filter(c=>c.categorie!=="partenaire").length>0 && <optgroup label="👤 Clients">{(st.clients||[]).filter(c=>c.categorie!=="partenaire").map(c=><option key={c.id} value={c.id}>{c.nom}</option>)}</optgroup>}
          </select>
        </div>
        <F label="Nom / Raison sociale" value={form.client} onChange={v=>setForm(p=>({...p,client:v,clientId:""}))} required/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <F label="Email" value={form.email||""} onChange={v=>setForm(p=>({...p,email:v,clientId:""}))}/>
          <F label="Téléphone" value={form.telephone||""} onChange={v=>setForm(p=>({...p,telephone:v,clientId:""}))}/>
        </div>
        <F label="Adresse (rue + numéro)" value={form.adresse||""} onChange={v=>setForm(p=>({...p,adresse:v,clientId:""}))}/>
        <div style={{display:"grid",gridTemplateColumns:"80px 1fr",gap:12}}>
          <F label="NPA" value={form.npa||""} onChange={v=>setForm(p=>({...p,npa:v,clientId:""}))}/>
          <F label="Ville" value={form.ville||""} onChange={v=>setForm(p=>({...p,ville:v,clientId:""}))}/>
        </div>
        {!form.clientId && form.client && (
          <button onClick={()=>{
            const newClient = {
              id:uid(),
              nom:form.client,
              email:form.email||"",
              telephone:form.telephone||"",
              adresse:form.adresse||"",
              npa:form.npa||"",
              ville:form.ville||"",
            };
            setSt(p=>({...p,clients:[...(p.clients||[]),newClient]}));
            setForm(p=>({...p,clientId:newClient.id}));
            alert("Client \""+form.client+"\" enregistré !");
          }} style={{background:"#DCFCE7",color:"#166534",border:"1.5px solid #86EFAC",borderRadius:10,padding:"10px",fontWeight:600,fontSize:12,cursor:"pointer",width:"100%"}}>
            💾 Enregistrer ce client pour les prochaines commandes
          </button>
        )}
        {form.clientId && (
          <div style={{background:"#DBEAFE",color:"#1E3A5F",borderRadius:8,padding:"8px 12px",fontSize:11,textAlign:"center"}}>
            ✓ Client existant sélectionné
          </div>
        )}

        <div>
          <label style={{fontSize:11,fontWeight:600,color:"#9CA3AF",textTransform:"uppercase",display:"block",marginBottom:8}}>Produits</label>
          {(form.lignes||[]).map((l,i)=>(
            <div key={i} style={{display:"grid",gridTemplateColumns:"1fr 60px 36px",gap:6,marginBottom:8,alignItems:"flex-end"}}>
              <Sel label="" value={l.produitId} onChange={v=>updLigne(i,"produitId",v)}
                options={[{v:"",l:"- Produit -"},...st.produits.filter(p=>p.actif).map(p=>({v:p.id,l:p.nom+" "+p.variante+" "+p.format+" ("+chf(p.prixClient)+")"}))]}/>
              <input type="number" value={l.qte||1} min={1} onChange={e=>updLigne(i,"qte",+e.target.value)}
                style={{padding:"11px 6px",fontSize:14,border:"1.5px solid #E5E5E0",borderRadius:10,textAlign:"center",width:60}}/>
              <button onClick={()=>delLigne(i)} style={{background:"#FEE2E2",border:"none",borderRadius:8,padding:"10px 6px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
                <Ic n="trash" s={13}/>
              </button>
            </div>
          ))}
          <button onClick={addLigne} style={{background:"none",border:"1.5px dashed #E5E5E0",borderRadius:10,padding:"8px",width:"100%",color:"#9CA3AF",fontSize:13,cursor:"pointer"}}>
            + Ajouter un produit
          </button>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
          <F label="Rabais (CHF)" type="number" value={form.rabais||""} onChange={v=>setForm(p=>({...p,rabais:v}))}/>
          <F label="Frais port (CHF)" type="number" value={form.fraisPort||""} onChange={v=>setForm(p=>({...p,fraisPort:v}))}/>
          {(form.source||"shopify")==="shopify" && (
            <F label="Commission Shopify" type="number" value={form.commissionShopify||""} onChange={v=>setForm(p=>({...p,commissionShopify:v}))}/>
          )}
        </div>

        <Sel label="Statut" value={form.statut} onChange={v=>setForm(p=>({...p,statut:v}))}
          options={[
            {v:"en attente",l:"⏳ En attente"},
            {v:"en attente retrait",l:"📦 En attente de retrait"},
            {v:"expédiée",l:"🚚 Expédiée"},
            {v:"livrée",l:"✅ Livrée"},
            {v:"retirée",l:"✅ Retirée"},
            {v:"payée",l:"💰 Payée"},
          ]}/>

        <F label="Notes" value={form.notes||""} onChange={v=>setForm(p=>({...p,notes:v}))}/>

        {/* Récap live */}
        {(form.lignes||[]).some(l=>l.produitId) && (() => {
          const c = calcCommande(form);
          return (
            <div style={{background:"#FEF9E7",border:"1px solid #F2C94C",borderRadius:10,padding:"10px 14px",fontSize:12}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                <span>Sous-total</span><span>{chf(c.produitsTotal)}</span>
              </div>
              {parseFloat(form.rabais)>0 && <div style={{display:"flex",justifyContent:"space-between",color:"#991B1B",marginBottom:3}}><span>Rabais</span><span>-{chf(form.rabais)}</span></div>}
              {parseFloat(form.fraisPort)>0 && <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span>Frais port</span><span>+{chf(form.fraisPort)}</span></div>}
              <div style={{display:"flex",justifyContent:"space-between",borderTop:"1px solid #F2C94C",paddingTop:5,marginTop:5,fontWeight:700}}>
                <span>Total client</span>
                <span style={{color:"#D4A017",fontFamily:"'Cormorant Garamond',serif",fontSize:16}}>{chf(c.totalClient)}</span>
              </div>
              {parseFloat(form.commissionShopify)>0 && (
                <div style={{display:"flex",justifyContent:"space-between",color:"#991B1B",marginTop:3}}><span>-Commission</span><span>-{chf(form.commissionShopify)}</span></div>
              )}
              <div style={{display:"flex",justifyContent:"space-between",marginTop:4,fontWeight:700,color:"#166534"}}>
                <span>Net reçu</span><span>{chf(c.netRecu)}</span>
              </div>
            </div>
          );
        })()}
      </div>
      <div style={{display:"flex",gap:10,marginTop:20}}>
        <Btn onClick={save} full icon="check">Enregistrer</Btn>
        <Btn onClick={()=>setModal(null)} variant="ghost" full>Annuler</Btn>
      </div>
    </Modal>
  )}
</div>

);
};

// ══════════════════════════════════════════════════════════════
// PAGE: CLIENTS (base de données clients web)
// ══════════════════════════════════════════════════════════════
const Clients = ({st,setSt}) => {
const [modal,setModal] = useState(null);
const [viewId,setViewId] = useState(null);
const [search,setSearch] = useState("");
const [catTab,setCatTab] = useState<"tous"|"client"|"partenaire">("tous");

const view = viewId ? (st.clients||[]).find(c=>c.id===viewId) : null;

const emptyC = () => ({id:null,nom:"",email:"",telephone:"",adresse:"",npa:"",ville:"",notes:"",categorie:"client"});
const [form,setForm] = useState(emptyC());

const pvFromClient = (client, existingPvId?) => ({
  id: existingPvId||uid(),
  nom: client.nom,
  adresse: client.adresse||"",
  npa: client.npa||"",
  ville: client.ville||"",
  contact: client.contact||"",
  tel: client.telephone||"",
  email: client.email||"",
  site: client.site||"",
  type: "depot-vente",
  commission: client.commission||0,
  statut: "actif",
  clientId: client.id,
});

const save = () => {
if(!form.nom) { alert("Le nom est obligatoire"); return; }
if(form.id) {
  setSt(p=>{
    const newClients = (p.clients||[]).map(c=>c.id===form.id?form:c);
    let newPartenaires = p.partenaires||[];
    if(form.categorie==="partenaire") {
      const existing = newPartenaires.find(x=>x.clientId===form.id);
      newPartenaires = existing
        ? newPartenaires.map(x=>x.clientId===form.id?pvFromClient(form,existing.id):x)
        : [...newPartenaires, pvFromClient(form)];
    }
    return {...p,clients:newClients,partenaires:newPartenaires};
  });
} else {
  const nc = {...form,id:uid()};
  setSt(p=>{
    const newClients = [...(p.clients||[]),nc];
    const newPartenaires = nc.categorie==="partenaire"
      ? [...(p.partenaires||[]),pvFromClient(nc)]
      : (p.partenaires||[]);
    return {...p,clients:newClients,partenaires:newPartenaires};
  });
}
setModal(null);
};

const supprimer = (id) => {
if(!window.confirm("Supprimer ce client ? Les commandes liées seront conservées.")) return;
const client = (st.clients||[]).find(c=>c.id===id);
setSt(p=>({
  ...p,
  clients:(p.clients||[]).filter(c=>c.id!==id),
  partenaires: client?.categorie==="partenaire"
    ? (p.partenaires||[]).filter(x=>x.clientId!==id)
    : (p.partenaires||[]),
}));
setViewId(null);
};

const clients = (st.clients||[]).slice().sort((a,b)=>a.nom.localeCompare(b.nom));
const clientsByTab = catTab==="tous" ? clients : clients.filter(c=>(c.categorie||"client")===catTab);
const filtered = clientsByTab.filter(c=>{
if(!search) return true;
const s = search.toLowerCase();
return c.nom?.toLowerCase().includes(s) || c.email?.toLowerCase().includes(s) || c.ville?.toLowerCase().includes(s);
});
const nbClient = clients.filter(c=>(c.categorie||"client")==="client").length;
const nbPartenaire = clients.filter(c=>c.categorie==="partenaire").length;

// Stats par client
const getStats = (clientId) => {
const commandes = (st.commandes||[]).filter(c=>c.clientId===clientId);
const ca = sum(commandes.map(c=>{
const t = sum((c.lignes||[]).filter(l=>l.produitId).map(l=>{
const p = st.produits.find(x=>x.id===l.produitId);
return (c.typeClient==="revendeur"?(p?.prixRevendeur||0):(p?.prixClient||0))*(l.qte||0);
}));
return t - (parseFloat(c.rabais)||0) + (parseFloat(c.fraisPort)||0);
}));
// Commandes en attente de paiement (tout sauf payée)
const cmdNonPayees = commandes.filter(c=>c.statut!=="payée"&&c.statut!=="livrée"&&c.statut!=="retirée");
const aEncaisser = sum(cmdNonPayees.map(c=>{
const t = sum((c.lignes||[]).filter(l=>l.produitId).map(l=>{
const p = st.produits.find(x=>x.id===l.produitId);
return (c.typeClient==="revendeur"?(p?.prixRevendeur||0):(p?.prixClient||0))*(l.qte||0);
}));
return t - (parseFloat(c.rabais)||0) + (parseFloat(c.fraisPort)||0);
}));
return {nbCommandes:commandes.length,ca,commandes,nbNonPayees:cmdNonPayees.length,aEncaisser};
};

// Vue détail client
if(view) {
const stats = getStats(view.id);
return (
<div className="fade">
<button onClick={()=>setViewId(null)} style={{display:"flex",alignItems:"center",gap:6,background:"none",border:"none",color:"#9CA3AF",fontSize:13,marginBottom:12,padding:0,cursor:"pointer"}}>← Retour clients</button>

    <div style={{background:"#111",borderRadius:14,padding:"16px",marginBottom:14}}>
      <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:24,fontWeight:700,color:"#fff"}}>{view.nom}</p>
      {view.email && <p style={{fontSize:12,color:"#aaa",marginTop:4}}>✉️ {view.email}</p>}
      {view.telephone && <p style={{fontSize:12,color:"#aaa",marginTop:2}}>📞 {view.telephone}</p>}
    </div>

    {/* Actions */}
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
      <button onClick={()=>{setForm({...view});setModal("form");setViewId(null);}} style={{background:"#F5F5F0",border:"none",borderRadius:12,padding:"12px",fontWeight:600,fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
        <Ic n="edit" s={14}/> Modifier
      </button>
      <button onClick={()=>supprimer(view.id)} style={{background:"#FEE2E2",color:"#991B1B",border:"none",borderRadius:12,padding:"12px",fontWeight:600,fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
        <Ic n="trash" s={14}/> Supprimer
      </button>
    </div>

    {/* Stats */}
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
      <Card style={{padding:"12px",textAlign:"center",background:"#DBEAFE"}}>
        <p style={{fontSize:10,color:"#1E3A5F",fontWeight:700,textTransform:"uppercase"}}>Commandes</p>
        <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:24,fontWeight:700,color:"#1E3A5F",marginTop:2}}>{stats.nbCommandes}</p>
      </Card>
      <Card style={{padding:"12px",textAlign:"center",background:"#DCFCE7"}}>
        <p style={{fontSize:10,color:"#166534",fontWeight:700,textTransform:"uppercase"}}>CA total</p>
        <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,fontWeight:700,color:"#166534",marginTop:2}}>{chf(stats.ca)}</p>
      </Card>
    </div>

    {/* Adresse */}
    <Card style={{marginBottom:14,padding:"12px 14px"}}>
      <p style={{fontSize:10,color:"#9CA3AF",fontWeight:700,textTransform:"uppercase",marginBottom:6}}>Adresse de livraison</p>
      {(view.adresse||view.npa||view.ville) ? (
        <p style={{fontSize:13,lineHeight:1.6}}>
          {view.adresse && <>{view.adresse}<br/></>}
          {view.npa} {view.ville}
        </p>
      ) : <p style={{fontSize:12,color:"#9CA3AF",fontStyle:"italic"}}>Pas d'adresse enregistrée</p>}
    </Card>

    {/* Notes */}
    {view.notes && (
      <Card style={{marginBottom:14,padding:"10px 14px",background:"#FEF9E7"}}>
        <p style={{fontSize:10,color:"#92400E",fontWeight:700,textTransform:"uppercase",marginBottom:4}}>Notes</p>
        <p style={{fontSize:12,color:"#374151"}}>{view.notes}</p>
      </Card>
    )}

    {/* Commandes en attente de paiement */}
    {(() => {
      const cmdNonPayees = stats.commandes.filter(c=>c.statut!=="payée"&&c.statut!=="livrée"&&c.statut!=="retirée");
      // Une commande est "en attente de paiement" si pas livrée/retirée/payée
      // Sauf si elle est explicitement marquée payée
      if(cmdNonPayees.length === 0) return null;
      const totalAttente = sum(cmdNonPayees.map(c=>{
        const t = sum((c.lignes||[]).filter(l=>l.produitId).map(l=>{
          const p = st.produits.find(x=>x.id===l.produitId);
          return (c.typeClient==="revendeur"?(p?.prixRevendeur||0):(p?.prixClient||0))*(l.qte||0);
        }));
        return t - (parseFloat(c.rabais)||0) + (parseFloat(c.fraisPort)||0);
      }));
      return (
        <Card style={{padding:"12px 14px",marginBottom:14,background:"#FEF2F2",border:"1px solid #FECACA"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <p style={{fontSize:11,fontWeight:700,color:"#B91C1C",textTransform:"uppercase"}}>⚠️ À encaisser ({cmdNonPayees.length})</p>
            <p style={{fontSize:14,fontWeight:700,color:"#B91C1C"}}>{chf(totalAttente)}</p>
          </div>
          {cmdNonPayees.map(c=>{
            const t = sum((c.lignes||[]).filter(l=>l.produitId).map(l=>{
              const p = st.produits.find(x=>x.id===l.produitId);
              return (c.typeClient==="revendeur"?(p?.prixRevendeur||0):(p?.prixClient||0))*(l.qte||0);
            })) - (parseFloat(c.rabais)||0) + (parseFloat(c.fraisPort)||0);
            return (
              <div key={c.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 0",borderTop:"1px solid #FECACA"}}>
                <div style={{flex:1,minWidth:0}}>
                  <p style={{fontSize:12,fontWeight:600,color:"#0A0A0A"}}>{c.numero}</p>
                  <p style={{fontSize:10,color:"#737373",marginTop:1}}>{fmt(c.date)} · {c.statut}</p>
                </div>
                <span style={{fontWeight:700,fontSize:13,color:"#B91C1C",marginLeft:8}}>{chf(t)}</span>
              </div>
            );
          })}
        </Card>
      );
    })()}

    {/* Historique commandes */}
    <Card style={{padding:"12px 14px"}}>
      <p style={{fontSize:11,fontWeight:700,color:"#9CA3AF",textTransform:"uppercase",marginBottom:10}}>Historique ({stats.nbCommandes})</p>
      {stats.commandes.length===0
        ? <p style={{fontSize:12,color:"#9CA3AF",textAlign:"center",padding:"10px 0"}}>Aucune commande</p>
        : stats.commandes.slice().reverse().map(c=>{
            const t = sum((c.lignes||[]).filter(l=>l.produitId).map(l=>{
              const p = st.produits.find(x=>x.id===l.produitId);
              return (c.typeClient==="revendeur"?(p?.prixRevendeur||0):(p?.prixClient||0))*(l.qte||0);
            })) - (parseFloat(c.rabais)||0) + (parseFloat(c.fraisPort)||0);
            return (
              <div key={c.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:"1px solid #F5F5F0"}}>
                <div>
                  <p style={{fontSize:12,fontWeight:600}}>{c.numero}</p>
                  <p style={{fontSize:10,color:"#9CA3AF"}}>{fmt(c.date)} · {(c.lignes||[]).length} produit(s) · {c.statut}</p>
                </div>
                <span style={{fontWeight:700,fontSize:13}}>{chf(t)}</span>
              </div>
            );
          })
      }
    </Card>
  </div>
);

}

// Vue liste
return (
<div className="fade">
<SectionTitle action={<Btn icon="plus" onClick={()=>{setForm(emptyC());setModal("form");}}>Nouveau</Btn>}>
Clients
</SectionTitle>

  {/* Sous-onglets catégorie */}
  {clients.length>0 && (
    <div style={{display:"flex",gap:0,marginBottom:14,background:"#F3F4F6",borderRadius:10,padding:3}}>
      {([["tous","Tous",""] as const,["client","👤 Clients",""] as const,["partenaire","🤝 Partenaires",""] as const]).map(([id,label])=>(
        <button key={id} onClick={()=>setCatTab(id as any)} style={{flex:1,padding:"8px 0",border:"none",borderRadius:8,background:catTab===id?"#fff":"transparent",fontWeight:catTab===id?700:400,fontSize:12,color:catTab===id?"#0A0A0A":"#6B7280",cursor:"pointer",boxShadow:catTab===id?"0 1px 3px rgba(0,0,0,.1)":"none",transition:"all .15s"}}>
          {label}{id!=="tous"&&<span style={{marginLeft:4,fontSize:10,color:"#9CA3AF"}}>({id==="client"?nbClient:nbPartenaire})</span>}
        </button>
      ))}
    </div>
  )}

  {/* Recherche */}
  {clients.length>0 && (
    <div style={{marginBottom:14}}>
      <input
        type="text"
        placeholder="🔍 Rechercher un client..."
        value={search}
        onChange={e=>setSearch(e.target.value)}
        style={{width:"100%",padding:"11px 14px",fontSize:14,border:"1.5px solid #E5E5E0",borderRadius:12,boxSizing:"border-box"}}
      />
    </div>
  )}

  {/* Stats globales */}
  {clients.length>0 && (
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:14}}>
      <Card style={{padding:"10px",textAlign:"center",background:"#F3F4F6"}}>
        <p style={{fontSize:9,color:"#6B7280",fontWeight:700,textTransform:"uppercase"}}>Total</p>
        <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,fontWeight:700,color:"#0A0A0A",marginTop:2}}>{clients.length}</p>
      </Card>
      <Card style={{padding:"10px",textAlign:"center",background:"#DBEAFE"}}>
        <p style={{fontSize:9,color:"#1E3A5F",fontWeight:700,textTransform:"uppercase"}}>Clients</p>
        <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,fontWeight:700,color:"#1E3A5F",marginTop:2}}>{nbClient}</p>
      </Card>
      <Card style={{padding:"10px",textAlign:"center",background:"#FEF9E7"}}>
        <p style={{fontSize:9,color:"#92400E",fontWeight:700,textTransform:"uppercase"}}>Partenaires</p>
        <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,fontWeight:700,color:"#92400E",marginTop:2}}>{nbPartenaire}</p>
      </Card>
    </div>
  )}
  
  {/* Alerte globale impayés */}
  {clients.length>0 && (() => {
    const totalAEncaisser = sum(clients.map(c=>getStats(c.id).aEncaisser));
    const nbClientsImpayes = clients.filter(c=>getStats(c.id).nbNonPayees>0).length;
    if(totalAEncaisser <= 0) return null;
    return (
      <Card style={{padding:"10px 14px",background:"#FEF2F2",border:"1px solid #FECACA",marginBottom:14}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{fontSize:12,fontWeight:700,color:"#B91C1C"}}>⚠️ À encaisser ({nbClientsImpayes} client{nbClientsImpayes>1?"s":""})</span>
          <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:18,fontWeight:700,color:"#B91C1C"}}>{chf(totalAEncaisser)}</span>
        </div>
      </Card>
    );
  })()}

  {filtered.length===0 ? (
    <div style={{textAlign:"center",padding:"40px 20px",color:"#9CA3AF"}}>
      <p style={{fontSize:40,marginBottom:12}}>👥</p>
      <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,fontWeight:600,color:"#374151"}}>
        {search?"Aucun résultat":catTab!=="tous"?"Aucune fiche dans cette catégorie":"Aucun client"}
      </p>
      {!search && catTab==="tous" && (
        <>
          <p style={{fontSize:13,marginTop:6}}>Ajoute ton premier client ou partenaire</p>
          <button onClick={()=>{setForm(emptyC());setModal("form");}} style={{marginTop:16,background:"#F2C94C",border:"none",borderRadius:12,padding:"12px 24px",fontWeight:700,fontSize:14,cursor:"pointer"}}>
            + Nouveau
          </button>
        </>
      )}
    </div>
  ) : filtered.map(c=>{
    const stats = getStats(c.id);
    const isPartenaire = c.categorie==="partenaire";
    return (
      <Card key={c.id} style={{marginBottom:10,padding:"12px 14px",cursor:"pointer",borderLeft:stats.nbNonPayees>0?"3px solid #B91C1C":isPartenaire?"3px solid #F2C94C":"1px solid #EAE7E0"}} onClick={()=>setViewId(c.id)}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:2}}>
              <p style={{fontWeight:700,fontSize:14}}>{c.nom}</p>
              <span style={{fontSize:9,fontWeight:700,textTransform:"uppercase",padding:"2px 6px",borderRadius:4,background:isPartenaire?"#FEF9E7":"#EFF6FF",color:isPartenaire?"#92400E":"#1E3A5F"}}>
                {isPartenaire?"Partenaire":"Client"}
              </span>
            </div>
            {c.email && <p style={{fontSize:11,color:"#6B7280",marginTop:2}}>✉️ {c.email}</p>}
            {(c.npa||c.ville) && <p style={{fontSize:11,color:"#9CA3AF",marginTop:1}}>📍 {c.npa} {c.ville}</p>}
          </div>
          <div style={{textAlign:"right",marginLeft:10}}>
            {stats.nbCommandes>0 ? (
              <>
                <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:16,fontWeight:700,color:"#166534"}}>{chf(stats.ca)}</p>
                <p style={{fontSize:10,color:"#9CA3AF",marginTop:1}}>{stats.nbCommandes} cmd</p>
              </>
            ) : (
              <span style={{fontSize:10,color:"#9CA3AF",fontStyle:"italic"}}>Aucune commande</span>
            )}
          </div>
        </div>
        {stats.nbNonPayees>0 && (
          <div style={{marginTop:8,padding:"6px 10px",background:"#FEF2F2",borderRadius:6,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span style={{fontSize:11,color:"#B91C1C",fontWeight:600}}>⚠️ {stats.nbNonPayees} cmd non payée(s)</span>
            <span style={{fontSize:12,color:"#B91C1C",fontWeight:700}}>{chf(stats.aEncaisser)}</span>
          </div>
        )}
      </Card>
    );
  })}

  {/* Modal */}
  {modal==="form" && (
    <Modal title={form.id?"Modifier fiche":"Nouvelle fiche"} onClose={()=>setModal(null)}>
      <div style={{display:"grid",gap:14}}>
        {/* Catégorie */}
        <div>
          <label style={{fontSize:11,fontWeight:600,color:"#9CA3AF",textTransform:"uppercase",letterSpacing:".06em",display:"block",marginBottom:8}}>Catégorie</label>
          <div style={{display:"flex",gap:0,background:"#F3F4F6",borderRadius:10,padding:3}}>
            {([["client","👤 Client"],["partenaire","🤝 Partenaire"]] as const).map(([v,l])=>(
              <button key={v} type="button" onClick={()=>setForm(p=>({...p,categorie:v}))}
                style={{flex:1,padding:"9px 0",border:"none",borderRadius:8,background:(form.categorie||"client")===v?"#fff":"transparent",fontWeight:(form.categorie||"client")===v?700:400,fontSize:13,color:(form.categorie||"client")===v?"#0A0A0A":"#6B7280",cursor:"pointer",boxShadow:(form.categorie||"client")===v?"0 1px 3px rgba(0,0,0,.1)":"none",transition:"all .15s"}}>
                {l}
              </button>
            ))}
          </div>
        </div>
        <F label="Nom / Raison sociale" value={form.nom} onChange={v=>setForm(p=>({...p,nom:v}))} required/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <F label="Email" value={form.email||""} onChange={v=>setForm(p=>({...p,email:v}))}/>
          <F label="Téléphone" value={form.telephone||""} onChange={v=>setForm(p=>({...p,telephone:v}))}/>
        </div>
        <F label="Adresse" value={form.adresse||""} onChange={v=>setForm(p=>({...p,adresse:v}))} placeholder="Rue et numéro"/>
        <div style={{display:"grid",gridTemplateColumns:"80px 1fr",gap:12}}>
          <F label="NPA" value={form.npa||""} onChange={v=>setForm(p=>({...p,npa:v}))}/>
          <F label="Ville" value={form.ville||""} onChange={v=>setForm(p=>({...p,ville:v}))}/>
        </div>
        <F label="Notes" value={form.notes||""} onChange={v=>setForm(p=>({...p,notes:v}))} placeholder="Préférences, informations..."/>
      </div>
      <div style={{display:"flex",gap:10,marginTop:20}}>
        <Btn onClick={save} full icon="check">Enregistrer</Btn>
        <Btn onClick={()=>setModal(null)} variant="ghost" full>Annuler</Btn>
      </div>
    </Modal>
  )}
</div>

);
};

// ══════════════════════════════════════════════════════════════
// PAGE: DOCUMENTS LÉGAUX
// ══════════════════════════════════════════════════════════════

// Templates de documents par défaut
const DOCS_DEFAUT = {
cgv: {
titre:"Conditions Générales de Vente (CGV)",
description:"Règles commerciales applicables à toutes les ventes et dépôts-vente",
contenu: CGV,
categorie:"Légal",
icone:"📜",
},
contrat_depot: {
titre:"Contrat de dépôt-vente (modèle)",
description:"Modèle prêt à l'emploi pour vos accords de dépôt-vente",
icone:"📋",
categorie:"_old",
contenu: `CONTRAT DE DÉPÔT-VENTE

Entre les soussignés :

LE FOURNISSEUR
Goûtstoso
Jordan Montanaro
Rue des Sources 19
2613 Villeret
admin@goutstoso.ch

ET

LE DÉPOSITAIRE
[Nom / Raison sociale]
[Adresse complète]
[Email / Téléphone]

Il a été convenu ce qui suit :

ARTICLE 1 - OBJET
Le Fournisseur met en dépôt-vente chez le Dépositaire les liqueurs artisanales de sa gamme, en vue de leur commercialisation auprès de la clientèle finale.

ARTICLE 2 - DURÉE
Le présent contrat est conclu pour une durée initiale de 2 mois à compter de la date de signature, renouvelable par tacite reconduction sauf dénonciation écrite avec préavis de 30 jours.

ARTICLE 3 - PRODUITS DÉPOSÉS
La nature, la quantité et les prix des produits déposés sont précisés dans le bon de livraison annexé au présent contrat. Tout nouveau dépôt fera l'objet d'un nouveau bon de livraison signé par les deux parties.

ARTICLE 4 - PROPRIÉTÉ
Les produits déposés restent la propriété exclusive du Fournisseur jusqu'à leur vente effective à la clientèle finale ou leur paiement intégral par le Dépositaire.

ARTICLE 5 - PRIX DE VENTE ET COMMISSION
Les produits sont facturés au Dépositaire au prix professionnel indiqué dans le bon de livraison. Le Dépositaire est libre de définir son prix de vente au public. [Ou : Une commission de X% est accordée au Dépositaire sur chaque vente réalisée.]

ARTICLE 6 - INVENTAIRE ET FACTURATION
Un inventaire est effectué périodiquement (minimum tous les 2 mois). Le Dépositaire règle les produits effectivement vendus dans les 30 jours suivant l'émission de la facture, par virement sur le compte IBAN CH23 0900 0000 1565 1485 8 (PostFinance).

ARTICLE 7 - RESPONSABILITÉ DU DÉPOSITAIRE
Le Dépositaire assume l'entière responsabilité des produits pendant toute la durée du dépôt : conditions de stockage (température, lumière, humidité), perte, vol, casse, détérioration. Tout produit endommagé ou manquant sera facturé au prix professionnel.

ARTICLE 8 - OBLIGATIONS LÉGALES
Le Dépositaire s'engage à respecter la législation suisse en vigueur concernant la vente de boissons alcoolisées, notamment :

- l'interdiction formelle de vente aux mineurs ;
- les règles relatives à la publicité ;
- l'affichage obligatoire en point de vente.

ARTICLE 9 - RESTITUTION
À la fin du contrat, les produits invendus sont restitués au Fournisseur en parfait état (emballage d'origine, étiquette intacte, date de conservation respectée).

ARTICLE 10 - RÉSILIATION
Le contrat peut être résilié à tout moment d'un commun accord écrit. En cas de manquement grave (non-paiement, non-respect des obligations légales, détérioration répétée des produits), le Fournisseur peut résilier immédiatement.

ARTICLE 11 - CONDITIONS GÉNÉRALES
Les Conditions Générales de Vente du Fournisseur (annexées) font partie intégrante du présent contrat.

ARTICLE 12 - DROIT APPLICABLE
Le présent contrat est soumis au droit suisse. Tout litige sera soumis aux juridictions du canton de Berne.

Fait à ................................., le ........................

En deux exemplaires originaux.

LE FOURNISSEUR                                    LE DÉPOSITAIRE
Goûtstoso - Jordan Montanaro                       .........................

Signature :                                        Signature :`, }, contrat_partenariat: { titre:"Contrat de partenariat commercial", description:"Pour revendeurs et distributeurs réguliers", icone:"🤝", categorie:"_old", contenu: `CONTRAT DE PARTENARIAT COMMERCIAL

Entre :

LE FOURNISSEUR
Goûtstoso, Jordan Montanaro
Rue des Sources 19, 2613 Villeret
admin@goutstoso.ch

ET

LE PARTENAIRE
[Nom / Raison sociale]
[Adresse]
[Contact]

ARTICLE 1 - OBJET
Le Fournisseur accorde au Partenaire le droit de commercialiser ses liqueurs artisanales dans les conditions définies ci-après.

ARTICLE 2 - TERRITOIRE ET EXCLUSIVITÉ
Le Partenaire est autorisé à commercialiser les produits [sur tout le territoire suisse / dans la région de ..... / exclusivement dans son point de vente]. [Exclusivité : oui / non]

ARTICLE 3 - DURÉE
Contrat conclu pour une durée de ...... mois/années à compter du ............. .

ARTICLE 4 - CONDITIONS COMMERCIALES

- Prix professionnel selon grille tarifaire en vigueur
- Commande minimale : ...... unités
- Modalités de paiement : 30 jours nets
- Commission ou remise éventuelle : ......%

ARTICLE 5 - OBLIGATIONS DU PARTENAIRE
Le Partenaire s'engage à :

- Promouvoir activement les produits du Fournisseur
- Respecter l'image de marque et les valeurs de Goûtstoso
- Ne pas dénigrer les produits ou la marque
- Respecter la législation en matière de vente d'alcool (interdiction aux mineurs, publicité)
- Assurer des conditions de stockage adéquates

ARTICLE 6 - OBLIGATIONS DU FOURNISSEUR
Le Fournisseur s'engage à :

- Livrer des produits conformes aux normes en vigueur
- Fournir les supports marketing nécessaires
- Informer le Partenaire des nouveautés et promotions
- Respecter les délais de livraison convenus

ARTICLE 7 - MARQUE ET IDENTITÉ VISUELLE
Le Partenaire est autorisé à utiliser le logo et les visuels de Goûtstoso exclusivement pour la promotion et la vente des produits. Toute autre utilisation est soumise à autorisation écrite préalable.

ARTICLE 8 - CONFIDENTIALITÉ
Les parties s'engagent à garder confidentielles les informations commerciales échangées.

ARTICLE 9 - RÉSILIATION
Résiliation possible avec préavis de 60 jours par lettre recommandée. Résiliation immédiate en cas de manquement grave.

ARTICLE 10 - CONDITIONS GÉNÉRALES ET DROIT APPLICABLE
Les CGV de Goûtstoso font partie intégrante du présent contrat. Droit suisse applicable, juridictions du canton de Berne compétentes.

Fait à ................................., le ........................

LE FOURNISSEUR                                    LE PARTENAIRE
Goûtstoso - Jordan Montanaro                       .........................

Signature :                                        Signature :`, }, lettre_resiliation: { titre:"Lettre de résiliation de contrat", description:"Courrier formel pour mettre fin à un accord de dépôt-vente ou partenariat", icone:"🚫", categorie:"Courriers", contenu: `Villeret, le [DATE]

Goûtstoso
Jordan Montanaro
Rue des Sources 19
2613 Villeret
admin@goutstoso.ch

[NOM PARTENAIRE / DÉPOSITAIRE]
[Adresse]
[NPA Ville]

Objet : Résiliation du contrat N° [NUMÉRO] du [DATE DÉBUT]

Madame, Monsieur,

Par la présente, nous vous informons de notre décision de mettre fin au contrat de [dépôt-vente / partenariat] N° [NUMÉRO] conclu entre Goûtstoso et votre établissement en date du [DATE SIGNATURE].

Conformément à l'article [X] dudit contrat, cette résiliation prend effet à l'expiration d'un préavis de 30 jours à compter de la réception de la présente lettre, soit au [DATE RÉSILIATION EFFECTIVE].

Avant cette date, nous vous remercions de bien vouloir :
- Effectuer un inventaire complet des produits Goûtstoso en votre possession
- Nous régler les produits vendus à ce jour (cf. facture ci-jointe ou à venir)
- Nous restituer les produits invendus en parfait état (emballage d'origine, étiquettes intactes)

Nous organiserons ensemble les modalités pratiques de restitution dans les meilleurs délais.

Nous tenons à vous remercier pour la collaboration que nous avons eu ensemble et vous souhaitons le meilleur pour la suite de vos activités.

Nous restons à votre disposition pour toute question.

Cordialement,

Jordan Montanaro
Goûtstoso
admin@goutstoso.ch`, }, lettre_relance_partenaire: { titre:"Lettre de relance partenaire", description:"Courrier pour relancer un partenaire inactif ou sans nouvelles", icone:"💌", categorie:"Courriers", contenu: `Villeret, le [DATE]

[NOM PARTENAIRE]
[Adresse]

Objet : Suivi de notre partenariat — Goutstoso

Madame, Monsieur,

Suite à notre accord de [dépôt-vente / partenariat] N° [NUMÉRO] et n'ayant pas eu de nouvelles de votre part depuis quelque temps, nous vous contactons afin de faire le point sur notre collaboration.

État actuel de votre dépôt :
- Produits déposés : [QUANTITÉ]
- Dernier inventaire : [DATE]
- Solde à régler : CHF [MONTANT] (si applicable)

Nous souhaitons vous proposer :
☐ Un inventaire des produits en dépôt
☐ Un réapprovisionnement si le stock est bas
☐ Un point sur les ventes et les retours
☐ Un renouvellement / mise à jour de notre contrat

Nos coordonnées :
Jordan Montanaro — admin@goutstoso.ch — [TEL]

Nous vous remercions par avance pour votre retour et restons disponibles pour convenir d'une date de rendez-vous à votre convenance.

Cordialement,

Jordan Montanaro
Goûtstoso`, }, nda: { titre:"Accord de confidentialité (NDA)", description:"Pour partenaires et fournisseurs stratégiques", icone:"🔒", categorie:"_old", contenu: `ACCORD DE CONFIDENTIALITÉ

Entre :

Goûtstoso, Jordan Montanaro, Rue des Sources 19, 2613 Villeret (ci-après "la Partie Divulgatrice")

ET

[Nom / Raison sociale]
[Adresse]
(ci-après "la Partie Réceptrice")

ARTICLE 1 - OBJET
Le présent accord protège les informations confidentielles échangées dans le cadre de nos relations commerciales.

ARTICLE 2 - INFORMATIONS CONFIDENTIELLES
Sont confidentielles : les recettes et procédés de fabrication, la stratégie commerciale, les données clients/fournisseurs, les tarifs et conditions, et tout projet en cours.

ARTICLE 3 - ENGAGEMENTS
La Partie Réceptrice s'engage à :
- Garder strictement confidentielles toutes les informations reçues
- Ne les utiliser que dans le cadre défini avec Goûtstoso
- Ne pas les divulguer à des tiers sans autorisation écrite

ARTICLE 4 - DURÉE
3 ans à compter de la signature. L'obligation de confidentialité perdure 2 ans après la fin de la relation.

ARTICLE 5 - DROIT APPLICABLE
Droit suisse. Juridiction : canton de Berne.

Fait à .........................., le ..........................

LA PARTIE DIVULGATRICE                    LA PARTIE RÉCEPTRICE
Goûtstoso - Jordan Montanaro              ........................

Signature :                               Signature :`, }, mentions_legales: { titre:"Mentions légales & identité", description:"Informations légales de l'entreprise Goûtstoso", icone:"🏛️", categorie:"Légal", contenu: `MENTIONS LÉGALES — GOÛTSTOSO

RAISON SOCIALE
Goûtstoso (entreprise individuelle)

PROPRIÉTAIRE
Jordan Montanaro

ADRESSE
Rue des Sources 19
2613 Villeret
Suisse

CONTACT
Email : admin@goutstoso.ch
Site : www.goutstoso.ch

ACTIVITÉ
Production et commercialisation de liqueurs artisanales (Limoncello et dérivés)
Taux d'alcool : 30% vol.
Produits fabriqués en Suisse

COMPTE BANCAIRE
PostFinance
IBAN : CH23 0900 0000 1565 1485 8
Titulaire : Goûtstoso / Jordan Montanaro

DROIT APPLICABLE
Suisse (canton de Berne)
Toute relation commerciale est soumise au droit suisse.
En cas de litige, les tribunaux du canton de Berne sont compétents.

PROTECTION DES DONNÉES
Goûtstoso collecte uniquement les données nécessaires à la gestion commerciale (nom, adresse, email, téléphone des partenaires et clients).
Ces données ne sont pas transmises à des tiers.
Conformément à la LPD (Loi fédérale sur la protection des données), vous pouvez demander l'accès, la rectification ou la suppression de vos données à admin@goutstoso.ch.

VENTE D'ALCOOL
Goûtstoso s'engage à ne vendre ses produits qu'à des personnes majeures (18 ans et plus) conformément à la législation suisse sur les boissons alcoolisées.

Mis à jour le : [DATE]`, }, charte_alcool: { titre:"Charte de consommation responsable", description:"Obligations légales liées à la vente de boissons alcoolisées", icone:"🍋", categorie:"Légal", contenu: `CHARTE DE CONSOMMATION RESPONSABLE — GOÛTSTOSO

En tant que producteur de liqueurs artisanales à 30% vol., Goûtstoso s'engage à promouvoir une consommation responsable.

1. PROTECTION DES MINEURS
- Interdiction formelle de vente aux moins de 18 ans (Loi fédérale sur l'alcool)
- Obligation de contrôle de l'âge en cas de doute
- Nos partenaires s'engagent à respecter ces règles

2. MODÉRATION
Nous invitons nos clients à :
- Consommer avec modération
- Ne pas conduire après consommation (taux légal : 0.5‰ en Suisse)
- Éviter la consommation en cas de grossesse

3. OBLIGATIONS DE NOS PARTENAIRES REVENDEURS
- Afficher les interdictions légales en point de vente
- Ne pas vendre à des personnes en état d'ivresse manifeste
- Respecter les horaires de vente du canton

4. PUBLICITÉ
Nos communications ne ciblent pas les mineurs et n'incitent pas à une consommation excessive.

5. ÉTIQUETAGE
Nos produits indiquent : taux d'alcool, contenance, ingrédients, mentions légales.

En cas de problème : Addiction Suisse — www.addictionsuisse.ch

Goûtstoso - Jordan Montanaro`, }, bon_livraison: { titre:"Bon de livraison (modèle)", description:"Modèle de bon de livraison / dépôt standard", icone:"📦", categorie:"_old", contenu: `BON DE LIVRAISON N° ......................

Date de livraison : .............................

FOURNISSEUR
Goûtstoso
Jordan Montanaro
Rue des Sources 19, 2613 Villeret
admin@goutstoso.ch

DESTINATAIRE
[Nom / Raison sociale]
[Adresse complète]
[Contact]

TYPE DE LIVRAISON
☐ Livraison ferme (facturation immédiate)
☐ Dépôt-vente (facturation après inventaire)

DÉTAIL DES PRODUITS LIVRÉS

┌─────────────────────────────────────┬──────┬─────────────┬───────────┐
│ Désignation                          │ Qté  │ Lot         │ Prix u.   │
├─────────────────────────────────────┼──────┼─────────────┼───────────┤
│ Limonta Citron jaune 25cl            │      │             │           │
│ Limonta Citron jaune 50cl            │      │             │           │
│ Limelo Citron vert 25cl              │      │             │           │
│ Limelo Citron vert 50cl              │      │             │           │
│ Clementino Clémentine 25cl           │      │             │           │
│ Clementino Clémentine 50cl           │      │             │           │
│ Coffret 3 saveurs 25cl (+verres)     │      │             │           │
│ Coffret 3 saveurs 50cl (+verres)     │      │             │           │
└─────────────────────────────────────┴──────┴─────────────┴───────────┘

TOTAL : CHF ...............

CONDITIONS

- Paiement à 30 jours par virement PostFinance IBAN CH23 0900 0000 1565 1485 8
- En cas de dépôt-vente : facturation après inventaire, produits propriété de Goûtstoso jusqu'au paiement
- Les marchandises voyagent aux risques et périls du destinataire
- Toute réclamation doit être formulée dans les 5 jours

SIGNATURES

Livré par (Fournisseur) :                Reçu par (Destinataire) :

Nom : ...........................         Nom : ...........................
Date : ..........................         Date : ..........................
Signature :                                Signature :`, }, bon_retour: { titre:"Bon de retour (modèle)", description:"Pour la reprise des produits invendus en fin de dépôt", icone:"↩️", categorie:"_old", contenu: `BON DE RETOUR N° ......................

Date : .............................

DÉPOSITAIRE / CLIENT
[Nom / Raison sociale]
[Adresse]
[Contact]

FOURNISSEUR (destinataire du retour)
Goûtstoso
Jordan Montanaro
Rue des Sources 19, 2613 Villeret

MOTIF DU RETOUR
☐ Fin de contrat de dépôt-vente
☐ Produits invendus
☐ Produits non conformes
☐ Erreur de livraison
☐ Autre : .................................................

PRODUITS RETOURNÉS

┌─────────────────────────────────────┬──────┬─────────────┬───────────┐
│ Désignation                          │ Qté  │ Lot         │ État      │
├─────────────────────────────────────┼──────┼─────────────┼───────────┤
│                                      │      │             │           │
│                                      │      │             │           │
│                                      │      │             │           │
└─────────────────────────────────────┴──────┴─────────────┴───────────┘

État : (A) Parfait état, (B) Acceptable, (C) Endommagé

CONDITIONS DE REPRISE

- Les produits doivent être retournés dans leur emballage d'origine
- Étiquettes intactes et lisibles
- Date limite de consommation respectée
- Les produits endommagés ou manquants peuvent être facturés au prix pro

VÉRIFICATION ET ACCEPTATION

Retour remis par (Dépositaire) :          Retour reçu par (Fournisseur) :

Nom : ...........................          Nom : ...........................
Date : ..........................          Date : ..........................
Signature :                                 Signature :

Observations : ..........................................................
.............................................................................`, }, consommation_responsable_old: { titre:"_old", description:"", icone:"", categorie:"_old", contenu:``, }, consommation_old2: { titre:"_old2", description:"", icone:"", categorie:"_old", contenu:`
- La contenance
- La liste des ingrédients
- Les mentions légales (interdiction aux mineurs)
- La date limite de consommation optimale

1. RESSOURCES ET AIDE
   En cas de problème de consommation, contactez :

- Addiction Suisse : www.addictionsuisse.ch
- Ligne d'aide : 147 (jeunes) / 143 (La Main Tendue)

Goûtstoso s'engage pleinement dans une démarche de consommation responsable et saine.

Goûtstoso - Jordan Montanaro
admin@goutstoso.ch · www.goutstoso.ch`,
},
};

const MODELES_TEMPLATES = [
  {id:"_blank", titre:"Document vierge", icone:"📄", description:"Commencer de zéro", contenu:"", categorie:"Mes documents"},
  {id:"cgv", titre:"Conditions Générales de Vente", icone:"📜", description:"Basé sur vos CGV Goûtstoso", categorie:"Légal"},
  {id:"contrat_partenariat", titre:"Contrat de partenariat", icone:"🤝", description:"Accord commercial avec un partenaire", categorie:"Légal"},
  {id:"nda", titre:"Accord de confidentialité (NDA)", icone:"🔒", description:"Pour partenaires ou fournisseurs stratégiques", categorie:"Légal"},
  {id:"lettre_resiliation", titre:"Lettre de résiliation", icone:"🚫", description:"Pour mettre fin à un accord", categorie:"Courriers"},
  {id:"lettre_relance_partenaire", titre:"Lettre de relance", icone:"💌", description:"Relance commerciale ou partenaire", categorie:"Courriers"},
];

const Documents = ({st,setSt}) => {
const [viewId,setViewId] = useState(null);
const [editing,setEditing] = useState(false);
const [editContent,setEditContent] = useState("");
const [editTitre,setEditTitre] = useState("");
const [uploadingPJ,setUploadingPJ] = useState(false);
const [showCreateModal,setShowCreateModal] = useState(false);
const [createStep,setCreateStep] = useState<"choose"|"edit">("choose");
const [newDoc,setNewDoc] = useState({titre:"",description:"",contenu:"",categorie:"Mes documents",icone:"📄"});

// Fusionner DOCS_DEFAUT avec les documents sauvegardés
// → garantit que nouveaux docs apparaissent, et que catégorie/icône sont toujours à jour
React.useEffect(()=>{
try {
const saved = st.documents || {};
const merged = {...DOCS_DEFAUT};
Object.keys(merged).forEach(k=>{
  if(saved[k]){
    // Préserver le contenu/titre/pièce jointe modifiés par l'utilisateur
    // mais forcer la catégorie et l'icône depuis DOCS_DEFAUT
    merged[k] = {
      ...DOCS_DEFAUT[k],
      ...(saved[k].contenu ? {contenu: saved[k].contenu} : {}),
      ...(saved[k].titre && saved[k].titre !== "_old" && saved[k].titre !== "_old2" ? {titre: saved[k].titre} : {}),
      ...(saved[k].modifieLe ? {modifieLe: saved[k].modifieLe} : {}),
      ...(saved[k].pieceJointe ? {pieceJointe: saved[k].pieceJointe, pieceJointeNom: saved[k].pieceJointeNom, pieceJointeDate: saved[k].pieceJointeDate} : {}),
    };
  }
});
setSt(p=>({...p,documents:merged}));
} catch(e) { console.log("Docs init error",e); }
},[]);

const docs = (st.documents && Object.keys(st.documents).length>0) ? st.documents : DOCS_DEFAUT;
const view = viewId ? docs[viewId] : null;

const save = () => {
const currentDocs = st.documents || DOCS_DEFAUT;
setSt(p=>({...p,documents:{...currentDocs,[viewId]:{...currentDocs[viewId],titre:editTitre,contenu:editContent,modifieLe:today()}}}));
setEditing(false);
};

const resetDoc = () => {
if(!window.confirm("Restaurer la version par défaut de ce document ? Tes modifications seront perdues.")) return;
setSt(p=>({...p,documents:{...p.documents,[viewId]:{...DOCS_DEFAUT[viewId]}}}));
setEditing(false);
};

const handlePJUpload = (e) => {
  const file = e.target.files?.[0];
  if(!file) return;
  if(file.size > 10*1024*1024){alert("Fichier trop volumineux (max 10 Mo)");return;}
  setUploadingPJ(true);
  const reader = new FileReader();
  reader.onload = (ev) => {
    const b64 = ev.target.result as string;
    setSt(p=>({...p,documents:{
      ...(p.documents||DOCS_DEFAUT),
      [viewId]:{
        ...(p.documents||DOCS_DEFAUT)[viewId],
        pieceJointe:b64,
        pieceJointeNom:file.name,
        pieceJointeDate:today(),
      }
    }}));
    setUploadingPJ(false);
  };
  reader.onerror = () => { alert("Erreur lors de la lecture du fichier"); setUploadingPJ(false); };
  reader.readAsDataURL(file);
  e.target.value="";
};

const telechargerPJ = () => {
  const d = docs[viewId];
  if(!d?.pieceJointe) return;
  const a = document.createElement("a");
  a.href = d.pieceJointe;
  a.download = d.pieceJointeNom||"document.pdf";
  a.click();
};

const supprimerPJ = () => {
  if(!window.confirm("Supprimer la pièce jointe ?")) return;
  setSt(p=>({...p,documents:{
    ...(p.documents||DOCS_DEFAUT),
    [viewId]:{...(p.documents||DOCS_DEFAUT)[viewId],pieceJointe:null,pieceJointeNom:null,pieceJointeDate:null}
  }}));
};

const supprimerDocument = (id) => {
  if(!window.confirm("Supprimer définitivement ce document personnalisé ?")) return;
  setSt(p=>{
    const newDocs = {...(p.documents||{})};
    delete newDocs[id];
    return {...p, documents:newDocs};
  });
  setViewId(null);
};

const choisirModele = (tpl) => {
  const contenuBase = tpl.id==="_blank" ? "" : (docs[tpl.id]?.contenu || DOCS_DEFAUT[tpl.id]?.contenu || "");
  setNewDoc({
    titre: tpl.id==="_blank" ? "" : "Copie — "+tpl.titre,
    description: tpl.description||"",
    contenu: contenuBase,
    categorie: tpl.categorie||"Mes documents",
    icone: tpl.icone||"📄",
  });
  setCreateStep("edit");
};

const enregistrerNouveauDoc = () => {
  if(!newDoc.titre.trim()){alert("Donne un titre au document");return;}
  const id = "custom_"+Date.now();
  setSt(p=>({...p,documents:{
    ...(p.documents||DOCS_DEFAUT),
    [id]:{
      titre:newDoc.titre.trim(),
      description:newDoc.description.trim(),
      contenu:newDoc.contenu,
      categorie:newDoc.categorie,
      icone:newDoc.icone||"📄",
      modifieLe:today(),
      custom:true,
    }
  }}));
  setShowCreateModal(false);
  setCreateStep("choose");
};

const exporterPDF = async (docId) => {
const d = docs[docId];
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

  // Bande jaune
  doc.setFillColor(232,182,76);doc.rect(0,0,W,6,"F");
  // Header
  pdfLogo(doc,mg);

  // Titre
  doc.setFontSize(14);doc.setFont("helvetica","bold");doc.setTextColor(17,17,17);
  const lines = doc.splitTextToSize(d.titre,W-mg*2);
  doc.text(lines,mg,44);

  doc.setDrawColor(230,230,228);doc.setLineWidth(0.3);doc.line(mg,50,W-mg,50);

  // Contenu
  doc.setFontSize(9);doc.setFont("helvetica","normal");doc.setTextColor(60,60,60);
  const contentLines = doc.splitTextToSize(d.contenu||"",W-mg*2);
  let y=58;
  contentLines.forEach(line=>{
    if(y>275){doc.addPage();y=20;}
    doc.text(line,mg,y);
    y+=4.5;
  });

  // Pied
  doc.setDrawColor(230,230,228);doc.line(mg,280,W-mg,280);
  doc.setFontSize(7);doc.setTextColor(150,150,150);
  doc.text("Goûtstoso - Jordan Montanaro · Rue des Sources 19 · 2613 Villeret · admin@goutstoso.ch",W/2,285,{align:"center"});
  doc.setFillColor(232,182,76);doc.rect(0,292,W,5,"F");

  doc.save((d.titre||"document").replace(/[^a-z0-9]/gi,"_")+".pdf");
} catch(e){ alert("Erreur PDF : "+e.message); }

};

const copier = (docId) => {
const d = docs[docId];
navigator.clipboard?.writeText((d.titre||"")+"\n\n"+(d.contenu||""))
.then(()=>alert("Texte copié !"))
.catch(()=>alert("Impossible de copier"));
};

// Vue document détail
if(view && view.categorie !== "_old") {
return (
<div className="fade">
<button onClick={()=>{setViewId(null);setEditing(false);}} style={{display:"flex",alignItems:"center",gap:6,background:"none",border:"none",color:"#9CA3AF",fontSize:13,marginBottom:14,padding:0,cursor:"pointer"}}>← Retour aux documents</button>

  {/* Header */}
  <div style={{background:"#0A0A0A",borderRadius:14,padding:"16px",marginBottom:12}}>
    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
      <span style={{fontSize:26}}>{view.icone||"📄"}</span>
      <div>
        <p style={{fontSize:10,color:"#F2C94C",fontWeight:700,textTransform:"uppercase",letterSpacing:".06em"}}>{view.categorie}</p>
        <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,fontWeight:700,color:"#fff",marginTop:2,lineHeight:1.2}}>{view.titre}</p>
      </div>
    </div>
    <p style={{fontSize:11,color:"#9CA3AF",marginTop:4}}>{view.description}</p>
    {view.modifieLe && <p style={{fontSize:10,color:"#6B7280",marginTop:4}}>Modifié le {fmt(view.modifieLe)}</p>}
  </div>

  {editing ? (
    <div>
      <F label="Titre du document" value={editTitre} onChange={setEditTitre}/>
      <div style={{marginTop:14}}>
        <label style={{fontSize:11,fontWeight:600,color:"#9CA3AF",textTransform:"uppercase",display:"block",marginBottom:6}}>Contenu</label>
        <textarea value={editContent} onChange={e=>setEditContent(e.target.value)}
          style={{width:"100%",minHeight:420,padding:"14px",fontSize:12,fontFamily:"'Courier New',monospace",border:"1.5px solid #E5E5E0",borderRadius:10,resize:"vertical",lineHeight:1.7,boxSizing:"border-box"}}/>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginTop:14}}>
        <Btn onClick={save} full icon="check">Enregistrer</Btn>
        <Btn onClick={()=>setEditing(false)} variant="ghost" full>Annuler</Btn>
      </div>
      {DOCS_DEFAUT[viewId] && DOCS_DEFAUT[viewId].categorie !== "_old" && (
        <button onClick={resetDoc} style={{width:"100%",background:"#FEF2F2",color:"#B91C1C",border:"none",borderRadius:10,padding:"10px",fontWeight:500,fontSize:12,cursor:"pointer",marginTop:10}}>
          ↻ Restaurer le modèle par défaut
        </button>
      )}
    </div>
  ) : (
    <>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:14}}>
        <button onClick={()=>{setEditing(true);setEditContent(view.contenu||"");setEditTitre(view.titre||"");}}
          style={{background:"#111",color:"#F2C94C",border:"none",borderRadius:10,padding:"11px 6px",fontWeight:700,fontSize:12,cursor:"pointer"}}>
          ✏️ Modifier
        </button>
        <button onClick={()=>exporterPDF(viewId)}
          style={{background:"#FEF9E7",color:"#92400E",border:"1.5px solid #F2C94C",borderRadius:10,padding:"11px 6px",fontWeight:700,fontSize:12,cursor:"pointer"}}>
          📄 PDF
        </button>
        <button onClick={()=>copier(viewId)}
          style={{background:"#F5F5F0",border:"none",borderRadius:10,padding:"11px 6px",fontWeight:600,fontSize:12,cursor:"pointer"}}>
          📋 Copier
        </button>
      </div>
      {view.custom && (
        <button onClick={()=>supprimerDocument(viewId)}
          style={{width:"100%",background:"#FEF2F2",color:"#B91C1C",border:"none",borderRadius:10,padding:"10px",fontWeight:600,fontSize:12,cursor:"pointer",marginBottom:14}}>
          🗑 Supprimer ce document personnalisé
        </button>
      )}

      <Card style={{padding:"18px"}}>
        <div style={{whiteSpace:"pre-wrap",fontSize:12,lineHeight:1.8,color:"#1a1a1a",fontFamily:"'Courier New',monospace"}}>
          {view.contenu}
        </div>
      </Card>

      {/* ── PIÈCE JOINTE ─────────────────────────────── */}
      <div style={{marginTop:14,background:"#FAFAF7",border:"1px solid #EAE7E0",borderRadius:12,padding:"14px"}}>
        <p style={{fontSize:11,fontWeight:700,color:"#525252",textTransform:"uppercase",letterSpacing:".06em",marginBottom:10}}>📎 Pièce jointe officielle</p>

        {view.pieceJointe ? (
          <div>
            {/* Fichier existant */}
            <div style={{background:"#fff",border:"1px solid #E5E5E0",borderRadius:8,padding:"10px 12px",marginBottom:10,display:"flex",alignItems:"center",gap:10}}>
              <span style={{fontSize:22,flexShrink:0}}>📄</span>
              <div style={{flex:1,minWidth:0}}>
                <p style={{fontSize:12,fontWeight:600,color:"#111",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{view.pieceJointeNom||"document.pdf"}</p>
                {view.pieceJointeDate && <p style={{fontSize:10,color:"#9CA3AF",marginTop:2}}>Déposé le {fmt(view.pieceJointeDate)}</p>}
              </div>
              <button onClick={telechargerPJ} style={{background:"#0A0A0A",color:"#F2C94C",border:"none",borderRadius:7,padding:"7px 12px",fontSize:11,fontWeight:700,cursor:"pointer",flexShrink:0}}>
                ⬇ Télécharger
              </button>
            </div>
            {/* Actions mise à jour / suppression */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              <label style={{background:"#EFF6FF",border:"1px solid #BFDBFE",borderRadius:8,padding:"9px",fontSize:11,fontWeight:700,color:"#1D4ED8",cursor:"pointer",textAlign:"center",display:"block"}}>
                {uploadingPJ?"⏳ Chargement...":"🔄 Mettre à jour le fichier"}
                <input type="file" accept=".pdf,.doc,.docx,.png,.jpg" style={{display:"none"}} onChange={handlePJUpload} disabled={uploadingPJ}/>
              </label>
              <button onClick={supprimerPJ} style={{background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:8,padding:"9px",fontSize:11,fontWeight:600,color:"#B91C1C",cursor:"pointer"}}>
                🗑 Retirer la pièce jointe
              </button>
            </div>
          </div>
        ) : (
          <div>
            <p style={{fontSize:11,color:"#9CA3AF",marginBottom:10}}>Aucune pièce jointe — tu peux attacher la version officielle signée ou le fichier PDF original.</p>
            <label style={{
              display:"flex",alignItems:"center",justifyContent:"center",gap:8,
              background:"#111",color:"#F2C94C",border:"none",
              borderRadius:9,padding:"11px",fontSize:12,fontWeight:700,
              cursor:"pointer",
            }}>
              {uploadingPJ ? "⏳ Chargement..." : "📎 Attacher un document"}
              <input type="file" accept=".pdf,.doc,.docx,.png,.jpg" style={{display:"none"}} onChange={handlePJUpload} disabled={uploadingPJ}/>
            </label>
            <p style={{fontSize:9,color:"#B5B2AB",textAlign:"center",marginTop:6}}>PDF, Word, image · max 10 Mo</p>
          </div>
        )}
      </div>
    </>
  )}
</div>
);
}

// Vue liste — nouvelle structure par catégories
const ORDRE_CATEGORIES = ["Mes documents","Légal","Courriers"];
const docsEntries = Object.entries(docs).filter(([,d])=>d.categorie!=="_old"&&d.titre&&d.titre!=="_old"&&d.titre!=="_old2");
const categories = ORDRE_CATEGORIES.filter(cat=>docsEntries.some(([,d])=>d.categorie===cat));

const catConfig = {
  "Mes documents": {icon:"🗂️", color:"#F5F3FF", border:"#C4B5FD", txt:"#5B21B6", desc:"Vos documents personnalisés"},
  "Courriers": {icon:"✉️", color:"#F0FDF4", border:"#86EFAC", txt:"#166534", desc:"Lettres types pour vos communications"},
  "Légal": {icon:"📜", color:"#FEF9E7", border:"#F2C94C", txt:"#92400E", desc:"Documents légaux et réglementaires"},
};

// Modal de création
const ModalCreation = () => (
  <Modal title={createStep==="choose" ? "Choisir un modèle" : "Nouveau document"} onClose={()=>{setShowCreateModal(false);setCreateStep("choose");}}>
    {createStep==="choose" ? (
      <div>
        <p style={{fontSize:12,color:"#6B7280",marginBottom:14}}>Sélectionne un modèle de départ pour ton nouveau document :</p>
        <div style={{display:"grid",gap:10}}>
          {MODELES_TEMPLATES.map(tpl=>(
            <button key={tpl.id} onClick={()=>choisirModele(tpl)}
              style={{background:"#F9F9F6",border:"1.5px solid #E5E5E0",borderRadius:12,padding:"12px 14px",cursor:"pointer",textAlign:"left",display:"flex",alignItems:"center",gap:12,transition:"border-color .2s"}}>
              <span style={{fontSize:24,flexShrink:0}}>{tpl.icone}</span>
              <div>
                <p style={{fontWeight:700,fontSize:13,color:"#111",marginBottom:2}}>{tpl.titre}</p>
                <p style={{fontSize:11,color:"#9CA3AF"}}>{tpl.description}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    ) : (
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        <F label="Titre du document *" value={newDoc.titre} onChange={v=>setNewDoc(p=>({...p,titre:v}))} placeholder="Ex: Contrat Jordan — Épicerie du Lac"/>
        <F label="Description courte" value={newDoc.description} onChange={v=>setNewDoc(p=>({...p,description:v}))} placeholder="Résumé rapide de ce document"/>
        <div>
          <p style={{fontSize:11,fontWeight:600,color:"#374151",marginBottom:6}}>Catégorie</p>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            {["Mes documents","Légal","Courriers"].map(c=>(
              <button key={c} onClick={()=>setNewDoc(p=>({...p,categorie:c}))}
                style={{padding:"6px 14px",borderRadius:20,fontSize:11,fontWeight:700,cursor:"pointer",
                  background:newDoc.categorie===c?"#111":"#F3F4F6",
                  color:newDoc.categorie===c?"#F2C94C":"#374151",
                  border:newDoc.categorie===c?"2px solid #111":"2px solid #E5E7EB"}}>
                {c}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p style={{fontSize:11,fontWeight:600,color:"#374151",marginBottom:6}}>Contenu</p>
          <textarea value={newDoc.contenu} onChange={e=>setNewDoc(p=>({...p,contenu:e.target.value}))}
            placeholder="Rédige ton document ici…"
            style={{width:"100%",minHeight:200,padding:"10px 12px",fontSize:12,fontFamily:"monospace",lineHeight:1.6,
              border:"1.5px solid #D1D5DB",borderRadius:10,resize:"vertical",background:"#FAFAF8",boxSizing:"border-box"}}/>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>setCreateStep("choose")}
            style={{flex:1,padding:"10px",borderRadius:10,border:"2px solid #E5E7EB",background:"#fff",fontSize:13,fontWeight:600,cursor:"pointer",color:"#374151"}}>
            ← Retour
          </button>
          <button onClick={enregistrerNouveauDoc}
            style={{flex:2,padding:"10px",borderRadius:10,border:"none",background:"#111",color:"#F2C94C",fontSize:13,fontWeight:700,cursor:"pointer"}}>
            ✓ Créer le document
          </button>
        </div>
      </div>
    )}
  </Modal>
);

return (
<div className="fade">
{showCreateModal && <ModalCreation/>}
<SectionTitle action={<Btn icon="plus" onClick={()=>{setShowCreateModal(true);setCreateStep("choose");setNewDoc({titre:"",description:"",contenu:"",categorie:"Mes documents",icone:"📄"});}}>Nouveau</Btn>}>Documents</SectionTitle>

  {/* Stats */}
  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:18}}>
    {ORDRE_CATEGORIES.map(cat=>{
      const cfg = catConfig[cat];
      const nb = docsEntries.filter(([,d])=>d.categorie===cat).length;
      return (
        <div key={cat} style={{background:cfg.color,border:"1px solid "+cfg.border,borderRadius:12,padding:"12px 8px",textAlign:"center"}}>
          <p style={{fontSize:18}}>{cfg.icon}</p>
          <p style={{fontSize:18,fontWeight:700,fontFamily:"'Cormorant Garamond',serif",color:cfg.txt,lineHeight:1}}>{nb}</p>
          <p style={{fontSize:9,color:cfg.txt,opacity:.8,marginTop:2,fontWeight:600,textTransform:"uppercase",lineHeight:1.2}}>{cat}</p>
        </div>
      );
    })}
  </div>

  {categories.map(cat=>{
    const cfg = catConfig[cat]||{icon:"📄",color:"#F9F9F6",border:"#E5E5E0",txt:"#374151",desc:""};
    const entries = docsEntries.filter(([,d])=>d.categorie===cat);
    return (
      <div key={cat} style={{marginBottom:22}}>
        {/* En-tête catégorie */}
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
          <div style={{background:cfg.color,border:"1px solid "+cfg.border,borderRadius:8,padding:"5px 10px",display:"flex",alignItems:"center",gap:6}}>
            <span style={{fontSize:14}}>{cfg.icon}</span>
            <span style={{fontSize:12,fontWeight:700,color:cfg.txt}}>{cat}</span>
          </div>
          <p style={{fontSize:11,color:"#9CA3AF"}}>{cfg.desc}</p>
        </div>

        {/* Cartes documents */}
        <div style={{display:"grid",gap:8}}>
          {entries.map(([id,d])=>(
            <Card key={id} style={{padding:"14px 16px",cursor:"pointer",border:"1px solid #F0F0EC"}} onClick={()=>setViewId(id)}>
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <div style={{width:42,height:42,borderRadius:10,background:cfg.color,border:"1px solid "+cfg.border,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  <span style={{fontSize:20}}>{d.icone||cfg.icon}</span>
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                    <p style={{fontWeight:700,fontSize:13,color:"#111"}}>{d.titre}</p>
                    {d.pieceJointe && <span style={{background:"#DBEAFE",color:"#1D4ED8",fontSize:9,fontWeight:700,borderRadius:4,padding:"2px 6px"}}>📎 JOINT</span>}
                  </div>
                  <p style={{fontSize:11,color:"#6B7280",marginTop:2,lineHeight:1.4}}>{d.description}</p>
                  {d.modifieLe&&<p style={{fontSize:10,color:"#A3A3A3",marginTop:3}}>Modifié le {fmt(d.modifieLe)}</p>}
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:6,flexShrink:0}}>
                  <button onClick={e=>{e.stopPropagation();exporterPDF(id);}}
                    style={{background:"#111",color:"#F2C94C",border:"none",borderRadius:8,padding:"6px 10px",fontSize:10,fontWeight:700,cursor:"pointer"}}>
                    PDF
                  </button>
                  <div style={{color:"#D1D5DB",fontSize:18,textAlign:"center"}}>›</div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  })}
</div>

);
};

// ══════════════════════════════════════════════════════════════
// PAGE: FACTURES FOURNISSEURS
// ══════════════════════════════════════════════════════════════

const CATEGORIES_FOURNISSEURS = [
"Matières premières",
"Emballages",
"Étiquettes",
"Matériel",
"Marketing",
"Services",
"Transport",
"Assurances",
"Télécommunications",
"Loyer",
"Autres",
];

const Fournisseurs = ({st, setSt}) => {
// ── SUB-TAB ─────────────────────────────────────────────────
const [subTab, setSubTab] = useState<"contacts"|"factures">("contacts");

// ── CONTACTS ────────────────────────────────────────────────
const [cModal, setCModal] = useState(null);
const [cViewId, setCViewId] = useState<string|null>(null);
const [cSearch, setCSearch] = useState("");
const emptyContact = () => ({id:null as any,nom:"",email:"",telephone:"",adresse:"",npa:"",ville:"",categorie:"",notes:""});
const [cForm, setCForm] = useState(emptyContact());
const cView = cViewId ? (st.fournisseurs||[]).find((f:any)=>f.id===cViewId)||null : null;

const saveContact = () => {
  if(!cForm.nom){alert("Le nom est obligatoire");return;}
  if(cForm.id){
    setSt((p:any)=>({...p,fournisseurs:(p.fournisseurs||[]).map((f:any)=>f.id===cForm.id?cForm:f)}));
  } else {
    const nf = {...cForm,id:uid()};
    setSt((p:any)=>({...p,fournisseurs:[...(p.fournisseurs||[]),nf]}));
  }
  setCModal(null);
};

const supprimerContact = (id:string) => {
  if(!window.confirm("Supprimer ce fournisseur ? Ses factures resteront conservées.")) return;
  setSt((p:any)=>({...p,fournisseurs:(p.fournisseurs||[]).filter((f:any)=>f.id!==id)}));
  setCViewId(null);
};

const getContactStats = (nom:string) => {
  const ff = (st.facturesFournisseurs||[]).filter((f:any)=>f.fournisseur?.toLowerCase()===nom?.toLowerCase());
  const total = sum(ff.map((f:any)=>parseFloat(f.montant)||0));
  const aPayer = sum(ff.filter((f:any)=>f.statut==="à payer").map((f:any)=>parseFloat(f.montant)||0));
  return {nb:ff.length,total,aPayer,ff:ff as any[]};
};

const contacts = (st.fournisseurs||[]).slice().sort((a:any,b:any)=>a.nom.localeCompare(b.nom));
const cFiltered = contacts.filter((f:any)=>{
  if(!cSearch) return true;
  const s = cSearch.toLowerCase();
  return f.nom?.toLowerCase().includes(s)||f.email?.toLowerCase().includes(s)||f.ville?.toLowerCase().includes(s)||f.categorie?.toLowerCase().includes(s);
});

// ── FACTURES ────────────────────────────────────────────────
const [modal, setModal] = useState(null);
const [viewId, setViewId] = useState(null);
const [filtre, setFiltre] = useState("toutes");

const view = viewId ? (st.facturesFournisseurs||[]).find(f=>f.id===viewId) : null;

const empty = () => ({
id: null,
fournisseur: "",
numero: "",
date: today(),
dateEcheance: "",
montant: 0,
categorie: "Matières premières",
description: "",
statut: "à payer",
datePaiement: "",
pdfFacture: null as string|null,
pdfFactureNom: "" as string,
pdfBonLivraison: null as string|null,
pdfBonLivraisonNom: "" as string,
});

const readFileAsBase64 = (file: File): Promise<string> =>
  new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(file);
  });

const [form, setForm] = useState(empty());

const getCompte = (cat) => {
const map = {
"Matières premières": "4010",
"Emballages": "4200",
"Étiquettes": "4210",
"Matériel": "4000",
"Marketing": "6610",
"Services": "6500",
"Transport": "6513",
"Assurances": "6300",
"Télécommunications": "6400",
"Loyer": "6100",
"Autres": "6900",
};
return map[cat] || "6900";
};

const save = () => {
if(!form.fournisseur || !form.montant) { alert("Fournisseur et montant obligatoires"); return; }
const montant = parseFloat(String(form.montant).replace(",","."))||0;
const cleaned = {...form, montant};

if(form.id) {
  setSt(p=>({...p, facturesFournisseurs: (p.facturesFournisseurs||[]).map(f=>f.id===form.id?cleaned:f)}));
} else {
  cleaned.id = uid();
  // Calculer date échéance par défaut à +30j
  if(!cleaned.dateEcheance) {
    const d = new Date(cleaned.date);
    d.setDate(d.getDate()+30);
    cleaned.dateEcheance = d.toISOString().slice(0,10);
  }
  setSt(p=>({...p, facturesFournisseurs: [...(p.facturesFournisseurs||[]), cleaned]}));
}
setModal(null);

};

const togglePaye = (f) => {
if(f.statut === "payée") {
// Dé-marquer comme payée - supprimer l'écriture liée
if(!window.confirm("Dé-marquer cette facture comme payée ?")) return;
setSt(p=>{
const trans = (p.transactions||[]).filter(t=>t.factureFournisseurId!==f.id);
const newSolde = (p.transactions||[]).filter(t=>t.factureFournisseurId===f.id && t.postfinance)
.reduce((acc,t)=>acc+(+t.montant), parseFloat(p.soldeBancaire||0));
return {
...p,
facturesFournisseurs: p.facturesFournisseurs.map(x=>x.id===f.id?{...x,statut:"à payer",datePaiement:""}:x),
transactions: trans,
soldeBancaire: parseFloat(newSolde.toFixed(2)),
};
});
} else {
// Marquer comme payée - créer écriture compta
const datePaiement = prompt("Date de paiement (AAAA-MM-JJ) ?", today());
if(!datePaiement) return;
const postfinance = window.confirm("Payé depuis PostFinance ? (OK=oui, Annuler=autre moyen)");

  const trans = {
    id: uid(),
    factureFournisseurId: f.id,
    date: datePaiement,
    compte: getCompte(f.categorie),
    libelle: f.categorie,
    type: "depense",
    categorie: f.categorie,
    montant: parseFloat(f.montant),
    description: "Fournisseur "+f.fournisseur+(f.numero?" - "+f.numero:""),
    postfinance,
  };
  
  setSt(p=>{
    const newSolde = postfinance 
      ? parseFloat((parseFloat(p.soldeBancaire||0)-parseFloat(f.montant)).toFixed(2))
      : parseFloat(p.soldeBancaire||0);
    return {
      ...p,
      facturesFournisseurs: p.facturesFournisseurs.map(x=>x.id===f.id?{...x,statut:"payée",datePaiement}:x),
      transactions: [...(p.transactions||[]), trans],
      soldeBancaire: newSolde,
    };
  });
}

};

const supprimer = (id) => {
if(!window.confirm("Supprimer cette facture fournisseur ?")) return;
setSt(p=>({...p, facturesFournisseurs: (p.facturesFournisseurs||[]).filter(f=>f.id!==id)}));
setViewId(null);
};

// Données
const factures = (st.facturesFournisseurs||[]).slice().sort((a,b)=>{
// Non payées d'abord, puis par date échéance
if(a.statut !== b.statut) return a.statut==="à payer" ? -1 : 1;
return (a.dateEcheance||a.date).localeCompare(b.dateEcheance||b.date);
});

const filtrees = factures.filter(f=>{
if(filtre==="toutes") return true;
if(filtre==="a-payer") return f.statut==="à payer";
if(filtre==="payees") return f.statut==="payée";
if(filtre==="echues") {
if(f.statut==="payée") return false;
const ech = new Date(f.dateEcheance||f.date);
return ech < new Date();
}
return true;
});

// Stats
const aPayer = factures.filter(f=>f.statut==="à payer");
const totalAPayer = sum(aPayer.map(f=>parseFloat(f.montant)||0));
const nbEchues = aPayer.filter(f=>{
const ech = new Date(f.dateEcheance||f.date);
return ech < new Date();
}).length;
const echuesTotal = sum(aPayer.filter(f=>{
const ech = new Date(f.dateEcheance||f.date);
return ech < new Date();
}).map(f=>parseFloat(f.montant)||0));

// ── Contact detail ───────────────────────────────────────────
if(subTab==="contacts" && cView) {
const stats = getContactStats((cView as any).nom);
return (
<div className="fade">
<button onClick={()=>setCViewId(null)} style={{display:"flex",alignItems:"center",gap:6,background:"none",border:"none",color:"#9CA3AF",fontSize:13,marginBottom:12,padding:0,cursor:"pointer"}}>← Retour fournisseurs</button>

  <div style={{background:"#111",borderRadius:14,padding:"16px",marginBottom:14}}>
    <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:24,fontWeight:700,color:"#fff"}}>{(cView as any).nom}</p>
    {(cView as any).categorie && <p style={{fontSize:11,color:"#E8B64C",marginTop:4,fontWeight:600}}>{(cView as any).categorie}</p>}
    {(cView as any).email && <p style={{fontSize:12,color:"#aaa",marginTop:4}}>✉️ {(cView as any).email}</p>}
    {(cView as any).telephone && <p style={{fontSize:12,color:"#aaa",marginTop:2}}>📞 {(cView as any).telephone}</p>}
    {(cView as any).adresse && <p style={{fontSize:12,color:"#aaa",marginTop:2}}>📍 {(cView as any).adresse}{(cView as any).npa?" · "+(cView as any).npa:""}{(cView as any).ville?" "+((cView as any).ville):""}</p>}
  </div>

  {/* Actions */}
  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
    <button onClick={()=>{setCForm({...(cView as any)});setCModal("form");setCViewId(null);}} style={{background:"#F5F5F0",border:"none",borderRadius:12,padding:"12px",fontWeight:600,fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
      <Ic n="edit" s={14}/> Modifier
    </button>
    <button onClick={()=>supprimerContact((cView as any).id)} style={{background:"#FEE2E2",color:"#991B1B",border:"none",borderRadius:12,padding:"12px",fontWeight:600,fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
      <Ic n="trash" s={14}/> Supprimer
    </button>
  </div>

  {/* Stats */}
  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14}}>
    <div style={{background:"#fff",border:"1px solid #EAE7E0",borderRadius:12,padding:"12px",textAlign:"center"}}>
      <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,fontWeight:700,color:"#111"}}>{stats.nb}</p>
      <p style={{fontSize:10,color:"#9CA3AF",marginTop:2}}>factures</p>
    </div>
    <div style={{background:"#fff",border:"1px solid #EAE7E0",borderRadius:12,padding:"12px",textAlign:"center"}}>
      <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,fontWeight:700,color:"#111"}}>{chf(stats.total)}</p>
      <p style={{fontSize:10,color:"#9CA3AF",marginTop:2}}>total dépensé</p>
    </div>
    {stats.aPayer>0 && (
      <div style={{background:"#FEF9E7",border:"1px solid #FDE68A",borderRadius:12,padding:"12px",textAlign:"center",gridColumn:"span 2"}}>
        <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,fontWeight:700,color:"#92400E"}}>{chf(stats.aPayer)}</p>
        <p style={{fontSize:10,color:"#92400E",marginTop:2,fontWeight:600}}>à payer</p>
      </div>
    )}
  </div>

  {/* Notes */}
  {(cView as any).notes && (
    <Card style={{marginBottom:14,padding:"10px 14px",background:"#FDF6E3"}}>
      <p style={{fontSize:10,color:"#9A3412",fontWeight:600,textTransform:"uppercase",marginBottom:4}}>Notes</p>
      <p style={{fontSize:12}}>{(cView as any).notes}</p>
    </Card>
  )}

  {/* Factures liées */}
  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
    <h3 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:18}}>Factures</h3>
    <button onClick={()=>{setForm({...empty(),fournisseur:(cView as any).nom});setModal("form");setSubTab("factures");setCViewId(null);}} style={{background:"#F2C94C",border:"none",borderRadius:8,padding:"7px 12px",fontWeight:600,fontSize:12,cursor:"pointer"}}>+ Nouvelle</button>
  </div>
  {stats.ff.length===0
    ? <p style={{fontSize:12,color:"#9CA3AF",textAlign:"center",padding:"16px 0"}}>Aucune facture enregistrée</p>
    : stats.ff.slice().sort((a:any,b:any)=>(b.date||"").localeCompare(a.date||"")).map((f:any)=>{
        const ech = new Date(f.dateEcheance||f.date);
        const echue = ech < new Date() && f.statut==="à payer";
        return (
          <Card key={f.id} style={{marginBottom:8,padding:"12px 14px",cursor:"pointer",borderLeft:f.statut==="payée"?"3px solid #22C55E":echue?"3px solid #B91C1C":"3px solid #E8B64C"}}
            onClick={()=>{setViewId(f.id);setSubTab("factures");setCViewId(null);}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{flex:1,minWidth:0}}>
                <p style={{fontWeight:600,fontSize:13}}>{f.categorie}</p>
                <p style={{fontSize:11,color:"#737373",marginTop:2}}>{fmt(f.date)}{f.numero?" · N°"+f.numero:""}</p>
              </div>
              <div style={{textAlign:"right",marginLeft:10}}>
                <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:18,fontWeight:700,color:echue?"#B91C1C":"#0A0A0A"}}>{chf(f.montant)}</p>
                <Badge c={f.statut==="payée"?"green":echue?"red":"yellow"}>{f.statut}</Badge>
              </div>
            </div>
          </Card>
        );
      })
  }
</div>
);
}

// ── Facture detail ───────────────────────────────────────────
if(subTab==="factures" && view) {
const ech = new Date(view.dateEcheance||view.date);
const joursRestants = Math.floor((ech - new Date())/86400000);
const echue = joursRestants < 0 && view.statut === "à payer";

return (
  <div className="fade">
    <button onClick={()=>setViewId(null)} style={{display:"flex",alignItems:"center",gap:6,background:"none",border:"none",color:"#737373",fontSize:13,marginBottom:12,padding:0,cursor:"pointer"}}>← Retour</button>

    <div style={{background:"#0A0A0A",borderRadius:12,padding:"14px 16px",marginBottom:12}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
        <div>
          <p style={{fontSize:10,color:"#E8B64C",fontWeight:600,textTransform:"uppercase",letterSpacing:"-0.005em"}}>Facture fournisseur</p>
          <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,fontWeight:600,color:"#fff",marginTop:4}}>{view.fournisseur}</p>
          {view.numero && <p style={{fontSize:11,color:"#A3A3A3",marginTop:2}}>N° {view.numero}</p>}
        </div>
        <Badge c={view.statut==="payée"?"green":echue?"red":"yellow"}>{view.statut}</Badge>
      </div>
    </div>

    {/* Actions */}
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14}}>
      <button onClick={()=>togglePaye(view)} style={{background:view.statut==="payée"?"#F4F4F2":"#15803D",color:view.statut==="payée"?"#525252":"#fff",border:"none",borderRadius:10,padding:"11px",fontWeight:600,fontSize:12,cursor:"pointer"}}>
        {view.statut==="payée"?"↻ Dé-marquer payée":"✓ Marquer comme payée"}
      </button>
      <button onClick={()=>{setForm({...view});setModal("form");setViewId(null);}} style={{background:"#F4F4F2",border:"none",borderRadius:10,padding:"11px",fontWeight:600,fontSize:12,cursor:"pointer"}}>✏️ Modifier</button>
    </div>

    {echue && (
      <div style={{background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:10,padding:"10px 12px",marginBottom:14}}>
        <p style={{fontSize:12,fontWeight:600,color:"#B91C1C"}}>⚠️ Facture en retard de {Math.abs(joursRestants)} jour(s)</p>
      </div>
    )}

    {/* Infos */}
    <Card style={{marginBottom:12,padding:"12px 14px"}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <div>
          <p style={{fontSize:10,color:"#737373",fontWeight:500,textTransform:"uppercase"}}>Date facture</p>
          <p style={{fontSize:13,fontWeight:600,marginTop:2}}>{fmt(view.date)}</p>
        </div>
        <div>
          <p style={{fontSize:10,color:"#737373",fontWeight:500,textTransform:"uppercase"}}>Échéance</p>
          <p style={{fontSize:13,fontWeight:600,marginTop:2,color:echue?"#B91C1C":"#0A0A0A"}}>{view.dateEcheance?fmt(view.dateEcheance):"-"}</p>
        </div>
        <div>
          <p style={{fontSize:10,color:"#737373",fontWeight:500,textTransform:"uppercase"}}>Catégorie</p>
          <p style={{fontSize:13,fontWeight:600,marginTop:2}}>{view.categorie}</p>
        </div>
        <div>
          <p style={{fontSize:10,color:"#737373",fontWeight:500,textTransform:"uppercase"}}>Compte</p>
          <p style={{fontSize:13,fontWeight:600,marginTop:2}}>{getCompte(view.categorie)}</p>
        </div>
      </div>
      <div style={{marginTop:12,paddingTop:10,borderTop:"1px solid #EAE7E0",display:"flex",justifyContent:"space-between",alignItems:"baseline"}}>
        <span style={{fontSize:11,color:"#737373"}}>Montant TTC</span>
        <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:24,fontWeight:700,color:"#0A0A0A"}}>{chf(view.montant)}</span>
      </div>
    </Card>

    {view.description && (
      <Card style={{marginBottom:12,padding:"10px 14px",background:"#FDF6E3"}}>
        <p style={{fontSize:10,color:"#9A3412",fontWeight:600,textTransform:"uppercase",marginBottom:4}}>Notes</p>
        <p style={{fontSize:12}}>{view.description}</p>
      </Card>
    )}

    {view.statut==="payée" && view.datePaiement && (
      <Card style={{marginBottom:12,padding:"10px 14px",background:"#F0FDF4"}}>
        <p style={{fontSize:10,color:"#15803D",fontWeight:600,textTransform:"uppercase",marginBottom:4}}>Payée le</p>
        <p style={{fontSize:13,fontWeight:600,color:"#15803D"}}>{fmt(view.datePaiement)}</p>
      </Card>
    )}

    {/* ── Pièces jointes ── */}
    {(view.pdfFacture || view.pdfBonLivraison) && (
      <Card style={{marginBottom:12,padding:"12px 14px"}}>
        <p style={{fontSize:10,color:"#525252",fontWeight:600,textTransform:"uppercase",letterSpacing:"0.04em",marginBottom:10}}>Pièces jointes</p>
        <div style={{display:"grid",gap:8}}>
          {view.pdfFacture && (
            <a href={view.pdfFacture} download={view.pdfFactureNom||"facture-fournisseur.pdf"}
              style={{display:"flex",alignItems:"center",gap:10,background:"#FEF9E7",border:"1px solid #FDE68A",borderRadius:10,padding:"10px 12px",textDecoration:"none",color:"#92400E"}}>
              <span style={{fontSize:20,flexShrink:0}}>📄</span>
              <div style={{flex:1,minWidth:0}}>
                <p style={{fontSize:12,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{view.pdfFactureNom||"facture-fournisseur.pdf"}</p>
                <p style={{fontSize:10,color:"#9A3412",marginTop:1}}>Facture originale · Télécharger</p>
              </div>
              <span style={{fontSize:14,flexShrink:0}}>⬇️</span>
            </a>
          )}
          {view.pdfBonLivraison && (
            <a href={view.pdfBonLivraison} download={view.pdfBonLivraisonNom||"bon-livraison.pdf"}
              style={{display:"flex",alignItems:"center",gap:10,background:"#F0FDF4",border:"1px solid #BBF7D0",borderRadius:10,padding:"10px 12px",textDecoration:"none",color:"#14532D"}}>
              <span style={{fontSize:20,flexShrink:0}}>📦</span>
              <div style={{flex:1,minWidth:0}}>
                <p style={{fontSize:12,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{view.pdfBonLivraisonNom||"bon-livraison.pdf"}</p>
                <p style={{fontSize:10,color:"#166534",marginTop:1}}>Bon de livraison · Télécharger</p>
              </div>
              <span style={{fontSize:14,flexShrink:0}}>⬇️</span>
            </a>
          )}
        </div>
      </Card>
    )}

    <button onClick={()=>supprimer(view.id)} style={{width:"100%",background:"#FEE2E2",color:"#991B1B",border:"none",borderRadius:10,padding:"10px",fontWeight:600,fontSize:12,cursor:"pointer"}}>
      🗑 Supprimer
    </button>
  </div>
);

}

return (
<div className="fade">

{/* Sub-tab navigation */}
<div style={{display:"flex",gap:6,marginBottom:16,background:"#F5F5F0",borderRadius:12,padding:4}}>
  {[{id:"contacts",l:"👤 Contacts"},{id:"factures",l:"📥 Factures"}].map(t=>(
    <button key={t.id} onClick={()=>setSubTab(t.id as any)} style={{flex:1,background:subTab===t.id?"#fff":"transparent",border:"none",borderRadius:9,padding:"8px",fontWeight:subTab===t.id?700:500,fontSize:13,color:subTab===t.id?"#111":"#737373",cursor:"pointer",boxShadow:subTab===t.id?"0 1px 4px rgba(0,0,0,.08)":"none"}}>{t.l}</button>
  ))}
</div>

{/* ── CONTACTS TAB ─────────────────────────────── */}
{subTab==="contacts" && (<>
<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
  <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,fontWeight:700}}>Fournisseurs</p>
  <Btn icon="plus" onClick={()=>{setCForm(emptyContact());setCModal("form");}}>Nouveau</Btn>
</div>

<div style={{background:"#fff",border:"1px solid #EAE7E0",borderRadius:12,padding:"10px 12px",marginBottom:12,display:"flex",alignItems:"center",gap:8}}>
  <span style={{color:"#9CA3AF",fontSize:14}}>🔍</span>
  <input value={cSearch} onChange={e=>setCSearch(e.target.value)} placeholder="Rechercher un fournisseur..." style={{border:"none",outline:"none",flex:1,fontSize:13,background:"transparent"}}/>
</div>

{cFiltered.length===0
  ? <div style={{textAlign:"center",padding:"40px 20px",color:"#9CA3AF"}}>
      <p style={{fontSize:40,marginBottom:12}}>🏭</p>
      <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,fontWeight:600,color:"#374151"}}>Aucun fournisseur</p>
      <p style={{fontSize:13,marginTop:6}}>Ajoute tes fournisseurs pour garder leurs contacts à portée.</p>
    </div>
  : cFiltered.map((f:any)=>{
      const s = getContactStats(f.nom);
      return (
        <Card key={f.id} style={{marginBottom:8,padding:"12px 14px",cursor:"pointer"}} onClick={()=>setCViewId(f.id)}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{flex:1,minWidth:0}}>
              <p style={{fontWeight:700,fontSize:14}}>{f.nom}</p>
              {f.categorie && <p style={{fontSize:11,color:"#9CA3AF",marginTop:2}}>{f.categorie}</p>}
              {f.email && <p style={{fontSize:11,color:"#6B7280",marginTop:2}}>✉️ {f.email}</p>}
            </div>
            <div style={{textAlign:"right",marginLeft:10}}>
              {s.aPayer>0 && <p style={{fontSize:11,fontWeight:700,color:"#92400E"}}>{chf(s.aPayer)} à payer</p>}
              <p style={{fontSize:11,color:"#9CA3AF",marginTop:2}}>{s.nb} facture{s.nb!==1?"s":""}</p>
            </div>
          </div>
        </Card>
      );
    })
}

{/* Modal contact */}
{cModal==="form" && (
  <Modal title={cForm.id?"Modifier fournisseur":"Nouveau fournisseur"} onClose={()=>setCModal(null)}>
    <div style={{display:"grid",gap:12}}>
      <F label="Nom / Entreprise" value={cForm.nom} onChange={(v:string)=>setCForm((p:any)=>({...p,nom:v}))} required placeholder="Ex: Migros, Karton.eu..."/>
      <Sel label="Catégorie" value={cForm.categorie} onChange={(v:string)=>setCForm((p:any)=>({...p,categorie:v}))}
        options={[{v:"",l:"— Choisir —"},...CATEGORIES_FOURNISSEURS.map(c=>({v:c,l:c}))]}/>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <F label="E-mail" value={cForm.email} onChange={(v:string)=>setCForm((p:any)=>({...p,email:v}))} placeholder="contact@exemple.com"/>
        <F label="Téléphone" value={cForm.telephone} onChange={(v:string)=>setCForm((p:any)=>({...p,telephone:v}))} placeholder="+41..."/>
      </div>
      <F label="Adresse" value={cForm.adresse} onChange={(v:string)=>setCForm((p:any)=>({...p,adresse:v}))} placeholder="Rue et numéro"/>
      <div style={{display:"grid",gridTemplateColumns:"1fr 2fr",gap:10}}>
        <F label="NPA" value={cForm.npa} onChange={(v:string)=>setCForm((p:any)=>({...p,npa:v}))} placeholder="2610"/>
        <F label="Ville" value={cForm.ville} onChange={(v:string)=>setCForm((p:any)=>({...p,ville:v}))} placeholder="Saint-Imier"/>
      </div>
      <F label="Notes" value={cForm.notes} onChange={(v:string)=>setCForm((p:any)=>({...p,notes:v}))} placeholder="Conditions, délais, remarques..."/>
    </div>
    <div style={{display:"flex",gap:10,marginTop:20}}>
      <Btn onClick={saveContact} full icon="check">Enregistrer</Btn>
      <Btn onClick={()=>setCModal(null)} variant="ghost" full>Annuler</Btn>
    </div>
  </Modal>
)}
</>)}

{/* ── FACTURES TAB ─────────────────────────────── */}
{subTab==="factures" && (<>
<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
  <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,fontWeight:700}}>Factures fournisseurs</p>
  <Btn icon="plus" onClick={()=>{setForm(empty());setModal("form");}}>Nouvelle</Btn>
</div>

  {/* Alertes */}
  {aPayer.length > 0 && (
    <div style={{background:nbEchues>0?"#FEF2F2":"#FDF6E3",border:"1px solid "+(nbEchues>0?"#FECACA":"#FCD34D"),borderRadius:12,padding:"12px 14px",marginBottom:14}}>
      <p style={{fontSize:13,fontWeight:700,color:nbEchues>0?"#B91C1C":"#9A3412"}}>
        💰 {chf(totalAPayer)} à payer{nbEchues>0?` · ${chf(echuesTotal)} en retard`:""}
      </p>
      <p style={{fontSize:11,color:nbEchues>0?"#B91C1C":"#9A3412",marginTop:2,opacity:.85}}>
        {aPayer.length} facture(s) en attente{nbEchues>0?` dont ${nbEchues} échue(s)`:""}
      </p>
    </div>
  )}

  {/* Filtres */}
  <div style={{display:"flex",gap:5,marginBottom:12,overflowX:"auto"}}>
    {[
      {id:"toutes",l:"Toutes"},
      {id:"a-payer",l:"À payer"+(aPayer.length>0?` (${aPayer.length})`:"")},
      {id:"echues",l:"Échues"+(nbEchues>0?` (${nbEchues})`:"")},
      {id:"payees",l:"Payées"},
    ].map(f=>(
      <button key={f.id} onClick={()=>setFiltre(f.id)} style={{background:filtre===f.id?"#0A0A0A":"transparent",color:filtre===f.id?"#FAFAF7":"#525252",border:filtre===f.id?"none":"1px solid #EAE7E0",borderRadius:16,padding:"5px 11px",fontSize:11,fontWeight:filtre===f.id?600:500,cursor:"pointer",whiteSpace:"nowrap",flexShrink:0}}>{f.l}</button>
    ))}
  </div>

  {filtrees.length === 0 ? (
    <div style={{textAlign:"center",padding:"40px 20px",color:"#737373"}}>
      <p style={{fontSize:40,marginBottom:12}}>📥</p>
      <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,fontWeight:600,color:"#374151"}}>Aucune facture fournisseur</p>
      <p style={{fontSize:13,marginTop:6}}>Saisis tes factures reçues pour ne plus rien oublier</p>
    </div>
  ) : filtrees.map(f=>{
    const ech = new Date(f.dateEcheance||f.date);
    const joursRestants = Math.floor((ech - new Date())/86400000);
    const echue = joursRestants < 0 && f.statut === "à payer";
    return (
      <Card key={f.id} style={{marginBottom:8,padding:"12px 14px",cursor:"pointer",borderLeft:f.statut==="payée"?"3px solid #22C55E":echue?"3px solid #B91C1C":"3px solid #E8B64C"}} onClick={()=>setViewId(f.id)}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div style={{flex:1,minWidth:0}}>
            <p style={{fontWeight:600,fontSize:13}}>{f.fournisseur}</p>
            <p style={{fontSize:11,color:"#737373",marginTop:2}}>
              {f.categorie} · {fmt(f.date)}
              {f.dateEcheance && f.statut==="à payer" && (
                <span style={{color:echue?"#B91C1C":"#525252",marginLeft:4}}>
                  · échéance {fmt(f.dateEcheance)}
                </span>
              )}
            </p>
            {f.numero && <p style={{fontSize:10,color:"#A3A3A3",marginTop:1}}>N° {f.numero}</p>}
          </div>
          <div style={{textAlign:"right",marginLeft:10}}>
            <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:18,fontWeight:700,color:echue?"#B91C1C":"#0A0A0A"}}>{chf(f.montant)}</p>
            <div style={{marginTop:4}}>
              <Badge c={f.statut==="payée"?"green":echue?"red":"yellow"}>{f.statut}</Badge>
            </div>
          </div>
        </div>
      </Card>
    );
  })}

  {/* Modal */}
  {modal==="form" && (
    <Modal title={form.id?"Modifier facture":"Nouvelle facture fournisseur"} onClose={()=>setModal(null)}>
      <div style={{display:"grid",gap:12}}>
        <F label="Fournisseur" value={form.fournisseur} onChange={v=>setForm(p=>({...p,fournisseur:v}))} required placeholder="Ex: Migros, Karton.eu..."/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <F label="N° facture" value={form.numero||""} onChange={v=>setForm(p=>({...p,numero:v}))}/>
          <F label="Montant (CHF)" type="number" value={form.montant||""} onChange={v=>setForm(p=>({...p,montant:v}))} required/>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <F label="Date facture" type="date" value={form.date} onChange={v=>setForm(p=>({...p,date:v}))}/>
          <F label="Date échéance" type="date" value={form.dateEcheance||""} onChange={v=>setForm(p=>({...p,dateEcheance:v}))} placeholder="Auto +30j"/>
        </div>
        <Sel label="Catégorie" value={form.categorie} onChange={v=>setForm(p=>({...p,categorie:v}))}
          options={CATEGORIES_FOURNISSEURS.map(c=>({v:c,l:c}))}/>
        <F label="Notes" value={form.description||""} onChange={v=>setForm(p=>({...p,description:v}))} placeholder="Précisions (optionnel)"/>

        {/* ── Pièces jointes PDF ── */}
        <div>
          <p style={{fontSize:11,color:"#525252",fontWeight:600,textTransform:"uppercase",letterSpacing:"0.04em",marginBottom:6}}>Pièces jointes</p>
          <div style={{display:"grid",gap:8}}>

            {/* Facture originale */}
            <div style={{background:"#F8F8F6",border:"1px dashed #D1D5DB",borderRadius:10,padding:"10px 12px"}}>
              <p style={{fontSize:11,color:"#374151",fontWeight:600,marginBottom:6}}>📄 Facture originale (PDF)</p>
              {form.pdfFacture ? (
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontSize:11,color:"#15803D",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>✓ {form.pdfFactureNom||"facture.pdf"}</span>
                  <button type="button" onClick={()=>setForm(p=>({...p,pdfFacture:null,pdfFactureNom:""}))}
                    style={{background:"#FEE2E2",color:"#991B1B",border:"none",borderRadius:6,padding:"3px 8px",fontSize:10,fontWeight:600,cursor:"pointer",flexShrink:0}}>
                    Supprimer
                  </button>
                </div>
              ) : (
                <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer"}}>
                  <span style={{background:"#E8B64C",color:"#111",border:"none",borderRadius:7,padding:"5px 10px",fontSize:11,fontWeight:600,cursor:"pointer",flexShrink:0}}>
                    Choisir PDF
                  </span>
                  <span style={{fontSize:11,color:"#9CA3AF"}}>Aucun fichier</span>
                  <input type="file" accept="application/pdf" style={{display:"none"}}
                    onChange={async e=>{
                      const file = e.target.files?.[0];
                      if(!file) return;
                      if(file.size > 5*1024*1024){alert("Fichier trop volumineux (max 5 Mo)");return;}
                      const b64 = await readFileAsBase64(file);
                      setForm(p=>({...p,pdfFacture:b64,pdfFactureNom:file.name}));
                    }}/>
                </label>
              )}
            </div>

            {/* Bon de livraison */}
            <div style={{background:"#F8F8F6",border:"1px dashed #D1D5DB",borderRadius:10,padding:"10px 12px"}}>
              <p style={{fontSize:11,color:"#374151",fontWeight:600,marginBottom:6}}>📦 Bon de livraison (PDF, optionnel)</p>
              {form.pdfBonLivraison ? (
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontSize:11,color:"#15803D",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>✓ {form.pdfBonLivraisonNom||"bon-livraison.pdf"}</span>
                  <button type="button" onClick={()=>setForm(p=>({...p,pdfBonLivraison:null,pdfBonLivraisonNom:""}))}
                    style={{background:"#FEE2E2",color:"#991B1B",border:"none",borderRadius:6,padding:"3px 8px",fontSize:10,fontWeight:600,cursor:"pointer",flexShrink:0}}>
                    Supprimer
                  </button>
                </div>
              ) : (
                <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer"}}>
                  <span style={{background:"#F5F5F0",color:"#374151",border:"1px solid #D1D5DB",borderRadius:7,padding:"5px 10px",fontSize:11,fontWeight:600,cursor:"pointer",flexShrink:0}}>
                    Choisir PDF
                  </span>
                  <span style={{fontSize:11,color:"#9CA3AF"}}>Aucun fichier</span>
                  <input type="file" accept="application/pdf" style={{display:"none"}}
                    onChange={async e=>{
                      const file = e.target.files?.[0];
                      if(!file) return;
                      if(file.size > 5*1024*1024){alert("Fichier trop volumineux (max 5 Mo)");return;}
                      const b64 = await readFileAsBase64(file);
                      setForm(p=>({...p,pdfBonLivraison:b64,pdfBonLivraisonNom:file.name}));
                    }}/>
                </label>
              )}
            </div>

          </div>
        </div>

      </div>
      <div style={{display:"flex",gap:10,marginTop:20}}>
        <Btn onClick={save} full icon="check">Enregistrer</Btn>
        <Btn onClick={()=>setModal(null)} variant="ghost" full>Annuler</Btn>
      </div>
    </Modal>
  )}
</>)}

</div>

);
};

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

const Offres = ({st, setSt}) => {
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
            <div key={i} style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,background:qte>0?"#F0FDF4":"#fff",border:"1.5px solid "+(qte>0?"#86EFAC":"#EAE7E0"),borderRadius:10,padding:"10px 12px"}}>
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

// ══════════════════════════════════════════════════════════════
// PAGE: PRODUCTION — Recettes, calculateur, macérations, historique
// ══════════════════════════════════════════════════════════════

const RECETTES_DEFAULT = [
  {
    id:"limonta",
    nom:"Limonta",
    description:"Liqueur de citron jaune",
    couleur:"#F2C94C",
    ingredients:[
      {nom:"Alcool pur 80°",quantite:1,unite:"L",parLitre:true},
      {nom:"Zestes de citron jaune (10-12 citrons non traités)",quantite:190,unite:"g",parLitre:true},
      {nom:"Eau filtrée",quantite:1.4,unite:"L",parLitre:true},
      {nom:"Sucre blanc",quantite:550,unite:"g",parLitre:true},
    ],
    dureeMacerationJours:15,
    rendementBouteilles:5,
    volumeBouteille:500,
    titreAlcool:30,
    notes:"Macération 15j. Agiter 1x/jour les 3 premiers jours. Sirop refroidi impérativement avant assemblage. Vieillissement 15j minimum avant commercialisation. Coût matière : ~3.20 CHF/btl.",
    statut:"fonctionnel",
    marcheASuivre:[
      "Laver soigneusement les citrons à l'eau froide. Sécher.",
      "Prélever les zestes à l'économe ou râpe fine — sans la partie blanche amère.",
      "Placer les zestes dans un grand bocal en verre stérilisé et hermétique.",
      "Verser l'alcool pur 80° sur les zestes. Fermer hermétiquement.",
      "Macérer 15 jours à température ambiante, à l'abri de la lumière.",
      "Agiter le bocal 1× par jour les 3 premiers jours, puis tous les 2–3 jours.",
      "Filtrer l'alcool coloré avec une étamine fine. Ne pas presser les zestes.",
      "Préparer le sirop : chauffer l'eau filtrée, dissoudre le sucre. Laisser refroidir complètement.",
      "Assembler l'alcool macéré avec le sirop froid. Mélanger doucement.",
      "Filtrer une seconde fois si nécessaire pour clarifier.",
      "Embouteiller, étiqueter avec le numéro de lot, fermer hermétiquement.",
      "Laisser vieillir minimum 15 jours à l'abri de la lumière avant commercialisation.",
    ],
  },
  {
    id:"limelo",
    nom:"Limelo",
    description:"Liqueur de citron vert (lime)",
    couleur:"#6DBE45",
    ingredients:[
      {nom:"Alcool pur 80°",quantite:1,unite:"L",parLitre:true},
      {nom:"Zestes de citron vert (18-22 citrons persans non traités)",quantite:165,unite:"g",parLitre:true},
      {nom:"Jus de citron vert (finition)",quantite:60,unite:"ml",parLitre:true},
      {nom:"Feuilles de combava (optionnel)",quantite:2,unite:"pcs",parLitre:true},
      {nom:"Eau filtrée",quantite:1.4,unite:"L",parLitre:true},
      {nom:"Sucre blanc",quantite:480,unite:"g",parLitre:true},
    ],
    dureeMacerationJours:15,
    rendementBouteilles:5,
    volumeBouteille:500,
    titreAlcool:30,
    notes:"Macération 15j. Ajouter feuilles de combava les 2 derniers jours. Ajouter jus citron vert à l'assemblage. Vieillissement 1 mois minimum (adoucit l'amertume). Coût : ~3.50 CHF/btl.",
    statut:"fonctionnel",
    marcheASuivre:[
      "Laver soigneusement les citrons verts à l'eau froide. Sécher.",
      "Prélever les zestes à l'économe — sans la partie blanche amère.",
      "Placer les zestes dans un grand bocal en verre stérilisé et hermétique.",
      "Verser l'alcool pur 80° sur les zestes. Fermer hermétiquement.",
      "Macérer 13 jours à température ambiante, à l'abri de la lumière.",
      "Au 13e jour : ajouter les feuilles de combava dans le bocal pour les 2 derniers jours.",
      "Agiter le bocal tous les 2–3 jours.",
      "Filtrer l'alcool avec une étamine fine. Ne pas presser les zestes.",
      "Préparer le sirop : chauffer l'eau filtrée, dissoudre le sucre. Laisser refroidir complètement.",
      "Assembler l'alcool macéré + sirop froid + jus de citron vert. Mélanger doucement.",
      "Filtrer une seconde fois pour clarifier.",
      "Embouteiller, étiqueter avec le numéro de lot. Vieillissement minimum 1 mois recommandé.",
    ],
  },
  {
    id:"clementino",
    nom:"Clementino",
    description:"Liqueur de clémentine",
    couleur:"#F97316",
    ingredients:[
      {nom:"Alcool pur 80°",quantite:1,unite:"L",parLitre:true},
      {nom:"Zestes de clémentine (22-26 clémentines Corse/Espagne)",quantite:260,unite:"g",parLitre:true},
      {nom:"Eau filtrée",quantite:1.4,unite:"L",parLitre:true},
      {nom:"Sucre blanc",quantite:600,unite:"g",parLitre:true},
    ],
    dureeMacerationJours:15,
    rendementBouteilles:5,
    volumeBouteille:500,
    titreAlcool:30,
    notes:"Macération 15j. 50% zestes purs + 50% écorces. Agiter quotidiennement les 3 premiers jours. Vieillissement 3 semaines minimum. Saison optimale : déc–janv. Coût : ~3.80 CHF/btl.",
    statut:"fonctionnel",
    marcheASuivre:[
      "Laver soigneusement les clémentines à l'eau froide. Sécher.",
      "Prélever 50% en zestes fins (économe), 50% en écorces plus épaisses (paring knife).",
      "Placer zestes et écorces dans un grand bocal en verre stérilisé et hermétique.",
      "Verser l'alcool pur 80°. Fermer hermétiquement.",
      "Macérer 15 jours à température ambiante, à l'abri de la lumière.",
      "Agiter le bocal 1× par jour les 3 premiers jours, puis tous les 2–3 jours.",
      "Filtrer l'alcool coloré avec une étamine fine. Ne pas presser les écorces.",
      "Préparer le sirop : chauffer l'eau, dissoudre le sucre. Laisser refroidir complètement.",
      "Assembler l'alcool macéré avec le sirop froid. Mélanger doucement.",
      "Filtrer une seconde fois si nécessaire.",
      "Embouteiller, étiqueter avec le numéro de lot. Repos minimum 3 semaines.",
    ],
  },
  {
    id:"pescato",
    nom:"Pescato",
    description:"Liqueur de pêche",
    couleur:"#FB923C",
    ingredients:[
      {nom:"Alcool pur 80°",quantite:1,unite:"L",parLitre:true},
      {nom:"Pêches blanches mûres (~150g/pièce)",quantite:1000,unite:"g",parLitre:true},
      {nom:"Noyaux de pêche concassés",quantite:3,unite:"pcs",parLitre:true},
      {nom:"Eau filtrée",quantite:1.4,unite:"L",parLitre:true},
      {nom:"Sucre blanc",quantite:520,unite:"g",parLitre:true},
    ],
    dureeMacerationJours:10,
    rendementBouteilles:5,
    volumeBouteille:500,
    titreAlcool:30,
    notes:"Macération 10j. Garder la peau des pêches. Concasser les noyaux au marteau (notes d'amande douce). Agiter tous les 2 jours. Presser légèrement les fruits à la filtration. Repos 1 semaine après assemblage. Coût : ~3.50 CHF/btl.",
    statut:"en création",
    marcheASuivre:[
      "Laver les pêches. Conserver la peau — elle apporte arôme et couleur.",
      "Dénoyauter et couper les pêches en quartiers (env. 150 g/pièce).",
      "Concasser les noyaux au marteau (attention : amande intérieure uniquement).",
      "Placer les quartiers de pêche et les noyaux concassés dans un bocal stérilisé.",
      "Verser l'alcool pur 80°. Fermer hermétiquement.",
      "Macérer 10 jours à température ambiante, à l'abri de la lumière.",
      "Agiter délicatement tous les 2 jours.",
      "Filtrer avec étamine. Presser légèrement les fruits pour extraire les jus.",
      "Préparer le sirop de sucre avec l'eau filtrée. Laisser refroidir complètement.",
      "Assembler l'alcool macéré et le sirop froid. Mélanger doucement.",
      "Filtrer une seconde fois pour clarifier.",
      "Embouteiller avec numéro de lot. Repos minimum 1 semaine après assemblage.",
    ],
  },
  {
    id:"fraisetta",
    nom:"Fraisetta",
    description:"Liqueur de fraise",
    couleur:"#E11D48",
    ingredients:[
      {nom:"Alcool pur 80°",quantite:1,unite:"L",parLitre:true},
      {nom:"Fraises mûres (Mara des Bois ou Gariguette)",quantite:900,unite:"g",parLitre:true},
      {nom:"Gousse de vanille",quantite:1,unite:"pcs",parLitre:true},
      {nom:"Eau filtrée",quantite:1.4,unite:"L",parLitre:true},
      {nom:"Sucre blanc",quantite:500,unite:"g",parLitre:true},
    ],
    dureeMacerationJours:10,
    rendementBouteilles:5,
    volumeBouteille:500,
    titreAlcool:30,
    notes:"Macération 10j. Agiter quotidiennement. Presser les fraises dans un linge. Repos 2 semaines minimum après assemblage. Option : +50g fraises lyophilisées en poudre pour intensifier. Coût : ~4.50 CHF/btl.",
    statut:"en création",
    marcheASuivre:[
      "Laver et équeuter délicatement les fraises. Sécher sur papier absorbant.",
      "Couper les fraises en deux ou en quartiers selon la taille.",
      "Fendre la gousse de vanille en deux et gratter les graines.",
      "Placer fraises, gousse et graines de vanille dans un bocal stérilisé.",
      "Verser l'alcool pur 80°. Fermer hermétiquement.",
      "Macérer 10 jours à température ambiante, à l'abri de la lumière.",
      "Agiter délicatement le bocal tous les jours.",
      "Filtrer avec étamine en pressant les fraises dans un linge propre.",
      "Préparer le sirop de sucre avec l'eau filtrée. Laisser refroidir complètement.",
      "Assembler l'alcool macéré + sirop froid. Mélanger doucement.",
      "Filtrer une seconde fois pour clarifier.",
      "Embouteiller avec numéro de lot. Repos minimum 2 semaines avant dégustation.",
    ],
  },
  {
    id:"lamponia",
    nom:"Lamponia",
    description:"Liqueur de framboise",
    couleur:"#BE185D",
    ingredients:[
      {nom:"Alcool pur 80°",quantite:1,unite:"L",parLitre:true},
      {nom:"Framboises (surgelées de préférence)",quantite:750,unite:"g",parLitre:true},
      {nom:"Eau filtrée",quantite:1.4,unite:"L",parLitre:true},
      {nom:"Sucre blanc",quantite:530,unite:"g",parLitre:true},
    ],
    dureeMacerationJours:10,
    rendementBouteilles:5,
    volumeBouteille:500,
    titreAlcool:30,
    notes:"Macération 10j. Framboises surgelées idéales (cellules éclatées libèrent mieux les arômes). Écraser grossièrement à la fourchette. Agiter quotidiennement. Attention aux pépins à la filtration (ne pas presser fort = amertume). Coût : ~5 CHF/btl.",
    statut:"en création",
    marcheASuivre:[
      "Utiliser des framboises surgelées de préférence (les cellules éclatées libèrent mieux les arômes).",
      "Laisser décongeler partiellement, puis écraser grossièrement à la fourchette.",
      "Placer les framboises écrasées dans un bocal en verre stérilisé.",
      "Verser l'alcool pur 80°. Fermer hermétiquement.",
      "Macérer 10 jours à température ambiante, à l'abri de la lumière.",
      "Agiter délicatement tous les jours.",
      "Filtrer avec étamine SANS presser les framboises — les pépins donnent de l'amertume.",
      "Préparer le sirop de sucre avec l'eau filtrée. Laisser refroidir complètement.",
      "Assembler l'alcool macéré + sirop froid. Mélanger doucement.",
      "Filtrer une seconde fois (papier filtre si besoin pour clarifier).",
      "Embouteiller avec numéro de lot. Repos minimum 2 semaines avant dégustation.",
    ],
  },
  {
    id:"caffetto",
    nom:"Caffetto",
    description:"Liqueur de café",
    couleur:"#78350F",
    ingredients:[
      {nom:"Alcool pur 80°",quantite:1,unite:"L",parLitre:true},
      {nom:"Café arabica fraîchement torréfié (concassé)",quantite:135,unite:"g",parLitre:true},
      {nom:"Gousse de vanille",quantite:1,unite:"pcs",parLitre:true},
      {nom:"Fève tonka râpée (optionnel)",quantite:0.25,unite:"pcs",parLitre:true},
      {nom:"Eau filtrée",quantite:1.4,unite:"L",parLitre:true},
      {nom:"Sucre roux (cassonade)",quantite:420,unite:"g",parLitre:true},
      {nom:"Sucre blanc",quantite:120,unite:"g",parLitre:true},
    ],
    dureeMacerationJours:18,
    rendementBouteilles:5,
    volumeBouteille:500,
    titreAlcool:30,
    notes:"Café arabica de spécialité, concassé grossièrement (pas en poudre). Agiter 1x/semaine. Goûter à J15, J18, J21 pour arrêter au moment optimal (15-21j). Assemblage avec sirop à 40°C (aide à dissoudre les huiles). Repos 2-3 semaines minimum. Coût : ~4 CHF/btl.",
    statut:"en création",
    marcheASuivre:[
      "Concasser grossièrement les grains de café arabica (pas en poudre — trop d'amertume).",
      "Fendre la gousse de vanille et gratter les graines. Râper la fève tonka si utilisée.",
      "Placer café, vanille et tonka dans un bocal en verre stérilisé.",
      "Verser l'alcool pur 80°. Fermer hermétiquement.",
      "Macérer 15 à 21 jours à température ambiante, à l'abri de la lumière.",
      "Agiter le bocal 1× par semaine.",
      "Goûter à J15, J18 et J21 pour arrêter à l'intensité souhaitée.",
      "Filtrer avec étamine puis papier filtre pour clarifier (les huiles de café troublent le liquide).",
      "Préparer le sirop : chauffer l'eau, dissoudre sucre roux + sucre blanc. Laisser tiédir à 40°C.",
      "Assembler l'alcool macéré + sirop à 40°C (aide à dissoudre les huiles résiduelles).",
      "Laisser refroidir complètement, filtrer une dernière fois.",
      "Embouteiller avec numéro de lot. Repos minimum 2–3 semaines avant dégustation.",
    ],
  },
];

const Production = ({st, setSt}) => {
  const prod = st.production || {recettes: RECETTES_DEFAULT, macerations:[], historique:[]};
  const setProd = (fn) => setSt(p=>{
    const next = typeof fn === "function" ? fn(p.production||{recettes:RECETTES_DEFAULT,macerations:[],historique:[]}) : fn;
    return {...p, production: next};
  });

  const [onglet, setOnglet] = useState<"planification"|"recettes"|"calculateur"|"macerations"|"historique">("planification");
  const [recetteStatutFiltre, setRecetteStatutFiltre] = useState("tous");
  const [recetteModal, setRecetteModal] = useState<null|"new"|any>(null);
  const [macerationModal, setMacerationModal] = useState<null|"new"|any>(null);
  const [batchModal, setBatchModal] = useState<null|any>(null);
  const [calcRecetteId, setCalcRecetteId] = useState(prod.recettes?.[0]?.id || "limonta");
  const [calcLitres, setCalcLitres] = useState("10");
  const [calcBtl25, setCalcBtl25] = useState(""); // vide = auto depuis litres
  const [calcBtl50, setCalcBtl50] = useState(""); // vide = auto depuis litres
  const [calcNumLot, setCalcNumLot] = useState("");

  // Merge: garder les recettes sauvegardées + ajouter les recettes par défaut manquantes
  // Si une recette sauvegardée manque de marcheASuivre, on la récupère depuis le défaut
  const savedRecettes = prod.recettes && prod.recettes.length > 0 ? prod.recettes : [];
  const savedIds = new Set(savedRecettes.map((r:any)=>r.id));
  const missingDefaults = RECETTES_DEFAULT.filter(r=>!savedIds.has(r.id));
  const recettes = [
    ...savedRecettes.map((r:any)=>{
      const def = RECETTES_DEFAULT.find((d:any)=>d.id===r.id);
      return {
        ...r,
        marcheASuivre: (r.marcheASuivre && r.marcheASuivre.length>0) ? r.marcheASuivre : (def?.marcheASuivre||[]),
        statut: r.statut || def?.statut || "en création",
      };
    }),
    ...missingDefaults,
  ];
  const macerations = prod.macerations || [];
  const historique = prod.historique || [];

  // ── RECETTE FORM ──
  const emptyRecette = () => ({id:uid(),nom:"",description:"",couleur:"#8B5CF6",ingredients:[{nom:"",quantite:0,unite:"g",parLitre:true}],dureeMacerationJours:30,rendementBouteilles:10,volumeBouteille:500,titreAlcool:30,notes:"",marcheASuivre:[],statut:"en création"});
  const [rForm, setRForm] = useState<any>(emptyRecette());
  const openRecette = (r=null) => { setRForm(r?{...r,ingredients:r.ingredients.map(i=>({...i})),marcheASuivre:r.marcheASuivre?[...r.marcheASuivre]:[],statut:r.statut||"en création"}:emptyRecette()); setRecetteModal(r||"new"); };
  const saveRecette = () => {
    if(!rForm.nom.trim()){alert("Nom de recette requis");return;}
    setProd(p=>{
      const existing = (p.recettes||[]).find(r=>r.id===rForm.id);
      const recettes = existing ? (p.recettes||[]).map(r=>r.id===rForm.id?rForm:r) : [...(p.recettes||[]),rForm];
      return {...p,recettes};
    });
    setRecetteModal(null);
  };
  const deleteRecette = (id) => {
    if(!window.confirm("Supprimer cette recette ?")) return;
    setProd(p=>({...p,recettes:(p.recettes||[]).filter(r=>r.id!==id)}));
  };

  // ── CALCULATEUR ──
  const calcRecette = recettes.find(r=>r.id===calcRecetteId) || recettes[0];
  const litres = parseFloat(calcLitres)||0;
  const calcIngredients = calcRecette ? calcRecette.ingredients.map(ing=>({
    ...ing,
    total: ing.parLitre ? ing.quantite * litres : ing.quantite,
    totalDisplay: ing.parLitre ? (ing.quantite * litres) : ing.quantite,
  })) : [];
  const bouteilles = calcRecette ? Math.floor(litres * calcRecette.rendementBouteilles) : 0;

  // ── MACERATION FORM ──
  const emptyMaceration = () => ({id:uid(),recetteId:recettes[0]?.id||"",litresAlcool:"",dateDebut:today(),statut:"en_cours",notes:""});
  const [mForm, setMForm] = useState<any>(emptyMaceration());
  const openMaceration = (m=null) => { setMForm(m?{...m}:emptyMaceration()); setMacerationModal(m||"new"); };
  const saveMaceration = () => {
    if(!mForm.litresAlcool||!mForm.recetteId){alert("Recette et quantité requises");return;}
    setProd(p=>{
      const existing = (p.macerations||[]).find(m=>m.id===mForm.id);
      const macerations = existing ? (p.macerations||[]).map(m=>m.id===mForm.id?mForm:m) : [...(p.macerations||[]),mForm];
      return {...p,macerations};
    });
    setMacerationModal(null);
  };
  const terminerMaceration = (mac) => {
    const recette = recettes.find(r=>r.id===mac.recetteId);
    const litres = parseFloat(mac.litresAlcool)||0;
    const bouteilles = recette ? Math.floor(litres * recette.rendementBouteilles) : 0;
    const batch = {
      id:uid(),
      recetteId:mac.recetteId,
      recetteNom:recette?.nom||"",
      litresAlcool:litres,
      bouteilles,
      dateDebut:mac.dateDebut,
      dateFin:today(),
      notes:mac.notes||"",
    };
    setProd(p=>({
      ...p,
      macerations:(p.macerations||[]).filter(m=>m.id!==mac.id),
      historique:[batch,...(p.historique||[])],
    }));
  };
  const supprimerMaceration = (id) => {
    if(!window.confirm("Supprimer cette macération ?")) return;
    setProd(p=>({...p,macerations:(p.macerations||[]).filter(m=>m.id!==id)}));
  };

  // ── DATE PRÊTE ──
  const datePreteStr = (dateDebut, jours) => {
    try {
      const d = new Date(dateDebut);
      d.setDate(d.getDate()+jours);
      return d.toLocaleDateString("fr-CH",{day:"2-digit",month:"2-digit",year:"numeric"});
    } catch(e){ return "?"; }
  };
  const joursRestants = (dateDebut, jours) => {
    try {
      const fin = new Date(dateDebut);
      fin.setDate(fin.getDate()+jours);
      const diff = Math.ceil((fin.getTime()-Date.now())/(1000*60*60*24));
      return diff;
    } catch(e){ return 0; }
  };

  const COULEURS = ["#F2C94C","#6DBE45","#F97316","#8B5CF6","#EC4899","#14B8A6","#3B82F6","#EF4444"];

  const cardStyle:any = {background:"#fff",borderRadius:14,padding:16,marginBottom:12,border:"1px solid #EAE7E0",boxShadow:"0 1px 4px rgba(0,0,0,.04)"};
  const btnPrimary:any = {background:"#0A0A0A",color:"#F2C94C",border:"none",borderRadius:9,padding:"10px 18px",fontWeight:700,fontSize:13,cursor:"pointer"};
  const btnSecondary:any = {background:"#F4F4F2",color:"#374151",border:"none",borderRadius:9,padding:"9px 14px",fontWeight:500,fontSize:12,cursor:"pointer"};
  const btnDanger:any = {background:"#FEF2F2",color:"#B91C1C",border:"none",borderRadius:9,padding:"9px 14px",fontWeight:500,fontSize:12,cursor:"pointer"};
  const inputStyle:any = {width:"100%",border:"1px solid #EAE7E0",borderRadius:8,padding:"9px 11px",fontSize:13,fontFamily:"inherit",background:"#FAFAF7",boxSizing:"border-box"};
  const labelStyle:any = {fontSize:11,fontWeight:600,color:"#737373",textTransform:"uppercase",letterSpacing:"0.05em",display:"block",marginBottom:4};

  const tabs = [
    {id:"planification",l:"📊 Planif."},
    {id:"recettes",l:"📖 Recettes"},
    {id:"calculateur",l:"🧮 Calcul"},
    {id:"macerations",l:"🫙 Macér."},
    {id:"historique",l:"📦 Histor."},
  ];

  // ── LOGIQUE PLANIFICATION ──
  const produits = st.produits || [];
  const prodActifs = produits.filter((p:any) => p.actif && !p.nom.includes("Coffret") && !p.format?.includes("×"));

  // Ventes par produit sur 90 derniers jours (commandes livrées)
  const maintenant = Date.now();
  const debut90j = new Date(maintenant - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0,10);
  const cmdLivrees = (st.commandes||[]).filter((c:any) => (c.statut==="livrée"||c.statut==="retirée") && (c.date||"")>=debut90j);
  const ventesQteParProd:{[id:string]:number} = {};
  cmdLivrees.forEach((c:any) => {
    (c.lignes||[]).forEach((l:any) => {
      if(l.produitId) ventesQteParProd[l.produitId] = (ventesQteParProd[l.produitId]||0) + (l.qte||0);
    });
  });
  // Si aucune commande livrée : fallback sur transactions
  const hasVentesData = Object.keys(ventesQteParProd).length > 0;
  if(!hasVentesData) {
    const txRecentes = (st.transactions||[]).filter((t:any)=>t.type==="recette" && t.categorie?.startsWith("Vente ") && (t.date||"")>=debut90j);
    txRecentes.forEach((t:any) => {
      const nomLiqueur = (t.categorie||"").replace("Vente ","").toLowerCase();
      const montant = parseFloat(t.montant)||0;
      prodActifs.forEach((p:any)=>{
        const match = p.nom.toLowerCase()===nomLiqueur || p.nom.toLowerCase().includes(nomLiqueur) || nomLiqueur.includes(p.nom.toLowerCase());
        if(match && montant>0) {
          const px = parseFloat(p.prixClient||p.prixRevendeur)||0;
          const qteEstimee = px>0 ? Math.round(montant/px) : 0;
          if(qteEstimee>0) ventesQteParProd[p.id] = (ventesQteParProd[p.id]||0) + qteEstimee;
        }
      });
    });
  }
  // Ventes hebdo moyennes sur 13 semaines
  const ventesHebdo = (id:string) => (ventesQteParProd[id]||0) / 13;

  // Stock effectif par produit (propre + dépôt net)
  const stockEffectif = (id:string) => {
    const propre = sum((st.stocks||[]).filter((s:any)=>s.produitId===id).map((s:any)=>s.qte));
    const depot = sum((st.depotStocks||[]).filter((d:any)=>d.produitId===id).map((d:any)=>(d.qteDeposee||0)-(d.qteVendue||0)-(d.qteRetournee||0)));
    return propre + Math.max(0,depot);
  };

  // Commandes en cours (à livrer)
  const cmdEnCours = (st.commandes||[]).filter((c:any)=>c.statut==="en cours"||c.statut==="confirmée"||c.statut==="nouvelle"||c.statut==="préparée");
  const cmdEnCoursParProd:{[id:string]:number} = {};
  cmdEnCours.forEach((c:any)=>{
    (c.lignes||[]).forEach((l:any)=>{
      if(l.produitId) cmdEnCoursParProd[l.produitId] = (cmdEnCoursParProd[l.produitId]||0)+(l.qte||0);
    });
  });

  // Groupes de liqueurs — on regroupe par nom de liqueur en croisant recettes et produits
  const nomGroupes:string[] = [];
  recettes.forEach((r:any)=>{
    // cherche si au moins un produit actif correspond à cette recette
    const match = prodActifs.find((p:any)=>
      p.nom.toLowerCase()===r.nom.toLowerCase() ||
      p.nom.toLowerCase().includes(r.nom.toLowerCase()) ||
      r.nom.toLowerCase().includes(p.nom.toLowerCase())
    );
    if(match && !nomGroupes.includes(match.nom)) nomGroupes.push(match.nom);
  });
  // ajoute les produits actifs sans recette correspondante
  prodActifs.forEach((p:any)=>{
    const hasGroup = nomGroupes.some(n=>n===p.nom);
    if(!hasGroup && !nomGroupes.includes(p.nom)) nomGroupes.push(p.nom);
  });

  const semCible = 8;  // 8 semaines de stock cible
  const marge = 1.20; // 20% de marge de sécurité

  const analyses = nomGroupes.map(nom=>{
    const prods = prodActifs.filter((p:any)=>p.nom===nom);
    const p25 = prods.find((p:any)=>p.format?.includes("25")||p.format?.includes("250"));
    const p50 = prods.find((p:any)=>p.format?.includes("50")||p.format?.includes("500")) || (p25 ? undefined : prods[0]);
    const recette = recettes.find((r:any)=>r.nom.toLowerCase()===nom.toLowerCase() || nom.toLowerCase().includes(r.nom.toLowerCase()) || r.nom.toLowerCase().includes(nom.toLowerCase()));
    const couleur = recette?.couleur || "#F2C94C";

    // Stocks actuels
    const stock25 = p25 ? stockEffectif(p25.id) : 0;
    const stock50 = p50 ? stockEffectif(p50.id) : 0;
    // Commandes en cours à déduire
    const cmd25 = p25 ? (cmdEnCoursParProd[p25.id]||0) : 0;
    const cmd50 = p50 ? (cmdEnCoursParProd[p50.id]||0) : 0;
    // Stock net disponible (après commandes à livrer)
    const stockNet25 = Math.max(0, stock25 - cmd25);
    const stockNet50 = Math.max(0, stock50 - cmd50);

    // Ventes hebdo par format
    const hebdo25 = p25 ? ventesHebdo(p25.id) : 0;
    const hebdo50 = p50 ? ventesHebdo(p50.id) : 0;

    // Semaines de stock restantes par format (indépendantes)
    const sem25 = hebdo25 > 0 ? stockNet25 / hebdo25 : (stockNet25 > 0 ? 99 : 0);
    const sem50 = hebdo50 > 0 ? stockNet50 / hebdo50 : (stockNet50 > 0 ? 99 : 0);
    // Semaines restantes globales = minimum des deux formats présents
    const formatsPresents = [p25?sem25:null, p50?sem50:null].filter(x=>x!==null) as number[];
    const semainesRestantes = formatsPresents.length > 0 ? Math.min(...formatsPresents) : 0;

    // Niveau d'alerte basé sur le format le plus critique
    const alerte = semainesRestantes < 4 ? "rouge" : semainesRestantes < 6 ? "orange" : "vert";

    // ── STOCK PARFAIT : cible par format indépendante ──
    // Cible = (ventes hebdo × semaines cible × marge) - stock net actuel
    const cible25 = Math.ceil(hebdo25 * semCible * marge);
    const cible50 = Math.ceil(hebdo50 * semCible * marge);
    // Si pas d'historique de ventes : stock minimal de départ (20 × 250ml + 20 × 500ml)
    const aproduire25 = p25 ? Math.max(0, (hebdo25 > 0 ? cible25 : 20) - stockNet25) : 0;
    const aproduire50 = p50 ? Math.max(0, (hebdo50 > 0 ? cible50 : 20) - stockNet50) : 0;

    // Volume total à produire en litres
    const aproduireVol = (aproduire25 * 0.25) + (aproduire50 * 0.5);

    // Litres d'alcool nécessaires (rendement = btl 500ml par litre d'alcool)
    const rendement = recette?.rendementBouteilles || 5;
    // 1 L alcool → rendement × 0.5L = rendement/2 litres de produit fini
    const litresAlcoolNecessaires = aproduireVol > 0 ? aproduireVol / (rendement * 0.5) : 0;

    const dureeMac = recette?.dureeMacerationJours || 15;

    return {
      nom, couleur, p25, p50, recette,
      stock25, stock50, stockNet25, stockNet50,
      hebdo25, hebdo50,
      sem25, sem50, semainesRestantes, alerte,
      cible25, cible50, aproduire25, aproduire50, aproduireVol,
      litresAlcoolNecessaires, dureeMac,
      cmd25, cmd50,
    };
  });

  const alertesUrgentes = analyses.filter(a=>a.alerte==="rouge");
  const alertesAttention = analyses.filter(a=>a.alerte==="orange");

  // Matières premières totales à commander
  const mpNecessaires:{[nom:string]:{quantite:number,unite:string}} = {};
  analyses.filter(a=>a.aproduireVol>0).forEach(a=>{
    if(!a.recette) return;
    a.recette.ingredients.forEach((ing:any)=>{
      const qte = ing.parLitre ? ing.quantite * a.litresAlcoolNecessaires : ing.quantite;
      if(!mpNecessaires[ing.nom]) mpNecessaires[ing.nom] = {quantite:0, unite:ing.unite};
      mpNecessaires[ing.nom].quantite += qte;
    });
  });

  return (
  <div style={{maxWidth:700,margin:"0 auto",paddingBottom:40}}>
    <SectionTitle>🏭 Production</SectionTitle>

    {/* Tabs */}
    <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:4,marginBottom:16}}>
      {tabs.map(t=>(
        <button key={t.id} onClick={()=>setOnglet(t.id as any)} style={{
          background:onglet===t.id?"#0A0A0A":"#fff",
          color:onglet===t.id?"#F2C94C":"#525252",
          border:onglet===t.id?"none":"1px solid #EAE7E0",
          borderRadius:8,padding:"6px 2px",fontSize:10,fontWeight:onglet===t.id?700:500,
          cursor:"pointer",whiteSpace:"nowrap",textAlign:"center",lineHeight:1.3,
        }}>{t.l}</button>
      ))}
    </div>

    {/* ── PLANIFICATION ── */}
    {onglet==="planification" && (
    <div>
      {/* Résumé alertes */}
      {alertesUrgentes.length>0 && (
        <div style={{background:"#FEF2F2",border:"1.5px solid #FECACA",borderRadius:12,padding:"12px 16px",marginBottom:12,display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:22}}>🔴</span>
          <div>
            <p style={{fontWeight:700,fontSize:14,color:"#B91C1C"}}>Production urgente requise</p>
            <p style={{fontSize:12,color:"#991B1B"}}>{alertesUrgentes.map(a=>a.nom).join(", ")} — stock critique</p>
          </div>
        </div>
      )}
      {alertesAttention.length>0 && (
        <div style={{background:"#FFFBEB",border:"1.5px solid #FDE68A",borderRadius:12,padding:"12px 16px",marginBottom:12,display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:22}}>🟡</span>
          <div>
            <p style={{fontWeight:700,fontSize:14,color:"#92400E"}}>Stock à surveiller</p>
            <p style={{fontSize:12,color:"#78350F"}}>{alertesAttention.map(a=>a.nom).join(", ")} — prévoir la production dans les prochaines semaines</p>
          </div>
        </div>
      )}
      {alertesUrgentes.length===0 && alertesAttention.length===0 && (
        <div style={{background:"#F0FDF4",border:"1.5px solid #BBF7D0",borderRadius:12,padding:"12px 16px",marginBottom:12,display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:22}}>🟢</span>
          <p style={{fontWeight:600,fontSize:13,color:"#15803D"}}>Stocks suffisants — aucune production urgente nécessaire</p>
        </div>
      )}

      {/* Analyse par liqueur */}
      <p style={{fontSize:11,fontWeight:700,color:"#9CA3AF",textTransform:"uppercase",letterSpacing:".06em",marginBottom:8}}>État par liqueur</p>
      {analyses.map(a=>{
        const sem = a.semainesRestantes;
        const semAff = sem>=99 ? "∞" : sem.toFixed(1);
        const alertBorder = a.alerte==="rouge"?"#FECACA":a.alerte==="orange"?"#FDE68A":"#BBF7D0";
        const alertEmoji = a.alerte==="rouge"?"🔴":a.alerte==="orange"?"🟡":"🟢";
        const besoins = a.aproduire25 + a.aproduire50;
        const colorAlerte = a.alerte==="rouge"?"#B91C1C":a.alerte==="orange"?"#92400E":"#15803D";

        const FormatCard = ({label, stockNet, cible, aproduire, hebdo, cmd, sem: semF}:{label:string,stockNet:number,cible:number,aproduire:number,hebdo:number,cmd:number,sem:number}) => {
          const pct = cible > 0 ? Math.min(100, (stockNet/cible)*100) : 100;
          const fAlerte = semF < 4 ? "rouge" : semF < 6 ? "orange" : "vert";
          const fColor = fAlerte==="rouge"?"#EF4444":fAlerte==="orange"?"#F59E0B":"#22C55E";
          const fBg = fAlerte==="rouge"?"#FEF2F2":fAlerte==="orange"?"#FFFBEB":"#F0FDF4";
          return (
            <div style={{background:fBg,borderRadius:10,padding:"10px 12px",border:`1px solid ${fAlerte==="rouge"?"#FECACA":fAlerte==="orange"?"#FDE68A":"#BBF7D0"}`}}>
              <p style={{fontSize:10,fontWeight:700,color:"#6B7280",textTransform:"uppercase",letterSpacing:".05em",marginBottom:4}}>{label}</p>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:6}}>
                <span style={{fontSize:22,fontWeight:800,color:"#0A0A0A"}}>{stockNet}</span>
                <span style={{fontSize:11,color:"#9CA3AF"}}>/ {cible} btl cible</span>
              </div>
              {/* Barre de remplissage */}
              <div style={{background:"#E5E7EB",borderRadius:4,height:6,overflow:"hidden",marginBottom:6}}>
                <div style={{height:"100%",borderRadius:4,background:fColor,width:`${pct}%`,transition:"width .4s"}}/>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontSize:10,color:"#9CA3AF"}}>{hebdo>0?`${hebdo.toFixed(1)} btl/sem.`:"Pas de données"}</span>
                {cmd>0&&<span style={{fontSize:10,color:"#F59E0B",fontWeight:600}}>⚠ {cmd} en cmd</span>}
              </div>
              {aproduire > 0 && (
                <div style={{marginTop:6,background:"#0A0A0A",borderRadius:6,padding:"5px 10px",display:"inline-flex",alignItems:"center",gap:6}}>
                  <span style={{fontSize:12,fontWeight:800,color:"#F2C94C"}}>+ {aproduire} à produire</span>
                </div>
              )}
            </div>
          );
        };

        return (
        <div key={a.nom} style={{background:"#fff",borderRadius:14,border:`1.5px solid ${alertBorder}`,padding:14,marginBottom:10,borderLeft:`5px solid ${a.couleur}`}}>
          {/* En-tête */}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontSize:18}}>{alertEmoji}</span>
              <div>
                <p style={{fontWeight:700,fontSize:16,color:"#0A0A0A",lineHeight:1.1}}>{a.nom}</p>
                <p style={{fontSize:10,color:"#9CA3AF"}}>{a.dureeMac}j macération</p>
              </div>
            </div>
            <div style={{textAlign:"right"}}>
              <p style={{fontSize:10,color:"#9CA3AF"}}>Stock restant</p>
              <p style={{fontSize:20,fontWeight:800,color:colorAlerte}}>{semAff} sem.</p>
            </div>
          </div>

          {/* Cartes stock par format */}
          <div style={{display:"grid",gridTemplateColumns:a.p25&&a.p50?"1fr 1fr":"1fr",gap:8,marginBottom:10}}>
            {a.p25 && <FormatCard label="250 ml" stockNet={a.stockNet25} cible={a.cible25||20} aproduire={a.aproduire25} hebdo={a.hebdo25} cmd={a.cmd25} sem={a.sem25}/>}
            {a.p50 && <FormatCard label="500 ml" stockNet={a.stockNet50} cible={a.cible50||20} aproduire={a.aproduire50} hebdo={a.hebdo50} cmd={a.cmd50} sem={a.sem50}/>}
          </div>

          {/* Recommandation production */}
          {besoins > 0 ? (
            <div style={{background:"#0A0A0A",borderRadius:10,padding:"10px 12px"}}>
              <p style={{fontSize:10,fontWeight:700,color:"#9CA3AF",marginBottom:6,textTransform:"uppercase",letterSpacing:".05em"}}>🏭 Production recommandée — objectif {semCible} semaines</p>
              <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:8}}>
                {a.p25&&a.aproduire25>0&&<span style={{background:"#F2C94C",color:"#0A0A0A",fontSize:14,fontWeight:800,padding:"5px 14px",borderRadius:8}}>{a.aproduire25} × 250ml</span>}
                {a.p50&&a.aproduire50>0&&<span style={{background:"#F2C94C",color:"#0A0A0A",fontSize:14,fontWeight:800,padding:"5px 14px",borderRadius:8}}>{a.aproduire50} × 500ml</span>}
              </div>
              <p style={{fontSize:11,color:"#9CA3AF",marginBottom:4}}>
                ≈ <strong style={{color:"#F2C94C"}}>{a.litresAlcoolNecessaires.toFixed(1)} L d'alcool</strong> à mettre en macération · <strong style={{color:"#F2C94C"}}>{a.dureeMac}j</strong>
              </p>
              {a.alerte==="rouge" && <p style={{fontSize:11,color:"#EF4444",fontWeight:700}}>⚡ Macération à démarrer immédiatement !</p>}
              <button style={{marginTop:8,background:"#F2C94C",color:"#0A0A0A",border:"none",borderRadius:7,padding:"7px 14px",fontSize:11,fontWeight:700,cursor:"pointer"}} onClick={()=>{
                if(a.recette){setCalcRecetteId(a.recette.id);setCalcLitres(a.litresAlcoolNecessaires.toFixed(1));setOnglet("calculateur");}
              }}>🧮 Ouvrir le calculateur</button>
            </div>
          ) : (
            <p style={{fontSize:12,color:"#15803D",fontWeight:600,background:"#F0FDF4",padding:"8px 12px",borderRadius:8}}>✅ Stock parfait — aucune production nécessaire</p>
          )}
        </div>
        );
      })}

      {/* Section commande matières premières */}
      {Object.keys(mpNecessaires).length > 0 && (
        <div style={{marginTop:16}}>
          <p style={{fontSize:11,fontWeight:700,color:"#9CA3AF",textTransform:"uppercase",letterSpacing:".06em",marginBottom:8}}>🛒 Matières premières à commander</p>
          <div style={{background:"#0A0A0A",borderRadius:14,padding:16}}>
            <p style={{fontSize:11,color:"#9CA3AF",marginBottom:12}}>
              Basé sur les productions recommandées ci-dessus. Commander maintenant pour démarrer la macération dès réception.
            </p>
            {Object.entries(mpNecessaires).map(([nom, mp]:{[k:string]:any},i)=>{
              const q = mp.quantite;
              const affiche = mp.unite==="g" && q>=1000 ? `${(q/1000).toFixed(2)} kg` : mp.unite==="L" ? `${q.toFixed(1)} L` : `${Math.ceil(q)} ${mp.unite}`;
              return (
                <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:i<Object.keys(mpNecessaires).length-1?"1px solid #1F2937":"none"}}>
                  <span style={{fontSize:13,color:"#D1D5DB"}}>{nom}</span>
                  <span style={{fontSize:16,fontWeight:800,color:"#F2C94C"}}>{affiche}</span>
                </div>
              );
            })}
            <div style={{marginTop:12,padding:"10px 0 0",borderTop:"1px solid #374151"}}>
              <p style={{fontSize:11,color:"#6B7280"}}>💡 Prévoir le délai de livraison de tes fournisseurs avant de démarrer la macération.</p>
            </div>
          </div>
        </div>
      )}

      {/* Info source données */}
      <div style={{marginTop:14,padding:"10px 12px",background:"#F8F8F6",borderRadius:8,border:"1px solid #EAE7E0"}}>
        <p style={{fontSize:10,color:"#9CA3AF"}}>
          📊 Calculs basés sur : {hasVentesData ? "commandes livrées" : "transactions comptables"} des 90 derniers jours · Objectif : {semCible} semaines de stock · Marge : 20%
        </p>
      </div>
    </div>
    )}

    {/* ── RECETTES ── */}
    {onglet==="recettes" && (
    <div>
      {(() => {
        const statutCfg:{[k:string]:{bg:string,color:string,label:string}} = {
          "fonctionnel":      {bg:"#DCFCE7",color:"#15803D",label:"✅ Fonctionnel"},
          "en création":      {bg:"#FEF9C3",color:"#854D0E",label:"🔧 En création"},
          "plus d'actualité": {bg:"#F3F4F6",color:"#6B7280",label:"🗄 Archivé"},
        };
        const statutOptions = ["tous","fonctionnel","en création","plus d'actualité"];
        const recettesFiltrees = recettes.filter((r:any)=>
          recetteStatutFiltre==="tous" || (r.statut||"en création")===recetteStatutFiltre
        );
        return null;
      })()}
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:12,alignItems:"center"}}>
        {(["tous","fonctionnel","en création","plus d'actualité"] as const).map(s=>{
          const lbl = s==="tous"?"Toutes":s==="fonctionnel"?"✅ Fonctionnel":s==="en création"?"🔧 En création":"🗄 Archivé";
          return (
            <button key={s} onClick={()=>setRecetteStatutFiltre(s)}
              style={{background:recetteStatutFiltre===s?"#0A0A0A":"#F4F4F2",color:recetteStatutFiltre===s?"#fff":"#525252",border:"none",borderRadius:8,padding:"5px 10px",fontSize:10.5,fontWeight:recetteStatutFiltre===s?700:500,cursor:"pointer"}}>
              {lbl}
            </button>
          );
        })}
        <button style={{...btnPrimary,marginLeft:"auto"}} onClick={()=>openRecette()}>+ Nouvelle</button>
      </div>
      {(() => {
        const statutCfg:{[k:string]:{bg:string,color:string,label:string}} = {
          "fonctionnel":      {bg:"#DCFCE7",color:"#15803D",label:"✅ Fonctionnel"},
          "en création":      {bg:"#FEF9C3",color:"#854D0E",label:"🔧 En création"},
          "plus d'actualité": {bg:"#F3F4F6",color:"#6B7280",label:"🗄 Archivé"},
        };
        const recettesFiltrees = recettes.filter((r:any)=>
          recetteStatutFiltre==="tous" || (r.statut||"en création")===recetteStatutFiltre
        );
        return (<>
          {recettesFiltrees.length===0 && <p style={{color:"#9CA3AF",textAlign:"center",padding:24}}>Aucune recette dans cette catégorie.</p>}
          {recettesFiltrees.map((r:any)=>{
            const sc = statutCfg[r.statut||"en création"] || statutCfg["en création"];
            return (
            <div key={r.id} style={{...cardStyle,borderLeft:`4px solid ${r.couleur||"#F2C94C"}`}}>
              <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:8}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:2}}>
                    <p style={{fontWeight:700,fontSize:16,color:"#0A0A0A"}}>{r.nom}</p>
                    <span style={{background:sc.bg,color:sc.color,fontSize:10,fontWeight:700,padding:"2px 7px",borderRadius:20,whiteSpace:"nowrap"}}>{sc.label}</span>
                  </div>
                  <p style={{fontSize:12,color:"#737373",marginBottom:8}}>{r.description}</p>
                </div>
                <div style={{display:"flex",gap:6,flexShrink:0}}>
                  <button style={btnSecondary} onClick={()=>openRecette(r)}>Modifier</button>
                  <button style={btnDanger} onClick={()=>deleteRecette(r.id)}>✕</button>
                </div>
              </div>
              <div style={{background:"#FAFAF7",borderRadius:8,padding:"10px 12px",marginBottom:8}}>
                <p style={{fontSize:10,fontWeight:700,color:"#9CA3AF",textTransform:"uppercase",letterSpacing:".05em",marginBottom:6}}>Ingrédients (base 1 L alcool)</p>
                {r.ingredients.map((ing:any,i:number)=>(
                  <div key={i} style={{display:"flex",justifyContent:"space-between",fontSize:12,color:"#374151",marginBottom:3}}>
                    <span>{ing.nom}</span>
                    <span style={{fontWeight:600}}>{ing.parLitre?`${ing.quantite} ${ing.unite}/L`:`${ing.quantite} ${ing.unite}`}</span>
                  </div>
                ))}
              </div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                <span style={{background:"#F0FDF4",color:"#15803D",fontSize:11,fontWeight:600,padding:"3px 8px",borderRadius:6}}>⏱ {r.dureeMacerationJours}j de macération</span>
                <span style={{background:"#EFF6FF",color:"#1D4ED8",fontSize:11,fontWeight:600,padding:"3px 8px",borderRadius:6}}>🍾 {r.rendementBouteilles} btl·500ml / L alcool</span>
              </div>
              {r.notes&&<p style={{fontSize:11,color:"#737373",marginTop:8,fontStyle:"italic"}}>💬 {r.notes}</p>}
            </div>
          );})}
        </>);
      })()}
    </div>
    )}

    {/* ── CALCULATEUR ── */}
    {onglet==="calculateur" && (
    <div>
      {calcRecette && (() => {
        const rendement = calcRecette.rendementBouteilles || 5;
        const volBtl = (calcRecette.volumeBouteille || 500) / 1000;
        const anaRecette = analyses.find((a:any)=>a.recette?.id===calcRecette.id);

        // Ratio volume 250ml/500ml depuis planification ou 40/60 par défaut
        const ratio25 = anaRecette && (anaRecette.aproduire25+anaRecette.aproduire50)>0
          ? anaRecette.aproduire25/(anaRecette.aproduire25+anaRecette.aproduire50) : 0.4;

        // Litres entrés par l'utilisateur (entrée principale)
        const litresInput = parseFloat(calcLitres)||0;

        // Volume total de liqueur : rendement exprimé en btl 500ml/L → L/L = rendement × volBtl
        const volTotalLiqueur = litresInput * rendement * volBtl;

        // Répartition auto par VOLUME (pas par nombre de bouteilles)
        const volFor25 = volTotalLiqueur * ratio25;
        const volFor50 = volTotalLiqueur * (1 - ratio25);
        const auto25 = Math.floor(volFor25 / 0.25);
        const auto50 = Math.floor(volFor50 / 0.5);
        const btlTotalAuto = auto25 + auto50;

        // Override bouteilles si l'utilisateur a ajusté
        const btlOverride = calcBtl25 !== "" || calcBtl50 !== "";
        const eff25 = calcBtl25 !== "" ? (parseInt(calcBtl25)||0) : auto25;
        const eff50 = calcBtl50 !== "" ? (parseInt(calcBtl50)||0) : auto50;

        // Litres effectifs : depuis l'input OU recalculé depuis les bouteilles ajustées
        const litresEff = btlOverride
          ? ((eff25*0.25)+(eff50*0.5)) / (rendement * volBtl)
          : litresInput;

        const btlTotal = eff25 + eff50;
        // Volume final : exact depuis input ou recalculé depuis bouteilles ajustées
        const volLiqueur = btlOverride ? (eff25*0.25)+(eff50*0.5) : volTotalLiqueur;

        const affQte = (val:number, unite:string) => {
          if(unite==="g" && val>=1000) return `${(val/1000).toFixed(2)} kg`;
          if(unite==="L") return `${val.toFixed(1)} L`;
          if(unite==="ml") return `${val.toFixed(0)} ml`;
          return `${val%1===0?val:val.toFixed(1)} ${unite}`;
        };

        return (
          <>
          {/* Carte 1 : Recette + Litres d'alcool (entrée principale) */}
          <div style={{...cardStyle,background:"#0A0A0A"}}>
            <p style={{fontSize:11,fontWeight:700,color:"#E8B64C",textTransform:"uppercase",letterSpacing:".06em",marginBottom:12}}>🧮 Calculateur de batch</p>

            {/* Recette */}
            <div style={{marginBottom:12}}>
              <label style={{...labelStyle,color:"#9CA3AF"}}>Recette</label>
              <select value={calcRecetteId}
                onChange={e=>{setCalcRecetteId(e.target.value);setCalcBtl25("");setCalcBtl50("");setCalcLitres("10");}}
                style={{...inputStyle,background:"#1A1A1A",color:"#fff",border:"1px solid #374151"}}>
                {recettes.map((r:any)=><option key={r.id} value={r.id}>{r.nom} — {r.description}</option>)}
              </select>
            </div>

            {/* Litres d'alcool : entrée principale */}
            <label style={{...labelStyle,color:"#F2C94C",fontSize:12}}>Litres d'alcool pur 80° à mettre en macération</label>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
              <input
                type="number" min="0" step="0.5" value={calcLitres}
                onChange={e=>{setCalcLitres(e.target.value);setCalcBtl25("");setCalcBtl50("");}}
                style={{...inputStyle,background:"#1A1A1A",color:"#F2C94C",border:"2px solid #F2C94C",fontWeight:900,fontSize:28,textAlign:"center",padding:"10px",borderRadius:10,width:110}}
              />
              <div>
                <p style={{fontSize:12,color:"#9CA3AF"}}>→ <strong style={{color:"#F2C94C"}}>{btlTotal} bouteilles</strong> estimées</p>
                <p style={{fontSize:11,color:"#6B7280"}}>{calcRecette.dureeMacerationJours}j macération · {calcRecette.titreAlcool}°</p>
              </div>
            </div>

            {/* Ajustement bouteilles par format */}
            <div style={{background:"#1A1A1A",borderRadius:10,padding:"12px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                <p style={{fontSize:10,fontWeight:700,color:"#9CA3AF",textTransform:"uppercase",letterSpacing:".05em"}}>
                  Ajuster la répartition des bouteilles
                </p>
                {btlOverride && (
                  <button onClick={()=>{setCalcBtl25("");setCalcBtl50("");}}
                    style={{background:"none",border:"1px solid #374151",color:"#9CA3AF",borderRadius:6,padding:"3px 8px",fontSize:10,cursor:"pointer"}}>
                    ↺ Auto
                  </button>
                )}
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                <div style={{textAlign:"center"}}>
                  <label style={{...labelStyle,color:"#60A5FA",textAlign:"center"}}>× 250 ml</label>
                  <input type="number" min="0" step="1"
                    value={calcBtl25 !== "" ? calcBtl25 : String(auto25)}
                    onChange={e=>setCalcBtl25(e.target.value)}
                    style={{...inputStyle,background:"#0A0A0A",color:"#60A5FA",border:"2px solid #60A5FA",fontWeight:800,fontSize:20,textAlign:"center",padding:"8px",borderRadius:8}}
                  />
                  {anaRecette?.stockNet25>0&&<p style={{fontSize:10,color:"#6B7280",marginTop:3}}>Stock : {anaRecette.stockNet25} btl</p>}
                </div>
                <div style={{textAlign:"center"}}>
                  <label style={{...labelStyle,color:"#6DBE45",textAlign:"center"}}>× 500 ml</label>
                  <input type="number" min="0" step="1"
                    value={calcBtl50 !== "" ? calcBtl50 : String(auto50)}
                    onChange={e=>setCalcBtl50(e.target.value)}
                    style={{...inputStyle,background:"#0A0A0A",color:"#6DBE45",border:"2px solid #6DBE45",fontWeight:800,fontSize:20,textAlign:"center",padding:"8px",borderRadius:8}}
                  />
                  {anaRecette?.stockNet50>0&&<p style={{fontSize:10,color:"#6B7280",marginTop:3}}>Stock : {anaRecette.stockNet50} btl</p>}
                </div>
              </div>
              {btlOverride && (
                <p style={{fontSize:10,color:"#F2C94C",marginTop:8,textAlign:"center"}}>
                  ≈ {litresEff.toFixed(1)} L d'alcool nécessaires pour cette répartition
                </p>
              )}
            </div>
          </div>

          {litresEff > 0 && (
          <>
          {/* Carte 2 : Ingrédients calculés */}
          <div style={{...cardStyle}}>
            <p style={{fontSize:11,fontWeight:700,color:"#9CA3AF",textTransform:"uppercase",letterSpacing:".05em",marginBottom:10}}>
              🧪 Ingrédients pour {litresEff.toFixed(1)} L d'alcool
            </p>
            {calcRecette.ingredients.map((ing:any,i:number)=>{
              const val = ing.parLitre ? ing.quantite * litresEff : ing.quantite;
              const isAlcool = ing.nom.toLowerCase().includes("alcool");
              return (
                <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",
                  padding:"9px 0",borderBottom:i<calcRecette.ingredients.length-1?"1px solid #F4F4F2":"none",
                  background:isAlcool?"transparent":"transparent"}}>
                  <span style={{fontSize:13,color:isAlcool?"#F2C94C":"#374151",flex:1,paddingRight:8,fontWeight:isAlcool?700:400}}>{ing.nom}</span>
                  <span style={{fontWeight:800,color:isAlcool?"#0A0A0A":"#0A0A0A",fontSize:15,flexShrink:0,
                    background:isAlcool?"#F2C94C":"transparent",
                    padding:isAlcool?"2px 8px":"0",borderRadius:isAlcool?6:0}}>{affQte(val,ing.unite)}</span>
                </div>
              );
            })}
            <div style={{display:"flex",gap:16,marginTop:10,paddingTop:10,borderTop:"1px solid #F4F4F2",justifyContent:"center"}}>
              <div style={{textAlign:"center"}}>
                <p style={{fontSize:10,color:"#9CA3AF"}}>Volume final produit</p>
                <p style={{fontSize:16,fontWeight:800,color:"#0A0A0A"}}>{volLiqueur.toFixed(1)} L</p>
              </div>
              <div style={{textAlign:"center"}}>
                <p style={{fontSize:10,color:"#9CA3AF"}}>Titre alcoométrique</p>
                <p style={{fontSize:16,fontWeight:800,color:"#0A0A0A"}}>{calcRecette.titreAlcool}°</p>
              </div>
              <div style={{textAlign:"center"}}>
                <p style={{fontSize:10,color:"#9CA3AF"}}>Macération</p>
                <p style={{fontSize:16,fontWeight:800,color:"#0A0A0A"}}>{calcRecette.dureeMacerationJours}j</p>
              </div>
            </div>
          </div>

          {/* Carte 3 : Stock après production */}
          {anaRecette && (anaRecette.p25||anaRecette.p50) && (
            <div style={{...cardStyle,background:"#F0FDF4",border:"1.5px solid #BBF7D0"}}>
              <p style={{fontSize:11,fontWeight:700,color:"#15803D",textTransform:"uppercase",letterSpacing:".05em",marginBottom:8}}>📊 Stock après cette production</p>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                {anaRecette.p25 && (
                  <div style={{textAlign:"center",background:"#fff",borderRadius:8,padding:"10px 8px"}}>
                    <p style={{fontSize:10,color:"#9CA3AF",marginBottom:2}}>250 ml</p>
                    <p style={{fontSize:24,fontWeight:800,color:"#15803D"}}>{(anaRecette.stockNet25||0)+eff25}</p>
                    <p style={{fontSize:10,color:"#9CA3AF"}}>/ {anaRecette.cible25||20} cible</p>
                    <p style={{fontSize:10,fontWeight:600,marginTop:2,color:(anaRecette.stockNet25||0)+eff25>=(anaRecette.cible25||20)?"#15803D":"#F59E0B"}}>
                      {(anaRecette.stockNet25||0)+eff25>=(anaRecette.cible25||20)?"✅ Stock parfait":"⚠ En dessous cible"}
                    </p>
                  </div>
                )}
                {anaRecette.p50 && (
                  <div style={{textAlign:"center",background:"#fff",borderRadius:8,padding:"10px 8px"}}>
                    <p style={{fontSize:10,color:"#9CA3AF",marginBottom:2}}>500 ml</p>
                    <p style={{fontSize:24,fontWeight:800,color:"#15803D"}}>{(anaRecette.stockNet50||0)+eff50}</p>
                    <p style={{fontSize:10,color:"#9CA3AF"}}>/ {anaRecette.cible50||20} cible</p>
                    <p style={{fontSize:10,fontWeight:600,marginTop:2,color:(anaRecette.stockNet50||0)+eff50>=(anaRecette.cible50||20)?"#15803D":"#F59E0B"}}>
                      {(anaRecette.stockNet50||0)+eff50>=(anaRecette.cible50||20)?"✅ Stock parfait":"⚠ En dessous cible"}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Numéro de lot + bouton démarrer */}
          <div style={{...cardStyle,background:"#0A0A0A"}}>
            <label style={{...labelStyle,color:"#F2C94C",fontSize:12}}>Numéro de lot (ex : LIM-2025-001)</label>
            <input
              type="text"
              value={calcNumLot}
              onChange={e=>setCalcNumLot(e.target.value)}
              placeholder={genLot(today())}
              style={{...inputStyle,background:"#1A1A1A",color:"#fff",border:"2px solid #374151",fontWeight:700,fontSize:15,letterSpacing:".04em",marginBottom:10}}
            />
            <button style={{...btnPrimary,width:"100%",background:"#F2C94C",color:"#0A0A0A",fontWeight:900,fontSize:14}} onClick={()=>{
              const todayStr = today();
              genererFicheMacerationPDF({
                recette: calcRecette,
                litres: litresEff,
                btl25: eff25,
                btl50: eff50,
                numLot: calcNumLot || genLot(todayStr),
                dateDebut: todayStr,
                notes: "",
              });
              openMaceration();
              setMForm((m:any)=>({...m,recetteId:calcRecetteId,litresAlcool:String(litresEff.toFixed(1)),numLot:calcNumLot||genLot(todayStr)}));
              setOnglet("macerations");
            }}>🫙 Démarrer cette macération + PDF</button>
          </div>
          </>
          )}
          </>
        );
      })()}
    </div>
    )}

    {/* ── MACÉRATIONS EN COURS ── */}
    {onglet==="macerations" && (
    <div>
      <div style={{display:"flex",justifyContent:"flex-end",marginBottom:12}}>
        <button style={btnPrimary} onClick={()=>openMaceration()}>+ Nouvelle macération</button>
      </div>
      {macerations.length===0 && <p style={{color:"#9CA3AF",textAlign:"center",padding:24}}>Aucune macération en cours.</p>}
      {macerations.map(mac=>{
        const recette = recettes.find(r=>r.id===mac.recetteId);
        const jours = recette?.dureeMacerationJours||30;
        const reste = joursRestants(mac.dateDebut, jours);
        const prete = reste<=0;
        const litres = parseFloat(mac.litresAlcool)||0;
        const btl = recette ? Math.floor(litres*recette.rendementBouteilles) : 0;
        return (
          <div key={mac.id} style={{...cardStyle,borderLeft:`4px solid ${prete?"#15803D":"#F2C94C"}`}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
              <div>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                  <p style={{fontWeight:700,fontSize:15,color:"#0A0A0A"}}>{recette?.nom||"Recette inconnue"}</p>
                  <span style={{background:prete?"#F0FDF4":"#FFFBEB",color:prete?"#15803D":"#B45309",fontSize:10,fontWeight:700,padding:"2px 7px",borderRadius:10}}>
                    {prete?"✅ PRÊTE":"🫙 EN COURS"}
                  </span>
                </div>
                <p style={{fontSize:12,color:"#737373"}}>Démarré le {mac.dateDebut} · {litres}L alcool · ~{btl} bouteilles</p>
              </div>
              <div style={{display:"flex",gap:5,flexShrink:0}}>
                <button style={btnSecondary} onClick={()=>openMaceration(mac)}>✏️</button>
                <button style={btnDanger} onClick={()=>supprimerMaceration(mac.id)}>✕</button>
              </div>
            </div>
            {!prete && (
              <div style={{background:"#FAFAF7",borderRadius:8,padding:"8px 12px",marginTop:8,display:"flex",alignItems:"center",gap:12}}>
                <div style={{flex:1,background:"#EAE7E0",borderRadius:4,height:6,overflow:"hidden"}}>
                  <div style={{height:"100%",background:"#F2C94C",borderRadius:4,width:`${Math.min(100,Math.max(0,((jours-reste)/jours)*100))}%`,transition:"width .4s"}}/>
                </div>
                <span style={{fontSize:12,fontWeight:700,color:"#374151",flexShrink:0}}>{reste}j restants</span>
              </div>
            )}
            <div style={{display:"flex",gap:6,marginTop:8,flexWrap:"wrap",alignItems:"center"}}>
              <span style={{fontSize:11,color:"#737373"}}>Prête le : <strong>{datePreteStr(mac.dateDebut,jours)}</strong></span>
              {mac.notes&&<span style={{fontSize:11,color:"#737373",fontStyle:"italic"}}>· {mac.notes}</span>}
            </div>
            {prete && (
              <button style={{...btnPrimary,background:"#15803D",width:"100%",marginTop:10}} onClick={()=>terminerMaceration(mac)}>
                ✅ Marquer comme terminée et archiver
              </button>
            )}
          </div>
        );
      })}
    </div>
    )}

    {/* ── HISTORIQUE ── */}
    {onglet==="historique" && (
    <div>
      {historique.length===0 && <p style={{color:"#9CA3AF",textAlign:"center",padding:24}}>Aucun batch terminé pour l'instant.</p>}
      {historique.map((b,i)=>(
        <div key={b.id||i} style={cardStyle}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
            <div>
              <p style={{fontWeight:700,fontSize:15,color:"#0A0A0A",marginBottom:3}}>{b.recetteNom||"—"}</p>
              <p style={{fontSize:12,color:"#737373"}}>Du {b.dateDebut} au {b.dateFin}</p>
            </div>
            <div style={{textAlign:"right"}}>
              <p style={{fontSize:22,fontWeight:800,color:"#0A0A0A"}}>{b.bouteilles}</p>
              <p style={{fontSize:11,color:"#737373"}}>bouteilles</p>
            </div>
          </div>
          <div style={{display:"flex",gap:8,marginTop:8,flexWrap:"wrap"}}>
            <span style={{background:"#EFF6FF",color:"#1D4ED8",fontSize:11,fontWeight:600,padding:"3px 8px",borderRadius:6}}>🍺 {b.litresAlcool}L alcool</span>
            {b.notes&&<span style={{fontSize:11,color:"#737373",fontStyle:"italic"}}>💬 {b.notes}</span>}
          </div>
        </div>
      ))}
      {historique.length>0 && (
        <div style={{...cardStyle,background:"#0A0A0A",color:"#fff",marginTop:16}}>
          <p style={{fontSize:11,fontWeight:700,color:"#E8B64C",textTransform:"uppercase",letterSpacing:".06em",marginBottom:8}}>Total historique</p>
          <div style={{display:"flex",gap:24}}>
            <div>
              <p style={{fontSize:10,color:"#9CA3AF"}}>Batchs réalisés</p>
              <p style={{fontSize:28,fontWeight:800,color:"#F2C94C"}}>{historique.length}</p>
            </div>
            <div>
              <p style={{fontSize:10,color:"#9CA3AF"}}>Bouteilles produites</p>
              <p style={{fontSize:28,fontWeight:800,color:"#F2C94C"}}>{historique.reduce((s,b)=>s+(b.bouteilles||0),0)}</p>
            </div>
            <div>
              <p style={{fontSize:10,color:"#9CA3AF"}}>Litres alcool utilisés</p>
              <p style={{fontSize:28,fontWeight:800,color:"#F2C94C"}}>{historique.reduce((s,b)=>s+(parseFloat(b.litresAlcool)||0),0).toFixed(1)}L</p>
            </div>
          </div>
        </div>
      )}
    </div>
    )}

    {/* ── MODAL RECETTE ── */}
    {recetteModal && (
    <Modal title={recetteModal==="new"?"Nouvelle recette":"Modifier la recette"} onClose={()=>setRecetteModal(null)}>
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <div>
            <label style={labelStyle}>Nom *</label>
            <input style={inputStyle} value={rForm.nom} onChange={e=>setRForm(p=>({...p,nom:e.target.value}))} placeholder="ex: Limonta"/>
          </div>
          <div>
            <label style={labelStyle}>Statut</label>
            <select style={inputStyle} value={rForm.statut||"en création"} onChange={e=>setRForm(p=>({...p,statut:e.target.value}))}>
              <option value="en création">🔧 En création</option>
              <option value="fonctionnel">✅ Fonctionnel</option>
              <option value="plus d'actualité">🗄 Plus d'actualité</option>
            </select>
          </div>
        </div>
        <div>
          <label style={labelStyle}>Description</label>
          <input style={inputStyle} value={rForm.description} onChange={e=>setRForm(p=>({...p,description:e.target.value}))} placeholder="ex: Liqueur de citron jaune"/>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <div>
            <label style={labelStyle}>Macération (jours)</label>
            <input type="number" style={inputStyle} value={rForm.dureeMacerationJours} onChange={e=>setRForm(p=>({...p,dureeMacerationJours:parseInt(e.target.value)||0}))}/>
          </div>
          <div>
            <label style={labelStyle}>Bouteilles 500ml / litre d'alcool</label>
            <input type="number" style={inputStyle} value={rForm.rendementBouteilles} onChange={e=>setRForm(p=>({...p,rendementBouteilles:parseFloat(e.target.value)||0}))} step="0.5" placeholder="ex: 10"/>
          </div>
        </div>
        <p style={{fontSize:10,color:"#9CA3AF",marginTop:-4}}>ex: si 1L d'alcool pur donne 10 bouteilles de 500ml → mettre 10</p>
        <div>
          <label style={labelStyle}>Couleur</label>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {COULEURS.map(c=>(
              <button key={c} onClick={()=>setRForm(p=>({...p,couleur:c}))} style={{width:28,height:28,borderRadius:"50%",background:c,border:rForm.couleur===c?"3px solid #0A0A0A":"2px solid #EAE7E0",cursor:"pointer"}}/>
            ))}
          </div>
        </div>
        <div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
            <label style={labelStyle}>Ingrédients (par litre d'alcool)</label>
            <button style={btnSecondary} onClick={()=>setRForm(p=>({...p,ingredients:[...p.ingredients,{nom:"",quantite:0,unite:"g",parLitre:true}]}))}>+ Ajouter</button>
          </div>
          {rForm.ingredients.map((ing,i)=>(
            <div key={i} style={{display:"grid",gridTemplateColumns:"1fr auto auto auto",gap:6,marginBottom:6,alignItems:"center"}}>
              <input style={inputStyle} value={ing.nom} onChange={e=>setRForm(p=>({...p,ingredients:p.ingredients.map((x,j)=>j===i?{...x,nom:e.target.value}:x)}))} placeholder="Ingrédient"/>
              <input type="number" style={{...inputStyle,width:70}} value={ing.quantite} onChange={e=>setRForm(p=>({...p,ingredients:p.ingredients.map((x,j)=>j===i?{...x,quantite:parseFloat(e.target.value)||0}:x)}))} placeholder="Qté"/>
              <select style={{...inputStyle,width:60}} value={ing.unite} onChange={e=>setRForm(p=>({...p,ingredients:p.ingredients.map((x,j)=>j===i?{...x,unite:e.target.value}:x)}))}>
                <option>g</option><option>kg</option><option>L</option><option>ml</option><option>pcs</option>
              </select>
              <button style={btnDanger} onClick={()=>setRForm(p=>({...p,ingredients:p.ingredients.filter((_,j)=>j!==i)}))}>✕</button>
            </div>
          ))}
          <p style={{fontSize:10,color:"#9CA3AF",marginTop:4}}>* Les quantités sont automatiquement multipliées par le nombre de litres d'alcool.</p>
        </div>
        <div>
          <label style={labelStyle}>Notes / Conseils</label>
          <textarea style={{...inputStyle,resize:"vertical",minHeight:60}} value={rForm.notes} onChange={e=>setRForm(p=>({...p,notes:e.target.value}))} placeholder="Notes de production..."/>
        </div>

        {/* ── Marche à suivre ── */}
        <div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <label style={{...labelStyle,marginBottom:0}}>Marche à suivre (étapes PDF)</label>
            <button style={btnSecondary} onClick={()=>setRForm(p=>({...p,marcheASuivre:[...(p.marcheASuivre||[]),""]}))} >+ Étape</button>
          </div>
          {(rForm.marcheASuivre||[]).length===0 && (
            <p style={{fontSize:11,color:"#9CA3AF",fontStyle:"italic",textAlign:"center",padding:"10px 0"}}>
              Aucune étape — cliquez "+ Étape" pour commencer
            </p>
          )}
          {(rForm.marcheASuivre||[]).map((etape:string,i:number)=>(
            <div key={i} style={{display:"flex",gap:6,marginBottom:6,alignItems:"flex-start"}}>
              <div style={{background:"#F2C94C",color:"#0A0A0A",borderRadius:"50%",width:22,height:22,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:800,flexShrink:0,marginTop:8}}>
                {i+1}
              </div>
              <textarea
                style={{...inputStyle,flex:1,resize:"vertical",minHeight:40,fontSize:12}}
                value={etape}
                onChange={e=>setRForm(p=>({...p,marcheASuivre:(p.marcheASuivre||[]).map((x:string,j:number)=>j===i?e.target.value:x)}))}
                placeholder={`Étape ${i+1}...`}
              />
              <div style={{display:"flex",flexDirection:"column",gap:4,flexShrink:0}}>
                <button style={{...btnSecondary,padding:"2px 7px",fontSize:12}} disabled={i===0}
                  onClick={()=>setRForm(p=>{const a=[...(p.marcheASuivre||[])];[a[i-1],a[i]]=[a[i],a[i-1]];return {...p,marcheASuivre:a};})}>↑</button>
                <button style={{...btnSecondary,padding:"2px 7px",fontSize:12}} disabled={i===(rForm.marcheASuivre||[]).length-1}
                  onClick={()=>setRForm(p=>{const a=[...(p.marcheASuivre||[])];[a[i],a[i+1]]=[a[i+1],a[i]];return {...p,marcheASuivre:a};})}>↓</button>
                <button style={{...btnDanger,padding:"2px 7px",fontSize:12}}
                  onClick={()=>setRForm(p=>({...p,marcheASuivre:(p.marcheASuivre||[]).filter((_:string,j:number)=>j!==i)}))}>✕</button>
              </div>
            </div>
          ))}
        </div>

        <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:4}}>
          <button style={btnSecondary} onClick={()=>setRecetteModal(null)}>Annuler</button>
          <button style={btnPrimary} onClick={saveRecette}>Enregistrer</button>
        </div>
      </div>
    </Modal>
    )}

    {/* ── MODAL MACERATION ── */}
    {macerationModal && (
    <Modal title={macerationModal==="new"?"Nouvelle macération":"Modifier la macération"} onClose={()=>setMacerationModal(null)}>
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        <div>
          <label style={labelStyle}>Recette *</label>
          <select style={inputStyle} value={mForm.recetteId} onChange={e=>setMForm(p=>({...p,recetteId:e.target.value}))}>
            {recettes.map(r=><option key={r.id} value={r.id}>{r.nom}</option>)}
          </select>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <div>
            <label style={labelStyle}>Litres d'alcool *</label>
            <input type="number" style={inputStyle} value={mForm.litresAlcool} onChange={e=>setMForm(p=>({...p,litresAlcool:e.target.value}))} min="0" step="0.5" placeholder="ex: 10"/>
          </div>
          <div>
            <label style={labelStyle}>Date de début</label>
            <input type="date" style={inputStyle} value={mForm.dateDebut} onChange={e=>setMForm(p=>({...p,dateDebut:e.target.value}))}/>
          </div>
        </div>
        <div>
          <label style={labelStyle}>Notes</label>
          <textarea style={{...inputStyle,resize:"vertical",minHeight:50}} value={mForm.notes} onChange={e=>setMForm(p=>({...p,notes:e.target.value}))} placeholder="Notes..."/>
        </div>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:4}}>
          <button style={btnSecondary} onClick={()=>setMacerationModal(null)}>Annuler</button>
          <button style={btnPrimary} onClick={saveMaceration}>Enregistrer</button>
        </div>
      </div>
    </Modal>
    )}
  </div>
  );
};

// ══════════════════════════════════════════════════════════════
// VENTES — wrapper avec sous-onglets
// ══════════════════════════════════════════════════════════════
const Ventes = ({st, setSt}) => {
  const [onglet, setOnglet] = useState<"depots"|"offres"|"commandes"|"factures">("depots");
  const tabs = [
    {id:"depots",   label:"Dépôts",    emoji:"🤝"},
    {id:"offres",   label:"Offres",    emoji:"📋"},
    {id:"commandes",label:"Commandes", emoji:"📦"},
    {id:"factures", label:"Factures",  emoji:"🧾"},
  ] as const;
  return (
    <div>
      <div style={{display:"flex",background:"#fff",borderRadius:12,padding:4,marginBottom:16,gap:3,overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
        {tabs.map(t=>(
          <button key={t.id} onClick={()=>setOnglet(t.id as any)} style={{
            flex:"1 1 0",minWidth:0,padding:"7px 4px",border:"none",borderRadius:9,cursor:"pointer",fontSize:11,fontWeight:onglet===t.id?700:500,
            background:onglet===t.id?"#0A0A0A":"transparent",color:onglet===t.id?"#F2C94C":"#525252",
            transition:"background .15s,color .15s",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",
          }}>
            {t.emoji} {t.label}
          </button>
        ))}
      </div>
      {onglet==="depots"    && <Partenaires st={st} setSt={setSt}/>}
      {onglet==="offres"    && <Offres st={st} setSt={setSt}/>}
      {onglet==="commandes" && <Commandes st={st} setSt={setSt}/>}
      {onglet==="factures"  && <Factures st={st} setSt={setSt}/>}
    </div>
  );
};

// ══════════════════════════════════════════════════════════════
// PARAMÈTRES — infos société + solde
// ══════════════════════════════════════════════════════════════
const Parametres = ({st, setSt, authUser}) => {
  const [solde, setSolde] = useState(String(st.soldeBancaire||0));
  const [saved, setSaved] = useState(false);
  const saveSolde = () => {
    const v = parseFloat(solde);
    if(isNaN(v)) return;
    setSt(p=>({...p, soldeBancaire:v}));
    setSaved(true);
    setTimeout(()=>setSaved(false), 2000);
  };
  return (
    <div className="fade">
      <SectionTitle>Paramètres</SectionTitle>

      <Card style={{marginBottom:14}}>
        <h3 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:17,marginBottom:12}}>Société</h3>
        {[
          {l:"Nom",    v:SOCIETE.nom},
          {l:"Adresse",v:SOCIETE.adresse},
          {l:"Email",  v:SOCIETE.email},
          {l:"Tél.",   v:SOCIETE.tel},
          {l:"IBAN",   v:"CH23 0900 0000 1565 1485 8"},
          {l:"TVA",    v:"Exonéré"},
        ].map((r,i)=>(
          <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:"1px solid #F5F5F0",fontSize:13}}>
            <span style={{color:"#9CA3AF",fontWeight:600,minWidth:80}}>{r.l}</span>
            <span style={{fontWeight:500,textAlign:"right"}}>{r.v}</span>
          </div>
        ))}
      </Card>

      <Card style={{marginBottom:14}}>
        <h3 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:17,marginBottom:12}}>Solde PostFinance</h3>
        <p style={{fontSize:12,color:"#9CA3AF",marginBottom:10}}>Mettre à jour le solde affiché dans l'application.</p>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <span style={{fontWeight:600,fontSize:13}}>CHF</span>
          <input type="number" step="0.01" value={solde} onChange={e=>setSolde(e.target.value)}
            style={{flex:1,padding:"10px 12px",border:"1.5px solid #E5E5E0",borderRadius:10,fontSize:14}}/>
          <button onClick={saveSolde} style={{padding:"10px 16px",background:"#0A0A0A",color:"#F2C94C",border:"none",borderRadius:10,fontWeight:700,fontSize:13,cursor:"pointer"}}>
            {saved?"✓ Sauvé":"Mettre à jour"}
          </button>
        </div>
      </Card>

      <Card>
        <h3 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:17,marginBottom:12}}>Compte utilisateur</h3>
        {[
          {l:"Nom",  v:authUser?.display_name||authUser?.username||""},
          {l:"Rôle", v:authUser?.role==="admin"?"Administrateur":"Utilisateur"},
          {l:"Email",v:"admin@goutstoso.ch"},
        ].map((r,i)=>(
          <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:"1px solid #F5F5F0",fontSize:13}}>
            <span style={{color:"#9CA3AF",fontWeight:600,minWidth:80}}>{r.l}</span>
            <span style={{fontWeight:500}}>{r.v}</span>
          </div>
        ))}
      </Card>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════
// APP SHELL - Navigation
// ══════════════════════════════════════════════════════════════

const NAV_MAIN = [
  {id:"dashboard", label:"Accueil",    icon:"dash",    emoji:"🏠"},
  {id:"clients",   label:"Clients",    icon:"prod",    emoji:"👥"},
  {id:"ventes",    label:"Ventes",     icon:"facture", emoji:"💰"},
  {id:"production",label:"Production", icon:"prod",    emoji:"🏭"},
  {id:"stocks",    label:"Stock",      icon:"stock",   emoji:"📦"},
  {id:"compta",    label:"Compta",     icon:"compta",  emoji:"📊"},
];

const NAV_MORE = [
  {id:"documents",  label:"Documents légaux", icon:"contrat", emoji:"📜"},
  {id:"production", label:"Recettes",         icon:"prod",    emoji:"🏭"},
  {id:"parametres", label:"Paramètres",       icon:"settings",emoji:"⚙️"},
  {id:"contrats",   label:"Contrats",         icon:"contrat", emoji:"📋"},
  {id:"fournisseurs",label:"Fournisseurs",    icon:"facture", emoji:"🏭"},
  {id:"produits",   label:"Produits",         icon:"prod",    emoji:"🍋"},
  {id:"sauvegardes",label:"Sauvegardes",      icon:"stock",   emoji:"💾"},
];

// Icône "more" (hamburger)
const IcMore = ({s=22}) => (
<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
<circle cx="12" cy="5" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="12" cy="19" r="1" fill="currentColor"/>
</svg>
);

const CLOUD_URL = "https://hc12z9cbqiy.preview.infomaniak.website/api.php";
const sendEmail = async ({to, subject, body, toName=""}:{to:string,subject:string,body:string,toName?:string}) => {
  if(!to){alert("Adresse email manquante");return;}
  // Convertit le HTML basique (balises <br>) en texte brut pour l'API
  const bodyText = body.replace(/<br\s*\/?>/gi,"\n").replace(/<[^>]+>/g,"");
  try {
    const r = await fetch("/api/email/send",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({to,toName,subject,bodyText}),
    });
    const d = await r.json();
    if(d.sent) {
      alert("✅ Email envoyé à "+to);
    } else {
      // Fallback mailto si SMTP pas encore configuré
      const mailto=`mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyText)}`;
      window.open(mailto,"_blank");
      alert("⚠️ Envoi SMTP échoué ("+d.error+").\nOuverture du client email en fallback.");
    }
  } catch(e:any) {
    const mailto=`mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyText)}`;
    window.open(mailto,"_blank");
  }
};

// ── AUTH HELPERS ────────────────────────────────────────────────
const getToken = () => { try { return localStorage.getItem("gs_auth_token")||""; } catch(e){ return ""; } };
const setToken = (t) => { try { localStorage.setItem("gs_auth_token", t); } catch(e){} };
const clearToken = () => { try { localStorage.removeItem("gs_auth_token"); } catch(e){} };
const authFetch = (url, opts:any={}) => {
  const token = getToken();
  const headers = {...(opts.headers||{}), ...(token?{"X-Auth-Token":token}:{})};
  return fetch(url, {...opts, headers});
};

// ── ÉCRAN DE CONNEXION ──────────────────────────────────────────
function LoginScreen({onLogin}: {onLogin:(user:any,token:string)=>void}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPwd, setShowPwd] = useState(false);

  const handleLogin = async (e) => {
    e?.preventDefault();
    if(!username||!password){setError("Veuillez remplir tous les champs.");return;}
    setLoading(true); setError("");
    try {
      const r = await fetch(CLOUD_URL, {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({_action:"login", username:username.trim(), password})
      });
      const text = await r.text();
      let j:any = null;
      try { j = JSON.parse(text); } catch(pe) { setError("Réponse serveur invalide: " + text.slice(0,200)); setLoading(false); return; }
      if(j.success) {
        setToken(j.token);
        onLogin(j.user, j.token);
      } else {
        setError(j.error||"Identifiants invalides.");
      }
    } catch(e:any){ setError("Réseau inaccessible: " + (e?.message||"")); }
    setLoading(false);
  };

  return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#FAFAF7",padding:24}}>
      <div style={{width:"100%",maxWidth:380}}>
        <div style={{textAlign:"center",marginBottom:32}}>
          <img src={LOGO_B64} alt="GoûtStoso" style={{width:140,height:"auto",objectFit:"contain",marginBottom:12}}/>
          <p style={{fontSize:13,color:"#737373"}}>Connexion à votre espace de gestion</p>
        </div>
        <form onSubmit={handleLogin} style={{background:"#fff",borderRadius:16,padding:28,boxShadow:"0 4px 24px rgba(0,0,0,.08)",border:"1px solid #EAE7E0"}}>
          <div style={{marginBottom:16}}>
            <label style={{fontSize:12,fontWeight:600,color:"#525252",display:"block",marginBottom:6}}>Nom d'utilisateur</label>
            <input value={username} onChange={e=>setUsername(e.target.value)} placeholder="Votre identifiant" autoComplete="username" disabled={loading}/>
          </div>
          <div style={{marginBottom:20,position:"relative"}}>
            <label style={{fontSize:12,fontWeight:600,color:"#525252",display:"block",marginBottom:6}}>Mot de passe</label>
            <input type={showPwd?"text":"password"} value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" disabled={loading} style={{paddingRight:44}}/>
            <button type="button" onClick={()=>setShowPwd(v=>!v)} style={{position:"absolute",right:12,top:34,background:"none",border:"none",color:"#737373",padding:4,fontSize:16}}>{showPwd?"🙈":"👁"}</button>
          </div>
          {error && <div style={{background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:8,padding:"10px 14px",marginBottom:16}}><p style={{fontSize:13,color:"#B91C1C"}}>{error}</p></div>}
          <button type="submit" disabled={loading} style={{width:"100%",background:"#0A0A0A",color:"#fff",border:"none",borderRadius:10,padding:"13px 0",fontSize:14,fontWeight:600,cursor:loading?"not-allowed":"pointer",opacity:loading?.6:1}}>
            {loading?"Connexion...":"Se connecter"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── PANNEAU ADMIN UTILISATEURS ──────────────────────────────────
function AdminPanel({currentUser, onClose}: {currentUser:any, onClose:()=>void}) {
  const [users, setUsers] = useState<any[]>([]);
  const [activity, setActivity] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"users"|"activity">("users");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({username:"",password:"",display_name:"",role:"user"});
  const [editUser, setEditUser] = useState<any>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [msg, setMsg] = useState("");

  const apiCall = async (action, extra={}) => {
    const token = getToken();
    const r = await fetch(CLOUD_URL, {method:"POST",headers:{"Content-Type":"application/json","X-Auth-Token":token},body:JSON.stringify({_action:action,_token:token,...extra})});
    const text = await r.text();
    try { return JSON.parse(text); } catch(e) { return {_raw: text, _parseError: String(e)}; }
  };

  const load = async () => {
    setLoading(true);
    try {
      const [u, a] = await Promise.all([apiCall("list_users"), apiCall("get_activity",{limit:100})]);
      if(u._parseError) { setMsg("Erreur serveur (list_users): " + (u._raw||"").slice(0,300)); }
      else if(u.error) { setMsg("Accès refusé: " + u.error); }
      else if(u.users) setUsers(u.users);
      if(a._parseError) { /* activité non bloquante — ignorer */ }
      else if(a.activity) setActivity(a.activity);
    } catch(e) {
      setMsg("Erreur réseau: " + String(e));
    }
    setLoading(false);
  };

  React.useEffect(()=>{ load(); },[]);

  const createUser = async () => {
    if(!form.username||!form.password){setMsg("Identifiant et mot de passe requis.");return;}
    const r = await apiCall("create_user", form);
    if(r.success){setMsg("Utilisateur créé."); setForm({username:"",password:"",display_name:"",role:"user"}); setShowForm(false); load();}
    else setMsg(r.error||"Erreur");
  };

  const toggleActive = async (u) => {
    await apiCall("update_user", {id:u.id, active:u.active?0:1});
    load();
  };

  const saveEdit = async () => {
    await apiCall("update_user", {id:editUser.id, ...editForm});
    setEditUser(null); load(); setMsg("Modifié.");
  };

  const deleteUser = async (u) => {
    if(!confirm(`Supprimer l'utilisateur "${u.username}" ?`)) return;
    await apiCall("delete_user", {id:u.id});
    load();
  };

  const actionLabels = {login:"Connexion",logout:"Déconnexion",create_user:"Création utilisateur",update_user:"Modification utilisateur",delete_user:"Suppression utilisateur",sync:"Synchronisation données"};
  const fmtDt = (s) => { const d=new Date(s); return d.toLocaleDateString("fr-CH")+' '+d.toLocaleTimeString("fr-CH",{hour:"2-digit",minute:"2-digit"}); };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex:1000,display:"flex",alignItems:"flex-start",justifyContent:"center",padding:20,overflowY:"auto"}}>
      <div style={{background:"#fff",borderRadius:16,width:"100%",maxWidth:760,boxShadow:"0 8px 40px rgba(0,0,0,.2)"}}>
        {/* Header */}
        <div style={{padding:"20px 24px",borderBottom:"1px solid #EAE7E0",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div>
            <h2 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,fontWeight:700}}>Administration</h2>
            <p style={{fontSize:12,color:"#737373",marginTop:2}}>Gérez les accès à GoûtStoso</p>
          </div>
          <button onClick={onClose} style={{background:"#F4F4F2",border:"none",borderRadius:8,padding:"8px 12px",fontSize:13,fontWeight:500,cursor:"pointer"}}>Fermer</button>
        </div>

        {/* Tabs */}
        <div style={{display:"flex",gap:0,borderBottom:"1px solid #EAE7E0"}}>
          {([["users","Utilisateurs"],["activity","Journal d'activité"]] as const).map(([id,label])=>(
            <button key={id} onClick={()=>setActiveTab(id)} style={{flex:1,padding:"12px 0",border:"none",borderBottom:activeTab===id?"2px solid #0A0A0A":"2px solid transparent",background:"none",fontSize:13,fontWeight:activeTab===id?600:400,color:activeTab===id?"#0A0A0A":"#737373",cursor:"pointer"}}>{label}</button>
          ))}
        </div>

        <div style={{padding:24}}>
          {msg && <div style={{background:"#F0FDF4",border:"1px solid #86EFAC",borderRadius:8,padding:"10px 14px",marginBottom:16,fontSize:13,color:"#15803D"}}>{msg}<button onClick={()=>setMsg("")} style={{float:"right",background:"none",border:"none",cursor:"pointer",color:"#15803D"}}>✕</button></div>}

          {/* ONGLET UTILISATEURS */}
          {activeTab==="users" && (
            <div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                <p style={{fontSize:13,color:"#737373"}}>{users.length} utilisateur(s)</p>
                <button onClick={()=>setShowForm(v=>!v)} style={{background:"#0A0A0A",color:"#fff",border:"none",borderRadius:8,padding:"8px 16px",fontSize:13,fontWeight:500,cursor:"pointer"}}>+ Ajouter</button>
              </div>

              {showForm && (
                <div style={{background:"#FAFAF7",borderRadius:12,padding:20,marginBottom:20,border:"1px solid #EAE7E0"}}>
                  <p style={{fontWeight:600,fontSize:14,marginBottom:14}}>Nouvel utilisateur</p>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
                    <div><label style={{fontSize:11,fontWeight:600,color:"#525252",display:"block",marginBottom:4}}>Identifiant *</label><input value={form.username} onChange={e=>setForm(f=>({...f,username:e.target.value}))} placeholder="prenom.nom"/></div>
                    <div><label style={{fontSize:11,fontWeight:600,color:"#525252",display:"block",marginBottom:4}}>Mot de passe *</label><input type="password" value={form.password} onChange={e=>setForm(f=>({...f,password:e.target.value}))} placeholder="••••••••"/></div>
                    <div><label style={{fontSize:11,fontWeight:600,color:"#525252",display:"block",marginBottom:4}}>Nom affiché</label><input value={form.display_name} onChange={e=>setForm(f=>({...f,display_name:e.target.value}))} placeholder="Prénom Nom"/></div>
                    <div><label style={{fontSize:11,fontWeight:600,color:"#525252",display:"block",marginBottom:4}}>Rôle</label><select value={form.role} onChange={e=>setForm(f=>({...f,role:e.target.value}))}><option value="user">Utilisateur</option><option value="admin">Administrateur</option></select></div>
                  </div>
                  <div style={{display:"flex",gap:8}}>
                    <button onClick={createUser} style={{background:"#0A0A0A",color:"#fff",border:"none",borderRadius:8,padding:"8px 20px",fontSize:13,fontWeight:500,cursor:"pointer"}}>Créer</button>
                    <button onClick={()=>setShowForm(false)} style={{background:"none",border:"1px solid #EAE7E0",borderRadius:8,padding:"8px 20px",fontSize:13,cursor:"pointer"}}>Annuler</button>
                  </div>
                </div>
              )}

              {loading ? <p style={{color:"#737373",fontSize:13,textAlign:"center",padding:20}}>Chargement...</p> : (
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {users.map(u=>(
                    <div key={u.id} style={{border:"1px solid #EAE7E0",borderRadius:10,padding:"14px 16px",background:u.active?"#fff":"#FAFAF7",opacity:u.active?1:.7}}>
                      {editUser?.id===u.id ? (
                        <div>
                          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
                            <div><label style={{fontSize:11,fontWeight:600,color:"#525252",display:"block",marginBottom:4}}>Nom affiché</label><input value={editForm.display_name??u.display_name} onChange={e=>setEditForm(f=>({...f,display_name:e.target.value}))}/></div>
                            <div><label style={{fontSize:11,fontWeight:600,color:"#525252",display:"block",marginBottom:4}}>Rôle</label><select value={editForm.role??u.role} onChange={e=>setEditForm(f=>({...f,role:e.target.value}))}><option value="user">Utilisateur</option><option value="admin">Administrateur</option></select></div>
                            <div><label style={{fontSize:11,fontWeight:600,color:"#525252",display:"block",marginBottom:4}}>Nouveau mot de passe</label><input type="password" value={editForm.password??""} onChange={e=>setEditForm(f=>({...f,password:e.target.value}))} placeholder="Laisser vide = inchangé"/></div>
                          </div>
                          <div style={{display:"flex",gap:8}}>
                            <button onClick={saveEdit} style={{background:"#0A0A0A",color:"#fff",border:"none",borderRadius:7,padding:"7px 16px",fontSize:12,fontWeight:500,cursor:"pointer"}}>Enregistrer</button>
                            <button onClick={()=>setEditUser(null)} style={{background:"none",border:"1px solid #EAE7E0",borderRadius:7,padding:"7px 14px",fontSize:12,cursor:"pointer"}}>Annuler</button>
                          </div>
                        </div>
                      ) : (
                        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
                          <div>
                            <div style={{display:"flex",alignItems:"center",gap:8}}>
                              <p style={{fontSize:14,fontWeight:600}}>{u.display_name||u.username}</p>
                              <span style={{fontSize:10,background:u.role==="admin"?"#FDF6E3":"#F4F4F2",color:u.role==="admin"?"#BC8F1C":"#525252",border:`1px solid ${u.role==="admin"?"#E8B64C":"#EAE7E0"}`,borderRadius:6,padding:"2px 8px",fontWeight:600}}>{u.role==="admin"?"Admin":"Utilisateur"}</span>
                              {!u.active && <span style={{fontSize:10,background:"#FEF2F2",color:"#B91C1C",border:"1px solid #FECACA",borderRadius:6,padding:"2px 8px",fontWeight:600}}>Désactivé</span>}
                            </div>
                            <p style={{fontSize:11,color:"#737373",marginTop:2}}>@{u.username} · Créé le {u.created_at?.slice(0,10)} {u.last_login?`· Dernière connexion: ${fmtDt(u.last_login)}`:""}</p>
                          </div>
                          <div style={{display:"flex",gap:6}}>
                            <button onClick={()=>{setEditUser(u);setEditForm({});}} style={{background:"#F4F4F2",border:"none",borderRadius:7,padding:"6px 12px",fontSize:12,cursor:"pointer"}}>Modifier</button>
                            <button onClick={()=>toggleActive(u)} style={{background:u.active?"#FEF2F2":"#F0FDF4",border:`1px solid ${u.active?"#FECACA":"#86EFAC"}`,borderRadius:7,padding:"6px 12px",fontSize:12,color:u.active?"#B91C1C":"#15803D",cursor:"pointer"}}>{u.active?"Désactiver":"Activer"}</button>
                            {u.username!==currentUser.username && <button onClick={()=>deleteUser(u)} style={{background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:7,padding:"6px 12px",fontSize:12,color:"#B91C1C",cursor:"pointer"}}>Supprimer</button>}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ONGLET JOURNAL */}
          {activeTab==="activity" && (
            <div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                <p style={{fontSize:13,color:"#737373"}}>{activity.length} actions récentes</p>
                <button onClick={load} style={{background:"#F4F4F2",border:"none",borderRadius:8,padding:"7px 14px",fontSize:12,cursor:"pointer"}}>Rafraîchir</button>
              </div>
              {loading ? <p style={{color:"#737373",fontSize:13,textAlign:"center",padding:20}}>Chargement...</p> : (
                <div style={{display:"flex",flexDirection:"column",gap:6}}>
                  {activity.map(a=>(
                    <div key={a.id} style={{display:"flex",alignItems:"flex-start",gap:12,padding:"10px 12px",background:"#FAFAF7",borderRadius:8,border:"1px solid #EAE7E0"}}>
                      <div style={{minWidth:32,height:32,background:"#0A0A0A",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center"}}>
                        <span style={{fontSize:14}}>{a.action==="login"?"🔑":a.action==="logout"?"🚪":a.action.includes("user")?"👤":"💾"}</span>
                      </div>
                      <div style={{flex:1}}>
                        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
                          <p style={{fontSize:13,fontWeight:600}}>{actionLabels[a.action]||a.action}</p>
                          <p style={{fontSize:11,color:"#737373",whiteSpace:"nowrap"}}>{fmtDt(a.created_at)}</p>
                        </div>
                        <p style={{fontSize:12,color:"#525252",marginTop:2}}>par <strong>{a.username}</strong>{a.detail?` — ${a.detail}`:""}</p>
                      </div>
                    </div>
                  ))}
                  {activity.length===0 && <p style={{color:"#737373",fontSize:13,textAlign:"center",padding:20}}>Aucune activité enregistrée.</p>}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Hook pour détecter taille écran (responsive)
function useIsDesktop() {
const [isDesktop, setIsDesktop] = useState(
typeof window !== "undefined" ? window.innerWidth >= 1024 : false
);
React.useEffect(()=>{
const handler = () => setIsDesktop(window.innerWidth >= 1024);
window.addEventListener("resize", handler);
return () => window.removeEventListener("resize", handler);
},[]);
return isDesktop;
}

// ══════════════════════════════════════════════════════════════
// PAGE: SAUVEGARDES
// ══════════════════════════════════════════════════════════════
function Sauvegardes({authUser,st,setSt}:{authUser:any,st:any,setSt:any}) {
  const [backups, setBackups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [downloading, setDownloading] = useState<number|null>(null);

  const token = getToken();
  const apiPost = (action:string, extra:any={}) =>
    fetch(CLOUD_URL,{method:"POST",headers:{"Content-Type":"application/json","X-Auth-Token":token},body:JSON.stringify({_action:action,_token:token,...extra})});

  const loadBackups = async () => {
    try {
      const r = await apiPost("list_backups");
      const j = await r.json();
      if(j.success) setBackups(j.backups||[]);
    } catch(e){}
    setLoading(false);
  };

  useEffect(()=>{ loadBackups(); },[]);

  const doBackup = async (type:"manual"|"auto"="manual") => {
    setSaving(true); setMsg("");
    const now = new Date();
    const label = `${String(now.getDate()).padStart(2,"0")}/${String(now.getMonth()+1).padStart(2,"0")}/${now.getFullYear()} ${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
    try {
      const r = await apiPost("save_backup",{label, type});
      const j = await r.json();
      if(j.success){
        setMsg("✓ Sauvegarde créée avec succès");
        await loadBackups();
      } else { setMsg("Erreur : "+( j.error||"inconnue")); }
    } catch(e){ setMsg("Erreur réseau"); }
    setSaving(false);
    setTimeout(()=>setMsg(""),4000);
  };

  const downloadBackup = async (b:any) => {
    setDownloading(b.id);
    try {
      const r = await apiPost("get_backup",{backup_id:b.id});
      const j = await r.json();
      if(j.success && j.data){
        const content = JSON.stringify({_meta:{label:b.label,created_at:b.created_at,created_by:b.created_by,type:b.type},...j.data},null,2);
        const blob = new Blob([content],{type:"application/json"});
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `goutstoso-backup-${b.label.replace(/[^a-zA-Z0-9]/g,"-")}.json`;
        document.body.appendChild(a); a.click();
        document.body.removeChild(a); URL.revokeObjectURL(url);
      }
    } catch(e){}
    setDownloading(null);
  };

  const fmtDate = (s:string) => {
    if(!s) return "-";
    const d = new Date(s);
    return d.toLocaleDateString("fr-CH",{day:"2-digit",month:"2-digit",year:"numeric"})+" "+d.toLocaleTimeString("fr-CH",{hour:"2-digit",minute:"2-digit"});
  };

  return (
  <div className="fade">
    {/* EN-TÊTE */}
    <div style={{marginBottom:20}}>
      <h1 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:26,fontWeight:600,letterSpacing:"-0.025em"}}>Sauvegardes</h1>
      <p style={{fontSize:13,color:"#737373",marginTop:4}}>Historique et téléchargement de vos données</p>
    </div>

    {/* INFO AUTO-BACKUP */}
    <div style={{background:"var(--blue-bg)",border:"1px solid #BFDBFE",borderRadius:12,padding:"14px 16px",marginBottom:20,display:"flex",gap:12,alignItems:"flex-start"}}>
      <span style={{fontSize:20}}>🔄</span>
      <div>
        <p style={{fontSize:13,fontWeight:600,color:"var(--blue)"}}>Sauvegarde automatique mensuelle</p>
        <p style={{fontSize:12,color:"#374151",marginTop:2}}>Une sauvegarde est créée automatiquement au démarrage de l'app chaque nouveau mois. Les 36 dernières sauvegardes sont conservées.</p>
      </div>
    </div>

    {/* BOUTON MANUEL */}
    <button
      onClick={()=>doBackup("manual")}
      disabled={saving}
      style={{width:"100%",padding:"14px 20px",background:"var(--ink)",color:"var(--white)",border:"none",borderRadius:12,fontWeight:600,fontSize:15,marginBottom:12,opacity:saving?0.6:1}}
    >
      {saving ? "Sauvegarde en cours…" : "💾  Créer une sauvegarde maintenant"}
    </button>

    {msg && (
      <div style={{background:msg.startsWith("✓")?"var(--green-bg)":"var(--red-bg)",border:`1px solid ${msg.startsWith("✓")?"#BBF7D0":"#FECACA"}`,borderRadius:10,padding:"10px 14px",marginBottom:16,fontSize:13,color:msg.startsWith("✓")?"var(--green)":"var(--red)"}}>
        {msg}
      </div>
    )}

    {/* LISTE */}
    <div style={{background:"var(--white)",borderRadius:14,border:"1px solid var(--border)",overflow:"hidden"}}>
      <div style={{padding:"12px 16px",borderBottom:"1px solid var(--border)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <p style={{fontSize:12,fontWeight:600,color:"var(--gray)",textTransform:"uppercase",letterSpacing:".06em"}}>Historique</p>
        <p style={{fontSize:12,color:"var(--gray)"}}>{backups.length} sauvegarde{backups.length!==1?"s":""}</p>
      </div>
      {loading ? (
        <div style={{padding:32,textAlign:"center",color:"var(--gray)",fontSize:13}}>Chargement…</div>
      ) : backups.length===0 ? (
        <div style={{padding:32,textAlign:"center",color:"var(--gray)",fontSize:13}}>Aucune sauvegarde pour l'instant</div>
      ) : (
        backups.map((b,i)=>(
          <div key={b.id} style={{padding:"14px 16px",borderBottom:i<backups.length-1?"1px solid var(--border)":"none",display:"flex",alignItems:"center",gap:12}}>
            <div style={{width:36,height:36,borderRadius:10,background:b.backup_type==="auto"?"var(--blue-bg)":"var(--lemon-pale)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>
              {b.backup_type==="auto"?"🔄":"💾"}
            </div>
            <div style={{flex:1,minWidth:0}}>
              <p style={{fontSize:13,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{b.label}</p>
              <p style={{fontSize:11,color:"var(--gray)",marginTop:2}}>{fmtDate(b.created_at)} · {b.backup_type==="auto"?"Auto":"Manuel"} · {b.created_by}</p>
            </div>
            <button
              onClick={()=>downloadBackup(b)}
              disabled={downloading===b.id}
              style={{padding:"7px 14px",background:"var(--gray-light)",border:"none",borderRadius:8,fontSize:12,fontWeight:600,color:"var(--ink)",flexShrink:0,opacity:downloading===b.id?0.5:1}}
            >
              {downloading===b.id?"…":"⬇ JSON"}
            </button>
          </div>
        ))
      )}
    </div>
  </div>
  );
}

export default function App() {
  // ── AUTHENTIFICATION ──────────────────────────────────────────
  const [authUser, setAuthUser] = useState<any>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);

  React.useEffect(()=>{
    // Vérifier si un token valide existe déjà
    const token = getToken();
    if(!token){ setAuthChecked(true); return; }
    fetch(CLOUD_URL, {
      method:"POST",
      headers:{"Content-Type":"application/json","X-Auth-Token":token},
      body: JSON.stringify({_action:"check_token",_token:token})
    }).then(r=>r.json()).then(j=>{
      if(j.success) setAuthUser(j.user);
      else clearToken();
      setAuthChecked(true);
    }).catch(()=>{ setAuthChecked(true); });
  },[]);

  const handleLogin = (user, token) => { setAuthUser(user); };
  const handleLogout = async () => {
    const token = getToken();
    try { await fetch(CLOUD_URL, {method:"POST",headers:{"Content-Type":"application/json","X-Auth-Token":token},body:JSON.stringify({_action:"logout",_token:token})}); } catch(e){}
    clearToken(); setAuthUser(null);
  };

  // Écran de chargement initial
  if(!authChecked) return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#FAFAF7"}}>
      <div style={{textAlign:"center"}}>
        <img src={LOGO_B64} alt="GoûtStoso" style={{width:120,height:"auto",objectFit:"contain",marginBottom:16}}/>
        <p style={{fontSize:13,color:"#737373"}}>Chargement...</p>
      </div>
    </div>
  );

  // Écran de connexion
  if(!authUser) return <LoginScreen onLogin={handleLogin}/>;

  return <AppInner authUser={authUser} handleLogout={handleLogout} showAdmin={showAdmin} setShowAdmin={setShowAdmin}/>;
}

function AppInner({authUser, handleLogout, showAdmin, setShowAdmin}: {authUser:any, handleLogout:()=>void, showAdmin:boolean, setShowAdmin:(v:boolean)=>void}) {
  React.useEffect(()=>{
    let wakeLock = null;
    const acquire = async () => { try { if(typeof navigator !== 'undefined' && navigator.wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); } } catch(e){} };
    acquire();
    const onVisible = () => { if(document.visibilityState === 'visible') acquire(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { document.removeEventListener('visibilitychange', onVisible); if(wakeLock) try { wakeLock.release(); } catch(e){} };
  },[]);
  React.useEffect(()=>{
    const ping = () => { try { fetch('/api/healthz',{method:'HEAD',cache:'no-store'}).catch(()=>{}); } catch(e){} };
    ping();
    const iv = setInterval(ping, 2*60*1000);
    return () => clearInterval(iv);
  },[]);
// ── AUTO-BACKUP MENSUEL ──────────────────────────────────────────
React.useEffect(()=>{
  const currentMonth = new Date().toISOString().slice(0,7); // "YYYY-MM"
  const lastBackupMonth = (() => { try { return localStorage.getItem("gs_last_backup_month")||""; } catch(e){ return ""; } })();
  if(lastBackupMonth === currentMonth) return; // déjà fait ce mois
  // Déclencher après 5s (laisser l'app se charger d'abord)
  const t = setTimeout(async()=>{
    try {
      const token = getToken();
      const now = new Date();
      const label = `Auto ${String(now.getDate()).padStart(2,"0")}/${String(now.getMonth()+1).padStart(2,"0")}/${now.getFullYear()}`;
      const r = await fetch(CLOUD_URL,{method:"POST",headers:{"Content-Type":"application/json","X-Auth-Token":token},body:JSON.stringify({_action:"save_backup",_token:token,label,type:"auto"})});
      const j = await r.json();
      if(j.success) {
        try { localStorage.setItem("gs_last_backup_month", currentMonth); } catch(e){}
      }
    } catch(e){}
  }, 5000);
  return () => clearTimeout(t);
},[]);

const [tab,setTab] = useState("dashboard");
const [showMore,setShowMore] = useState(false);
const [showMenu,setShowMenu] = useState(false);
const [st,setSt] = useState(INIT);

const [loading, setLoading] = React.useState(true);
const [syncing, setSyncing] = React.useState(false);

const cloudSave = async (data) => {
try {
const token = getToken();
const r = await fetch(CLOUD_URL, {
method:"POST",
headers:{"Content-Type":"application/json","Accept":"application/json","X-Auth-Token":token},
body: JSON.stringify({...data, _token:token})
});
return r.ok;
} catch(e){}
return false;
};

const cloudLoad = async () => {
try {
const token = getToken();
const r = await fetch(CLOUD_URL, {
  method:"POST",
  headers:{"Content-Type":"application/json","Accept":"application/json","X-Auth-Token":token},
  body: JSON.stringify({_action:"load_data",_token:token})
});
if(!r.ok) return null;
const j = await r.json();
if(j?._auth_required) return null;
if(j?.produits?.length > 0) return j;
} catch(e){}
return null;
};

const hydrateData = (data) => {
if(!data) return data;
const defaults = {
produits: INIT.produits.reduce((acc,p)=>({...acc,[p.id]:p}),{}),
partenaires: INIT.partenaires.reduce((acc,p)=>({...acc,[p.id]:p}),{}),
};
// Migration automatique : fournisseurs avec categorie "Client" → clients
const fournisseurs = data.fournisseurs||[];
const mauvaisClients = fournisseurs.filter((f:any)=>f.categorie==="Client");
const fournisseursMigres = mauvaisClients.length > 0 ? fournisseurs.filter((f:any)=>f.categorie!=="Client") : fournisseurs;
const clientsBase = data.clients||[];
const clientsMigres = mauvaisClients.length > 0
  ? [...clientsBase, ...mauvaisClients.filter((f:any)=>!clientsBase.some((c:any)=>c.nom?.toLowerCase()===f.nom?.toLowerCase()))]
  : clientsBase;
return {
...INIT,
...data,
produits: (data.produits||INIT.produits).map(p=>({...defaults.produits[p.id],...p})),
partenaires: (data.partenaires||INIT.partenaires).map(p=>({...defaults.partenaires[p.id],...p})),
stocks: data.stocks||INIT.stocks,
depotStocks: data.depotStocks||INIT.depotStocks,
contrats: data.contrats||INIT.contrats,
factures: data.factures||INIT.factures,
transactions: data.transactions||INIT.transactions,
soldeBancaire: data.soldeBancaire ?? INIT.soldeBancaire,
production: data.production||INIT.production,
fournisseurs: fournisseursMigres,
clients: clientsMigres,
};
};

// Charger au démarrage
React.useEffect(()=>{
(async()=>{
setLoading(true);
const remote = await cloudLoad();
if(remote) {
const next = hydrateData(remote);
setSt(next);
try { localStorage.setItem("goutstoso_v2", JSON.stringify(next)); } catch(e){}
} else {
try {
const saved = localStorage.getItem("goutstoso_v2");
if(saved) {
const p = JSON.parse(saved);
if(p?.produits?.length > 0) { const next = hydrateData(p); setSt(next); cloudSave(next); }
else { const next = hydrateData(INIT); setSt(next); cloudSave(next); }
} else {
const next = hydrateData(INIT);
setSt(next);
cloudSave(next);
}
} catch(e){}
}
setLoading(false);
})();
},[]);

// Migration : sync partenaires existants (sans clientId) vers st.clients
React.useEffect(()=>{
if(loading) return;
setSt(p=>{
  const pvsSansLien = (p.partenaires||[]).filter(pv=>!pv.clientId);
  if(pvsSansLien.length===0) return p;
  const newClients = [...(p.clients||[])];
  const newPartenaires = (p.partenaires||[]).map(pv=>{
    if(pv.clientId) return pv; // déjà lié
    // Chercher un client existant avec le même nom
    const existing = newClients.find(c=>c.nom===pv.nom && c.categorie==="partenaire");
    if(existing) return {...pv,clientId:existing.id};
    // Créer un nouveau client
    const nc = {
      id: uid(),
      nom: pv.nom,
      email: pv.email||"",
      telephone: pv.tel||"",
      adresse: pv.adresse||"",
      npa: pv.npa||"",
      ville: pv.ville||"",
      notes: "",
      categorie: "partenaire",
    };
    newClients.push(nc);
    return {...pv,clientId:nc.id};
  });
  return {...p,clients:newClients,partenaires:newPartenaires};
});
},[loading]);

// Sauvegarder à chaque changement
const saveTimer = React.useRef(null);
React.useEffect(()=>{
if(loading) return;
try { localStorage.setItem("goutstoso_v2", JSON.stringify(st)); } catch(e){}
if(saveTimer.current) clearTimeout(saveTimer.current);
saveTimer.current = setTimeout(async()=>{ setSyncing(true); await cloudSave(st); setSyncing(false); }, 2000);
},[st, loading]);

// Rafraîchir toutes les 30s
React.useEffect(()=>{
const iv = setInterval(async()=>{
const remote = await cloudLoad();
if(remote) { const next = hydrateData(remote); setSt(next); try { localStorage.setItem("goutstoso_v2", JSON.stringify(next)); } catch(e){} }
}, 30000);
return ()=>clearInterval(iv);
},[]);













  const isDesktop = useIsDesktop();
const pages = {
dashboard:   <Dashboard    st={st} setSt={setSt} setTab={setTab} authUser={authUser} sendEmail={sendEmail}/>,
ventes:      <Ventes       st={st} setSt={setSt}/>,
clients:     <Clients      st={st} setSt={setSt}/>,
stocks:      <Stocks       st={st} setSt={setSt}/>,
compta:      <Comptabilite st={st} setSt={setSt}/>,
production:  <Production   st={st} setSt={setSt}/>,
parametres:  <Parametres   st={st} setSt={setSt} authUser={authUser}/>,
// modules accessibles via drawer
produits:    <Produits     st={st} setSt={setSt}/>,
partenaires: <Partenaires  st={st} setSt={setSt}/>,
contrats:    <Contrats     st={st} setSt={setSt}/>,
factures:    <Factures     st={st} setSt={setSt}/>,
commandes:   <Commandes    st={st} setSt={setSt}/>,
fournisseurs:<Fournisseurs st={st} setSt={setSt}/>,
offres:      <Offres       st={st} setSt={setSt}/>,
documents:   <Documents    st={st} setSt={setSt}/>,
sauvegardes: <Sauvegardes  authUser={authUser} st={st} setSt={setSt}/>,
};

const allTabs = [...NAV_MAIN.filter(t=>t.id!=="more"), ...NAV_MORE];
const currentTab = allTabs.find(t=>t.id===tab);
const isMore = NAV_MORE.some(t=>t.id===tab);

const goTo = (id) => { setTab(id); setShowMore(false); setShowMenu(false); };

if(isDesktop) {
// ═══════════ DESKTOP LAYOUT ═══════════
const allMenus = [...NAV_MAIN.filter(t=>t.id!=="more"), ...NAV_MORE];
return (
<>
<style>{STYLE}</style>
<div style={{display:"flex",minHeight:"100vh",background:"var(--cream)"}}>

      {/* SIDEBAR */}
      <div style={{width:260,background:"#fff",borderRight:"1px solid #EAE7E0",padding:"20px 16px",display:"flex",flexDirection:"column",position:"fixed",height:"100vh",overflowY:"auto"}}>
        <div style={{padding:"4px 8px 20px",borderBottom:"1px solid #EAE7E0",marginBottom:16}}>
          <img src={LOGO_B64} alt="GoûtStoso" style={{width:120,height:"auto",objectFit:"contain",display:"block",marginBottom:4}}/>
          <p style={{fontSize:10,color:"#737373",marginTop:2}}>{authUser.display_name||authUser.username}</p>
        </div>
        
        {/* Solde bancaire en haut */}
        <div style={{background:"#0A0A0A",borderRadius:12,padding:"12px 14px",marginBottom:16,color:"#fff"}}>
          <p style={{fontSize:9,color:"#E8B64C",fontWeight:600,textTransform:"uppercase",letterSpacing:"0.04em"}}>Solde PostFinance</p>
          <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,fontWeight:700,color:"#fff",marginTop:2}}>{chf(st.soldeBancaire||0)}</p>
        </div>
        
        {/* Menu par catégories */}
        {[
          {groupe:null, items:[
            {id:"dashboard",  label:"Accueil",     emoji:"🏠"},
            {id:"clients",    label:"Clients",     emoji:"👥"},
            {id:"ventes",     label:"Ventes",      emoji:"💰"},
            {id:"production", label:"Production",  emoji:"🏭"},
            {id:"stocks",     label:"Stock",       emoji:"📦"},
            {id:"compta",     label:"Comptabilité",emoji:"📊"},
          ]},
          {groupe:"Modules détaillés", items:[
            {id:"partenaires", label:"Dépôts-vente",emoji:"🤝"},
            {id:"offres",      label:"Offres",      emoji:"📋"},
            {id:"factures",    label:"Factures",    emoji:"🧾"},
            {id:"commandes",   label:"Commandes",   emoji:"📦"},
            {id:"contrats",    label:"Contrats",    emoji:"📋"},
            {id:"fournisseurs",label:"Fournisseurs",emoji:"🏭"},
            {id:"produits",    label:"Produits",    emoji:"🍋"},
          ]},
          {groupe:"Plus", items:[
            {id:"documents",  label:"Documents légaux",emoji:"📜"},
            {id:"parametres", label:"Paramètres",      emoji:"⚙️"},
            {id:"sauvegardes",label:"Sauvegardes",     emoji:"💾"},
          ]},
        ].map((section,si)=>(
          <div key={si} style={{marginBottom:4}}>
            {section.groupe && (
              <p style={{fontSize:9,fontWeight:700,color:"#B5B2AB",textTransform:"uppercase",letterSpacing:".07em",padding:"10px 10px 4px"}}>{section.groupe}</p>
            )}
            {section.items.map(t=>{
              const active = tab===t.id;
              return (
                <button key={t.id} onClick={()=>setTab(t.id)} style={{
                  width:"100%",display:"flex",alignItems:"center",gap:9,
                  padding:"8px 10px",marginBottom:1,
                  border:"none",
                  background:active?"#FFFBEB":"transparent",
                  borderRadius:8,cursor:"pointer",textAlign:"left",
                  color:active?"#0A0A0A":"#525252",
                  fontSize:12.5,fontWeight:active?700:500,
                  borderLeft:active?"3px solid #F2C94C":"3px solid transparent",
                  transition:"background .12s",
                }}>
                  <span style={{fontSize:14,width:20,textAlign:"center",flexShrink:0}}>{t.emoji}</span>
                  {t.label}
                  {active && <span style={{marginLeft:"auto",width:5,height:5,borderRadius:"50%",background:"#F2C94C",flexShrink:0}}/>}
                </button>
              );
            })}
          </div>
        ))}
        
        <div style={{marginTop:"auto",paddingTop:16,borderTop:"1px solid #EAE7E0"}}>
          {/* Info utilisateur connecté */}
          <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",background:"#FAFAF7",borderRadius:8,marginBottom:8}}>
            <div style={{width:28,height:28,background:"#0A0A0A",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              <span style={{fontSize:12,color:"#fff",fontWeight:700}}>{(authUser.display_name||authUser.username).charAt(0).toUpperCase()}</span>
            </div>
            <div style={{flex:1,minWidth:0}}>
              <p style={{fontSize:11,fontWeight:600,color:"#0A0A0A",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{authUser.display_name||authUser.username}</p>
              <p style={{fontSize:9,color:"#737373"}}>{authUser.role==="admin"?"Administrateur":"Utilisateur"}</p>
            </div>
          </div>
          {/* Bouton admin (seulement pour admin) */}
          {authUser.role==="admin" && (
            <button onClick={()=>setShowAdmin(true)} style={{width:"100%",display:"flex",alignItems:"center",gap:8,padding:"7px 10px",background:"none",border:"1px solid #EAE7E0",borderRadius:8,cursor:"pointer",marginBottom:6,fontSize:12,color:"#525252"}}>
              <Ic n="settings" s={14}/> Administration
            </button>
          )}
          {/* Déconnexion */}
          <button onClick={handleLogout} style={{width:"100%",display:"flex",alignItems:"center",gap:8,padding:"7px 10px",background:"none",border:"1px solid #EAE7E0",borderRadius:8,cursor:"pointer",marginBottom:6,fontSize:12,color:"#B91C1C"}}>
            <Ic n="log-out" s={14}/> Déconnexion
          </button>
          {syncing && <p style={{fontSize:10,color:"#737373",textAlign:"center",marginTop:4}}>☁ Synchronisation...</p>}
          {!syncing && <p style={{fontSize:10,color:"#15803D",textAlign:"center",marginTop:4}}>✓ Synchronisé</p>}
        </div>
      </div>
      
      {/* MAIN CONTENT */}
      <div style={{flex:1,marginLeft:260,padding:"30px 40px",maxWidth:1400}}>
        {pages[tab]||pages.dashboard}
      </div>
    </div>
    {showAdmin && <AdminPanel currentUser={authUser} onClose={()=>setShowAdmin(false)}/>}
  </>
);

}

// ═══════════ MOBILE LAYOUT (default) ═══════════
return (
<>
<style>{STYLE}</style>
<div style={{display:"flex",flexDirection:"column",position:"fixed",top:0,bottom:0,left:"max(0px, calc(50% - 240px))",width:"min(100vw, 480px)",background:"var(--cream)"}}>

    {/* HEADER TOP */}
    <div style={{
      position:"fixed",top:0,left:"max(0px, calc(50% - 240px))",
      width:"min(100vw, 480px)",maxWidth:480,zIndex:50,
      background:"#FFFFFF",borderBottom:"1px solid var(--gray-mid)",
      padding:"10px 14px 8px",
      display:"flex",alignItems:"center",justifyContent:"space-between",
      gap:8,
    }}>
      {/* Hamburger */}
      <button onClick={()=>setShowMenu(true)} style={{background:"#F4F4F2",border:"none",borderRadius:9,width:36,height:36,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0}}>
        <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#0A0A0A" strokeWidth="2.2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
      </button>
      {/* Logo + page courante */}
      <div style={{display:"flex",alignItems:"center",gap:8,flex:1,minWidth:0}}>
        <img src={LOGO_B64} alt="GoûtStoso" style={{width:36,height:"auto",objectFit:"contain",flexShrink:0}}/>
        <p style={{fontSize:12,fontWeight:600,color:"#0A0A0A",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{currentTab?.label||"Accueil"}</p>
      </div>
      {/* Solde + actions */}
      <div style={{display:"flex",alignItems:"center",gap:5,flexShrink:0}}>
        <div style={{background:"var(--lemon-pale)",border:"1px solid var(--lemon)",borderRadius:7,padding:"3px 8px"}}>
          <p style={{fontSize:10,color:"var(--orange)",fontWeight:600,whiteSpace:"nowrap"}}>CHF {parseFloat(st.soldeBancaire||0).toFixed(2)}</p>
        </div>
        <button onClick={handleLogout} style={{background:"#FEF2F2",border:"none",borderRadius:8,padding:"6px 7px",cursor:"pointer",color:"#B91C1C"}} title="Déconnexion">
          <Ic n="log-out" s={14}/>
        </button>
      </div>
    </div>
    {showAdmin && <AdminPanel currentUser={authUser} onClose={()=>setShowAdmin(false)}/>}

    {/* CONTENU PRINCIPAL */}
    <div style={{flex:1,paddingTop:68,paddingLeft:16,paddingRight:16,paddingBottom:"calc(24px + env(safe-area-inset-bottom))",overflowY:"auto",background:"var(--cream)"}}>
      {pages[tab]||null}
    </div>

    {/* ── DRAWER MENU LATÉRAL ──────────────────────────── */}
    {/* Overlay */}
    {showMenu && <div onClick={()=>setShowMenu(false)} style={{position:"fixed",inset:0,zIndex:290,background:"rgba(0,0,0,.45)",backdropFilter:"blur(2px)"}}/>}
    {/* Drawer */}
    <div style={{
      position:"fixed",top:0,left:0,bottom:0,
      width:280,maxWidth:"80vw",
      zIndex:300,
      background:"#fff",
      boxShadow:"4px 0 32px rgba(0,0,0,.18)",
      display:"flex",flexDirection:"column",
      transform:showMenu?"translateX(0)":"translateX(-100%)",
      transition:"transform .28s cubic-bezier(.4,0,.2,1)",
      overflowY:"auto",
    }}>
      {/* Drawer header */}
      <div style={{padding:"16px 16px 12px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:"1px solid #F0EDE6",background:"#0A0A0A",flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <img src={LOGO_B64} alt="GoûtStoso" style={{width:32,height:"auto",objectFit:"contain"}}/>
          <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:17,fontWeight:700,color:"#F2C94C",letterSpacing:"-0.02em"}}>GoûtStoso</span>
        </div>
        <button onClick={()=>setShowMenu(false)} style={{background:"rgba(255,255,255,.1)",border:"none",borderRadius:"50%",width:30,height:30,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",color:"#fff"}}>
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      {/* User info */}
      <div style={{padding:"10px 14px",background:"#FAFAF7",borderBottom:"1px solid #F0EDE6",flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{width:28,height:28,background:"#0A0A0A",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center"}}>
            <span style={{fontSize:12,color:"#F2C94C",fontWeight:700}}>{(authUser.display_name||authUser.username).charAt(0).toUpperCase()}</span>
          </div>
          <div>
            <p style={{fontSize:11,fontWeight:600,color:"#0A0A0A"}}>{authUser.display_name||authUser.username}</p>
            <p style={{fontSize:9,color:"#737373"}}>Jordan Montanaro · admin@goutstoso.ch</p>
          </div>
        </div>
      </div>

      {/* Sections groupées */}
      <div style={{flex:1,padding:"8px 10px",overflowY:"auto"}}>
        {[
          {groupe:"Navigation principale", items:[
            {id:"dashboard",  label:"Accueil",    emoji:"🏠"},
            {id:"clients",    label:"Clients",    emoji:"👥"},
            {id:"ventes",     label:"Ventes",     emoji:"💰"},
            {id:"production", label:"Production", emoji:"🏭"},
            {id:"stocks",     label:"Stock",      emoji:"📦"},
            {id:"compta",     label:"Compta",     emoji:"📊"},
          ]},
          {groupe:"Modules détaillés", items:[
            {id:"partenaires", label:"Dépôts-vente",emoji:"🤝"},
            {id:"offres",      label:"Offres",      emoji:"📋"},
            {id:"factures",    label:"Factures",    emoji:"🧾"},
            {id:"commandes",   label:"Commandes",   emoji:"📦"},
            {id:"contrats",    label:"Contrats",    emoji:"📋"},
            {id:"fournisseurs",label:"Fournisseurs",emoji:"🏭"},
            {id:"produits",    label:"Produits",    emoji:"🍋"},
          ]},
          {groupe:"Plus", items:[
            {id:"documents",  label:"Documents légaux",emoji:"📜"},
            {id:"parametres", label:"Paramètres",      emoji:"⚙️"},
            {id:"sauvegardes",label:"Sauvegardes",     emoji:"💾"},
          ]},
        ].map((section,si)=>(
          <div key={si} style={{marginBottom:6}}>
            {section.groupe && (
              <p style={{fontSize:9,fontWeight:700,color:"#9CA3AF",textTransform:"uppercase",letterSpacing:".07em",padding:"8px 6px 4px"}}>{section.groupe}</p>
            )}
            {section.items.map(t=>{
              const active = tab===t.id;
              return (
                <button key={t.id} onClick={()=>goTo(t.id)} style={{
                  width:"100%",display:"flex",alignItems:"center",gap:10,
                  padding:"9px 10px",marginBottom:2,
                  border:"none",
                  background:active?"#FFFBEB":"transparent",
                  borderRadius:9,cursor:"pointer",textAlign:"left",
                  color:active?"#0A0A0A":"#525252",
                  fontSize:13,fontWeight:active?700:500,
                  borderLeft:active?"3px solid #F2C94C":"3px solid transparent",
                  transition:"background .12s,border-color .12s",
                }}>
                  <span style={{fontSize:16,width:22,textAlign:"center",flexShrink:0}}>{t.emoji}</span>
                  <span>{t.label}</span>
                  {active && <span style={{marginLeft:"auto",width:6,height:6,borderRadius:"50%",background:"#F2C94C",flexShrink:0}}/>}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Footer drawer */}
      <div style={{padding:"12px 14px",borderTop:"1px solid #F0EDE6",flexShrink:0}}>
        {authUser.role==="admin" && (
          <button onClick={()=>{setShowMenu(false);setShowAdmin(true);}} style={{width:"100%",display:"flex",alignItems:"center",gap:8,padding:"8px 10px",background:"none",border:"1px solid #EAE7E0",borderRadius:8,cursor:"pointer",marginBottom:6,fontSize:12,color:"#525252"}}>
            <Ic n="settings" s={14}/> Administration
          </button>
        )}
        <button onClick={handleLogout} style={{width:"100%",display:"flex",alignItems:"center",gap:8,padding:"8px 10px",background:"#FEF2F2",border:"none",borderRadius:8,cursor:"pointer",fontSize:12,color:"#B91C1C"}}>
          <Ic n="log-out" s={14}/> Déconnexion
        </button>
        {syncing && <p style={{fontSize:10,color:"#737373",textAlign:"center",marginTop:6}}>☁ Synchronisation...</p>}
        {!syncing && <p style={{fontSize:10,color:"#15803D",textAlign:"center",marginTop:6}}>✓ Synchronisé</p>}
      </div>
    </div>


  </div>
</>

);
}