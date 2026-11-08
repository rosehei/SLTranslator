const REVIEWS_KEY = 'reviews';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });
}

function isAuthorized(request, env) {
  return Boolean(env.ADMIN_TOKEN) && request.headers.get('x-admin-token') === env.ADMIN_TOKEN;
}

async function readReviews(env) {
  const reviews = await env.REVIEWS_KV.get(REVIEWS_KEY, 'json');
  return Array.isArray(reviews) ? reviews : [];
}

async function writeReviews(env, reviews) {
  await env.REVIEWS_KV.put(REVIEWS_KEY, JSON.stringify(reviews));
}

export async function onRequestPatch(context) {
  const { request, env, params } = context;

  if (!env.REVIEWS_KV) {
    return json({ error: 'Reviews storage is not configured.' }, 500);
  }
  if (!isAuthorized(request, env)) {
    return json({ error: 'Unauthorized.' }, 401);
  }

  let body = null;
  try {
    body = await request.json();
  } catch (error) {
    return json({ error: 'Invalid request body.' }, 400);
  }

  if (typeof body.hidden !== 'boolean') {
    return json({ error: 'hidden must be a boolean.' }, 400);
  }

  try {
    const reviews = await readReviews(env);
    const review = reviews.find(item => item.id === params.id);
    if (!review) return json({ error: 'Review not found.' }, 404);

    review.hidden = body.hidden;
    await writeReviews(env, reviews);
    return json({ ok: true });
  } catch (error) {
    return json({ error: 'Unable to update review.' }, 500);
  }
}

export async function onRequestDelete(context) {
  const { request, env, params } = context;

  if (!env.REVIEWS_KV) {
    return json({ error: 'Reviews storage is not configured.' }, 500);
  }
  if (!isAuthorized(request, env)) {
    return json({ error: 'Unauthorized.' }, 401);
  }

  try {
    const reviews = await readReviews(env);
    const review = reviews.find(item => item.id === params.id);
    if (!review) return json({ error: 'Review not found.' }, 404);

    review.deleted = true;
    await writeReviews(env, reviews);
    return json({ ok: true });
  } catch (error) {
    return json({ error: 'Unable to delete review.' }, 500);
  }
}
