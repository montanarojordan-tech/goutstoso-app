import { sum } from "./utils";
import {
  IMG_LIMONTA_25CL, IMG_LIMONTA_50CL,
  IMG_LIMELO_25CL,  IMG_LIMELO_50CL,
  IMG_CLEMENTINO_25CL, IMG_CLEMENTINO_50CL,
  IMG_COFFRET,
} from "./images";

export const getImg = (p: any): string | null => {
  if (p.photoUrl) return p.photoUrl;
  const map: Record<string, string | null> = {
    IMG_LIMONTA_25CL:  typeof IMG_LIMONTA_25CL  !== "undefined" ? IMG_LIMONTA_25CL  : null,
    IMG_LIMONTA_50CL:  typeof IMG_LIMONTA_50CL  !== "undefined" ? IMG_LIMONTA_50CL  : null,
    IMG_LIMELO_25CL:   typeof IMG_LIMELO_25CL   !== "undefined" ? IMG_LIMELO_25CL   : null,
    IMG_LIMELO_50CL:   typeof IMG_LIMELO_50CL   !== "undefined" ? IMG_LIMELO_50CL   : null,
    IMG_CLEMENTINO_25CL: typeof IMG_CLEMENTINO_25CL !== "undefined" ? IMG_CLEMENTINO_25CL : null,
    IMG_CLEMENTINO_50CL: typeof IMG_CLEMENTINO_50CL !== "undefined" ? IMG_CLEMENTINO_50CL : null,
    IMG_COFFRET: typeof IMG_COFFRET !== "undefined" ? IMG_COFFRET : null,
  };
  return map[p.image] || null;
};

export const COULEURS: Record<string, { bg: string; accent: string; light: string }> = {
  "Citron jaune":          { bg: "#FFFDE7", accent: "#F9A825", light: "#FFF9C4" },
  "Citron vert":           { bg: "#F1F8E9", accent: "#558B2F", light: "#DCEDC8" },
  "Clémentine":            { bg: "#FFF3E0", accent: "#E65100", light: "#FFE0B2" },
  "3 saveurs":             { bg: "#F3E5F5", accent: "#6A1B9A", light: "#E1BEE7" },
  "3×50cl + 2 verres":    { bg: "#F3E5F5", accent: "#6A1B9A", light: "#E1BEE7" },
  "3×50cl sans verres":   { bg: "#F3E5F5", accent: "#6A1B9A", light: "#E1BEE7" },
  "3×25cl + 2 verres":    { bg: "#F3E5F5", accent: "#6A1B9A", light: "#E1BEE7" },
  "3×25cl sans verres":   { bg: "#F3E5F5", accent: "#6A1B9A", light: "#E1BEE7" },
};

export const calcTotal = (lignes: any[], typeClient: string, produits: any[]): number =>
  sum(
    (lignes || []).filter((l) => l.produitId).map((l) => {
      const p = produits.find((x: any) => x.id === l.produitId);
      const pu = p ? (typeClient === "revendeur" ? p.prixRevendeur : p.prixClient) : 0;
      return (l.qte || 0) * pu;
    })
  );

export const calcTotalNet = (f: any, produits: any[]): number => {
  const brut = calcTotal(f.lignes, f.typeClient, produits);
  const rabProduits = calcTotal(
    (f.lignesOffertes || []).filter((l: any) => l.produitId && l.qte > 0),
    f.typeClient,
    produits
  );
  const rab = rabProduits > 0 ? rabProduits : (parseFloat(f.totalRabais) || 0);
  return brut - rab;
};
