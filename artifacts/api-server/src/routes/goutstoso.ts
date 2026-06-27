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

router.get("/goutstoso/restore", async (_req, res) => {
  try {
    const rows = await q<{ data: Record<string, unknown> }>("SELECT data FROM gs_data WHERE id=1 LIMIT 1");
    if (!rows[0]) { res.status(404).send("Aucune donnée dans le cloud."); return; }
    const data = rows[0].data;
    const txCount = Array.isArray(data.transactions) ? data.transactions.length : 0;
    const contratCount = Array.isArray(data.contrats) ? data.contrats.length : 0;
    const dataJson = JSON.stringify(data).replace(/<\/script>/gi, "<\\/script>");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(`<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>Restauration Goutstoso</title>
<style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f5f5f0;}
.box{background:#fff;border-radius:16px;padding:40px;max-width:400px;text-align:center;box-shadow:0 4px 24px rgba(0,0,0,.1);}
h1{font-size:22px;margin-bottom:8px;}p{color:#555;font-size:15px;}</style></head>
<body><div class="box">
<div style="font-size:48px">☁️</div>
<h1>Restauration en cours…</h1>
<p id="msg">Chargement de <strong>${txCount} transactions</strong> et <strong>${contratCount} contrats</strong>…</p>
<p id="msg2" style="margin-top:20px;font-size:13px;color:#999">Redirection automatique dans 2 secondes…</p>
</div>
<script>
try {
  var d = ${dataJson};
  localStorage.setItem("goutstoso_v2", JSON.stringify(d));
  document.getElementById("msg").innerHTML = "✅ <strong>${txCount} transactions</strong> et <strong>${contratCount} contrats</strong> restaurés !";
  document.getElementById("msg2").textContent = "Redirection en cours…";
  setTimeout(function(){ window.location.href = "/goutstoso/"; }, 1500);
} catch(e) {
  document.getElementById("msg").textContent = "❌ Erreur : " + e.message;
}
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
  res.send(file.data);
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
    if (!await requireAuth(req, res)) return;
    const toSave: Record<string, unknown> = { ...body };
    delete toSave["_token"];
    delete toSave["_action"];
    if (Object.keys(toSave).length > 0) {
      await pool.query(
        `INSERT INTO gs_data(id,data,updated_at) VALUES(1,$1::jsonb,NOW())
         ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data, updated_at=NOW()`,
        [JSON.stringify(toSave)]
      );
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
    await pool.query(
      "INSERT INTO gs_backups(id,label,type,data,created_at,created_by) VALUES($1,$2,$3,$4::jsonb,NOW(),$5)",
      [id, label, type, JSON.stringify(rows[0].data), user.display_name]
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
    await pool.query(
      `INSERT INTO gs_data(id,data,updated_at) VALUES(1,$1::jsonb,NOW())
       ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data, updated_at=NOW()`,
      [JSON.stringify(rows[0].data)]
    );
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

  return fail(res, `Action inconnue : '${action}'`);
});

export default router;
