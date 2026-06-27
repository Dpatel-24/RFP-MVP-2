import { useState, useEffect, useRef, useCallback } from "react";
import Head from "next/head";
import * as api from "../lib/api";
import { effectiveStatus, getTodayKey } from "../lib/api";
import {
  shortDate, useWindowWidth, MOBILE_BREAKPOINT, BOTTOM_NAV_HEIGHT,
  TimerRing, ImageOrIcon, Badge, StarDisplay, GuestProfileCard, PasswordLogin,
  BookingCalendar, MobileBottomNav, SL,
} from "../lib/components";

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
          <div style={{ fontSize:12, color:"#9CA3AF", marginBottom:14, textTransform:"uppercase", letterSpacing:"0.08em", fontWeight:600 }}>Bids by Room Type</div>
          <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr 1fr", gap:12, fontSize:11, color:"#9CA3AF", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.04em", paddingBottom:8, borderBottom:"1px solid #E5E7EB" }}>
            <span>Room Type</span>
            <span style={{ textAlign:"right" }}>Bids</span>
            <span style={{ textAlign:"right" }}>Avg Bid</span>
            <span style={{ textAlign:"right" }}>Accepted</span>
          </div>
          {byRoomType.map(g => (
            <div key={g.type} style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr 1fr", gap:12, alignItems:"center", padding:"10px 0", borderBottom:"1px solid #F3F4F6" }}>
              <span style={{ fontSize:13, fontWeight:600, color:"#1A1F2B" }}>{g.type}</span>
              <span style={{ fontSize:13, color:"#1A1F2B", textAlign:"right", fontFamily:"Space Grotesk,sans-serif", fontWeight:700 }}>{g.count}</span>
              <span style={{ fontSize:13, color:"#1A1F2B", textAlign:"right", fontFamily:"Space Grotesk,sans-serif", fontWeight:700 }}>${g.avgBid}</span>
              <span style={{ fontSize:13, color:"#15803D", textAlign:"right", fontFamily:"Space Grotesk,sans-serif", fontWeight:700 }}>{g.acceptRate}%</span>
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
  const [selectedDate, setSelectedDate] = useState(getTodayKey());
  const [showAdd, setShowAdd]           = useState(false);
  const [newRoom, setNewRoom]           = useState({ name:"", room_type:"", rack_rate:"", bid_floor:"", inventory_count:"1", amenities:"" });
  const prevCount = useRef(null); // null until first bids load — avoids a false toast on mount

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
  const accepted = bids.filter(b => ["accepted","handled"].includes(b.status));
  // "Tonight" stats are scoped to the current 6 AM-boundary booking day.
  const todayKey = getTodayKey();
  const todayAccepted = accepted.filter(b => b.stayDate === todayKey);
  const todayRevenue = todayAccepted.reduce((s,b) => s + (b.counterAmount ?? b.amount), 0);

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
    <div style={isMobile ? { ...SL.dashWrap, display:"block" } : SL.dashWrap}>
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

      {!isMobile && (
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
        <div style={{ borderTop:"1px solid #E5E7EB", paddingTop:16, marginTop:"auto" }}>
          <div style={{ fontSize:11, color:"#9CA3AF", marginBottom:8, textTransform:"uppercase", letterSpacing:"0.06em", fontWeight:700 }}>Tonight</div>
          <div style={{ display:"flex", gap:14 }}>
            <div>
              <div style={{ fontFamily:"Space Grotesk,sans-serif", fontWeight:700, fontSize:20, color:"#B45309" }}>{todayAccepted.length}</div>
              <div style={{ fontSize:10, color:"#9CA3AF" }}>Accepted</div>
            </div>
            <div>
              <div style={{ fontFamily:"Space Grotesk,sans-serif", fontWeight:700, fontSize:20, color:"#15803D" }}>${todayRevenue}</div>
              <div style={{ fontSize:10, color:"#9CA3AF" }}>Revenue</div>
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
                <div style={{ fontWeight:700, fontSize:13, color:"#1A1F2B" }}>{hotel.name}</div>
                <div style={{ fontSize:11, color:"#9CA3AF" }}>{todayAccepted.length} accepted · ${todayRevenue} tonight</div>
              </div>
            </div>
            <button style={{ ...SL.ghostBtn, fontSize:12, padding:"7px 12px" }} onClick={onSignOut}>Sign Out</button>
          </div>
        )}

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
