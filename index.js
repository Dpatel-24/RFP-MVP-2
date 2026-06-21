import { useState, useEffect, useRef } from "react";
import Head from "next/head";

// ─────────────────────────────────────────────────────────────────────────────
// SEED DATA
// ─────────────────────────────────────────────────────────────────────────────
const TIMER_SECONDS = 600;
const COUNTER_TIMER = 300;

const HOTELS_DB = [
  {
    id: "h1",
    name: "The Maison Slidell",
    location: "Slidell, Louisiana",
    city: "New Orleans Area",
    tagline: "Historic boutique on the Northshore",
    rating: 4.7,
    reviewCount: 89,
    rooms: [
      { id: "101", name: "King Suite",       type: "King · Suite",         sqft: 480, floor: 3, rack: 189, amenities: ["City view","Soaking tub","Nespresso"],  image: "suite",    floor_price: 85 },
      { id: "204", name: "Queen Deluxe",     type: "Queen · Deluxe",       sqft: 320, floor: 2, rack: 139, amenities: ["Garden view","Work desk","Rain shower"],image: "deluxe",   floor_price: 65 },
      { id: "307", name: "Double Standard",  type: "Two Queens · Standard", sqft: 280, floor: 1, rack: 109, amenities: ["Pool view","Sleeps 4"],                 image: "standard", floor_price: 50 },
    ],
  },
  {
    id: "h2",
    name: "Canal Street Lofts",
    location: "New Orleans, Louisiana",
    city: "New Orleans Area",
    tagline: "Industrial-chic lofts in the French Quarter",
    rating: 4.5,
    reviewCount: 134,
    rooms: [
      { id: "L1", name: "Loft Studio",    type: "King · Loft",         sqft: 400, floor: 4, rack: 210, amenities: ["Balcony","Exposed brick","Kitchenette"], image: "suite",  floor_price: 95 },
      { id: "L2", name: "Courtyard Room", type: "Queen · Standard",    sqft: 260, floor: 2, rack: 149, amenities: ["Courtyard view","Clawfoot tub"],        image: "deluxe", floor_price: 70 },
    ],
  },
  {
    id: "h3",
    name: "Audubon Garden Inn",
    location: "Uptown, New Orleans",
    city: "New Orleans Area",
    tagline: "Quiet retreat near Audubon Park",
    rating: 4.8,
    reviewCount: 56,
    rooms: [
      { id: "A1", name: "Garden King", type: "King · Garden View", sqft: 350, floor: 1, rack: 175, amenities: ["Garden view","Hammock","Fireplace"], image: "deluxe", floor_price: 80 },
    ],
  },
];

const SEED_GUESTS = [
  { email: "marcus@example.com", name: "Marcus Webb", rating: 4.9, stays: 12, reviews: 11, memberSince: "2022", verified: true },
  { email: "sara@example.com",   name: "Sara Chen",   rating: 4.6, stays: 5,  reviews: 4,  memberSince: "2023", verified: true },
];

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function fmt(secs) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
function genId() { return Math.random().toString(36).slice(2, 8).toUpperCase(); }

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

function Badge({ status }) {
  const map = {
    pending:   { label:"Awaiting Response", color:"#F59E0B", bg:"#451A03" },
    countered: { label:"Counter Offered",   color:"#A78BFA", bg:"#2E1065" },
    accepted:  { label:"Accepted",          color:"#22C55E", bg:"#052E16" },
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
          {guest.name.split(" ").map(n=>n[0]).join("")}
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
function GuestView({ bids, onSubmitBid, guestProfiles, onGuestAuth, onRateHotel }) {
  const [screen, setScreen]               = useState("listing");
  const [sideTab, setSideTab]             = useState("browse");
  const [selectedHotel, setSelectedHotel] = useState(null);
  const [selectedRoom, setSelectedRoom]   = useState(null);
  const [bidAmount, setBidAmount]         = useState("");
  const [activeBid, setActiveBid]         = useState(null);
  const [timeLeft, setTimeLeft]           = useState(TIMER_SECONDS);
  const [counterTimeLeft, setCTL]         = useState(COUNTER_TIMER);
  const [currentGuest, setCurrentGuest]   = useState(null);
  const [loginEmail, setLoginEmail]       = useState("");
  const [loginName, setLoginName]         = useState("");
  const [ratingVal, setRatingVal]         = useState(0);
  const [ratingNote, setRatingNote]       = useState("");
  const [counterToast, setCounterToast]   = useState(false);
  const timerRef = useRef(null);

  const hotelsWithRooms = HOTELS_DB.filter(h => h.rooms.length > 0);
  const myBids     = currentGuest ? bids.filter(b => b.guest?.email === currentGuest.email) : [];
  const myLive     = myBids.filter(b => b.status === "pending" || b.status === "countered");
  const myHistory  = myBids.filter(b => b.status !== "pending" && b.status !== "countered");

  // ── Watch for status changes on active bid (NO screen guard) ──────────────
  useEffect(() => {
    if (!activeBid) return;
    const current = bids.find(b => b.id === activeBid.id);
    if (!current || current.status === activeBid.status) return;
    if (current.status === "pending") return;
    setActiveBid(current);
    clearInterval(timerRef.current);
    if (current.status === "countered") {
      setCTL(COUNTER_TIMER);
      setCounterToast(true);
      setTimeout(() => setCounterToast(false), 6000);
      setScreen("counter");
    } else {
      setScreen("result");
    }
  }, [bids]);

  // ── Main countdown ────────────────────────────────────────────────────────
  useEffect(() => {
    if (screen !== "waiting") return;
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(timerRef.current); setActiveBid(p => ({...p, status:"expired"})); setScreen("result"); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [screen]);

  // ── Counter countdown ─────────────────────────────────────────────────────
  useEffect(() => {
    if (screen !== "counter") return;
    timerRef.current = setInterval(() => {
      setCTL(t => {
        if (t <= 1) { clearInterval(timerRef.current); setActiveBid(p => ({...p, status:"expired"})); setScreen("result"); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [screen]);

  function handleLogin() {
    if (!loginEmail) return;
    const existing = guestProfiles.find(g => g.email === loginEmail) || SEED_GUESTS.find(g => g.email === loginEmail);
    if (existing) {
      setCurrentGuest(existing);
      onGuestAuth(existing);
      setScreen("listing"); setSideTab("browse");
    } else {
      if (!loginName) return;
      const ng = { email:loginEmail, name:loginName, rating:0, stays:0, reviews:0, memberSince:new Date().getFullYear().toString(), verified:false };
      onGuestAuth(ng);
      setCurrentGuest(ng);
      setScreen("listing"); setSideTab("browse");
    }
  }

  function handleBid() {
    if (!currentGuest) { setScreen("login"); return; }
    const amount = parseInt(bidAmount);
    if (!amount || amount < 1) return;
    const bid = { id:genId(), hotel:selectedHotel, room:selectedRoom, amount, guest:currentGuest, status:"pending", submittedAt:new Date().toISOString(), counterAmount:null };
    onSubmitBid(bid);
    setActiveBid(bid);
    setTimeLeft(TIMER_SECONDS);
    setScreen("waiting");
    setSideTab("live");
  }

  function handleAcceptCounter() {
    const current = bids.find(b => b.id === activeBid?.id) || activeBid;
    setActiveBid({ ...current, status:"accepted", amount:current.counterAmount });
    setScreen("result");
  }

  function handleDeclineCounter() {
    const current = bids.find(b => b.id === activeBid?.id) || activeBid;
    setActiveBid({ ...current, status:"declined" });
    setScreen("result");
  }

  function handleRateHotel() {
    onRateHotel({ bidId:activeBid?.id, hotelId:selectedHotel?.id, rating:ratingVal, note:ratingNote, guestEmail:currentGuest?.email });
    reset();
  }

  function reset() {
    setScreen("listing"); setSideTab("browse");
    setActiveBid(null); setBidAmount(""); setSelectedRoom(null); setSelectedHotel(null); setRatingVal(0); setRatingNote("");
  }

  // ── Main content area based on screen ────────────────────────────────────
  function renderMain() {
    if (screen === "listing") return <HotelListingView hotelsWithRooms={hotelsWithRooms} onSelectHotel={h => { setSelectedHotel(h); setScreen("hotel"); }} />;

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
              <RoomIcon type={room.image} />
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
        <div style={S.heroBox}>
          <div style={S.heroEyebrow}>Guest Profile</div>
          <h2 style={{ ...S.heroTitle, fontSize:24 }}>Sign in or create account</h2>
          <p style={S.heroSub}>Your star rating is visible to hotels when you bid. No other personal info is shared — like Uber's rider rating.</p>
        </div>
        <div style={S.formCard}>
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            <input style={S.field} placeholder="Email address" type="email" value={loginEmail} onChange={e=>setLoginEmail(e.target.value)} />
            {loginEmail && !SEED_GUESTS.find(g=>g.email===loginEmail) && (
              <input style={S.field} placeholder="Your name (new accounts)" value={loginName} onChange={e=>setLoginName(e.target.value)} />
            )}
          </div>
          <div style={{ marginTop:12, fontSize:12, color:"#475569", lineHeight:1.6 }}>
            Try <strong style={{color:"#94A3B8"}}>marcus@example.com</strong> or <strong style={{color:"#94A3B8"}}>sara@example.com</strong> as demo guests.
          </div>
          <button style={{ ...S.submitBtn, marginTop:14, opacity:!loginEmail?0.4:1 }} disabled={!loginEmail} onClick={handleLogin}>Continue</button>
        </div>
      </div>
    );

    if (screen === "bid") return (
      <div>
        <button style={S.backBtn} onClick={() => setScreen("hotel")}>← Back</button>
        {currentGuest && <div style={{ marginBottom:14 }}><GuestProfileCard guest={currentGuest} compact /></div>}
        <div style={{ marginBottom:14 }}>
          <RoomIcon type={selectedRoom.image} />
          <div style={{ marginTop:10 }}>
            <div style={S.roomName}>{selectedRoom.name}</div>
            <div style={S.roomType}>{selectedRoom.type} · {selectedRoom.sqft} sq ft</div>
          </div>
        </div>
        <div style={S.formCard}>
          <div style={S.formTitle}>Your Rate Request</div>
          <div style={S.formHint}>Rack rate is ${selectedRoom.rack}. The hotel will respond within 10 minutes.</div>
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
          <div style={S.terms}>If accepted, you'll receive a confirmation link to complete payment. Your card is not charged until accepted.</div>
          <button style={{ ...S.submitBtn, opacity:(!bidAmount||!currentGuest)?0.4:1 }} disabled={!bidAmount||!currentGuest} onClick={handleBid}>
            {currentGuest ? "Submit Rate Request" : "Sign In to Bid"}
          </button>
        </div>
      </div>
    );

    if (screen === "waiting") return (
      <div style={{ textAlign:"center", paddingTop:40 }}>
        <div style={{ display:"flex", justifyContent:"center", marginBottom:24 }}><TimerRing seconds={timeLeft} /></div>
        <h2 style={{ ...S.heroTitle, fontSize:22, marginBottom:10 }}>Request Sent</h2>
        <p style={{ color:"#64748B", maxWidth:300, margin:"0 auto", lineHeight:1.6 }}>
          <strong style={{ color:"#F7F5F0" }}>{selectedHotel?.name}</strong> is reviewing your ${activeBid?.amount} request for {activeBid?.room?.name}.
        </p>
        <div style={{ background:"#0F172A", border:"1px solid #1E293B", borderRadius:12, padding:"16px 20px", maxWidth:300, margin:"22px auto 0" }}>
          {[["Room", activeBid?.room?.name], ["Your bid","$"+activeBid?.amount], ["Ref", activeBid?.id]].map(([l,v]) => (
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
            {selectedHotel?.name || bid?.hotel?.name} can't do ${bid?.amount}, but they're offering a counter rate.
          </p>
          <div style={{ background:"#0F172A", border:"2px solid #A78BFA", borderRadius:14, padding:"24px", maxWidth:300, margin:"0 auto 20px" }}>
            <div style={{ fontSize:12, color:"#64748B", marginBottom:4 }}>Counter rate offered</div>
            <div style={{ fontFamily:"Space Grotesk,sans-serif", fontWeight:700, fontSize:52, color:"#A78BFA", lineHeight:1 }}>${bid?.counterAmount}</div>
            <div style={{ fontSize:12, color:"#475569", marginTop:6 }}>vs your bid of ${bid?.amount} · rack ${selectedRoom?.rack || bid?.room?.rack}</div>
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
      const accepted = bid?.status === "accepted";
      const expired  = bid?.status === "expired";
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
              ? `Your $${bid.amount} rate for ${bid.room?.name} was accepted. Check your email for the payment link.`
              : expired ? "The window closed. Try again — rooms may still be available."
              : "The hotel couldn't accept this rate. Try a different amount or room."}
          </p>
          {accepted && (
            <div style={{ maxWidth:300, margin:"24px auto 0" }}>
              <div style={{ fontSize:13, color:"#64748B", marginBottom:10 }}>Rate your experience:</div>
              <div style={{ display:"flex", justifyContent:"center", gap:8, marginBottom:12 }}>
                {[1,2,3,4,5].map(i => (
                  <button key={i} onClick={()=>setRatingVal(i)} style={{ fontSize:28, background:"none", border:"none", cursor:"pointer", opacity:i<=ratingVal?1:0.25, color:"#F59E0B" }}>★</button>
                ))}
              </div>
              <input style={{ ...S.field, fontSize:13, marginBottom:10 }} placeholder="Optional note..." value={ratingNote} onChange={e=>setRatingNote(e.target.value)} />
              <button style={{ ...S.submitBtn, background:"#1E293B", color:"#94A3B8", marginBottom:8 }} onClick={handleRateHotel}>Submit & Done</button>
            </div>
          )}
          <button style={{ ...S.ghostBtn, marginTop: accepted?0:24 }} onClick={reset}>
            {accepted ? "Skip" : "Browse Again"}
          </button>
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
              <button style={{ ...S.ghostBtn, marginTop:20 }} onClick={()=>{setCurrentGuest(null);setScreen("listing");setSideTab("browse");}}>Sign Out</button>
            </>
          : <div style={S.emptyState}>
              <div style={{ marginBottom:8, fontSize:15, fontWeight:600 }}>Not signed in</div>
              <button style={S.submitBtn} onClick={()=>setScreen("login")}>Sign In / Join</button>
            </div>
        }
      </div>
    );

    return <HotelListingView hotelsWithRooms={hotelsWithRooms} onSelectHotel={h=>{setSelectedHotel(h);setScreen("hotel");}} />;
  }

  // ── Live requests panel (sidebar tab content) ─────────────────────────────
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
                </div>
                <div style={{ fontFamily:"Space Grotesk,sans-serif", fontWeight:700, fontSize:18, color: b.status==="countered"?"#A78BFA":"#F59E0B" }}>${b.status==="countered"?b.counterAmount:b.amount}</div>
              </div>
              <Badge status={b.status} />
              {b.status === "countered" && (
                <button style={{ ...S.submitBtn, marginTop:10, padding:"9px 0", fontSize:13, background:"#A78BFA", color:"#1E0A2E" }}
                  onClick={()=>{ setActiveBid(b); setSelectedHotel(b.hotel); setSelectedRoom(b.room); setScreen("counter"); }}>
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
                </div>
                <div style={{ fontFamily:"Space Grotesk,sans-serif", fontWeight:700, fontSize:16, color:b.status==="accepted"?"#22C55E":"#64748B" }}>${b.amount}</div>
              </div>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <Badge status={b.status} />
                <span style={{ fontSize:11, color:"#334155" }}>Rack ${b.room.rack}</span>
              </div>
            </div>
          ))
        }
      </div>
    );

    return null; // browse and profile are rendered in renderMain
  }

  // Tabs that use the sidebar panel vs tabs that show main content
  const panelTabs = ["live","history"];
  const showPanel = panelTabs.includes(sideTab);

  return (
    <div style={{ minHeight:"100vh", background:"#0A0F1E", color:"#F7F5F0", fontFamily:"Inter,sans-serif", display:"flex" }}>
      {/* Counter toast — fires regardless of current screen */}
      {counterToast && (
        <div style={{ ...S.toast, borderColor:"#A78BFA" }}>
          <span style={{ ...S.toastDot, background:"#A78BFA" }} />
          <div>
            <div style={{ fontWeight:600, fontSize:14 }}>Counter Offer Received</div>
            <div style={{ fontSize:12, color:"#94A3B8", marginTop:2 }}>The hotel sent a counter rate. Check Live Requests.</div>
          </div>
        </div>
      )}

      {/* Guest Sidebar */}
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

      {/* Main content */}
      <div style={{ flex:1, overflowY:"auto", padding:"28px 28px 60px" }}>
        {showPanel ? renderSideContent() : renderMain()}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// KPI PANEL
// ─────────────────────────────────────────────────────────────────────────────
function KPIPanel({ bids }) {
  const accepted = bids.filter(b => b.status === "accepted");
  const declined = bids.filter(b => b.status === "declined");
  const expired  = bids.filter(b => b.status === "expired");
  const total    = bids.length;

  const revenue       = accepted.reduce((s,b) => s+b.amount, 0);
  const potentialRack = accepted.reduce((s,b) => s+b.room.rack, 0);
  const avgBid        = total > 0 ? Math.round(bids.reduce((s,b)=>s+b.amount,0)/total) : 0;
  const avgAccepted   = accepted.length > 0 ? Math.round(revenue/accepted.length) : 0;
  const acceptRate    = total > 0 ? Math.round((accepted.length/total)*100) : 0;
  const discountVsRack= potentialRack > 0 ? Math.round(((potentialRack-revenue)/potentialRack)*100) : 0;
  const avgBidToRack  = accepted.length > 0 ? Math.round((accepted.reduce((s,b)=>s+(b.amount/b.room.rack),0)/accepted.length)*100) : 0;
  const countered     = bids.filter(b=>b.status==="countered");

  const kpis = [
    { label:"Revenue Recovered",  value:revenue?`$${revenue}`:"$0",        sub:"vs $0 empty rooms",            color:"#22C55E" },
    { label:"Accept Rate",        value:`${acceptRate}%`,                   sub:`${accepted.length} of ${total} bids`, color:"#F59E0B" },
    { label:"Avg Accepted Bid",   value:avgAccepted?`$${avgAccepted}`:"—",  sub:`Avg all bids $${avgBid}`,      color:"#F7F5F0" },
    { label:"Bid-to-Rack Ratio",  value:`${avgBidToRack}%`,                 sub:"of rack rate captured",        color:"#A78BFA" },
    { label:"Discount vs Rack",   value:`${discountVsRack}%`,               sub:"below rack on accepted bids",  color:"#64748B" },
    { label:"Counter Offers Sent",value:countered.length,                   sub:"awaiting guest response",      color:"#F59E0B" },
    { label:"Total Requests",     value:total,                              sub:`${declined.length} declined · ${expired.length} expired`, color:"#F7F5F0" },
    { label:"Rooms Still Empty",  value:Math.max(0,3-accepted.length),      sub:"out of 3 available tonight",   color:accepted.length>=3?"#22C55E":"#EF4444" },
  ];

  return (
    <div>
      <div style={{ ...S.dashSectionHead, marginBottom:20 }}>
        <h2 style={S.dashTitle}>Tonight's KPIs</h2>
        <span style={{ color:"#475569", fontSize:14 }}>All figures reset nightly. Distressed inventory performance.</span>
      </div>
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
                <div style={{ width:`${Math.min(100,(b.amount/b.room.rack)*100)}%`, height:"100%", borderRadius:4,
                  background:b.status==="accepted"?"#22C55E":b.status==="countered"?"#A78BFA":b.status==="pending"?"#F59E0B":"#EF4444" }} />
              </div>
              <div style={{ width:36, fontSize:12, fontWeight:700, color:"#F7F5F0", textAlign:"right" }}>${b.amount}</div>
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
function HotelDashboard({ bids, onDecide, onCounter }) {
  const [activeTab, setActiveTab]       = useState("live");
  const [timers, setTimers]             = useState({});
  const [floors, setFloors]             = useState(HOTELS_DB[0].rooms.reduce((a,r)=>({...a,[r.id]:r.floor_price}),{}));
  const [floorInputs, setFloorInputs]   = useState(HOTELS_DB[0].rooms.reduce((a,r)=>({...a,[r.id]:r.floor_price}),{}));
  const [counterInputs, setCounterInputs] = useState({});
  const [notification, setNotification] = useState(null);
  const [expandedGuest, setExpandedGuest] = useState(null);
  const prevCount = useRef(0);

  useEffect(() => {
    const iv = setInterval(() => {
      setTimers(prev => {
        const next = { ...prev };
        let changed = false;
        bids.forEach(b => {
          if (b.status === "pending") {
            const elapsed = Math.floor((Date.now()-new Date(b.submittedAt).getTime())/1000);
            const rem = Math.max(0, TIMER_SECONDS - elapsed);
            if (next[b.id] !== rem) { next[b.id] = rem; changed = true; }
          }
        });
        return changed ? next : prev;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [bids]);

  useEffect(() => {
    if (bids.length > prevCount.current) {
      setNotification(bids[bids.length-1]);
      setTimeout(() => setNotification(null), 5000);
    }
    prevCount.current = bids.length;
  }, [bids]);

  const liveBids = bids.filter(b => b.status === "pending");
  const histBids = bids.filter(b => b.status !== "pending");
  const accepted = bids.filter(b => b.status === "accepted");

  return (
    <div style={S.dashWrap}>
      {notification && (
        <div style={S.toast}>
          <span style={S.toastDot} />
          <div>
            <div style={{ fontWeight:600, fontSize:14 }}>New Rate Request</div>
            <div style={{ fontSize:12, color:"#94A3B8", marginTop:2 }}>
              ${notification.amount} on {notification.room.name} — {notification.guest?.name} (⭐ {notification.guest?.rating||"New"})
            </div>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <div style={S.sidebar}>
        <div style={S.sidebarTop}>
          <div style={S.logo}>LK</div>
          <div style={{ marginTop:10 }}>
            <div style={{ fontWeight:700, fontSize:13 }}>The Maison Slidell</div>
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
              <div style={{ fontFamily:"Space Grotesk,sans-serif", fontWeight:700, fontSize:20, color:"#22C55E" }}>${accepted.reduce((s,b)=>s+b.amount,0)}</div>
              <div style={{ fontSize:10, color:"#475569" }}>Revenue</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main */}
      <div style={S.dashMain}>

        {activeTab === "live" && (
          <div>
            <div style={S.dashSectionHead}>
              <h2 style={S.dashTitle}>Live Requests</h2>
              <span style={{ color:"#475569", fontSize:14 }}>Accept, decline, or send a counter offer</span>
            </div>
            {liveBids.length === 0
              ? <div style={S.emptyState}>
                  <div style={{ fontSize:34, marginBottom:12 }}>⏳</div>
                  <div style={{ fontWeight:600, marginBottom:6 }}>No active requests</div>
                  <div style={{ color:"#475569", fontSize:13 }}>Bids from guests appear here in real time.</div>
                </div>
              : liveBids.map(bid => {
                  const t = timers[bid.id] ?? TIMER_SECONDS;
                  const floor = floors[bid.room.id] ?? 0;
                  const aboveFloor = bid.amount >= floor;
                  const cv = counterInputs[bid.id] || "";
                  return (
                    <div key={bid.id} style={{ ...S.bidCard, borderColor:aboveFloor?"#22C55E22":"#EF444422", marginBottom:16 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:14 }}>
                        <div>
                          <div style={S.bidRoom}>{bid.room.name} <span style={{ color:"#475569", fontWeight:400, fontSize:14 }}>· {bid.room.type}</span></div>
                          <div style={{ fontSize:12, color:"#475569", marginTop:2 }}>Ref: {bid.id}</div>
                          <div style={{ display:"flex", gap:8, alignItems:"center", marginTop:8, flexWrap:"wrap" }}>
                            <Badge status="pending" />
                            {aboveFloor
                              ? <span style={{ fontSize:12, color:"#22C55E" }}>✓ Above floor (${floor})</span>
                              : <span style={{ fontSize:12, color:"#EF4444" }}>✕ Below floor (${floor})</span>}
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
            <div style={S.dashSectionHead}><h2 style={S.dashTitle}>Request History</h2></div>
            {histBids.length === 0
              ? <div style={S.emptyState}><div style={{ color:"#475569", fontSize:13 }}>No completed requests yet.</div></div>
              : <div style={{ background:"#0F172A", border:"1px solid #1E293B", borderRadius:14, overflow:"hidden" }}>
                  <div style={{ display:"grid", gridTemplateColumns:"2fr 1.5fr 0.8fr 0.8fr 1fr 1.2fr", padding:"12px 20px", background:"#0A0F1E", fontSize:11, color:"#475569", letterSpacing:"0.08em", textTransform:"uppercase", fontWeight:600 }}>
                    <span>Guest</span><span>Room</span><span>Bid</span><span>Rack</span><span>Rating</span><span>Status</span>
                  </div>
                  {histBids.map(b => (
                    <div key={b.id} style={{ display:"grid", gridTemplateColumns:"2fr 1.5fr 0.8fr 0.8fr 1fr 1.2fr", padding:"14px 20px", borderTop:"1px solid #1E293B", alignItems:"center" }}>
                      <span>
                        <div style={{ fontWeight:600, fontSize:14 }}>{b.guest?.name||"Guest"}</div>
                        <div style={{ fontSize:11, color:"#475569" }}>{b.id}</div>
                      </span>
                      <span style={{ fontSize:13, color:"#94A3B8" }}>{b.room.name}</span>
                      <span style={{ fontWeight:700, color:b.status==="accepted"?"#22C55E":"#F7F5F0" }}>${b.amount}</span>
                      <span style={{ fontSize:13, color:"#475569" }}>${b.room.rack}</span>
                      <span style={{ fontSize:13 }}>{b.guest?.rating?`${b.guest.rating} ★`:"New"}</span>
                      <span><Badge status={b.status} /></span>
                    </div>
                  ))}
                </div>
            }
          </div>
        )}

        {activeTab === "kpi" && <KPIPanel bids={bids} />}

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
                    {guest.name.split(" ").map(n=>n[0]).join("")}
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
            <div style={S.dashSectionHead}>
              <h2 style={S.dashTitle}>Room & Bid Floor Settings</h2>
              <span style={{ color:"#475569", fontSize:14 }}>Floors are never shown to guests. Bids below floor auto-decline instantly.</span>
            </div>
            {HOTELS_DB[0].rooms.map(room => (
              <div key={room.id} style={{ background:"#0F172A", border:"1px solid #1E293B", borderRadius:14, padding:20, display:"flex", gap:16, alignItems:"center", marginBottom:14 }}>
                <div style={{ width:110, flexShrink:0 }}><RoomIcon type={room.image} /></div>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:700, fontSize:16 }}>{room.name}</div>
                  <div style={{ fontSize:13, color:"#475569", marginTop:2 }}>{room.type} · Rack: ${room.rack}</div>
                  <div style={S.amenityRow}>{room.amenities.map(a=><span key={a} style={S.amenityTag}>{a}</span>)}</div>
                </div>
                <div style={{ minWidth:140 }}>
                  <div style={{ fontSize:11, color:"#64748B", marginBottom:6, textTransform:"uppercase", letterSpacing:"0.06em" }}>Bid Floor</div>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <span style={{ color:"#64748B" }}>$</span>
                    <input type="number" value={floorInputs[room.id]}
                      onChange={e=>setFloorInputs(p=>({...p,[room.id]:e.target.value}))}
                      style={{ width:68, background:"#1E293B", border:"1px solid #2D3F55", borderRadius:6, padding:"7px 10px", color:"#F7F5F0", fontSize:17, fontWeight:700, fontFamily:"Space Grotesk,sans-serif", outline:"none", textAlign:"center" }} />
                    <button style={{ padding:"9px 12px", background:"#F59E0B", color:"#0A0F1E", border:"none", borderRadius:6, fontWeight:700, fontSize:12, fontFamily:"Inter,sans-serif", cursor:"pointer" }}
                      onClick={()=>setFloors(p=>({...p,[room.id]:parseInt(floorInputs[room.id])}))}>
                      Set
                    </button>
                  </div>
                  <div style={{ fontSize:12, color:"#22C55E", marginTop:7 }}>Active: ${floors[room.id]}</div>
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
  const [view, setView]                   = useState("guest");
  const [bids, setBids]                   = useState([]);
  const [guestProfiles, setGuestProfiles] = useState(SEED_GUESTS);
  const [hotelRatings, setHotelRatings]   = useState([]);

  function handleSubmitBid(bid) {
    setBids(prev => [...prev, bid]);
    setTimeout(() => {
      setBids(prev => prev.map(b => {
        if (b.id !== bid.id || b.status !== "pending") return b;
        const hotel = HOTELS_DB.find(h=>h.id===bid.hotel.id);
        const room  = hotel?.rooms.find(r=>r.id===bid.room.id);
        if (b.amount < (room?.floor_price ?? 0)) return { ...b, status:"declined" };
        return b;
      }));
    }, 800);
  }

  function handleDecide(id, status) {
    setBids(prev => prev.map(b => b.id===id ? {...b, status} : b));
  }

  function handleCounter(id, counterAmount) {
    setBids(prev => prev.map(b => b.id===id ? {...b, status:"countered", counterAmount} : b));
  }

  function handleGuestAuth(guest) {
    setGuestProfiles(prev => prev.find(g=>g.email===guest.email) ? prev : [...prev, guest]);
  }

  const liveBidCount = bids.filter(b=>b.status==="pending").length;

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
        <button style={{ ...S.toggleBtn, ...(view==="hotel"?S.toggleActive:{}), position:"relative" }} onClick={()=>setView("hotel")}>
          Hotel Dashboard
          {liveBidCount > 0 && <span style={{ position:"absolute", top:-6, right:-6, background:"#EF4444", color:"#fff", fontSize:10, fontWeight:700, width:18, height:18, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center" }}>{liveBidCount}</span>}
        </button>
      </div>

      {view==="guest"
        ? <GuestView bids={bids} onSubmitBid={handleSubmitBid} guestProfiles={guestProfiles} onGuestAuth={handleGuestAuth} onRateHotel={r=>setHotelRatings(p=>[...p,r])} />
        : <HotelDashboard bids={bids} onDecide={handleDecide} onCounter={handleCounter} />}
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
  toast:          { position:"fixed", top:24, left:"50%", transform:"translateX(-50%)", background:"#0F172A", border:"1px solid #22C55E", borderRadius:12, padding:"14px 18px", display:"flex", gap:12, alignItems:"flex-start", zIndex:2000, boxShadow:"0 8px 32px rgba(0,0,0,0.5)", fontFamily:"Inter,sans-serif", color:"#F7F5F0", minWidth:280 },
  toastDot:       { width:8, height:8, borderRadius:"50%", background:"#22C55E", marginTop:4, flexShrink:0, animation:"pulse 1.5s infinite" },
};
