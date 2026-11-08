const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

const REVIEW_DELAY_MINUTES = 60;
const MAX_TEXT_LENGTH = 1000;
const MAX_AUTHOR_LENGTH = 100;
const MAX_NAME_LENGTH = 200;
const MAX_REG_LENGTH = 100;
const DATA_FILE = path.join(__dirname, '..', 'data', 'reviews.json');

let writeQueue = Promise.resolve();

function enqueue(task) {
  const run = writeQueue.then(task, task);
  writeQueue = run.catch(() => {});
  return run;
}

async function readReviews() {
  try {
    const content = await fs.readFile(DATA_FILE, 'utf8');
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

async function writeReviewsAtomic(reviews) {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  const tempFile = `${DATA_FILE}.${process.pid}.${Date.now()}.tmp`;
  const payload = `${JSON.stringify(reviews, null, 2)}\n`;

  try {
    await fs.writeFile(tempFile, payload, 'utf8');
    await fs.rename(tempFile, DATA_FILE);
  } catch (error) {
    await fs.unlink(tempFile).catch(() => {});
    throw error;
  }
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

async function getPublicReviews() {
  const reviews = await readReviews();
  const now = Date.now();

  return reviews
    .filter(review => isPublished(review, now))
    .sort((a, b) => Date.parse(b.publishAt) - Date.parse(a.publishAt))
    .map(toPublicReview);
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

async function addReview(input) {
  const validated = validateReviewInput(input);

  if (validated.error) {
    const error = new Error(validated.error);
    error.statusCode = 400;
    throw error;
  }

  return enqueue(async () => {
    const reviews = await readReviews();
    const now = Date.now();
    const review = {
      id: crypto.randomUUID
        ? crypto.randomUUID()
        : `r_${now}_${Math.random().toString(36).slice(2)}`,
      ...validated.value,
      submittedAt: new Date(now).toISOString(),
      publishAt: new Date(now + REVIEW_DELAY_MINUTES * 60000).toISOString(),
      hidden: false,
      deleted: false
    };

    reviews.push(review);
    await writeReviewsAtomic(reviews);
    return review;
  });
}

async function updateReview(id, updates) {
  return enqueue(async () => {
    const reviews = await readReviews();
    const index = reviews.findIndex(review => review.id === id);
    if (index === -1) return null;

    if (typeof updates.hidden === 'boolean') {
      reviews[index].hidden = updates.hidden;
    }

    await writeReviewsAtomic(reviews);
    return reviews[index];
  });
}

async function deleteReview(id) {
  return enqueue(async () => {
    const reviews = await readReviews();
    const index = reviews.findIndex(review => review.id === id);
    if (index === -1) return false;

    reviews[index].deleted = true;
    await writeReviewsAtomic(reviews);
    return true;
  });
}

module.exports = {
  REVIEW_DELAY_MINUTES,
  MAX_TEXT_LENGTH,
  getPublicReviews,
  addReview,
  updateReview,
  deleteReview,
  validateReviewInput
};
