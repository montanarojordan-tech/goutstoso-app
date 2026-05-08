import { Router, type IRouter } from "express";
import { db, signingRequestsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import nodemailer from "nodemailer";
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

function buildEmailHtml(documentTitle: string, signingUrl: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Signature requise — Goûtstoso</title>
</head>
<body style="margin:0;padding:0;background:#FAFAF7;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#0A0A0A;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#FAFAF7;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(10,10,10,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:#0A0A0A;padding:28px 36px;text-align:center;">
              <p style="margin:0;font-size:22px;font-weight:700;color:#E8B64C;letter-spacing:-0.02em;">GOÛTSTOSO</p>
              <p style="margin:4px 0 0;font-size:11px;color:#9CA3AF;letter-spacing:0.08em;text-transform:uppercase;">Liqueurs artisanales · Villeret, Suisse</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 36px 28px;">
              <p style="margin:0 0 8px;font-size:15px;color:#6B7280;">Bonjour,</p>
              <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#374151;">
                Vous êtes invité(e) à consulter et signer électroniquement le document suivant :
              </p>

              <!-- Document card -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#FAFAF7;border:1.5px solid #EAE7E0;border-radius:10px;margin-bottom:28px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0;font-size:11px;color:#9CA3AF;letter-spacing:0.06em;text-transform:uppercase;">Document à signer</p>
                    <p style="margin:4px 0 0;font-size:17px;font-weight:700;color:#0A0A0A;">${documentTitle}</p>
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding-bottom:24px;">
                    <a href="${signingUrl}" style="display:inline-block;background:#0A0A0A;color:#E8B64C;text-decoration:none;font-size:15px;font-weight:700;padding:15px 36px;border-radius:10px;letter-spacing:-0.01em;">
                      ✍️&nbsp;&nbsp;Signer le document
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 4px;font-size:13px;color:#9CA3AF;text-align:center;">
                Ce lien est sécurisé et valable 30 jours.
              </p>
              <p style="margin:0;font-size:13px;color:#9CA3AF;text-align:center;">
                Il vous suffit de cliquer, vérifier le document, puis signer avec votre doigt ou souris.
              </p>
            </td>
          </tr>

          <!-- Footer / Signature -->
          <tr>
            <td style="background:#FFFFFF;padding:28px 36px 32px;border-top:1px solid #EAE7E0;">
              <p style="margin:0 0 20px;font-size:13px;color:#6B7280;">L'équipe Goûtstoso</p>
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding-right:16px;vertical-align:middle;">
                    <div style="width:48px;height:48px;border-radius:8px;overflow:hidden;">
                      <img src="https://goutstoso.replit.app/sign/logo-email.png" alt="Goûtstoso" width="48" height="48" style="display:block;" onerror="this.style.display='none'">
                    </div>
                  </td>
                  <td style="vertical-align:middle;">
                    <p style="margin:0;font-size:22px;font-weight:700;color:#0A0A0A;letter-spacing:-0.02em;">Goûtstoso</p>
                  </td>
                </tr>
              </table>
              <p style="margin:10px 0 12px;font-size:13px;color:#6B7280;">Administratif</p>
              <hr style="border:none;border-top:1px solid #EAE7E0;margin:0 0 14px;">
              <p style="margin:0 0 8px;font-size:13px;color:#374151;">T :&nbsp;&nbsp;<a href="tel:+41795220656" style="color:#374151;text-decoration:underline;font-weight:600;">+41 79 522 06 56</a></p>
              <p style="margin:0 0 8px;font-size:13px;"><a href="mailto:admin@goutstoso.ch" style="color:#1D4ED8;text-decoration:underline;">admin@goutstoso.ch</a></p>
              <p style="margin:0 0 2px;font-size:13px;color:#374151;">Rue des Sources 19</p>
              <p style="margin:0 0 8px;font-size:13px;color:#374151;">2613 Villeret - SWITZERLAND</p>
              <p style="margin:0;font-size:13px;"><a href="https://www.goutstoso.ch" style="color:#1D4ED8;text-decoration:underline;">www.goutstoso.ch</a></p>
            </td>
          </tr>

        </table>

        <!-- Anti-phishing note -->
        <p style="margin:20px 0 0;font-size:11px;color:#9CA3AF;text-align:center;max-width:480px;">
          Si vous n'attendiez pas ce message, vous pouvez l'ignorer.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

async function sendSigningEmail(to: string, documentTitle: string, signingUrl: string): Promise<void> {
  const smtpHost = process.env.SMTP_HOST;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpFrom = process.env.SMTP_FROM ?? smtpUser;
  const smtpPort = parseInt(process.env.SMTP_PORT ?? "587", 10);

  if (!smtpHost || !smtpUser || !smtpPass) {
    throw new Error("SMTP non configuré");
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: { user: smtpUser, pass: smtpPass },
  });

  await transporter.sendMail({
    from: `"Goûtstoso" <${smtpFrom}>`,
    to,
    subject: `Signature requise — ${documentTitle}`,
    html: buildEmailHtml(documentTitle, signingUrl),
    text: `Bonjour,\n\nVous êtes invité(e) à signer électroniquement : ${documentTitle}\n\nAccédez au document ici :\n${signingUrl}\n\nCe lien est valable 30 jours.\n\n—\nJordan Montanaro · Goûtstoso\nadmin@goutstoso.ch`,
  });
}

const CreateSigningRequestWithEmail = CreateSigningRequestBody.extend({
  recipientEmail: CreateSigningRequestBody.shape.documentType.optional(),
});

router.post("/sign", async (req, res) => {
  const body = CreateSigningRequestWithEmail.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const { documentType, documentTitle, documentData, expiresInDays = 30, recipientEmail } = body.data;
  const token = randomUUID();
  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

  await db.insert(signingRequestsTable).values({
    token,
    documentType,
    documentTitle,
    documentData,
    expiresAt,
  });

  const signingUrl = getSigningUrl(req, token);

  let emailSent = false;
  let emailError: string | null = null;
  if (recipientEmail) {
    try {
      await sendSigningEmail(recipientEmail, documentTitle, signingUrl);
      emailSent = true;
    } catch (e: any) {
      emailError = e.message ?? "Erreur inconnue";
    }
  }

  res.status(201).json({
    token,
    signingUrl,
    expiresAt: expiresAt.toISOString(),
    emailSent,
    emailError,
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
