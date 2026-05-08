import { Router, type IRouter } from "express";
import { db, signingRequestsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import {
  CreateSigningRequestBody,
  GetSigningRequestParams,
  SubmitSignatureBody,
  SubmitSignatureParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function getSigningUrl(req: any, token: string): string {
  const domains = process.env.REPLIT_DOMAINS?.split(",") ?? [];
  const host = domains[0] ?? req.get("host") ?? "localhost";
  const proto = host.includes("replit.app") || host.includes("replit.dev") ? "https" : "http";
  return `${proto}://${host}/sign/${token}`;
}

router.post("/sign", async (req, res) => {
  const body = CreateSigningRequestBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const { documentType, documentTitle, documentData, expiresInDays = 30 } = body.data;
  const token = randomUUID();
  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

  await db.insert(signingRequestsTable).values({
    token,
    documentType,
    documentTitle,
    documentData,
    expiresAt,
  });

  res.status(201).json({
    token,
    signingUrl: getSigningUrl(req, token),
    expiresAt: expiresAt.toISOString(),
  });
});

router.get("/sign/:token", async (req, res) => {
  const params = GetSigningRequestParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid token" }); return; }

  const rows = await db
    .select()
    .from(signingRequestsTable)
    .where(eq(signingRequestsTable.token, params.data.token))
    .limit(1);

  if (!rows.length) { res.status(404).json({ error: "Not found" }); return; }
  const row = rows[0];

  if (new Date(row.expiresAt) < new Date()) {
    res.status(404).json({ error: "Expired" });
    return;
  }

  res.json({
    token: row.token,
    documentType: row.documentType,
    documentTitle: row.documentTitle,
    documentData: row.documentData,
    status: row.status,
    signerName: row.signerName ?? null,
    signatureData: row.status === "signed" ? row.signatureData : null,
    signedAt: row.signedAt?.toISOString() ?? null,
    expiresAt: row.expiresAt.toISOString(),
  });
});

router.post("/sign/:token/submit", async (req, res) => {
  const params = SubmitSignatureParams.safeParse(req.params);
  const body = SubmitSignatureBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const rows = await db
    .select()
    .from(signingRequestsTable)
    .where(eq(signingRequestsTable.token, params.data.token))
    .limit(1);

  if (!rows.length) { res.status(404).json({ error: "Not found" }); return; }
  const row = rows[0];

  if (new Date(row.expiresAt) < new Date()) {
    res.status(404).json({ error: "Expired" });
    return;
  }
  if (row.status === "signed") {
    res.status(400).json({ error: "Already signed" });
    return;
  }

  const signedAt = new Date();
  await db
    .update(signingRequestsTable)
    .set({
      status: "signed",
      signerName: body.data.signerName,
      signatureData: body.data.signatureData,
      signedAt,
    })
    .where(eq(signingRequestsTable.token, params.data.token));

  // Notification push via ntfy.sh (gratuit, sans compte)
  try {
    const ntfyTopic = process.env.NTFY_TOPIC ?? "goutstoso-signatures";
    await fetch(`https://ntfy.sh/${ntfyTopic}`, {
      method: "POST",
      headers: {
        "Title": `✅ Document signé : ${row.documentTitle}`,
        "Priority": "high",
        "Tags": "pen,white_check_mark",
      },
      body: `${body.data.signerName} a signé "${row.documentTitle}" le ${signedAt.toLocaleDateString("fr-CH")}`,
    });
  } catch (_) {}

  res.json({
    token: row.token,
    documentType: row.documentType,
    documentTitle: row.documentTitle,
    documentData: row.documentData,
    status: "signed",
    signerName: body.data.signerName,
    signedAt: signedAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
  });
});

export default router;
