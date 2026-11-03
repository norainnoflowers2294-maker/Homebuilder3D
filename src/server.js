import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;
const HOST = '0.0.0.0';

// Explicit mime type mapping for ES modules and JS
app.use((req, res, next) => {
  if (req.path.endsWith('.js') || req.path.endsWith('.mjs')) {
    res.type('application/javascript');
  }
  next();
});

// Alias for lucide script at src/vendor/lucide.min.js
app.get('/src/vendor/lucide.min.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'lucide.min.js'));
});

// Alias /src/* to root directory so that /src/app.js resolves to /app.js
app.use('/src', express.static(__dirname, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    }
  }
}));

// Serve root files
app.use(express.static(__dirname, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    }
  }
}));

// Fallback to index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, HOST, () => {
  console.log(`[HomeCraft 3D] Dev server running on http://${HOST}:${PORT}`);
});
