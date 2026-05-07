import { pgTable, text, serial, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const signingRequestsTable = pgTable("signing_requests", {
  id: serial("id").primaryKey(),
  token: text("token").notNull().unique(),
  documentType: text("document_type").notNull(),
  documentTitle: text("document_title").notNull(),
  documentData: jsonb("document_data").notNull(),
  status: text("status").notNull().default("pending"),
  signerName: text("signer_name"),
  signatureData: text("signature_data"),
  signedAt: timestamp("signed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export const insertSigningRequestSchema = createInsertSchema(signingRequestsTable).omit({
  id: true,
  createdAt: true,
  status: true,
  signerName: true,
  signatureData: true,
  signedAt: true,
});

export type InsertSigningRequest = z.infer<typeof insertSigningRequestSchema>;
export type SigningRequest = typeof signingRequestsTable.$inferSelect;
