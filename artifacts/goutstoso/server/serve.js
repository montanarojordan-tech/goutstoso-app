const http = require("http");
const fs = require("fs");
const path = require("path");

const STATIC_ROOT = path.resolve(__dirname, "..", "dist");
const basePath = (process.env.BASE_PATH || "/").replace(/\/+$/, "");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".map": "application/json",
};

const ERROR_CATCHER = `<script>
(function(){
  function show(msg){
    if(document.getElementById('__err_overlay'))return;
    var d=document.createElement('div');
    d.id='__err_overlay';
    d.style.cssText='position:fixed;top:0;left:0;right:0;bottom:0;background:#fff;display:flex;align-items:flex-start;justify-content:center;padding:20px;z-index:99999;overflow:auto;font-family:monospace;font-size:13px;';
    d.innerHTML='<pre style="color:#b91c1c;white-space:pre-wrap;word-break:break-word;max-width:100%">'+msg+'</pre>';
    document.body.appendChild(d);
  }
  window.addEventListener('error',function(e){
    show('JS ERROR:\n'+(e.error&&e.error.stack||e.message||'unknown')+'\n\n'+e.filename+':'+e.lineno);
  });
  window.addEventListener('unhandledrejection',function(e){
    show('PROMISE ERROR:\n'+(e.reason&&(e.reason.stack||String(e.reason))||'unknown'));
  });
  setTimeout(function(){
    if(document.getElementById('root')&&!document.getElementById('root').firstChild){
      show('ROOT EMPTY after 5s — React did not mount. Check above for errors.');
    }
  },5000);
})();
</script>`;

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host}`);
  let pathname = url.pathname;

  if (basePath && !pathname.startsWith(basePath)) {
    const redirectTo = basePath + (pathname === "/" ? "/" : pathname);
    res.writeHead(301, { Location: redirectTo });
    res.end();
    return;
  }

  if (basePath && pathname.startsWith(basePath)) {
    pathname = pathname.slice(basePath.length) || "/";
  }

  const safePath = path.normalize(pathname).replace(/^(\.\.(\/|\\|$))+/, "");
  let filePath = path.join(STATIC_ROOT, safePath);

  if (!filePath.startsWith(STATIC_ROOT)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(STATIC_ROOT, "index.html");
  }

  if (!fs.existsSync(filePath)) {
    res.writeHead(404);
    res.end("Not Found");
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";
  let content = fs.readFileSync(filePath);

  if (ext === ".html") {
    content = Buffer.from(content.toString().replace("</head>", ERROR_CATCHER + "</head>"));
  }

  const headers = { "content-type": contentType };
  if (ext === ".html") {
    headers["cache-control"] = "no-cache, no-store, must-revalidate";
  } else if ([".js", ".css", ".png", ".jpg", ".ico", ".woff", ".woff2"].includes(ext)) {
    headers["cache-control"] = "public, max-age=31536000, immutable";
  }

  res.writeHead(200, headers);
  res.end(content);
});

const port = parseInt(process.env.PORT || "3000", 10);
server.listen(port, "0.0.0.0", () => {
  console.log(`Serving static Expo build on port ${port} (basePath: ${basePath || "/"})`);
});
