// ════════════════════════════════════════════════════════════════════════════
// [HOME-V2 DRAFT] StaySuitely-style homepage — neutral, airy, photo-forward.
//
// This is one of TWO homepage candidates. The switch lives in pages/index.js
// (HOME_VARIANT + the ?home= override). Preview at /?home=v2.
//
// TO KEEP V1 (classic): delete this file and the "suitely" branch + import in
//   pages/index.js. Done.
// TO KEEP V2 (this):    set HOME_VARIANT = "suitely" in pages/index.js, then
//   delete HotelListingView (and its marketing sections) from pages/index.js.
//
// Self-contained on purpose: local style object (V2 is a different design
// system than SL), own typeahead field, no exports used elsewhere — so
// deleting it never breaks anything.
// ════════════════════════════════════════════════════════════════════════════
import { useState } from "react";
import { useWindowWidth, MOBILE_BREAKPOINT } from "./components";
import { RESPONSE_LABEL } from "./api";

const HERO_FALLBACK = "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=1600&q=80";

// ── V2 design tokens (neutral / editorial; deliberately NOT the SL palette) ──
const V2 = {
  ink: "#16181D",
  body: "#575F6B",
  faint: "#9AA1AB",
  line: "#ECEEF1",
  bgAlt: "#F7F8F9",
  page:     { background: "#fff", color: "#16181D", fontFamily: "Inter,sans-serif" },
  section:  { maxWidth: 1120, margin: "0 auto", padding: "72px 28px 0" },
  eyebrow:  { fontSize: 12, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "#9AA1AB", marginBottom: 14 },
  h1:       { fontFamily: "Space Grotesk,sans-serif", fontSize: 46, fontWeight: 700, letterSpacing: "-1.5px", lineHeight: 1.08, margin: 0, color: "#16181D" },
  h2:       { fontFamily: "Space Grotesk,sans-serif", fontSize: 28, fontWeight: 700, letterSpacing: "-0.5px", margin: 0, color: "#16181D" },
  sub:      { fontSize: 16, color: "#575F6B", lineHeight: 1.65, margin: "18px 0 0", maxWidth: 460 },
  darkBtn:  { background: "#16181D", color: "#fff", border: "none", borderRadius: 12, padding: "14px 26px", fontSize: 14, fontWeight: 600, fontFamily: "Inter,sans-serif", cursor: "pointer" },
  textLink: { background: "none", border: "none", padding: 0, color: "#16181D", fontSize: 14, fontWeight: 600, cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 4, fontFamily: "Inter,sans-serif" },
  searchCard: { background: "#fff", border: "1px solid #ECEEF1", borderRadius: 16, boxShadow: "0 10px 34px rgba(22,24,29,0.07)", padding: 10, display: "flex", alignItems: "center", gap: 0, marginTop: 34, maxWidth: 560 },
  fieldLabel: { fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "#9AA1AB", marginBottom: 3 },
  fieldInput: { border: "none", outline: "none", fontSize: 14.5, color: "#16181D", width: "100%", fontFamily: "Inter,sans-serif", background: "transparent" },
  fieldValue: { fontSize: 14.5, color: "#575F6B" },
  divider:  { width: 1, alignSelf: "stretch", background: "#ECEEF1", margin: "6px 0" },
  typeahead: { position: "absolute", top: "calc(100% + 10px)", left: 0, right: 0, background: "#fff", border: "1px solid #ECEEF1", borderRadius: 12, boxShadow: "0 14px 40px rgba(22,24,29,0.10)", overflow: "hidden", zIndex: 1200 },
  typeaheadItem: { display: "block", width: "100%", textAlign: "left", background: "none", border: "none", padding: "12px 16px", fontSize: 14, color: "#16181D", fontFamily: "Inter,sans-serif", cursor: "pointer" },
  tile:     { position: "relative", borderRadius: 18, overflow: "hidden", cursor: "pointer", border: "1px solid #ECEEF1", background: "#fff" },
};

// ── Tiny local typeahead (mirrors V1 behavior: nothing until typed, pick just
//    fills the field, search runs only on the button) ────────────────────────
function V2LocationField({ value, setValue, options }) {
  const [open, setOpen] = useState(false);
  const q = value.trim().toLowerCase();
  const matches = q ? options.filter((o) => o.toLowerCase().includes(q)).slice(0, 6) : [];
  return (
    <div style={{ position: "relative", flex: 2, padding: "6px 18px", textAlign: "left" }}>
      <div style={V2.fieldLabel}>Location</div>
      <input
        value={value}
        onChange={(e) => { setValue(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        placeholder="Where to, tonight?"
        style={V2.fieldInput}
      />
      {open && matches.length > 0 && (
        <div style={V2.typeahead}>
          {matches.map((o) => (
            <button key={o} type="button" style={V2.typeaheadItem}
              onMouseDown={(e) => { e.preventDefault(); setValue(o); setOpen(false); }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "#F7F8F9"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}>
              {o}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── USA map with live-city markers ───────────────────────────────────────────
// Stylized hand-drawn continental-US silhouette on an equirectangular
// projection: x = (lon + 125) * 16, y = (49 - lat) * 24  → viewBox 944x600.
// Known city coordinates; cities without an entry simply get no marker.
const CITY_COORDS = {
  "slidell, la":     { lat: 30.28, lon: -89.78 },
  "new orleans, la": { lat: 29.95, lon: -90.07 },
};
const mapX = (lon) => (lon + 125) * 16;
const mapY = (lat) => (49 - lat) * 24;
const USA_PATH =
  "M 5 14 L 477 0 L 560 48 L 648 60 L 688 96 L 680 156 L 736 137 L 771 130 " +
  "L 805 96 L 856 96 L 915 46 L 930 101 L 880 175 L 816 204 L 792 264 L 784 329 " +
  "L 707 408 L 696 439 L 719 533 L 713 571 L 696 571 L 677 506 L 656 454 L 632 458 " +
  "L 600 449 L 568 475 L 536 468 L 499 463 L 446 506 L 446 553 L 414 542 L 378 462 " +
  "L 350 480 L 322 441 L 296 413 L 224 425 L 163 396 L 126 396 L 106 367 L 70 347 " +
  "L 50 298 L 10 206 L 14 134 Z";

function UsaMap({ cities, onPick }) {
  return (
    <svg viewBox="0 0 944 620" style={{ width: "100%", height: "auto", display: "block" }} role="img" aria-label="Map of LastKey cities">
      <path d={USA_PATH} fill="#EEF1F4" stroke="#D8DDE3" strokeWidth="1.5" strokeLinejoin="round" />
      {cities.map(({ city, count, lat, lon }) => {
        const x = mapX(lon), y = mapY(lat);
        return (
          <g key={city} style={{ cursor: "pointer" }} onClick={() => onPick(city)}>
            <circle cx={x} cy={y} r={16} fill="rgba(22,24,29,0.08)" />
            <circle cx={x} cy={y} r={7} fill="#16181D" stroke="#fff" strokeWidth="2.5" />
            <text x={x + 22} y={y - 2} style={{ fontFamily: "Space Grotesk,sans-serif", fontSize: 17, fontWeight: 700, fill: "#16181D" }}>{city}</text>
            <text x={x + 22} y={y + 17} style={{ fontFamily: "Inter,sans-serif", fontSize: 12.5, fill: "#575F6B" }}>
              {count} hotel{count === 1 ? "" : "s"} live tonight
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export function HomeSuitely({ hotelsWithRooms, locationCopy, onSearch }) {
  const [query, setQuery] = useState("");
  const width = useWindowWidth();
  const isMobile = width < MOBILE_BREAKPOINT;

  const cityOptions = [...new Set(hotelsWithRooms.map((h) => h.city).filter(Boolean))];
  const heroImg = hotelsWithRooms.find((h) => h.heroImage)?.heroImage || HERO_FALLBACK;

  // Group hotels per city for tiles + map markers.
  const cityGroups = cityOptions.map((city) => {
    const inCity = hotelsWithRooms.filter((h) => h.city === city);
    return { city, count: inCity.length, image: inCity.find((h) => h.heroImage)?.heroImage || HERO_FALLBACK };
  });
  const mapCities = cityGroups
    .filter(({ city }) => CITY_COORDS[city.toLowerCase()])
    .map(({ city, count }) => ({ city, count, ...CITY_COORDS[city.toLowerCase()] }));

  const guarantees = [
    [`Answers in about ${RESPONSE_LABEL}`, "Your offer goes straight to the front desk. Accept, counter, or decline - you know fast, while plans are still flexible."],
    ["Pay at the hotel", "No card is charged here. If your rate is accepted, you get a confirmation code and settle directly at check-in."],
    ["Private by design", "Hotels never see your name, email, or phone when you make an offer - only your star rating and stay count."],
  ];

  return (
    <div style={V2.page}>
      {/* ── Split hero: text + search left, photo right ─────────────────── */}
      <section style={{ ...V2.section, paddingTop: isMobile ? 40 : 84 }}>
        <div style={{ display: "flex", gap: 48, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 440px", minWidth: 300 }}>
            <div style={V2.eyebrow}>Tonight only</div>
            <h1 style={{ ...V2.h1, fontSize: isMobile ? 34 : 46 }}>Tonight&apos;s room.<br />Your rate.</h1>
            <p style={V2.sub}>
              Hotels release unsold rooms every evening. Tell them what you&apos;d pay,
              and get a private answer in about {RESPONSE_LABEL}.
            </p>
            <div style={{ fontSize: 13, fontWeight: 600, color: V2.body, marginTop: 14 }}>{locationCopy}</div>

            <div style={{ ...V2.searchCard, flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "stretch" : "center" }}>
              <V2LocationField value={query} setValue={setQuery} options={cityOptions} />
              {!isMobile && <div style={V2.divider} />}
              <div style={{ flex: 1.4, padding: "6px 18px", textAlign: "left" }}>
                <div style={V2.fieldLabel}>Check in - check out</div>
                <div style={V2.fieldValue}>Tonight to tomorrow, 11:00 AM</div>
              </div>
              <button style={{ ...V2.darkBtn, margin: isMobile ? "10px 8px 4px" : 0 }} onClick={() => onSearch(query)}>Search</button>
            </div>

            <div style={{ marginTop: 22 }}>
              <button style={V2.textLink} onClick={() => onSearch("")}>See every room available tonight</button>
            </div>
          </div>

          <div style={{ flex: "1 1 380px", minWidth: 280 }}>
            <img src={heroImg} alt="" style={{ width: "100%", height: isMobile ? 260 : 460, objectFit: "cover", borderRadius: 22, display: "block" }} />
          </div>
        </div>
      </section>

      {/* ── USA map: where we're live ───────────────────────────────────── */}
      <section style={V2.section}>
        <div style={V2.eyebrow}>Coverage</div>
        <h2 style={V2.h2}>Where we&apos;re live</h2>
        <p style={{ ...V2.sub, marginBottom: 8 }}>Starting on the Gulf Coast. New cities open as hotels join.</p>
        <div style={{ background: V2.bgAlt, border: `1px solid ${V2.line}`, borderRadius: 22, padding: isMobile ? 14 : 30, marginTop: 26 }}>
          <UsaMap cities={mapCities} onPick={onSearch} />
        </div>
      </section>

      {/* ── City tiles ──────────────────────────────────────────────────── */}
      <section style={V2.section}>
        <div style={V2.eyebrow}>Browse</div>
        <h2 style={V2.h2}>Browse by city</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: 20, marginTop: 26 }}>
          {cityGroups.map(({ city, count, image }) => (
            <div key={city} style={V2.tile} onClick={() => onSearch(city)}
              onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 14px 34px rgba(22,24,29,0.12)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "none"; }}>
              <img src={image} alt="" loading="lazy" style={{ width: "100%", height: 170, objectFit: "cover", display: "block" }} />
              <div style={{ padding: "14px 16px 16px" }}>
                <div style={{ fontFamily: "Space Grotesk,sans-serif", fontWeight: 700, fontSize: 17, color: V2.ink }}>{city}</div>
                <div style={{ fontSize: 13, color: V2.body, marginTop: 3 }}>{count} hotel{count === 1 ? "" : "s"} tonight</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Guarantee band ──────────────────────────────────────────────── */}
      <section style={{ ...V2.section, paddingBottom: 88 }}>
        <div style={V2.eyebrow}>Our promise</div>
        <h2 style={V2.h2}>Book with confidence</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 28, marginTop: 30 }}>
          {guarantees.map(([title, body]) => (
            <div key={title} style={{ borderTop: `2px solid ${V2.ink}`, paddingTop: 18 }}>
              <div style={{ fontFamily: "Space Grotesk,sans-serif", fontWeight: 700, fontSize: 16.5, color: V2.ink }}>{title}</div>
              <p style={{ fontSize: 14, color: V2.body, lineHeight: 1.65, margin: "8px 0 0" }}>{body}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
