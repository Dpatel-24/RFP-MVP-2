import { useState, useEffect, useRef, useCallback } from "react";
import Head from "next/head";
import * as api from "../lib/api";
import { TIMER_SECONDS, COUNTER_TIMER, TAX_RATE, effectiveStatus, secondsLeft, getTodayKey } from "../lib/api";
import {
  shortDate, stayWindow, useWindowWidth, MOBILE_BREAKPOINT,
  TimerRing, ImageOrIcon, Badge, StarDisplay, GuestProfileCard, PasswordLogin,
  BookingCalendar, SL,
} from "../lib/components";
import { GoogleReviews } from "../lib/GoogleReviews"; // [GOOGLE-REVIEWS TEST]

// ── Geolocation ──────────────────────────────────────────────────────────────
// Active: homepage calls /api/geolocate and shows the visitor's detected
// city/region. Hotel inventory only filters to that city on an exact match;
// otherwise all pilot hotels stay visible (no empty state) — but the detected
// city is still surfaced in the copy so it's visibly working even when there's
// no pilot inventory there yet. See the effect in GuestView.
const GEOLOCATION_ENABLED = true;
const PILOT_CITY_COPY = "Now live in Slidell, LA";

// Fallback copy when geolocation finds no hotel match for the visitor's city —
// lists whatever pilot cities the loaded hotels actually have, and names the
// detected city/region if we have one so the IP lookup is visibly working.
function pilotCitiesCopy(hotels, detected) {
  const cities = [...new Set(hotels.map(h => h.city).filter(Boolean))];
  const base = cities.length ? `Now live in: ${cities.join(", ")}` : PILOT_CITY_COPY;
  return detected ? `${base} (you're browsing from ${detected})` : base;
}

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

const HERO_FALLBACK = "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=1600&q=80";
const PROPERTY_TABS = ["Rooms", "Flats", "Hostels", "Villas"];
function HotelListingView({ onSelectHotel, hotelsWithRooms, locationCopy }) {
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
          <p style={{ fontSize:16, color:"rgba(255,255,255,0.9)", margin:"0 auto 8px", maxWidth:520, lineHeight:1.5 }}>
            Name your rate at hotels with unsold rooms tonight. A private response in 10 minutes.
          </p>
          <p style={{ fontSize:13, fontWeight:600, color:"#F59E0B", margin:"0 auto 20px", letterSpacing:"0.02em" }}>
            {locationCopy}
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
                    <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(hotel.name + ' ' + hotel.location)}`}
                      target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()}
                      style={{ display:"inline-block", fontSize:13, color:"#6B7280", marginTop:3, textDecoration:"none", cursor:"pointer" }}
                      onMouseEnter={e=>{ e.currentTarget.style.textDecoration="underline"; }}
                      onMouseLeave={e=>{ e.currentTarget.style.textDecoration="none"; }}>
                      📍 {hotel.location}
                    </a>
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
    </div>
  );
}

// Booking.com-style top header for guest-facing pages. Replaces the old
// left sidebar; collapses the right-side links into a hamburger dropdown
// below the mobile breakpoint instead of a slide-out panel.
function GuestHeader({ currentGuest, sideTab, selectTab, setScreen, handleSignOut, liveCount, savedCount, isMobile }) {
  const [acctOpen, setAcctOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const navTabs = [
    { id:"browse", label:"Browse" },
    { id:"live",   label:"Live Requests", count: liveCount },
    { id:"saved",  label:"Saved", count: savedCount },
  ];

  function go(id) { selectTab(id); setAcctOpen(false); setMenuOpen(false); }

  return (
    <header style={SL.headerBar}>
      <div style={SL.headerInner}>
        <div style={{ display:"flex", alignItems:"center", gap:10, cursor:"pointer" }} onClick={() => go("browse")}>
          <div style={SL.logo}>LK</div>
          <div style={{ fontWeight:700, fontSize:15, color:SL.ink, fontFamily:"Space Grotesk,sans-serif" }}>LastKey</div>
        </div>

        {!isMobile && (
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            {currentGuest ? (
              <>
                {navTabs.map(t => (
                  <button key={t.id} style={{ ...SL.headerNavBtn, ...(sideTab===t.id ? SL.headerNavActive : {}) }} onClick={() => go(t.id)}>
                    {t.label}{t.count > 0 ? ` (${t.count})` : ""}
                  </button>
                ))}
                <div style={{ position:"relative" }}>
                  <button style={SL.headerAccountBtn} onClick={() => setAcctOpen(o=>!o)}>
                    {currentGuest.name || "Account"}
                  </button>
                  {acctOpen && (
                    <div style={SL.headerDropdown} onMouseLeave={() => setAcctOpen(false)}>
                      <button style={SL.headerDropdownItem} onClick={() => go("history")}>History</button>
                      <button style={SL.headerDropdownItem} onClick={() => go("profile")}>My Profile</button>
                      <button style={SL.headerDropdownItem} onClick={() => { setAcctOpen(false); handleSignOut(); }}>Sign out</button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <a href="/for-hotels" style={SL.headerLink}>List your property</a>
                <button style={SL.headerLink} onClick={() => setScreen("login")}>Register</button>
                <button style={SL.headerBtnPrimary} onClick={() => setScreen("login")}>Sign in</button>
              </>
            )}
          </div>
        )}

        {isMobile && (
          <button style={SL.hamburgerBtn} onClick={() => setMenuOpen(o=>!o)} aria-label="Menu">☰</button>
        )}
      </div>

      {isMobile && menuOpen && (
        <div style={SL.mobileMenuPanel}>
          {currentGuest ? (
            <>
              {navTabs.map(t => (
                <button key={t.id} style={{ ...SL.mobileMenuItem, color: sideTab===t.id ? "#B45309" : "#374151" }} onClick={() => go(t.id)}>
                  {t.label}{t.count > 0 ? ` (${t.count})` : ""}
                </button>
              ))}
              <div style={{ borderTop:`1px solid ${SL.line}`, margin:"4px 6px" }} />
              <button style={SL.mobileMenuItem} onClick={() => go("history")}>History</button>
              <button style={SL.mobileMenuItem} onClick={() => go("profile")}>My Profile ({currentGuest.name})</button>
              <button style={SL.mobileMenuItem} onClick={() => { setMenuOpen(false); handleSignOut(); }}>Sign out</button>
            </>
          ) : (
            <>
              <a href="/for-hotels" style={SL.mobileMenuItem}>List your property</a>
              <button style={SL.mobileMenuItem} onClick={() => { setMenuOpen(false); setScreen("login"); }}>Register</button>
              <button style={SL.mobileMenuItem} onClick={() => { setMenuOpen(false); setScreen("login"); }}>Sign in</button>
            </>
          )}
        </div>
      )}
    </header>
  );
}

// Persistent footer for guest-facing screens (not /hotel). Stacks on mobile
// using the same MOBILE_BREAKPOINT as the header.
function GuestFooter({ isMobile }) {
  return (
    <footer style={SL.footerBar}>
      <div style={{ ...SL.footerInner, flexDirection: isMobile ? "column" : "row" }}>
        <div style={SL.footerBrand}>
          <div style={SL.logo}>LK</div>
          <div>
            <div style={{ fontWeight:700, fontSize:13, color:SL.ink }}>LastKey</div>
            <div style={{ fontSize:11, color:SL.faint, marginTop:1 }}>Private rate requests · tonight only</div>
          </div>
        </div>
        <div style={{ ...SL.footerLinks, flexDirection: isMobile ? "column" : "row" }}>
          <a href="/privacy" style={SL.footerLink}>Privacy Policy</a>
          <a href="/terms" style={SL.footerLink}>Terms of Service</a>
          <a href="/hotel" style={SL.footerLink}>Hotel Partner Login</a>
        </div>
      </div>
    </footer>
  );
}

function GuestView() {
  const [screen, setScreen]               = useState("listing");
  const [sideTab, setSideTab]             = useState("browse");
  const [hotels, setHotels]               = useState([]);
  const [geoHotels, setGeoHotels]         = useState(null); // non-null only once a geolocation city match is found
  const [locationCopy, setLocationCopy]   = useState(PILOT_CITY_COPY);
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
  const [guestDate, setGuestDate]         = useState(getTodayKey());
  const [agreeTerms, setAgreeTerms]       = useState(false);
  const [now, setNow]                     = useState(Date.now());
  const [savedHotelIds, setSavedHotelIds] = useState(new Set()); // hotel_ids the guest has saved
  const [hotelAccount, setHotelAccount]   = useState(null); // set when the signed-in user owns a hotel
  const timerRef = useRef(null);
  const bootedUid = useRef(undefined); // last user id we booted for — dedupes token-refresh/focus re-fires

  const width = useWindowWidth();
  const isMobile = width < MOBILE_BREAKPOINT;
  // Mobile content wrappers: full width, tighter 16px gutters, room for bottom nav.
  const wrap     = isMobile ? { ...SL.wrap,     maxWidth:"100%", padding:"20px 16px 28px" } : SL.wrap;
  const wrapWide = isMobile ? { ...SL.wrapWide, maxWidth:"100%", padding:"16px 16px 28px" } : SL.wrapWide;

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

  // ── Geolocation ──────────────────────────────────────────────────────────
  // When enabled: look up the visitor's city server-side via /api/geolocate,
  // then try to match it against loaded hotels. The detected city is always
  // surfaced in the copy (even on no match, via pilotCitiesCopy's second arg)
  // so the lookup is visibly doing something instead of looking identical to
  // the static pilot copy. Any failure falls back silently — never an error
  // shown to the guest.
  useEffect(() => {
    if (!GEOLOCATION_ENABLED || hotels.length === 0) return;
    let cancelled = false;
    fetch("/api/geolocate")
      .then(r => r.json())
      .then(({ city, region }) => {
        if (cancelled) return;
        if (!city) { setLocationCopy(pilotCitiesCopy(hotels)); return; }
        const detected = region ? `${city}, ${region}` : city;
        const match = hotels.filter(h => (h.city || "").toLowerCase() === city.toLowerCase());
        if (match.length > 0) {
          setGeoHotels(match);
          setLocationCopy(`Now live in: ${detected}`);
        } else {
          setLocationCopy(pilotCitiesCopy(hotels, detected));
        }
      })
      .catch(() => { if (!cancelled) setLocationCopy(pilotCitiesCopy(hotels)); });
    return () => { cancelled = true; };
  }, [hotels]);

  const displayedHotels = geoHotels || hotels;

  // ── Restore session + subscribe to my requests ────────────────────────────
  useEffect(() => {
    let unsub = null;
    async function boot(session) {
      const uid = session?.user?.id || null;
      // Ignore repeat auth events for the same user (TOKEN_REFRESHED, tab focus,
      // re-fired SIGNED_IN) — re-booting on those re-fetches the profile and
      // flickers the account UI. Only act when the signed-in user actually changes.
      if (uid === bootedUid.current) return;
      bootedUid.current = uid;
      if (!session) { setCurrentGuest(null); setBids([]); setSavedHotelIds(new Set()); setHotelAccount(null); return; }
      // Role separation: if this account owns a hotel, it is NOT a guest. Don't
      // create a guest profile or load guest data — show the hotel-account guard.
      let ownedHotel = null;
      try { ownedHotel = await api.getOwnerHotel(session.user.id); } catch (e) { console.error(e); }
      if (ownedHotel) {
        if (unsub) { unsub(); unsub = null; }
        setHotelAccount(ownedHotel);
        setCurrentGuest(null); setBids([]); setSavedHotelIds(new Set());
        return;
      }
      setHotelAccount(null);
      const profile = await api.ensureGuestProfile(session.user, session.user.email?.split("@")[0]);
      if (profile) profile.email = session.user.email;
      setCurrentGuest(profile);
      refreshBids(profile);
      api.getSavedHotels(session.user.id).then(ids => setSavedHotelIds(new Set(ids))).catch(console.error);
      if (unsub) unsub();
      unsub = api.subscribeRequests("guest_id", session.user.id, () => refreshBids(profile));
    }
    api.getSession().then(boot);
    const { data: sub } = api.onAuthChange(boot);
    return () => { if (unsub) unsub(); sub?.subscription?.unsubscribe(); };
  }, []); // run once on mount; boot re-fetches per user via the dedupe guard above // eslint-disable-line react-hooks/exhaustive-deps

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

  // ── Keep the guest's stay count live (derived from accepted/handled bids) ───
  // Mirrors getGuestStats so the counter updates the moment a bid is accepted,
  // without re-fetching the profile.
  useEffect(() => {
    setCurrentGuest(g => {
      if (!g) return g;
      const stays = bids.filter(b => ["accepted", "handled"].includes(b.status)).length;
      return stays === g.stays ? g : { ...g, stays };
    });
  }, [bids]);

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
    setCurrentGuest(null); setBids([]); setSavedHotelIds(new Set()); setHotelAccount(null); setScreen("listing"); setSideTab("browse");
  }

  function reset() {
    setScreen("listing"); setSideTab("browse");
    setActiveBid(null); setBidAmount(""); setSelectedRoom(null); setSelectedHotel(null);
  }

  // ── Save / unsave a hotel (optimistic, reverts on failure) ─────────────────
  async function toggleSave(hotel) {
    if (!currentGuest) { setScreen("login"); return; }
    const isSaved = savedHotelIds.has(hotel.id);
    setSavedHotelIds(prev => {
      const next = new Set(prev);
      if (isSaved) next.delete(hotel.id); else next.add(hotel.id);
      return next;
    });
    try {
      if (isSaved) await api.unsaveHotel(currentGuest.id, hotel.id);
      else await api.saveHotel(currentGuest.id, hotel.id);
    } catch (e) {
      console.error(e);
      setSavedHotelIds(prev => { // revert
        const next = new Set(prev);
        if (isSaved) next.add(hotel.id); else next.delete(hotel.id);
        return next;
      });
    }
  }

  // ── Main content area based on screen ──────────────────────────────────────
  function renderMain() {
    if (screen === "listing") return <HotelListingView hotelsWithRooms={displayedHotels} locationCopy={locationCopy} onSelectHotel={h => { setSelectedHotel(h); setScreen("hotel"); }} />;

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
      <div style={wrapWide}>
        <button style={SL.backBtn} onClick={() => setScreen("listing")}>← All Hotels</button>

        {/* Top titles */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:12, marginBottom:14, flexWrap:"wrap" }}>
          <div>
            <h1 style={{ ...SL.h1, fontSize:26 }}>{selectedHotel.name}</h1>
            <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedHotel.name + ' ' + selectedHotel.location)}`}
              target="_blank" rel="noopener noreferrer"
              style={{ display:"inline-block", fontSize:14, color:SL.sub, marginTop:5, textDecoration:"none", cursor:"pointer" }}
              onMouseEnter={e=>{ e.currentTarget.style.textDecoration="underline"; }}
              onMouseLeave={e=>{ e.currentTarget.style.textDecoration="none"; }}>
              📍 {selectedHotel.location}
            </a>
            <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:8 }}>
              <StarDisplay rating={selectedHotel.rating} />
              <span style={{ fontSize:13, color:SL.sub }}>{selectedHotel.rating} ({selectedHotel.reviewCount} reviews)</span>
            </div>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <span style={{ ...SL.ghostBtn, opacity:0.6 }}>↗ Share</span>
            <button
              style={{ ...SL.ghostBtn, cursor:"pointer", color: savedHotelIds.has(selectedHotel.id) ? "#B45309" : "#374151", borderColor: savedHotelIds.has(selectedHotel.id) ? "#FCD34D" : "#D1D5DB" }}
              onClick={() => toggleSave(selectedHotel)}>
              {savedHotelIds.has(selectedHotel.id) ? "♥ Saved" : "♡ Save"}
            </button>
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
                {/* [GOOGLE-REVIEWS TEST] read-only Google reviews; renders null when none */}
                <GoogleReviews placeId={selectedHotel.googlePlaceId} />
              </div>
            </div>
          </div>

          {/* Right: sticky summary */}
          <aside style={{ flex:"0 0 300px", position:"sticky", top:24, alignSelf:"flex-start" }}>
            <div style={{ ...SL.panel, padding:18 }}>
              <div style={{ fontSize:11, color:SL.faint, textTransform:"uppercase", letterSpacing:"0.08em", fontWeight:700 }}>Your stay</div>
              <div style={{ fontFamily:"Space Grotesk,sans-serif", fontWeight:700, fontSize:17, marginTop:6 }}>Tonight</div>
              <div style={{ fontSize:13, color:SL.sub, marginTop:2 }}>{stayWindow(getTodayKey())}</div>
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
      <div style={{ ...wrap, maxWidth:480 }}>
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
      <div style={{ ...wrap, maxWidth:560 }}>
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
          <div style={{ fontSize:12, color:SL.sub, marginBottom:14 }}>📅 Tonight · {stayWindow(getTodayKey())}</div>
          <div style={{ display:"flex", alignItems:"baseline", gap:8, borderBottom:"2px solid #F59E0B", paddingBottom:12, marginBottom:18 }}>
            <span style={{ fontFamily:"Space Grotesk,sans-serif", fontSize:26, fontWeight:700, color:"#F59E0B" }}>$</span>
            <input type="number" placeholder="0" value={bidAmount} onChange={e=>setBidAmount(e.target.value)} min="1"
              style={{ flex:1, border:"none", outline:"none", fontFamily:"Space Grotesk,sans-serif", fontSize:isMobile?28:42, fontWeight:700, color:"#1A1F2B", width:"100%", background:"transparent" }} />
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
        <div style={{ ...wrap, maxWidth:560 }}>
          <button style={SL.backBtn} onClick={() => setScreen("bid")}>← Edit request</button>
          <h1 style={{ ...SL.h1, fontSize:24, marginBottom:4 }}>Review &amp; confirm</h1>
          <p style={{ color:SL.sub, fontSize:14, margin:"0 0 18px" }}>Confirm your rate request. No card is charged — you pay the hotel directly if accepted.</p>

          {/* Selected room summary */}
          <div style={{ ...SL.panel, padding:14, display:"flex", gap:12, alignItems:"center", marginBottom:14 }}>
            <div style={{ width:84, flexShrink:0 }}><ImageOrIcon url={selectedRoom?.imageUrl} type={selectedRoom?.image} height={64} radius={10} /></div>
            <div>
              <div style={{ fontWeight:700, fontSize:15 }}>{selectedRoom?.name}</div>
              <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((selectedHotel?.name || '') + ' ' + (selectedHotel?.location || ''))}`}
                target="_blank" rel="noopener noreferrer"
                style={{ display:"inline-block", fontSize:12, color:SL.sub, marginTop:2, textDecoration:"none", cursor:"pointer" }}
                onMouseEnter={e=>{ e.currentTarget.style.textDecoration="underline"; }}
                onMouseLeave={e=>{ e.currentTarget.style.textDecoration="none"; }}>
                {selectedHotel?.name}
              </a>
              <div style={{ fontSize:12, color:SL.sub, marginTop:2 }}>📅 {stayWindow(getTodayKey())}</div>
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
      <div style={{ ...wrap, maxWidth:560, textAlign:"center", paddingTop:48 }}>
        <div style={{ display:"flex", justifyContent:"center", marginBottom:24 }}><TimerRing seconds={timeLeft} size={isMobile?120:160} /></div>
        <h2 style={{ ...SL.h1, fontSize:22, marginBottom:10 }}>Request Sent</h2>
        <p style={{ color:SL.sub, maxWidth:320, margin:"0 auto", lineHeight:1.6 }}>
          <strong style={{ color:SL.ink }}>{activeBid?.hotel?.name}</strong> is reviewing your ${activeBid?.amount} request for {activeBid?.room?.name}.
        </p>
        <div style={{ ...SL.panel, padding:"16px 20px", maxWidth:320, margin:"22px auto 0", textAlign:"left" }}>
          {[["Room", activeBid?.room?.name], ["Stay", stayWindow(activeBid?.stayDate || getTodayKey())], ["Your bid","$"+activeBid?.amount], ["Ref", activeBid?.id?.slice(0,8)]].map(([l,v]) => (
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
        <div style={{ ...wrap, maxWidth:560, textAlign:"center", paddingTop:36 }}>
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
      const declined = status === "declined";
      return (
        <div style={{ ...wrap, maxWidth:560, textAlign:"center", paddingTop:48 }}>
          <div style={{ width:72, height:72, borderRadius:"50%", background:"#F3F4F6", display:"flex", alignItems:"center", justifyContent:"center", fontSize:30, margin:"0 auto" }}>
            {accepted?"✓":expired?"⏱":"✕"}
          </div>
          <h2 style={{ ...SL.h1, fontSize:26, marginTop:18, color:accepted?"#059669":expired?"#6B7280":"#DC2626" }}>
            {accepted?"You're in.":expired?"Time's up.":"Not this time."}
          </h2>
          <p style={{ color:SL.sub, maxWidth:340, margin:"10px auto 0", lineHeight:1.7 }}>
            {accepted
              ? `Your $${bid?.counterAmount ?? bid?.amount} rate for ${bid?.room?.name} was accepted (${stayWindow(bid?.stayDate || getTodayKey())}). Show your confirmation code at check-in.`
              : expired ? "The window closed. Try again — rooms may still be available."
              : "The hotel couldn't accept this rate. Try a different amount or room."}
          </p>
          {accepted && bid?.confirmationCode && (
            <div style={{ maxWidth:320, margin:"22px auto 0", background:"#ECFDF5", border:"1px solid #A7F3D0", borderRadius:12, padding:"16px 20px" }}>
              <div style={{ fontSize:11, color:"#059669", letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:6, fontWeight:700 }}>Confirmation Code</div>
              <div style={{ fontFamily:"Space Grotesk,sans-serif", fontWeight:700, fontSize:30, color:"#047857", letterSpacing:"0.15em" }}>{bid.confirmationCode}</div>
            </div>
          )}
          {declined && (
            <>
              <p style={{ color:SL.faint, maxWidth:340, margin:"14px auto 0", lineHeight:1.6, fontSize:13 }}>
                Tip: bids closer to the listed rate are more likely to be accepted. Try offering a higher amount or browse other available rooms.
              </p>
              <div style={{ display:"flex", gap:10, maxWidth:340, margin:"22px auto 0" }}>
                <button style={{ ...SL.primaryBtn, flex:1 }} onClick={() => { setBidAmount(""); setScreen("bid"); }}>
                  Try a new bid
                </button>
                <button style={{ ...SL.ghostBtn, flex:1 }} onClick={reset}>
                  Browse other hotels
                </button>
              </div>
            </>
          )}
          {!declined && <button style={{ ...SL.ghostBtn, marginTop:24 }} onClick={reset}>Browse Again</button>}
        </div>
      );
    }

    // profile tab
    if (sideTab === "profile") return (
      <div style={{ ...wrap, maxWidth:560 }}>
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

    return <HotelListingView hotelsWithRooms={displayedHotels} locationCopy={locationCopy} onSelectHotel={h=>{setSelectedHotel(h);setScreen("hotel");}} />;
  }

  // ── Live requests panel (sidebar tab content) ──────────────────────────────
  function renderSideContent() {
    if (sideTab === "live") return (
      <div style={{ ...wrap, maxWidth:640 }}>
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
        <div style={{ ...wrap, maxWidth:760 }}>
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

    if (sideTab === "saved") {
      const savedList = hotels.filter(h => savedHotelIds.has(h.id));
      return (
        <div style={{ ...wrap, maxWidth:760 }}>
          <h1 style={{ ...SL.h1, marginBottom:18 }}>Saved Hotels</h1>
          {savedList.length === 0
            ? <div style={{ ...SL.panel, padding:"36px 24px", textAlign:"center", color:SL.sub, fontSize:14 }}>No saved hotels yet. Browse and tap ♡ to save one.</div>
            : <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                {savedList.map(h => {
                  const fromPrice = Math.min(...h.rooms.map(r=>r.rack));
                  return (
                    <div key={h.id} style={{ ...SL.card, cursor:"pointer", display:"flex", flexWrap:"wrap" }}
                      onClick={() => { setSelectedHotel(h); setSideTab("browse"); setScreen("hotel"); }}>
                      <div style={{ width:160, flexShrink:0 }}>
                        <img src={h.heroImage || HERO_FALLBACK} alt="" loading="lazy" style={{ width:"100%", height:120, objectFit:"cover", display:"block" }} />
                      </div>
                      <div style={{ flex:1, minWidth:200, padding:"14px 16px" }}>
                        <div style={{ fontFamily:"Space Grotesk,sans-serif", fontWeight:700, fontSize:16 }}>{h.name}</div>
                        <div style={{ fontSize:13, color:SL.sub, marginTop:3 }}>📍 {h.location}</div>
                        <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:8 }}>
                          <StarDisplay rating={h.rating} />
                          <span style={{ fontSize:12, color:SL.sub }}>{h.rating} ({h.reviewCount} reviews)</span>
                        </div>
                        <div style={{ fontSize:13, color:SL.price, fontWeight:700, marginTop:8 }}>from ${fromPrice}/night</div>
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

  const panelTabs = ["live","history","saved"];
  const showPanel = panelTabs.includes(sideTab);

  // Shared tab selection used by both the desktop sidebar and the mobile nav.
  const selectTab = (id) => { setSideTab(id); if (!panelTabs.includes(id)) setScreen(id === "browse" ? "listing" : id); };

  // Role guard: a hotel-owner account is not a guest. Keep the two identities
  // separate instead of creating a guest profile for a hotel login.
  if (hotelAccount) {
    return (
      <div style={{ ...SL.page, display:"block", overflowY:"auto" }}>
        <div style={{ maxWidth:440, margin:"0 auto", padding:"80px 24px", textAlign:"center" }}>
          <div style={{ ...SL.logo, margin:"0 auto 18px" }}>LK</div>
          <h1 style={{ ...SL.h1, fontSize:24, marginBottom:10 }}>You&apos;re signed in as a hotel</h1>
          <p style={{ color:SL.sub, fontSize:14, lineHeight:1.6, margin:"0 0 22px" }}>
            This account manages <strong style={{ color:SL.ink }}>{hotelAccount.name}</strong>. Hotels and guests use
            separate logins — open your dashboard to review rate requests, or sign out to browse as a guest.
          </p>
          <a href="/hotel" style={{ ...SL.primaryBtn, textDecoration:"none", maxWidth:280, margin:"0 auto", textAlign:"center" }}>
            Go to Hotel Dashboard →
          </a>
          <button style={{ ...SL.ghostBtn, marginTop:12 }} onClick={handleSignOut}>Sign out</button>
        </div>
        <GuestFooter isMobile={isMobile} />
      </div>
    );
  }

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

      <GuestHeader
        currentGuest={currentGuest}
        sideTab={sideTab}
        selectTab={selectTab}
        setScreen={setScreen}
        handleSignOut={handleSignOut}
        liveCount={myLive.length}
        savedCount={savedHotelIds.size}
        isMobile={isMobile}
      />

      <div style={SL.content}>
        {showPanel ? renderSideContent() : renderMain()}
      </div>

      <GuestFooter isMobile={isMobile} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE  (/) — guest experience only
// ─────────────────────────────────────────────────────────────────────────────
export default function GuestPage() {
  return (
    <>
      <Head>
        <title>LastKey — Private Rate Requests</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="true" />
        <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <GuestView />
    </>
  );
}
