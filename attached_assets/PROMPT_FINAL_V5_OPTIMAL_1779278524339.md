# 🎯 PROMPT REPLIT AGENT V5 FINAL — APPLICATION OPTIMALE GOÛTSTOSO

## Refonte workflow commercial avec UX fluide et logique

---

## 🛑 INSTRUCTION CRITIQUE N°0 — ANALYSE PRÉALABLE OBLIGATOIRE

**AVANT TOUTE MODIFICATION**, tu dois :

1. **Lire l'intégralité du fichier `index.tsx`** (ou équivalent) de l'application actuelle
2. **Faire l'inventaire complet** :
   - Tous les composants existants (lister noms et lignes)
   - Toutes les fonctions existantes
   - Toute la structure de l'objet `INIT` (state)
   - Tous les automatismes en place
   - Toutes les images base64
   - Toutes les constantes (SOCIETE, CGV, PLAN_COMPTABLE, etc.)
3. **Faire un rapport** de cet inventaire au début de ton travail
4. **Demander confirmation** avant de commencer les modifications

**NE COMMENCE AUCUNE MODIFICATION SANS AVOIR FAIT CE RAPPORT D'INVENTAIRE.**

---

## 🛑 RÈGLE DE PRÉSERVATION ABSOLUE

### Principe directeur
**Tu fais des AJOUTS, jamais des REMPLACEMENTS.**

- ✅ Si quelque chose existe déjà, tu l'utilises tel quel
- ✅ Tu l'étends en gardant l'existant intact
- ❌ Tu ne réécris JAMAIS de zéro
- ❌ Tu ne supprimes JAMAIS

### Sauvegarde préventive
Avant TOUTE modification :
1. Créer `index_tsx_BACKUP_AVANT_REFONTE.tsx`
2. Confirmer la sauvegarde à l'utilisateur
3. Seulement ensuite, modifier

---

## 📋 ÉLÉMENTS À PROTÉGER ABSOLUMENT

### Données existantes
- Partenaire Temple 5 (Khaldoun Aweidah)
- Client Madame Nicole Nuara
- Facture FAC-2026-001
- 28 transactions comptables
- 6 dépôts actifs
- Commande #1005
- Solde PostFinance : 783.24 CHF
- 10 produits avec images base64
- 7 documents légaux templates

### Constantes intouchables
- `LOGO_B64` et images base64 produits
- `SOCIETE`, `CGV` (21 articles), `PLAN_COMPTABLE`
- `CATEGORIES_RECETTE`, `CATEGORIES_DEPENSE`
- Palette : noir #0A0A0A, jaune #E8B64C, crème #FAFAF7
- Polices Inter + Cormorant Garamond
- IBAN : CH23 0900 0000 1565 1485 8
- Sync API : `https://hc12z9cbqiy.preview.infomaniak.website/api.php`

### Composants intouchables
Dashboard, Produits, Stocks, SignaturePad, Partenaires, Contrats, Factures, Comptabilite, Commandes, Clients, Ic, Badge, Modal, F, Sel, Btn, Card, SectionTitle

### Automatismes intouchables
- Facture payée → écriture compta auto
- Dépense payée → écriture compta auto
- Vente → impact stock auto
- Inventaire dépôt → calcul vendus + facture auto
- Sync cloud Infomaniak après chaque modification
- Solde PostFinance maj auto

---

## ⭐ PRIORITÉ N°1 — UX FLUIDE ET LOGIQUE

### Philosophie de l'application

L'objectif n'est PAS d'ajouter le plus de fonctionnalités possible.
L'objectif est que **Jordan passe d'une étape à l'autre du workflow commercial sans réfléchir**, sans avoir à chercher où cliquer, sans devoir ressaisir des informations.

### Les 6 principes UX impératifs

#### Principe 1 : ENCHAÎNEMENT NATUREL
Chaque action mène **logiquement** à la suivante.

```
Exemple :
Je viens de créer une offre → bouton "Envoyer par email" visible
Offre acceptée → bouton "Préparer la livraison" visible
Livraison faite → bouton "Créer la facture" visible
Facture envoyée → bouton "Marquer payée" visible
```

**RÈGLE** : à chaque étape, le bouton de l'étape suivante doit être **visible et évident**.

#### Principe 2 : ZÉRO RESSAISIE
Toutes les infos déjà saisies se propagent automatiquement.

```
Exemple :
Prospect créé avec nom/adresse/email
    ↓ conversion en client
Toutes les infos reprises automatiquement
    ↓ création offre
Coordonnées pré-remplies
    ↓ acceptation
Bulletin de commande pré-rempli
    ↓ livraison
Bulletin de livraison pré-rempli
    ↓ facture
Facture pré-remplie
```

**RÈGLE** : Jordan ne ressaisit JAMAIS deux fois la même information.

#### Principe 3 : 1 ÉCRAN = 1 ACTION CLAIRE
Chaque écran doit avoir **une action principale évidente**.

```
Mauvais : 15 boutons éparpillés
Bon : 1 gros bouton "Action principale" + 2-3 actions secondaires
```

**RÈGLE** : sur chaque écran, identifier l'action principale et la mettre en évidence (couleur, taille, position).

#### Principe 4 : NAVIGATION CONTEXTUELLE
Depuis n'importe quel élément, on accède aux éléments liés.

```
Exemple :
Sur une facture → lien vers commande, vers client, vers bulletin
Sur un client → lien vers ses factures, offres, commandes, archives
Sur une commande → lien vers facture, bulletin, contrat
```

**RÈGLE** : tout est cliquable et mène à l'élément lié.

#### Principe 5 : ÉTAT VISUEL TOUJOURS CLAIR
Jordan doit comprendre en 1 seconde où on en est.

```
Statuts colorés cohérents :
🟡 En cours / brouillon
🟠 En attente
🔵 Vue / consultée
🟢 Validée / signée / payée
🔴 Refusée / en retard / problème
⚫ Expirée / annulée
```

**RÈGLE** : utiliser les **mêmes codes couleurs** partout dans l'app.

#### Principe 6 : ACTIONS RAPIDES (1 CLIC)
Les actions fréquentes en 1 clic depuis le dashboard.

```
Dashboard → boutons d'accès direct :
+ Nouveau prospect
+ Nouvelle offre
+ Nouvelle facture
+ Nouvelle vente directe
+ Importer commande Shopify
```

**RÈGLE** : tout ce qu'on fait souvent doit être accessible en 1 clic depuis l'accueil.

---

## 🎯 LE PARCOURS UTILISATEUR OPTIMAL

### Scénario type "Nouveau client épicerie fine"

Voici le parcours que Jordan doit pouvoir faire **sans jamais se perdre** :

```
ÉTAPE 1 : "Une épicerie m'a contacté"
    ↓
[Dashboard] → Bouton "+ Nouveau prospect" (en évidence)
    ↓
Formulaire prospect : nom, contact, ville, source
    ↓ (clic "Enregistrer")
    ↓
Sur la fiche prospect créée :
"Que voulez-vous faire ?"
[📞 Ajouter une interaction]
[📧 Envoyer un email de présentation]  ← suggéré en évidence
[💼 Préparer une offre]
    ↓
Choisit "Envoyer email présentation"
    ↓
Email template P1 pré-rempli, ouvre Outlook
    ↓
RETOUR fiche prospect, statut auto → "Contacté"
"Prochaine action programmée : Relancer dans 7 jours"
    ↓
[7 jours plus tard]
    ↓
[Dashboard] Section "À faire aujourd'hui" :
"⚠️ Relancer Caves du Léman (contact J+7)"
    ↓ (clic)
Fiche prospect avec bouton suggéré "📧 Relance template P4"
    ↓
Client répond positivement
    ↓
[Sur fiche prospect] Bouton "💼 Préparer une offre" en évidence
    ↓
Formulaire offre en 4 étapes (toutes infos pré-remplies)
    ↓
PDF généré, bouton "📧 Envoyer par email" en évidence
    ↓
Email O1 pré-rempli avec lien signature en ligne
    ↓
[Statut offre : Envoyée]
    ↓
Client signe en ligne (sur son téléphone)
    ↓
[Dashboard] Notification : "✅ Caves du Léman a signé !"
    ↓ (clic)
Page : "Offre acceptée. Cascade automatique :"
✅ Prospect converti en client
✅ Bulletin de commande créé
✅ Bulletin de livraison préparé
✅ Facture en brouillon
    ↓
Bouton "🚚 Préparer la livraison" en évidence
    ↓
Date livraison saisie, liste de picking imprimable
    ↓
[Jour de la livraison]
Bouton "✅ Livraison effectuée"
    ↓
SignaturePad pour signature client
    ↓
Cascade auto :
✅ Stock -X
✅ Facture activée (statut "À envoyer")
    ↓
Bouton "💰 Envoyer la facture" en évidence
    ↓
PDF facture + QR-facture + CGV en annexe
Email F1 pré-rempli
    ↓
[Statut facture : Envoyée]
"Échéance dans 30 jours - relance auto programmée"
    ↓
[30 jours plus tard]
Si pas payée : Dashboard → "⚠️ Facture FAC-XXX en retard"
Bouton "📧 Envoyer rappel R1" en évidence
    ↓
[Paiement reçu]
Bouton "✅ Marquer comme payée" 
    ↓
Cascade auto :
✅ Écriture comptable créée
✅ Solde PostFinance mis à jour
✅ Facture archivée dans fiche client
✅ Email F2 (confirmation paiement) suggéré
    ↓
FIN DU CYCLE → tout est tracé, archivé, ressortable.
```

**À AUCUN MOMENT** Jordan ne doit chercher où aller. Le **chemin est tracé devant lui**.

---

## 🗺️ STRUCTURE DE NAVIGATION OPTIMISÉE

### Menu principal (mobile bottom bar + desktop sidebar)

**MAX 6 onglets principaux** pour ne pas surcharger :

```
🏠 Accueil
🎯 Pipeline (Prospects + Offres + Bulletins regroupés)
👥 Clients (Clients + Partenaires fusionnés visuellement)
💰 Ventes (Factures + Commandes + Ventes directes + Shopify)
📦 Stock & Production
📊 Compta
```

### Menu "Plus" (icône ⋯)
- 📜 Documents légaux
- 📧 Templates emails
- 🍋 Recettes
- 🏭 Fournisseurs
- ⚙️ Paramètres

### Bouton flottant "➕" (mobile)
Toujours visible en bas à droite, ouvre un menu rapide :
- ➕ Nouveau prospect
- ➕ Nouvelle offre
- ➕ Nouvelle facture
- ➕ Vente directe
- ➕ Importer commande Shopify

---

## 🎨 PAGE D'ACCUEIL OPTIMISÉE (Dashboard)

### Structure visuelle (du haut vers le bas)

```
┌─────────────────────────────────────────────┐
│  Bonjour Jordan 🍋                           │
│  Mardi 20 mai 2026                          │
├─────────────────────────────────────────────┤
│                                             │
│  ⚡ ACTIONS DU JOUR (3 priorités max)        │
│  ┌─────────────────────────────────────┐   │
│  │ 🔥 Mise en demeure FAC-2026-003     │   │
│  │ [Voir]                              │   │
│  └─────────────────────────────────────┘   │
│  ┌─────────────────────────────────────┐   │
│  │ ⚠️ Relancer Caves du Léman (J+12)   │   │
│  │ [Voir]                              │   │
│  └─────────────────────────────────────┘   │
│  ┌─────────────────────────────────────┐   │
│  │ 📦 2 commandes Shopify à expédier   │   │
│  │ [Voir]                              │   │
│  └─────────────────────────────────────┘   │
│                                             │
├─────────────────────────────────────────────┤
│                                             │
│  💰 CHIFFRES CLÉS DU MOIS                    │
│  CA encaissé : 2'340 CHF                    │
│  Factures à encaisser : 1'890 CHF           │
│  Solde PostFinance : 783.24 CHF             │
│                                             │
├─────────────────────────────────────────────┤
│                                             │
│  📊 PIPELINE COMMERCIAL                      │
│  🎯 12 prospects   💼 5 offres en attente   │
│  📦 3 commandes    💰 8 factures            │
│                                             │
├─────────────────────────────────────────────┤
│                                             │
│  ⚡ ACTIONS RAPIDES                          │
│  [+ Prospect] [+ Offre] [+ Facture]         │
│  [+ Vente directe] [+ Shopify]              │
│                                             │
├─────────────────────────────────────────────┤
│                                             │
│  📈 PERFORMANCE                              │
│  [Graphique CA des 6 derniers mois]         │
│                                             │
└─────────────────────────────────────────────┘
```

**RÈGLE** : Jordan doit pouvoir agir en moins de 10 secondes après ouverture de l'app.

---

## 🔗 LIENS CONTEXTUELS PARTOUT

### Sur une fiche client

```
┌─────────────────────────────────────┐
│ 🏪 Caves du Léman                    │
│ [📞 Appeler] [📧 Email] [✏️ Éditer] │
├─────────────────────────────────────┤
│ 📋 ONGLETS (cliquables)              │
│ [Infos] [Timeline] [Offres]         │
│ [Commandes] [Factures] [Archives]   │
├─────────────────────────────────────┤
│ ⚡ ACTIONS PRINCIPALES               │
│ [💼 Nouvelle offre]  ← en évidence  │
│ [📞 Ajouter interaction]            │
│ [📦 Inventaire dépôt]               │
└─────────────────────────────────────┘
```

### Sur une offre

```
┌─────────────────────────────────────┐
│ 💼 Offre OFF-2026-001                │
│ Caves du Léman · 438.00 CHF         │
│ Statut : 🟠 Envoyée                  │
├─────────────────────────────────────┤
│ Lien vers :                          │
│ → Client : Caves du Léman           │
│ → Prospect d'origine                 │
├─────────────────────────────────────┤
│ ⚡ ACTION SUGGÉRÉE                   │
│ [📧 Relancer le client]  ← évidence │
│                                     │
│ Autres actions :                    │
│ [📥 Télécharger PDF complet]        │
│ [✏️ Modifier]                       │
│ [❌ Marquer refusée]                │
└─────────────────────────────────────┘
```

### Sur une facture

```
┌─────────────────────────────────────┐
│ 💰 Facture FAC-2026-005              │
│ Caves du Léman · 438.00 CHF         │
│ Statut : 🟠 Envoyée (J+15)           │
├─────────────────────────────────────┤
│ Lien vers :                          │
│ → Client : Caves du Léman           │
│ → Commande #1006                    │
│ → Bulletin de livraison BL-XXX      │
├─────────────────────────────────────┤
│ ⚡ ACTION SUGGÉRÉE                   │
│ [✅ Marquer comme payée] ← évidence │
│                                     │
│ Autres actions :                    │
│ [📧 Envoyer rappel R1]              │
│ [📥 Télécharger PDF]                │
│ [✏️ Modifier]                       │
└─────────────────────────────────────┘
```

---

## 📋 CHEMINS NAVIGUABLES (BREADCRUMBS)

Sur chaque page, afficher le chemin pour ne jamais se perdre :

```
🏠 Accueil > 🎯 Pipeline > 💼 Offres > OFF-2026-001
```

**Tous les éléments sont cliquables** pour remonter facilement.

---

## 🎯 ÉTATS VISUELS COHÉRENTS

### Codes couleurs universels (à utiliser PARTOUT dans l'app)

```javascript
const STATUTS_COULEURS = {
  // Brouillons
  brouillon: { couleur: "#FCD34D", emoji: "🟡", label: "Brouillon" },
  
  // En attente
  envoye: { couleur: "#FB923C", emoji: "🟠", label: "Envoyé" },
  en_attente: { couleur: "#FB923C", emoji: "🟠", label: "En attente" },
  
  // Vue / Consulté
  consulte: { couleur: "#60A5FA", emoji: "🔵", label: "Consulté" },
  vu: { couleur: "#60A5FA", emoji: "🔵", label: "Vu" },
  
  // Validé / Positif
  signe: { couleur: "#34D399", emoji: "🟢", label: "Signé" },
  paye: { couleur: "#34D399", emoji: "🟢", label: "Payé" },
  livre: { couleur: "#34D399", emoji: "🟢", label: "Livré" },
  accepte: { couleur: "#34D399", emoji: "🟢", label: "Accepté" },
  
  // Problème / Négatif
  refuse: { couleur: "#F87171", emoji: "🔴", label: "Refusé" },
  retard: { couleur: "#F87171", emoji: "🔴", label: "En retard" },
  perdu: { couleur: "#F87171", emoji: "🔴", label: "Perdu" },
  
  // Inactif
  expire: { couleur: "#9CA3AF", emoji: "⚫", label: "Expiré" },
  annule: { couleur: "#9CA3AF", emoji: "⚫", label: "Annulé" },
  archive: { couleur: "#9CA3AF", emoji: "⚫", label: "Archivé" }
};
```

**RÈGLE** : ces codes sont **utilisés partout** (prospects, offres, factures, commandes, etc.) pour que Jordan apprenne **une fois** et reconnaisse partout.

---

## 🔧 MODULES À AJOUTER

### MODULE 1 : 🎯 PROSPECTS

**Structure de données** :
```javascript
prospects: [{
  id: "prosp_001",
  dateCreation: "2026-05-20",
  nomEtablissement: "",
  typeEtab: "cave",
  contactNom: "",
  contactFonction: "",
  email: "",
  telephone: "",
  adresse: "",
  npa: "",
  ville: "",
  canton: "",
  site: "",
  source: "instagram",
  statut: "a_contacter",
  score: 4,
  notes: "",
  interactions: [],
  echantillonsLaisses: [],
  motifRefus: null,
  convertiEnClientId: null,
  convertiEnPartenaireId: null,
  prochaineActionDate: null,
  prochaineActionType: ""
}]
```

**Fluidité** :
- Création prospect → bouton "📧 Envoyer email de présentation" en évidence
- Email envoyé → statut auto "Contacté", "Prochaine action : Relancer J+7"
- Suggestion auto de la prochaine action selon le statut

---

### MODULE 2 : 💼 OFFRES

**Structure** :
```javascript
offres: [{
  id: "off_001",
  numero: "OFF-2026-001",
  dateCreation: "",
  dateValidite: "",
  prospectId: null,
  clientId: null,
  partenaireId: null,
  typeOffre: "vente_ferme",
  lignes: [],
  sousTotal: 0,
  remiseGlobale: 0,
  totalHT: 0,
  conditionsLivraison: "",
  conditionsPaiement: "30j",
  echantillonsOfferts: [],
  notesInternes: "",
  statut: "brouillon",
  dateEnvoi: null,
  lienSignature: null,
  tokenSignature: null,
  dateConsultation: null,
  dateAcceptation: null,
  signatureClient: null,
  signatureNom: "",
  signatureIP: "",
  convertieEnBulletinCommandeId: null,
  convertieEnFactureId: null
}]
```

**Fluidité** :
- Création en 4 étapes guidées (next/back)
- Aperçu PDF en direct
- Bouton "Envoyer" → email O1 pré-rempli
- Acceptation → cascade auto avec notification claire

---

### MODULE 3 : 📝 BULLETINS DE COMMANDE

```javascript
bulletinsCommande: [{
  id: "bc_001",
  numero: "BC-2026-001",
  dateCreation: "",
  origine: "offre",
  offreId: null,
  clientId: null,
  partenaireId: null,
  lignes: [],
  totalHT: 0,
  modeReglement: "30j",
  dateLivraisonPrevue: null,
  statut: "brouillon",
  lienSignature: null,
  dateSignature: null,
  signatureClient: null,
  bulletinLivraisonId: null,
  factureId: null
}]
```

---

### MODULE 4 : 🚚 BULLETINS DE LIVRAISON

```javascript
bulletinsLivraison: [{
  id: "bl_001",
  numero: "BL-2026-001",
  dateCreation: "",
  dateLivraison: null,
  bulletinCommandeId: null,
  clientId: null,
  partenaireId: null,
  lignes: [],
  totalBouteilles: 0,
  reservesClient: "",
  statut: "a_livrer",
  signatureClient: null,
  signatureNom: ""
}]
```

---

### MODULE 5 : 🌐 IMPORT SHOPIFY MANUEL

```javascript
ventesShopify: [{
  id: "vs_001",
  orderNumberShopify: "",
  dateCommande: "",
  clientShopify: {},
  lignes: [],
  totalTTC: 0,
  fraisPort: 0,
  statutPaiement: "paye",
  statutExpedition: "a_preparer",
  numeroSuivi: "",
  transporteur: "",
  dateExpedition: null,
  bulletinLivraisonId: null,
  importeMethode: "manuel_formulaire",
  dateImport: ""
}]
```

**3 méthodes d'import** :
- Formulaire manuel (saisie complète)
- Copier-coller (parsing automatique)
- Import CSV (futur)

**Pas d'intégration API automatique pour l'instant.**

---

### MODULE 6 : 🏠 VENTES DIRECTES

```javascript
ventesDirectes: [{
  id: "vd_001",
  numero: "VD-2026-001",
  dateVente: "",
  typeVente: "sur_place",
  canalContact: "visite",
  client: {},
  lignes: [],
  totalTTC: 0,
  modeReglement: "twint",
  statutPaiement: "paye",
  recuPDFGenere: false
}]
```

---

### MODULE 7 : 📧 TEMPLATES EMAILS

**27 templates pré-rédigés en 9 catégories**.

**Style impératif** :
- Ton humain, chaleureux, pro
- Phrases courtes, vouvoiement
- Caractères ASCII uniquement
- Pas d'emojis dans emails pro
- Pas de "Je me réjouis de", "C'est avec un grand plaisir"
- Signature : "Jordan Montanaro - Goûtstoso"

### Catégories et templates

#### 🎯 Prospection (5)

**P1 - Premier contact épicerie fine**
```
Sujet : Liqueurs artisanales du Jura - Goûtstoso

Bonjour [NOM],

Je vous écris depuis Villeret où je fabrique des liqueurs 
artisanales sous le nom Goûtstoso.

Ma gamme actuelle compte sept liqueurs : Limonta (citron), 
Limelo (citron vert), Clementino, Pescato (pêche), 
Fraisetta, Lamponia (framboise) et Caffetto (café). 
Toutes sont produites à la main, en petites séries, à 
30% vol.

J'aimerais beaucoup vous les faire goûter. Auriez-vous 
quelques minutes la semaine prochaine pour que je passe 
vous présenter le travail ?

Je peux me déplacer chez vous quand cela vous arrange.

Bonne journée,
Jordan Montanaro
Goûtstoso
admin@goutstoso.ch
```

**P2 - Premier contact cave à vins**
```
Sujet : Liqueurs artisanales suisses pour votre cave

Bonjour [NOM],

J'ai découvert votre cave [NOM_CAVE] et je pense que 
mes liqueurs pourraient avoir leur place chez vous.

Je m'appelle Jordan Montanaro, je suis basé à Villeret 
dans le Jura bernois, et je fabrique sept liqueurs 
artisanales à 30% vol. : agrumes, fruits rouges, pêche 
et café.

Production en petites séries, ingrédients frais, sans 
arôme artificiel.

Si vous êtes ouvert à la dégustation, je peux passer 
chez vous avec quelques échantillons quand cela vous 
convient.

Au plaisir d'échanger,
Jordan Montanaro
Goûtstoso
```

**P3 - Après visite, P4 - Relance 7j, P5 - Relance 30j**
(Voir prompts précédents pour le contenu complet)

#### 💼 Suivi offres (3) : O1, O2, O3
#### 📦 Commandes/Livraisons (2) : C1, C2
#### 💰 Facturation (2) : F1, F2
#### ⚠️ Relances (3) : R1, R2, R3
#### 🤝 Relation client (3) : RC1, RC2, RC3
#### 🎉 Saisonnier (2) : S1, S2
#### 📰 Newsletter (1) : N1
#### 🌐 Shopify B2C (3) : SH1, SH2, SH3

---

## ✍️ SIGNATURE EN LIGNE

**Pour 3 documents** : Offres, Bulletins de commande, Contrats

```javascript
function genererLienSignature(document, type) {
  const token = genererTokenSecurise(32);
  const baseURL = window.location.origin;
  const lien = `${baseURL}/signature/${type}/${document.id}?token=${token}`;
  document.tokenSignature = token;
  document.lienSignature = lien;
  return lien;
}
```

**Route publique** : `/signature/:type/:docId`
- Vérification token
- PDF en lecture
- Boutons Accepter/Refuser/Demander modif
- SignaturePad existant pour signature
- Capture IP + date + user agent
- Token usage unique, validité 30j

---

## 📞 RELANCES AUTOMATIQUES

**Composant `Relances`** centralisé.

```javascript
function calculerRelancesAuto(st) {
  const relances = [];
  
  st.prospects.forEach(p => {
    if (["contacte", "interesse"].includes(p.statut) 
        && joursDepuis(p.derniereInteraction) >= 7) {
      relances.push({ type: "prospect_relance", priorite: "moyenne", prospectId: p.id, template: "P4" });
    }
  });
  
  st.offres.forEach(o => {
    if (o.statut === "envoyee" && joursDepuis(o.dateEnvoi) >= 10) {
      relances.push({ type: "offre_relance", priorite: "haute", offreId: o.id, template: "O2" });
    }
  });
  
  st.factures.forEach(f => {
    if (f.statut === "envoyee") {
      const retard = joursDepuis(f.dateEcheance);
      if (retard >= 60) relances.push({ type: "mise_en_demeure", priorite: "critique", factureId: f.id, template: "R3" });
      else if (retard >= 30) relances.push({ type: "rappel_2", priorite: "haute", factureId: f.id, template: "R2" });
      else if (retard >= 5) relances.push({ type: "rappel_1", priorite: "moyenne", factureId: f.id, template: "R1" });
    }
  });
  
  return relances;
}
```

---

## 📄 PDF AVEC ANNEXES LÉGALES

```javascript
const ANNEXES_OBLIGATOIRES = {
  offre: ["cgv", "charte_alcool"],
  bulletin_commande: ["cgv", "charte_alcool"],
  bulletin_livraison: ["charte_alcool"],
  facture: ["cgv"],
  contrat_depot_vente: ["cgv", "charte_alcool"],
  contrat_partenariat: ["cgv", "charte_alcool", "nda"],
  recu_vente_directe: [],
  bon_retour: ["cgv"]
};
```

**Deux boutons sur chaque document** :
- 📥 PDF complet (document + annexes)
- 📦 ZIP avec PJ séparées

---

## 🔄 AUTOMATISMES À MAINTENIR ABSOLUMENT

**CRITIQUE** : ces automatismes existent déjà. Tu les CONSERVES tels quels.

- Facture payée → écriture compta auto
- Dépense payée → écriture compta auto
- Inventaire dépôt → facture auto
- Sync cloud Infomaniak
- Vente → impact stock

**Nouveaux à brancher** :
- Vente Shopify importée → compta auto
- Vente directe payée → compta auto
- Cascade offre → BC → BL → facture

---

## ✅ TESTS DE NON-RÉGRESSION

1. ✅ Auth fonctionne
2. ✅ Sync Infomaniak OK
3. ✅ TOUTES données existantes intactes
4. ✅ Création facture → écriture compta auto
5. ✅ Facture payée → solde PostFinance maj
6. ✅ Vente Shopify importée → compta auto
7. ✅ Vente directe payée → compta auto
8. ✅ Inventaire dépôt → facture auto
9. ✅ Dépense → écriture compta auto
10. ✅ PDF avec annexes légales OK
11. ✅ SignaturePad fonctionne
12. ✅ Signature en ligne fonctionne
13. ✅ Mobile responsive
14. ✅ Images base64 affichées
15. ✅ Logo sur tous les PDFs

### NOUVEAUX tests UX

16. ✅ Sur chaque écran, l'action principale est évidente
17. ✅ Bouton "étape suivante" toujours visible après une action
18. ✅ Aucune ressaisie nécessaire dans le workflow
19. ✅ Codes couleurs cohérents partout
20. ✅ Breadcrumbs sur toutes les pages
21. ✅ Bouton "+" flottant accessible sur mobile
22. ✅ Dashboard montre les 3 actions du jour en évidence
23. ✅ Navigation entre éléments liés en 1 clic
24. ✅ Statuts visuels cohérents (couleurs + emojis)
25. ✅ Cascade automatique fonctionne (offre → BC → BL → facture)

---

## 🚀 PRIORITÉS DE DÉVELOPPEMENT

### Phase 0 - PRÉALABLE
1. Lire et inventorier code existant
2. Créer sauvegarde
3. Rapport à l'utilisateur

### Phase 1 - Essentiel (avec UX dès le départ)
4. Module Prospects (avec actions suggérées)
5. Module Offres avec PDF auto (cascade auto)
6. Bulletins de commande
7. Bulletins de livraison
8. **Application des 6 principes UX**
9. **Codes couleurs universels**
10. **Maintien tous automatismes compta**

### Phase 2 - Important
11. Signature en ligne (offres, BC, contrats)
12. Bibliothèque Templates Emails (27 templates)
13. Relances automatiques
14. PDFs avec annexes légales
15. Module Import Shopify manuel
16. Module Ventes directes

### Phase 3 - Confort
17. Vue 360° client/partenaire
18. Dashboard commercial multi-canaux
19. Bouton flottant "+" mobile
20. Breadcrumbs partout
21. Archives ZIP par client

---

## 🎯 OBJECTIF FINAL — APPLICATION OPTIMALE

Une application où Jordan :

**EN OUVRANT L'APP**
✅ Voit en 1 seconde les 3 actions du jour
✅ Comprend immédiatement les chiffres clés
✅ Peut lancer une action en 1 clic

**EN UTILISANT L'APP**
✅ Passe d'une étape à l'autre sans réfléchir
✅ Ne ressaisit jamais une information
✅ Voit toujours le bouton de l'étape suivante
✅ Comprend les statuts grâce aux couleurs cohérentes

**DANS SON QUOTIDIEN**
✅ N'oublie jamais une relance (alertes auto)
✅ Génère ses documents en 1 clic (PDFs auto)
✅ Envoie ses emails avec des templates humains prêts
✅ A toutes ses archives à 1 clic par client

**EN COULISSE**
✅ Sa compta se fait toute seule (automatismes maintenus)
✅ Son stock se met à jour automatiquement
✅ Ses données sont synchronisées sur Infomaniak
✅ Ses PDFs ont toujours les annexes légales

**Le tout sans rien casser des automatismes et données existantes.**

---

## ⚠️ RAPPEL FINAL CRITIQUE

**AVANT DE COMMENCER** :
1. Lire intégralité du code actuel
2. Faire rapport d'inventaire à l'utilisateur
3. Créer sauvegarde `index_tsx_BACKUP_AVANT_REFONTE.tsx`
4. Attendre confirmation de l'utilisateur

**PENDANT LE DÉVELOPPEMENT** :
- Tu fais des AJOUTS, jamais des remplacements
- L'UX fluide est PRIORITAIRE sur les nouvelles features
- Codes couleurs cohérents PARTOUT
- Bouton "action suivante" évident sur chaque écran
- Aucune ressaisie d'information dans le workflow

**TESTS PERMANENTS** :
- Après chaque module, vérifier que les automatismes compta marchent
- Vérifier que les données existantes sont préservées
- Tester sur mobile + desktop

---

**FIN DU PROMPT V5 FINAL. Implémenter en respectant les 6 principes UX et les règles de préservation.**
