<?php
/**
 * Goutstoso – api.php
 * Backend PHP pour l'application mobile Goutstoso.
 * À déposer à la racine de l'hébergement Infomaniak.
 *
 * Stockage : fichiers JSON dans le dossier /data/ (créé automatiquement).
 * Actions : login, check_token, logout, load_data, save_data,
 *           save_backup, list_backups, get_backup,
 *           list_users, create_user, update_user, delete_user,
 *           get_activity
 */

// ── CONFIGURATION ──────────────────────────────────────────────────────────
define('DATA_DIR',    __DIR__ . '/data');
define('BACKUP_DIR',  DATA_DIR . '/backups');
define('TOKEN_TTL',   60 * 60 * 24 * 30);   // 30 jours
define('MAX_BACKUPS', 36);

// ── CORS ────────────────────────────────────────────────────────────────────
$allowed = [
    'https://goutstoso.replit.app',
    'https://hc12z9cbqiy.preview.infomaniak.website',
];
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $allowed) || preg_match('#https?://[a-z0-9-]+\.replit\.app#', $origin)) {
    header("Access-Control-Allow-Origin: $origin");
} else {
    header("Access-Control-Allow-Origin: *");
}
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Auth-Token');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

// ── INIT DOSSIERS ───────────────────────────────────────────────────────────
foreach ([DATA_DIR, BACKUP_DIR] as $d) {
    if (!is_dir($d)) mkdir($d, 0755, true);
}
// Protéger le dossier data contre la navigation web
$htaccess = DATA_DIR . '/.htaccess';
if (!file_exists($htaccess)) file_put_contents($htaccess, "Deny from all\n");

// ── LECTURE DU BODY ─────────────────────────────────────────────────────────
$body   = file_get_contents('php://input');
$input  = json_decode($body, true) ?? [];
$action = $input['_action'] ?? ($input['action'] ?? '');
$token  = $input['_token'] ?? ($_SERVER['HTTP_X_AUTH_TOKEN'] ?? '');

// ── HELPERS FICHIERS ────────────────────────────────────────────────────────
function readJson(string $path, $default = []) {
    if (!file_exists($path)) return $default;
    $content = file_get_contents($path);
    return json_decode($content, true) ?? $default;
}

function writeJson(string $path, $data): bool {
    $tmp = $path . '.tmp.' . getmypid();
    if (file_put_contents($tmp, json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT), LOCK_EX) === false) return false;
    return rename($tmp, $path);
}

function ok($data = []): void {
    echo json_encode(array_merge(['success' => true], $data), JSON_UNESCAPED_UNICODE);
    exit;
}

function fail(string $error, int $code = 200): void {
    http_response_code($code);
    echo json_encode(['success' => false, 'error' => $error], JSON_UNESCAPED_UNICODE);
    exit;
}

// ── GESTION UTILISATEURS ────────────────────────────────────────────────────
function usersFile(): string { return DATA_DIR . '/users.json'; }

function getUsers(): array { return readJson(usersFile(), []); }

function saveUsers(array $users): void { writeJson(usersFile(), $users); }

function findUser(string $username): ?array {
    foreach (getUsers() as $u) {
        if (strtolower($u['username']) === strtolower($username)) return $u;
    }
    return null;
}

function findUserById(string $id): ?array {
    foreach (getUsers() as $u) {
        if ($u['id'] === $id) return $u;
    }
    return null;
}

// Créer l'admin par défaut si aucun utilisateur n'existe
function ensureDefaultAdmin(): void {
    $users = getUsers();
    if (empty($users)) {
        $users[] = [
            'id'           => 'u1',
            'username'     => 'jordan',
            'password'     => password_hash('Goutstoso2026!', PASSWORD_DEFAULT),
            'display_name' => 'Jordan Montanaro',
            'role'         => 'admin',
            'active'       => 1,
            'created_at'   => date('c'),
        ];
        saveUsers($users);
    }
}
ensureDefaultAdmin();

// ── GESTION TOKENS ──────────────────────────────────────────────────────────
function tokensFile(): string { return DATA_DIR . '/tokens.json'; }

function getTokens(): array {
    $tokens = readJson(tokensFile(), []);
    $now    = time();
    return array_values(array_filter($tokens, fn($t) => ($t['expires_at'] ?? 0) > $now));
}

function findToken(string $token): ?array {
    foreach (getTokens() as $t) {
        if ($t['token'] === $token) return $t;
    }
    return null;
}

function createToken(string $userId): string {
    $token  = bin2hex(random_bytes(32));
    $tokens = getTokens();
    $tokens[] = [
        'token'      => $token,
        'user_id'    => $userId,
        'created_at' => date('c'),
        'expires_at' => time() + TOKEN_TTL,
    ];
    writeJson(tokensFile(), $tokens);
    return $token;
}

function revokeToken(string $token): void {
    $tokens = array_values(array_filter(getTokens(), fn($t) => $t['token'] !== $token));
    writeJson(tokensFile(), $tokens);
}

// ── AUTHENTIFICATION REQUISE ─────────────────────────────────────────────────
function requireAuth(string $token): array {
    if (!$token) {
        http_response_code(200);
        echo json_encode(['_auth_required' => true]);
        exit;
    }
    $t = findToken($token);
    if (!$t) {
        http_response_code(200);
        echo json_encode(['_auth_required' => true]);
        exit;
    }
    $user = findUserById($t['user_id']);
    if (!$user || !($user['active'] ?? 1)) {
        http_response_code(200);
        echo json_encode(['_auth_required' => true]);
        exit;
    }
    return $user;
}

function requireAdmin(string $token): array {
    $user = requireAuth($token);
    if (($user['role'] ?? '') !== 'admin') fail('Accès refusé', 403);
    return $user;
}

// ── JOURNAL D'ACTIVITÉ ───────────────────────────────────────────────────────
function logActivity(string $userId, string $action): void {
    $file    = DATA_DIR . '/activity.json';
    $entries = readJson($file, []);
    array_unshift($entries, [
        'user_id'    => $userId,
        'action'     => $action,
        'created_at' => date('c'),
        'ip'         => $_SERVER['REMOTE_ADDR'] ?? '',
    ]);
    $entries = array_slice($entries, 0, 500);
    writeJson($file, $entries);
}

// ── PING ────────────────────────────────────────────────────────────────────
if ($action === 'ping' || (empty($action) && $_SERVER['REQUEST_METHOD'] === 'GET')) {
    ok(['message' => 'Goutstoso API v2 – OK']);
}

// ── LOGIN ───────────────────────────────────────────────────────────────────
if ($action === 'login') {
    $username = trim($input['username'] ?? '');
    $password = $input['password'] ?? '';
    if (!$username || !$password) fail('Identifiants manquants.');
    $user = findUser($username);
    if (!$user || !password_verify($password, $user['password'] ?? '')) {
        fail('Identifiants invalides.');
    }
    if (!($user['active'] ?? 1)) fail('Compte désactivé.');
    $tok = createToken($user['id']);
    logActivity($user['id'], 'login');
    ok([
        'token' => $tok,
        'user'  => [
            'id'           => $user['id'],
            'username'     => $user['username'],
            'display_name' => $user['display_name'],
            'role'         => $user['role'],
        ],
    ]);
}

// ── CHECK TOKEN ─────────────────────────────────────────────────────────────
if ($action === 'check_token') {
    $t = $token ? findToken($token) : null;
    if (!$t) { echo json_encode(['_auth_required' => true]); exit; }
    $user = findUserById($t['user_id']);
    if (!$user || !($user['active'] ?? 1)) { echo json_encode(['_auth_required' => true]); exit; }
    ok(['user' => ['id' => $user['id'], 'username' => $user['username'], 'display_name' => $user['display_name'], 'role' => $user['role']]]);
}

// ── LOGOUT ──────────────────────────────────────────────────────────────────
if ($action === 'logout') {
    if ($token) {
        $t = findToken($token);
        if ($t) logActivity($t['user_id'], 'logout');
        revokeToken($token);
    }
    ok();
}

// ─────── Routes nécessitant une authentification ────────────────────────────

$currentUser = null; // sera chargé si besoin

// ── LOAD DATA ───────────────────────────────────────────────────────────────
if ($action === 'load_data') {
    requireAuth($token);
    $data = readJson(DATA_DIR . '/main_data.json', null);
    if ($data === null) { ok([]); }
    ok($data);
}

// ── SAVE DATA (avec _action explicite ou sans _action = données brutes) ──────
// L'app envoie les données directement avec _token mais sans _action dans certains cas
if ($action === 'save_data' || (empty($action) && isset($input['produits']) && $token)) {
    $user = requireAuth($token);
    $toSave = $input;
    unset($toSave['_token'], $toSave['_action']);
    if (!empty($toSave)) {
        writeJson(DATA_DIR . '/main_data.json', $toSave);
    }
    ok();
}

// ── SAVE BACKUP ─────────────────────────────────────────────────────────────
if ($action === 'save_backup') {
    $user  = requireAuth($token);
    $label = trim($input['label'] ?? date('d/m/Y H:i'));
    $type  = $input['type'] ?? 'manual';
    $data  = readJson(DATA_DIR . '/main_data.json', null);
    if ($data === null) fail('Aucune donnée à sauvegarder.');

    $metaFile = DATA_DIR . '/backups_meta.json';
    $metas    = readJson($metaFile, []);

    $id       = 'b' . time() . rand(100, 999);
    $filename = "backup_{$id}.json";
    writeJson(BACKUP_DIR . '/' . $filename, $data);

    array_unshift($metas, [
        'id'         => $id,
        'label'      => $label,
        'type'       => $type,
        'file'       => $filename,
        'created_at' => date('c'),
        'created_by' => $user['display_name'] ?? $user['username'],
    ]);

    // Garder seulement les MAX_BACKUPS dernières
    if (count($metas) > MAX_BACKUPS) {
        $old = array_splice($metas, MAX_BACKUPS);
        foreach ($old as $o) {
            $f = BACKUP_DIR . '/' . ($o['file'] ?? '');
            if (file_exists($f)) unlink($f);
        }
    }
    writeJson($metaFile, $metas);
    logActivity($user['id'], 'save_backup');
    ok(['id' => $id]);
}

// ── LIST BACKUPS ─────────────────────────────────────────────────────────────
if ($action === 'list_backups') {
    requireAuth($token);
    $metas = readJson(DATA_DIR . '/backups_meta.json', []);
    $out   = array_map(fn($m) => [
        'id'         => $m['id'],
        'label'      => $m['label'],
        'type'       => $m['type'] ?? 'manual',
        'created_at' => $m['created_at'],
        'created_by' => $m['created_by'] ?? '',
    ], $metas);
    ok(['backups' => $out]);
}

// ── GET BACKUP ──────────────────────────────────────────────────────────────
if ($action === 'get_backup') {
    requireAuth($token);
    $bid   = $input['backup_id'] ?? '';
    $metas = readJson(DATA_DIR . '/backups_meta.json', []);
    $meta  = null;
    foreach ($metas as $m) { if ($m['id'] === $bid) { $meta = $m; break; } }
    if (!$meta) fail('Sauvegarde introuvable.');
    $data = readJson(BACKUP_DIR . '/' . $meta['file'], null);
    if ($data === null) fail('Fichier de sauvegarde manquant.');
    ok(['data' => $data]);
}

// ── RESTORE BACKUP ───────────────────────────────────────────────────────────
if ($action === 'restore_backup') {
    $user  = requireAuth($token);
    $bid   = $input['backup_id'] ?? '';
    $metas = readJson(DATA_DIR . '/backups_meta.json', []);
    $meta  = null;
    foreach ($metas as $m) { if ($m['id'] === $bid) { $meta = $m; break; } }
    if (!$meta) fail('Sauvegarde introuvable.');
    $data = readJson(BACKUP_DIR . '/' . $meta['file'], null);
    if ($data === null) fail('Fichier de sauvegarde manquant.');
    writeJson(DATA_DIR . '/main_data.json', $data);
    logActivity($user['id'], 'restore_backup');
    ok();
}

// ── ADMIN : LIST USERS ───────────────────────────────────────────────────────
if ($action === 'list_users') {
    requireAdmin($token);
    $users = array_map(fn($u) => [
        'id'           => $u['id'],
        'username'     => $u['username'],
        'display_name' => $u['display_name'],
        'role'         => $u['role'],
        'active'       => $u['active'] ?? 1,
        'created_at'   => $u['created_at'] ?? '',
    ], getUsers());
    ok(['users' => $users]);
}

// ── ADMIN : CREATE USER ──────────────────────────────────────────────────────
if ($action === 'create_user') {
    $admin    = requireAdmin($token);
    $username = trim($input['username'] ?? '');
    $password = $input['password'] ?? '';
    $display  = trim($input['display_name'] ?? $username);
    $role     = in_array($input['role'] ?? '', ['admin', 'user']) ? $input['role'] : 'user';
    if (!$username || !$password) fail('Nom d\'utilisateur et mot de passe requis.');
    if (findUser($username)) fail('Cet identifiant existe déjà.');
    $users    = getUsers();
    $newUser  = [
        'id'           => 'u' . time(),
        'username'     => $username,
        'password'     => password_hash($password, PASSWORD_DEFAULT),
        'display_name' => $display,
        'role'         => $role,
        'active'       => 1,
        'created_at'   => date('c'),
    ];
    $users[] = $newUser;
    saveUsers($users);
    logActivity($admin['id'], 'create_user');
    ok(['id' => $newUser['id']]);
}

// ── ADMIN : UPDATE USER ──────────────────────────────────────────────────────
if ($action === 'update_user') {
    $admin  = requireAdmin($token);
    $id     = $input['id'] ?? '';
    $users  = getUsers();
    $found  = false;
    foreach ($users as &$u) {
        if ($u['id'] !== $id) continue;
        $found = true;
        if (isset($input['display_name'])) $u['display_name'] = trim($input['display_name']);
        if (isset($input['role']) && in_array($input['role'], ['admin','user'])) $u['role'] = $input['role'];
        if (isset($input['active'])) $u['active'] = (int)$input['active'];
        if (!empty($input['password'])) $u['password'] = password_hash($input['password'], PASSWORD_DEFAULT);
        break;
    }
    if (!$found) fail('Utilisateur introuvable.');
    saveUsers($users);
    logActivity($admin['id'], 'update_user');
    ok();
}

// ── ADMIN : DELETE USER ──────────────────────────────────────────────────────
if ($action === 'delete_user') {
    $admin = requireAdmin($token);
    $id    = $input['id'] ?? '';
    if ($id === $admin['id']) fail('Impossible de supprimer votre propre compte.');
    $users = array_values(array_filter(getUsers(), fn($u) => $u['id'] !== $id));
    saveUsers($users);
    logActivity($admin['id'], 'delete_user');
    ok();
}

// ── ADMIN : GET ACTIVITY ─────────────────────────────────────────────────────
if ($action === 'get_activity') {
    requireAdmin($token);
    $limit    = min((int)($input['limit'] ?? 100), 500);
    $entries  = readJson(DATA_DIR . '/activity.json', []);
    $entries  = array_slice($entries, 0, $limit);
    // Enrichir avec le display_name
    $userMap = [];
    foreach (getUsers() as $u) $userMap[$u['id']] = $u['display_name'] ?? $u['username'];
    foreach ($entries as &$e) $e['display_name'] = $userMap[$e['user_id']] ?? $e['user_id'];
    ok(['activity' => $entries]);
}

// ── FALLBACK ─────────────────────────────────────────────────────────────────
fail("Action inconnue : '$action'");
