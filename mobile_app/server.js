const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8080;
const PUBLIC_DIR = __dirname;

const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.json': 'application/json'
};

const SUBDIRS = ['authorization', 'main_app'];

const server = http.createServer((req, res) => {
    try {
        const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
        let pathname = parsedUrl.pathname === '/' ? '/index.html' : parsedUrl.pathname;
        let filePath = path.join(PUBLIC_DIR, pathname);
        let ext = path.extname(filePath).toLowerCase();
        let contentType = MIME_TYPES[ext] || 'application/octet-stream';

        const serveFile = (targetPath) => {
            fs.readFile(targetPath, (err, content) => {
                if (err) {
                    res.writeHead(500, { 'Content-Type': 'text/html' });
                    res.end(`<h1>Server Error: ${err.code}</h1>`);
                } else {
                    res.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'no-cache' });
                    res.end(content, 'utf-8');
                }
            });
        };

        // 1. Direct file match
        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            return serveFile(filePath);
        }

        // 2. Subdirectory search (authorization, authorization_backup, main_app)
        const basename = path.basename(pathname);
        for (const sub of SUBDIRS) {
            const subPath = path.join(PUBLIC_DIR, sub, basename);
            if (fs.existsSync(subPath) && fs.statSync(subPath).isFile()) {
                return serveFile(subPath);
            }
        }

        // 3. Fallback: 404
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end(`<h1>404 Not Found</h1><p>Requested path: ${pathname}</p>`, 'utf-8');
    } catch (e) {
        res.writeHead(500, { 'Content-Type': 'text/html' });
        res.end(`<h1>500 Server Error</h1><p>${e.message}</p>`);
    }
});

server.listen(PORT, () => {
    console.log(`C2 Coffee Mobile App server running at http://localhost:${PORT}/`);
});
