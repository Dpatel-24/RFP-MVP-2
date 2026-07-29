import { useState, useEffect, useRef, useCallback } from "react";
import Head from "next/head";
import * as api from "../lib/api";
import { effectiveStatus, getTodayKey } from "../lib/api";
import {
  shortDate, useWindowWidth, MOBILE_BREAKPOINT, BOTTOM_NAV_HEIGHT,
  TimerRing, ImageOrIcon, Badge, StarDisplay, GuestProfileCard, PasswordLogin,
  BookingCalendar, MobileBottomNav, SL,
} from "../lib/components";
import { color } from "../lib/tokens";

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
    { label:"Revenue Recovered",  value:revenue?`$${revenue}`:"$0",        sub:"vs $0 empty rooms",            color:color.success },
    { label:"Accept Rate",        value:`${acceptRate}%`,                   sub:`${accepted.length} of ${total} bids`, color:color.brandText },
    { label:"Avg Accepted Bid",   value:avgAccepted?`$${avgAccepted}`:"—",  sub:`Avg all bids $${avgBid}`,      color:color.ink },
    { label:"Bid-to-Rack Ratio",  value:`${avgBidToRack}%`,                 sub:"of rack rate captured",        color:color.counter },
    { label:"Discount vs Rack",   value:`${discountVsRack}%`,               sub:"below rack on accepted bids",  color:color.muted },
    { label:"Counter Offers Sent",value:countered.length,                   sub:"awaiting guest response",      color:color.brandText },
    { label:"Total Requests",     value:total,                              sub:`${declined.length} declined · ${expired.length} expired`, color:color.ink },
    { label:"Rooms Still Empty",  value:Math.max(0,totalRooms-accepted.length), sub:`out of ${totalRooms} available tonight`, color:totalRooms>0&&accepted.length>=totalRooms?color.success:color.danger },
  ];

  // Consolidate the day's bids by room type: count, avg bid, acceptance rate.
  // Missing/null room_type falls under "Other". Sorted by bid count desc.
  const byRoomType = Object.values(
    bids.reduce((acc, b) => {
      const key = b.room?.type || "Other";
      acc[key] = acc[key] || { type: key, count: 0, bidSum: 0, accepted: 0 };
      acc[key].count += 1;
      acc[key].bidSum += b.amount;
      if (["accepted","handled"].includes(b.status)) acc[key].accepted += 1;
      return acc;
    }, {})
  )
    .map(g => ({ type: g.type, count: g.count, avgBid: Math.round(g.bidSum / g.count), acceptRate: Math.round((g.accepted / g.count) * 100) }))
    .sort((a, b) => b.count - a.count);

  return (
    <div>
      {total === 0 && (
        <div style={{ ...SL.emptyState, marginBottom:20 }}>
          <div style={{ color:color.muted, fontSize:13 }}>No requests on {dateLabel || "this day"}.</div>
        </div>
      )}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(195px, 1fr))", gap:12, marginBottom:28 }}>
        {kpis.map(k => (
          <div key={k.label} style={{ ...SL.panel, padding:"16px 18px" }}>
            <div style={{ fontSize:11, color:color.faint, letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:7, fontWeight:600 }}>{k.label}</div>
            <div style={{ fontFamily:"Space Grotesk,sans-serif", fontWeight:700, fontSize:26, color:k.color, lineHeight:1 }}>{k.value}</div>
            <div style={{ fontSize:12, color:color.muted, marginTop:6 }}>{k.sub}</div>
          </div>
        ))}
      </div>
      {total > 0 && (
        <div style={{ ...SL.panel, padding:"18px 20px" }}>
          <div style={{ fontSize:12, color:color.faint, marginBottom:14, textTransform:"uppercase", letterSpacing:"0.08em", fontWeight:600 }}>Bids by Room Type</div>
          <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr 1fr", gap:12, fontSize:11, color:color.faint, fontWeight:600, textTransform:"uppercase", letterSpacing:"0.04em", paddingBottom:8, borderBottom:`1px solid ${color.line}` }}>
            <span>Room Type</span>
            <span style={{ textAlign:"right" }}>Bids</span>
            <span style={{ textAlign:"right" }}>Avg Bid</span>
            <span style={{ textAlign:"right" }}>Accepted</span>
          </div>
          {byRoomType.map(g => (
            <div key={g.type} style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr 1fr", gap:12, alignItems:"center", padding:"10px 0", borderBottom:`1px solid ${color.surfaceAlt}` }}>
              <span style={{ fontSize:13, fontWeight:600, color:color.ink }}>{g.type}</span>
              <span style={{ fontSize:13, color:color.ink, textAlign:"right", fontFamily:"Space Grotesk,sans-serif", fontWeight:700 }}>{g.count}</span>
              <span style={{ fontSize:13, color:color.ink, textAlign:"right", fontFamily:"Space Grotesk,sans-serif", fontWeight:700 }}>${g.avgBid}</span>
              <span style={{ fontSize:13, color:color.success, textAlign:"right", fontFamily:"Space Grotesk,sans-serif", fontWeight:700 }}>{g.acceptRate}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

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
  const [uploadingRoom, setUploadingRoom] = useState(null);
  const [guestStats, setGuestStats] = useState({}); // guest_id -> { rating, stays, verified } trust signals
  const [selectedDate, setSelectedDate] = useState(getTodayKey());
  const [showAdd, setShowAdd]           = useState(false);
  const [infoInputs, setInfoInputs]     = useState({}); // { deposit, phone } — informational hotel fields
  const [infoSaved, setInfoSaved]       = useState(false);
  const [newRoom, setNewRoom]           = useState({ name:"", room_type:"", rack_rate:"", bid_floor:"", inventory_count:"1", amenities:"" });
  const prevCount = useRef(null); // null until first bids load — avoids a false toast on mount
  const bootedUid = useRef(undefined); // last user id booted — dedupes token-refresh/focus re-fires

  const width = useWindowWidth();
  const isMobile = width < MOBILE_BREAKPOINT;

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
      const uid = s?.user?.id || null;
      // Ignore repeat auth events for the same user (token refresh / tab focus) so
      // the dashboard doesn't re-fetch and flicker.
      if (uid === bootedUid.current) return;
      bootedUid.current = uid;
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
  }, []); // run once on mount; boot dedupes per user // eslint-disable-line react-hooks/exhaustive-deps

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

  // ── Fetch guest trust signals (rating + stays) per bid, cached by guest_id ──
  // bid.guest.email carries the guest_id (set in getHotelRequests). Only fetch
  // ids we haven't cached yet, so this never refetches the same guest.
  useEffect(() => {
    const ids = [...new Set(bids.map(b => b.guest?.email).filter(Boolean))];
    const missing = ids.filter(id => !(id in guestStats));
    if (missing.length === 0) return;
    let cancelled = false;
    Promise.all(missing.map(id => api.fetchGuestProfile(id).then(p => [id, p]).catch(() => [id, null])))
      .then(entries => {
        if (cancelled) return;
        setGuestStats(prev => {
          const next = { ...prev };
          for (const [id, p] of entries) if (p) next[id] = p;
          return next;
        });
      });
    return () => { cancelled = true; };
  }, [bids]); // eslint-disable-line react-hooks/exhaustive-deps

  async function onDecide(id, status) {
    try { await api.hotelDecide(id, status); refreshBids(); if (status === "accepted") reloadRooms(); }
    // Surface the server's message (e.g. the response window lapsed) instead of
    // a generic failure — the guard lives in trg_enforce_response_window.
    catch (e) { console.error(e); alert(e?.message || "Action failed."); refreshBids(); }
  }

  // Accepting is always permitted, but overselling requires an explicit
  // acknowledgement: inventory is the hotel's to manage, not ours to block.
  async function onAccept(bid, group) {
    if (group.inventory === 0) {
      const ok = typeof window === "undefined" || window.confirm(
        `${group.roomName} shows 0 rooms left. Accepting this $${bid.amount} bid will oversell it.\n\nAccept anyway?`
      );
      if (!ok) return;
    }
    await onDecide(bid.id, "accepted");
  }

  async function onCounter(id, amount) {
    try { await api.hotelCounter(id, amount); refreshBids(); }
    catch (e) { console.error(e); alert(e?.message || "Counter failed."); refreshBids(); }
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
  // Informational hotel fields (deposit hold + phone). Display-only — these
  // never touch bids, revenue, or the KPI tab.
  async function onSaveHotelInfo() {
    const deposit = Math.max(0, Number(infoInputs.deposit ?? hotel.depositAmount) || 0);
    const phone = (infoInputs.phone ?? hotel.phone ?? "").trim() || null;
    try {
      await api.updateHotelInfo(hotel.id, { deposit_amount: deposit, phone });
      setHotel(h => ({ ...h, depositAmount: deposit, phone }));
      setInfoInputs({});
      setInfoSaved(true);
      setTimeout(() => setInfoSaved(false), 2500);
    } catch (e) { console.error(e); alert("Could not update hotel info."); }
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
  async function onUploadPhoto(roomId, file) {
    if (!file) return;
    setUploadingRoom(roomId);
    try {
      const url = await api.uploadRoomImage(roomId, hotel.id, file);
      setRooms(prev => prev.map(r => r.id===roomId ? { ...r, imageUrl:url } : r));
    } catch (e) { console.error(e); alert("Could not upload photo."); }
    finally { setUploadingRoom(null); }
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

  // Group live bids by room so competing offers on the same room sit together
  // and the highest is obvious. Rooms are already in state — join in memory.
  const bidGroups = Object.values(
    liveBids.reduce((acc, b) => {
      const id = b.room?.id || "unknown";
      if (!acc[id]) {
        const room = rooms.find(r => r.id === id);
        acc[id] = {
          roomId: id,
          roomName: b.room?.name || "Room",
          roomType: b.room?.type || "",
          // null = inventory unknown (rooms not loaded yet, or the room was
          // removed). Only a known 0 may trigger the oversell warning —
          // otherwise every group would falsely read SOLD OUT on first paint.
          inventory: room ? (room.inventoryCount ?? 0) : null,
          floor: room?.floor_price,
          bids: [],
        };
      }
      acc[id].bids.push(b);
      return acc;
    }, {})
  )
    .map(g => ({ ...g, bids: g.bids.sort((a, b) => b.amount - a.amount) }))
    // Sold-out rooms first (they need a decision), then most contested.
    .sort((a, b) => (b.inventory === 0) - (a.inventory === 0) || b.bids.length - a.bids.length);

  // Rooms that are sold out but still receiving bids — the hotel needs to know.
  const soldOutWithBids = bidGroups.filter(g => g.inventory === 0);

  const accepted = bids.filter(b => ["accepted","handled"].includes(b.status));
  // "Tonight" stats are scoped to the current 6 AM-boundary booking day.
  const todayKey = getTodayKey();
  const todayAccepted = accepted.filter(b => b.stayDate === todayKey);
  const todayRevenue = todayAccepted.reduce((s,b) => s + (b.counterAmount ?? b.amount), 0);

  // ── Auth gate ──────────────────────────────────────────────────────────────
  if (session === undefined) {
    return <div style={{ ...SL.dashWrap, alignItems:"center", justifyContent:"center", color:color.muted }}>Loading…</div>;
  }
  if (!session || !hotel) {
    return (
      <div style={{ ...SL.dashWrap, alignItems:"center", justifyContent:"center" }}>
        <div style={{ width:380, maxWidth:"90%" }}>
          <div style={{ display:"flex", justifyContent:"center", marginBottom:18 }}><div style={SL.logo}>LK</div></div>
          {session && !hotel ? (
            <div style={SL.emptyState}>
              <div style={{ fontWeight:700, marginBottom:8, color:color.ink }}>No hotel linked to this account</div>
              <div style={{ color:color.muted, fontSize:13, marginBottom:16 }}>This login isn&apos;t tied to a property yet. If you&apos;re a guest, browse the guest site instead; otherwise an admin must set <code>hotels.owner_user_id</code> to your user id.</div>
              <div style={{ display:"flex", gap:10, justifyContent:"center", flexWrap:"wrap" }}>
                <a href="/" style={{ ...SL.ghostBtn, textDecoration:"none" }}>← Browse as a guest</a>
                <button style={SL.ghostBtn} onClick={onSignOut}>Sign Out</button>
              </div>
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
    <div style={isMobile ? { ...SL.dashWrap, display:"block" } : SL.dashWrap}>
      {notification && (
        <div style={SL.toast}>
          <span style={SL.toastDot} />
          <div>
            <div style={{ fontWeight:700, fontSize:14, color:color.ink }}>New Rate Request</div>
            <div style={{ fontSize:12, color:color.muted, marginTop:2 }}>
              ${notification.amount} on {notification.room?.name} — {notification.guest?.name} (⭐ {notification.guest?.rating||"New"})
            </div>
          </div>
        </div>
      )}

      {!isMobile && (
      <div style={SL.sidebar}>
        <div style={SL.sidebarTop}>
          <div style={SL.logo}>LK</div>
          <div style={{ marginTop:10 }}>
            <div style={{ fontWeight:700, fontSize:13, color:color.ink }}>{hotel.name}</div>
            <div style={{ fontSize:11, color:color.faint, marginTop:2 }}>Hotel Dashboard</div>
          </div>
        </div>
        <div style={SL.sidebarNav}>
          {[
            { id:"live",    label:"Live Requests", count:liveBids.length },
            { id:"history", label:"Reservations",  count:liveBids.length },
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
        <div style={{ borderTop:`1px solid ${color.line}`, paddingTop:16, marginTop:"auto" }}>
          <div style={{ fontSize:11, color:color.faint, marginBottom:8, textTransform:"uppercase", letterSpacing:"0.06em", fontWeight:700 }}>Tonight</div>
          <div style={{ display:"flex", gap:14 }}>
            <div>
              <div style={{ fontFamily:"Space Grotesk,sans-serif", fontWeight:700, fontSize:20, color:color.brandText }}>{todayAccepted.length}</div>
              <div style={{ fontSize:10, color:color.faint }}>Accepted</div>
            </div>
            <div>
              <div style={{ fontFamily:"Space Grotesk,sans-serif", fontWeight:700, fontSize:20, color:color.success }}>${todayRevenue}</div>
              <div style={{ fontSize:10, color:color.faint }}>Revenue</div>
            </div>
          </div>
          <button style={{ ...SL.ghostBtn, marginTop:14, fontSize:12, width:"100%", textAlign:"center" }} onClick={onSignOut}>Sign Out</button>
        </div>
      </div>
      )}

      <div style={isMobile ? { ...SL.dashMain, height:"100%", padding:`56px 16px ${BOTTOM_NAV_HEIGHT + 20}px` } : SL.dashMain}>

        {isMobile && (
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18 }}>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <div style={SL.logo}>LK</div>
              <div>
                <div style={{ fontWeight:700, fontSize:13, color:color.ink }}>{hotel.name}</div>
                <div style={{ fontSize:11, color:color.faint }}>{todayAccepted.length} accepted · ${todayRevenue} tonight</div>
              </div>
            </div>
            <button style={{ ...SL.ghostBtn, fontSize:12, padding:"7px 12px" }} onClick={onSignOut}>Sign Out</button>
          </div>
        )}

        {activeTab === "live" && (
          <div>
            <div style={SL.dashSectionHead}>
              <h2 style={SL.dashTitle}>Live Requests</h2>
              <span style={{ color:color.muted, fontSize:14 }}>Accept, decline, or send a counter offer. Bids below your floor auto-decline before they reach you.</span>
            </div>

            {/* Sold-out notification: rooms at 0 inventory that are still
                receiving bids. The hotel decides whether to oversell. */}
            {soldOutWithBids.length > 0 && (
              <div style={{ background:color.dangerSoft, border:`1px solid ${color.danger}`, borderRadius:10, padding:"12px 16px", marginBottom:18 }}>
                <div style={{ fontWeight:700, fontSize:14, color:color.danger, marginBottom:4 }}>
                  Inventory is at zero on {soldOutWithBids.length} room type{soldOutWithBids.length === 1 ? "" : "s"} with open bids
                </div>
                <div style={{ fontSize:13, color:color.ink, lineHeight:1.6 }}>
                  {soldOutWithBids.map(g => `${g.roomName} (${g.bids.length} bid${g.bids.length === 1 ? "" : "s"})`).join(", ")}
                  {" — "}accepting will oversell. Update inventory in Room Settings, or accept the bid you want anyway.
                </div>
              </div>
            )}
            {liveBids.length === 0
              ? <div style={SL.emptyState}>
                  <div style={{ fontSize:34, marginBottom:12 }}>⏳</div>
                  <div style={{ fontWeight:700, marginBottom:6, color:color.ink }}>No active requests</div>
                  <div style={{ color:color.muted, fontSize:13 }}>Bids from guests appear here in real time.</div>
                </div>
              : bidGroups.map(group => (
                <div key={group.roomId} style={{ marginBottom:28 }}>
                  {/* Room header — inventory + competing-bid count. When a room
                      is sold out the hotel is warned but can still override. */}
                  <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap", marginBottom:10,
                    padding:"10px 14px", borderRadius:8,
                    background: group.inventory === 0 ? color.dangerSoft : color.surfaceAlt,
                    border: `1px solid ${group.inventory === 0 ? color.danger : color.line}` }}>
                    <span style={{ fontFamily:"Space Grotesk,sans-serif", fontWeight:700, fontSize:15, color:color.ink }}>
                      {group.roomName}
                    </span>
                    <span style={{ fontSize:13, fontWeight:600, color: group.inventory === 0 ? color.danger : group.inventory == null ? color.muted : color.success }}>
                      {group.inventory === 0
                        ? "SOLD OUT — accepting will oversell"
                        : group.inventory == null
                          ? "inventory unavailable"
                          : `${group.inventory} room${group.inventory === 1 ? "" : "s"} left`}
                    </span>
                    <span style={{ fontSize:13, color:color.muted }}>
                      · {group.bids.length} {group.bids.length === 1 ? "bid" : "competing bids"}
                      {group.bids.length > 1 && ` · highest $${group.bids[0].amount}`}
                    </span>
                  </div>
                  {group.bids.map((bid, bidIdx) => {
                  const isTopBid = group.bids.length > 1 && bidIdx === 0;
                  const t = Math.max(0, Math.round((new Date(bid.expiresAt).getTime() - now)/1000));
                  const room = rooms.find(r => r.id === bid.room.id);
                  const floor = room?.floor_price;
                  const aboveFloor = floor == null ? true : bid.amount >= floor;
                  const cv = counterInputs[bid.id] || "";
                  // Guest trust signals — prefer the freshly fetched stats, fall
                  // back to the profile embedded on the bid while they load.
                  const gp = guestStats[bid.guest?.email] || bid.guest || {};
                  const gRating = Number(gp.rating || 0);
                  const gStays = gp.stays || 0;
                  const gTrusted = gStays >= 10 && gRating >= 4.5;
                  return (
                    <div key={bid.id} style={{ ...SL.bidCard, borderColor:aboveFloor?color.successSoft:color.danger, marginBottom:16,
                      ...(isTopBid ? { borderColor:color.success, borderWidth:2 } : {}) }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:14 }}>
                        <div>
                          <div style={SL.bidRoom}>{bid.room.name} <span style={{ color:color.faint, fontWeight:400, fontSize:14 }}>· {bid.room.type}</span></div>
                          <div style={{ fontSize:12, color:color.faint, marginTop:2 }}>Ref: {bid.id.slice(0,8)}</div>
                          <div style={{ display:"flex", gap:8, alignItems:"center", marginTop:8, flexWrap:"wrap" }}>
                            <Badge status="pending" />
                            {isTopBid && <span style={{ fontSize:11, background:color.successSoft, color:color.success, padding:"2px 8px", borderRadius:6, fontWeight:700 }}>Highest bid</span>}
                            {floor != null && (aboveFloor
                              ? <span style={{ fontSize:12, color:color.success, fontWeight:600 }}>✓ Above floor (${floor})</span>
                              : <span style={{ fontSize:12, color:color.danger, fontWeight:600 }}>✕ Below floor (${floor})</span>)}
                          </div>
                        </div>
                        <div style={{ textAlign:"right" }}>
                          <div style={{ fontFamily:"Space Grotesk,sans-serif", fontWeight:700, fontSize:30, color:color.brandText }}>${bid.amount}</div>
                          <div style={{ fontSize:12, color:color.faint }}>Rack: ${bid.room.rack}</div>
                        </div>
                      </div>

                      {/* Guest trust row — at the moment of decision */}
                      <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", marginBottom:14, paddingBottom:14, borderBottom:`1px solid ${color.line}` }}>
                        <span style={{ fontSize:12, color:color.muted, fontWeight:600 }}>Guest</span>
                        {gRating > 0 && <StarDisplay rating={gRating} />}
                        {gRating > 0 && <span style={{ fontSize:13, fontWeight:700, color:color.ink }}>{gRating.toFixed(1)}</span>}
                        {gRating > 0 && <span style={{ color:color.line }}>·</span>}
                        <span style={{ fontSize:13, color: gStays === 0 ? color.muted : color.ink, fontWeight: gStays === 0 ? 400 : 600 }}>
                          {gStays === 0 ? "New guest" : `${gStays} stay${gStays === 1 ? "" : "s"}`}
                        </span>
                        {gp.verified && <span style={{ fontSize:11, background:color.successSoft, color:color.success, padding:"2px 7px", borderRadius:6, fontWeight:700 }}>✓ Verified</span>}
                        {gTrusted && <span style={{ fontSize:11, background:color.successSoft, color:color.success, padding:"2px 8px", borderRadius:6, fontWeight:700 }}>Trusted Guest</span>}
                      </div>

                      {bid.guest && (
                        <div style={{ marginBottom:14 }}>
                          <button style={{ ...SL.ghostBtn, fontSize:12, padding:"5px 12px", marginBottom:8 }}
                            onClick={()=>setExpandedGuest(expandedGuest===bid.id?null:bid.id)}>
                            {expandedGuest===bid.id?"Hide":"View"} Guest Profile
                          </button>
                          {expandedGuest===bid.id && <GuestProfileCard guest={bid.guest} compact />}
                        </div>
                      )}

                      <div style={{ display:"flex", alignItems:"center", gap:16, paddingTop:14, borderTop:`1px solid ${color.line}`, flexWrap:"wrap" }}>
                        <TimerRing seconds={t} size={80} />
                        <div style={{ flex:1, display:"flex", flexDirection:"column", gap:10, minWidth:200 }}>
                          <div style={{ display:"flex", gap:10 }}>
                            <button style={{ ...SL.decideBtn, background: group.inventory === 0 ? color.danger : color.success, color:color.surface, flex:1 }}
                              onClick={()=>onAccept(bid, group)}>
                              {group.inventory === 0 ? `Accept anyway $${bid.amount}` : `Accept $${bid.amount}`}
                            </button>
                            <button style={{ ...SL.decideBtn, background:color.surfaceAlt, color:color.ink, border:`1px solid ${color.line}`, flex:1 }} onClick={()=>onDecide(bid.id,"declined")}>Decline</button>
                          </div>
                          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                            <span style={{ fontSize:12, color:color.muted, flexShrink:0, fontWeight:600 }}>Counter at</span>
                            <div style={{ display:"flex", alignItems:"center", background:color.surface, border:`1px solid ${color.line}`, borderRadius:8, padding:"0 10px", flex:1 }}>
                              <span style={{ color:color.faint }}>$</span>
                              <input type="number" placeholder="amount" value={cv}
                                onChange={e=>setCounterInputs(p=>({...p,[bid.id]:e.target.value}))}
                                style={{ background:"none", border:"none", outline:"none", color:color.ink, fontSize:15, fontWeight:700, fontFamily:"Space Grotesk,sans-serif", width:"100%", padding:"8px 6px" }} />
                            </div>
                            <button style={{ ...SL.decideBtn, background:color.counter, color:color.surface, padding:"10px 14px", flexShrink:0, opacity:!(Number(cv)>0)?0.4:1 }}
                              disabled={!(Number(cv)>0)}
                              onClick={()=>{ const amt = Math.round(Number(cv)); if (!amt || amt<=0) return; onCounter(bid.id, amt); setCounterInputs(p=>({...p,[bid.id]:""})); }}>
                              Send Counter
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                  })}
                </div>
              ))
            }
          </div>
        )}

        {activeTab === "history" && (
          <div>
            <div style={SL.dashSectionHead}>
              <h2 style={SL.dashTitle}>Reservations</h2>
              <span style={{ color:color.muted, fontSize:14 }}>Tap a day to see its requests. The selected day also drives KPIs.</span>
            </div>
            <BookingCalendar bids={bids} selectedDate={selectedDate} onSelect={setSelectedDate} />
            <div style={SL.sectionLabel}>{shortDate(selectedDate)} · {dayBids.length} request{dayBids.length===1?"":"s"}</div>
            {dayBids.length === 0
              ? <div style={SL.emptyState}><div style={{ color:color.muted, fontSize:13 }}>No requests on this day.</div></div>
              : <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                  {dayBids.map(b => {
                    const st = effectiveStatus(b);
                    const amount = b.counterAmount ?? b.amount;
                    return (
                      <div key={b.id} style={{ ...SL.panel, padding:16, display:"flex", gap:14, flexWrap:"wrap", alignItems:"center" }}>
                        <div style={{ flex:1, minWidth:220 }}>
                          <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                            <span style={{ fontWeight:700, fontSize:15, color:color.ink }}>{b.guest?.name || "Guest"}</span>
                            <span style={{ fontSize:12, color:color.faint }}>{b.guest?.rating ? `${b.guest.rating} ★ · ${b.guest.stays} stays` : "New guest"}</span>
                          </div>
                          <div style={{ fontSize:13, color:color.muted, marginTop:4 }}>{b.room.name} <span style={{ color:color.faint }}>· Rack ${b.room.rack}</span></div>
                          <div style={{ fontSize:12, color:color.faint, marginTop:4 }}>Check-in: {shortDate(b.stayDate)} · Ref {b.id.slice(0,8)}</div>
                          {["accepted","handled"].includes(b.status) && b.confirmationCode && (
                            <div style={{ fontSize:12, marginTop:4, color:color.success }}>Confirmation: <strong style={{ fontFamily:"monospace" }}>{b.confirmationCode}</strong></div>
                          )}
                        </div>
                        <div style={{ textAlign:"right" }}>
                          <div style={{ fontFamily:"Space Grotesk,sans-serif", fontWeight:700, fontSize:20, color: ["accepted","handled"].includes(b.status) ? color.success : color.ink }}>${amount}</div>
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
                <span style={{ color:color.muted, fontSize:14 }}>Figures for the selected day.</span>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <span style={{ fontSize:12, color:color.muted, fontWeight:600 }}>Date</span>
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
              <span style={{ color:color.muted, fontSize:14 }}>Ratings only — no names or demographics. Protects against discrimination claims.</span>
            </div>
            <div style={{ ...SL.panel, padding:"16px 20px", marginBottom:18 }}>
              <div style={{ fontSize:13, color:color.muted, lineHeight:1.7 }}>
                <strong style={{ color:color.ink }}>How this works:</strong> Every guest builds a rating across all LastKey stays. When a bid arrives you see their star rating and stay count — nothing else. No name, no demographics, no photo. Bad actors get filtered by behavior, not appearance.
              </div>
            </div>
            {[...new Map(bids.filter(b=>b.guest).map(b=>[b.guest.email, b.guest])).values()].map(guest => (
              <div key={guest.email} style={{ ...SL.panel, padding:"16px 18px", marginBottom:10 }}>
                <div style={{ display:"flex", alignItems:"center", gap:14 }}>
                  <div style={{ width:46, height:46, borderRadius:"50%", background:color.brandSoft, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"Space Grotesk,sans-serif", fontWeight:700, fontSize:17, color:color.brandText }}>
                    {(guest.name||"?").split(" ").map(n=>n[0]).join("")}
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                      <span style={{ fontWeight:700, color:color.ink }}>{guest.name}</span>
                      {guest.verified && <span style={{ fontSize:10, background:color.successSoft, color:color.success, padding:"2px 6px", borderRadius:4, fontWeight:700 }}>✓ Verified</span>}
                    </div>
                    <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:4 }}>
                      <StarDisplay rating={guest.rating} />
                      <span style={{ fontSize:12, color:color.muted }}>{guest.rating>0?guest.rating.toFixed(1):"No rating"} · {guest.stays} stays</span>
                    </div>
                  </div>
                  <div style={{ fontSize:12, color:color.faint, textAlign:"right" }}>
                    {bids.filter(b=>b.guest?.email===guest.email).length} bid(s)
                  </div>
                </div>
              </div>
            ))}
            {bids.filter(b=>b.guest).length===0 && <div style={SL.emptyState}><div style={{ color:color.muted, fontSize:13 }}>Guest profiles appear when bids are submitted.</div></div>}
          </div>
        )}

        {activeTab === "rooms" && (
          <div>
            <div style={{ ...SL.dashSectionHead, display:"flex", justifyContent:"space-between", alignItems:"flex-end", flexWrap:"wrap", gap:12 }}>
              <div>
                <h2 style={SL.dashTitle}>Room Settings</h2>
                <span style={{ color:color.muted, fontSize:14 }}>Manage inventory, rack rate, bid floor, and room types. Floors are never shown to guests.</span>
              </div>
              <button style={{ ...SL.submitBtn, width:"auto", padding:"10px 16px" }} onClick={()=>setShowAdd(s=>!s)}>
                {showAdd ? "Close" : "+ Add Room Type"}
              </button>
            </div>

            {/* Informational hotel fields — never shown in KPIs & Analytics. */}
            <div style={{ ...SL.formCard, marginBottom:16 }}>
              <div style={SL.formTitle}>Hotel Info</div>
              <div style={{ color:color.muted, fontSize:13, marginBottom:12, lineHeight:1.55 }}>
                Shown to guests for information only. The security deposit is a refundable hold you collect at
                check-in — it is never charged through LastKey and never counts toward bids or revenue.
              </div>
              <div style={{ display:"flex", gap:16, flexWrap:"wrap", alignItems:"flex-end" }}>
                <div>
                  <div style={SL.settingLabel}>Security deposit ($)</div>
                  <input style={{ ...SL.settingInput, width:100 }} type="number" min="0"
                    value={infoInputs.deposit ?? hotel.depositAmount ?? 0}
                    onChange={e=>setInfoInputs(p=>({ ...p, deposit:e.target.value }))} />
                </div>
                <div style={{ flex:"1 1 220px", maxWidth:300 }}>
                  <div style={SL.settingLabel}>Hotel phone</div>
                  <input style={{ ...SL.field }} type="tel" placeholder="(555) 555-5555"
                    value={infoInputs.phone ?? hotel.phone ?? ""}
                    onChange={e=>setInfoInputs(p=>({ ...p, phone:e.target.value }))} />
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <button style={SL.settingSet} onClick={onSaveHotelInfo}>Save</button>
                  {infoSaved && <span style={{ fontSize:13, color:color.success, fontWeight:600 }}>Saved</span>}
                </div>
              </div>
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

            {rooms.length === 0 && <div style={SL.emptyState}><div style={{ color:color.muted, fontSize:13 }}>No room types yet. Add one above.</div></div>}

            {rooms.map(room => (
              <div key={room.id} style={SL.roomSetCard}>
                <div style={{ width:120, flexShrink:0 }}><ImageOrIcon url={room.imageUrl} type={room.image} height={84} /></div>
                <div style={{ flex:1, minWidth:160 }}>
                  <div style={{ fontWeight:700, fontSize:16, color:color.ink }}>{room.name}</div>
                  <div style={{ fontSize:13, color:color.faint, marginTop:2 }}>{room.type}</div>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginTop:8, marginBottom:8 }}>{room.amenities.map(a=><span key={a} style={SL.amenityTag}>{a}</span>)}</div>
                  <button style={{ ...SL.ghostBtn, fontSize:12, padding:"5px 10px", marginTop:4, color:color.danger, borderColor:color.danger }} onClick={()=>onRemoveRoom(room.id)}>Remove</button>
                </div>

                {/* Inventory */}
                <div style={{ minWidth:120, textAlign:"center" }}>
                  <div style={SL.settingLabel}>Inventory</div>
                  <div style={{ display:"flex", alignItems:"center", gap:8, justifyContent:"center" }}>
                    <button style={SL.stepBtn} onClick={()=>onInventory(room.id,-1)} disabled={(room.inventoryCount??0)<=0}>−</button>
                    <span style={{ fontFamily:"Space Grotesk,sans-serif", fontWeight:700, fontSize:22, minWidth:28, color:color.ink }}>{room.inventoryCount ?? 0}</span>
                    <button style={SL.stepBtn} onClick={()=>onInventory(room.id,1)}>+</button>
                  </div>
                  <div style={{ fontSize:11, color:(room.inventoryCount??0)>0?color.success:color.danger, marginTop:6, fontWeight:600 }}>{(room.inventoryCount??0)>0?"Available":"Sold out / hidden"}</div>
                </div>

                {/* Rack rate */}
                <div style={{ minWidth:130 }}>
                  <div style={SL.settingLabel}>Rack Rate</div>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <span style={{ color:color.faint }}>$</span>
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
                    <span style={{ color:color.faint }}>$</span>
                    <input type="number" value={floorInputs[room.id] ?? (room.floor_price ?? "")}
                      onChange={e=>setFloorInputs(p=>({...p,[room.id]:e.target.value}))}
                      style={SL.settingInput} />
                    <button style={SL.settingSet} onClick={()=>onSetFloor(room.id)}>Set</button>
                  </div>
                  <div style={{ fontSize:11, color:color.success, marginTop:6, fontWeight:600 }}>Active: ${room.floor_price ?? "—"}</div>
                </div>

                {/* Photo */}
                <div style={{ minWidth:140 }}>
                  <div style={SL.settingLabel}>Photo</div>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    {room.imageUrl && (
                      <img src={room.imageUrl} alt="" style={{ width:48, height:48, objectFit:"cover", borderRadius:8, flexShrink:0, border:`1px solid ${color.line}` }} />
                    )}
                    <label style={{ ...SL.ghostBtn, fontSize:12, padding:"7px 12px", cursor: uploadingRoom===room.id ? "default" : "pointer", opacity: uploadingRoom===room.id ? 0.6 : 1, whiteSpace:"nowrap" }}>
                      {uploadingRoom===room.id ? "Uploading…" : room.imageUrl ? "Replace Photo" : "Upload Photo"}
                      <input type="file" accept="image/*" disabled={uploadingRoom===room.id} style={{ display:"none" }}
                        onChange={e => { const f = e.target.files?.[0]; e.target.value = ""; onUploadPhoto(room.id, f); }} />
                    </label>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {isMobile && (
        <MobileBottomNav
          activeId={activeTab}
          onSelect={setActiveTab}
          tabs={[
            { id:"live",    label:"Requests", icon:"⏱", count: liveBids.length },
            { id:"history", label:"Calendar", icon:"🗓" },
            { id:"kpi",     label:"KPIs",     icon:"📊" },
            { id:"guests",  label:"Guests",   icon:"👤" },
            { id:"rooms",   label:"Rooms",    icon:"🛏" },
          ]}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE  (/hotel) — hotel dashboard only
// ─────────────────────────────────────────────────────────────────────────────
export default function HotelPage() {
  return (
    <>
      <Head>
        <title>LastKey — Hotel Dashboard</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="true" />
        <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <HotelDashboard />
    </>
  );
}
