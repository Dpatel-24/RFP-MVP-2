// ════════════════════════════════════════════════════════════════════════════
// [GOOGLE-REVIEWS — TEST FEATURE]  (read-only Google reviews on hotel detail)
//
// This is an experimental feature. If it doesn't work out, remove it cleanly by
// deleting everything tagged "GOOGLE-REVIEWS" — grep the repo for that tag.
// Full checklist:
//   1. Delete this file (lib/GoogleReviews.js).
//   2. Delete pages/api/google-reviews.js.
//   3. pages/index.js — remove the <GoogleReviews .../> usage and its import.
//   4. lib/api.js — remove fetchGoogleReviews(), the `googlePlaceId` line in
//      mapHotel, and `google_place_id` from the getHotelsWithRooms select.
//   5. (optional) drop the DB column:
//      alter table public.hotels drop column if exists google_place_id;
//      and delete supabase/migrations/20260627010000_hotels_google_place_id.sql
//   6. (optional) remove the GOOGLE_PLACES_API_KEY env var in Vercel.
//
// Nothing else in the app depends on this. It silently renders null whenever
// there is no place id, no API key, an API error, or zero reviews.
// ════════════════════════════════════════════════════════════════════════════
import { useState, useEffect } from "react";
import { SL } from "./components";
import { fetchGoogleReviews } from "./api";

// Once-per-session cache keyed by place id (module-level persists across mounts).
const sessionCache = {};

function Stars({ rating = 0 }) {
  const n = Math.round(rating);
  return (
    <span style={{ fontSize: 13, color: "#F59E0B", letterSpacing: 1 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} style={{ opacity: i <= n ? 1 : 0.25 }}>★</span>
      ))}
    </span>
  );
}

export function GoogleReviews({ placeId }) {
  const [reviews, setReviews] = useState(() => (placeId ? sessionCache[placeId] : null) || null);
  const [expanded, setExpanded] = useState({});

  useEffect(() => {
    if (!placeId) return;
    if (sessionCache[placeId]) { setReviews(sessionCache[placeId]); return; }
    let cancelled = false;
    fetchGoogleReviews(placeId).then((list) => {
      if (cancelled) return;
      sessionCache[placeId] = list;     // cache even when empty → no refetch this session
      setReviews(list);
    });
    return () => { cancelled = true; };
  }, [placeId]);

  // Silent fallback: render nothing when there's no place id / no reviews.
  if (!placeId || !reviews || reviews.length === 0) return null;

  const top3 = reviews.slice(0, 3);
  return (
    <div style={{ marginTop: 16 }}>
      {top3.map((rv, i) => {
        const text = rv.text || "";
        const long = text.length > 120;
        const open = !!expanded[i];
        const shown = !long || open ? text : text.slice(0, 120).trimEnd() + "…";
        return (
          <div key={i} style={{ borderTop: `1px solid ${SL.line}`, paddingTop: 14, marginTop: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontWeight: 700, fontSize: 14, color: SL.ink }}>{rv.author_name || "Google user"}</span>
              <Stars rating={rv.rating} />
              {rv.relative_time_description && (
                <span style={{ fontSize: 12, color: SL.faint }}>{rv.relative_time_description}</span>
              )}
            </div>
            {text && (
              <div style={{ fontSize: 13, color: SL.sub, lineHeight: 1.6, marginTop: 6 }}>
                {shown}
                {long && (
                  <>
                    {" "}
                    <button
                      onClick={() => setExpanded((e) => ({ ...e, [i]: !e[i] }))}
                      style={{ background: "none", border: "none", padding: 0, color: SL.price, cursor: "pointer", fontSize: 13, fontWeight: 600 }}
                    >
                      {open ? "show less" : "read more"}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}
      <div style={{ fontSize: 11, color: SL.faint, marginTop: 14 }}>Powered by Google</div>
    </div>
  );
}
