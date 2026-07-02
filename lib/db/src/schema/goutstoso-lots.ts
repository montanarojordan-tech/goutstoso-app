import { pgTable, text, serial, integer, numeric, date, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const gsLotsTable = pgTable("gs_lots", {
  id: serial("id").primaryKey(),
  produitId: text("produit_id").notNull(),
  numeroLot: text("numero_lot").notNull().unique(),
  dateFabrication: date("date_fabrication").notNull(),
  quantiteProduite: integer("quantite_produite").notNull(),
  quantiteRestante: integer("quantite_restante").notNull(),
  degreAlcoolMesure: numeric("degre_alcool_mesure", { precision: 5, scale: 2 }),
  degreAlcoolEtiquette: numeric("degre_alcool_etiquette", { precision: 5, scale: 2 }),
  dateDurabilite: date("date_durabilite"),
  controlePar: text("controle_par"),
  statut: text("statut").notNull().default("en_stock"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const gsMouvementsStockTable = pgTable("gs_mouvements_stock", {
  id: serial("id").primaryKey(),
  lotId: integer("lot_id").notNull().references(() => gsLotsTable.id),
  type: text("type").notNull(),
  quantite: integer("quantite").notNull(),
  factureId: text("facture_id"),
  clientNom: text("client_nom"),
  canalVente: text("canal_vente"),
  dateMouvement: timestamp("date_mouvement", { withTimezone: true }).notNull().defaultNow(),
});

export const insertGsLotSchema = createInsertSchema(gsLotsTable).omit({
  id: true,
  quantiteRestante: true,
  statut: true,
  createdAt: true,
});

export const insertGsMouvementStockSchema = createInsertSchema(gsMouvementsStockTable).omit({
  id: true,
  dateMouvement: true,
});

export type InsertGsLot = z.infer<typeof insertGsLotSchema>;
export type GsLot = typeof gsLotsTable.$inferSelect;
export type InsertGsMouvementStock = z.infer<typeof insertGsMouvementStockSchema>;
export type GsMouvementStock = typeof gsMouvementsStockTable.$inferSelect;
