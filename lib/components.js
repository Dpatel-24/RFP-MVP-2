import { useState, useEffect } from "react";
import * as api from "./api";
import { TIMER_SECONDS, effectiveStatus, localDateStr } from "./api";

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

// Fixed bottom tab bar shown on mobile in place of the desktop sidebar.
// tabs: [{ id, label, icon, count }]; theme via `dark` (hotel) vs light (guest).
export const BOTTOM_NAV_HEIGHT = 60;
export function MobileBottomNav({ tabs, activeId, onSelect, dark = false }) {
  const bg = dark ? "#0A0F1E" : "#fff";
  const border = dark ? "#1E293B" : "#E5E7EB";
  const idle = dark ? "#64748B" : "#9CA3AF";
  const active = dark ? "#F7F5F0" : "#B45309";
  return (
    <nav style={{ position:"fixed", bottom:0, left:0, right:0, height:BOTTOM_NAV_HEIGHT, background:bg,
      borderTop:`1px solid ${border}`, display:"flex", zIndex:900, boxShadow:"0 -2px 12px rgba(0,0,0,0.06)" }}>
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
              <span style={{ position:"absolute", top:4, right:"50%", marginRight:-20, background:"#F59E0B", color:"#0A0F1E",
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
    <span style={{ fontSize:size, color:"#F59E0B", letterSpacing:1 }}>
      {[1,2,3,4,5].map(i => (
        <span key={i} style={{ opacity: i <= Math.round(rating) ? 1 : 0.25 }}>★</span>
      ))}
    </span>
  );
}

export function GuestProfileCard({ guest, compact = false, light = false }) {
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
export function PasswordLogin({ title, eyebrow, blurb, onSignedIn, light = false }) {
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

export const STATUS_COLOR = { pending:"#F59E0B", countered:"#A78BFA", accepted:"#22C55E", handled:"#22C55E", declined:"#EF4444", expired:"#64748B" };

export function BookingCalendar({ bids, selectedDate, onSelect, light = false }) {
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


export const S = {
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
export const SL = {
  // palette
  ink:"#1A1F2B", sub:"#6B7280", faint:"#9CA3AF", line:"#E5E7EB", amber:"#F59E0B", price:"#0F766E",
  // page + layout
  page:         { background:"#F4F5F7", color:"#1A1F2B", fontFamily:"Inter,sans-serif", height:"100vh", overflow:"hidden", display:"flex", flexDirection:"column" },
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
  // guest top header (booking.com-style bar, replaces the old guest sidebar)
  headerBar:        { position:"sticky", top:0, zIndex:1000, width:"100%", background:"#fff", borderBottom:"1px solid #E5E7EB", flexShrink:0 },
  headerInner:      { maxWidth:1200, margin:"0 auto", padding:"0 24px", height:64, display:"flex", alignItems:"center", justifyContent:"space-between" },
  headerLink:       { background:"none", border:"none", color:"#374151", cursor:"pointer", fontSize:13.5, fontFamily:"Inter,sans-serif", fontWeight:600, textDecoration:"none", padding:"8px 10px" },
  headerBtnPrimary: { background:"#F59E0B", color:"#0A0F1E", border:"none", borderRadius:10, cursor:"pointer", fontSize:13.5, fontFamily:"Inter,sans-serif", fontWeight:700, padding:"9px 16px" },
  headerNavBtn:     { background:"none", border:"none", color:"#6B7280", cursor:"pointer", fontSize:13.5, fontFamily:"Inter,sans-serif", fontWeight:600, padding:"9px 12px", borderRadius:10 },
  headerNavActive:  { background:"#FEF3E2", color:"#B45309" },
  headerAccountBtn: { display:"flex", alignItems:"center", gap:6, background:"#F9FAFB", border:"1px solid #E5E7EB", color:"#1A1F2B", cursor:"pointer", fontSize:13, fontFamily:"Inter,sans-serif", fontWeight:600, padding:"8px 12px", borderRadius:10 },
  headerDropdown:   { position:"absolute", top:"calc(100% + 8px)", right:0, background:"#fff", border:"1px solid #E5E7EB", borderRadius:12, boxShadow:"0 12px 32px rgba(0,0,0,0.12)", minWidth:180, overflow:"hidden", zIndex:1001 },
  headerDropdownItem:{ display:"block", width:"100%", textAlign:"left", background:"none", border:"none", color:"#374151", cursor:"pointer", fontSize:13.5, fontFamily:"Inter,sans-serif", fontWeight:500, padding:"11px 14px" },
  hamburgerBtn:     { background:"none", border:"1px solid #E5E7EB", borderRadius:10, width:38, height:38, fontSize:16, color:"#374151", cursor:"pointer" },
  mobileMenuPanel:  { position:"absolute", top:"100%", left:0, right:0, background:"#fff", borderBottom:"1px solid #E5E7EB", boxShadow:"0 12px 32px rgba(0,0,0,0.10)", display:"flex", flexDirection:"column", padding:"6px 8px", zIndex:999 },
  mobileMenuItem:   { display:"block", width:"100%", textAlign:"left", background:"none", border:"none", color:"#374151", cursor:"pointer", fontSize:14, fontFamily:"Inter,sans-serif", fontWeight:600, padding:"12px 10px", textDecoration:"none" },
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
