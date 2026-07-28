import { useState, useEffect } from "react";
import * as api from "./api";
import { TIMER_SECONDS, effectiveStatus, localDateStr } from "./api";
import { radius, elevation, border, color } from "./tokens";

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
export function shortDate(ymd) {
  const d = parseDate(ymd);
  return d ? d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "";
}
// Stay window: same-day check-in, checkout next morning 11 AM.
export function stayWindow(ymd) {
  const d = parseDate(ymd);
  if (!d) return "";
  const next = new Date(d.getTime() + 86400000);
  const opts = { month: "short", day: "numeric" };
  return `${d.toLocaleDateString(undefined, opts)} → ${next.toLocaleDateString(undefined, opts)} 11:00 AM`;
}

// Responsive: track viewport width so layouts can swap to a mobile shell.
// Starts at a desktop default (matches SSR) then syncs on mount to avoid a
// hydration mismatch; isMobile = width < MOBILE_BREAKPOINT.
export const MOBILE_BREAKPOINT = 768;
export function useWindowWidth() {
  const [width, setWidth] = useState(1024);
  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return width;
}

export function TimerRing({ seconds, total = TIMER_SECONDS, size = 160 }) {
  const r = (size - 16) / 2;
  const circ = 2 * Math.PI * r;
  const dash = circ * (seconds / total);
  // Proportional thresholds — absolute cutoffs would render every ring red once
  // the windows dropped to 60s/120s.
  const pct = total > 0 ? seconds / total : 0;
  const arcColor = pct <= 0.25 ? color.danger : pct <= 0.5 ? color.brand : color.success;
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color.line} strokeWidth={8} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={arcColor} strokeWidth={8}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          style={{ transition: "stroke-dasharray 1s linear, stroke 0.5s" }} />
      </svg>
      <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
        <span style={{ fontFamily:"Space Grotesk,sans-serif", fontSize:size*0.22, fontWeight:700, color:arcColor, letterSpacing:"-1px" }}>{fmt(seconds)}</span>
        <span style={{ fontSize:10, color:color.faint, letterSpacing:"0.08em", textTransform:"uppercase", marginTop:2 }}>remaining</span>
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
export function ImageOrIcon({ url, type, height = 110, radius = 8 }) {
  if (url) {
    return (
      <img src={url} alt="" loading="lazy"
        style={{ width:"100%", height, objectFit:"cover", borderRadius:radius, display:"block" }} />
    );
  }
  return <div style={{ height, borderRadius:radius, overflow:"hidden" }}><RoomIcon type={type} /></div>;
}

export function Badge({ status }) {
  // Light chips: colored text on a soft tint of the same hue (the old dark
  // chip backgrounds were dead v1 dark-theme leftovers — the app is all light).
  const map = {
    pending:   { label:"Awaiting Response", color:color.brandText, bg:color.brandSoft },
    countered: { label:"Counter Offered",   color:color.counter,   bg:color.counterSoft },
    accepted:  { label:"Accepted",          color:color.success,   bg:color.successSoft },
    handled:   { label:"Confirmed",         color:color.success,   bg:color.successSoft },
    declined:  { label:"Declined",          color:color.danger,    bg:color.dangerSoft },
    expired:   { label:"Expired",           color:color.muted,     bg:color.surfaceAlt },
    cancelled: { label:"Cancelled",         color:color.muted,     bg:color.surfaceAlt },
  };
  const s = map[status] || map.pending;
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"4px 10px", borderRadius:20, fontSize:12, fontWeight:600, color:s.color, background:s.bg }}>
      <span style={{ width:6, height:6, borderRadius:"50%", background:s.color, display:"inline-block" }} />
      {s.label}
    </span>
  );
}

// Fixed bottom tab bar shown on mobile in place of the desktop sidebar.
// tabs: [{ id, label, icon, count }].
export const BOTTOM_NAV_HEIGHT = 60;
export function MobileBottomNav({ tabs, activeId, onSelect }) {
  const idle = color.faint;
  const active = color.brandText;
  return (
    <nav style={{ position:"fixed", bottom:0, left:0, right:0, height:BOTTOM_NAV_HEIGHT, background:color.surface,
      borderTop:`1px solid ${color.line}`, display:"flex", zIndex:900, boxShadow:"0 -2px 12px rgba(0,0,0,0.06)" }}>
      {tabs.map(tab => {
        const on = tab.id === activeId;
        return (
          <button key={tab.id} onClick={() => onSelect(tab.id)}
            style={{ flex:1, border:"none", background:"none", cursor:"pointer", display:"flex", flexDirection:"column",
              alignItems:"center", justifyContent:"center", gap:2, padding:"6px 2px", color: on ? active : idle,
              fontFamily:"Inter,sans-serif", fontWeight:on?700:500, position:"relative" }}>
            <span style={{ fontSize:18, lineHeight:1 }}>{tab.icon}</span>
            <span style={{ fontSize:10, letterSpacing:"0.01em" }}>{tab.label}</span>
            {tab.count > 0 && (
              <span style={{ position:"absolute", top:4, right:"50%", marginRight:-20, background:color.brand, color:color.onBrand,
                fontSize:9, fontWeight:700, minWidth:15, height:15, borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", padding:"0 4px" }}>{tab.count}</span>
            )}
          </button>
        );
      })}
    </nav>
  );
}

export function StarDisplay({ rating, size = 13 }) {
  return (
    <span style={{ fontSize:size, color:color.brand, letterSpacing:1 }}>
      {[1,2,3,4,5].map(i => (
        <span key={i} style={{ opacity: i <= Math.round(rating) ? 1 : 0.25 }}>★</span>
      ))}
    </span>
  );
}

export function GuestProfileCard({ guest, compact = false }) {
  if (!guest) return null;
  const c = { bg:color.surface, border:color.line, name:color.ink, sub:color.muted, faint:color.faint, avBg:color.brandSoft, avTx:color.brandText, div:color.line };
  return (
    <div style={{ background:c.bg, border:`1px solid ${c.border}`, borderRadius:10, padding: compact ? "12px 14px" : "16px 18px" }}>
      <div style={{ display:"flex", alignItems:"center", gap:12 }}>
        <div style={{ width:compact?36:44, height:compact?36:44, borderRadius:"50%", background:c.avBg, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"Space Grotesk,sans-serif", fontWeight:700, fontSize:compact?14:18, color:c.avTx, flexShrink:0 }}>
          {(guest.name || "?").split(" ").map(n=>n[0]).join("")}
        </div>
        <div style={{ flex:1 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ fontWeight:700, fontSize:compact?13:15, color:c.name }}>{guest.name}</span>
            {guest.verified && <span style={{ fontSize:10, background:color.successSoft, color:color.success, padding:"2px 6px", borderRadius:4, fontWeight:600 }}>✓ Verified</span>}
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
                <div style={{ fontFamily:"Space Grotesk,sans-serif", fontWeight:700, fontSize:18, color:color.brand }}>{v}</div>
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
export function PasswordLogin({ title, eyebrow, blurb, onSignedIn }) {
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

  const secondaryStyle = { ...SL.primaryBtn, background:color.surface, color:color.ink, border:`1px solid ${color.line}` };

  return (
    <div>
      <div style={{ marginBottom:24 }}>
        <div style={{ fontSize:11, letterSpacing:"0.12em", textTransform:"uppercase", color:color.brand, fontWeight:600, marginBottom:8 }}>{eyebrow}</div>
        <h2 style={{ ...SL.h1, fontSize:24, marginBottom:10 }}>{title}</h2>
        <p style={{ color:color.muted, lineHeight:1.6, fontSize:14, margin:0 }}>{blurb}</p>
      </div>
      <div style={{ ...SL.panel, padding:20 }}>
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          <input style={SL.field} placeholder="Email address" type="email" value={email}
            onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit("signin")} />
          <input style={SL.field} placeholder="Password (min 6 characters)" type="password" value={password}
            onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit("signin")} />
        </div>
        <div style={{ display:"flex", gap:10, marginTop:14 }}>
          <button style={{ ...SL.primaryBtn, flex:1, opacity:(!email||!password||busy)?0.4:1 }} disabled={!email||!password||busy} onClick={()=>submit("signin")}>
            {busy ? "…" : "Sign In"}
          </button>
          <button style={{ ...secondaryStyle, flex:1, opacity:(!email||!password||busy)?0.4:1 }} disabled={!email||!password||busy} onClick={()=>submit("signup")}>
            Create Account
          </button>
        </div>
        {msg && <div style={{ marginTop:12, fontSize:13, color:color.danger }}>{msg}</div>}
      </div>
    </div>
  );
}

export const STATUS_COLOR = { pending:color.brand, countered:color.counter, accepted:color.success, handled:color.success, declined:color.danger, expired:color.faint };

export function BookingCalendar({ bids, selectedDate, onSelect }) {
  const C = { box:color.surface, border:color.line, cell:color.surfaceAlt, cellSel:color.brandSoft, selBorder:color.brand, wd:color.faint, num:color.muted, numSel:color.ink, count:color.ink, legend:color.muted, btn:SL.ghostBtn };
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
                      <span key={s} style={{ width:6, height:6, borderRadius:"50%", background:STATUS_COLOR[s]||color.faint }} />
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

// Light styles — used by the whole guest flow (browse, detail, bid, etc.).
export const SL = {
  // palette — all resolve through the consolidated color tokens (lib/tokens.js)
  ink:color.ink, sub:color.muted, faint:color.faint, line:color.line, amber:color.brand, price:color.price,
  navy:color.dark, // dark section background (for-hotels strip, footer)
  onNavy:color.onDark, onNavyMuted:color.onDarkMuted, // text colors for content on navy sections
  surface:color.surface, surfaceAlt:color.surfaceAlt, onBrand:color.onBrand,
  brandText:color.brandText, brandSoft:color.brandSoft,
  success:color.success, successSoft:color.successSoft,
  danger:color.danger, dangerSoft:color.dangerSoft,
  counter:color.counter, counterSoft:color.counterSoft,
  // page + layout
  page:         { background:color.surfaceAlt, color:color.ink, fontFamily:"Inter,sans-serif", height:"100vh", overflow:"hidden", display:"flex", flexDirection:"column" },
  content:      { flex:1, overflowY:"auto", height:"100%", background:color.surfaceAlt },
  wrap:         { maxWidth:760, margin:"0 auto", padding:"28px 24px 64px" },
  wrapWide:     { maxWidth:1040, margin:"0 auto", padding:"24px 24px 64px" },
  h1:           { fontFamily:"Space Grotesk,sans-serif", fontWeight:700, letterSpacing:"-0.5px", color:color.ink, margin:0, fontSize:24 },
  sectionLabel: { fontSize:11, letterSpacing:"0.1em", textTransform:"uppercase", color:color.faint, fontWeight:700, marginBottom:12 },
  backBtn:      { background:"none", border:"none", color:color.muted, cursor:"pointer", fontSize:14, padding:0, marginBottom:18, fontFamily:"Inter,sans-serif" },
  panel:        { background:color.surface, border:border.default, borderRadius:radius.lg },
  // home search
  searchBar:    { display:"flex", alignItems:"center", background:color.surface, borderRadius:14, boxShadow:elevation.float, maxWidth:760, margin:"0 auto", padding:"12px 12px 12px 0", color:color.ink },
  searchLabel:  { fontSize:11, fontWeight:700, color:color.ink, marginBottom:2 },
  searchInput:  { border:"none", outline:"none", fontSize:14, color:color.ink, width:"100%", fontFamily:"Inter,sans-serif", background:"transparent" },
  searchBtn:    { width:50, height:50, borderRadius:"50%", border:"none", background:color.brand, color:color.onBrand, fontSize:18, cursor:"pointer", flexShrink:0, marginLeft:8 },
  typeahead:    { position:"absolute", top:"calc(100% + 8px)", left:18, right:18, background:color.surface, border:`1px solid ${color.line}`, borderRadius:radius.md, boxShadow:elevation.overlay, overflow:"hidden", zIndex:1200, maxHeight:260, overflowY:"auto" },
  typeaheadItem:{ display:"flex", alignItems:"center", gap:8, width:"100%", textAlign:"left", background:"none", border:"none", padding:"11px 16px", fontSize:14, color:color.ink, fontFamily:"Inter,sans-serif", cursor:"pointer" },
  card:         { background:color.surface, border:`1px solid ${color.line}`, borderRadius:radius.lg, overflow:"hidden", cursor:"pointer", boxShadow:elevation.interactiveResting, transition:"box-shadow 0.2s, transform 0.2s" },
  tonightTag:   { position:"absolute", top:12, left:12, background:"rgba(15,23,42,0.85)", color:color.surface, fontSize:11, fontWeight:600, padding:"5px 10px", borderRadius:radius.xl },
  // forms / buttons
  field:        { background:color.surface, border:`1px solid ${color.line}`, borderRadius:10, padding:"11px 14px", color:color.ink, fontSize:14, outline:"none", fontFamily:"Inter,sans-serif", width:"100%", boxSizing:"border-box" },
  primaryBtn:   { width:"100%", padding:"13px 0", background:color.brand, color:color.onBrand, border:"none", borderRadius:radius.md, fontWeight:700, fontSize:15, fontFamily:"Inter,sans-serif", cursor:"pointer", display:"block" },
  ghostBtn:     { background:color.surface, border:`1px solid ${color.line}`, color:color.ink, borderRadius:10, padding:"10px 16px", fontSize:13, fontFamily:"Inter,sans-serif", cursor:"pointer", fontWeight:600 },
  amenityTag:   { fontSize:11, padding:"4px 9px", borderRadius:6, background:color.surfaceAlt, color:color.ink, fontWeight:500 },
  // sidebar (light)
  sidebar:      { width:220, flexShrink:0, background:color.surface, borderRight:`1px solid ${color.line}`, padding:"22px 14px", display:"flex", flexDirection:"column", height:"100%", overflowY:"auto" },
  navItem:      { width:"100%", padding:"10px 12px", borderRadius:10, border:"none", background:"none", color:color.muted, cursor:"pointer", textAlign:"left", fontSize:13.5, fontFamily:"Inter,sans-serif", fontWeight:600, display:"flex", justifyContent:"space-between", alignItems:"center" },
  navActive:    { background:color.brandSoft, color:color.brandText },
  navBadge:     { background:color.brand, color:color.onBrand, fontSize:10, fontWeight:700, padding:"2px 6px", borderRadius:radius.sm },
  logo:         { width:38, height:38, borderRadius:10, background:color.brand, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"Space Grotesk,sans-serif", fontWeight:700, fontSize:13, color:color.onBrand, flexShrink:0 },
  // guest top header (booking.com-style bar, replaces the old guest sidebar)
  headerBar:        { position:"sticky", top:0, zIndex:1000, width:"100%", background:color.surface, borderBottom:`1px solid ${color.line}`, flexShrink:0 },
  headerInner:      { maxWidth:1200, margin:"0 auto", padding:"0 24px", height:64, display:"flex", alignItems:"center", justifyContent:"space-between" },
  headerLink:       { background:"none", border:"none", color:color.ink, cursor:"pointer", fontSize:13.5, fontFamily:"Inter,sans-serif", fontWeight:600, textDecoration:"none", padding:"8px 10px" },
  headerBtnPrimary: { background:color.brand, color:color.onBrand, border:"none", borderRadius:10, cursor:"pointer", fontSize:13.5, fontFamily:"Inter,sans-serif", fontWeight:700, padding:"9px 16px" },
  headerNavBtn:     { background:"none", border:"none", color:color.muted, cursor:"pointer", fontSize:13.5, fontFamily:"Inter,sans-serif", fontWeight:600, padding:"9px 12px", borderRadius:10 },
  headerNavActive:  { background:color.brandSoft, color:color.brandText },
  headerAccountBtn: { display:"flex", alignItems:"center", gap:6, background:color.surfaceAlt, border:`1px solid ${color.line}`, color:color.ink, cursor:"pointer", fontSize:13, fontFamily:"Inter,sans-serif", fontWeight:600, padding:"8px 12px", borderRadius:10 },
  headerDropdown:   { position:"absolute", top:"calc(100% + 8px)", right:0, background:color.surface, border:`1px solid ${color.line}`, borderRadius:radius.md, boxShadow:elevation.overlay, minWidth:180, overflow:"hidden", zIndex:1001 },
  headerDropdownItem:{ display:"block", width:"100%", textAlign:"left", background:"none", border:"none", color:color.ink, cursor:"pointer", fontSize:13.5, fontFamily:"Inter,sans-serif", fontWeight:500, padding:"11px 14px" },
  hamburgerBtn:     { background:"none", border:`1px solid ${color.line}`, borderRadius:10, width:38, height:38, fontSize:16, color:color.ink, cursor:"pointer" },
  mobileMenuPanel:  { position:"absolute", top:"100%", left:0, right:0, background:color.surface, borderBottom:`1px solid ${color.line}`, boxShadow:elevation.overlay, display:"flex", flexDirection:"column", padding:"6px 8px", zIndex:999 },
  mobileMenuItem:   { display:"block", width:"100%", textAlign:"left", background:"none", border:"none", color:color.ink, cursor:"pointer", fontSize:14, fontFamily:"Inter,sans-serif", fontWeight:600, padding:"12px 10px", textDecoration:"none" },
  // modal (final bid double-check)
  modalOverlay: { position:"fixed", inset:0, background:"rgba(15,23,42,0.55)", display:"flex", alignItems:"center", justifyContent:"center", padding:20, zIndex:3000 },
  modalPanel:   { background:color.surface, border:border.default, borderRadius:radius.lg, boxShadow:elevation.overlay, padding:"26px 24px", maxWidth:420, width:"100%" },
  // guest footer (dark, 3 columns; matches the for-hotels strip)
  footerBar:        { flexShrink:0, width:"100%", background:color.dark, color:color.surface },
  footerGrid:       { maxWidth:1120, margin:"0 auto", padding:"56px 24px", display:"grid", gap:40 },
  footerHead:       { fontSize:13, letterSpacing:"0.12em", textTransform:"uppercase", color:color.onDarkMuted, fontWeight:600, marginBottom:14 },
  footerLink:       { display:"block", background:"none", border:"none", padding:0, textAlign:"left", color:color.onDarkMuted, fontSize:14, fontFamily:"Inter,sans-serif", fontWeight:500, textDecoration:"none", cursor:"pointer", marginBottom:10 },
  // homepage (studio rebuild) — typography scale lives here, not in JSX
  heroWrap:         { position:"relative", minHeight:"calc(100vh - 64px)", display:"flex", alignItems:"center", justifyContent:"center", backgroundSize:"cover", backgroundPosition:"center" },
  heroOverlay:      { position:"absolute", inset:0, background:"rgba(0,0,0,0.48)" },
  heroTitle:        { fontFamily:"Georgia, serif", fontSize:52, fontWeight:700, lineHeight:1.12, color:color.surface, margin:0, letterSpacing:"-0.5px" },
  heroSub:          { fontSize:17, color:"rgba(255,255,255,0.6)", margin:"18px auto 0", lineHeight:1.6, maxWidth:520 },
  heroCta:          { background:color.surface, color:color.ink, border:"none", borderRadius:radius.lg, padding:"16px 34px", fontSize:16, fontWeight:600, fontFamily:"Inter,sans-serif", cursor:"pointer", transition:"opacity 0.2s" },
  homeLabel:        { fontSize:13, letterSpacing:"0.14em", textTransform:"uppercase", color:color.ink, fontWeight:600, textAlign:"center" },
  stepNumBig:       { fontFamily:"Space Grotesk,sans-serif", fontSize:64, fontWeight:400, lineHeight:1, color:color.faint },
  stepLabel:        { fontSize:16, fontWeight:700, color:color.ink, marginTop:18, lineHeight:1.4 },
  stepCopy:         { fontSize:14, color:color.muted, lineHeight:1.65, marginTop:8 },
  cityCard:         { position:"relative", borderRadius:radius.lg, overflow:"hidden", height:220, display:"flex", alignItems:"flex-end", padding:22, backgroundSize:"cover", backgroundPosition:"center", color:color.surface },
  cityOverlay:      { position:"absolute", inset:0, background:"rgba(0,0,0,0.42)" },
  cityTag:          { position:"absolute", top:14, left:14, background:"rgba(255,255,255,0.92)", color:color.ink, fontSize:12, fontWeight:600, padding:"4px 10px", borderRadius:radius.lg },
  // hotel dashboard (light)
  dashWrap:       { height:"100vh", background:color.surfaceAlt, color:color.ink, fontFamily:"Inter,sans-serif", display:"flex", overflow:"hidden" },
  sidebarTop:     { marginBottom:22 },
  sidebarNav:     { display:"flex", flexDirection:"column", gap:2, flex:1 },
  dashMain:       { flex:1, padding:"64px 30px 26px", overflowY:"auto" },
  dashSectionHead:{ marginBottom:22 },
  dashTitle:      { fontFamily:"Space Grotesk,sans-serif", fontWeight:700, fontSize:22, margin:"0 0 4px", color:color.ink },
  bidCard:        { background:color.surface, border:border.default, borderRadius:radius.lg, padding:20 },
  bidRoom:        { fontFamily:"Space Grotesk,sans-serif", fontWeight:700, fontSize:17, color:color.ink },
  decideBtn:      { padding:"11px 16px", borderRadius:10, border:"none", cursor:"pointer", fontFamily:"Inter,sans-serif", fontWeight:700, fontSize:14 },
  settingLabel:   { fontSize:11, color:color.faint, marginBottom:6, textTransform:"uppercase", letterSpacing:"0.06em", fontWeight:600 },
  settingInput:   { width:64, background:color.surface, border:`1px solid ${color.line}`, borderRadius:radius.sm, padding:"7px 10px", color:color.ink, fontSize:16, fontWeight:700, fontFamily:"Space Grotesk,sans-serif", outline:"none", textAlign:"center" },
  settingSet:     { padding:"9px 12px", background:color.brand, color:color.onBrand, border:"none", borderRadius:radius.sm, fontWeight:700, fontSize:12, fontFamily:"Inter,sans-serif", cursor:"pointer" },
  stepBtn:        { width:32, height:32, borderRadius:radius.sm, border:`1px solid ${color.line}`, background:color.surface, color:color.ink, fontSize:18, fontWeight:700, cursor:"pointer", lineHeight:1 },
  toast:          { position:"fixed", top:24, left:"50%", transform:"translateX(-50%)", background:color.surface, border:`1px solid ${color.success}`, borderRadius:radius.md, padding:"14px 18px", display:"flex", gap:12, alignItems:"flex-start", zIndex:2000, boxShadow:elevation.overlay, fontFamily:"Inter,sans-serif", color:color.ink, minWidth:280 },
  toastDot:       { width:8, height:8, borderRadius:"50%", background:color.success, marginTop:4, flexShrink:0 },
  emptyState:     { background:color.surface, border:border.default, borderRadius:radius.lg, padding:"44px 28px", textAlign:"center" },
  formCard:       { background:color.surface, border:border.default, borderRadius:radius.lg, padding:20 },
  formTitle:      { fontFamily:"Space Grotesk,sans-serif", fontWeight:700, fontSize:18, marginBottom:6, color:color.ink },
  submitBtn:      { width:"100%", padding:"13px 0", background:color.brand, color:color.onBrand, border:"none", borderRadius:radius.md, fontWeight:700, fontSize:15, fontFamily:"Inter,sans-serif", cursor:"pointer", display:"block" },
  roomSetCard:    { background:color.surface, border:border.default, borderRadius:14, padding:18, display:"flex", gap:16, alignItems:"center", marginBottom:14, flexWrap:"wrap" },
};
