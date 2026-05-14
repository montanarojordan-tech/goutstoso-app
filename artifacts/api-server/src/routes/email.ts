import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import nodemailer from "nodemailer";
import { z } from "zod/v4";

const router: IRouter = Router();

// ── Rate limiter simple (en mémoire) ────────────────────────────────────────
// Max 30 envois par heure par IP pour éviter l'abus du relais SMTP
const RATE_WINDOW_MS = 60 * 60 * 1000; // 1 heure
const RATE_LIMIT = 30;
const rateCounts = new Map<string, { count: number; resetAt: number }>();

function getRateKey(req: Request): string {
  return (
    (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ??
    req.socket?.remoteAddress ??
    "unknown"
  );
}

function checkRateLimit(req: Request, res: Response): boolean {
  const key = getRateKey(req);
  const now = Date.now();
  const entry = rateCounts.get(key);
  if (!entry || now > entry.resetAt) {
    rateCounts.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT) {
    res.status(429).json({ error: "Trop de requêtes — réessaye dans une heure." });
    return false;
  }
  entry.count++;
  return true;
}

// ── Vérification d'origine ───────────────────────────────────────────────────
// Seules les requêtes provenant du domaine Goutstoso ou de l'env de dev sont autorisées
const ALLOWED_ORIGINS = [
  "goutstoso.replit.app",
  "goutstoso.replit.dev",
  "localhost",
  "127.0.0.1",
];

function checkOrigin(req: Request, res: Response): boolean {
  const origin = req.headers["origin"] ?? req.headers["referer"] ?? "";
  const allowed = ALLOWED_ORIGINS.some(o => origin.includes(o));
  // En dev (pas de domaine configuré), on laisse passer
  const domains = process.env.REPLIT_DOMAINS ?? "";
  const isDev = !domains || domains.includes("replit.dev");
  if (!allowed && !isDev) {
    res.status(403).json({ error: "Origine non autorisée." });
    return false;
  }
  return true;
}

function emailGuard(req: Request, res: Response, next: NextFunction): void {
  if (!checkOrigin(req, res)) return;
  if (!checkRateLimit(req, res)) return;
  next();
}

const SendEmailBody = z.object({
  to: z.string().email(),
  toName: z.string().optional().default(""),
  subject: z.string().min(1),
  bodyText: z.string().min(1),
});

function buildEmailHtml(toName: string, subject: string, bodyText: string): string {
  const lines = bodyText.split("\n").map(l => {
    if (l.startsWith("  ") && l.includes("CHF")) {
      return `<p style="margin:0;font-size:13px;color:#374151;font-family:'Courier New',monospace;white-space:pre;">${l}</p>`;
    }
    if (l.startsWith("─") || l.trim().startsWith("─")) {
      return `<hr style="border:none;border-top:1px solid #EAE7E0;margin:4px 0;">`;
    }
    if (l.trim() === "") return `<p style="margin:0;padding:4px 0;"> </p>`;
    return `<p style="margin:0;font-size:14px;line-height:1.65;color:#374151;">${l}</p>`;
  });

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${subject}</title>
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

          <!-- Subject banner -->
          <tr>
            <td style="background:#FAFAF7;padding:20px 36px 0;">
              <p style="margin:0;font-size:11px;color:#9CA3AF;letter-spacing:0.06em;text-transform:uppercase;">Objet</p>
              <p style="margin:4px 0 0;font-size:17px;font-weight:700;color:#0A0A0A;">${subject}</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:24px 36px 28px;">
              ${lines.join("\n              ")}
            </td>
          </tr>

          <!-- Footer / Signature -->
          <tr>
            <td style="background:#FFFFFF;padding:24px 36px 32px;border-top:1px solid #EAE7E0;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding-right:16px;vertical-align:middle;">
                    <div style="width:44px;height:44px;border-radius:8px;overflow:hidden;background:#0A0A0A;display:flex;align-items:center;justify-content:center;">
                      <img src="https://goutstoso.replit.app/sign/logo-email.png" alt="G" width="44" height="44" style="display:block;" onerror="this.style.display='none'">
                    </div>
                  </td>
                  <td style="vertical-align:middle;">
                    <p style="margin:0;font-size:18px;font-weight:700;color:#0A0A0A;letter-spacing:-0.02em;">Goûtstoso</p>
                    <p style="margin:2px 0 0;font-size:12px;color:#9CA3AF;">Jordan Montanaro</p>
                  </td>
                </tr>
              </table>
              <hr style="border:none;border-top:1px solid #EAE7E0;margin:16px 0 14px;">
              <p style="margin:0 0 6px;font-size:13px;color:#374151;">T : <a href="tel:+41795220656" style="color:#374151;text-decoration:none;font-weight:600;">+41 79 522 06 56</a></p>
              <p style="margin:0 0 6px;font-size:13px;"><a href="mailto:admin@goutstoso.ch" style="color:#1D4ED8;text-decoration:underline;">admin@goutstoso.ch</a></p>
              <p style="margin:0 0 4px;font-size:13px;color:#374151;">Rue des Sources 19 · 2613 Villeret - SWITZERLAND</p>
              <p style="margin:0;font-size:13px;"><a href="https://www.goutstoso.ch" style="color:#1D4ED8;text-decoration:underline;">www.goutstoso.ch</a></p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

async function sendMail(to: string, toName: string, subject: string, bodyText: string): Promise<void> {
  const smtpHost = process.env.SMTP_HOST;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpFrom = process.env.SMTP_FROM ?? smtpUser;
  const smtpPort = parseInt(process.env.SMTP_PORT ?? "587", 10);

  if (!smtpHost || !smtpUser || !smtpPass) {
    throw new Error("SMTP non configuré (SMTP_HOST, SMTP_USER, SMTP_PASS manquants)");
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: { user: smtpUser, pass: smtpPass },
  });

  await transporter.sendMail({
    from: `"Goûtstoso" <${smtpFrom}>`,
    to: toName ? `"${toName}" <${to}>` : to,
    subject,
    html: buildEmailHtml(toName, subject, bodyText),
    text: bodyText,
  });
}

router.post("/email/send", emailGuard, async (req, res) => {
  const parsed = SendEmailBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Paramètres invalides", details: parsed.error.issues });
    return;
  }
  const { to, toName, subject, bodyText } = parsed.data;
  try {
    await sendMail(to, toName, subject, bodyText);
    req.log.info({ to, subject }, "Email envoyé");
    res.status(200).json({ sent: true });
  } catch (e: any) {
    req.log.error({ err: e, to, subject }, "Erreur envoi email");
    res.status(500).json({ sent: false, error: e.message ?? "Erreur inconnue" });
  }
});

export default router;
