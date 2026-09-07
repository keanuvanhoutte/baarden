// Simple HTTP server for Baarden game
// Usage: node start-server.js

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 8000;
const GAME_DIR = __dirname;

const server = http.createServer((req, res) => {
  // Parse URL
  let pathname = url.parse(req.url).pathname;
  if (pathname === '/') pathname = '/Baarden Game.html';

  // Decode URL and prevent directory traversal
  pathname = decodeURIComponent(pathname);
  if (pathname.includes('..')) {
    res.statusCode = 400;
    res.end('Bad request');
    return;
  }

  const filePath = path.join(GAME_DIR, pathname);

  // Check if file exists
  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/plain');
      res.end(`404: File not found - ${pathname}\n\nTry: http://localhost:${PORT}/Baarden%20Game.html`);
      return;
    }

    // Set content type based on file extension
    let contentType = 'text/html';
    if (pathname.endsWith('.js')) contentType = 'application/javascript';
    else if (pathname.endsWith('.css')) contentType = 'text/css';
    else if (pathname.endsWith('.json')) contentType = 'application/json';
    else if (pathname.endsWith('.pdf')) contentType = 'application/pdf';

    // DISABLE CACHING - CRITICAL FOR DEVELOPMENT
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0, post-check=0, pre-check=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    // Add CORS headers for Firebase
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Stream the file
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, () => {
  console.log('\n================================');
  console.log('🎮 Baarden Game Server');
  console.log('================================\n');
  console.log(`Server running at: http://localhost:${PORT}`);
  console.log(`Game URL: http://localhost:${PORT}/Baarden%20Game.html`);
  console.log('\n⚠️  CACHING DISABLED (for development)');
  console.log('Press Ctrl+C to stop the server\n');
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use. Try closing other servers or using a different port.`);
  } else {
    console.error('Server error:', err);
  }
  process.exit(1);
});
