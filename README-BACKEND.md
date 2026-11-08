# Reviews backend

Reviews are stored in `data/reviews.json`. A review is public only when
`hidden` and `deleted` are both false and `publishAt` has passed. New reviews
become public one hour after submission. Change `REVIEW_DELAY_MINUTES` in
`server/reviewStore.js` (and `functions/api/reviews.js` for Cloudflare) to test
the delay; use `1` for a one-minute test.

## Run locally

```powershell
npm install
npm start
```

Open `http://localhost:3000/reviews.html`. The Express server serves the site
and the API on the same origin, so `/api/reviews` works without CORS.

The server blocks direct access to `data/`, `server/`, `functions/`,
`node_modules/`, `server.js`, and `package.json`.

## Admin

Set an `ADMIN_TOKEN` environment variable, then send it in the `x-admin-token`
header.

- Hide a review: `PATCH /api/reviews/:id` with `{"hidden": true}`.
- Show a review again: `PATCH /api/reviews/:id` with `{"hidden": false}`.
- Delete a review: `DELETE /api/reviews/:id` (sets `deleted` to true).

Without `ADMIN_TOKEN`, admin routes return `403`.

## Cloudflare Pages

1. Create a KV namespace and bind it to the Pages project as `REVIEWS_KV`.
2. Add an `ADMIN_TOKEN` environment variable for the admin routes.
3. Deploy the `functions/` directory with the site.
4. To keep the seed reviews, import the contents of `data/reviews.json` into
   the KV key `reviews`.

`functions/api/reviews.js` provides `GET /api/reviews` and
`POST /api/reviews`. `functions/api/reviews/[id].js` provides the admin
`PATCH` and `DELETE` routes. `functions/data/reviews.json.js` blocks direct
access to the local data file so hidden or deleted reviews cannot be read.

KV writes are read-modify-write, so simultaneous submissions can overwrite one
another under heavy load. For high-traffic use, replace the KV calls with a D1
table and use a single SQL insert/update per request.
