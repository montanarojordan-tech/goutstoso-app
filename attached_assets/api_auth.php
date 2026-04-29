<?php
error_reporting(0);
ini_set('display_errors', '0');
ini_set('html_errors', '0');

ob_start();

header("Content-Type: application/json; charset=utf-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, X-Auth-Token");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { 
  ob_end_flush();
  exit(0); 
}

$host = "hc12z9.myd.infomaniak.com";
$dbname = "hc12z9_goutstoso";
$user = "hc12z9_jordan";
$pass = "Goutstoso_2026$";

$smtp_host = "mail.infomaniak.com";
$smtp_port = 465;
$smtp_user = "admin@goutstoso.ch";
$smtp_password = "Goutstoso_2026$";

function envoyerEmailSMTP($to, $subject, $body, $toName = "") {
  global $smtp_host, $smtp_port, $smtp_user, $smtp_password;
  $log = [];
  $context = stream_context_create(['ssl' => ['verify_peer' => false, 'verify_peer_name' => false, 'allow_self_signed' => true]]);
  $socket = @stream_socket_client("ssl://$smtp_host:$smtp_port", $errno, $errstr, 15, STREAM_CLIENT_CONNECT, $context);
  if (!$socket) return ["success" => false, "error" => "Connexion: $errstr ($errno)"];
  stream_set_timeout($socket, 15);
  $read = function() use ($socket, &$log) {
    $data = "";
    while (!feof($socket)) {
      $line = fgets($socket, 515);
      if ($line === false) break;
      $data .= $line;
      $log[] = "< " . trim($line);
      if (strlen($line) >= 4 && substr($line, 3, 1) == " ") break;
    }
    return $data;
  };
  $send = function($cmd) use ($socket, $read, &$log) {
    $log[] = "> " . $cmd;
    fputs($socket, $cmd . "\r\n");
    return $read();
  };
  $greeting = $read();
  if (strpos($greeting, "220") === false) { fclose($socket); return ["success" => false, "error" => "Pas de greeting", "log" => $log]; }
  $resp = $send("EHLO goutstoso.ch");
  if (strpos($resp, "250") === false) { fclose($socket); return ["success" => false, "error" => "EHLO failed", "log" => $log]; }
  $send("AUTH LOGIN");
  $send(base64_encode($smtp_user));
  $resp = $send(base64_encode($smtp_password));
  if (strpos($resp, "235") === false) { fclose($socket); return ["success" => false, "error" => "Auth: " . trim($resp), "log" => $log]; }
  $resp = $send("MAIL FROM:<$smtp_user>");
  if (strpos($resp, "250") === false) { fclose($socket); return ["success" => false, "error" => "MAIL FROM: " . trim($resp), "log" => $log]; }
  $resp = $send("RCPT TO:<$to>");
  if (strpos($resp, "250") === false) { fclose($socket); return ["success" => false, "error" => "RCPT TO: " . trim($resp), "log" => $log]; }
  $resp = $send("DATA");
  if (strpos($resp, "354") === false) { fclose($socket); return ["success" => false, "error" => "DATA: " . trim($resp), "log" => $log]; }
  $headers  = "From: =?UTF-8?B?" . base64_encode("Goutstoso") . "?= <$smtp_user>\r\n";
  $headers .= "To: " . ($toName ? "=?UTF-8?B?" . base64_encode($toName) . "?= <$to>" : $to) . "\r\n";
  $headers .= "Subject: =?UTF-8?B?" . base64_encode($subject) . "?=\r\n";
  $headers .= "MIME-Version: 1.0\r\n";
  $headers .= "Content-Type: text/html; charset=UTF-8\r\n";
  $headers .= "Content-Transfer-Encoding: 8bit\r\n";
  $headers .= "Date: " . date('r') . "\r\n";
  $headers .= "Message-ID: <" . uniqid() . "@goutstoso.ch>\r\n";
  fputs($socket, $headers . "\r\n" . $body . "\r\n.\r\n");
  $resp = $read();
  $send("QUIT");
  fclose($socket);
  if (strpos($resp, "250") !== false) return ["success" => true];
  return ["success" => false, "error" => "Envoi: " . trim($resp), "log" => $log];
}

// ── CONNEXION BDD ────────────────────────────────────────────────
try {
  $pdo = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8mb4", $user, $pass);
  $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (PDOException $e) {
  ob_end_clean(); http_response_code(500);
  echo json_encode(["error" => "db"]); exit;
}

// ── CRÉATION DES TABLES SI NÉCESSAIRES ──────────────────────────
$pdo->exec("CREATE TABLE IF NOT EXISTS gs_data (
  id VARCHAR(50) PRIMARY KEY,
  data LONGTEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

$pdo->exec("CREATE TABLE IF NOT EXISTS gs_users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  role ENUM('admin','user') NOT NULL DEFAULT 'user',
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_login DATETIME NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

$pdo->exec("CREATE TABLE IF NOT EXISTS gs_sessions (
  token VARCHAR(64) PRIMARY KEY,
  user_id INT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,
  INDEX (user_id),
  INDEX (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

$pdo->exec("CREATE TABLE IF NOT EXISTS gs_activity (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  username VARCHAR(100) NOT NULL,
  action VARCHAR(100) NOT NULL,
  detail TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX (user_id),
  INDEX (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

// ── CRÉER L'ADMIN PAR DÉFAUT SI AUCUN UTILISATEUR ───────────────
$count = $pdo->query("SELECT COUNT(*) FROM gs_users")->fetchColumn();
if ($count == 0) {
  $hash = password_hash("Goutstoso2026!", PASSWORD_DEFAULT);
  $pdo->prepare("INSERT INTO gs_users (username, password_hash, display_name, role) VALUES (?, ?, ?, 'admin')")
      ->execute(["jordan", $hash, "Jordan Montanaro"]);
}

// ── HELPER: récupérer session depuis token ───────────────────────
function getSessionUser($pdo) {
  $token = $_SERVER['HTTP_X_AUTH_TOKEN'] ?? '';
  if (!$token) return null;
  $stmt = $pdo->prepare("SELECT s.user_id, u.username, u.display_name, u.role 
                          FROM gs_sessions s JOIN gs_users u ON u.id = s.user_id
                          WHERE s.token = ? AND s.expires_at > NOW() AND u.active = 1");
  $stmt->execute([$token]);
  return $stmt->fetch(PDO::FETCH_ASSOC) ?: null;
}

// ── HELPER: enregistrer une activité ────────────────────────────
function logActivity($pdo, $userId, $username, $action, $detail = null) {
  $pdo->prepare("INSERT INTO gs_activity (user_id, username, action, detail) VALUES (?, ?, ?, ?)")
      ->execute([$userId, $username, $action, $detail]);
}

// ── ROUTER ───────────────────────────────────────────────────────
$method = $_SERVER['REQUEST_METHOD'];
$raw = ($method === 'POST') ? file_get_contents('php://input') : '';
$data = $raw ? json_decode($raw, true) : null;
$action = $data['_action'] ?? '';

// ── SEND EMAIL ───────────────────────────────────────────────────
if ($method === 'POST' && $action === 'send_email') {
  ob_end_clean(); ob_start();
  header("Content-Type: application/json; charset=utf-8");
  $result = envoyerEmailSMTP($data['to'] ?? '', $data['subject'] ?? '', $data['body'] ?? '', $data['toName'] ?? '');
  ob_end_clean();
  echo json_encode($result);
  exit;
}

// ── LOGIN ────────────────────────────────────────────────────────
if ($method === 'POST' && $action === 'login') {
  $username = trim($data['username'] ?? '');
  $password = $data['password'] ?? '';
  
  $stmt = $pdo->prepare("SELECT id, password_hash, display_name, role, active FROM gs_users WHERE username = ?");
  $stmt->execute([$username]);
  $u = $stmt->fetch(PDO::FETCH_ASSOC);
  
  if (!$u || !$u['active'] || !password_verify($password, $u['password_hash'])) {
    ob_end_clean();
    echo json_encode(["success" => false, "error" => "Identifiants invalides"]);
    exit;
  }
  
  // Créer un token de session (7 jours)
  $token = bin2hex(random_bytes(32));
  $pdo->prepare("INSERT INTO gs_sessions (token, user_id, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 7 DAY))")
      ->execute([$token, $u['id']]);
  
  // Mettre à jour last_login
  $pdo->prepare("UPDATE gs_users SET last_login = NOW() WHERE id = ?")->execute([$u['id']]);
  
  // Logger
  logActivity($pdo, $u['id'], $username, 'login', 'Connexion réussie');
  
  ob_end_clean();
  echo json_encode([
    "success" => true,
    "token" => $token,
    "user" => ["username" => $username, "display_name" => $u['display_name'], "role" => $u['role']]
  ]);
  exit;
}

// ── LOGOUT ───────────────────────────────────────────────────────
if ($method === 'POST' && $action === 'logout') {
  $token = $_SERVER['HTTP_X_AUTH_TOKEN'] ?? '';
  if ($token) {
    $u = getSessionUser($pdo);
    if ($u) logActivity($pdo, $u['user_id'], $u['username'], 'logout', 'Déconnexion');
    $pdo->prepare("DELETE FROM gs_sessions WHERE token = ?")->execute([$token]);
  }
  ob_end_clean();
  echo json_encode(["success" => true]);
  exit;
}

// ── VÉRIFIER TOKEN ───────────────────────────────────────────────
if ($method === 'POST' && $action === 'check_token') {
  $u = getSessionUser($pdo);
  ob_end_clean();
  if ($u) {
    echo json_encode(["success" => true, "user" => ["username" => $u['username'], "display_name" => $u['display_name'], "role" => $u['role']]]);
  } else {
    echo json_encode(["success" => false]);
  }
  exit;
}

// ── LISTE DES UTILISATEURS (admin seulement) ─────────────────────
if ($method === 'POST' && $action === 'list_users') {
  $u = getSessionUser($pdo);
  if (!$u || $u['role'] !== 'admin') { ob_end_clean(); echo json_encode(["error" => "Non autorisé"]); exit; }
  
  $rows = $pdo->query("SELECT id, username, display_name, role, active, created_at, last_login FROM gs_users ORDER BY created_at")->fetchAll(PDO::FETCH_ASSOC);
  ob_end_clean();
  echo json_encode(["success" => true, "users" => $rows]);
  exit;
}

// ── CRÉER UN UTILISATEUR (admin seulement) ──────────────────────
if ($method === 'POST' && $action === 'create_user') {
  $u = getSessionUser($pdo);
  if (!$u || $u['role'] !== 'admin') { ob_end_clean(); echo json_encode(["error" => "Non autorisé"]); exit; }
  
  $newUsername = trim($data['username'] ?? '');
  $newPassword = $data['password'] ?? '';
  $newDisplay = trim($data['display_name'] ?? $newUsername);
  $newRole = in_array($data['role'] ?? '', ['admin','user']) ? $data['role'] : 'user';
  
  if (!$newUsername || !$newPassword) { ob_end_clean(); echo json_encode(["error" => "Données manquantes"]); exit; }
  
  try {
    $hash = password_hash($newPassword, PASSWORD_DEFAULT);
    $pdo->prepare("INSERT INTO gs_users (username, password_hash, display_name, role) VALUES (?, ?, ?, ?)")
        ->execute([$newUsername, $hash, $newDisplay, $newRole]);
    logActivity($pdo, $u['user_id'], $u['username'], 'create_user', "Création de l'utilisateur: $newUsername");
    ob_end_clean();
    echo json_encode(["success" => true]);
  } catch (PDOException $e) {
    ob_end_clean();
    echo json_encode(["error" => "Nom d'utilisateur déjà pris"]);
  }
  exit;
}

// ── MODIFIER UN UTILISATEUR (admin seulement) ───────────────────
if ($method === 'POST' && $action === 'update_user') {
  $u = getSessionUser($pdo);
  if (!$u || $u['role'] !== 'admin') { ob_end_clean(); echo json_encode(["error" => "Non autorisé"]); exit; }
  
  $uid = (int)($data['id'] ?? 0);
  $fields = [];
  $params = [];
  
  if (isset($data['display_name'])) { $fields[] = "display_name = ?"; $params[] = $data['display_name']; }
  if (isset($data['role']) && in_array($data['role'], ['admin','user'])) { $fields[] = "role = ?"; $params[] = $data['role']; }
  if (isset($data['active'])) { $fields[] = "active = ?"; $params[] = $data['active'] ? 1 : 0; }
  if (!empty($data['password'])) { $fields[] = "password_hash = ?"; $params[] = password_hash($data['password'], PASSWORD_DEFAULT); }
  
  if (empty($fields) || !$uid) { ob_end_clean(); echo json_encode(["error" => "Données invalides"]); exit; }
  
  $params[] = $uid;
  $pdo->prepare("UPDATE gs_users SET " . implode(', ', $fields) . " WHERE id = ?")->execute($params);
  logActivity($pdo, $u['user_id'], $u['username'], 'update_user', "Modification utilisateur ID: $uid");
  ob_end_clean();
  echo json_encode(["success" => true]);
  exit;
}

// ── SUPPRIMER UN UTILISATEUR (admin seulement) ──────────────────
if ($method === 'POST' && $action === 'delete_user') {
  $u = getSessionUser($pdo);
  if (!$u || $u['role'] !== 'admin') { ob_end_clean(); echo json_encode(["error" => "Non autorisé"]); exit; }
  
  $uid = (int)($data['id'] ?? 0);
  if (!$uid) { ob_end_clean(); echo json_encode(["error" => "ID invalide"]); exit; }
  
  // Empêcher de supprimer son propre compte
  if ($uid === (int)$u['user_id']) { ob_end_clean(); echo json_encode(["error" => "Impossible de supprimer votre propre compte"]); exit; }
  
  $pdo->prepare("DELETE FROM gs_sessions WHERE user_id = ?")->execute([$uid]);
  $pdo->prepare("DELETE FROM gs_users WHERE id = ?")->execute([$uid]);
  logActivity($pdo, $u['user_id'], $u['username'], 'delete_user', "Suppression utilisateur ID: $uid");
  ob_end_clean();
  echo json_encode(["success" => true]);
  exit;
}

// ── JOURNAL D'ACTIVITÉ (admin seulement) ────────────────────────
if ($method === 'POST' && $action === 'get_activity') {
  $u = getSessionUser($pdo);
  if (!$u || $u['role'] !== 'admin') { ob_end_clean(); echo json_encode(["error" => "Non autorisé"]); exit; }
  
  $limit = min((int)($data['limit'] ?? 50), 200);
  $rows = $pdo->prepare("SELECT id, username, action, detail, created_at FROM gs_activity ORDER BY created_at DESC LIMIT ?");
  $rows->execute([$limit]);
  ob_end_clean();
  echo json_encode(["success" => true, "activity" => $rows->fetchAll(PDO::FETCH_ASSOC)]);
  exit;
}

// ── LOGGER UNE ACTIVITÉ ─────────────────────────────────────────
if ($method === 'POST' && $action === 'log_activity') {
  $u = getSessionUser($pdo);
  if (!$u) { ob_end_clean(); echo json_encode(["error" => "Non autorisé"]); exit; }
  
  $actAction = $data['activity_action'] ?? 'action';
  $actDetail = $data['activity_detail'] ?? null;
  logActivity($pdo, $u['user_id'], $u['username'], $actAction, $actDetail);
  ob_end_clean();
  echo json_encode(["success" => true]);
  exit;
}

// ── SYNC DATA (lecture/écriture) ─────────────────────────────────
// Pour GET, pas d'authentification requise (rétrocompatibilité)
// Pour POST de données, l'authentification est requise
if ($method === 'GET') {
  $u = getSessionUser($pdo);
  // GET sans token: retourner null (forcer login)
  if (!$u) {
    ob_end_clean();
    echo json_encode(["_auth_required" => true]);
    exit;
  }
  $stmt = $pdo->query("SELECT data FROM gs_data WHERE id = 'main' LIMIT 1");
  $row = $stmt->fetch(PDO::FETCH_ASSOC);
  ob_end_clean();
  if ($row) { echo $row['data']; } else { echo "null"; }

} elseif ($method === 'POST' && !$action) {
  // Sync data
  $u = getSessionUser($pdo);
  if (!$u) { ob_end_clean(); echo json_encode(["error" => "Non autorisé"]); exit; }
  
  $input = $raw;
  $stmt = $pdo->prepare("INSERT INTO gs_data (id, data) VALUES ('main', :d) ON DUPLICATE KEY UPDATE data = :d2");
  $stmt->execute([':d' => $input, ':d2' => $input]);
  
  // Logger seulement toutes les N sauvegardes (pas trop verbeux)
  // On logue juste "sync" sans détail pour ne pas saturer
  ob_end_clean();
  echo json_encode(["success" => true]);
}
