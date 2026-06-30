// ── [GEOLOCATION — STUBBED, GEOLOCATION_ENABLED=false in pages/index.js] ─────
// Server-side proxy to an IP geolocation provider (ipwho.is). Keeps lookup
// server-side so we control the IP used (the visitor's, not the browser's).
// ipwho.is is free and keyless — no API key needed, nothing to put in Vercel
// env vars for this provider. If swapping to a provider that requires a key,
// follow the pages/api/google-reviews.js pattern: read it from
// process.env.<NAME>, set the var in Vercel project settings, and fail silent
// (return {}) when it's missing so the client always falls back gracefully.
// Returns { city, region } on success, {} on any failure — never an error to
// the client; the homepage falls back to the all-hotels pilot view either way.
// ─────────────────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  try {
    const fwd = req.headers["x-forwarded-for"];
    const ip = (Array.isArray(fwd) ? fwd[0] : fwd)?.split(",")[0]?.trim() || req.socket?.remoteAddress;

    // No usable IP (e.g. local dev) — fail silent.
    if (!ip) return res.status(200).json({});

    const url = `https://ipwho.is/${encodeURIComponent(ip)}`;
    const r = await fetch(url);
    const data = await r.json();

    if (!data || data.success === false || !data.city) return res.status(200).json({});

    return res.status(200).json({ city: data.city, region: data.region || null });
  } catch {
    return res.status(200).json({});
  }
}
