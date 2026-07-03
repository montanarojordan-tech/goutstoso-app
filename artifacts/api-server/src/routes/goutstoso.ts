import { Router, type IRouter, type Request, type Response } from "express";
import crypto from "crypto";
import { pool } from "@workspace/db";

const router: IRouter = Router();

const MAX_BACKUPS = 36;
const TOKEN_TTL_MS = 60 * 60 * 24 * 30 * 1000; // 30 jours

// ── Helpers ───────────────────────────────────────────────────────────────────
function ok(res: Response, data: Record<string, unknown> = {}): void {
  res.json({ success: true, ...data });
}
function fail(res: Response, error: string, code = 200): void {
  res.status(code).json({ success: false, error });
}

async function q<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
  const result = await pool.query(sql, params);
  return result.rows as T[];
}

// ── Passwords ─────────────────────────────────────────────────────────────────
async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString("hex");
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 32, (err, key) => {
      if (err) reject(err);
      else resolve(`${salt}:${key.toString("hex")}`);
    });
  });
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const [salt, stored] = hash.split(":");
  if (!salt || !stored) return false;
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 32, (err, key) => {
      if (err) reject(err);
      else resolve(key.toString("hex") === stored);
    });
  });
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface User {
  id: string; username: string; password: string;
  display_name: string; role: "admin" | "user"; active: number; created_at: string;
}

// ── Utilisateurs ──────────────────────────────────────────────────────────────
async function getUsers(): Promise<User[]> {
  return q<User>("SELECT * FROM gs_users ORDER BY created_at");
}
async function findUser(username: string): Promise<User | undefined> {
  const rows = await q<User>("SELECT * FROM gs_users WHERE lower(username)=lower($1) LIMIT 1", [username]);
  return rows[0];
}
async function findUserById(id: string): Promise<User | undefined> {
  const rows = await q<User>("SELECT * FROM gs_users WHERE id=$1 LIMIT 1", [id]);
  return rows[0];
}
async function saveUser(u: User): Promise<void> {
  await pool.query(
    `INSERT INTO gs_users(id,username,password,display_name,role,active,created_at)
     VALUES($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT(id) DO UPDATE SET username=EXCLUDED.username,password=EXCLUDED.password,
       display_name=EXCLUDED.display_name,role=EXCLUDED.role,active=EXCLUDED.active`,
    [u.id, u.username, u.password, u.display_name, u.role, u.active, u.created_at]
  );
}

async function ensureDefaultAdmin(): Promise<void> {
  const rows = await q<{ count: string }>("SELECT COUNT(*)::text AS count FROM gs_users");
  if (parseInt(rows[0]?.count ?? "0") === 0) {
    const defaultPass = process.env.GOUTSTOSO_ADMIN_PASSWORD;
    if (!defaultPass) {
      console.error("GOUTSTOSO_ADMIN_PASSWORD env var not set — skipping default admin creation");
      return;
    }
    const password = await hashPassword(defaultPass);
    await saveUser({
      id: "u1", username: "jordan", password,
      display_name: "Jordan Montanaro", role: "admin",
      active: 1, created_at: new Date().toISOString(),
    });
  }
}
ensureDefaultAdmin().catch(console.error);

// ── Tokens ────────────────────────────────────────────────────────────────────
async function findToken(token: string): Promise<{ token: string; user_id: string } | undefined> {
  const rows = await q<{ token: string; user_id: string }>(
    "SELECT token,user_id FROM gs_tokens WHERE token=$1 AND expires_at>$2 LIMIT 1",
    [token, Date.now()]
  );
  return rows[0];
}
async function createToken(userId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  await pool.query(
    "INSERT INTO gs_tokens(token,user_id,created_at,expires_at) VALUES($1,$2,NOW(),$3)",
    [token, userId, Date.now() + TOKEN_TTL_MS]
  );
  // Purge expired tokens periodically
  pool.query("DELETE FROM gs_tokens WHERE expires_at<$1", [Date.now()]).catch(() => {});
  return token;
}
async function revokeToken(token: string): Promise<void> {
  await pool.query("DELETE FROM gs_tokens WHERE token=$1", [token]);
}

// ── Activité ──────────────────────────────────────────────────────────────────
async function logActivity(userId: string, action: string, ip: string): Promise<void> {
  await pool.query(
    "INSERT INTO gs_activity(user_id,action,ip,created_at) VALUES($1,$2,$3,NOW())",
    [userId, action, ip]
  );
  // Keep only last 500
  pool.query(
    "DELETE FROM gs_activity WHERE id NOT IN (SELECT id FROM gs_activity ORDER BY created_at DESC LIMIT 500)"
  ).catch(() => {});
}

// ── Auth helpers ──────────────────────────────────────────────────────────────
function getTokenFromReq(req: Request): string {
  return (req.body?._token as string) || (req.headers["x-auth-token"] as string) || "";
}

async function requireAuth(req: Request, res: Response): Promise<User | null> {
  const tok = getTokenFromReq(req);
  if (!tok) { res.json({ _auth_required: true }); return null; }
  const t = await findToken(tok);
  if (!t) { res.json({ _auth_required: true }); return null; }
  const user = await findUserById(t.user_id);
  if (!user || !user.active) { res.json({ _auth_required: true }); return null; }
  return user;
}

async function requireAdmin(req: Request, res: Response): Promise<User | null> {
  const user = await requireAuth(req, res);
  if (!user) return null;
  if (user.role !== "admin") { fail(res, "Accès refusé", 403); return null; }
  return user;
}

function publicUser(u: User) {
  return { id: u.id, username: u.username, display_name: u.display_name, role: u.role };
}

// ── Ping ──────────────────────────────────────────────────────────────────────
router.get("/goutstoso", (_req, res) => {
  res.json({ success: true, message: "Goutstoso API – OK" });
});

// ── Auto-token (app privée Jordan) ────────────────────────────────────────────
router.get("/goutstoso/auto-token", async (_req, res) => {
  try {
    const rows = await q<{ token: string }>("SELECT token FROM gs_tokens WHERE user_id='u1' AND expires_at > EXTRACT(EPOCH FROM NOW())*1000 ORDER BY expires_at DESC LIMIT 1");
    if (rows[0]) return res.json({ success: true, token: rows[0].token });
    // Créer un nouveau token si expiré
    const userRows = await q<{ id: string }>("SELECT id FROM gs_users WHERE id='u1' LIMIT 1");
    if (!userRows[0]) return res.json({ success: false });
    const newToken = await createToken("u1");
    return res.json({ success: true, token: newToken });
  } catch(e) {
    return res.status(500).json({ success: false });
  }
});

router.get("/goutstoso/restore", async (_req, res) => {
  try {
    const rows = await q<{ data: Record<string, unknown> }>("SELECT data FROM gs_data WHERE id=1 LIMIT 1");
    if (!rows[0]) { res.status(404).send("Aucune donnée dans le cloud."); return; }
    const raw = rows[0].data as Record<string, unknown>;
    // Supprimer tous les champs base64 pour réduire la taille (évite quota localStorage)
    function stripBase64(val: unknown): unknown {
      if (typeof val === "string" && val.startsWith("data:")) return "";
      if (Array.isArray(val)) return val.map(stripBase64);
      if (val && typeof val === "object") {
        const out: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(val as Record<string, unknown>)) out[k] = stripBase64(v);
        return out;
      }
      return val;
    }
    const data = stripBase64(raw) as Record<string, unknown>;
    const txCount = Array.isArray(raw.transactions) ? (raw.transactions as unknown[]).length : 0;
    const contratCount = Array.isArray(raw.contrats) ? (raw.contrats as unknown[]).length : 0;
    const dataJson = JSON.stringify(data).replace(/<\/script>/gi, "<\\/script>");
    // Récupérer le token de Jordan pour l'injecter dans localStorage
    const tokenRows = await q<{ token: string }>("SELECT token FROM gs_tokens WHERE user_id='u1' ORDER BY expires_at DESC LIMIT 1");
    const authToken = tokenRows[0]?.token ?? "";
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(`<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Restauration Goutstoso</title>
<style>
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:-apple-system,BlinkMacSystemFont,'Inter',sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#FAFAF7;}
.box{background:#fff;border-radius:20px;padding:40px 32px;max-width:380px;width:calc(100% - 32px);text-align:center;box-shadow:0 8px 32px rgba(0,0,0,.12);}
.icon{font-size:56px;margin-bottom:16px;}
h1{font-size:20px;font-weight:700;color:#0A0A0A;margin-bottom:8px;}
.sub{color:#737373;font-size:14px;margin-bottom:24px;line-height:1.5;}
.btn{display:inline-block;background:#0A0A0A;color:#fff;border:none;border-radius:12px;padding:14px 28px;font-size:16px;font-weight:600;cursor:pointer;text-decoration:none;width:100%;margin-top:8px;}
.btn:active{opacity:.8;}
.err{color:#B91C1C;font-size:14px;margin-top:12px;}
</style></head>
<body><div class="box">
<div class="icon" id="ico">☁️</div>
<h1 id="ttl">Restauration en cours…</h1>
<p class="sub" id="msg">Chargement de <strong>${txCount} transactions</strong> et <strong>${contratCount} contrats</strong>…</p>
<div id="actions"></div>
</div>
<script>
(function(){
  try {
    var d = ${dataJson};
    localStorage.setItem("goutstoso_v2", JSON.stringify(d));
    ${authToken ? `localStorage.setItem("gs_auth_token", ${JSON.stringify(authToken)});` : ""}
    document.getElementById("ico").textContent = "✅";
    document.getElementById("ttl").textContent = "Données restaurées !";
    document.getElementById("msg").innerHTML = "<strong>${txCount} transactions</strong> et <strong>${contratCount} contrats</strong> sont prêts.";
    document.getElementById("actions").innerHTML = '<a class="btn" href="/goutstoso/">Ouvrir Goutstoso</a>';
  } catch(e) {
    document.getElementById("ico").textContent = "❌";
    document.getElementById("ttl").textContent = "Erreur";
    document.getElementById("msg").textContent = e.message;
  }
})();
</script></body></html>`);
  } catch(e) {
    res.status(500).send("Erreur serveur : " + String(e));
  }
});

// ── Pièces jointes ────────────────────────────────────────────────────────────
router.post("/goutstoso/files", async (req: Request, res: Response) => {
  const user = await requireAuth(req, res);
  if (!user) return;
  const { fileData, fileName, mimeType } = req.body as { fileData: string; fileName: string; mimeType: string };
  if (!fileData || !fileData.startsWith("data:")) return fail(res, "Données invalides");
  const comma = fileData.indexOf(",");
  if (comma === -1) return fail(res, "Format invalide");
  const buffer = Buffer.from(fileData.slice(comma + 1), "base64");
  const fileId = crypto.randomUUID();
  await pool.query(
    "INSERT INTO gs_files(id,name,mime_type,user_id,data,created_at) VALUES($1,$2,$3,$4,$5,NOW())",
    [fileId, fileName || "fichier", mimeType || "application/octet-stream", user.id, buffer]
  );
  return ok(res, { fileId });
});

router.get("/goutstoso/files/:fileId", async (req: Request, res: Response) => {
  const tok = (req.query["token"] as string) || (req.headers["x-auth-token"] as string) || "";
  if (!tok) return res.status(401).json({ error: "Non autorisé" });
  const t = await findToken(tok);
  if (!t) return res.status(401).json({ error: "Token invalide" });
  const user = await findUserById(t.user_id);
  if (!user || !user.active) return res.status(401).json({ error: "Non autorisé" });
  const fileId = req.params["fileId"]!;
  const rows = await q<{ name: string; mime_type: string; data: Buffer }>(
    "SELECT name,mime_type,data FROM gs_files WHERE id=$1 LIMIT 1", [fileId]
  );
  if (!rows[0]) return res.status(404).json({ error: "Fichier introuvable" });
  const file = rows[0];
  res.setHeader("Content-Type", file.mime_type);
  res.setHeader("Content-Disposition", `inline; filename="${file.name}"`);
  return res.send(file.data);
});

// ── Lots / Traçabilité ────────────────────────────────────────────────────────
interface Lot {
  id: number; produit_id: string; numero_lot: string; date_fabrication: string;
  quantite_produite: number; quantite_restante: number;
  degre_alcool_mesure: string | null; degre_alcool_etiquette: string | null;
  date_durabilite: string | null; controle_par: string | null; statut: string; created_at: string;
}
interface MouvementStock {
  id: number; lot_id: number; type: string; quantite: number;
  facture_id: string | null; client_nom: string | null; canal_vente: string | null; date_mouvement: string;
}

async function getLotsSnapshot(): Promise<{ lots: Lot[]; mouvements: MouvementStock[] }> {
  const lots = await q<Lot>("SELECT * FROM gs_lots ORDER BY id ASC");
  const mouvements = await q<MouvementStock>("SELECT * FROM gs_mouvements_stock ORDER BY id ASC");
  return { lots, mouvements };
}

async function restoreLotsSnapshot(data: Record<string, unknown>): Promise<void> {
  const lots = data["_lotsTracabilite"];
  const mouvements = data["_mouvementsStockTracabilite"];
  // Sauvegardes antérieures à la traçabilité par lot : on ne touche pas aux lots actuels.
  if (!Array.isArray(lots) || !Array.isArray(mouvements)) return;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM gs_mouvements_stock");
    await client.query("DELETE FROM gs_lots");
    for (const l of lots as Lot[]) {
      await client.query(
        `INSERT INTO gs_lots(id,produit_id,numero_lot,date_fabrication,quantite_produite,quantite_restante,
          degre_alcool_mesure,degre_alcool_etiquette,date_durabilite,controle_par,statut,created_at)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [l.id, l.produit_id, l.numero_lot, l.date_fabrication, l.quantite_produite, l.quantite_restante,
          l.degre_alcool_mesure, l.degre_alcool_etiquette, l.date_durabilite, l.controle_par, l.statut, l.created_at]
      );
    }
    for (const m of mouvements as MouvementStock[]) {
      await client.query(
        `INSERT INTO gs_mouvements_stock(id,lot_id,type,quantite,facture_id,client_nom,canal_vente,date_mouvement)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
        [m.id, m.lot_id, m.type, m.quantite, m.facture_id, m.client_nom, m.canal_vente, m.date_mouvement]
      );
    }
    await client.query("SELECT setval('gs_lots_id_seq', COALESCE((SELECT MAX(id) FROM gs_lots), 1))");
    await client.query("SELECT setval('gs_mouvements_stock_id_seq', COALESCE((SELECT MAX(id) FROM gs_mouvements_stock), 1))");
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

async function getProduitsFromCloud(): Promise<Array<Record<string, unknown>>> {
  const rows = await q<{ data: Record<string, unknown> }>("SELECT data FROM gs_data WHERE id=1 LIMIT 1");
  const produits = rows[0]?.data?.["produits"];
  return Array.isArray(produits) ? (produits as Array<Record<string, unknown>>) : [];
}

function csvEscape(val: unknown): string {
  const s = val === null || val === undefined ? "" : String(val);
  if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(csvEscape).join(";"), ...rows.map(r => r.map(csvEscape).join(";"))];
  return "\uFEFF" + lines.join("\r\n");
}

// GET export per lot: /goutstoso/lots/export/:numeroLot?token=...
router.get("/goutstoso/lots/export/:numeroLot", async (req: Request, res: Response) => {
  const tok = (req.query["token"] as string) || (req.headers["x-auth-token"] as string) || "";
  const t = tok ? await findToken(tok) : null;
  if (!t) return res.status(401).json({ error: "Non autorisé" });
  const numeroLot = req.params["numeroLot"]!;
  const lots = await q<Lot>("SELECT * FROM gs_lots WHERE numero_lot=$1 LIMIT 1", [numeroLot]);
  const lot = lots[0];
  if (!lot) return res.status(404).json({ error: "Lot introuvable" });
  const produits = await getProduitsFromCloud();
  const produit = produits.find(p => p["id"] === lot.produit_id);
  const mouvements = await q<MouvementStock>(
    "SELECT * FROM gs_mouvements_stock WHERE lot_id=$1 AND type='sortie_vente' ORDER BY date_mouvement ASC",
    [lot.id]
  );
  const headers = ["Numéro de lot", "Produit", "Format", "Code UGS", "Date fabrication", "Quantité produite", "Degré mesuré", "Date livraison", "Client", "Canal de vente", "Quantité livrée", "Numéro commande"];
  const baseInfo = [
    lot.numero_lot, produit?.["nom"] ?? "", produit?.["format"] ?? "", produit?.["codeUgs"] ?? "",
    lot.date_fabrication, lot.quantite_produite, lot.degre_alcool_mesure ?? "",
  ];
  const rows = mouvements.length
    ? mouvements.map(m => [...baseInfo, m.date_mouvement, m.client_nom ?? "", m.canal_vente ?? "", m.quantite, m.facture_id ?? ""])
    : [[...baseInfo, "", "", "", "", ""]];
  const csv = toCsv(headers, rows);
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="tracabilite_${lot.numero_lot}_${dateStr}.csv"`);
  return res.send(csv);
});

// GET export global: /goutstoso/lots/export-global?token=...&from=&to=&produitId=
router.get("/goutstoso/lots/export-global", async (req: Request, res: Response) => {
  const tok = (req.query["token"] as string) || (req.headers["x-auth-token"] as string) || "";
  const t = tok ? await findToken(tok) : null;
  if (!t) return res.status(401).json({ error: "Non autorisé" });
  const from = (req.query["from"] as string) || "";
  const to = (req.query["to"] as string) || "";
  const produitId = (req.query["produitId"] as string) || "";
  const params: unknown[] = [];
  const conditions: string[] = ["m.type='sortie_vente'"];
  if (from) { params.push(from); conditions.push(`m.date_mouvement >= $${params.length}`); }
  if (to) { params.push(to + " 23:59:59"); conditions.push(`m.date_mouvement <= $${params.length}`); }
  if (produitId) { params.push(produitId); conditions.push(`l.produit_id = $${params.length}`); }
  const mouvements = await q<MouvementStock & { numero_lot: string; produit_id: string }>(
    `SELECT m.*, l.numero_lot, l.produit_id FROM gs_mouvements_stock m
     JOIN gs_lots l ON l.id = m.lot_id
     WHERE ${conditions.join(" AND ")}
     ORDER BY m.date_mouvement ASC`,
    params
  );
  const produits = await getProduitsFromCloud();
  const produitMap: Record<string, Record<string, unknown>> = {};
  for (const p of produits) produitMap[String(p["id"])] = p;
  const headers = ["Numéro de lot", "Produit", "Format", "Date", "Client", "Canal de vente", "Quantité", "Numéro commande"];
  const rows = mouvements.map(m => {
    const p = produitMap[m.produit_id];
    return [m.numero_lot, p?.["nom"] ?? "", p?.["format"] ?? "", m.date_mouvement, m.client_nom ?? "", m.canal_vente ?? "", m.quantite, m.facture_id ?? ""];
  });
  const csv = toCsv(headers, rows);
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="tracabilite_globale_${dateStr}.csv"`);
  return res.send(csv);
});

// ── Route principale ──────────────────────────────────────────────────────────
router.all("/goutstoso", async (req: Request, res: Response) => {
  const body = req.body as Record<string, unknown>;
  const action = (body._action as string) || "";
  const ip = req.ip || "";

  if (action === "ping" || (req.method === "GET" && !action)) {
    return ok(res, { message: "Goutstoso API – OK" });
  }

  // LOGIN
  if (action === "login") {
    const username = String(body.username || "").trim();
    const password = String(body.password || "");
    if (!username || !password) return fail(res, "Identifiants manquants.");
    const user = await findUser(username);
    if (!user) return fail(res, "Identifiants invalides.");
    const valid = await verifyPassword(password, user.password);
    if (!valid) return fail(res, "Identifiants invalides.");
    if (!user.active) return fail(res, "Compte désactivé.");
    const token = await createToken(user.id);
    await logActivity(user.id, "login", ip);
    return ok(res, { token, user: publicUser(user) });
  }

  // CHECK TOKEN
  if (action === "check_token") {
    const tok = getTokenFromReq(req);
    const t = tok ? await findToken(tok) : null;
    if (!t) return res.json({ _auth_required: true });
    const user = await findUserById(t.user_id);
    if (!user || !user.active) return res.json({ _auth_required: true });
    return ok(res, { user: publicUser(user) });
  }

  // LOGOUT
  if (action === "logout") {
    const tok = getTokenFromReq(req);
    if (tok) {
      const t = await findToken(tok);
      if (t) await logActivity(t.user_id, "logout", ip);
      await revokeToken(tok);
    }
    return ok(res);
  }

  // LOAD DATA
  if (action === "load_data") {
    if (!await requireAuth(req, res)) return;
    const rows = await q<{ data: Record<string, unknown> }>("SELECT data FROM gs_data WHERE id=1 LIMIT 1");
    if (!rows[0]) return ok(res, {});
    return res.json({ success: true, ...rows[0].data });
  }

  // SAVE DATA
  if (action === "save_data" || (!action && body.produits !== undefined)) {
    const user = await requireAuth(req, res);
    if (!user) return;
    const toSave: Record<string, unknown> = { ...body };
    delete toSave["_token"];
    delete toSave["_action"];
    delete toSave["_lotsTracabilite"];
    delete toSave["_mouvementsStockTracabilite"];
    if (Object.keys(toSave).length > 0) {
      await pool.query(
        `INSERT INTO gs_data(id,data,updated_at) VALUES(1,$1::jsonb,NOW())
         ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data, updated_at=NOW()`,
        [JSON.stringify(toSave)]
      );
      // Backup quotidien automatique — conserve les 30 derniers jours
      try {
        const today = new Date().toISOString().slice(0, 10);
        const existingToday = await q<{ id: string }>(
          "SELECT id FROM gs_backups WHERE type='auto-daily' AND label=$1 LIMIT 1",
          [today]
        );
        if (!existingToday[0]) {
          const nbTx = Array.isArray((toSave as any).transactions) ? (toSave as any).transactions.length : 0;
          const backupLabel = `Auto ${today} (${nbTx} tx)`;
          const { lots, mouvements } = await getLotsSnapshot();
          const toSaveWithLots = { ...toSave, _lotsTracabilite: lots, _mouvementsStockTracabilite: mouvements };
          await pool.query(
            "INSERT INTO gs_backups(id,label,type,data,created_at,created_by) VALUES($1,$2,'auto-daily',$3::jsonb,NOW(),$4)",
            ["b" + Date.now(), backupLabel, JSON.stringify(toSaveWithLots), user.display_name]
          );
          // Garder seulement les 30 derniers backups auto
          await pool.query(
            `DELETE FROM gs_backups WHERE type='auto-daily' AND id NOT IN (
              SELECT id FROM gs_backups WHERE type='auto-daily' ORDER BY created_at DESC LIMIT 30
            )`
          );
        }
      } catch(e) { /* backup non bloquant */ }
    }
    return ok(res);
  }

  // SAVE BACKUP
  if (action === "save_backup") {
    const user = await requireAuth(req, res);
    if (!user) return;
    const label = String(body.label || new Date().toLocaleDateString("fr-CH"));
    const type = String(body.type || "manual");
    const rows = await q<{ data: Record<string, unknown> }>("SELECT data FROM gs_data WHERE id=1 LIMIT 1");
    if (!rows[0]) return fail(res, "Aucune donnée à sauvegarder.");
    const id = "b" + Date.now();
    const { lots, mouvements } = await getLotsSnapshot();
    const dataWithLots = { ...rows[0].data, _lotsTracabilite: lots, _mouvementsStockTracabilite: mouvements };
    await pool.query(
      "INSERT INTO gs_backups(id,label,type,data,created_at,created_by) VALUES($1,$2,$3,$4::jsonb,NOW(),$5)",
      [id, label, type, JSON.stringify(dataWithLots), user.display_name]
    );
    // Keep only last MAX_BACKUPS
    await pool.query(
      `DELETE FROM gs_backups WHERE id NOT IN (
        SELECT id FROM gs_backups ORDER BY created_at DESC LIMIT $1
      )`,
      [MAX_BACKUPS]
    );
    await logActivity(user.id, "save_backup", ip);
    return ok(res, { id });
  }

  // LIST BACKUPS
  if (action === "list_backups") {
    if (!await requireAuth(req, res)) return;
    const backups = await q<{ id: string; label: string; type: string; created_at: string; created_by: string }>(
      "SELECT id,label,type,created_at,created_by FROM gs_backups ORDER BY created_at DESC"
    );
    return ok(res, { backups });
  }

  // GET BACKUP
  if (action === "get_backup") {
    if (!await requireAuth(req, res)) return;
    const bid = String(body.backup_id || "");
    const rows = await q<{ data: Record<string, unknown> }>(
      "SELECT data FROM gs_backups WHERE id=$1 LIMIT 1", [bid]
    );
    if (!rows[0]) return fail(res, "Sauvegarde introuvable.");
    return ok(res, { data: rows[0].data });
  }

  // RESTORE BACKUP
  if (action === "restore_backup") {
    const user = await requireAuth(req, res);
    if (!user) return;
    const bid = String(body.backup_id || "");
    const rows = await q<{ data: Record<string, unknown> }>(
      "SELECT data FROM gs_backups WHERE id=$1 LIMIT 1", [bid]
    );
    if (!rows[0]) return fail(res, "Sauvegarde introuvable.");
    const backupData = { ...rows[0].data };
    delete backupData["_lotsTracabilite"];
    delete backupData["_mouvementsStockTracabilite"];
    await pool.query(
      `INSERT INTO gs_data(id,data,updated_at) VALUES(1,$1::jsonb,NOW())
       ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data, updated_at=NOW()`,
      [JSON.stringify(backupData)]
    );
    await restoreLotsSnapshot(rows[0].data);
    await logActivity(user.id, "restore_backup", ip);
    return ok(res);
  }

  // LIST USERS (admin)
  if (action === "list_users") {
    if (!await requireAdmin(req, res)) return;
    const users = await getUsers();
    return ok(res, { users: users.map(u => ({ id: u.id, username: u.username, display_name: u.display_name, role: u.role, active: u.active, created_at: u.created_at })) });
  }

  // CREATE USER (admin)
  if (action === "create_user") {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const username = String(body.username || "").trim();
    const password = String(body.password || "");
    const display_name = String(body.display_name || username).trim();
    const role = body.role === "admin" ? "admin" : "user";
    if (!username || !password) return fail(res, "Identifiant et mot de passe requis.");
    if (await findUser(username)) return fail(res, "Cet identifiant existe déjà.");
    const hashed = await hashPassword(password);
    const newId = "u" + Date.now();
    await pool.query(
      "INSERT INTO gs_users(id,username,password,display_name,role,active,created_at) VALUES($1,$2,$3,$4,$5,1,NOW())",
      [newId, username, hashed, display_name, role]
    );
    await logActivity(admin.id, "create_user", ip);
    return ok(res, { id: newId });
  }

  // UPDATE USER (admin)
  if (action === "update_user") {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const id = String(body.id || "");
    const user = await findUserById(id);
    if (!user) return fail(res, "Utilisateur introuvable.");
    const display_name = body.display_name !== undefined ? String(body.display_name).trim() : user.display_name;
    const role = (body.role === "admin" || body.role === "user") ? body.role : user.role;
    const active = body.active !== undefined ? Number(body.active) : user.active;
    const password = body.password ? await hashPassword(String(body.password)) : user.password;
    await pool.query(
      "UPDATE gs_users SET display_name=$1,role=$2,active=$3,password=$4 WHERE id=$5",
      [display_name, role, active, password, id]
    );
    await logActivity(admin.id, "update_user", ip);
    return ok(res);
  }

  // DELETE USER (admin)
  if (action === "delete_user") {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const id = String(body.id || "");
    if (id === admin.id) return fail(res, "Impossible de supprimer votre propre compte.");
    await pool.query("DELETE FROM gs_users WHERE id=$1", [id]);
    await logActivity(admin.id, "delete_user", ip);
    return ok(res);
  }

  // GET ACTIVITY (admin)
  if (action === "get_activity") {
    if (!await requireAdmin(req, res)) return;
    const limit = Math.min(Number(body.limit || 100), 500);
    const users = await getUsers();
    const userMap: Record<string, string> = {};
    for (const u of users) userMap[u.id] = u.display_name;
    const entries = await q<{ user_id: string; action: string; ip: string; created_at: string }>(
      "SELECT user_id,action,ip,created_at FROM gs_activity ORDER BY created_at DESC LIMIT $1", [limit]
    );
    return ok(res, { activity: entries.map(e => ({ ...e, display_name: userMap[e.user_id] || e.user_id })) });
  }

  // LIST LOTS (optionally by produitId), FIFO order
  if (action === "list_lots") {
    if (!await requireAuth(req, res)) return;
    const produitId = body.produitId ? String(body.produitId) : "";
    const lots = produitId
      ? await q<Lot>("SELECT * FROM gs_lots WHERE produit_id=$1 ORDER BY date_fabrication ASC, id ASC", [produitId])
      : await q<Lot>("SELECT * FROM gs_lots ORDER BY date_fabrication ASC, id ASC");
    return ok(res, { lots });
  }

  // CREATE LOT
  if (action === "create_lot") {
    const user = await requireAuth(req, res);
    if (!user) return;
    const produitId = String(body.produitId || "");
    const numeroLot = String(body.numeroLot || "").trim();
    const dateFabrication = String(body.dateFabrication || "");
    const quantiteProduite = Math.max(0, parseInt(String(body.quantiteProduite || 0), 10) || 0);
    if (!produitId || !numeroLot || !dateFabrication || !quantiteProduite) {
      return fail(res, "Produit, numéro de lot, date de fabrication et quantité sont requis.");
    }
    const existing = await q<{ id: number }>("SELECT id FROM gs_lots WHERE numero_lot=$1 LIMIT 1", [numeroLot]);
    if (existing[0]) return fail(res, `Le numéro de lot "${numeroLot}" existe déjà.`);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const inserted = await client.query<Lot>(
        `INSERT INTO gs_lots(produit_id,numero_lot,date_fabrication,quantite_produite,quantite_restante,degre_alcool_mesure,degre_alcool_etiquette,date_durabilite,controle_par,statut)
         VALUES($1,$2,$3,$4,$4,$5,$6,$7,$8,'en_stock') RETURNING *`,
        [
          produitId, numeroLot, dateFabrication, quantiteProduite,
          body.degreAlcoolMesure ? parseFloat(String(body.degreAlcoolMesure)) : null,
          body.degreAlcoolEtiquette ? parseFloat(String(body.degreAlcoolEtiquette)) : null,
          body.dateDurabilite ? String(body.dateDurabilite) : null,
          body.controlePar ? String(body.controlePar) : user.display_name,
        ]
      );
      const lot = inserted.rows[0]!;
      await client.query(
        "INSERT INTO gs_mouvements_stock(lot_id,type,quantite) VALUES($1,'entree_production',$2)",
        [lot.id, quantiteProduite]
      );
      await client.query("COMMIT");
      await logActivity(user.id, `create_lot:${numeroLot}`, ip);
      return ok(res, { lot });
    } catch (e) {
      await client.query("ROLLBACK");
      return fail(res, "Erreur lors de la création du lot : " + String(e), 500);
    } finally {
      client.release();
    }
  }

  // UPDATE LOT (statut: bloque / en_stock, ou correction manuelle)
  if (action === "update_lot") {
    const user = await requireAuth(req, res);
    if (!user) return;
    const id = parseInt(String(body.id || 0), 10);
    if (!id) return fail(res, "Lot introuvable.");
    const rows = await q<Lot>("SELECT * FROM gs_lots WHERE id=$1 LIMIT 1", [id]);
    if (!rows[0]) return fail(res, "Lot introuvable.");
    const statut = body.statut ? String(body.statut) : rows[0].statut;
    await pool.query("UPDATE gs_lots SET statut=$1 WHERE id=$2", [statut, id]);
    await logActivity(user.id, `update_lot:${rows[0].numero_lot}`, ip);
    return ok(res);
  }

  // CONSUME LOT (sortie vente) — transactionnel, verrouillage anti-survente
  if (action === "consume_lot") {
    const user = await requireAuth(req, res);
    if (!user) return;
    const lotId = parseInt(String(body.lotId || 0), 10);
    const quantite = Math.max(0, parseInt(String(body.quantite || 0), 10) || 0);
    if (!lotId || !quantite) return fail(res, "Lot et quantité requis.");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const rows = await client.query<Lot>("SELECT * FROM gs_lots WHERE id=$1 FOR UPDATE", [lotId]);
      const lot = rows.rows[0];
      if (!lot) { await client.query("ROLLBACK"); return fail(res, "Lot introuvable."); }
      if (lot.quantite_restante < quantite) {
        await client.query("ROLLBACK");
        return fail(res, `Stock insuffisant sur le lot ${lot.numero_lot} : ${lot.quantite_restante} restant(s), ${quantite} demandé(s).`);
      }
      const nouvelleQuantite = lot.quantite_restante - quantite;
      const nouveauStatut = nouvelleQuantite <= 0 ? "epuise" : lot.statut;
      await client.query("UPDATE gs_lots SET quantite_restante=$1, statut=$2 WHERE id=$3", [nouvelleQuantite, nouveauStatut, lotId]);
      await client.query(
        `INSERT INTO gs_mouvements_stock(lot_id,type,quantite,facture_id,client_nom,canal_vente)
         VALUES($1,'sortie_vente',$2,$3,$4,$5)`,
        [lotId, quantite, body.factureId ? String(body.factureId) : null, body.clientNom ? String(body.clientNom) : null, body.canalVente ? String(body.canalVente) : null]
      );
      await client.query("COMMIT");
      return ok(res, { quantiteRestante: nouvelleQuantite, statut: nouveauStatut });
    } catch (e) {
      await client.query("ROLLBACK");
      return fail(res, "Erreur lors de la sortie de stock : " + String(e), 500);
    } finally {
      client.release();
    }
  }

  // RESTOCK LOT (ajustement — ex: annulation/modification d'une facture)
  if (action === "restock_lot") {
    const user = await requireAuth(req, res);
    if (!user) return;
    const lotId = parseInt(String(body.lotId || 0), 10);
    const quantite = Math.max(0, parseInt(String(body.quantite || 0), 10) || 0);
    if (!lotId || !quantite) return fail(res, "Lot et quantité requis.");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const rows = await client.query<Lot>("SELECT * FROM gs_lots WHERE id=$1 FOR UPDATE", [lotId]);
      const lot = rows.rows[0];
      if (!lot) { await client.query("ROLLBACK"); return fail(res, "Lot introuvable."); }
      const nouvelleQuantite = Math.min(lot.quantite_produite, lot.quantite_restante + quantite);
      const nouveauStatut = nouvelleQuantite > 0 && lot.statut === "epuise" ? "en_stock" : lot.statut;
      await client.query("UPDATE gs_lots SET quantite_restante=$1, statut=$2 WHERE id=$3", [nouvelleQuantite, nouveauStatut, lotId]);
      await client.query(
        `INSERT INTO gs_mouvements_stock(lot_id,type,quantite,facture_id,client_nom,canal_vente)
         VALUES($1,'ajustement',$2,$3,$4,$5)`,
        [lotId, quantite, body.factureId ? String(body.factureId) : null, body.clientNom ? String(body.clientNom) : null, body.canalVente ? String(body.canalVente) : null]
      );
      await client.query("COMMIT");
      return ok(res, { quantiteRestante: nouvelleQuantite, statut: nouveauStatut });
    } catch (e) {
      await client.query("ROLLBACK");
      return fail(res, "Erreur lors du réajustement de stock : " + String(e), 500);
    } finally {
      client.release();
    }
  }

  // CONSUME LOT FIFO — auto-sélection des lots les plus anciens pour un produit
  // Additif et best-effort : si aucun lot n'existe pour ce produit, ne fait rien (ne bloque jamais une vente).
  if (action === "consume_lot_fifo") {
    const user = await requireAuth(req, res);
    if (!user) return;
    const produitId = String(body.produitId || "").trim();
    let restant = Math.max(0, parseInt(String(body.quantite || 0), 10) || 0);
    if (!produitId || !restant) return ok(res, { consumed: [] });
    const factureId = body.factureId ? String(body.factureId) : null;
    const clientNom = body.clientNom ? String(body.clientNom) : null;
    const canalVente = body.canalVente ? String(body.canalVente) : null;
    const client = await pool.connect();
    const consumed: { lotId: number; numeroLot: string; quantite: number }[] = [];
    try {
      await client.query("BEGIN");
      const lotsRes = await client.query<Lot>(
        `SELECT * FROM gs_lots WHERE produit_id=$1 AND quantite_restante>0 AND statut!='bloque'
         ORDER BY date_fabrication ASC, id ASC FOR UPDATE`,
        [produitId]
      );
      for (const lot of lotsRes.rows) {
        if (restant <= 0) break;
        const pris = Math.min(lot.quantite_restante, restant);
        if (pris <= 0) continue;
        restant -= pris;
        const nouvelleQuantite = lot.quantite_restante - pris;
        const nouveauStatut = nouvelleQuantite <= 0 ? "epuise" : lot.statut;
        await client.query("UPDATE gs_lots SET quantite_restante=$1, statut=$2 WHERE id=$3", [nouvelleQuantite, nouveauStatut, lot.id]);
        await client.query(
          `INSERT INTO gs_mouvements_stock(lot_id,type,quantite,facture_id,client_nom,canal_vente)
           VALUES($1,'sortie_vente',$2,$3,$4,$5)`,
          [lot.id, pris, factureId, clientNom, canalVente]
        );
        consumed.push({ lotId: lot.id, numeroLot: lot.numero_lot, quantite: pris });
      }
      await client.query("COMMIT");
      return ok(res, { consumed, resteNonCouvert: restant });
    } catch (e) {
      await client.query("ROLLBACK");
      return fail(res, "Erreur lors de la sortie FIFO : " + String(e), 500);
    } finally {
      client.release();
    }
  }

  // RESTOCK LOT FIFO BY REFERENCE — annule les sorties liées à une référence (facture/commande) donnée
  // Utilisé lors de la suppression/annulation d'une commande dont le stock avait été déduit automatiquement des lots.
  if (action === "restock_lot_fifo_by_reference") {
    const user = await requireAuth(req, res);
    if (!user) return;
    const factureId = String(body.factureId || "").trim();
    const produitId = body.produitId ? String(body.produitId) : null;
    if (!factureId) return ok(res, { restocked: [] });
    const client = await pool.connect();
    const restocked: { lotId: number; numeroLot: string; quantite: number }[] = [];
    try {
      await client.query("BEGIN");
      const sortiesRes = await client.query<MouvementStock & { produit_id: string; quantite_produite: number; numero_lot: string }>(
        `SELECT ms.*, l.produit_id, l.quantite_produite, l.numero_lot
         FROM gs_mouvements_stock ms JOIN gs_lots l ON l.id = ms.lot_id
         WHERE ms.facture_id = $1 AND ms.type = 'sortie_vente'
         ${produitId ? "AND l.produit_id = $2" : ""}
         ORDER BY ms.date_mouvement ASC`,
        produitId ? [factureId, produitId] : [factureId]
      );
      for (const sortie of sortiesRes.rows) {
        const alreadyReversed = await client.query(
          `SELECT COUNT(*)::int AS n FROM gs_mouvements_stock WHERE lot_id=$1 AND facture_id=$2 AND type='ajustement' AND canal_vente='annulation-auto'`,
          [sortie.lot_id, factureId]
        );
        if (alreadyReversed.rows[0]?.n > 0) continue;
        const lotRes = await client.query<Lot>("SELECT * FROM gs_lots WHERE id=$1 FOR UPDATE", [sortie.lot_id]);
        const lot = lotRes.rows[0];
        if (!lot) continue;
        const nouvelleQuantite = Math.min(lot.quantite_produite, lot.quantite_restante + sortie.quantite);
        const nouveauStatut = nouvelleQuantite > 0 && lot.statut === "epuise" ? "en_stock" : lot.statut;
        await client.query("UPDATE gs_lots SET quantite_restante=$1, statut=$2 WHERE id=$3", [nouvelleQuantite, nouveauStatut, lot.id]);
        await client.query(
          `INSERT INTO gs_mouvements_stock(lot_id,type,quantite,facture_id,client_nom,canal_vente)
           VALUES($1,'ajustement',$2,$3,$4,'annulation-auto')`,
          [lot.id, sortie.quantite, factureId, sortie.client_nom]
        );
        restocked.push({ lotId: lot.id, numeroLot: lot.numero_lot, quantite: sortie.quantite });
      }
      await client.query("COMMIT");
      return ok(res, { restocked });
    } catch (e) {
      await client.query("ROLLBACK");
      return fail(res, "Erreur lors de la restauration FIFO : " + String(e), 500);
    } finally {
      client.release();
    }
  }

  // SEARCH LOT (traçabilité)
  if (action === "search_lot") {
    if (!await requireAuth(req, res)) return;
    const numeroLot = String(body.numeroLot || "").trim();
    if (!numeroLot) return fail(res, "Numéro de lot requis.");
    const rows = await q<Lot>("SELECT * FROM gs_lots WHERE numero_lot ILIKE $1 LIMIT 1", [numeroLot]);
    const lot = rows[0];
    if (!lot) return fail(res, "Aucun lot trouvé avec ce numéro.");
    const mouvements = await q<MouvementStock>(
      "SELECT * FROM gs_mouvements_stock WHERE lot_id=$1 ORDER BY date_mouvement ASC", [lot.id]
    );
    return ok(res, { lot, mouvements });
  }

  return fail(res, `Action inconnue : '${action}'`);
});

export default router;
