import { useState, useCallback, useRef, useEffect } from "react";
import * as React from "react";
import { uid, chf, fmt, today, sum, genLot, exportCSV } from "../utils";
import { SOCIETE, CGV, INIT } from "../constants";
import { LOGO_B64, pdfLogo, IMG_LIMONTA_50CL, IMG_CLEMENTINO_50CL, IMG_LIMELO_50CL, IMG_LIMONTA_25CL, IMG_LIMELO_25CL, IMG_CLEMENTINO_25CL, IMG_COFFRET } from "../images";
import { Ic, Badge, Modal, F, Sel, Btn, Card, SectionTitle, getProchainRappelFn } from "../ui";
import { getImg, COULEURS, calcTotal, calcTotalNet } from "../helpers";

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

export const Production = ({st, setSt}) => {
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
                    <p style={{fontSize:10,fontWeight:600,marginTop:2,color:(anaRecette.stockNet25||0)+eff25}}>=(anaRecette.cible25||20)?"#15803D":"#F59E0B"}}>
                      {(anaRecette.stockNet25||0)+eff25>=(anaRecette.cible25||20)?"✅ Stock parfait":"⚠ En dessous cible"}
                    </p>
                  </div>
                )}
                {anaRecette.p50 && (
                  <div style={{textAlign:"center",background:"#fff",borderRadius:8,padding:"10px 8px"}}>
                    <p style={{fontSize:10,color:"#9CA3AF",marginBottom:2}}>500 ml</p>
                    <p style={{fontSize:24,fontWeight:800,color:"#15803D"}}>{(anaRecette.stockNet50||0)+eff50}</p>
                    <p style={{fontSize:10,color:"#9CA3AF"}}>/ {anaRecette.cible50||20} cible</p>
                    <p style={{fontSize:10,fontWeight:600,marginTop:2,color:(anaRecette.stockNet50||0)+eff50}}>=(anaRecette.cible50||20)?"#15803D":"#F59E0B"}}>
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

