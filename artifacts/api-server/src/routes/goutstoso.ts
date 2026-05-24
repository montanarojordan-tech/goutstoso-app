import { Router, type IRouter, type Request, type Response } from "express";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const router: IRouter = Router();

// ── Stockage persistant dans le workspace ────────────────────────────────────
const DATA_DIR = path.join(process.cwd(), ".local", "goutstoso-data");
const BACKUP_DIR = path.join(DATA_DIR, "backups");
const MAX_BACKUPS = 36;
const TOKEN_TTL = 60 * 60 * 24 * 30 * 1000; // 30 jours en ms

for (const d of [DATA_DIR, BACKUP_DIR]) {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}

// ── Helpers fichiers ─────────────────────────────────────────────────────────
function readJson<T>(file: string, def: T): T {
  try {
    if (!fs.existsSync(file)) return def;
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    return def;
  }
}

function writeJson(file: string, data: unknown): void {
  const tmp = file + ".tmp." + process.pid;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf8");
  fs.renameSync(tmp, file);
}

function ok(res: Response, data: Record<string, unknown> = {}): void {
  res.json({ success: true, ...data });
}

function fail(res: Response, error: string, code = 200): void {
  res.status(code).json({ success: false, error });
}

// ── Passwords (scrypt) ───────────────────────────────────────────────────────
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

// ── Types ────────────────────────────────────────────────────────────────────
interface User {
  id: string;
  username: string;
  password: string;
  display_name: string;
  role: "admin" | "user";
  active: number;
  created_at: string;
}

interface Token {
  token: string;
  user_id: string;
  created_at: string;
  expires_at: number;
}

interface BackupMeta {
  id: string;
  label: string;
  type: string;
  file: string;
  created_at: string;
  created_by: string;
}

interface ActivityEntry {
  user_id: string;
  action: string;
  created_at: string;
  ip: string;
}

// ── Fichiers de données ──────────────────────────────────────────────────────
const F = {
  users:    path.join(DATA_DIR, "users.json"),
  tokens:   path.join(DATA_DIR, "tokens.json"),
  data:     path.join(DATA_DIR, "main_data.json"),
  backups:  path.join(DATA_DIR, "backups_meta.json"),
  activity: path.join(DATA_DIR, "activity.json"),
};

// ── Utilisateurs ─────────────────────────────────────────────────────────────
function getUsers(): User[] { return readJson<User[]>(F.users, []); }
function saveUsers(u: User[]): void { writeJson(F.users, u); }
function findUser(username: string): User | undefined {
  return getUsers().find(u => u.username.toLowerCase() === username.toLowerCase());
}
function findUserById(id: string): User | undefined {
  return getUsers().find(u => u.id === id);
}

async function ensureDefaultAdmin(): Promise<void> {
  if (getUsers().length === 0) {
    const password = await hashPassword("Goutstoso2026!");
    saveUsers([{
      id: "u1",
      username: "jordan",
      password,
      display_name: "Jordan Montanaro",
      role: "admin",
      active: 1,
      created_at: new Date().toISOString(),
    }]);
  }
}
ensureDefaultAdmin().catch(() => {});

// ── Tokens ───────────────────────────────────────────────────────────────────
function getTokens(): Token[] {
  const now = Date.now();
  return readJson<Token[]>(F.tokens, []).filter(t => t.expires_at > now);
}
function findToken(token: string): Token | undefined {
  return getTokens().find(t => t.token === token);
}
function createToken(userId: string): string {
  const token = crypto.randomBytes(32).toString("hex");
  const tokens = getTokens();
  tokens.push({ token, user_id: userId, created_at: new Date().toISOString(), expires_at: Date.now() + TOKEN_TTL });
  writeJson(F.tokens, tokens);
  return token;
}
function revokeToken(token: string): void {
  writeJson(F.tokens, getTokens().filter(t => t.token !== token));
}

// ── Activité ─────────────────────────────────────────────────────────────────
function logActivity(userId: string, action: string, ip: string): void {
  const entries = readJson<ActivityEntry[]>(F.activity, []);
  entries.unshift({ user_id: userId, action, created_at: new Date().toISOString(), ip });
  writeJson(F.activity, entries.slice(0, 500));
}

// ── Auth helpers ─────────────────────────────────────────────────────────────
function getToken(req: Request): string {
  return (req.body?._token as string) || (req.headers["x-auth-token"] as string) || "";
}

function requireAuth(req: Request, res: Response): User | null {
  const tok = getToken(req);
  if (!tok) { res.json({ _auth_required: true }); return null; }
  const t = findToken(tok);
  if (!t) { res.json({ _auth_required: true }); return null; }
  const user = findUserById(t.user_id);
  if (!user || !user.active) { res.json({ _auth_required: true }); return null; }
  return user;
}

function requireAdmin(req: Request, res: Response): User | null {
  const user = requireAuth(req, res);
  if (!user) return null;
  if (user.role !== "admin") { fail(res, "Accès refusé", 403); return null; }
  return user;
}

function publicUser(u: User) {
  return { id: u.id, username: u.username, display_name: u.display_name, role: u.role };
}

// ── Route principale ─────────────────────────────────────────────────────────
router.all("/goutstoso", async (req: Request, res: Response) => {
  const body = req.body as Record<string, unknown>;
  const action = (body._action as string) || "";
  const ip = req.ip || "";

  // PING
  if (action === "ping" || (req.method === "GET" && !action)) {
    return ok(res, { message: "Goutstoso API – OK" });
  }

  // LOGIN
  if (action === "login") {
    const username = String(body.username || "").trim();
    const password = String(body.password || "");
    if (!username || !password) return fail(res, "Identifiants manquants.");
    const user = findUser(username);
    if (!user) return fail(res, "Identifiants invalides.");
    const valid = await verifyPassword(password, user.password);
    if (!valid) return fail(res, "Identifiants invalides.");
    if (!user.active) return fail(res, "Compte désactivé.");
    const token = createToken(user.id);
    logActivity(user.id, "login", ip);
    return ok(res, { token, user: publicUser(user) });
  }

  // CHECK TOKEN
  if (action === "check_token") {
    const tok = getToken(req);
    const t = tok ? findToken(tok) : null;
    if (!t) return res.json({ _auth_required: true });
    const user = findUserById(t.user_id);
    if (!user || !user.active) return res.json({ _auth_required: true });
    return ok(res, { user: publicUser(user) });
  }

  // LOGOUT
  if (action === "logout") {
    const tok = getToken(req);
    if (tok) {
      const t = findToken(tok);
      if (t) logActivity(t.user_id, "logout", ip);
      revokeToken(tok);
    }
    return ok(res);
  }

  // LOAD DATA
  if (action === "load_data") {
    if (!requireAuth(req, res)) return;
    const data = readJson<Record<string, unknown> | null>(F.data, null);
    if (!data) return ok(res, {});
    return res.json({ success: true, ...data });
  }

  // SAVE DATA (avec _action explicite ou données brutes avec produits)
  if (action === "save_data" || (!action && body.produits !== undefined)) {
    if (!requireAuth(req, res)) return;
    const toSave = { ...body };
    delete toSave._token;
    delete toSave._action;
    if (Object.keys(toSave).length > 0) writeJson(F.data, toSave);
    return ok(res);
  }

  // SAVE BACKUP
  if (action === "save_backup") {
    const user = requireAuth(req, res);
    if (!user) return;
    const label = String(body.label || new Date().toLocaleDateString("fr-CH"));
    const type = String(body.type || "manual");
    const data = readJson<unknown>(F.data, null);
    if (!data) return fail(res, "Aucune donnée à sauvegarder.");
    const metas = readJson<BackupMeta[]>(F.backups, []);
    const id = "b" + Date.now();
    const filename = `backup_${id}.json`;
    writeJson(path.join(BACKUP_DIR, filename), data);
    metas.unshift({ id, label, type, file: filename, created_at: new Date().toISOString(), created_by: user.display_name });
    if (metas.length > MAX_BACKUPS) {
      const old = metas.splice(MAX_BACKUPS);
      for (const o of old) {
        const f = path.join(BACKUP_DIR, o.file);
        if (fs.existsSync(f)) fs.unlinkSync(f);
      }
    }
    writeJson(F.backups, metas);
    logActivity(user.id, "save_backup", ip);
    return ok(res, { id });
  }

  // LIST BACKUPS
  if (action === "list_backups") {
    if (!requireAuth(req, res)) return;
    const metas = readJson<BackupMeta[]>(F.backups, []);
    return ok(res, { backups: metas.map(m => ({ id: m.id, label: m.label, type: m.type, created_at: m.created_at, created_by: m.created_by })) });
  }

  // GET BACKUP
  if (action === "get_backup") {
    if (!requireAuth(req, res)) return;
    const bid = String(body.backup_id || "");
    const metas = readJson<BackupMeta[]>(F.backups, []);
    const meta = metas.find(m => m.id === bid);
    if (!meta) return fail(res, "Sauvegarde introuvable.");
    const data = readJson<unknown>(path.join(BACKUP_DIR, meta.file), null);
    if (!data) return fail(res, "Fichier manquant.");
    return ok(res, { data });
  }

  // RESTORE BACKUP
  if (action === "restore_backup") {
    const user = requireAuth(req, res);
    if (!user) return;
    const bid = String(body.backup_id || "");
    const metas = readJson<BackupMeta[]>(F.backups, []);
    const meta = metas.find(m => m.id === bid);
    if (!meta) return fail(res, "Sauvegarde introuvable.");
    const data = readJson<unknown>(path.join(BACKUP_DIR, meta.file), null);
    if (!data) return fail(res, "Fichier manquant.");
    writeJson(F.data, data);
    logActivity(user.id, "restore_backup", ip);
    return ok(res);
  }

  // LIST USERS (admin)
  if (action === "list_users") {
    if (!requireAdmin(req, res)) return;
    const users = getUsers().map(u => ({ id: u.id, username: u.username, display_name: u.display_name, role: u.role, active: u.active, created_at: u.created_at }));
    return ok(res, { users });
  }

  // CREATE USER (admin)
  if (action === "create_user") {
    const admin = requireAdmin(req, res);
    if (!admin) return;
    const username = String(body.username || "").trim();
    const password = String(body.password || "");
    const display_name = String(body.display_name || username).trim();
    const role = body.role === "admin" ? "admin" : "user";
    if (!username || !password) return fail(res, "Identifiant et mot de passe requis.");
    if (findUser(username)) return fail(res, "Cet identifiant existe déjà.");
    const hashed = await hashPassword(password);
    const users = getUsers();
    const newUser: User = { id: "u" + Date.now(), username, password: hashed, display_name, role, active: 1, created_at: new Date().toISOString() };
    users.push(newUser);
    saveUsers(users);
    logActivity(admin.id, "create_user", ip);
    return ok(res, { id: newUser.id });
  }

  // UPDATE USER (admin)
  if (action === "update_user") {
    const admin = requireAdmin(req, res);
    if (!admin) return;
    const id = String(body.id || "");
    const users = getUsers();
    const idx = users.findIndex(u => u.id === id);
    if (idx === -1) return fail(res, "Utilisateur introuvable.");
    if (body.display_name !== undefined) users[idx]!.display_name = String(body.display_name).trim();
    if (body.role === "admin" || body.role === "user") users[idx]!.role = body.role;
    if (body.active !== undefined) users[idx]!.active = Number(body.active);
    if (body.password) users[idx]!.password = await hashPassword(String(body.password));
    saveUsers(users);
    logActivity(admin.id, "update_user", ip);
    return ok(res);
  }

  // DELETE USER (admin)
  if (action === "delete_user") {
    const admin = requireAdmin(req, res);
    if (!admin) return;
    const id = String(body.id || "");
    if (id === admin.id) return fail(res, "Impossible de supprimer votre propre compte.");
    saveUsers(getUsers().filter(u => u.id !== id));
    logActivity(admin.id, "delete_user", ip);
    return ok(res);
  }

  // GET ACTIVITY (admin)
  if (action === "get_activity") {
    if (!requireAdmin(req, res)) return;
    const limit = Math.min(Number(body.limit || 100), 500);
    const userMap: Record<string, string> = {};
    for (const u of getUsers()) userMap[u.id] = u.display_name;
    const entries = readJson<ActivityEntry[]>(F.activity, []).slice(0, limit).map(e => ({ ...e, display_name: userMap[e.user_id] || e.user_id }));
    return ok(res, { activity: entries });
  }

  return fail(res, `Action inconnue : '${action}'`);
});

export default router;
