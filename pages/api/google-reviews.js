// ── [GOOGLE-REVIEWS — TEST FEATURE] ──────────────────────────────────────────
// Server-side proxy to the Google Places Details endpoint. Keeps the API key
// off the client (env var GOOGLE_PLACES_API_KEY, set in Vercel). Returns at most
// the newest reviews as { reviews: [...] }. Any missing key / place_id / error
// resolves to { reviews: [] } so the client silently shows nothing.
//
// TO REMOVE THE FEATURE: delete this file (and the rest tagged GOOGLE-REVIEWS;
// see lib/GoogleReviews.js header for the full checklist).
// ─────────────────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  const placeId = req.query.place_id;
  const key = process.env.GOOGLE_PLACES_API_KEY;

  // Silent fallback: no key or no place id → empty list (never an error to UI).
  if (!placeId || !key) return res.status(200).json({ reviews: [] });

  try {
    const url =
      "https://maps.googleapis.com/maps/api/place/details/json" +
      `?place_id=${encodeURIComponent(placeId)}` +
      "&fields=reviews&reviews_sort=newest&language=en" +
      `&key=${key}`;
    const r = await fetch(url);
    const data = await r.json();
    const reviews = (data?.result?.reviews || [])
      .map((rv) => ({
        author_name: rv.author_name,
        rating: rv.rating,
        relative_time_description: rv.relative_time_description,
        text: rv.text,
        time: rv.time,
      }))
      .sort((a, b) => (b.time || 0) - (a.time || 0)); // newest first
    return res.status(200).json({ reviews });
  } catch {
    return res.status(200).json({ reviews: [] });
  }
}
