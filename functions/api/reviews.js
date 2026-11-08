const REVIEWS_KEY = 'reviews';
const RATE_LIMIT_PREFIX = 'ratelimit:';
const RATE_LIMIT_WINDOW_SECONDS = 3600;
const RATE_LIMIT_MAX = 3;
const REVIEW_DELAY_MINUTES = 60;
const MAX_TEXT_LENGTH = 1000;
const MAX_AUTHOR_LENGTH = 100;
const MAX_NAME_LENGTH = 200;
const MAX_REG_LENGTH = 100;

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...extraHeaders
    }
  });
}

function normalizeString(value, maxLength) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

function validateReviewInput(body) {
  const author = normalizeString(body && body.author, MAX_AUTHOR_LENGTH);
  const translatorName = normalizeString(body && body.translatorName, MAX_NAME_LENGTH);
  const translatorRegNumber = normalizeString(body && body.translatorRegNumber, MAX_REG_LENGTH);
  const text = normalizeString(body && body.text, MAX_TEXT_LENGTH + 1);
  const rating = Number(body && body.rating);

  if (!author) return { error: 'Please enter your name.' };
  if (!translatorName || !translatorRegNumber) return { error: 'Please select a translator.' };
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { error: 'Rating must be between 1 and 5.' };
  }
  if (!text) return { error: 'Please write your review.' };
  if (text.length > MAX_TEXT_LENGTH) {
    return { error: `Your review must be ${MAX_TEXT_LENGTH} characters or fewer.` };
  }

  return {
    value: {
      author,
      translatorName,
      translatorRegNumber,
      rating,
      text
    }
  };
}

async function readReviews(env) {
  const reviews = await env.REVIEWS_KV.get(REVIEWS_KEY, 'json');
  return Array.isArray(reviews) ? reviews : [];
}

async function writeReviews(env, reviews) {
  await env.REVIEWS_KV.put(REVIEWS_KEY, JSON.stringify(reviews));
}

function isPublished(review, now) {
  if (!review || review.hidden || review.deleted) return false;
  const publishAt = Date.parse(review.publishAt);
  return Number.isFinite(publishAt) && publishAt <= now;
}

function toPublicReview(review) {
  return {
    id: review.id,
    author: review.author,
    translatorName: review.translatorName,
    translatorRegNumber: review.translatorRegNumber,
    rating: review.rating,
    text: review.text,
    submittedAt: review.submittedAt
  };
}

function getClientIp(request) {
  return request.headers.get('CF-Connecting-IP')
    || request.headers.get('X-Forwarded-For')
    || 'unknown';
}

async function isRateLimited(env, ip) {
  const key = `${RATE_LIMIT_PREFIX}${ip}`;
  const now = Math.floor(Date.now() / 1000);
  const stored = await env.REVIEWS_KV.get(key, 'json');
  const recent = (Array.isArray(stored) ? stored : [])
    .filter(timestamp => Number.isFinite(timestamp) && now - timestamp < RATE_LIMIT_WINDOW_SECONDS);

  if (recent.length >= RATE_LIMIT_MAX) {
    await env.REVIEWS_KV.put(key, JSON.stringify(recent), {
      expirationTtl: RATE_LIMIT_WINDOW_SECONDS
    });
    return true;
  }

  recent.push(now);
  await env.REVIEWS_KV.put(key, JSON.stringify(recent), {
    expirationTtl: RATE_LIMIT_WINDOW_SECONDS
  });
  return false;
}

export async function onRequestGet(context) {
  const { env } = context;

  if (!env.REVIEWS_KV) {
    return json({ error: 'Reviews storage is not configured.' }, 500);
  }

  try {
    const reviews = await readReviews(env);
    const now = Date.now();
    const publicReviews = reviews
      .filter(review => isPublished(review, now))
      .sort((a, b) => Date.parse(b.publishAt) - Date.parse(a.publishAt))
      .map(toPublicReview);

    return json(publicReviews, 200, { 'Cache-Control': 'no-store' });
  } catch (error) {
    return json({ error: 'Unable to load reviews right now.' }, 500);
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.REVIEWS_KV) {
    return json({ error: 'Reviews storage is not configured.' }, 500);
  }

  const ip = getClientIp(request);

  try {
    if (await isRateLimited(env, ip)) {
      return json({ error: 'Too many submissions. Please try again later.' }, 429);
    }

    let body = null;
    try {
      body = await request.json();
    } catch (error) {
      return json({ error: 'Invalid request body.' }, 400);
    }

    const validated = validateReviewInput(body);
    if (validated.error) {
      return json({ error: validated.error }, 400);
    }

    const reviews = await readReviews(env);
    const now = Date.now();
    reviews.push({
      id: crypto.randomUUID(),
      ...validated.value,
      submittedAt: new Date(now).toISOString(),
      publishAt: new Date(now + REVIEW_DELAY_MINUTES * 60000).toISOString(),
      hidden: false,
      deleted: false
    });

    await writeReviews(env, reviews);
    return json({ ok: true }, 201);
  } catch (error) {
    return json({ error: 'Unable to submit your review right now. Please try again.' }, 500);
  }
}
