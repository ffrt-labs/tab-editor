// Throwaway static server for the bench.
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const types = { '.html': 'text/html', '.mjs': 'text/javascript', '.js': 'text/javascript', '.woff2': 'font/woff2', '.woff': 'font/woff', '.otf': 'font/otf' };
export function serve(port = 0) {
  const root = path.dirname(new URL(import.meta.url).pathname);
  const srv = http.createServer((req, res) => {
    const p = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    fs.readFile(p, (err, data) => {
      if (err) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'content-type': types[path.extname(p)] ?? 'application/octet-stream' }); res.end(data);
    });
  });
  return new Promise(r => srv.listen(port, '127.0.0.1', () => r(srv)));
}
