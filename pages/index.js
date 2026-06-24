import { useState, useEffect, useRef, useCallback } from "react";
import Head from "next/head";
import * as api from "../lib/api";
import { TIMER_SECONDS, COUNTER_TIMER, TAX_RATE, effectiveStatus, secondsLeft, localDateStr } from "../lib/api";

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function fmt(secs) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// Parse a YYYY-MM-DD string as a local date (not UTC midnight).
function parseDate(ymd) {
  if (!ymd) return null;
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function shortDate(ymd) {
  const d = parseDate(ymd);
  return d ? d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "";
}
// Stay window: same-day check-in, checkout next morning 11 AM.
function stayWindow(ymd) {
  const d = parseDate(ymd);
  if (!d) return "";
  const next = new Date(d.getTime() + 86400000);
  const opts = { month: "short", day: "numeric" };
  return `${d.toLocaleDateString(undefined, opts)} → ${next.toLocaleDateString(undefined, opts)} 11:00 AM`;
}

// ─────────────────────────────────────────────────────────────────────────────
// SHARED COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────
function TimerRing({ seconds, total = TIMER_SECONDS, size = 160 }) {
  const r = (size - 16) / 2;
  const circ = 2 * Math.PI * r;
  const dash = circ * (seconds / total);
  const color = seconds < 60 ? "#EF4444" : seconds < 180 ? "#F59E0B" : "#22C55E";
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#1E293B" strokeWidth={8} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={8}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          style={{ transition: "stroke-dasharray 1s linear, stroke 0.5s" }} />
      </svg>
      <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
        <span style={{ fontFamily:"Space Grotesk,sans-serif", fontSize:size*0.22, fontWeight:700, color, letterSpacing:"-1px" }}>{fmt(seconds)}</span>
        <span style={{ fontSize:10, color:"#64748B", letterSpacing:"0.08em", textTransform:"uppercase", marginTop:2 }}>remaining</span>
      </div>
    </div>
  );
}

function RoomIcon({ type }) {
  const cfg = {
    suite:    { bg:"#1E3A5F", accent:"#F59E0B", beds:1, large:true  },
    deluxe:   { bg:"#1A3A2A", accent:"#22C55E", beds:1, large:false },
    standard: { bg:"#2D1B4E", accent:"#A78BFA", beds:2, large:false },
  };
  const c = cfg[type] || cfg.standard;
  return (
    <svg viewBox="0 0 200 120" style={{ width:"100%", height:110, borderRadius:8 }}>
      <rect width="200" height="120" fill={c.bg} />
      <rect x="10" y="60" width={c.large?120:85} height="45" rx="4" fill="#0A0F1E" />
      {c.beds===2 && <rect x="105" y="60" width="85" height="45" rx="4" fill="#0A0F1E" />}
      <rect x="15" y="55" width={c.large?110:75} height="12" rx="2" fill={c.accent} opacity="0.8" />
      {c.beds===2 && <rect x="110" y="55" width="75" height="12" rx="2" fill={c.accent} opacity="0.8" />}
      <rect x="160" y="30" width="30" height="40" rx="3" fill="#0F172A" />
      <rect x="163" y="33" width="24" height="20" rx="2" fill={c.accent} opacity="0.3" />
      <circle cx="20" cy="30" r="12" fill={c.accent} opacity="0.15" />
      <circle cx="20" cy="30" r="6"  fill={c.accent} opacity="0.4"  />
    </svg>
  );
}

// Photo if a URL exists, otherwise the SVG room illustration. `height` controls
// the rendered box; the image covers it.
function ImageOrIcon({ url, type, height = 110, radius = 8 }) {
  if (url) {
    return (
      <img src={url} alt="" loading="lazy"
        style={{ width:"100%", height, objectFit:"cover", borderRadius:radius, display:"block" }} />
    );
  }
  return <div style={{ height, borderRadius:radius, overflow:"hidden" }}><RoomIcon type={type} /></div>;
}

function Badge({ status }) {
  const map = {
    pending:   { label:"Awaiting Response", color:"#F59E0B", bg:"#451A03" },
    countered: { label:"Counter Offered",   color:"#A78BFA", bg:"#2E1065" },
    accepted:  { label:"Accepted",          color:"#22C55E", bg:"#052E16" },
    handled:   { label:"Confirmed",         color:"#22C55E", bg:"#052E16" },
    declined:  { label:"Declined",          color:"#EF4444", bg:"#3B0000" },
    expired:   { label:"Expired",           color:"#64748B", bg:"#1E293B" },
    cancelled: { label:"Cancelled",         color:"#64748B", bg:"#1E293B" },
  };
  const s = map[status] || map.pending;
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"4px 10px", borderRadius:20, fontSize:12, fontWeight:600, color:s.color, background:s.bg }}>
      <span style={{ width:6, height:6, borderRadius:"50%", background:s.color, display:"inline-block" }} />
      {s.label}
    </span>
  );
}

function StarDisplay({ rating, size = 13 }) {
  return (
    <span style={{ fontSize:size, color:"#F59E0B", letterSpacing:1 }}>
      {[1,2,3,4,5].map(i => (
        <span key={i} style={{ opacity: i <= Math.round(rating) ? 1 : 0.25 }}>★</span>
      ))}
    </span>
  );
}

function GuestProfileCard({ guest, compact = false, light = false }) {
  if (!guest) return null;
  const c = light
    ? { bg:"#fff", border:"#E5E7EB", name:"#1A1F2B", sub:"#6B7280", faint:"#9CA3AF", avBg:"#FEF3E2", avTx:"#B45309", div:"#E5E7EB" }
    : { bg:"#0A0F1E", border:"#1E293B", name:"#F7F5F0", sub:"#94A3B8", faint:"#475569", avBg:"#1E3A5F", avTx:"#F59E0B", div:"#1E293B" };
  return (
    <div style={{ background:c.bg, border:`1px solid ${c.border}`, borderRadius:10, padding: compact ? "12px 14px" : "16px 18px" }}>
      <div style={{ display:"flex", alignItems:"center", gap:12 }}>
        <div style={{ width:compact?36:44, height:compact?36:44, borderRadius:"50%", background:c.avBg, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"Space Grotesk,sans-serif", fontWeight:700, fontSize:compact?14:18, color:c.avTx, flexShrink:0 }}>
          {(guest.name || "?").split(" ").map(n=>n[0]).join("")}
        </div>
        <div style={{ flex:1 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ fontWeight:700, fontSize:compact?13:15, color:c.name }}>{guest.name}</span>
            {guest.verified && <span style={{ fontSize:10, background:"#052E16", color:"#22C55E", padding:"2px 6px", borderRadius:4, fontWeight:600 }}>✓ Verified</span>}
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:3 }}>
            <StarDisplay rating={guest.rating} size={12} />
            <span style={{ fontSize:12, color:c.sub }}>{guest.rating > 0 ? guest.rating.toFixed(1) : "New"} · {guest.stays} stays · Since {guest.memberSince}</span>
          </div>
        </div>
      </div>
      {!compact && (
        <>
          <div style={{ display:"flex", gap:16, marginTop:12, paddingTop:12, borderTop:`1px solid ${c.div}` }}>
            {[["Stays", guest.stays], ["Rating", guest.rating > 0 ? guest.rating.toFixed(1) : "—"], ["Reviews", guest.reviews]].map(([l,v]) => (
              <div key={l} style={{ textAlign:"center" }}>
                <div style={{ fontFamily:"Space Grotesk,sans-serif", fontWeight:700, fontSize:18, color:"#F59E0B" }}>{v}</div>
                <div style={{ fontSize:11, color:c.faint }}>{l}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop:10, fontSize:11, color:c.faint, fontStyle:"italic" }}>
            Hotels see your star rating and stay count only. No personal info is shared.
          </div>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EMAIL + PASSWORD LOGIN (shared by guest + hotel)
// ─────────────────────────────────────────────────────────────────────────────
function PasswordLogin({ title, eyebrow, blurb, onSignedIn, light = false }) {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy]         = useState(false);
  const [msg, setMsg]           = useState(null);

  async function submit(mode) {
    if (!email || !password) return;
    setBusy(true); setMsg(null);
    const fn = mode === "signup" ? api.signUp : api.signIn;
    const { data, error } = await fn(email.trim(), password);
    setBusy(false);
    if (error) { setMsg(error.message); return; }
    if (!data.session) {
      setMsg("Account created, but email confirmation is on. Turn off \"Confirm email\" in Supabase Auth, then sign in.");
      return;
    }
    onSignedIn(data.user, email.trim());
  }

  const fieldStyle   = light ? SL.field : S.field;
  const primaryStyle = light ? SL.primaryBtn : S.submitBtn;
  const secondaryStyle = light
    ? { ...SL.primaryBtn, background:"#fff", color:"#374151", border:"1px solid #D1D5DB" }
    : { ...S.submitBtn, background:"#1E293B", color:"#94A3B8" };

  return (
    <div>
      <div style={S.heroBox}>
        <div style={S.heroEyebrow}>{eyebrow}</div>
        <h2 style={{ ...(light?SL.h1:S.heroTitle), fontSize:24, marginBottom:10 }}>{title}</h2>
        <p style={{ ...(light?{color:"#6B7280",lineHeight:1.6,fontSize:14,margin:0}:S.heroSub) }}>{blurb}</p>
      </div>
      <div style={{ ...(light ? { ...SL.panel, padding:20 } : S.formCard) }}>
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          <input style={fieldStyle} placeholder="Email address" type="email" value={email}
            onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit("signin")} />
          <input style={fieldStyle} placeholder="Password (min 6 characters)" type="password" value={password}
            onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit("signin")} />
        </div>
        <div style={{ display:"flex", gap:10, marginTop:14 }}>
          <button style={{ ...primaryStyle, flex:1, opacity:(!email||!password||busy)?0.4:1 }} disabled={!email||!password||busy} onClick={()=>submit("signin")}>
            {busy ? "…" : "Sign In"}
          </button>
          <button style={{ ...secondaryStyle, flex:1, opacity:(!email||!password||busy)?0.4:1 }} disabled={!email||!password||busy} onClick={()=>submit("signup")}>
            Create Account
          </button>
        </div>
        {msg && <div style={{ marginTop:12, fontSize:13, color:"#EF4444" }}>{msg}</div>}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GUEST PROFILE FORM (light) — first/last/email/phone, no picture
// ─────────────────────────────────────────────────────────────────────────────
function GuestProfileForm({ guest, onSaved, onSignOut }) {
  const [first, setFirst] = useState(guest.firstName || "");
  const [last, setLast]   = useState(guest.lastName || "");
  const [phone, setPhone] = useState(guest.phone || "");
  const [busy, setBusy]   = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setBusy(true); setSaved(false);
    const fields = { firstName: first.trim(), lastName: last.trim(), phone: phone.trim() };
    try {
      await api.updateGuestProfile(guest.id, fields);
      setSaved(true);
      onSaved(fields);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) { console.error(e); alert("Could not save your profile."); }
    finally { setBusy(false); }
  }

  const label = { fontSize:12, fontWeight:600, color:SL.sub, marginBottom:6, display:"block" };
  return (
    <div style={{ ...SL.panel, padding:24 }}>
      <h2 style={{ ...SL.h1, fontSize:20, margin:"0 0 4px" }}>Your details</h2>
      <div style={{ fontSize:12, color:SL.faint, marginBottom:4 }}>
        {guest.rating > 0 ? `⭐ ${guest.rating.toFixed(1)}` : "New member"} · {guest.stays} stays · Member since {guest.memberSince}
      </div>
      <p style={{ fontSize:12, color:SL.sub, margin:"0 0 20px", lineHeight:1.6 }}>
        These details are private. Hotels only ever see your star rating and stay count — never your name, email, or phone.
      </p>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:14 }}>
        <div>
          <label style={label}>First name</label>
          <input style={SL.field} value={first} onChange={e=>setFirst(e.target.value)} placeholder="First name" />
        </div>
        <div>
          <label style={label}>Last name</label>
          <input style={SL.field} value={last} onChange={e=>setLast(e.target.value)} placeholder="Last name" />
        </div>
      </div>
      <div style={{ marginBottom:14 }}>
        <label style={label}>Email address</label>
        <input style={{ ...SL.field, background:"#F3F4F6", color:SL.sub }} value={guest.email || ""} readOnly />
        <div style={{ fontSize:11, color:SL.faint, marginTop:5 }}>Email is tied to your login and can't be changed here.</div>
      </div>
      <div style={{ marginBottom:20 }}>
        <label style={label}>Phone number</label>
        <input style={SL.field} value={phone} onChange={e=>setPhone(e.target.value)} placeholder="(555) 555-5555" type="tel" />
      </div>

      <div style={{ display:"flex", alignItems:"center", gap:12 }}>
        <button style={{ ...SL.primaryBtn, width:"auto", padding:"12px 22px", opacity:busy?0.5:1 }} disabled={busy} onClick={save}>
          {busy ? "Saving…" : "Save changes"}
        </button>
        {saved && <span style={{ fontSize:13, color:"#059669", fontWeight:600 }}>✓ Saved</span>}
      </div>

      <div style={{ borderTop:`1px solid ${SL.line}`, marginTop:22, paddingTop:18 }}>
        <button style={SL.ghostBtn} onClick={onSignOut}>Sign Out</button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HOTEL DISCOVERY LISTING  (light, Figma wireframe layout — Home/browse only)
// ─────────────────────────────────────────────────────────────────────────────
const HERO_FALLBACK = "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=1600&q=80";
const PROPERTY_TABS = ["Rooms", "Flats", "Hostels", "Villas"];

function HotelListingView({ onSelectHotel, hotelsWithRooms }) {
  const [query, setQuery] = useState("");
  const heroBg = hotelsWithRooms.find(h => h.heroImage)?.heroImage || HERO_FALLBACK;

  const q = query.trim().toLowerCase();
  const filtered = q
    ? hotelsWithRooms.filter(h =>
        [h.name, h.city, h.location].filter(Boolean).some(v => v.toLowerCase().includes(q)))
    : hotelsWithRooms;

  return (
    <div style={{ background:"#F4F5F7", color:"#1A1F2B", fontFamily:"Inter,sans-serif", minHeight:"100vh" }}>
      {/* Hero */}
      <div style={{ position:"relative", padding:"0 0 64px" }}>
        <div style={{ position:"absolute", inset:0, backgroundImage:`url(${heroBg})`, backgroundSize:"cover", backgroundPosition:"center" }} />
        <div style={{ position:"absolute", inset:0, background:"linear-gradient(180deg, rgba(10,15,30,0.55) 0%, rgba(10,15,30,0.35) 45%, rgba(244,245,247,1) 100%)" }} />
        <div style={{ position:"relative", maxWidth:1080, margin:"0 auto", padding:"64px 24px 0", textAlign:"center", color:"#fff" }}>
          <h1 style={{ fontFamily:"Space Grotesk,sans-serif", fontSize:40, fontWeight:700, letterSpacing:"-1px", margin:"0 0 12px", lineHeight:1.1 }}>
            Find tonight&apos;s room
          </h1>
          <p style={{ fontSize:16, color:"rgba(255,255,255,0.9)", margin:"0 auto 28px", maxWidth:520, lineHeight:1.5 }}>
            Name your rate at hotels with unsold rooms tonight. A private response in 10 minutes.
          </p>

          {/* Property-type tabs */}
          <div style={{ display:"inline-flex", gap:28, marginBottom:18 }}>
            {PROPERTY_TABS.map((t) => {
              const active = t === "Rooms";
              return (
                <span key={t} title={active ? "" : "Coming soon"}
                  style={{ fontSize:14, fontWeight:600, paddingBottom:6, cursor: active ? "default" : "not-allowed",
                    color: active ? "#fff" : "rgba(255,255,255,0.55)",
                    borderBottom: active ? "2px solid #F59E0B" : "2px solid transparent" }}>
                  {t}
                </span>
              );
            })}
          </div>

          {/* Search bar */}
          <div style={SL.searchBar}>
            <div style={{ flex:2, textAlign:"left", padding:"0 18px" }}>
              <div style={SL.searchLabel}>Location</div>
              <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Which city do you prefer?" style={SL.searchInput} />
            </div>
            <div style={SL.searchDivider} />
            <div style={{ flex:1.4, textAlign:"left", padding:"0 18px" }}>
              <div style={SL.searchLabel}>Check In · Check Out</div>
              <div style={SL.searchValue}>Tonight → tomorrow 11:00 AM</div>
            </div>
            <button onClick={()=>{}} style={SL.searchBtn} aria-label="Search">🔍</button>
          </div>
        </div>
      </div>

      {/* Listing grid */}
      <div style={{ maxWidth:1080, margin:"0 auto", padding:"8px 24px 56px" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:18 }}>
          <h2 style={{ fontFamily:"Space Grotesk,sans-serif", fontSize:22, fontWeight:700, margin:0 }}>Available tonight</h2>
          <span style={{ fontSize:13, color:"#6B7280" }}>{filtered.length} hotel{filtered.length===1?"":"s"} · New Orleans Area</span>
        </div>

        {filtered.length === 0 ? (
          <div style={{ background:"#fff", border:"1px solid #E5E7EB", borderRadius:16, padding:"48px 24px", textAlign:"center", color:"#6B7280" }}>
            No hotels match “{query}”. Try another city or name.
          </div>
        ) : (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(300px, 1fr))", gap:22 }}>
            {filtered.map(hotel => {
              const fromPrice = Math.min(...hotel.rooms.map(r=>r.rack));
              return (
                <div key={hotel.id} style={SL.card} onClick={() => onSelectHotel(hotel)}
                  onMouseEnter={e=>{e.currentTarget.style.boxShadow="0 10px 30px rgba(0,0,0,0.12)"; e.currentTarget.style.transform="translateY(-2px)";}}
                  onMouseLeave={e=>{e.currentTarget.style.boxShadow="0 1px 3px rgba(0,0,0,0.06)"; e.currentTarget.style.transform="none";}}>
                  <div style={{ position:"relative" }}>
                    <img src={hotel.heroImage || HERO_FALLBACK} alt="" loading="lazy"
                      style={{ width:"100%", height:190, objectFit:"cover", display:"block" }} />
                    <span style={SL.tonightTag}>{hotel.rooms.length} room{hotel.rooms.length>1?"s":""} left tonight</span>
                  </div>
                  <div style={{ padding:"14px 16px 16px" }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:10 }}>
                      <div style={{ fontFamily:"Space Grotesk,sans-serif", fontWeight:700, fontSize:16, lineHeight:1.25 }}>{hotel.name}</div>
                      <div style={{ textAlign:"right", flexShrink:0 }}>
                        <div style={{ fontSize:11, color:"#9CA3AF" }}>from</div>
                        <div style={{ fontFamily:"Space Grotesk,sans-serif", fontWeight:700, fontSize:20, color:"#0F766E" }}>${fromPrice}</div>
                      </div>
                    </div>
                    <div style={{ fontSize:13, color:"#6B7280", marginTop:3 }}>📍 {hotel.location}</div>
                    <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:8 }}>
                      <StarDisplay rating={hotel.rating} />
                      <span style={{ fontSize:12, color:"#6B7280" }}>{hotel.rating} ({hotel.reviewCount} reviews)</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer style={{ background:"#0F172A", color:"#94A3B8", padding:"32px 24px" }}>
        <div style={{ maxWidth:1080, margin:"0 auto", display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:16 }}>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <div style={S.logo}>LK</div>
            <div>
              <div style={{ color:"#F7F5F0", fontWeight:700, fontSize:14 }}>LastKey</div>
              <div style={{ fontSize:12 }}>Private rate requests · tonight only</div>
            </div>
          </div>
          <div style={{ display:"flex", gap:22, fontSize:13 }}>
            <span>How it works</span><span>Support</span><span>Privacy</span><span>Terms</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GUEST VIEW  (sidebar layout)
// ─────────────────────────────────────────────────────────────────────────────
function GuestView() {
  const [screen, setScreen]               = useState("listing");
  const [sideTab, setSideTab]             = useState("browse");
  const [hotels, setHotels]               = useState([]);
  const [bids, setBids]                   = useState([]);
  const [selectedHotel, setSelectedHotel] = useState(null);
  const [selectedRoom, setSelectedRoom]   = useState(null);
  const [bidAmount, setBidAmount]         = useState("");
  const [activeBid, setActiveBid]         = useState(null);
  const [timeLeft, setTimeLeft]           = useState(TIMER_SECONDS);
  const [counterTimeLeft, setCTL]         = useState(COUNTER_TIMER);
  const [currentGuest, setCurrentGuest]   = useState(null);
  const [counterToast, setCounterToast]   = useState(false);
  const [submitting, setSubmitting]       = useState(false);
  const [guestDate, setGuestDate]         = useState(localDateStr());
  const [agreeTerms, setAgreeTerms]       = useState(false);
  const [now, setNow]                     = useState(Date.now());
  const timerRef = useRef(null);

  const myBids    = bids;
  const myLive    = myBids.filter(b => ["pending","countered"].includes(effectiveStatus(b)));
  const myHistory = myBids.filter(b => !["pending","countered"].includes(effectiveStatus(b)));

  const refreshBids = useCallback(async (guest) => {
    const g = guest || currentGuest;
    if (!g) return;
    try { setBids(await api.getMyRequests(g.id, g)); } catch (e) { console.error(e); }
  }, [currentGuest]);

  // ── Load hotels once ──────────────────────────────────────────────────────
  useEffect(() => { api.getHotelsWithRooms().then(setHotels).catch(console.error); }, []);

  // ── Restore session + subscribe to my requests ────────────────────────────
  useEffect(() => {
    let unsub = null;
    async function boot(session) {
      if (!session) { setCurrentGuest(null); setBids([]); return; }
      const profile = await api.ensureGuestProfile(session.user, session.user.email?.split("@")[0]);
      if (profile) profile.email = session.user.email;
      setCurrentGuest(profile);
      refreshBids(profile);
      if (unsub) unsub();
      unsub = api.subscribeRequests("guest_id", session.user.id, () => refreshBids(profile));
    }
    api.getSession().then(boot);
    const { data: sub } = api.onAuthChange(boot);
    return () => { if (unsub) unsub(); sub?.subscription?.unsubscribe(); };
  }, [refreshBids]);

  // ── Watch for status changes on the active bid ─────────────────────────────
  useEffect(() => {
    if (!activeBid) return;
    const current = bids.find(b => b.id === activeBid.id);
    if (!current || current.status === activeBid.status) return;
    if (current.status === "pending") return;
    setActiveBid(current);
    clearInterval(timerRef.current);
    setSideTab("browse"); // ensure the result/counter screen is rendered, not a side panel
    if (current.status === "countered") {
      setCTL(secondsLeft(current));
      setCounterToast(true);
      setTimeout(() => setCounterToast(false), 6000);
      setScreen("counter");
    } else {
      setScreen("result");
    }
  }, [bids]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Countdown driven by expires_at ─────────────────────────────────────────
  useEffect(() => {
    if (screen !== "waiting" && screen !== "counter") return;
    const tick = () => {
      const rem = secondsLeft(activeBid);
      if (screen === "waiting") setTimeLeft(rem); else setCTL(rem);
      if (rem <= 0) {
        clearInterval(timerRef.current);
        setActiveBid(p => p ? { ...p, status:"expired" } : p);
        setScreen("result");
      }
    };
    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => clearInterval(timerRef.current);
  }, [screen, activeBid]);

  // ── Always-on 1s ticker for live-request countdowns ────────────────────────
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);

  async function handleCancel(id) {
    if (!id) return;
    if (typeof window !== "undefined" && !window.confirm("Cancel this rate request? This can't be undone.")) return;
    try {
      await api.cancelRequest(id);
      refreshBids();
    } catch (e) { console.error(e); }
  }

  async function handleBid() {
    if (!currentGuest) { setScreen("login"); return; }
    const amount = Math.round(Number(bidAmount));
    if (!amount || amount < 1) return;
    // Defensive: prevent a second open request at the same hotel.
    if (myLive.some(b => b.hotel?.id === selectedHotel?.id)) {
      alert("You already have an open request at this hotel. Cancel it before submitting a new one.");
      return;
    }
    setSubmitting(true);
    try {
      const bid = await api.submitBid({ hotelId: selectedHotel.id, roomId: selectedRoom.id, guestId: currentGuest.id, amount });
      bid.hotel = { id: selectedHotel.id, name: selectedHotel.name };
      bid.room  = { id: selectedRoom.id, name: selectedRoom.name, type: selectedRoom.type, rack: selectedRoom.rack };
      setActiveBid(bid);
      refreshBids();
      if (bid.status === "declined") { setScreen("result"); }
      else { setTimeLeft(secondsLeft(bid)); setScreen("waiting"); }
      setSideTab("live");
    } catch (e) { console.error(e); alert("Could not submit your request. Please try again."); }
    finally { setSubmitting(false); }
  }

  async function handleAcceptCounter() {
    try { await api.acceptCounter(activeBid.id); } catch (e) { console.error(e); }
    refreshBids();
    setActiveBid(p => ({ ...p, status:"accepted", amount: p.counterAmount }));
    setScreen("result");
  }

  async function handleDeclineCounter() {
    try { await api.declineCounter(activeBid.id); } catch (e) { console.error(e); }
    refreshBids();
    setActiveBid(p => ({ ...p, status:"declined" }));
    setScreen("result");
  }

  async function handleSignOut() {
    await api.signOut();
    setCurrentGuest(null); setBids([]); setScreen("listing"); setSideTab("browse");
  }

  function reset() {
    setScreen("listing"); setSideTab("browse");
    setActiveBid(null); setBidAmount(""); setSelectedRoom(null); setSelectedHotel(null);
  }

  // ── Main content area based on screen ──────────────────────────────────────
  function renderMain() {
    if (screen === "listing") return <HotelListingView hotelsWithRooms={hotels} onSelectHotel={h => { setSelectedHotel(h); setScreen("hotel"); }} />;

    if (screen === "hotel") {
      const fromPrice = Math.min(...selectedHotel.rooms.map(r=>r.rack));
      const galleryThumbs = selectedHotel.rooms.map(r=>r.imageUrl).filter(Boolean).slice(0,4);
      const allAmenities = [...new Set(selectedHotel.rooms.flatMap(r=>r.amenities||[]))];
      // Guest can only have one open request per hotel.
      const pendingHere = myLive.find(b => b.hotel?.id === selectedHotel.id) || null;
      const facts = [
        ["🛏", `${selectedHotel.rooms.length} room type${selectedHotel.rooms.length>1?"s":""}`],
        ["💵", `From $${fromPrice}`],
        ["⏱", "10-min response"],
        ["🌙", "Tonight only"],
      ];
      const safety = ["Daily cleaning","Disinfection & sterilization","Fire extinguishers","Smoke detectors"];
      const reviewCats = ["Cleanliness","Communication","Value for money","Location","Comfort"];
      return (
      <div style={SL.wrapWide}>
        <button style={SL.backBtn} onClick={() => setScreen("listing")}>← All Hotels</button>

        {/* Top titles */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:12, marginBottom:14, flexWrap:"wrap" }}>
          <div>
            <h1 style={{ ...SL.h1, fontSize:26 }}>{selectedHotel.name}</h1>
            <div style={{ fontSize:14, color:SL.sub, marginTop:5 }}>📍 {selectedHotel.location}</div>
            <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:8 }}>
              <StarDisplay rating={selectedHotel.rating} />
              <span style={{ fontSize:13, color:SL.sub }}>{selectedHotel.rating} ({selectedHotel.reviewCount} reviews)</span>
            </div>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <span style={{ ...SL.ghostBtn, opacity:0.6 }}>↗ Share</span>
            <span style={{ ...SL.ghostBtn, opacity:0.6 }}>♡ Save</span>
          </div>
        </div>

        {/* Image gallery */}
        <div style={{ display:"grid", gridTemplateColumns: galleryThumbs.length ? "2fr 1fr 1fr" : "1fr", gridTemplateRows:"170px 170px", gap:8, marginBottom:24, borderRadius:18, overflow:"hidden" }}>
          <div style={{ gridRow:"1 / span 2", gridColumn:"1" }}>
            <img src={selectedHotel.heroImage || HERO_FALLBACK} alt="" style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }} />
          </div>
          {galleryThumbs.map((u,i) => (
            <div key={i} style={{ position:"relative" }}>
              <img src={u} alt="" style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }} />
              {i===galleryThumbs.length-1 && selectedHotel.rooms.length>galleryThumbs.length && (
                <div style={{ position:"absolute", inset:0, background:"rgba(15,23,42,0.5)", color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700, fontSize:13 }}>+{selectedHotel.rooms.length-galleryThumbs.length} More</div>
              )}
            </div>
          ))}
        </div>

        <div style={{ display:"flex", gap:28, alignItems:"flex-start", flexWrap:"wrap" }}>
          {/* Left column */}
          <div style={{ flex:"1 1 460px", minWidth:300 }}>
            {/* Host info */}
            <div style={{ ...SL.panel, padding:16, display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16, flexWrap:"wrap", gap:8 }}>
              <div>
                <div style={{ fontSize:12, color:SL.faint }}>Listed by</div>
                <div style={{ fontWeight:700, fontSize:15 }}>{selectedHotel.name}</div>
              </div>
              <div style={{ textAlign:"right" }}>
                <div style={{ fontSize:12, color:SL.faint }}>Rooms from</div>
                <div style={{ fontWeight:700, fontSize:15, color:SL.price }}>${fromPrice}</div>
              </div>
            </div>

            {/* Quick facts */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(130px,1fr))", gap:10, marginBottom:24 }}>
              {facts.map(([ic,l]) => (
                <div key={l} style={{ ...SL.panel, padding:"12px 14px", display:"flex", alignItems:"center", gap:10 }}>
                  <span style={{ fontSize:18 }}>{ic}</span>
                  <span style={{ fontSize:13, fontWeight:600 }}>{l}</span>
                </div>
              ))}
            </div>

            {/* Rooms */}
            <div style={SL.sectionLabel}>Available Tonight</div>
            {pendingHere && (
              <div style={{ ...SL.panel, padding:"12px 14px", marginBottom:14, background:"#FFFBEB", borderColor:"#FCD34D", display:"flex", justifyContent:"space-between", alignItems:"center", gap:10, flexWrap:"wrap" }}>
                <div style={{ fontSize:13, color:"#92400E" }}>
                  You already have a {effectiveStatus(pendingHere) === "countered" ? "counter offer" : "pending request"} at this hotel — only one at a time.
                </div>
                <button style={{ ...SL.ghostBtn, padding:"7px 12px", fontSize:12 }} onClick={()=>setSideTab("live")}>View Live Requests</button>
              </div>
            )}
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              {selectedHotel.rooms.map(room => {
                const isPendingRoom = pendingHere && pendingHere.room?.id === room.id;
                const blocked = !!pendingHere;
                return (
                <div key={room.id} style={{ ...SL.card, cursor:"default", display:"flex", flexWrap:"wrap", opacity: blocked && !isPendingRoom ? 0.55 : 1 }}>
                  <div style={{ width:200, flexShrink:0 }}>
                    <ImageOrIcon url={room.imageUrl} type={room.image} height={170} radius={0} />
                  </div>
                  <div style={{ flex:1, minWidth:220, padding:"14px 16px", display:"flex", flexDirection:"column" }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:8 }}>
                      <div>
                        <div style={{ fontFamily:"Space Grotesk,sans-serif", fontWeight:700, fontSize:16 }}>{room.name}</div>
                        <div style={{ fontSize:13, color:SL.sub, marginTop:2 }}>{room.type} · {room.sqft} sq ft · Floor {room.floor}</div>
                      </div>
                      {isPendingRoom && <Badge status={effectiveStatus(pendingHere)} />}
                    </div>
                    <div style={{ display:"flex", flexWrap:"wrap", gap:6, margin:"10px 0" }}>{room.amenities.map(a => <span key={a} style={SL.amenityTag}>{a}</span>)}</div>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:"auto", marginBottom:10 }}>
                      <span style={{ fontSize:12, color:SL.faint }}>Rack rate</span>
                      <span style={{ fontSize:14, color:SL.sub, textDecoration:"line-through" }}>${room.rack}</span>
                    </div>
                    {blocked
                      ? <button style={{ ...SL.primaryBtn, background:"#E5E7EB", color:"#9CA3AF", cursor:"not-allowed" }} disabled>
                          {isPendingRoom ? "Request in progress" : "Request locked — 1 per hotel"}
                        </button>
                      : <button style={SL.primaryBtn} onClick={() => { setSelectedRoom(room); setScreen("bid"); }}>Request a Rate →</button>
                    }
                  </div>
                </div>
                );
              })}
            </div>

            {/* Description */}
            <div style={{ marginTop:28 }}>
              <h3 style={{ ...SL.h1, fontSize:18, marginBottom:8 }}>About this stay</h3>
              <p style={{ color:SL.sub, fontSize:14, lineHeight:1.7, margin:0 }}>
                {selectedHotel.tagline ? selectedHotel.tagline + ". " : ""}{selectedHotel.name} releases unsold rooms tonight at guest-named rates in {selectedHotel.city || selectedHotel.location}. Submit a private rate request and the hotel responds within 10 minutes.
              </p>
            </div>

            {/* Offered amenities */}
            <div style={{ marginTop:28 }}>
              <h3 style={{ ...SL.h1, fontSize:18, marginBottom:12 }}>Offered Amenities</h3>
              {allAmenities.length ? (
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(180px,1fr))", gap:10 }}>
                  {allAmenities.map(a => (
                    <div key={a} style={{ display:"flex", alignItems:"center", gap:8, fontSize:14 }}>
                      <span style={{ color:"#059669" }}>✓</span>{a}
                    </div>
                  ))}
                </div>
              ) : <div style={{ color:SL.sub, fontSize:14 }}>Amenities are listed on each room above.</div>}
            </div>

            {/* Safety & hygiene */}
            <div style={{ marginTop:28 }}>
              <h3 style={{ ...SL.h1, fontSize:18, marginBottom:12 }}>Safety &amp; Hygiene</h3>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(200px,1fr))", gap:10 }}>
                {safety.map(s => (
                  <div key={s} style={{ display:"flex", alignItems:"center", gap:8, fontSize:14 }}>
                    <span>🛡️</span>{s}
                  </div>
                ))}
              </div>
            </div>

            {/* Reviews (structure built; populated after stays) */}
            <div style={{ marginTop:28 }}>
              <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
                <h3 style={{ ...SL.h1, fontSize:18, margin:0 }}>Reviews</h3>
                <span style={{ fontFamily:"Space Grotesk,sans-serif", fontWeight:700, fontSize:18, color:SL.amber }}>{selectedHotel.rating > 0 ? selectedHotel.rating.toFixed(1) : "New"}</span>
                <StarDisplay rating={selectedHotel.rating} />
              </div>
              <div style={{ ...SL.panel, padding:18 }}>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(200px,1fr))", gap:"12px 24px", marginBottom:16 }}>
                  {reviewCats.map(cat => (
                    <div key={cat}>
                      <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:SL.sub, marginBottom:4 }}>
                        <span>{cat}</span><span>{selectedHotel.rating > 0 ? selectedHotel.rating.toFixed(1) : "—"}</span>
                      </div>
                      <div style={{ height:6, borderRadius:4, background:"#EEF0F3", overflow:"hidden" }}>
                        <div style={{ width:`${selectedHotel.rating>0 ? (selectedHotel.rating/5)*100 : 0}%`, height:"100%", background:SL.amber }} />
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ borderTop:`1px solid ${SL.line}`, paddingTop:16, textAlign:"center", color:SL.sub, fontSize:14 }}>
                  No guest reviews yet. Reviews appear here after completed stays.
                </div>
              </div>
            </div>
          </div>

          {/* Right: sticky summary */}
          <aside style={{ flex:"0 0 300px", position:"sticky", top:24, alignSelf:"flex-start" }}>
            <div style={{ ...SL.panel, padding:18 }}>
              <div style={{ fontSize:11, color:SL.faint, textTransform:"uppercase", letterSpacing:"0.08em", fontWeight:700 }}>Your stay</div>
              <div style={{ fontFamily:"Space Grotesk,sans-serif", fontWeight:700, fontSize:17, marginTop:6 }}>Tonight</div>
              <div style={{ fontSize:13, color:SL.sub, marginTop:2 }}>{stayWindow(localDateStr())}</div>
              <div style={{ borderTop:`1px solid ${SL.line}`, margin:"14px 0" }} />
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:14, marginBottom:8 }}>
                <span style={{ color:SL.sub }}>Rooms available</span><strong>{selectedHotel.rooms.length}</strong>
              </div>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:14 }}>
                <span style={{ color:SL.sub }}>From</span><strong style={{ color:SL.price }}>${fromPrice}</strong>
              </div>
              <div style={{ marginTop:14, fontSize:12, color:SL.sub, lineHeight:1.6 }}>
                Pick a room and name your nightly rate — the hotel responds within 10 minutes.
              </div>
            </div>
            <div style={{ ...SL.panel, padding:18, marginTop:14 }}>
              <div style={{ fontSize:11, color:SL.faint, textTransform:"uppercase", letterSpacing:"0.08em", fontWeight:700, marginBottom:12 }}>How it works</div>
              {[["1","Name your rate","Offer what you'd pay tonight."],["2","Fast answer","Accept, decline or counter in ~10 min."],["3","Show your code","Give the confirmation code at check-in."]].map(([n,t,d]) => (
                <div key={n} style={{ display:"flex", gap:10, marginBottom:12 }}>
                  <div style={{ width:24, height:24, borderRadius:"50%", background:"#FEF3E2", color:"#B45309", fontWeight:700, fontSize:12, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>{n}</div>
                  <div>
                    <div style={{ fontSize:13, fontWeight:700 }}>{t}</div>
                    <div style={{ fontSize:12, color:SL.sub }}>{d}</div>
                  </div>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </div>
      );
    }

    if (screen === "login") return (
      <div style={{ ...SL.wrap, maxWidth:480 }}>
        <button style={SL.backBtn} onClick={() => setScreen("listing")}>← Back</button>
        <PasswordLogin
          light
          eyebrow="Guest Profile"
          title="Sign in to bid"
          blurb="Sign in or create an account with email and password. Your star rating is visible to hotels when you bid — no other personal info is shared."
          onSignedIn={() => { setScreen(selectedRoom ? "bid" : "listing"); setSideTab("browse"); }}
        />
      </div>
    );

    if (screen === "bid") return (
      <div style={{ ...SL.wrap, maxWidth:560 }}>
        <button style={SL.backBtn} onClick={() => setScreen("hotel")}>← Back</button>
        {currentGuest && <div style={{ marginBottom:14 }}><GuestProfileCard guest={currentGuest} compact light /></div>}
        <div style={{ ...SL.panel, overflow:"hidden", marginBottom:14 }}>
          <ImageOrIcon url={selectedRoom.imageUrl} type={selectedRoom.image} height={190} radius={0} />
          <div style={{ padding:"12px 16px" }}>
            <div style={{ fontFamily:"Space Grotesk,sans-serif", fontWeight:700, fontSize:18 }}>{selectedRoom.name}</div>
            <div style={{ fontSize:13, color:SL.sub, marginTop:2 }}>{selectedRoom.type} · {selectedRoom.sqft} sq ft</div>
          </div>
        </div>
        <div style={{ ...SL.panel, padding:20 }}>
          <div style={{ fontFamily:"Space Grotesk,sans-serif", fontWeight:700, fontSize:18, marginBottom:6 }}>Your Rate Request</div>
          <div style={{ fontSize:13, color:SL.sub, marginBottom:8, lineHeight:1.55 }}>Rack rate is ${selectedRoom.rack}. The hotel will respond within 10 minutes.</div>
          <div style={{ fontSize:12, color:SL.sub, marginBottom:14 }}>📅 Tonight · {stayWindow(localDateStr())}</div>
          <div style={{ display:"flex", alignItems:"baseline", gap:8, borderBottom:"2px solid #F59E0B", paddingBottom:12, marginBottom:18 }}>
            <span style={{ fontFamily:"Space Grotesk,sans-serif", fontSize:26, fontWeight:700, color:"#F59E0B" }}>$</span>
            <input type="number" placeholder="0" value={bidAmount} onChange={e=>setBidAmount(e.target.value)} min="1"
              style={{ flex:1, border:"none", outline:"none", fontFamily:"Space Grotesk,sans-serif", fontSize:42, fontWeight:700, color:"#1A1F2B", width:"100%", background:"transparent" }} />
            <span style={{ fontSize:13, color:SL.sub, whiteSpace:"nowrap" }}>/ night</span>
          </div>
          {!currentGuest && (
            <div style={{ padding:"10px 14px", background:"#FEF3E2", borderRadius:8, fontSize:13, color:"#B45309", marginBottom:14 }}>
              Sign in to submit a bid. Hotels will see your rating — nothing else.
            </div>
          )}
          <div style={{ fontSize:12, color:SL.sub, lineHeight:1.6, marginBottom:16 }}>If accepted, you'll receive a confirmation code to give the hotel at check-in. No payment is taken here — LastKey just delivers your request.</div>
          <button style={{ ...SL.primaryBtn, opacity:!(Number(bidAmount)>=1)?0.4:1 }} disabled={!(Number(bidAmount)>=1)}
            onClick={() => { if (!currentGuest) { setScreen("login"); return; } if (!(Number(bidAmount)>=1)) return; setAgreeTerms(false); setScreen("confirm"); }}>
            {currentGuest ? "Review Request →" : "Sign In to Bid"}
          </button>
        </div>
      </div>
    );

    if (screen === "confirm") {
      const rate = Math.round(Number(bidAmount)) || 0;
      const taxes = Math.round(rate * TAX_RATE);
      const total = rate + taxes;
      return (
        <div style={{ ...SL.wrap, maxWidth:560 }}>
          <button style={SL.backBtn} onClick={() => setScreen("bid")}>← Edit request</button>
          <h1 style={{ ...SL.h1, fontSize:24, marginBottom:4 }}>Review &amp; confirm</h1>
          <p style={{ color:SL.sub, fontSize:14, margin:"0 0 18px" }}>Confirm your rate request. No card is charged — you pay the hotel directly if accepted.</p>

          {/* Selected room summary */}
          <div style={{ ...SL.panel, padding:14, display:"flex", gap:12, alignItems:"center", marginBottom:14 }}>
            <div style={{ width:84, flexShrink:0 }}><ImageOrIcon url={selectedRoom?.imageUrl} type={selectedRoom?.image} height={64} radius={10} /></div>
            <div>
              <div style={{ fontWeight:700, fontSize:15 }}>{selectedRoom?.name}</div>
              <div style={{ fontSize:12, color:SL.sub, marginTop:2 }}>{selectedHotel?.name}</div>
              <div style={{ fontSize:12, color:SL.sub, marginTop:2 }}>📅 {stayWindow(localDateStr())}</div>
            </div>
          </div>

          {/* Price breakdown */}
          <div style={{ ...SL.panel, padding:18, marginBottom:14 }}>
            <div style={{ fontSize:11, color:SL.faint, textTransform:"uppercase", letterSpacing:"0.08em", fontWeight:700, marginBottom:12 }}>Price details</div>
            {[["Your rate (1 night)", `$${rate}`], [`Taxes & fees (est. ${Math.round(TAX_RATE*100)}%)`, `$${taxes}`]].map(([l,v]) => (
              <div key={l} style={{ display:"flex", justifyContent:"space-between", fontSize:14, marginBottom:10, color:SL.sub }}>
                <span>{l}</span><span style={{ color:SL.ink }}>{v}</span>
              </div>
            ))}
            <div style={{ borderTop:`1px solid ${SL.line}`, paddingTop:12, display:"flex", justifyContent:"space-between", alignItems:"baseline" }}>
              <span style={{ fontWeight:700, fontSize:15 }}>Estimated total at hotel</span>
              <span style={{ fontFamily:"Space Grotesk,sans-serif", fontWeight:700, fontSize:22, color:SL.price }}>${total}</span>
            </div>
            <div style={{ fontSize:11, color:SL.faint, marginTop:8 }}>Final amount is set by the hotel if your rate is accepted or countered.</div>
          </div>

          {/* Terms */}
          <label style={{ display:"flex", gap:10, alignItems:"flex-start", fontSize:13, color:SL.sub, marginBottom:16, cursor:"pointer" }}>
            <input type="checkbox" checked={agreeTerms} onChange={e=>setAgreeTerms(e.target.checked)} style={{ marginTop:2 }} />
            <span>I understand this is a private rate request, not a guaranteed booking. If accepted, I'll pay the hotel directly at check-in and agree to LastKey's terms and cancellation policy.</span>
          </label>

          <button style={{ ...SL.primaryBtn, opacity:(!agreeTerms||submitting)?0.4:1 }} disabled={!agreeTerms||submitting} onClick={handleBid}>
            {submitting ? "Submitting…" : "Confirm & Submit Request"}
          </button>
        </div>
      );
    }

    if (screen === "waiting") return (
      <div style={{ ...SL.wrap, maxWidth:560, textAlign:"center", paddingTop:48 }}>
        <div style={{ display:"flex", justifyContent:"center", marginBottom:24 }}><TimerRing seconds={timeLeft} /></div>
        <h2 style={{ ...SL.h1, fontSize:22, marginBottom:10 }}>Request Sent</h2>
        <p style={{ color:SL.sub, maxWidth:320, margin:"0 auto", lineHeight:1.6 }}>
          <strong style={{ color:SL.ink }}>{activeBid?.hotel?.name}</strong> is reviewing your ${activeBid?.amount} request for {activeBid?.room?.name}.
        </p>
        <div style={{ ...SL.panel, padding:"16px 20px", maxWidth:320, margin:"22px auto 0", textAlign:"left" }}>
          {[["Room", activeBid?.room?.name], ["Stay", stayWindow(activeBid?.stayDate || localDateStr())], ["Your bid","$"+activeBid?.amount], ["Ref", activeBid?.id?.slice(0,8)]].map(([l,v]) => (
            <div key={l} style={{ display:"flex", justifyContent:"space-between", gap:12, padding:"6px 0", fontSize:14, borderBottom:`1px solid ${SL.line}` }}>
              <span style={{ color:SL.sub }}>{l}</span>
              <span style={{ color:l==="Your bid"?"#B45309":SL.ink, fontWeight:l==="Your bid"?700:400, fontFamily:l==="Ref"?"monospace":"inherit", fontSize:l==="Ref"?12:14, textAlign:"right" }}>{v}</span>
            </div>
          ))}
        </div>
        <p style={{ color:SL.faint, fontSize:12, marginTop:16 }}>Check the <strong style={{color:SL.sub}}>Live Requests</strong> tab to track status.</p>
      </div>
    );

    if (screen === "counter") {
      const bid = bids.find(b=>b.id===activeBid?.id) || activeBid;
      return (
        <div style={{ ...SL.wrap, maxWidth:560, textAlign:"center", paddingTop:36 }}>
          <div style={{ fontSize:44, marginBottom:12 }}>🤝</div>
          <h2 style={{ ...SL.h1, fontSize:24, marginBottom:8 }}>Counter Offer</h2>
          <p style={{ color:SL.sub, maxWidth:320, margin:"0 auto 20px", lineHeight:1.6 }}>
            {bid?.hotel?.name} can't do ${bid?.amount}, but they're offering a counter rate.
          </p>
          <div style={{ ...SL.panel, border:"2px solid #A78BFA", padding:"24px", maxWidth:320, margin:"0 auto 20px" }}>
            <div style={{ fontSize:12, color:SL.sub, marginBottom:4 }}>Counter rate offered</div>
            <div style={{ fontFamily:"Space Grotesk,sans-serif", fontWeight:700, fontSize:52, color:"#7C3AED", lineHeight:1 }}>${bid?.counterAmount}</div>
            <div style={{ fontSize:12, color:SL.faint, marginTop:6 }}>vs your bid of ${bid?.amount} · rack ${bid?.room?.rack}</div>
            <div style={{ display:"flex", justifyContent:"center", marginTop:18 }}><TimerRing seconds={counterTimeLeft} total={COUNTER_TIMER} size={90} /></div>
            <div style={{ fontSize:12, color:SL.faint, marginTop:8 }}>Respond before time runs out</div>
          </div>
          <div style={{ display:"flex", gap:10, maxWidth:320, margin:"0 auto" }}>
            <button style={{ ...SL.primaryBtn, flex:1, background:"#7C3AED", color:"#fff" }} onClick={handleAcceptCounter}>Accept ${bid?.counterAmount}</button>
            <button style={{ ...SL.primaryBtn, flex:1, background:"#fff", color:"#374151", border:"1px solid #D1D5DB" }} onClick={handleDeclineCounter}>Decline</button>
          </div>
        </div>
      );
    }

    if (screen === "result") {
      const bid = bids.find(b=>b.id===activeBid?.id) || activeBid;
      const status = bid ? effectiveStatus(bid) : activeBid?.status;
      const accepted = status === "accepted" || status === "handled";
      const expired  = status === "expired";
      return (
        <div style={{ ...SL.wrap, maxWidth:560, textAlign:"center", paddingTop:48 }}>
          <div style={{ width:72, height:72, borderRadius:"50%", background:"#F3F4F6", display:"flex", alignItems:"center", justifyContent:"center", fontSize:30, margin:"0 auto" }}>
            {accepted?"✓":expired?"⏱":"✕"}
          </div>
          <h2 style={{ ...SL.h1, fontSize:26, marginTop:18, color:accepted?"#059669":expired?"#6B7280":"#DC2626" }}>
            {accepted?"You're in.":expired?"Time's up.":"Not this time."}
          </h2>
          <p style={{ color:SL.sub, maxWidth:340, margin:"10px auto 0", lineHeight:1.7 }}>
            {accepted
              ? `Your $${bid?.counterAmount ?? bid?.amount} rate for ${bid?.room?.name} was accepted (${stayWindow(bid?.stayDate || localDateStr())}). Show your confirmation code at check-in.`
              : expired ? "The window closed. Try again — rooms may still be available."
              : "The hotel couldn't accept this rate. Try a different amount or room."}
          </p>
          {accepted && bid?.confirmationCode && (
            <div style={{ maxWidth:320, margin:"22px auto 0", background:"#ECFDF5", border:"1px solid #A7F3D0", borderRadius:12, padding:"16px 20px" }}>
              <div style={{ fontSize:11, color:"#059669", letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:6, fontWeight:700 }}>Confirmation Code</div>
              <div style={{ fontFamily:"Space Grotesk,sans-serif", fontWeight:700, fontSize:30, color:"#047857", letterSpacing:"0.15em" }}>{bid.confirmationCode}</div>
            </div>
          )}
          <button style={{ ...SL.ghostBtn, marginTop:24 }} onClick={reset}>Browse Again</button>
        </div>
      );
    }

    // profile tab
    if (sideTab === "profile") return (
      <div style={{ ...SL.wrap, maxWidth:560 }}>
        <h1 style={{ ...SL.h1, marginBottom:18 }}>My Profile</h1>
        {currentGuest
          ? <GuestProfileForm
              guest={currentGuest}
              onSaved={(f)=>setCurrentGuest(g => ({ ...g, ...f, name:[f.firstName,f.lastName].filter(Boolean).join(" ") || g.name }))}
              onSignOut={handleSignOut}
            />
          : <div style={{ ...SL.panel, padding:"40px 28px", textAlign:"center" }}>
              <div style={{ marginBottom:12, fontSize:15, fontWeight:600 }}>Not signed in</div>
              <button style={{ ...SL.primaryBtn, maxWidth:220, margin:"0 auto" }} onClick={()=>setScreen("login")}>Sign In / Join</button>
            </div>
        }
      </div>
    );

    return <HotelListingView hotelsWithRooms={hotels} onSelectHotel={h=>{setSelectedHotel(h);setScreen("hotel");}} />;
  }

  // ── Live requests panel (sidebar tab content) ──────────────────────────────
  function renderSideContent() {
    if (sideTab === "live") return (
      <div style={{ ...SL.wrap, maxWidth:640 }}>
        <h1 style={{ ...SL.h1, marginBottom:18 }}>Live Requests</h1>
        {myLive.length === 0
          ? <div style={{ ...SL.panel, padding:"40px 28px", textAlign:"center", color:SL.sub, fontSize:14 }}>No active requests.<br/>Submit a bid to get started.</div>
          : myLive.map(b => {
            const rem = Math.max(0, Math.round((new Date(b.expiresAt).getTime() - now)/1000));
            const total = b.status === "countered" ? COUNTER_TIMER : TIMER_SECONDS;
            const rate = b.status === "countered" ? b.counterAmount : b.amount;
            const taxes = Math.round(rate * TAX_RATE);
            const estTotal = rate + taxes;
            return (
            <div key={b.id} style={{ ...SL.panel, padding:"16px 18px", marginBottom:12 }}>
              {/* Top row: room info + amount */}
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:12, marginBottom:14 }}>
                <div>
                  <div style={{ fontWeight:700, fontSize:15 }}>{b.room.name}</div>
                  <div style={{ fontSize:12, color:SL.sub, marginTop:2 }}>{b.hotel.name}</div>
                  <div style={{ fontSize:12, color:SL.sub, marginTop:2 }}>{shortDate(b.stayDate)}</div>
                  <div style={{ marginTop:8 }}><Badge status={effectiveStatus(b)} /></div>
                </div>
                <div style={{ textAlign:"right", flexShrink:0 }}>
                  <div style={{ fontFamily:"Space Grotesk,sans-serif", fontWeight:700, fontSize:20, color: b.status==="countered"?"#7C3AED":"#B45309" }}>${rate}</div>
                  <div style={{ fontSize:11, color:SL.faint, marginTop:2, letterSpacing:"0.04em", textTransform:"uppercase" }}>{b.status==="countered" ? "counter" : "your rate"}</div>
                </div>
              </div>

              {/* Timer (centered below info) + rate/taxes breakdown */}
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:10, padding:"6px 0 4px" }}>
                <TimerRing seconds={rem} total={total} size={88} />
                <div style={{ fontSize:12, color:SL.sub, textAlign:"center" }}>
                  Rate: <strong style={{ color:SL.ink }}>${rate}</strong>
                  <span style={{ margin:"0 8px", color:SL.faint }}>·</span>
                  Est. total: <strong style={{ color:SL.ink }}>${estTotal}</strong>
                </div>
              </div>

              {/* Actions */}
              <div style={{ display:"flex", gap:8, marginTop:14 }}>
                {b.status === "countered" && (
                  <button style={{ ...SL.primaryBtn, flex:1, padding:"11px 0", fontSize:13, background:"#7C3AED", color:"#fff" }}
                    onClick={()=>{ setActiveBid(b); setSelectedHotel(b.hotel); setSelectedRoom(b.room); setCTL(secondsLeft(b)); setSideTab("browse"); setScreen("counter"); }}>
                    View Counter Offer →
                  </button>
                )}
                {b.status === "pending" && (
                  <button style={{ ...SL.ghostBtn, flex:1, padding:"11px 0", fontSize:13, color:"#B91C1C", borderColor:"#FCA5A5" }}
                    onClick={()=>handleCancel(b.id)}>
                    Cancel Request
                  </button>
                )}
              </div>
            </div>
            );
          })
        }
      </div>
    );

    if (sideTab === "history") {
      const dayBids = myBids.filter(b => b.stayDate === guestDate);
      return (
        <div style={{ ...SL.wrap, maxWidth:760 }}>
          <h1 style={{ ...SL.h1, marginBottom:18 }}>History</h1>
          <BookingCalendar light bids={myBids} selectedDate={guestDate} onSelect={setGuestDate} />
          <div style={SL.sectionLabel}>{shortDate(guestDate)} · {dayBids.length} request{dayBids.length===1?"":"s"}</div>
          {dayBids.length === 0
            ? <div style={{ ...SL.panel, padding:"36px 24px", textAlign:"center", color:SL.sub, fontSize:14 }}>No requests on this day.</div>
            : <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                {dayBids.map(b => {
                  const st = effectiveStatus(b);
                  return (
                    <div key={b.id} style={{ ...SL.panel, padding:16, display:"flex", gap:14, flexWrap:"wrap", alignItems:"center" }}>
                      <div style={{ flex:1, minWidth:220 }}>
                        <div style={{ fontWeight:700, fontSize:15 }}>{b.room.name}</div>
                        <div style={{ fontSize:12, color:SL.sub, marginTop:2 }}>{b.hotel.name}</div>
                        <div style={{ fontSize:12, color:SL.sub, marginTop:6 }}>Check-in: {shortDate(b.stayDate)} · Checkout 11:00 AM next day</div>
                        {["accepted","handled"].includes(b.status) && b.confirmationCode && (
                          <div style={{ fontSize:12, marginTop:4, color:"#047857" }}>Confirmation: <strong style={{ fontFamily:"monospace" }}>{b.confirmationCode}</strong></div>
                        )}
                      </div>
                      <div style={{ textAlign:"right" }}>
                        <div style={{ fontFamily:"Space Grotesk,sans-serif", fontWeight:700, fontSize:18 }}>${b.counterAmount ?? b.amount}</div>
                        <div style={{ marginTop:6 }}><Badge status={st} /></div>
                        {b.status === "countered" && (
                          <button style={{ ...SL.primaryBtn, marginTop:8, padding:"8px 12px", fontSize:12, background:"#7C3AED", color:"#fff" }}
                            onClick={()=>{ setActiveBid(b); setSelectedHotel(b.hotel); setSelectedRoom(b.room); setCTL(secondsLeft(b)); setSideTab("browse"); setScreen("counter"); }}>
                            View Counter →
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
          }
        </div>
      );
    }

    return null; // browse and profile are rendered in renderMain
  }

  const panelTabs = ["live","history"];
  const showPanel = panelTabs.includes(sideTab);

  return (
    <div style={SL.page}>
      {counterToast && (
        <div style={{ ...SL.toast, borderColor:"#A78BFA" }}>
          <span style={{ ...SL.toastDot, background:"#A78BFA" }} />
          <div>
            <div style={{ fontWeight:700, fontSize:14, color:"#1A1F2B" }}>Counter Offer Received</div>
            <div style={{ fontSize:12, color:"#6B7280", marginTop:2 }}>The hotel sent a counter rate. Check Live Requests.</div>
          </div>
        </div>
      )}

      <div style={{ ...SL.sidebar, width:210 }}>
        <div style={{ marginBottom:24, display:"flex", alignItems:"center", gap:10 }}>
          <div style={SL.logo}>LK</div>
          {currentGuest
            ? <div>
                <div style={{ fontWeight:700, fontSize:13, lineHeight:1.2, color:SL.ink }}>{currentGuest.name}</div>
                <div style={{ fontSize:11, color:SL.faint, marginTop:3 }}>
                  {currentGuest.rating > 0 ? `⭐ ${currentGuest.rating.toFixed(1)}` : "New member"} · {currentGuest.stays} stays
                </div>
              </div>
            : <div>
                <div style={{ fontWeight:700, fontSize:14, color:SL.ink }}>LastKey</div>
                <div style={{ fontSize:11, color:SL.faint, marginTop:2 }}>Private rate requests</div>
              </div>
          }
        </div>

        <div style={{ display:"flex", flexDirection:"column", gap:2, flex:1 }}>
          {[
            { id:"browse",  label:"Browse Hotels" },
            { id:"live",    label:"Live Requests", count: myLive.length },
            { id:"history", label:"History",       count: myHistory.length },
            { id:"profile", label: currentGuest ? "My Profile" : "Sign In" },
          ].map(tab => (
            <button key={tab.id}
              style={{ ...SL.navItem, ...(sideTab===tab.id ? SL.navActive : {}) }}
              onClick={() => { setSideTab(tab.id); if (!panelTabs.includes(tab.id)) setScreen(tab.id === "browse" ? "listing" : tab.id); }}>
              {tab.label}
              {tab.count > 0 && <span style={SL.navBadge}>{tab.count}</span>}
            </button>
          ))}
        </div>

        {!currentGuest && (
          <button style={{ ...SL.primaryBtn, marginTop:12, fontSize:13, padding:"11px 12px" }} onClick={()=>{ setSideTab("browse"); setScreen("login"); }}>
            Sign In / Join
          </button>
        )}
      </div>

      <div style={{ ...SL.content, padding: 0 }}>
        {showPanel ? renderSideContent() : renderMain()}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BOOKING CALENDAR (hotel history)
// ─────────────────────────────────────────────────────────────────────────────
const STATUS_COLOR = { pending:"#F59E0B", countered:"#A78BFA", accepted:"#22C55E", handled:"#22C55E", declined:"#EF4444", expired:"#64748B" };

function BookingCalendar({ bids, selectedDate, onSelect, light = false }) {
  const C = light
    ? { box:"#fff", border:"#E5E7EB", cell:"#F9FAFB", cellSel:"#FEF3E2", selBorder:"#F59E0B", wd:"#9CA3AF", num:"#6B7280", numSel:"#1A1F2B", count:"#1A1F2B", legend:"#6B7280", btn:SL.ghostBtn }
    : { box:"#0F172A", border:"#1E293B", cell:"#0A0F1E", cellSel:"#1E293B", selBorder:"#F59E0B", wd:"#475569", num:"#94A3B8", numSel:"#F7F5F0", count:"#F7F5F0", legend:"#64748B", btn:{ ...S.ghostBtn, padding:"6px 12px" } };
  const [view, setView] = useState(() => {
    const d = parseDate(selectedDate) || new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const byDate = {};
  bids.forEach(b => { if (b.stayDate) (byDate[b.stayDate] = byDate[b.stayDate] || []).push(b); });

  const year = view.getFullYear(), month = view.getMonth();
  const startDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  const ymd = (d) => localDateStr(new Date(year, month, d));
  const monthLabel = view.toLocaleDateString(undefined, { month:"long", year:"numeric" });

  return (
    <div style={{ background:C.box, border:`1px solid ${C.border}`, borderRadius:14, padding:"16px 18px", marginBottom:18 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
        <button style={{ ...C.btn, padding:"6px 12px" }} onClick={()=>setView(new Date(year, month-1, 1))}>←</button>
        <div style={{ fontFamily:"Space Grotesk,sans-serif", fontWeight:700, fontSize:16 }}>{monthLabel}</div>
        <button style={{ ...C.btn, padding:"6px 12px" }} onClick={()=>setView(new Date(year, month+1, 1))}>→</button>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:6 }}>
        {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d,i)=>(
          <div key={i} style={{ textAlign:"center", fontSize:10, color:C.wd, fontWeight:600, letterSpacing:"0.05em" }}>{d}</div>
        ))}
        {cells.map((d,i) => {
          if (d == null) return <div key={"e"+i} />;
          const key = ymd(d);
          const dayBids = byDate[key] || [];
          const sel = key === selectedDate;
          const statuses = [...new Set(dayBids.map(b => effectiveStatus(b)))];
          return (
            <button key={key} onClick={()=>onSelect(key)}
              style={{ minHeight:62, borderRadius:8, border: sel?`1px solid ${C.selBorder}`:`1px solid ${C.border}`,
                background: sel?C.cellSel:C.cell, cursor:"pointer", padding:6, textAlign:"left",
                display:"flex", flexDirection:"column", gap:4 }}>
              <span style={{ fontSize:12, color: sel?C.numSel:C.num }}>{d}</span>
              {dayBids.length > 0 && (
                <>
                  <span style={{ fontFamily:"Space Grotesk,sans-serif", fontWeight:700, fontSize:13, color:C.count }}>{dayBids.length}</span>
                  <span style={{ display:"flex", gap:3, flexWrap:"wrap" }}>
                    {statuses.slice(0,5).map(s => (
                      <span key={s} style={{ width:6, height:6, borderRadius:"50%", background:STATUS_COLOR[s]||"#64748B" }} />
                    ))}
                  </span>
                </>
              )}
            </button>
          );
        })}
      </div>
      <div style={{ display:"flex", gap:14, marginTop:12, flexWrap:"wrap" }}>
        {Object.entries({ Pending:"pending", Countered:"countered", Accepted:"accepted", Declined:"declined", Expired:"expired" }).map(([label,s])=>(
          <span key={s} style={{ display:"flex", alignItems:"center", gap:5, fontSize:11, color:C.legend }}>
            <span style={{ width:7, height:7, borderRadius:"50%", background:STATUS_COLOR[s] }} />{label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// KPI PANEL
// ─────────────────────────────────────────────────────────────────────────────
function KPIPanel({ bids, totalRooms = 0, dateLabel }) {
  const accepted = bids.filter(b => ["accepted","handled"].includes(b.status));
  const declined = bids.filter(b => b.status === "declined");
  const expired  = bids.filter(b => b.status === "expired");
  const total    = bids.length;

  const amt = (b) => b.counterAmount ?? b.amount;
  const revenue       = accepted.reduce((s,b) => s+amt(b), 0);
  const potentialRack = accepted.reduce((s,b) => s+b.room.rack, 0);
  const avgBid        = total > 0 ? Math.round(bids.reduce((s,b)=>s+b.amount,0)/total) : 0;
  const avgAccepted   = accepted.length > 0 ? Math.round(revenue/accepted.length) : 0;
  const acceptRate    = total > 0 ? Math.round((accepted.length/total)*100) : 0;
  const discountVsRack= potentialRack > 0 ? Math.round(((potentialRack-revenue)/potentialRack)*100) : 0;
  const avgBidToRack  = accepted.length > 0 ? Math.round((accepted.reduce((s,b)=>s+(amt(b)/b.room.rack),0)/accepted.length)*100) : 0;
  const countered     = bids.filter(b=>b.status==="countered");

  const kpis = [
    { label:"Revenue Recovered",  value:revenue?`$${revenue}`:"$0",        sub:"vs $0 empty rooms",            color:"#15803D" },
    { label:"Accept Rate",        value:`${acceptRate}%`,                   sub:`${accepted.length} of ${total} bids`, color:"#B45309" },
    { label:"Avg Accepted Bid",   value:avgAccepted?`$${avgAccepted}`:"—",  sub:`Avg all bids $${avgBid}`,      color:"#1A1F2B" },
    { label:"Bid-to-Rack Ratio",  value:`${avgBidToRack}%`,                 sub:"of rack rate captured",        color:"#7C3AED" },
    { label:"Discount vs Rack",   value:`${discountVsRack}%`,               sub:"below rack on accepted bids",  color:"#6B7280" },
    { label:"Counter Offers Sent",value:countered.length,                   sub:"awaiting guest response",      color:"#B45309" },
    { label:"Total Requests",     value:total,                              sub:`${declined.length} declined · ${expired.length} expired`, color:"#1A1F2B" },
    { label:"Rooms Still Empty",  value:Math.max(0,totalRooms-accepted.length), sub:`out of ${totalRooms} available tonight`, color:totalRooms>0&&accepted.length>=totalRooms?"#15803D":"#DC2626" },
  ];

  return (
    <div>
      {total === 0 && (
        <div style={{ ...SL.emptyState, marginBottom:20 }}>
          <div style={{ color:"#6B7280", fontSize:13 }}>No requests on {dateLabel || "this day"}.</div>
        </div>
      )}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(195px, 1fr))", gap:12, marginBottom:28 }}>
        {kpis.map(k => (
          <div key={k.label} style={{ ...SL.panel, padding:"16px 18px" }}>
            <div style={{ fontSize:11, color:"#9CA3AF", letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:7, fontWeight:600 }}>{k.label}</div>
            <div style={{ fontFamily:"Space Grotesk,sans-serif", fontWeight:700, fontSize:26, color:k.color, lineHeight:1 }}>{k.value}</div>
            <div style={{ fontSize:12, color:"#6B7280", marginTop:6 }}>{k.sub}</div>
          </div>
        ))}
      </div>
      {total > 0 && (
        <div style={{ ...SL.panel, padding:"18px 20px" }}>
          <div style={{ fontSize:12, color:"#9CA3AF", marginBottom:14, textTransform:"uppercase", letterSpacing:"0.08em", fontWeight:600 }}>Bid Distribution</div>
          {bids.slice().reverse().map(b => (
            <div key={b.id} style={{ display:"flex", alignItems:"center", gap:12, marginBottom:8 }}>
              <div style={{ width:72, fontSize:12, color:"#9CA3AF", flexShrink:0 }}>{b.room.name.split(" ")[0]}</div>
              <div style={{ flex:1, background:"#E5E7EB", borderRadius:4, height:8, overflow:"hidden" }}>
                <div style={{ width:`${Math.min(100,(amt(b)/b.room.rack)*100)}%`, height:"100%", borderRadius:4,
                  background:["accepted","handled"].includes(b.status)?"#16A34A":b.status==="countered"?"#7C3AED":b.status==="pending"?"#F59E0B":"#EF4444" }} />
              </div>
              <div style={{ width:36, fontSize:12, fontWeight:700, color:"#1A1F2B", textAlign:"right" }}>${amt(b)}</div>
              <div style={{ width:60, flexShrink:0 }}><Badge status={b.status} /></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HOTEL DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────
function HotelDashboard() {
  const [session, setSession]           = useState(undefined); // undefined = loading
  const [hotel, setHotel]               = useState(null);
  const [rooms, setRooms]               = useState([]);
  const [bids, setBids]                 = useState([]);
  const [activeTab, setActiveTab]       = useState("live");
  const [now, setNow]                   = useState(Date.now());
  const [floorInputs, setFloorInputs]   = useState({});
  const [rackInputs, setRackInputs]     = useState({});
  const [counterInputs, setCounterInputs] = useState({});
  const [notification, setNotification] = useState(null);
  const [expandedGuest, setExpandedGuest] = useState(null);
  const [selectedDate, setSelectedDate] = useState(localDateStr());
  const [showAdd, setShowAdd]           = useState(false);
  const [newRoom, setNewRoom]           = useState({ name:"", room_type:"", rack_rate:"", bid_floor:"", inventory_count:"1", amenities:"" });
  const prevCount = useRef(null); // null until first bids load — avoids a false toast on mount

  const refreshBids = useCallback(async (h) => {
    const hot = h || hotel;
    if (!hot) return;
    try { setBids(await api.getHotelRequests(hot.id)); } catch (e) { console.error(e); }
  }, [hotel]);

  const reloadRooms = useCallback(async () => {
    try { setRooms(await api.getOwnerRooms()); } catch (e) { console.error(e); }
  }, []);

  // ── Session + load owner's hotel/rooms/requests + realtime ─────────────────
  useEffect(() => {
    let unsub = null;
    async function boot(s) {
      setSession(s || null);
      if (!s) { setHotel(null); setRooms([]); setBids([]); return; }
      try {
        const h = await api.getOwnerHotel(s.user.id);
        setHotel(h);
        if (!h) return;
        const rms = await api.getOwnerRooms();
        setRooms(rms);
        setFloorInputs(rms.reduce((a,r)=>({ ...a, [r.id]: r.floor_price ?? "" }), {}));
        refreshBids(h);
        if (unsub) unsub();
        unsub = api.subscribeRequests("hotel_id", h.id, () => { refreshBids(h); reloadRooms(); });
      } catch (e) { console.error(e); }
    }
    api.getSession().then(boot);
    const { data: sub } = api.onAuthChange(boot);
    return () => { if (unsub) unsub(); sub?.subscription?.unsubscribe(); };
  }, [refreshBids, reloadRooms]);

  // ── 1s ticker to recompute live timers from expires_at ─────────────────────
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);

  // ── New-request toast ──────────────────────────────────────────────────────
  useEffect(() => {
    const pendings = bids.filter(b => b.status === "pending").length;
    // Only toast on a genuine increase, never on the first load (baseline).
    if (prevCount.current !== null && pendings > prevCount.current) {
      setNotification(bids[0]);
      setTimeout(() => setNotification(null), 5000);
    }
    prevCount.current = pendings;
  }, [bids]);

  async function onDecide(id, status) {
    try { await api.hotelDecide(id, status); refreshBids(); if (status === "accepted") reloadRooms(); }
    catch (e) { console.error(e); alert("Action failed."); }
  }
  async function onCounter(id, amount) {
    try { await api.hotelCounter(id, amount); refreshBids(); } catch (e) { console.error(e); alert("Counter failed."); }
  }
  async function onSetFloor(roomId) {
    const v = parseInt(floorInputs[roomId]);
    if (Number.isNaN(v)) return;
    try {
      await api.setBidFloor(roomId, v);
      setRooms(prev => prev.map(r => r.id===roomId ? { ...r, floor_price:v } : r));
    } catch (e) { console.error(e); alert("Could not update bid floor."); }
  }
  async function onInventory(roomId, delta) {
    const room = rooms.find(r => r.id === roomId);
    const next = Math.max(0, (room?.inventoryCount ?? 0) + delta);
    setRooms(prev => prev.map(r => r.id===roomId ? { ...r, inventoryCount:next, available:next>0 } : r));
    try { await api.setInventory(roomId, next); } catch (e) { console.error(e); alert("Could not update inventory."); reloadRooms(); }
  }
  async function onSaveRack(roomId) {
    const v = parseFloat(rackInputs[roomId]);
    if (Number.isNaN(v)) return;
    try {
      await api.updateRoom(roomId, { rack_rate: v });
      setRooms(prev => prev.map(r => r.id===roomId ? { ...r, rack:v } : r));
      setRackInputs(p => { const n = { ...p }; delete n[roomId]; return n; });
    } catch (e) { console.error(e); alert("Could not update rack rate."); }
  }
  async function onRemoveRoom(roomId) {
    if (!window.confirm("Remove this room type? It will be hidden from guests. Past bookings are kept.")) return;
    try { await api.removeRoom(roomId); reloadRooms(); } catch (e) { console.error(e); alert("Could not remove room."); }
  }
  async function onAddRoom() {
    const rack = parseFloat(newRoom.rack_rate);
    const floor = parseFloat(newRoom.bid_floor);
    const inv = parseInt(newRoom.inventory_count);
    if (!newRoom.name || !newRoom.room_type || Number.isNaN(rack) || Number.isNaN(floor)) {
      alert("Name, room type, rack rate and bid floor are required."); return;
    }
    try {
      await api.addRoom(hotel.id, {
        name: newRoom.name, room_type: newRoom.room_type, rack_rate: rack, bid_floor: floor,
        inventory_count: Number.isNaN(inv) ? 1 : inv,
        amenities: newRoom.amenities.split(",").map(s => s.trim()).filter(Boolean),
      });
      setNewRoom({ name:"", room_type:"", rack_rate:"", bid_floor:"", inventory_count:"1", amenities:"" });
      setShowAdd(false);
      reloadRooms();
    } catch (e) { console.error(e); alert("Could not add room."); }
  }
  async function onSignOut() { await api.signOut(); }

  const dayBids = bids.filter(b => b.stayDate === selectedDate);

  const liveBids = bids.filter(b => effectiveStatus(b) === "pending");
  const histBids = bids.filter(b => effectiveStatus(b) !== "pending");
  const accepted = bids.filter(b => ["accepted","handled"].includes(b.status));

  // ── Auth gate ──────────────────────────────────────────────────────────────
  if (session === undefined) {
    return <div style={{ ...SL.dashWrap, alignItems:"center", justifyContent:"center", color:"#6B7280" }}>Loading…</div>;
  }
  if (!session || !hotel) {
    return (
      <div style={{ ...SL.dashWrap, alignItems:"center", justifyContent:"center" }}>
        <div style={{ width:380, maxWidth:"90%" }}>
          <div style={{ display:"flex", justifyContent:"center", marginBottom:18 }}><div style={SL.logo}>LK</div></div>
          {session && !hotel ? (
            <div style={SL.emptyState}>
              <div style={{ fontWeight:700, marginBottom:8, color:"#1A1F2B" }}>No hotel linked to this account</div>
              <div style={{ color:"#6B7280", fontSize:13, marginBottom:16 }}>This login isn&apos;t tied to a property yet. An admin must set <code>hotels.owner_user_id</code> to your user id.</div>
              <button style={SL.ghostBtn} onClick={onSignOut}>Sign Out</button>
            </div>
          ) : (
            <PasswordLogin
              eyebrow="Hotel Dashboard"
              title="Hotel sign in"
              blurb="Sign in with your property's email and password. You'll see live rate requests for your hotel only."
              onSignedIn={() => {}}
              light
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={SL.dashWrap}>
      {notification && (
        <div style={SL.toast}>
          <span style={SL.toastDot} />
          <div>
            <div style={{ fontWeight:700, fontSize:14, color:"#1A1F2B" }}>New Rate Request</div>
            <div style={{ fontSize:12, color:"#6B7280", marginTop:2 }}>
              ${notification.amount} on {notification.room?.name} — {notification.guest?.name} (⭐ {notification.guest?.rating||"New"})
            </div>
          </div>
        </div>
      )}

      <div style={SL.sidebar}>
        <div style={SL.sidebarTop}>
          <div style={SL.logo}>LK</div>
          <div style={{ marginTop:10 }}>
            <div style={{ fontWeight:700, fontSize:13, color:"#1A1F2B" }}>{hotel.name}</div>
            <div style={{ fontSize:11, color:"#9CA3AF", marginTop:2 }}>Hotel Dashboard</div>
          </div>
        </div>
        <div style={SL.sidebarNav}>
          {[
            { id:"live",    label:"Live Requests", count:liveBids.length },
            { id:"history", label:"Reservations",  count:histBids.length },
            { id:"kpi",     label:"KPIs & Analytics" },
            { id:"guests",  label:"Guest Profiles" },
            { id:"rooms",   label:"Room Settings" },
          ].map(tab => (
            <button key={tab.id} style={{ ...SL.navItem, ...(activeTab===tab.id?SL.navActive:{}) }} onClick={()=>setActiveTab(tab.id)}>
              {tab.label}
              {tab.count > 0 && <span style={SL.navBadge}>{tab.count}</span>}
            </button>
          ))}
        </div>
        <div style={{ borderTop:"1px solid #E5E7EB", paddingTop:16, marginTop:"auto" }}>
          <div style={{ fontSize:11, color:"#9CA3AF", marginBottom:8, textTransform:"uppercase", letterSpacing:"0.06em", fontWeight:700 }}>Tonight</div>
          <div style={{ display:"flex", gap:14 }}>
            <div>
              <div style={{ fontFamily:"Space Grotesk,sans-serif", fontWeight:700, fontSize:20, color:"#B45309" }}>{accepted.length}</div>
              <div style={{ fontSize:10, color:"#9CA3AF" }}>Accepted</div>
            </div>
            <div>
              <div style={{ fontFamily:"Space Grotesk,sans-serif", fontWeight:700, fontSize:20, color:"#15803D" }}>${accepted.reduce((s,b)=>s+(b.counterAmount??b.amount),0)}</div>
              <div style={{ fontSize:10, color:"#9CA3AF" }}>Revenue</div>
            </div>
          </div>
          <button style={{ ...SL.ghostBtn, marginTop:14, fontSize:12, width:"100%", textAlign:"center" }} onClick={onSignOut}>Sign Out</button>
        </div>
      </div>

      <div style={SL.dashMain}>

        {activeTab === "live" && (
          <div>
            <div style={SL.dashSectionHead}>
              <h2 style={SL.dashTitle}>Live Requests</h2>
              <span style={{ color:"#6B7280", fontSize:14 }}>Accept, decline, or send a counter offer. Bids below your floor auto-decline before they reach you.</span>
            </div>
            {liveBids.length === 0
              ? <div style={SL.emptyState}>
                  <div style={{ fontSize:34, marginBottom:12 }}>⏳</div>
                  <div style={{ fontWeight:700, marginBottom:6, color:"#1A1F2B" }}>No active requests</div>
                  <div style={{ color:"#6B7280", fontSize:13 }}>Bids from guests appear here in real time.</div>
                </div>
              : liveBids.map(bid => {
                  const t = Math.max(0, Math.round((new Date(bid.expiresAt).getTime() - now)/1000));
                  const room = rooms.find(r => r.id === bid.room.id);
                  const floor = room?.floor_price;
                  const aboveFloor = floor == null ? true : bid.amount >= floor;
                  const cv = counterInputs[bid.id] || "";
                  return (
                    <div key={bid.id} style={{ ...SL.bidCard, borderColor:aboveFloor?"#86EFAC":"#FCA5A5", marginBottom:16 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:14 }}>
                        <div>
                          <div style={SL.bidRoom}>{bid.room.name} <span style={{ color:"#9CA3AF", fontWeight:400, fontSize:14 }}>· {bid.room.type}</span></div>
                          <div style={{ fontSize:12, color:"#9CA3AF", marginTop:2 }}>Ref: {bid.id.slice(0,8)}</div>
                          <div style={{ display:"flex", gap:8, alignItems:"center", marginTop:8, flexWrap:"wrap" }}>
                            <Badge status="pending" />
                            {floor != null && (aboveFloor
                              ? <span style={{ fontSize:12, color:"#15803D", fontWeight:600 }}>✓ Above floor (${floor})</span>
                              : <span style={{ fontSize:12, color:"#B91C1C", fontWeight:600 }}>✕ Below floor (${floor})</span>)}
                          </div>
                        </div>
                        <div style={{ textAlign:"right" }}>
                          <div style={{ fontFamily:"Space Grotesk,sans-serif", fontWeight:700, fontSize:30, color:"#B45309" }}>${bid.amount}</div>
                          <div style={{ fontSize:12, color:"#9CA3AF" }}>Rack: ${bid.room.rack}</div>
                        </div>
                      </div>

                      {bid.guest && (
                        <div style={{ marginBottom:14 }}>
                          <button style={{ ...SL.ghostBtn, fontSize:12, padding:"5px 12px", marginBottom:8 }}
                            onClick={()=>setExpandedGuest(expandedGuest===bid.id?null:bid.id)}>
                            {expandedGuest===bid.id?"Hide":"View"} Guest Profile
                          </button>
                          {expandedGuest===bid.id && <GuestProfileCard guest={bid.guest} compact light />}
                        </div>
                      )}

                      <div style={{ display:"flex", alignItems:"center", gap:16, paddingTop:14, borderTop:"1px solid #E5E7EB", flexWrap:"wrap" }}>
                        <TimerRing seconds={t} size={80} />
                        <div style={{ flex:1, display:"flex", flexDirection:"column", gap:10, minWidth:200 }}>
                          <div style={{ display:"flex", gap:10 }}>
                            <button style={{ ...SL.decideBtn, background:"#16A34A", color:"#fff", flex:1 }} onClick={()=>onDecide(bid.id,"accepted")}>Accept ${bid.amount}</button>
                            <button style={{ ...SL.decideBtn, background:"#F3F4F6", color:"#374151", border:"1px solid #D1D5DB", flex:1 }} onClick={()=>onDecide(bid.id,"declined")}>Decline</button>
                          </div>
                          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                            <span style={{ fontSize:12, color:"#6B7280", flexShrink:0, fontWeight:600 }}>Counter at</span>
                            <div style={{ display:"flex", alignItems:"center", background:"#fff", border:"1px solid #D1D5DB", borderRadius:8, padding:"0 10px", flex:1 }}>
                              <span style={{ color:"#9CA3AF" }}>$</span>
                              <input type="number" placeholder="amount" value={cv}
                                onChange={e=>setCounterInputs(p=>({...p,[bid.id]:e.target.value}))}
                                style={{ background:"none", border:"none", outline:"none", color:"#1A1F2B", fontSize:15, fontWeight:700, fontFamily:"Space Grotesk,sans-serif", width:"100%", padding:"8px 6px" }} />
                            </div>
                            <button style={{ ...SL.decideBtn, background:"#7C3AED", color:"#fff", padding:"10px 14px", flexShrink:0, opacity:!(Number(cv)>0)?0.4:1 }}
                              disabled={!(Number(cv)>0)}
                              onClick={()=>{ const amt = Math.round(Number(cv)); if (!amt || amt<=0) return; onCounter(bid.id, amt); setCounterInputs(p=>({...p,[bid.id]:""})); }}>
                              Send Counter
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
            }
          </div>
        )}

        {activeTab === "history" && (
          <div>
            <div style={SL.dashSectionHead}>
              <h2 style={SL.dashTitle}>Reservations</h2>
              <span style={{ color:"#6B7280", fontSize:14 }}>Tap a day to see its requests. The selected day also drives KPIs.</span>
            </div>
            <BookingCalendar light bids={bids} selectedDate={selectedDate} onSelect={setSelectedDate} />
            <div style={SL.sectionLabel}>{shortDate(selectedDate)} · {dayBids.length} request{dayBids.length===1?"":"s"}</div>
            {dayBids.length === 0
              ? <div style={SL.emptyState}><div style={{ color:"#6B7280", fontSize:13 }}>No requests on this day.</div></div>
              : <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                  {dayBids.map(b => {
                    const st = effectiveStatus(b);
                    const amount = b.counterAmount ?? b.amount;
                    return (
                      <div key={b.id} style={{ ...SL.panel, padding:16, display:"flex", gap:14, flexWrap:"wrap", alignItems:"center" }}>
                        <div style={{ flex:1, minWidth:220 }}>
                          <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                            <span style={{ fontWeight:700, fontSize:15, color:"#1A1F2B" }}>{b.guest?.name || "Guest"}</span>
                            <span style={{ fontSize:12, color:"#9CA3AF" }}>{b.guest?.rating ? `${b.guest.rating} ★ · ${b.guest.stays} stays` : "New guest"}</span>
                          </div>
                          <div style={{ fontSize:13, color:"#6B7280", marginTop:4 }}>{b.room.name} <span style={{ color:"#9CA3AF" }}>· Rack ${b.room.rack}</span></div>
                          <div style={{ fontSize:12, color:"#9CA3AF", marginTop:4 }}>Check-in: {shortDate(b.stayDate)} · Ref {b.id.slice(0,8)}</div>
                          {["accepted","handled"].includes(b.status) && b.confirmationCode && (
                            <div style={{ fontSize:12, marginTop:4, color:"#047857" }}>Confirmation: <strong style={{ fontFamily:"monospace" }}>{b.confirmationCode}</strong></div>
                          )}
                        </div>
                        <div style={{ textAlign:"right" }}>
                          <div style={{ fontFamily:"Space Grotesk,sans-serif", fontWeight:700, fontSize:20, color: ["accepted","handled"].includes(b.status) ? "#15803D" : "#1A1F2B" }}>${amount}</div>
                          <div style={{ marginTop:6 }}><Badge status={st} /></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
            }
          </div>
        )}

        {activeTab === "kpi" && (
          <div>
            <div style={{ ...SL.dashSectionHead, display:"flex", justifyContent:"space-between", alignItems:"flex-end", flexWrap:"wrap", gap:12 }}>
              <div>
                <h2 style={SL.dashTitle}>KPIs &amp; Analytics</h2>
                <span style={{ color:"#6B7280", fontSize:14 }}>Figures for the selected day.</span>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <span style={{ fontSize:12, color:"#6B7280", fontWeight:600 }}>Date</span>
                <input type="date" value={selectedDate} onChange={e=>setSelectedDate(e.target.value)}
                  style={{ ...SL.field, width:"auto", padding:"8px 10px" }} />
              </div>
            </div>
            <KPIPanel bids={dayBids} totalRooms={rooms.length} dateLabel={shortDate(selectedDate)} />
          </div>
        )}

        {activeTab === "guests" && (
          <div>
            <div style={SL.dashSectionHead}>
              <h2 style={SL.dashTitle}>Guest Profiles</h2>
              <span style={{ color:"#6B7280", fontSize:14 }}>Ratings only — no names or demographics. Protects against discrimination claims.</span>
            </div>
            <div style={{ ...SL.panel, padding:"16px 20px", marginBottom:18 }}>
              <div style={{ fontSize:13, color:"#6B7280", lineHeight:1.7 }}>
                <strong style={{ color:"#1A1F2B" }}>How this works:</strong> Every guest builds a rating across all LastKey stays. When a bid arrives you see their star rating and stay count — nothing else. No name, no demographics, no photo. Bad actors get filtered by behavior, not appearance.
              </div>
            </div>
            {[...new Map(bids.filter(b=>b.guest).map(b=>[b.guest.email, b.guest])).values()].map(guest => (
              <div key={guest.email} style={{ ...SL.panel, padding:"16px 18px", marginBottom:10 }}>
                <div style={{ display:"flex", alignItems:"center", gap:14 }}>
                  <div style={{ width:46, height:46, borderRadius:"50%", background:"#FEF3E2", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"Space Grotesk,sans-serif", fontWeight:700, fontSize:17, color:"#B45309" }}>
                    {(guest.name||"?").split(" ").map(n=>n[0]).join("")}
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                      <span style={{ fontWeight:700, color:"#1A1F2B" }}>{guest.name}</span>
                      {guest.verified && <span style={{ fontSize:10, background:"#D1FAE5", color:"#047857", padding:"2px 6px", borderRadius:4, fontWeight:700 }}>✓ Verified</span>}
                    </div>
                    <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:4 }}>
                      <StarDisplay rating={guest.rating} />
                      <span style={{ fontSize:12, color:"#6B7280" }}>{guest.rating>0?guest.rating.toFixed(1):"No rating"} · {guest.stays} stays</span>
                    </div>
                  </div>
                  <div style={{ fontSize:12, color:"#9CA3AF", textAlign:"right" }}>
                    {bids.filter(b=>b.guest?.email===guest.email).length} bid(s)
                  </div>
                </div>
              </div>
            ))}
            {bids.filter(b=>b.guest).length===0 && <div style={SL.emptyState}><div style={{ color:"#6B7280", fontSize:13 }}>Guest profiles appear when bids are submitted.</div></div>}
          </div>
        )}

        {activeTab === "rooms" && (
          <div>
            <div style={{ ...SL.dashSectionHead, display:"flex", justifyContent:"space-between", alignItems:"flex-end", flexWrap:"wrap", gap:12 }}>
              <div>
                <h2 style={SL.dashTitle}>Room Settings</h2>
                <span style={{ color:"#6B7280", fontSize:14 }}>Manage inventory, rack rate, bid floor, and room types. Floors are never shown to guests.</span>
              </div>
              <button style={{ ...SL.submitBtn, width:"auto", padding:"10px 16px" }} onClick={()=>setShowAdd(s=>!s)}>
                {showAdd ? "Close" : "+ Add Room Type"}
              </button>
            </div>

            {showAdd && (
              <div style={{ ...SL.formCard, marginBottom:16 }}>
                <div style={SL.formTitle}>New Room Type</div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(160px, 1fr))", gap:10, marginTop:10 }}>
                  <input style={SL.field} placeholder="Name (e.g. King Room)" value={newRoom.name} onChange={e=>setNewRoom(p=>({...p,name:e.target.value}))} />
                  <input style={SL.field} placeholder="Type (e.g. King · Standard)" value={newRoom.room_type} onChange={e=>setNewRoom(p=>({...p,room_type:e.target.value}))} />
                  <input style={SL.field} type="number" placeholder="Rack rate $" value={newRoom.rack_rate} onChange={e=>setNewRoom(p=>({...p,rack_rate:e.target.value}))} />
                  <input style={SL.field} type="number" placeholder="Bid floor $" value={newRoom.bid_floor} onChange={e=>setNewRoom(p=>({...p,bid_floor:e.target.value}))} />
                  <input style={SL.field} type="number" placeholder="Inventory count" value={newRoom.inventory_count} onChange={e=>setNewRoom(p=>({...p,inventory_count:e.target.value}))} />
                  <input style={SL.field} placeholder="Amenities (comma separated)" value={newRoom.amenities} onChange={e=>setNewRoom(p=>({...p,amenities:e.target.value}))} />
                </div>
                <button style={{ ...SL.submitBtn, marginTop:14 }} onClick={onAddRoom}>Create Room Type</button>
              </div>
            )}

            {rooms.length === 0 && <div style={SL.emptyState}><div style={{ color:"#6B7280", fontSize:13 }}>No room types yet. Add one above.</div></div>}

            {rooms.map(room => (
              <div key={room.id} style={SL.roomSetCard}>
                <div style={{ width:120, flexShrink:0 }}><ImageOrIcon url={room.imageUrl} type={room.image} height={84} /></div>
                <div style={{ flex:1, minWidth:160 }}>
                  <div style={{ fontWeight:700, fontSize:16, color:"#1A1F2B" }}>{room.name}</div>
                  <div style={{ fontSize:13, color:"#9CA3AF", marginTop:2 }}>{room.type}</div>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginTop:8, marginBottom:8 }}>{room.amenities.map(a=><span key={a} style={SL.amenityTag}>{a}</span>)}</div>
                  <button style={{ ...SL.ghostBtn, fontSize:12, padding:"5px 10px", marginTop:4, color:"#B91C1C", borderColor:"#FCA5A5" }} onClick={()=>onRemoveRoom(room.id)}>Remove</button>
                </div>

                {/* Inventory */}
                <div style={{ minWidth:120, textAlign:"center" }}>
                  <div style={SL.settingLabel}>Inventory</div>
                  <div style={{ display:"flex", alignItems:"center", gap:8, justifyContent:"center" }}>
                    <button style={SL.stepBtn} onClick={()=>onInventory(room.id,-1)} disabled={(room.inventoryCount??0)<=0}>−</button>
                    <span style={{ fontFamily:"Space Grotesk,sans-serif", fontWeight:700, fontSize:22, minWidth:28, color:"#1A1F2B" }}>{room.inventoryCount ?? 0}</span>
                    <button style={SL.stepBtn} onClick={()=>onInventory(room.id,1)}>+</button>
                  </div>
                  <div style={{ fontSize:11, color:(room.inventoryCount??0)>0?"#15803D":"#B91C1C", marginTop:6, fontWeight:600 }}>{(room.inventoryCount??0)>0?"Available":"Sold out / hidden"}</div>
                </div>

                {/* Rack rate */}
                <div style={{ minWidth:130 }}>
                  <div style={SL.settingLabel}>Rack Rate</div>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <span style={{ color:"#9CA3AF" }}>$</span>
                    <input type="number" value={rackInputs[room.id] ?? room.rack}
                      onChange={e=>setRackInputs(p=>({...p,[room.id]:e.target.value}))}
                      style={SL.settingInput} />
                    <button style={SL.settingSet} onClick={()=>onSaveRack(room.id)}>Set</button>
                  </div>
                </div>

                {/* Bid floor */}
                <div style={{ minWidth:140 }}>
                  <div style={SL.settingLabel}>Bid Floor (hidden)</div>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <span style={{ color:"#9CA3AF" }}>$</span>
                    <input type="number" value={floorInputs[room.id] ?? (room.floor_price ?? "")}
                      onChange={e=>setFloorInputs(p=>({...p,[room.id]:e.target.value}))}
                      style={SL.settingInput} />
                    <button style={SL.settingSet} onClick={()=>onSetFloor(room.id)}>Set</button>
                  </div>
                  <div style={{ fontSize:11, color:"#15803D", marginTop:6, fontWeight:600 }}>Active: ${room.floor_price ?? "—"}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT APP
// ─────────────────────────────────────────────────────────────────────────────
export default function App() {
  const [view, setView] = useState("guest");

  return (
    <>
      <Head>
        <title>LastKey — Private Rate Requests</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="true" />
        <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div style={{ position:"fixed", top:16, right:16, zIndex:1000, display:"flex", gap:4, background:"#0F172A", padding:4, borderRadius:10, border:"1px solid #1E293B" }}>
        <button style={{ ...S.toggleBtn, ...(view==="guest"?S.toggleActive:{}) }} onClick={()=>setView("guest")}>Guest View</button>
        <button style={{ ...S.toggleBtn, ...(view==="hotel"?S.toggleActive:{}) }} onClick={()=>setView("hotel")}>Hotel Dashboard</button>
      </div>

      {view==="guest" ? <GuestView /> : <HotelDashboard />}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────
const S = {
  toggleBtn:      { padding:"8px 14px", borderRadius:7, border:"none", cursor:"pointer", fontSize:13, fontWeight:600, fontFamily:"Inter,sans-serif", color:"#64748B", background:"transparent", transition:"all 0.2s", position:"relative" },
  toggleActive:   { background:"#1E293B", color:"#F7F5F0" },
  heroBox:        { marginBottom:24 },
  heroEyebrow:    { fontSize:11, letterSpacing:"0.12em", textTransform:"uppercase", color:"#F59E0B", fontWeight:600, marginBottom:8 },
  heroTitle:      { fontFamily:"Space Grotesk,sans-serif", fontSize:30, fontWeight:700, margin:"0 0 10px", lineHeight:1.1, letterSpacing:"-0.5px" },
  heroSub:        { color:"#64748B", lineHeight:1.65, fontSize:14, margin:0 },
  sectionLabel:   { fontSize:11, letterSpacing:"0.1em", textTransform:"uppercase", color:"#475569", fontWeight:600, marginBottom:12 },
  roomCard:       { background:"#0F172A", border:"1px solid #1E293B", borderRadius:12, overflow:"hidden", cursor:"pointer", marginBottom:12 },
  roomName:       { fontFamily:"Space Grotesk,sans-serif", fontWeight:700, fontSize:16, marginBottom:3 },
  roomType:       { fontSize:13, color:"#475569", marginBottom:10 },
  amenityRow:     { display:"flex", flexWrap:"wrap", gap:6, marginBottom:12 },
  amenityTag:     { fontSize:11, padding:"3px 8px", borderRadius:4, background:"#1E293B", color:"#94A3B8", fontWeight:500 },
  bidBtn:         { width:"100%", padding:"11px 0", background:"#F59E0B", color:"#0A0F1E", border:"none", borderRadius:8, fontWeight:700, fontSize:14, fontFamily:"Inter,sans-serif", cursor:"pointer" },
  backBtn:        { background:"none", border:"none", color:"#475569", cursor:"pointer", fontSize:14, padding:0, marginBottom:18, fontFamily:"Inter,sans-serif" },
  formCard:       { background:"#0F172A", border:"1px solid #1E293B", borderRadius:14, padding:20 },
  formTitle:      { fontFamily:"Space Grotesk,sans-serif", fontWeight:700, fontSize:18, marginBottom:6 },
  formHint:       { fontSize:13, color:"#475569", marginBottom:18, lineHeight:1.55 },
  amountWrap:     { display:"flex", alignItems:"baseline", gap:8, borderBottom:"2px solid #F59E0B", paddingBottom:12, marginBottom:18 },
  dollarSign:     { fontFamily:"Space Grotesk,sans-serif", fontSize:26, fontWeight:700, color:"#F59E0B" },
  amountInput:    { flex:1, background:"none", border:"none", outline:"none", fontFamily:"Space Grotesk,sans-serif", fontSize:42, fontWeight:700, color:"#F7F5F0", width:"100%" },
  perNight:       { fontSize:13, color:"#475569", whiteSpace:"nowrap" },
  field:          { background:"#1E293B", border:"1px solid #2D3F55", borderRadius:8, padding:"11px 14px", color:"#F7F5F0", fontSize:14, outline:"none", fontFamily:"Inter,sans-serif", width:"100%", boxSizing:"border-box" },
  terms:          { fontSize:12, color:"#475569", lineHeight:1.6, marginBottom:16 },
  submitBtn:      { width:"100%", padding:"13px 0", background:"#F59E0B", color:"#0A0F1E", border:"none", borderRadius:10, fontWeight:700, fontSize:15, fontFamily:"Inter,sans-serif", cursor:"pointer", transition:"opacity 0.2s", display:"block" },
  ghostBtn:       { background:"#1E293B", border:"1px solid #2D3F55", color:"#94A3B8", borderRadius:8, padding:"8px 14px", fontSize:13, fontFamily:"Inter,sans-serif", cursor:"pointer", fontWeight:500 },
  emptyState:     { background:"#0F172A", border:"1px solid #1E293B", borderRadius:14, padding:"44px 28px", textAlign:"center" },
  dashWrap:       { minHeight:"100vh", background:"#080D18", color:"#F7F5F0", fontFamily:"Inter,sans-serif", display:"flex" },
  sidebar:        { width:220, flexShrink:0, background:"#0A0F1E", borderRight:"1px solid #1E293B", padding:"22px 14px", display:"flex", flexDirection:"column" },
  sidebarTop:     { marginBottom:24 },
  logo:           { width:38, height:38, borderRadius:9, background:"#F59E0B", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"Space Grotesk,sans-serif", fontWeight:700, fontSize:13, color:"#0A0F1E", flexShrink:0 },
  sidebarNav:     { display:"flex", flexDirection:"column", gap:2, flex:1 },
  navItem:        { width:"100%", padding:"9px 12px", borderRadius:8, border:"none", background:"none", color:"#64748B", cursor:"pointer", textAlign:"left", fontSize:13, fontFamily:"Inter,sans-serif", fontWeight:500, display:"flex", justifyContent:"space-between", alignItems:"center" },
  navActive:      { background:"#1E293B", color:"#F7F5F0" },
  navBadge:       { background:"#F59E0B", color:"#0A0F1E", fontSize:10, fontWeight:700, padding:"2px 6px", borderRadius:8 },
  dashMain:       { flex:1, padding:"26px 30px", overflowY:"auto" },
  dashSectionHead:{ marginBottom:22 },
  dashTitle:      { fontFamily:"Space Grotesk,sans-serif", fontWeight:700, fontSize:22, margin:"0 0 4px" },
  bidCard:        { background:"#0F172A", border:"1px solid #1E293B", borderRadius:14, padding:20 },
  bidRoom:        { fontFamily:"Space Grotesk,sans-serif", fontWeight:700, fontSize:17 },
  decideBtn:      { padding:"11px 16px", borderRadius:9, border:"none", cursor:"pointer", fontFamily:"Inter,sans-serif", fontWeight:700, fontSize:14 },
  settingLabel:   { fontSize:11, color:"#64748B", marginBottom:6, textTransform:"uppercase", letterSpacing:"0.06em" },
  settingInput:   { width:64, background:"#1E293B", border:"1px solid #2D3F55", borderRadius:6, padding:"7px 10px", color:"#F7F5F0", fontSize:16, fontWeight:700, fontFamily:"Space Grotesk,sans-serif", outline:"none", textAlign:"center" },
  settingSet:     { padding:"9px 12px", background:"#F59E0B", color:"#0A0F1E", border:"none", borderRadius:6, fontWeight:700, fontSize:12, fontFamily:"Inter,sans-serif", cursor:"pointer" },
  stepBtn:        { width:32, height:32, borderRadius:8, border:"1px solid #2D3F55", background:"#1E293B", color:"#F7F5F0", fontSize:18, fontWeight:700, cursor:"pointer", lineHeight:1 },
  toast:          { position:"fixed", top:24, left:"50%", transform:"translateX(-50%)", background:"#0F172A", border:"1px solid #22C55E", borderRadius:12, padding:"14px 18px", display:"flex", gap:12, alignItems:"flex-start", zIndex:2000, boxShadow:"0 8px 32px rgba(0,0,0,0.5)", fontFamily:"Inter,sans-serif", color:"#F7F5F0", minWidth:280 },
  toastDot:       { width:8, height:8, borderRadius:"50%", background:"#22C55E", marginTop:4, flexShrink:0, animation:"pulse 1.5s infinite" },
};

// Light styles — used by the whole guest flow (browse, detail, bid, etc.).
const SL = {
  // palette
  ink:"#1A1F2B", sub:"#6B7280", faint:"#9CA3AF", line:"#E5E7EB", amber:"#F59E0B", price:"#0F766E",
  // page + layout
  page:         { background:"#F4F5F7", color:"#1A1F2B", fontFamily:"Inter,sans-serif", height:"100vh", overflow:"hidden", display:"flex" },
  content:      { flex:1, overflowY:"auto", height:"100%", background:"#F4F5F7" },
  wrap:         { maxWidth:760, margin:"0 auto", padding:"28px 24px 64px" },
  wrapWide:     { maxWidth:1040, margin:"0 auto", padding:"24px 24px 64px" },
  h1:           { fontFamily:"Space Grotesk,sans-serif", fontWeight:700, letterSpacing:"-0.5px", color:"#1A1F2B", margin:0, fontSize:24 },
  sectionLabel: { fontSize:11, letterSpacing:"0.1em", textTransform:"uppercase", color:"#9CA3AF", fontWeight:700, marginBottom:12 },
  backBtn:      { background:"none", border:"none", color:"#6B7280", cursor:"pointer", fontSize:14, padding:0, marginBottom:18, fontFamily:"Inter,sans-serif" },
  panel:        { background:"#fff", border:"1px solid #E5E7EB", borderRadius:16, boxShadow:"0 1px 3px rgba(0,0,0,0.06)" },
  // home search
  searchBar:    { display:"flex", alignItems:"center", background:"#fff", borderRadius:14, boxShadow:"0 12px 40px rgba(0,0,0,0.25)", maxWidth:760, margin:"0 auto", padding:"12px 12px 12px 0", color:"#1A1F2B" },
  searchLabel:  { fontSize:11, fontWeight:700, color:"#1A1F2B", marginBottom:2 },
  searchInput:  { border:"none", outline:"none", fontSize:14, color:"#1A1F2B", width:"100%", fontFamily:"Inter,sans-serif", background:"transparent" },
  searchValue:  { fontSize:14, color:"#6B7280" },
  searchDivider:{ width:1, height:34, background:"#E5E7EB" },
  searchBtn:    { width:50, height:50, borderRadius:"50%", border:"none", background:"#F59E0B", color:"#0A0F1E", fontSize:18, cursor:"pointer", flexShrink:0, marginLeft:8 },
  card:         { background:"#fff", border:"1px solid #E5E7EB", borderRadius:16, overflow:"hidden", cursor:"pointer", boxShadow:"0 1px 3px rgba(0,0,0,0.06)", transition:"box-shadow 0.2s, transform 0.2s" },
  tonightTag:   { position:"absolute", top:12, left:12, background:"rgba(15,23,42,0.85)", color:"#fff", fontSize:11, fontWeight:600, padding:"5px 10px", borderRadius:20 },
  // forms / buttons
  field:        { background:"#fff", border:"1px solid #D1D5DB", borderRadius:10, padding:"11px 14px", color:"#1A1F2B", fontSize:14, outline:"none", fontFamily:"Inter,sans-serif", width:"100%", boxSizing:"border-box" },
  primaryBtn:   { width:"100%", padding:"13px 0", background:"#F59E0B", color:"#0A0F1E", border:"none", borderRadius:12, fontWeight:700, fontSize:15, fontFamily:"Inter,sans-serif", cursor:"pointer", display:"block" },
  ghostBtn:     { background:"#fff", border:"1px solid #D1D5DB", color:"#374151", borderRadius:10, padding:"10px 16px", fontSize:13, fontFamily:"Inter,sans-serif", cursor:"pointer", fontWeight:600 },
  amenityTag:   { fontSize:11, padding:"4px 9px", borderRadius:6, background:"#F3F4F6", color:"#374151", fontWeight:500 },
  // sidebar (light)
  sidebar:      { width:220, flexShrink:0, background:"#fff", borderRight:"1px solid #E5E7EB", padding:"22px 14px", display:"flex", flexDirection:"column", height:"100%", overflowY:"auto" },
  navItem:      { width:"100%", padding:"10px 12px", borderRadius:10, border:"none", background:"none", color:"#6B7280", cursor:"pointer", textAlign:"left", fontSize:13.5, fontFamily:"Inter,sans-serif", fontWeight:600, display:"flex", justifyContent:"space-between", alignItems:"center" },
  navActive:    { background:"#FEF3E2", color:"#B45309" },
  navBadge:     { background:"#F59E0B", color:"#0A0F1E", fontSize:10, fontWeight:700, padding:"2px 6px", borderRadius:8 },
  logo:         { width:38, height:38, borderRadius:10, background:"#F59E0B", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"Space Grotesk,sans-serif", fontWeight:700, fontSize:13, color:"#0A0F1E", flexShrink:0 },
  // hotel dashboard (light)
  dashWrap:       { height:"100vh", background:"#F4F5F7", color:"#1A1F2B", fontFamily:"Inter,sans-serif", display:"flex", overflow:"hidden" },
  sidebarTop:     { marginBottom:22 },
  sidebarNav:     { display:"flex", flexDirection:"column", gap:2, flex:1 },
  dashMain:       { flex:1, padding:"64px 30px 26px", overflowY:"auto" },
  dashSectionHead:{ marginBottom:22 },
  dashTitle:      { fontFamily:"Space Grotesk,sans-serif", fontWeight:700, fontSize:22, margin:"0 0 4px", color:"#1A1F2B" },
  bidCard:        { background:"#fff", border:"1px solid #E5E7EB", borderRadius:16, padding:20, boxShadow:"0 1px 3px rgba(0,0,0,0.06)" },
  bidRoom:        { fontFamily:"Space Grotesk,sans-serif", fontWeight:700, fontSize:17, color:"#1A1F2B" },
  decideBtn:      { padding:"11px 16px", borderRadius:10, border:"none", cursor:"pointer", fontFamily:"Inter,sans-serif", fontWeight:700, fontSize:14 },
  settingLabel:   { fontSize:11, color:"#9CA3AF", marginBottom:6, textTransform:"uppercase", letterSpacing:"0.06em", fontWeight:600 },
  settingInput:   { width:64, background:"#fff", border:"1px solid #D1D5DB", borderRadius:8, padding:"7px 10px", color:"#1A1F2B", fontSize:16, fontWeight:700, fontFamily:"Space Grotesk,sans-serif", outline:"none", textAlign:"center" },
  settingSet:     { padding:"9px 12px", background:"#F59E0B", color:"#0A0F1E", border:"none", borderRadius:8, fontWeight:700, fontSize:12, fontFamily:"Inter,sans-serif", cursor:"pointer" },
  stepBtn:        { width:32, height:32, borderRadius:8, border:"1px solid #D1D5DB", background:"#fff", color:"#1A1F2B", fontSize:18, fontWeight:700, cursor:"pointer", lineHeight:1 },
  toast:          { position:"fixed", top:24, left:"50%", transform:"translateX(-50%)", background:"#fff", border:"1px solid #22C55E", borderRadius:12, padding:"14px 18px", display:"flex", gap:12, alignItems:"flex-start", zIndex:2000, boxShadow:"0 12px 32px rgba(0,0,0,0.15)", fontFamily:"Inter,sans-serif", color:"#1A1F2B", minWidth:280 },
  toastDot:       { width:8, height:8, borderRadius:"50%", background:"#22C55E", marginTop:4, flexShrink:0 },
  emptyState:     { background:"#fff", border:"1px solid #E5E7EB", borderRadius:16, padding:"44px 28px", textAlign:"center", boxShadow:"0 1px 3px rgba(0,0,0,0.06)" },
  formCard:       { background:"#fff", border:"1px solid #E5E7EB", borderRadius:16, padding:20, boxShadow:"0 1px 3px rgba(0,0,0,0.06)" },
  formTitle:      { fontFamily:"Space Grotesk,sans-serif", fontWeight:700, fontSize:18, marginBottom:6, color:"#1A1F2B" },
  submitBtn:      { width:"100%", padding:"13px 0", background:"#F59E0B", color:"#0A0F1E", border:"none", borderRadius:12, fontWeight:700, fontSize:15, fontFamily:"Inter,sans-serif", cursor:"pointer", display:"block" },
  roomSetCard:    { background:"#fff", border:"1px solid #E5E7EB", borderRadius:14, padding:18, display:"flex", gap:16, alignItems:"center", marginBottom:14, flexWrap:"wrap", boxShadow:"0 1px 3px rgba(0,0,0,0.06)" },
};
