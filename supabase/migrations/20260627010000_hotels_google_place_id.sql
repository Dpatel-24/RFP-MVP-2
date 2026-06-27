-- [GOOGLE-REVIEWS — TEST FEATURE] ───────────────────────────────────────────
-- Adds hotels.google_place_id, used to fetch read-only Google reviews on the
-- guest hotel-detail page. Nullable: hotels without a place id show no reviews.
--
-- TO REMOVE THE FEATURE: drop this column —
--   alter table public.hotels drop column if exists google_place_id;
-- (and remove the code tagged GOOGLE-REVIEWS; see lib/GoogleReviews.js header.)
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.hotels
  add column if not exists google_place_id text;
