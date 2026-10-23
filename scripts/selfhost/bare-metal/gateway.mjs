// Minimal stand-in for Supabase's Kong gateway: one URL, path-routed to auth / rest / storage.
import http from "node:http";
const routes = [["/auth/v1", 9999], ["/rest/v1", 3001], ["/storage/v1", 5000]];
http.createServer((req, res) => {
  if (req.method === "OPTIONS") { res.writeHead(204, { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" }); return res.end(); }
  const r = routes.find(([p]) => req.url.startsWith(p));
  if (!r) { res.writeHead(404); return res.end(); }
  const headers = { ...req.headers };
  if (!headers.authorization && headers.apikey) headers.authorization = `Bearer ${headers.apikey}`;
  const p = http.request({ host: "127.0.0.1", port: r[1], path: req.url.slice(r[0].length) || "/", method: req.method, headers }, (pr) => {
    res.writeHead(pr.statusCode, { ...pr.headers, "access-control-allow-origin": "*", "access-control-expose-headers": "*" }); pr.pipe(res);
  });
  p.on("error", (e) => { res.writeHead(502); res.end(String(e)); });
  req.pipe(p);
}).listen(Number(process.env.GATEWAY_PORT || 8000), "127.0.0.1");
