import { useState, useEffect, useRef, useCallback } from "react";
import Head from "next/head";
import * as api from "../lib/api";
import { TIMER_SECONDS, COUNTER_TIMER, effectiveStatus, secondsLeft, localDateStr } from "../lib/api";

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

function GuestProfileCard({ guest, compact = false }) {
  if (!guest) return null;
  return (
    <div style={{ background:"#0A0F1E", border:"1px solid #1E293B", borderRadius:10, padding: compact ? "12px 14px" : "16px 18px" }}>
      <div style={{ display:"flex", alignItems:"center", gap:12 }}>
        <div style={{ width:compact?36:44, height:compact?36:44, borderRadius:"50%", background:"#1E3A5F", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"Space Grotesk,sans-serif", fontWeight:700, fontSize:compact?14:18, color:"#F59E0B", flexShrink:0 }}>
          {(guest.name || "?").split(" ").map(n=>n[0]).join("")}
        </div>
        <div style={{ flex:1 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ fontWeight:700, fontSize:compact?13:15 }}>{guest.name}</span>
            {guest.verified && <span style={{ fontSize:10, background:"#052E16", color:"#22C55E", padding:"2px 6px", borderRadius:4, fontWeight:600 }}>✓ Verified</span>}
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:3 }}>
            <StarDisplay rating={guest.rating} size={12} />
            <span style={{ fontSize:12, color:"#94A3B8" }}>{guest.rating > 0 ? guest.rating.toFixed(1) : "New"} · {guest.stays} stays · Since {guest.memberSince}</span>
          </div>
        </div>
      </div>
      {!compact && (
        <>
          <div style={{ display:"flex", gap:16, marginTop:12, paddingTop:12, borderTop:"1px solid #1E293B" }}>
            {[["Stays", guest.stays], ["Rating", guest.rating > 0 ? guest.rating.toFixed(1) : "—"], ["Reviews", guest.reviews]].map(([l,v]) => (
              <div key={l} style={{ textAlign:"center" }}>
                <div style={{ fontFamily:"Space Grotesk,sans-serif", fontWeight:700, fontSize:18, color:"#F59E0B" }}>{v}</div>
                <div style={{ fontSize:11, color:"#475569" }}>{l}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop:10, fontSize:11, color:"#475569", fontStyle:"italic" }}>
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
function PasswordLogin({ title, eyebrow, blurb, onSignedIn }) {
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

  return (
    <div>
      <div style={S.heroBox}>
        <div style={S.heroEyebrow}>{eyebrow}</div>
        <h2 style={{ ...S.heroTitle, fontSize:24 }}>{title}</h2>
        <p style={S.heroSub}>{blurb}</p>
      </div>
      <div style={S.formCard}>
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          <input style={S.field} placeholder="Email address" type="email" value={email}
            onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit("signin")} />
          <input style={S.field} placeholder="Password (min 6 characters)" type="password" value={password}
            onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit("signin")} />
        </div>
        <div style={{ display:"flex", gap:10, marginTop:14 }}>
          <button style={{ ...S.submitBtn, flex:1, opacity:(!email||!password||busy)?0.4:1 }} disabled={!email||!password||busy} onClick={()=>submit("signin")}>
            {busy ? "…" : "Sign In"}
          </button>
          <button style={{ ...S.submitBtn, flex:1, background:"#1E293B", color:"#94A3B8", opacity:(!email||!password||busy)?0.4:1 }} disabled={!email||!password||busy} onClick={()=>submit("signup")}>
            Create Account
          </button>
        </div>
        {msg && <div style={{ marginTop:12, fontSize:13, color:"#EF4444" }}>{msg}</div>}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HOTEL DISCOVERY LISTING
// ─────────────────────────────────────────────────────────────────────────────
function HotelListingView({ onSelectHotel, hotelsWithRooms }) {
  return (
    <div>
      <div style={S.heroBox}>
        <div style={S.heroEyebrow}>Tonight Only · Live Availability</div>
        <h1 style={{ ...S.heroTitle, fontSize:26 }}>Hotels available now</h1>
        <p style={S.heroSub}>Only hotels with unsold rooms tonight are listed. Submit a private rate request — response in 10 min.</p>
      </div>
      <div style={S.sectionLabel}>{hotelsWithRooms.length} hotels · New Orleans Area</div>
      <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
        {hotelsWithRooms.map(hotel => (
          <div key={hotel.id} style={{ background:"#0F172A", border:"1px solid #1E293B", borderRadius:14, overflow:"hidden", cursor:"pointer" }}
            onClick={() => onSelectHotel(hotel)}>
            {hotel.heroImage && (
              <img src={hotel.heroImage} alt="" loading="lazy"
                style={{ width:"100%", height:150, objectFit:"cover", display:"block" }} />
            )}
            <div style={{ padding:"16px 18px 0" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                <div>
                  <div style={{ fontFamily:"Space Grotesk,sans-serif", fontWeight:700, fontSize:16 }}>{hotel.name}</div>
                  <div style={{ fontSize:12, color:"#475569", marginTop:2 }}>{hotel.location}</div>
                  <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:5 }}>
                    <StarDisplay rating={hotel.rating} />
                    <span style={{ fontSize:12, color:"#94A3B8" }}>{hotel.rating} ({hotel.reviewCount})</span>
                  </div>
                </div>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontSize:11, color:"#475569" }}>From</div>
                  <div style={{ fontFamily:"Space Grotesk,sans-serif", fontWeight:700, fontSize:22 }}>${Math.min(...hotel.rooms.map(r=>r.rack))}</div>
                  <div style={{ fontSize:11, color:"#475569" }}>rack</div>
                </div>
              </div>
              <div style={{ fontSize:12, color:"#64748B", marginTop:7, fontStyle:"italic" }}>{hotel.tagline}</div>
            </div>
            <div style={{ display:"flex", gap:8, padding:"12px 18px", borderTop:"1px solid #0A0F1E", marginTop:12 }}>
              <span style={{ fontSize:11, color:"#22C55E", background:"#052E16", padding:"3px 8px", borderRadius:4, fontWeight:600 }}>
                {hotel.rooms.length} room{hotel.rooms.length>1?"s":""} available
              </span>
              <span style={{ fontSize:11, color:"#F59E0B", background:"#451A03", padding:"3px 8px", borderRadius:4, fontWeight:600 }}>
                10-min response
              </span>
            </div>
          </div>
        ))}
      </div>
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

  async function handleBid() {
    if (!currentGuest) { setScreen("login"); return; }
    const amount = parseInt(bidAmount);
    if (!amount || amount < 1) return;
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

    if (screen === "hotel") return (
      <div>
        <button style={S.backBtn} onClick={() => setScreen("listing")}>← All Hotels</button>
        <div style={{ marginBottom:18 }}>
          <div style={{ fontFamily:"Space Grotesk,sans-serif", fontWeight:700, fontSize:20 }}>{selectedHotel.name}</div>
          <div style={{ fontSize:13, color:"#475569", marginTop:3 }}>{selectedHotel.location}</div>
          <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:5 }}>
            <StarDisplay rating={selectedHotel.rating} />
            <span style={{ fontSize:12, color:"#94A3B8" }}>{selectedHotel.rating} ({selectedHotel.reviewCount} reviews)</span>
          </div>
        </div>
        <div style={S.sectionLabel}>Available Tonight</div>
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          {selectedHotel.rooms.map(room => (
            <div key={room.id} style={S.roomCard} onClick={() => { setSelectedRoom(room); setScreen("bid"); }}>
              <ImageOrIcon url={room.imageUrl} type={room.image} height={150} radius={0} />
              <div style={{ padding:"12px 14px 14px" }}>
                <div style={S.roomName}>{room.name}</div>
                <div style={S.roomType}>{room.type} · {room.sqft} sq ft · Floor {room.floor}</div>
                <div style={S.amenityRow}>{room.amenities.map(a => <span key={a} style={S.amenityTag}>{a}</span>)}</div>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                  <span style={{ fontSize:12, color:"#475569" }}>Rack rate</span>
                  <span style={{ fontSize:14, color:"#94A3B8", textDecoration:"line-through" }}>${room.rack}</span>
                </div>
                <button style={S.bidBtn}>Request a Rate →</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );

    if (screen === "login") return (
      <div>
        <button style={S.backBtn} onClick={() => setScreen("listing")}>← Back</button>
        <PasswordLogin
          eyebrow="Guest Profile"
          title="Sign in to bid"
          blurb="Sign in or create an account with email and password. Your star rating is visible to hotels when you bid — no other personal info is shared."
          onSignedIn={() => { setScreen(selectedRoom ? "bid" : "listing"); setSideTab("browse"); }}
        />
      </div>
    );

    if (screen === "bid") return (
      <div>
        <button style={S.backBtn} onClick={() => setScreen("hotel")}>← Back</button>
        {currentGuest && <div style={{ marginBottom:14 }}><GuestProfileCard guest={currentGuest} compact /></div>}
        <div style={{ marginBottom:14 }}>
          <ImageOrIcon url={selectedRoom.imageUrl} type={selectedRoom.image} height={170} />
          <div style={{ marginTop:10 }}>
            <div style={S.roomName}>{selectedRoom.name}</div>
            <div style={S.roomType}>{selectedRoom.type} · {selectedRoom.sqft} sq ft</div>
          </div>
        </div>
        <div style={S.formCard}>
          <div style={S.formTitle}>Your Rate Request</div>
          <div style={S.formHint}>Rack rate is ${selectedRoom.rack}. The hotel will respond within 10 minutes.</div>
          <div style={{ fontSize:12, color:"#64748B", marginBottom:14 }}>📅 Tonight · {stayWindow(localDateStr())}</div>
          <div style={S.amountWrap}>
            <span style={S.dollarSign}>$</span>
            <input type="number" placeholder="0" value={bidAmount} onChange={e=>setBidAmount(e.target.value)} style={S.amountInput} min="1" />
            <span style={S.perNight}>/ night</span>
          </div>
          {!currentGuest && (
            <div style={{ padding:"10px 14px", background:"#451A03", borderRadius:8, fontSize:13, color:"#F59E0B", marginBottom:14 }}>
              Sign in to submit a bid. Hotels will see your rating — nothing else.
            </div>
          )}
          <div style={S.terms}>If accepted, you'll receive a confirmation code to give the hotel at check-in. No payment is taken here — LastKey just delivers your request.</div>
          <button style={{ ...S.submitBtn, opacity:(!bidAmount||submitting)?0.4:1 }} disabled={!bidAmount||submitting} onClick={handleBid}>
            {currentGuest ? (submitting ? "Submitting…" : "Submit Rate Request") : "Sign In to Bid"}
          </button>
        </div>
      </div>
    );

    if (screen === "waiting") return (
      <div style={{ textAlign:"center", paddingTop:40 }}>
        <div style={{ display:"flex", justifyContent:"center", marginBottom:24 }}><TimerRing seconds={timeLeft} /></div>
        <h2 style={{ ...S.heroTitle, fontSize:22, marginBottom:10 }}>Request Sent</h2>
        <p style={{ color:"#64748B", maxWidth:300, margin:"0 auto", lineHeight:1.6 }}>
          <strong style={{ color:"#F7F5F0" }}>{activeBid?.hotel?.name}</strong> is reviewing your ${activeBid?.amount} request for {activeBid?.room?.name}.
        </p>
        <div style={{ background:"#0F172A", border:"1px solid #1E293B", borderRadius:12, padding:"16px 20px", maxWidth:300, margin:"22px auto 0" }}>
          {[["Room", activeBid?.room?.name], ["Stay", stayWindow(activeBid?.stayDate || localDateStr())], ["Your bid","$"+activeBid?.amount], ["Ref", activeBid?.id?.slice(0,8)]].map(([l,v]) => (
            <div key={l} style={{ display:"flex", justifyContent:"space-between", padding:"6px 0", fontSize:14, borderBottom:"1px solid #1E293B" }}>
              <span style={{ color:"#64748B" }}>{l}</span>
              <span style={{ color:l==="Your bid"?"#F59E0B":"#F7F5F0", fontWeight:l==="Your bid"?700:400, fontFamily:l==="Ref"?"monospace":"inherit", fontSize:l==="Ref"?12:14 }}>{v}</span>
            </div>
          ))}
        </div>
        <p style={{ color:"#334155", fontSize:12, marginTop:16 }}>Check the <strong style={{color:"#94A3B8"}}>Live Requests</strong> tab to track status.</p>
      </div>
    );

    if (screen === "counter") {
      const bid = bids.find(b=>b.id===activeBid?.id) || activeBid;
      return (
        <div style={{ textAlign:"center", paddingTop:32 }}>
          <div style={{ fontSize:44, marginBottom:12 }}>🤝</div>
          <h2 style={{ ...S.heroTitle, fontSize:24, marginBottom:8 }}>Counter Offer</h2>
          <p style={{ color:"#94A3B8", maxWidth:300, margin:"0 auto 20px", lineHeight:1.6 }}>
            {bid?.hotel?.name} can't do ${bid?.amount}, but they're offering a counter rate.
          </p>
          <div style={{ background:"#0F172A", border:"2px solid #A78BFA", borderRadius:14, padding:"24px", maxWidth:300, margin:"0 auto 20px" }}>
            <div style={{ fontSize:12, color:"#64748B", marginBottom:4 }}>Counter rate offered</div>
            <div style={{ fontFamily:"Space Grotesk,sans-serif", fontWeight:700, fontSize:52, color:"#A78BFA", lineHeight:1 }}>${bid?.counterAmount}</div>
            <div style={{ fontSize:12, color:"#475569", marginTop:6 }}>vs your bid of ${bid?.amount} · rack ${bid?.room?.rack}</div>
            <div style={{ display:"flex", justifyContent:"center", marginTop:18 }}><TimerRing seconds={counterTimeLeft} total={COUNTER_TIMER} size={90} /></div>
            <div style={{ fontSize:12, color:"#475569", marginTop:8 }}>Respond before time runs out</div>
          </div>
          <div style={{ display:"flex", gap:10, maxWidth:300, margin:"0 auto" }}>
            <button style={{ ...S.submitBtn, flex:1, background:"#A78BFA", color:"#1E0A2E" }} onClick={handleAcceptCounter}>Accept ${bid?.counterAmount}</button>
            <button style={{ ...S.submitBtn, flex:1, background:"#1E293B", color:"#94A3B8" }} onClick={handleDeclineCounter}>Decline</button>
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
        <div style={{ textAlign:"center", paddingTop:48 }}>
          <div style={{ width:72, height:72, borderRadius:"50%", background:"#1E293B", display:"flex", alignItems:"center", justifyContent:"center", fontSize:30, margin:"0 auto" }}>
            {accepted?"✓":expired?"⏱":"✕"}
          </div>
          <h2 style={{ ...S.heroTitle, fontSize:26, marginTop:18, color:accepted?"#22C55E":expired?"#64748B":"#EF4444" }}>
            {accepted?"You're in.":expired?"Time's up.":"Not this time."}
          </h2>
          <p style={{ color:"#94A3B8", maxWidth:300, margin:"10px auto 0", lineHeight:1.7 }}>
            {accepted
              ? `Your $${bid?.counterAmount ?? bid?.amount} rate for ${bid?.room?.name} was accepted (${stayWindow(bid?.stayDate || localDateStr())}). Show your confirmation code at check-in.`
              : expired ? "The window closed. Try again — rooms may still be available."
              : "The hotel couldn't accept this rate. Try a different amount or room."}
          </p>
          {accepted && bid?.confirmationCode && (
            <div style={{ maxWidth:300, margin:"22px auto 0", background:"#052E16", border:"1px solid #22C55E", borderRadius:12, padding:"16px 20px" }}>
              <div style={{ fontSize:11, color:"#64748B", letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:6 }}>Confirmation Code</div>
              <div style={{ fontFamily:"Space Grotesk,sans-serif", fontWeight:700, fontSize:30, color:"#22C55E", letterSpacing:"0.15em" }}>{bid.confirmationCode}</div>
            </div>
          )}
          <button style={{ ...S.ghostBtn, marginTop:24 }} onClick={reset}>Browse Again</button>
        </div>
      );
    }

    // profile tab
    if (sideTab === "profile") return (
      <div>
        <div style={S.sectionLabel}>Your Profile</div>
        {currentGuest
          ? <>
              <GuestProfileCard guest={currentGuest} />
              <div style={{ marginTop:14, fontSize:12, color:"#334155", lineHeight:1.7 }}>
                Hotels see only your star rating and stay count — no name, email, or demographic info. This prevents discrimination while letting hotels make informed decisions.
              </div>
              <button style={{ ...S.ghostBtn, marginTop:20 }} onClick={handleSignOut}>Sign Out</button>
            </>
          : <div style={S.emptyState}>
              <div style={{ marginBottom:8, fontSize:15, fontWeight:600 }}>Not signed in</div>
              <button style={S.submitBtn} onClick={()=>setScreen("login")}>Sign In / Join</button>
            </div>
        }
      </div>
    );

    return <HotelListingView hotelsWithRooms={hotels} onSelectHotel={h=>{setSelectedHotel(h);setScreen("hotel");}} />;
  }

  // ── Live requests panel (sidebar tab content) ──────────────────────────────
  function renderSideContent() {
    if (sideTab === "live") return (
      <div style={{ padding:"20px 16px" }}>
        <div style={{ fontSize:11, color:"#475569", letterSpacing:"0.08em", textTransform:"uppercase", fontWeight:600, marginBottom:14 }}>Live Requests</div>
        {myLive.length === 0
          ? <div style={{ fontSize:13, color:"#334155", textAlign:"center", padding:"32px 0" }}>No active requests.<br/>Submit a bid to get started.</div>
          : myLive.map(b => (
            <div key={b.id} style={{ background:"#0F172A", border:"1px solid #1E293B", borderRadius:10, padding:"14px", marginBottom:10 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
                <div>
                  <div style={{ fontWeight:700, fontSize:13 }}>{b.room.name}</div>
                  <div style={{ fontSize:11, color:"#475569", marginTop:2 }}>{b.hotel.name}</div>
                  <div style={{ fontSize:11, color:"#475569", marginTop:2 }}>📅 {shortDate(b.stayDate)}</div>
                </div>
                <div style={{ fontFamily:"Space Grotesk,sans-serif", fontWeight:700, fontSize:18, color: b.status==="countered"?"#A78BFA":"#F59E0B" }}>${b.status==="countered"?b.counterAmount:b.amount}</div>
              </div>
              <Badge status={effectiveStatus(b)} />
              {b.status === "countered" && (
                <button style={{ ...S.submitBtn, marginTop:10, padding:"9px 0", fontSize:13, background:"#A78BFA", color:"#1E0A2E" }}
                  onClick={()=>{ setActiveBid(b); setSelectedHotel(b.hotel); setSelectedRoom(b.room); setCTL(secondsLeft(b)); setScreen("counter"); }}>
                  View Counter Offer →
                </button>
              )}
            </div>
          ))
        }
      </div>
    );

    if (sideTab === "history") return (
      <div style={{ padding:"20px 16px" }}>
        <div style={{ fontSize:11, color:"#475569", letterSpacing:"0.08em", textTransform:"uppercase", fontWeight:600, marginBottom:14 }}>History</div>
        {myHistory.length === 0
          ? <div style={{ fontSize:13, color:"#334155", textAlign:"center", padding:"32px 0" }}>No completed requests yet.</div>
          : myHistory.map(b => (
            <div key={b.id} style={{ background:"#0F172A", border:"1px solid #1E293B", borderRadius:10, padding:"14px", marginBottom:10 }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                <div>
                  <div style={{ fontWeight:700, fontSize:13 }}>{b.room.name}</div>
                  <div style={{ fontSize:11, color:"#475569", marginTop:1 }}>{b.hotel.name}</div>
                  <div style={{ fontSize:11, color:"#475569", marginTop:1 }}>📅 {shortDate(b.stayDate)}</div>
                </div>
                <div style={{ fontFamily:"Space Grotesk,sans-serif", fontWeight:700, fontSize:16, color:["accepted","handled"].includes(b.status)?"#22C55E":"#64748B" }}>${b.counterAmount ?? b.amount}</div>
              </div>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <Badge status={effectiveStatus(b)} />
                <span style={{ fontSize:11, color:"#334155" }}>Rack ${b.room.rack}</span>
              </div>
            </div>
          ))
        }
      </div>
    );

    return null; // browse and profile are rendered in renderMain
  }

  const panelTabs = ["live","history"];
  const showPanel = panelTabs.includes(sideTab);

  return (
    <div style={{ minHeight:"100vh", background:"#0A0F1E", color:"#F7F5F0", fontFamily:"Inter,sans-serif", display:"flex" }}>
      {counterToast && (
        <div style={{ ...S.toast, borderColor:"#A78BFA" }}>
          <span style={{ ...S.toastDot, background:"#A78BFA" }} />
          <div>
            <div style={{ fontWeight:600, fontSize:14 }}>Counter Offer Received</div>
            <div style={{ fontSize:12, color:"#94A3B8", marginTop:2 }}>The hotel sent a counter rate. Check Live Requests.</div>
          </div>
        </div>
      )}

      <div style={{ ...S.sidebar, width:200 }}>
        <div style={S.sidebarTop}>
          <div style={S.logo}>LK</div>
          {currentGuest
            ? <div style={{ marginTop:10 }}>
                <div style={{ fontWeight:700, fontSize:13, lineHeight:1.2 }}>{currentGuest.name}</div>
                <div style={{ fontSize:11, color:"#475569", marginTop:3 }}>
                  {currentGuest.rating > 0 ? `⭐ ${currentGuest.rating.toFixed(1)}` : "New member"} · {currentGuest.stays} stays
                </div>
              </div>
            : <div style={{ marginTop:10 }}>
                <div style={{ fontWeight:600, fontSize:13 }}>LastKey</div>
                <div style={{ fontSize:11, color:"#475569", marginTop:2 }}>Private rate requests</div>
              </div>
          }
        </div>

        <div style={S.sidebarNav}>
          {[
            { id:"browse",  label:"Browse Hotels" },
            { id:"live",    label:"Live Requests", count: myLive.length },
            { id:"history", label:"History",       count: myHistory.length },
            { id:"profile", label: currentGuest ? "My Profile" : "Sign In" },
          ].map(tab => (
            <button key={tab.id}
              style={{ ...S.navItem, ...(sideTab===tab.id && (showPanel || ["profile"].includes(tab.id) || screen==="listing") ? S.navActive : {}) }}
              onClick={() => { setSideTab(tab.id); if (!panelTabs.includes(tab.id)) setScreen(tab.id === "browse" ? "listing" : tab.id); }}>
              {tab.label}
              {tab.count > 0 && <span style={S.navBadge}>{tab.count}</span>}
            </button>
          ))}
        </div>

        {!currentGuest && (
          <button style={{ ...S.ghostBtn, margin:"0 0 8px", fontSize:12, padding:"9px 12px", textAlign:"center" }} onClick={()=>setScreen("login")}>
            Sign In / Join
          </button>
        )}
      </div>

      <div style={{ flex:1, overflowY:"auto", padding:"28px 28px 60px" }}>
        {showPanel ? renderSideContent() : renderMain()}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BOOKING CALENDAR (hotel history)
// ─────────────────────────────────────────────────────────────────────────────
const STATUS_COLOR = { pending:"#F59E0B", countered:"#A78BFA", accepted:"#22C55E", handled:"#22C55E", declined:"#EF4444", expired:"#64748B" };

function BookingCalendar({ bids, selectedDate, onSelect }) {
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
    <div style={{ background:"#0F172A", border:"1px solid #1E293B", borderRadius:14, padding:"16px 18px", marginBottom:18 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
        <button style={{ ...S.ghostBtn, padding:"6px 12px" }} onClick={()=>setView(new Date(year, month-1, 1))}>←</button>
        <div style={{ fontFamily:"Space Grotesk,sans-serif", fontWeight:700, fontSize:16 }}>{monthLabel}</div>
        <button style={{ ...S.ghostBtn, padding:"6px 12px" }} onClick={()=>setView(new Date(year, month+1, 1))}>→</button>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:6 }}>
        {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d,i)=>(
          <div key={i} style={{ textAlign:"center", fontSize:10, color:"#475569", fontWeight:600, letterSpacing:"0.05em" }}>{d}</div>
        ))}
        {cells.map((d,i) => {
          if (d == null) return <div key={"e"+i} />;
          const key = ymd(d);
          const dayBids = byDate[key] || [];
          const sel = key === selectedDate;
          const statuses = [...new Set(dayBids.map(b => effectiveStatus(b)))];
          return (
            <button key={key} onClick={()=>onSelect(key)}
              style={{ minHeight:62, borderRadius:8, border: sel?"1px solid #F59E0B":"1px solid #1E293B",
                background: sel?"#1E293B":"#0A0F1E", cursor:"pointer", padding:6, textAlign:"left",
                display:"flex", flexDirection:"column", gap:4 }}>
              <span style={{ fontSize:12, color: sel?"#F7F5F0":"#94A3B8" }}>{d}</span>
              {dayBids.length > 0 && (
                <>
                  <span style={{ fontFamily:"Space Grotesk,sans-serif", fontWeight:700, fontSize:13, color:"#F7F5F0" }}>{dayBids.length}</span>
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
          <span key={s} style={{ display:"flex", alignItems:"center", gap:5, fontSize:11, color:"#64748B" }}>
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
    { label:"Revenue Recovered",  value:revenue?`$${revenue}`:"$0",        sub:"vs $0 empty rooms",            color:"#22C55E" },
    { label:"Accept Rate",        value:`${acceptRate}%`,                   sub:`${accepted.length} of ${total} bids`, color:"#F59E0B" },
    { label:"Avg Accepted Bid",   value:avgAccepted?`$${avgAccepted}`:"—",  sub:`Avg all bids $${avgBid}`,      color:"#F7F5F0" },
    { label:"Bid-to-Rack Ratio",  value:`${avgBidToRack}%`,                 sub:"of rack rate captured",        color:"#A78BFA" },
    { label:"Discount vs Rack",   value:`${discountVsRack}%`,               sub:"below rack on accepted bids",  color:"#64748B" },
    { label:"Counter Offers Sent",value:countered.length,                   sub:"awaiting guest response",      color:"#F59E0B" },
    { label:"Total Requests",     value:total,                              sub:`${declined.length} declined · ${expired.length} expired`, color:"#F7F5F0" },
    { label:"Rooms Still Empty",  value:Math.max(0,totalRooms-accepted.length), sub:`out of ${totalRooms} available tonight`, color:totalRooms>0&&accepted.length>=totalRooms?"#22C55E":"#EF4444" },
  ];

  return (
    <div>
      {total === 0 && (
        <div style={{ ...S.emptyState, marginBottom:20 }}>
          <div style={{ color:"#475569", fontSize:13 }}>No requests on {dateLabel || "this day"}.</div>
        </div>
      )}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(195px, 1fr))", gap:12, marginBottom:28 }}>
        {kpis.map(k => (
          <div key={k.label} style={{ background:"#0F172A", border:"1px solid #1E293B", borderRadius:12, padding:"16px 18px" }}>
            <div style={{ fontSize:11, color:"#475569", letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:7 }}>{k.label}</div>
            <div style={{ fontFamily:"Space Grotesk,sans-serif", fontWeight:700, fontSize:26, color:k.color, lineHeight:1 }}>{k.value}</div>
            <div style={{ fontSize:12, color:"#334155", marginTop:6 }}>{k.sub}</div>
          </div>
        ))}
      </div>
      {total > 0 && (
        <div style={{ background:"#0F172A", border:"1px solid #1E293B", borderRadius:12, padding:"18px 20px" }}>
          <div style={{ fontSize:12, color:"#475569", marginBottom:14, textTransform:"uppercase", letterSpacing:"0.08em" }}>Bid Distribution</div>
          {bids.slice().reverse().map(b => (
            <div key={b.id} style={{ display:"flex", alignItems:"center", gap:12, marginBottom:8 }}>
              <div style={{ width:72, fontSize:12, color:"#475569", flexShrink:0 }}>{b.room.name.split(" ")[0]}</div>
              <div style={{ flex:1, background:"#1E293B", borderRadius:4, height:8, overflow:"hidden" }}>
                <div style={{ width:`${Math.min(100,(amt(b)/b.room.rack)*100)}%`, height:"100%", borderRadius:4,
                  background:["accepted","handled"].includes(b.status)?"#22C55E":b.status==="countered"?"#A78BFA":b.status==="pending"?"#F59E0B":"#EF4444" }} />
              </div>
              <div style={{ width:36, fontSize:12, fontWeight:700, color:"#F7F5F0", textAlign:"right" }}>${amt(b)}</div>
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
  const prevCount = useRef(0);

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
    const pendings = bids.filter(b => b.status === "pending");
    if (pendings.length > prevCount.current) {
      setNotification(bids[0]);
      setTimeout(() => setNotification(null), 5000);
    }
    prevCount.current = pendings.length;
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
    return <div style={{ ...S.dashWrap, alignItems:"center", justifyContent:"center", color:"#475569" }}>Loading…</div>;
  }
  if (!session || !hotel) {
    return (
      <div style={{ ...S.dashWrap, alignItems:"center", justifyContent:"center" }}>
        <div style={{ width:380, maxWidth:"90%" }}>
          <div style={{ display:"flex", justifyContent:"center", marginBottom:18 }}><div style={S.logo}>LK</div></div>
          {session && !hotel ? (
            <div style={S.emptyState}>
              <div style={{ fontWeight:700, marginBottom:8 }}>No hotel linked to this account</div>
              <div style={{ color:"#475569", fontSize:13, marginBottom:16 }}>This login isn&apos;t tied to a property yet. An admin must set <code>hotels.owner_user_id</code> to your user id.</div>
              <button style={S.ghostBtn} onClick={onSignOut}>Sign Out</button>
            </div>
          ) : (
            <PasswordLogin
              eyebrow="Hotel Dashboard"
              title="Hotel sign in"
              blurb="Sign in with your property's email and password. You'll see live rate requests for your hotel only."
              onSignedIn={() => {}}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={S.dashWrap}>
      {notification && (
        <div style={S.toast}>
          <span style={S.toastDot} />
          <div>
            <div style={{ fontWeight:600, fontSize:14 }}>New Rate Request</div>
            <div style={{ fontSize:12, color:"#94A3B8", marginTop:2 }}>
              ${notification.amount} on {notification.room?.name} — {notification.guest?.name} (⭐ {notification.guest?.rating||"New"})
            </div>
          </div>
        </div>
      )}

      <div style={S.sidebar}>
        <div style={S.sidebarTop}>
          <div style={S.logo}>LK</div>
          <div style={{ marginTop:10 }}>
            <div style={{ fontWeight:700, fontSize:13 }}>{hotel.name}</div>
            <div style={{ fontSize:11, color:"#475569", marginTop:2 }}>Hotel Dashboard</div>
          </div>
        </div>
        <div style={S.sidebarNav}>
          {[
            { id:"live",    label:"Live Requests", count:liveBids.length },
            { id:"history", label:"History",       count:histBids.length },
            { id:"kpi",     label:"KPIs & Analytics" },
            { id:"guests",  label:"Guest Profiles" },
            { id:"rooms",   label:"Room Settings" },
          ].map(tab => (
            <button key={tab.id} style={{ ...S.navItem, ...(activeTab===tab.id?S.navActive:{}) }} onClick={()=>setActiveTab(tab.id)}>
              {tab.label}
              {tab.count > 0 && <span style={S.navBadge}>{tab.count}</span>}
            </button>
          ))}
        </div>
        <div style={{ borderTop:"1px solid #1E293B", paddingTop:16, marginTop:"auto" }}>
          <div style={{ fontSize:11, color:"#475569", marginBottom:8, textTransform:"uppercase", letterSpacing:"0.06em" }}>Tonight</div>
          <div style={{ display:"flex", gap:14 }}>
            <div>
              <div style={{ fontFamily:"Space Grotesk,sans-serif", fontWeight:700, fontSize:20, color:"#F59E0B" }}>{accepted.length}</div>
              <div style={{ fontSize:10, color:"#475569" }}>Accepted</div>
            </div>
            <div>
              <div style={{ fontFamily:"Space Grotesk,sans-serif", fontWeight:700, fontSize:20, color:"#22C55E" }}>${accepted.reduce((s,b)=>s+(b.counterAmount??b.amount),0)}</div>
              <div style={{ fontSize:10, color:"#475569" }}>Revenue</div>
            </div>
          </div>
          <button style={{ ...S.ghostBtn, marginTop:14, fontSize:12, width:"100%", textAlign:"center" }} onClick={onSignOut}>Sign Out</button>
        </div>
      </div>

      <div style={S.dashMain}>

        {activeTab === "live" && (
          <div>
            <div style={S.dashSectionHead}>
              <h2 style={S.dashTitle}>Live Requests</h2>
              <span style={{ color:"#475569", fontSize:14 }}>Accept, decline, or send a counter offer. Bids below your floor auto-decline before they reach you.</span>
            </div>
            {liveBids.length === 0
              ? <div style={S.emptyState}>
                  <div style={{ fontSize:34, marginBottom:12 }}>⏳</div>
                  <div style={{ fontWeight:600, marginBottom:6 }}>No active requests</div>
                  <div style={{ color:"#475569", fontSize:13 }}>Bids from guests appear here in real time.</div>
                </div>
              : liveBids.map(bid => {
                  const t = Math.max(0, Math.round((new Date(bid.expiresAt).getTime() - now)/1000));
                  const room = rooms.find(r => r.id === bid.room.id);
                  const floor = room?.floor_price;
                  const aboveFloor = floor == null ? true : bid.amount >= floor;
                  const cv = counterInputs[bid.id] || "";
                  return (
                    <div key={bid.id} style={{ ...S.bidCard, borderColor:aboveFloor?"#22C55E22":"#EF444422", marginBottom:16 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:14 }}>
                        <div>
                          <div style={S.bidRoom}>{bid.room.name} <span style={{ color:"#475569", fontWeight:400, fontSize:14 }}>· {bid.room.type}</span></div>
                          <div style={{ fontSize:12, color:"#475569", marginTop:2 }}>Ref: {bid.id.slice(0,8)}</div>
                          <div style={{ display:"flex", gap:8, alignItems:"center", marginTop:8, flexWrap:"wrap" }}>
                            <Badge status="pending" />
                            {floor != null && (aboveFloor
                              ? <span style={{ fontSize:12, color:"#22C55E" }}>✓ Above floor (${floor})</span>
                              : <span style={{ fontSize:12, color:"#EF4444" }}>✕ Below floor (${floor})</span>)}
                          </div>
                        </div>
                        <div style={{ textAlign:"right" }}>
                          <div style={{ fontFamily:"Space Grotesk,sans-serif", fontWeight:700, fontSize:30, color:"#F59E0B" }}>${bid.amount}</div>
                          <div style={{ fontSize:12, color:"#475569" }}>Rack: ${bid.room.rack}</div>
                        </div>
                      </div>

                      {bid.guest && (
                        <div style={{ marginBottom:14 }}>
                          <button style={{ ...S.ghostBtn, fontSize:12, padding:"4px 10px", marginBottom:8 }}
                            onClick={()=>setExpandedGuest(expandedGuest===bid.id?null:bid.id)}>
                            {expandedGuest===bid.id?"Hide":"View"} Guest Profile
                          </button>
                          {expandedGuest===bid.id && <GuestProfileCard guest={bid.guest} compact />}
                        </div>
                      )}

                      <div style={{ display:"flex", alignItems:"center", gap:16, paddingTop:14, borderTop:"1px solid #1E293B", flexWrap:"wrap" }}>
                        <TimerRing seconds={t} size={80} />
                        <div style={{ flex:1, display:"flex", flexDirection:"column", gap:10, minWidth:200 }}>
                          <div style={{ display:"flex", gap:10 }}>
                            <button style={{ ...S.decideBtn, background:"#22C55E", color:"#052E16", flex:1 }} onClick={()=>onDecide(bid.id,"accepted")}>Accept ${bid.amount}</button>
                            <button style={{ ...S.decideBtn, background:"#1E293B", color:"#94A3B8", flex:1 }} onClick={()=>onDecide(bid.id,"declined")}>Decline</button>
                          </div>
                          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                            <span style={{ fontSize:12, color:"#64748B", flexShrink:0 }}>Counter at</span>
                            <div style={{ display:"flex", alignItems:"center", background:"#1E293B", borderRadius:7, padding:"0 10px", flex:1 }}>
                              <span style={{ color:"#64748B" }}>$</span>
                              <input type="number" placeholder="amount" value={cv}
                                onChange={e=>setCounterInputs(p=>({...p,[bid.id]:e.target.value}))}
                                style={{ background:"none", border:"none", outline:"none", color:"#F7F5F0", fontSize:15, fontWeight:600, fontFamily:"Space Grotesk,sans-serif", width:"100%", padding:"8px 6px" }} />
                            </div>
                            <button style={{ ...S.decideBtn, background:"#A78BFA", color:"#1E0A2E", padding:"10px 14px", flexShrink:0, opacity:!cv?0.4:1 }}
                              disabled={!cv}
                              onClick={()=>{ onCounter(bid.id, parseInt(cv)); setCounterInputs(p=>({...p,[bid.id]:""})); }}>
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
            <div style={S.dashSectionHead}>
              <h2 style={S.dashTitle}>History</h2>
              <span style={{ color:"#475569", fontSize:14 }}>Tap a day to see its requests. The selected day also drives KPIs.</span>
            </div>
            <BookingCalendar bids={bids} selectedDate={selectedDate} onSelect={setSelectedDate} />
            <div style={S.sectionLabel}>{shortDate(selectedDate)} · {dayBids.length} request{dayBids.length===1?"":"s"}</div>
            {dayBids.length === 0
              ? <div style={S.emptyState}><div style={{ color:"#475569", fontSize:13 }}>No requests on this day.</div></div>
              : <div style={{ background:"#0F172A", border:"1px solid #1E293B", borderRadius:14, overflow:"hidden" }}>
                  <div style={{ display:"grid", gridTemplateColumns:"2fr 1.5fr 0.8fr 0.8fr 1fr 1.2fr", padding:"12px 20px", background:"#0A0F1E", fontSize:11, color:"#475569", letterSpacing:"0.08em", textTransform:"uppercase", fontWeight:600 }}>
                    <span>Guest</span><span>Room</span><span>Bid</span><span>Rack</span><span>Rating</span><span>Status</span>
                  </div>
                  {dayBids.map(b => (
                    <div key={b.id} style={{ display:"grid", gridTemplateColumns:"2fr 1.5fr 0.8fr 0.8fr 1fr 1.2fr", padding:"14px 20px", borderTop:"1px solid #1E293B", alignItems:"center" }}>
                      <span>
                        <div style={{ fontWeight:600, fontSize:14 }}>{b.guest?.name||"Guest"}</div>
                        <div style={{ fontSize:11, color:"#475569" }}>{b.id.slice(0,8)}</div>
                      </span>
                      <span style={{ fontSize:13, color:"#94A3B8" }}>{b.room.name}</span>
                      <span style={{ fontWeight:700, color:["accepted","handled"].includes(b.status)?"#22C55E":"#F7F5F0" }}>${b.counterAmount ?? b.amount}</span>
                      <span style={{ fontSize:13, color:"#475569" }}>${b.room.rack}</span>
                      <span style={{ fontSize:13 }}>{b.guest?.rating?`${b.guest.rating} ★`:"New"}</span>
                      <span><Badge status={effectiveStatus(b)} /></span>
                    </div>
                  ))}
                </div>
            }
          </div>
        )}

        {activeTab === "kpi" && (
          <div>
            <div style={{ ...S.dashSectionHead, display:"flex", justifyContent:"space-between", alignItems:"flex-end", flexWrap:"wrap", gap:12 }}>
              <div>
                <h2 style={S.dashTitle}>KPIs &amp; Analytics</h2>
                <span style={{ color:"#475569", fontSize:14 }}>Figures for the selected day.</span>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <span style={{ fontSize:12, color:"#64748B" }}>Date</span>
                <input type="date" value={selectedDate} onChange={e=>setSelectedDate(e.target.value)}
                  style={{ ...S.field, width:"auto", padding:"8px 10px", colorScheme:"dark" }} />
              </div>
            </div>
            <KPIPanel bids={dayBids} totalRooms={rooms.length} dateLabel={shortDate(selectedDate)} />
          </div>
        )}

        {activeTab === "guests" && (
          <div>
            <div style={S.dashSectionHead}>
              <h2 style={S.dashTitle}>Guest Profiles</h2>
              <span style={{ color:"#475569", fontSize:14 }}>Ratings only — no names or demographics. Protects against discrimination claims.</span>
            </div>
            <div style={{ background:"#0F172A", border:"1px solid #1E293B", borderRadius:14, padding:"16px 20px", marginBottom:18 }}>
              <div style={{ fontSize:13, color:"#64748B", lineHeight:1.7 }}>
                <strong style={{ color:"#94A3B8" }}>How this works:</strong> Every guest builds a rating across all LastKey stays. When a bid arrives you see their star rating and stay count — nothing else. No name, no demographics, no photo. Bad actors get filtered by behavior, not appearance.
              </div>
            </div>
            {[...new Map(bids.filter(b=>b.guest).map(b=>[b.guest.email, b.guest])).values()].map(guest => (
              <div key={guest.email} style={{ background:"#0F172A", border:"1px solid #1E293B", borderRadius:12, padding:"16px 18px", marginBottom:10 }}>
                <div style={{ display:"flex", alignItems:"center", gap:14 }}>
                  <div style={{ width:46, height:46, borderRadius:"50%", background:"#1E3A5F", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"Space Grotesk,sans-serif", fontWeight:700, fontSize:17, color:"#F59E0B" }}>
                    {(guest.name||"?").split(" ").map(n=>n[0]).join("")}
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                      <span style={{ fontWeight:700 }}>{guest.name}</span>
                      {guest.verified && <span style={{ fontSize:10, background:"#052E16", color:"#22C55E", padding:"2px 6px", borderRadius:4, fontWeight:600 }}>✓ Verified</span>}
                    </div>
                    <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:4 }}>
                      <StarDisplay rating={guest.rating} />
                      <span style={{ fontSize:12, color:"#94A3B8" }}>{guest.rating>0?guest.rating.toFixed(1):"No rating"} · {guest.stays} stays</span>
                    </div>
                  </div>
                  <div style={{ fontSize:12, color:"#475569", textAlign:"right" }}>
                    {bids.filter(b=>b.guest?.email===guest.email).length} bid(s)
                  </div>
                </div>
              </div>
            ))}
            {bids.filter(b=>b.guest).length===0 && <div style={S.emptyState}><div style={{ color:"#475569", fontSize:13 }}>Guest profiles appear when bids are submitted.</div></div>}
          </div>
        )}

        {activeTab === "rooms" && (
          <div>
            <div style={{ ...S.dashSectionHead, display:"flex", justifyContent:"space-between", alignItems:"flex-end", flexWrap:"wrap", gap:12 }}>
              <div>
                <h2 style={S.dashTitle}>Room Settings</h2>
                <span style={{ color:"#475569", fontSize:14 }}>Manage inventory, rack rate, bid floor, and room types. Floors are never shown to guests.</span>
              </div>
              <button style={{ ...S.submitBtn, width:"auto", padding:"10px 16px" }} onClick={()=>setShowAdd(s=>!s)}>
                {showAdd ? "Close" : "+ Add Room Type"}
              </button>
            </div>

            {showAdd && (
              <div style={{ ...S.formCard, marginBottom:16 }}>
                <div style={S.formTitle}>New Room Type</div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(160px, 1fr))", gap:10, marginTop:10 }}>
                  <input style={S.field} placeholder="Name (e.g. King Room)" value={newRoom.name} onChange={e=>setNewRoom(p=>({...p,name:e.target.value}))} />
                  <input style={S.field} placeholder="Type (e.g. King · Standard)" value={newRoom.room_type} onChange={e=>setNewRoom(p=>({...p,room_type:e.target.value}))} />
                  <input style={S.field} type="number" placeholder="Rack rate $" value={newRoom.rack_rate} onChange={e=>setNewRoom(p=>({...p,rack_rate:e.target.value}))} />
                  <input style={S.field} type="number" placeholder="Bid floor $" value={newRoom.bid_floor} onChange={e=>setNewRoom(p=>({...p,bid_floor:e.target.value}))} />
                  <input style={S.field} type="number" placeholder="Inventory count" value={newRoom.inventory_count} onChange={e=>setNewRoom(p=>({...p,inventory_count:e.target.value}))} />
                  <input style={S.field} placeholder="Amenities (comma separated)" value={newRoom.amenities} onChange={e=>setNewRoom(p=>({...p,amenities:e.target.value}))} />
                </div>
                <button style={{ ...S.submitBtn, marginTop:14 }} onClick={onAddRoom}>Create Room Type</button>
              </div>
            )}

            {rooms.length === 0 && <div style={S.emptyState}><div style={{ color:"#475569", fontSize:13 }}>No room types yet. Add one above.</div></div>}

            {rooms.map(room => (
              <div key={room.id} style={{ background:"#0F172A", border:"1px solid #1E293B", borderRadius:14, padding:18, display:"flex", gap:16, alignItems:"center", marginBottom:14, flexWrap:"wrap" }}>
                <div style={{ width:120, flexShrink:0 }}><ImageOrIcon url={room.imageUrl} type={room.image} height={84} /></div>
                <div style={{ flex:1, minWidth:160 }}>
                  <div style={{ fontWeight:700, fontSize:16 }}>{room.name}</div>
                  <div style={{ fontSize:13, color:"#475569", marginTop:2 }}>{room.type}</div>
                  <div style={S.amenityRow}>{room.amenities.map(a=><span key={a} style={S.amenityTag}>{a}</span>)}</div>
                  <button style={{ ...S.ghostBtn, fontSize:12, padding:"5px 10px", marginTop:4, color:"#EF4444", borderColor:"#3B0000" }} onClick={()=>onRemoveRoom(room.id)}>Remove</button>
                </div>

                {/* Inventory */}
                <div style={{ minWidth:120, textAlign:"center" }}>
                  <div style={S.settingLabel}>Inventory</div>
                  <div style={{ display:"flex", alignItems:"center", gap:8, justifyContent:"center" }}>
                    <button style={S.stepBtn} onClick={()=>onInventory(room.id,-1)} disabled={(room.inventoryCount??0)<=0}>−</button>
                    <span style={{ fontFamily:"Space Grotesk,sans-serif", fontWeight:700, fontSize:22, minWidth:28 }}>{room.inventoryCount ?? 0}</span>
                    <button style={S.stepBtn} onClick={()=>onInventory(room.id,1)}>+</button>
                  </div>
                  <div style={{ fontSize:11, color:(room.inventoryCount??0)>0?"#22C55E":"#EF4444", marginTop:6 }}>{(room.inventoryCount??0)>0?"Available":"Sold out / hidden"}</div>
                </div>

                {/* Rack rate */}
                <div style={{ minWidth:130 }}>
                  <div style={S.settingLabel}>Rack Rate</div>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <span style={{ color:"#64748B" }}>$</span>
                    <input type="number" value={rackInputs[room.id] ?? room.rack}
                      onChange={e=>setRackInputs(p=>({...p,[room.id]:e.target.value}))}
                      style={S.settingInput} />
                    <button style={S.settingSet} onClick={()=>onSaveRack(room.id)}>Set</button>
                  </div>
                </div>

                {/* Bid floor */}
                <div style={{ minWidth:140 }}>
                  <div style={S.settingLabel}>Bid Floor (hidden)</div>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <span style={{ color:"#64748B" }}>$</span>
                    <input type="number" value={floorInputs[room.id] ?? (room.floor_price ?? "")}
                      onChange={e=>setFloorInputs(p=>({...p,[room.id]:e.target.value}))}
                      style={S.settingInput} />
                    <button style={S.settingSet} onClick={()=>onSetFloor(room.id)}>Set</button>
                  </div>
                  <div style={{ fontSize:11, color:"#22C55E", marginTop:6 }}>Active: ${room.floor_price ?? "—"}</div>
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
