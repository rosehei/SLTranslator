const express = require('express');
const path = require('path');
const {
  getPublicReviews,
  addReview,
  updateReview,
  deleteReview
} = require('./server/reviewStore');

const app = express();
const PORT = process.env.PORT || 3000;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX = 3;
const rateLimitBuckets = new Map();

app.set('trust proxy', true);
app.use(express.json({ limit: '16kb' }));

app.use((req, res, next) => {
  const blocked = [
    '/data/',
    '/server.js',
    '/server/',
    '/package.json',
    '/package-lock.json',
    '/README-BACKEND.md',
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

function getClientIp(req) {
  return req.headers['cf-connecting-ip'] || req.ip || 'unknown';
}

function isRateLimited(ip) {
  const now = Date.now();
  const recent = (rateLimitBuckets.get(ip) || [])
    .filter(timestamp => now - timestamp < RATE_LIMIT_WINDOW_MS);

  if (recent.length >= RATE_LIMIT_MAX) {
    rateLimitBuckets.set(ip, recent);
    return true;
  }

  recent.push(now);
  rateLimitBuckets.set(ip, recent);
  return false;
}

setInterval(() => {
  const now = Date.now();

  for (const [ip, timestamps] of rateLimitBuckets) {
    const recent = timestamps.filter(timestamp => now - timestamp < RATE_LIMIT_WINDOW_MS);
    if (recent.length) rateLimitBuckets.set(ip, recent);
    else rateLimitBuckets.delete(ip);
  }
}, 10 * 60 * 1000).unref();

app.get('/api/reviews', async (req, res) => {
  try {
    const reviews = await getPublicReviews();
    res.set('Cache-Control', 'no-store');
    res.json(reviews);
  } catch (error) {
    console.error('Failed to read reviews:', error);
    res.status(500).json({ error: 'Unable to load reviews right now.' });
  }
});

app.post('/api/reviews', async (req, res) => {
  const ip = getClientIp(req);

  if (isRateLimited(ip)) {
    return res.status(429).json({ error: 'Too many submissions. Please try again later.' });
  }

  try {
    await addReview(req.body);
    res.status(201).json({ ok: true });
  } catch (error) {
    if (error.statusCode === 400) {
      return res.status(400).json({ error: error.message });
    }

    console.error('Failed to save review:', error);
    res.status(500).json({ error: 'Unable to submit your review right now. Please try again.' });
  }
});

function requireAdmin(req, res, next) {
  const token = process.env.ADMIN_TOKEN;

  if (!token) {
    return res.status(403).json({ error: 'Admin access is not configured.' });
  }

  if (req.get('x-admin-token') !== token) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }

  next();
}

app.patch('/api/reviews/:id', requireAdmin, async (req, res) => {
  if (typeof req.body.hidden !== 'boolean') {
    return res.status(400).json({ error: 'hidden must be a boolean.' });
  }

  try {
    const review = await updateReview(req.params.id, { hidden: req.body.hidden });
    if (!review) return res.status(404).json({ error: 'Review not found.' });
    res.json({ ok: true });
  } catch (error) {
    console.error('Failed to update review:', error);
    res.status(500).json({ error: 'Unable to update review.' });
  }
});

app.delete('/api/reviews/:id', requireAdmin, async (req, res) => {
  try {
    const deleted = await deleteReview(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Review not found.' });
    res.json({ ok: true });
  } catch (error) {
    console.error('Failed to delete review:', error);
    res.status(500).json({ error: 'Unable to delete review.' });
  }
});

app.use(express.static(__dirname, {
  dotfiles: 'ignore',
  extensions: ['html']
}));

app.use((error, req, res, next) => {
  if (error && error.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid request body.' });
  }

  console.error('Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error.' });
});

app.listen(PORT, () => {
  console.log(`Reviews backend running at http://localhost:${PORT}`);
});
