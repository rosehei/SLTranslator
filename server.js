const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use((req, res, next) => {
  const blocked = [
    '/data/',
    '/server.js',
    '/server/',
    '/package.json',
    '/package-lock.json',
    '/functions/',
    '/node_modules/',
    '/.git/'
  ];

  const isBlocked = blocked.some(prefix => (
    req.path === prefix.slice(0, -1) || req.path.startsWith(prefix)
  ));

  if (isBlocked) return res.status(404).end();
  next();
});

app.use(express.static(__dirname, {
  dotfiles: 'ignore',
  extensions: ['html']
}));

app.listen(PORT, () => {
  console.log(`Site running at http://localhost:${PORT}`);
});
