import { useState, useCallback, useRef, useEffect } from "react";
import * as React from "react";
import { uid, chf, fmt, today, sum, genLot, exportCSV } from "../utils";
import { SOCIETE, CGV, INIT } from "../constants";
import { LOGO_B64, pdfLogo, IMG_LIMONTA_50CL, IMG_CLEMENTINO_50CL, IMG_LIMELO_50CL, IMG_LIMONTA_25CL, IMG_LIMELO_25CL, IMG_CLEMENTINO_25CL, IMG_COFFRET } from "../images";
import { Ic, Badge, Modal, F, Sel, Btn, Card, SectionTitle, getProchainRappelFn } from "../ui";
import { getImg, COULEURS, calcTotal, calcTotalNet } from "../helpers";

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

export const Comptabilite = ({st,setSt}) => {
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
        <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:17,fontWeight:700,color:resultat}}>=0?"#86EFAC":"#FCA5A5",marginTop:2}}>
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
    <Card style={{padding:"8px 5px",textAlign:"center",background:resultat}}>=0?"#DBEAFE":"#FEE2E2"}}>
      <p style={{fontSize:8,color:resultat}}>=0?"#1E3A5F":"#991B1B",fontWeight:700,textTransform:"uppercase"}}>Résultat</p>
      <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:15,fontWeight:700,color:resultat}}>=0?"#1E3A5F":"#991B1B",marginTop:2}}>{chf(resultat)}</p>
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
                      <span style={{color:res}}>=0?"#166534":"#991B1B",fontWeight:700}}>{res>=0?"+":""}{chf(res)}</span>
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
      <Card style={{background:resultat}}>=0?"#DCFCE7":"#FEE2E2",border:"2px solid "+(resultat>=0?"#22C55E":"#EF4444")}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{fontSize:14,fontWeight:700,color:resultat}}>=0?"#166534":"#991B1B"}}>RÉSULTAT NET</span>
          <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:19,fontWeight:700,color:resultat}}>=0?"#166534":"#991B1B"}}>{resultat>=0?"+":""}{chf(resultat)}</span>
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
                    <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,fontWeight:700,color:p.data.solde}}>=0?"#15803D":"#B91C1C"}}>{chf(p.data.solde)}</p>
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
                <p style={{fontSize:15,fontWeight:800,color:totalMarge}}>0?"#4ADE80":"#F87171",lineHeight:1}}>{chf(totalMarge)}</p>
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
                      <p style={{fontWeight:700,color:margePPct}}>30?"#15803D":margePPct>15?"#9A3412":"#B91C1C",marginTop:2}}>
                        {margePPct}% <span style={{fontSize:10,fontWeight:400}}>· {chf(margeP)}/u</span>
                      </p>
                    </div>
                    <div style={{background:"#F4F4F2",borderRadius:6,padding:"6px 8px"}}>
                      <p style={{color:"#737373",fontSize:10,fontWeight:500}}>PRO {chf(p.prixRevendeur)}</p>
                      <p style={{fontWeight:700,color:margeProPct}}>30?"#15803D":margeProPct>15?"#9A3412":"#B91C1C",marginTop:2}}>
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
                        <p style={{fontSize:8,color:margeGeneree}}>0?"#15803D":"#B91C1C",fontWeight:600,textTransform:"uppercase"}}>Marge</p>
                        <p style={{fontSize:13,fontWeight:700,color:margeGeneree}}>0?"#15803D":"#B91C1C",marginTop:1}}>{chf(margeGeneree)}</p>
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

