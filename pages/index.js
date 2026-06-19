import { useState, useEffect, useRef } from "react";
import Head from "next/head";

// ── Seed data ────────────────────────────────────────────────────────────────
const HOTEL = {
  name: "The Maison Slidell",
  location: "Slidell, Louisiana",
  tagline: "Historic boutique on the Northshore",
  bidFloor: 65, // hidden from guest
};

const ROOMS_AVAILABLE = [
  {
    id: "101",
    name: "King Suite",
    type: "King · Suite",
    sqft: 480,
    floor: 3,
    rack: 189,
    amenities: ["City view", "Soaking tub", "Nespresso"],
    image: "suite",
  },
  {
    id: "204",
    name: "Queen Deluxe",
    type: "Queen · Deluxe",
    sqft: 320,
    floor: 2,
    rack: 139,
    amenities: ["Garden view", "Work desk", "Rain shower"],
    image: "deluxe",
  },
  {
    id: "307",
    name: "Double Standard",
    type: "Two Queens · Standard",
    sqft: 280,
    floor: 1,
    rack: 109,
    amenities: ["Pool view", "Sleeps 4"],
    image: "standard",
  },
];

const TIMER_SECONDS = 600; // 10 minutes

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(secs) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function genId() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

// ── Timer Ring ────────────────────────────────────────────────────────────────
function TimerRing({ seconds, total = TIMER_SECONDS, size = 160, urgent }) {
  const r = (size - 16) / 2;
  const circ = 2 * Math.PI * r;
  const progress = seconds / total;
  const dash = circ * progress;
  const color = urgent ? "#EF4444" : seconds < 120 ? "#F59E0B" : "#22C55E";

  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1E293B" strokeWidth={8} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={8}
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          style={{ transition: "stroke-dasharray 1s linear, stroke 0.5s" }}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span style={{ fontFamily: "Space Grotesk, sans-serif", fontSize: size * 0.22, fontWeight: 700, color, letterSpacing: "-1px" }}>
          {fmt(seconds)}
        </span>
        <span style={{ fontSize: 11, color: "#64748B", letterSpacing: "0.08em", textTransform: "uppercase", marginTop: 2 }}>
          remaining
        </span>
      </div>
    </div>
  );
}

// ── Room SVG Illustrations ─────────────────────────────────────────────────────
function RoomIcon({ type }) {
  const configs = {
    suite: { bg: "#1E3A5F", accent: "#F59E0B", beds: 1, large: true },
    deluxe: { bg: "#1A3A2A", accent: "#22C55E", beds: 1, large: false },
    standard: { bg: "#2D1B4E", accent: "#A78BFA", beds: 2, large: false },
  };
  const c = configs[type] || configs.standard;
  return (
    <svg viewBox="0 0 200 120" style={{ width: "100%", height: 120, borderRadius: 8 }}>
      <rect width="200" height="120" fill={c.bg} />
      <rect x="10" y="60" width={c.large ? 120 : 85} height="45" rx="4" fill="#0A0F1E" />
      {c.beds === 2 && <rect x="105" y="60" width="85" height="45" rx="4" fill="#0A0F1E" />}
      <rect x="15" y="55" width={c.large ? 110 : 75} height="12" rx="2" fill={c.accent} opacity="0.8" />
      {c.beds === 2 && <rect x="110" y="55" width="75" height="12" rx="2" fill={c.accent} opacity="0.8" />}
      <rect x="160" y="30" width="30" height="40" rx="3" fill="#0F172A" />
      <rect x="163" y="33" width="24" height="20" rx="2" fill={c.accent} opacity="0.3" />
      <circle cx="20" cy="30" r="12" fill={c.accent} opacity="0.15" />
      <circle cx="20" cy="30" r="6" fill={c.accent} opacity="0.4" />
    </svg>
  );
}

// ── STATUS BADGE ──────────────────────────────────────────────────────────────
function Badge({ status }) {
  const map = {
    pending: { label: "Awaiting Response", color: "#F59E0B", bg: "#451A03" },
    accepted: { label: "Accepted", color: "#22C55E", bg: "#052E16" },
    declined: { label: "Declined", color: "#EF4444", bg: "#3B0000" },
    expired: { label: "Expired", color: "#64748B", bg: "#1E293B" },
  };
  const s = map[status] || map.pending;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px",
        borderRadius: 20,
        fontSize: 12,
        fontWeight: 600,
        color: s.color,
        background: s.bg,
        letterSpacing: "0.04em",
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.color, display: "inline-block" }} />
      {s.label}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// GUEST INTERFACE
// ═══════════════════════════════════════════════════════════════════════════════
function GuestView({ bids, onSubmitBid }) {
  const [step, setStep] = useState("browse"); // browse | bid | waiting | result
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [bidAmount, setBidAmount] = useState("");
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [activeBid, setActiveBid] = useState(null);
  const [timeLeft, setTimeLeft] = useState(TIMER_SECONDS);
  const timerRef = useRef(null);

  // Watch for bid status changes
  useEffect(() => {
    if (!activeBid) return;
    const current = bids.find((b) => b.id === activeBid.id);
    if (current && current.status !== "pending") {
      setActiveBid(current);
      setStep("result");
      clearInterval(timerRef.current);
    }
  }, [bids, activeBid]);

  // Countdown
  useEffect(() => {
    if (step !== "waiting") return;
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          setActiveBid((prev) => ({ ...prev, status: "expired" }));
          setStep("result");
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [step]);

  function handleBid() {
    const amount = parseInt(bidAmount);
    if (!amount || amount < 1) return;
    const bid = {
      id: genId(),
      room: selectedRoom,
      amount,
      guestName,
      guestEmail,
      status: "pending",
      submittedAt: new Date().toISOString(),
    };
    onSubmitBid(bid);
    setActiveBid(bid);
    setTimeLeft(TIMER_SECONDS);
    setStep("waiting");
  }

  // ── Browse ──
  if (step === "browse") {
    return (
      <div style={styles.guestWrap}>
        <div style={styles.guestHeader}>
          <div style={styles.logo}>LK</div>
          <div>
            <div style={styles.hotelName}>{HOTEL.name}</div>
            <div style={styles.hotelSub}>{HOTEL.location}</div>
          </div>
        </div>

        <div style={styles.heroBox}>
          <div style={styles.heroEyebrow}>Tonight Only · Limited Rooms</div>
          <h1 style={styles.heroTitle}>Request Your Rate</h1>
          <p style={styles.heroSub}>
            Name your price for one of our unsold rooms tonight. We'll respond in 10 minutes — no haggling, just yes or no.
          </p>
        </div>

        <div style={styles.sectionLabel}>Available Tonight</div>
        <div style={styles.roomGrid}>
          {ROOMS_AVAILABLE.map((room) => (
            <div key={room.id} style={styles.roomCard} onClick={() => { setSelectedRoom(room); setStep("bid"); }}>
              <RoomIcon type={room.image} />
              <div style={{ padding: "14px 16px 16px" }}>
                <div style={styles.roomName}>{room.name}</div>
                <div style={styles.roomType}>{room.type} · {room.sqft} sq ft · Floor {room.floor}</div>
                <div style={styles.amenityRow}>
                  {room.amenities.map((a) => (
                    <span key={a} style={styles.amenityTag}>{a}</span>
                  ))}
                </div>
                <div style={styles.rackRow}>
                  <span style={styles.rackLabel}>Rack rate</span>
                  <span style={styles.rackPrice}>${room.rack}</span>
                </div>
                <button style={styles.bidBtn}>Request a Rate →</button>
              </div>
            </div>
          ))}
        </div>

        <div style={styles.howBox}>
          <div style={styles.sectionLabel}>How it works</div>
          <div style={styles.steps}>
            {[
              ["01", "Pick a room", "Choose from available rooms tonight."],
              ["02", "Name your price", "Submit what you'd pay. No public rates, no algorithms."],
              ["03", "10-minute answer", "The hotel says yes or no. You'll know before you book elsewhere."],
            ].map(([n, t, d]) => (
              <div key={n} style={styles.step}>
                <div style={styles.stepNum}>{n}</div>
                <div>
                  <div style={styles.stepTitle}>{t}</div>
                  <div style={styles.stepDesc}>{d}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Bid Form ──
  if (step === "bid") {
    const r = selectedRoom;
    return (
      <div style={styles.guestWrap}>
        <button style={styles.backBtn} onClick={() => setStep("browse")}>← Back</button>
        <div style={styles.bidHeader}>
          <RoomIcon type={r.image} />
          <div style={{ marginTop: 12 }}>
            <div style={styles.roomName}>{r.name}</div>
            <div style={styles.roomType}>{r.type} · {r.sqft} sq ft</div>
          </div>
        </div>

        <div style={styles.formCard}>
          <div style={styles.formTitle}>Your Rate Request</div>
          <div style={styles.formHint}>Rack rate is ${r.rack}. Submit what you'd pay for tonight.</div>

          <div style={styles.amountWrap}>
            <span style={styles.dollarSign}>$</span>
            <input
              type="number"
              placeholder="0"
              value={bidAmount}
              onChange={(e) => setBidAmount(e.target.value)}
              style={styles.amountInput}
              min="1"
              max={r.rack}
            />
            <span style={styles.perNight}>/ night</span>
          </div>

          <div style={styles.fieldGroup}>
            <input
              style={styles.field}
              placeholder="Your name"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
            />
            <input
              style={styles.field}
              placeholder="Email address"
              type="email"
              value={guestEmail}
              onChange={(e) => setGuestEmail(e.target.value)}
            />
          </div>

          <div style={styles.terms}>
            If accepted, you'll receive a confirmation link to complete payment. Your card is not charged until accepted.
          </div>

          <button
            style={{ ...styles.submitBtn, opacity: (!bidAmount || !guestName || !guestEmail) ? 0.4 : 1 }}
            disabled={!bidAmount || !guestName || !guestEmail}
            onClick={handleBid}
          >
            Submit Rate Request
          </button>
        </div>
      </div>
    );
  }

  // ── Waiting ──
  if (step === "waiting") {
    return (
      <div style={{ ...styles.guestWrap, alignItems: "center", textAlign: "center", paddingTop: 60 }}>
        <div style={styles.logo}>LK</div>
        <div style={{ marginTop: 32 }}>
          <TimerRing seconds={timeLeft} urgent={timeLeft < 60} />
        </div>
        <h2 style={{ ...styles.heroTitle, fontSize: 24, marginTop: 28 }}>Request Sent</h2>
        <p style={{ color: "#64748B", maxWidth: 300, margin: "12px auto 0", lineHeight: 1.6 }}>
          <strong style={{ color: "#F7F5F0" }}>{HOTEL.name}</strong> is reviewing your ${activeBid?.amount} request for {activeBid?.room?.name}.
        </p>
        <div style={styles.waitingCard}>
          <div style={styles.waitRow}><span style={{ color: "#64748B" }}>Room</span><span>{activeBid?.room?.name}</span></div>
          <div style={styles.waitRow}><span style={{ color: "#64748B" }}>Your bid</span><span style={{ color: "#F59E0B", fontWeight: 700 }}>${activeBid?.amount}</span></div>
          <div style={styles.waitRow}><span style={{ color: "#64748B" }}>Reference</span><span style={{ fontFamily: "monospace", fontSize: 13 }}>{activeBid?.id}</span></div>
        </div>
        <p style={{ color: "#475569", fontSize: 13, marginTop: 24 }}>
          We'll email {activeBid?.guestEmail} the moment a decision is made.
        </p>
      </div>
    );
  }

  // ── Result ──
  if (step === "result") {
    const bid = bids.find((b) => b.id === activeBid?.id) || activeBid;
    const accepted = bid?.status === "accepted";
    const expired = bid?.status === "expired";

    return (
      <div style={{ ...styles.guestWrap, alignItems: "center", textAlign: "center", paddingTop: 60 }}>
        <div style={styles.resultIcon}>{accepted ? "✓" : expired ? "⏱" : "✕"}</div>
        <h2 style={{ ...styles.heroTitle, fontSize: 28, marginTop: 20, color: accepted ? "#22C55E" : expired ? "#64748B" : "#EF4444" }}>
          {accepted ? "You're in." : expired ? "Time's up." : "Not this time."}
        </h2>
        <p style={{ color: "#94A3B8", maxWidth: 320, margin: "12px auto 0", lineHeight: 1.7 }}>
          {accepted
            ? `Your $${bid.amount} rate for ${bid.room.name} has been accepted. Check your email for the payment link.`
            : expired
            ? "The request window closed before a response. Try again — rooms are still available."
            : "The hotel couldn't accept this rate tonight. You're welcome to try a different room or amount."}
        </p>
        <button
          style={{ ...styles.submitBtn, marginTop: 36, background: "#1E293B" }}
          onClick={() => { setStep("browse"); setActiveBid(null); setBidAmount(""); setGuestName(""); setGuestEmail(""); }}
        >
          {accepted ? "Done" : "Try Again"}
        </button>
      </div>
    );
  }

  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HOTEL DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════
function HotelDashboard({ bids, onDecide, onAddRoom, onUpdateFloor }) {
  const [activeTab, setActiveTab] = useState("live");
  const [timers, setTimers] = useState({});
  const [floorInputs, setFloorInputs] = useState(
    ROOMS_AVAILABLE.reduce((acc, r) => ({ ...acc, [r.id]: HOTEL.bidFloor }), {})
  );
  const [floors, setFloors] = useState(
    ROOMS_AVAILABLE.reduce((acc, r) => ({ ...acc, [r.id]: HOTEL.bidFloor }), {})
  );
  const [notification, setNotification] = useState(null);

  // Tick all pending timers
  useEffect(() => {
    const interval = setInterval(() => {
      setTimers((prev) => {
        const next = { ...prev };
        let changed = false;
        bids.forEach((b) => {
          if (b.status === "pending") {
            const elapsed = Math.floor((Date.now() - new Date(b.submittedAt).getTime()) / 1000);
            const remaining = Math.max(0, TIMER_SECONDS - elapsed);
            if (next[b.id] !== remaining) { next[b.id] = remaining; changed = true; }
          }
        });
        return changed ? next : prev;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [bids]);

  // Show notification for new bids
  const prevBidCount = useRef(0);
  useEffect(() => {
    if (bids.length > prevBidCount.current) {
      const newBid = bids[bids.length - 1];
      setNotification(newBid);
      setTimeout(() => setNotification(null), 5000);
    }
    prevBidCount.current = bids.length;
  }, [bids]);

  const liveBids = bids.filter((b) => b.status === "pending");
  const histBids = bids.filter((b) => b.status !== "pending");

  function handleDecide(bid, decision) {
    onDecide(bid.id, decision);
  }

  return (
    <div style={styles.dashWrap}>
      {/* Notification Toast */}
      {notification && (
        <div style={styles.toast}>
          <span style={styles.toastDot} />
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>New Rate Request</div>
            <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 2 }}>
              ${notification.amount} bid on {notification.room.name} from {notification.guestName}
            </div>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <div style={styles.sidebar}>
        <div style={styles.sidebarTop}>
          <div style={styles.logo}>LK</div>
          <div style={{ marginTop: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{HOTEL.name}</div>
            <div style={{ fontSize: 12, color: "#475569", marginTop: 2 }}>{HOTEL.location}</div>
          </div>
        </div>

        <div style={styles.sidebarNav}>
          {[
            { id: "live", label: "Live Requests", count: liveBids.length },
            { id: "history", label: "History", count: histBids.length },
            { id: "rooms", label: "Room Settings" },
          ].map((tab) => (
            <button
              key={tab.id}
              style={{ ...styles.navItem, ...(activeTab === tab.id ? styles.navActive : {}) }}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
              {tab.count > 0 && <span style={styles.navBadge}>{tab.count}</span>}
            </button>
          ))}
        </div>

        <div style={styles.sidebarStats}>
          <div style={styles.stat}>
            <div style={styles.statVal}>{bids.filter((b) => b.status === "accepted").length}</div>
            <div style={styles.statLabel}>Accepted Tonight</div>
          </div>
          <div style={styles.stat}>
            <div style={styles.statVal}>
              ${bids.filter((b) => b.status === "accepted").reduce((s, b) => s + b.amount, 0)}
            </div>
            <div style={styles.statLabel}>Revenue Recovered</div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div style={styles.dashMain}>
        {/* Live Requests */}
        {activeTab === "live" && (
          <div>
            <div style={styles.dashSectionHead}>
              <h2 style={styles.dashTitle}>Live Requests</h2>
              <span style={{ color: "#475569", fontSize: 14 }}>Respond within the window or the request expires</span>
            </div>

            {liveBids.length === 0 ? (
              <div style={styles.emptyState}>
                <div style={{ fontSize: 40, marginBottom: 16 }}>⏳</div>
                <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>No active requests</div>
                <div style={{ color: "#475569", fontSize: 14 }}>When guests submit bids, they'll appear here in real time.</div>
              </div>
            ) : (
              <div style={styles.bidList}>
                {liveBids.map((bid) => {
                  const t = timers[bid.id] ?? TIMER_SECONDS;
                  const floor = floors[bid.room.id];
                  const aboveFloor = bid.amount >= floor;
                  return (
                    <div key={bid.id} style={{ ...styles.bidCard, borderColor: aboveFloor ? "#22C55E22" : "#EF444422" }}>
                      <div style={styles.bidCardTop}>
                        <div>
                          <div style={styles.bidRoom}>{bid.room.name} <span style={{ color: "#475569", fontWeight: 400 }}>· {bid.room.type}</span></div>
                          <div style={styles.bidGuest}>{bid.guestName} · {bid.guestEmail}</div>
                          <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center" }}>
                            <Badge status="pending" />
                            {aboveFloor
                              ? <span style={{ fontSize: 12, color: "#22C55E" }}>✓ Above floor (${floor})</span>
                              : <span style={{ fontSize: 12, color: "#EF4444" }}>✕ Below floor — auto-declining soon</span>}
                          </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={styles.bidAmount}>${bid.amount}</div>
                          <div style={{ fontSize: 12, color: "#475569" }}>Rack: ${bid.room.rack}</div>
                          <div style={{ fontSize: 12, color: "#475569" }}>Ref: {bid.id}</div>
                        </div>
                      </div>
                      <div style={styles.bidCardBottom}>
                        <TimerRing seconds={t} size={80} />
                        <div style={styles.decideButtons}>
                          <button
                            style={{ ...styles.decideBtn, ...styles.acceptBtn }}
                            onClick={() => handleDecide(bid, "accepted")}
                          >
                            Accept ${bid.amount}
                          </button>
                          <button
                            style={{ ...styles.decideBtn, ...styles.declineBtn }}
                            onClick={() => handleDecide(bid, "declined")}
                          >
                            Decline
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* History */}
        {activeTab === "history" && (
          <div>
            <div style={styles.dashSectionHead}>
              <h2 style={styles.dashTitle}>Request History</h2>
            </div>
            {histBids.length === 0 ? (
              <div style={styles.emptyState}>
                <div style={{ fontSize: 14, color: "#475569" }}>No completed requests yet.</div>
              </div>
            ) : (
              <div style={styles.histTable}>
                <div style={styles.histHead}>
                  <span>Guest</span><span>Room</span><span>Bid</span><span>Rack</span><span>Status</span>
                </div>
                {histBids.map((b) => (
                  <div key={b.id} style={styles.histRow}>
                    <span>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{b.guestName}</div>
                      <div style={{ fontSize: 12, color: "#475569" }}>{b.id}</div>
                    </span>
                    <span style={{ fontSize: 14, color: "#94A3B8" }}>{b.room.name}</span>
                    <span style={{ fontWeight: 700, color: b.status === "accepted" ? "#22C55E" : "#F7F5F0" }}>${b.amount}</span>
                    <span style={{ fontSize: 14, color: "#475569" }}>${b.room.rack}</span>
                    <span><Badge status={b.status} /></span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Room Settings */}
        {activeTab === "rooms" && (
          <div>
            <div style={styles.dashSectionHead}>
              <h2 style={styles.dashTitle}>Room & Bid Floor Settings</h2>
              <span style={{ color: "#475569", fontSize: 14 }}>Bid floors are never shown to guests. Bids below floor are instantly declined.</span>
            </div>
            <div style={styles.roomSettingsList}>
              {ROOMS_AVAILABLE.map((room) => (
                <div key={room.id} style={styles.roomSettingCard}>
                  <div style={{ width: 120, flexShrink: 0 }}>
                    <RoomIcon type={room.image} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>{room.name}</div>
                    <div style={{ fontSize: 13, color: "#475569", marginTop: 2 }}>{room.type} · Rack: ${room.rack}</div>
                    <div style={styles.amenityRow}>
                      {room.amenities.map((a) => <span key={a} style={styles.amenityTag}>{a}</span>)}
                    </div>
                  </div>
                  <div style={styles.floorControl}>
                    <div style={{ fontSize: 12, color: "#64748B", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>Bid Floor</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ color: "#64748B", fontSize: 18 }}>$</span>
                      <input
                        type="number"
                        value={floorInputs[room.id]}
                        onChange={(e) => setFloorInputs((p) => ({ ...p, [room.id]: e.target.value }))}
                        style={styles.floorInput}
                      />
                      <button
                        style={styles.setFloorBtn}
                        onClick={() => setFloors((p) => ({ ...p, [room.id]: parseInt(floorInputs[room.id]) }))}
                      >
                        Set
                      </button>
                    </div>
                    <div style={{ fontSize: 12, color: "#22C55E", marginTop: 8 }}>
                      Current floor: ${floors[room.id]}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROOT APP
// ═══════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [view, setView] = useState("guest"); // guest | hotel
  const [bids, setBids] = useState([]);

  function handleSubmitBid(bid) {
    setBids((prev) => [...prev, bid]);
    // Auto-decline if below floor (check after 500ms to feel natural)
    setTimeout(() => {
      setBids((prev) =>
        prev.map((b) => {
          if (b.id === bid.id && b.status === "pending") {
            const floor = HOTEL.bidFloor;
            if (b.amount < floor) return { ...b, status: "declined" };
          }
          return b;
        })
      );
    }, 800);
  }

  function handleDecide(id, decision) {
    setBids((prev) => prev.map((b) => (b.id === id ? { ...b, status: decision } : b)));
  }

  return (
    <>
      <Head>
        <title>LastKey — Private Rate Requests</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="true" />
        <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      {/* View Toggle */}
      <div style={styles.viewToggle}>
        <button style={{ ...styles.toggleBtn, ...(view === "guest" ? styles.toggleActive : {}) }} onClick={() => setView("guest")}>
          Guest View
        </button>
        <button style={{ ...styles.toggleBtn, ...(view === "hotel" ? styles.toggleActive : {}) }} onClick={() => setView("hotel")}>
          Hotel Dashboard {bids.filter(b => b.status === "pending").length > 0 && `(${bids.filter(b => b.status === "pending").length})`}
        </button>
      </div>

      {view === "guest"
        ? <GuestView bids={bids} onSubmitBid={handleSubmitBid} />
        : <HotelDashboard bids={bids} onDecide={handleDecide} />}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════════
const styles = {
  // ── Toggle ──
  viewToggle: {
    position: "fixed", top: 16, right: 16, zIndex: 1000,
    display: "flex", gap: 4, background: "#0F172A",
    padding: 4, borderRadius: 10, border: "1px solid #1E293B",
  },
  toggleBtn: {
    padding: "8px 16px", borderRadius: 7, border: "none", cursor: "pointer",
    fontSize: 13, fontWeight: 600, fontFamily: "Inter, sans-serif",
    color: "#64748B", background: "transparent", transition: "all 0.2s",
  },
  toggleActive: { background: "#1E293B", color: "#F7F5F0" },

  // ── Guest ──
  guestWrap: {
    minHeight: "100vh", background: "#0A0F1E", color: "#F7F5F0",
    fontFamily: "Inter, sans-serif", padding: "24px 20px 60px",
    maxWidth: 480, margin: "0 auto", display: "flex", flexDirection: "column",
  },
  guestHeader: { display: "flex", alignItems: "center", gap: 12, marginBottom: 36, paddingTop: 8 },
  logo: {
    width: 40, height: 40, borderRadius: 10, background: "#F59E0B",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontFamily: "Space Grotesk, sans-serif", fontWeight: 700, fontSize: 14, color: "#0A0F1E",
  },
  hotelName: { fontFamily: "Space Grotesk, sans-serif", fontWeight: 700, fontSize: 16 },
  hotelSub: { fontSize: 12, color: "#475569", marginTop: 2 },
  heroBox: { marginBottom: 36 },
  heroEyebrow: {
    fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase",
    color: "#F59E0B", fontWeight: 600, marginBottom: 10,
  },
  heroTitle: {
    fontFamily: "Space Grotesk, sans-serif", fontSize: 36, fontWeight: 700,
    margin: "0 0 12px", lineHeight: 1.1, letterSpacing: "-0.5px",
  },
  heroSub: { color: "#64748B", lineHeight: 1.65, fontSize: 15, margin: 0 },
  sectionLabel: {
    fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase",
    color: "#475569", fontWeight: 600, marginBottom: 14,
  },
  roomGrid: { display: "flex", flexDirection: "column", gap: 16, marginBottom: 48 },
  roomCard: {
    background: "#0F172A", border: "1px solid #1E293B", borderRadius: 12,
    overflow: "hidden", cursor: "pointer", transition: "border-color 0.2s",
  },
  roomName: { fontFamily: "Space Grotesk, sans-serif", fontWeight: 700, fontSize: 17, marginBottom: 4 },
  roomType: { fontSize: 13, color: "#475569", marginBottom: 10 },
  amenityRow: { display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 },
  amenityTag: {
    fontSize: 11, padding: "3px 8px", borderRadius: 4,
    background: "#1E293B", color: "#94A3B8", fontWeight: 500,
  },
  rackRow: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  rackLabel: { fontSize: 12, color: "#475569" },
  rackPrice: { fontSize: 15, color: "#94A3B8", textDecoration: "line-through" },
  bidBtn: {
    width: "100%", padding: "12px 0", background: "#F59E0B", color: "#0A0F1E",
    border: "none", borderRadius: 8, fontWeight: 700, fontSize: 14,
    fontFamily: "Inter, sans-serif", cursor: "pointer", letterSpacing: "0.01em",
  },
  howBox: { borderTop: "1px solid #1E293B", paddingTop: 32 },
  steps: { display: "flex", flexDirection: "column", gap: 20 },
  step: { display: "flex", gap: 16, alignItems: "flex-start" },
  stepNum: {
    fontFamily: "Space Grotesk, sans-serif", fontWeight: 700, fontSize: 12,
    color: "#F59E0B", minWidth: 28, paddingTop: 2,
  },
  stepTitle: { fontWeight: 600, fontSize: 15, marginBottom: 4 },
  stepDesc: { fontSize: 13, color: "#475569", lineHeight: 1.55 },

  // ── Bid Form ──
  backBtn: {
    background: "none", border: "none", color: "#475569", cursor: "pointer",
    fontSize: 14, padding: 0, marginBottom: 24, fontFamily: "Inter, sans-serif",
  },
  bidHeader: { marginBottom: 24 },
  formCard: { background: "#0F172A", border: "1px solid #1E293B", borderRadius: 14, padding: 24 },
  formTitle: { fontFamily: "Space Grotesk, sans-serif", fontWeight: 700, fontSize: 20, marginBottom: 6 },
  formHint: { fontSize: 13, color: "#475569", marginBottom: 24, lineHeight: 1.55 },
  amountWrap: {
    display: "flex", alignItems: "baseline", gap: 8,
    borderBottom: "2px solid #F59E0B", paddingBottom: 12, marginBottom: 24,
  },
  dollarSign: { fontFamily: "Space Grotesk, sans-serif", fontSize: 32, fontWeight: 700, color: "#F59E0B" },
  amountInput: {
    flex: 1, background: "none", border: "none", outline: "none",
    fontFamily: "Space Grotesk, sans-serif", fontSize: 48, fontWeight: 700,
    color: "#F7F5F0", width: "100%",
  },
  perNight: { fontSize: 14, color: "#475569", whiteSpace: "nowrap" },
  fieldGroup: { display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 },
  field: {
    background: "#1E293B", border: "1px solid #2D3F55", borderRadius: 8,
    padding: "12px 14px", color: "#F7F5F0", fontSize: 15, outline: "none",
    fontFamily: "Inter, sans-serif",
  },
  terms: { fontSize: 12, color: "#475569", lineHeight: 1.6, marginBottom: 20 },
  submitBtn: {
    width: "100%", padding: "14px 0", background: "#F59E0B", color: "#0A0F1E",
    border: "none", borderRadius: 10, fontWeight: 700, fontSize: 15,
    fontFamily: "Inter, sans-serif", cursor: "pointer", letterSpacing: "0.01em",
    transition: "opacity 0.2s",
  },

  // ── Waiting ──
  waitingCard: {
    background: "#0F172A", border: "1px solid #1E293B", borderRadius: 12,
    padding: "20px 24px", width: "100%", maxWidth: 320, margin: "28px auto 0",
  },
  waitRow: { display: "flex", justifyContent: "space-between", padding: "8px 0", fontSize: 14, borderBottom: "1px solid #1E293B" },

  // ── Result ──
  resultIcon: {
    width: 72, height: 72, borderRadius: "50%", background: "#1E293B",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 32, margin: "0 auto",
  },

  // ── Dashboard ──
  dashWrap: {
    minHeight: "100vh", background: "#080D18", color: "#F7F5F0",
    fontFamily: "Inter, sans-serif", display: "flex",
  },
  sidebar: {
    width: 240, flexShrink: 0, background: "#0A0F1E",
    borderRight: "1px solid #1E293B", padding: "24px 16px",
    display: "flex", flexDirection: "column",
  },
  sidebarTop: { marginBottom: 32 },
  sidebarNav: { flex: 1, display: "flex", flexDirection: "column", gap: 4 },
  navItem: {
    width: "100%", padding: "10px 14px", borderRadius: 8, border: "none",
    background: "none", color: "#64748B", cursor: "pointer", textAlign: "left",
    fontSize: 14, fontFamily: "Inter, sans-serif", fontWeight: 500,
    display: "flex", justifyContent: "space-between", alignItems: "center",
    transition: "all 0.15s",
  },
  navActive: { background: "#1E293B", color: "#F7F5F0" },
  navBadge: {
    background: "#F59E0B", color: "#0A0F1E", fontSize: 11,
    fontWeight: 700, padding: "2px 7px", borderRadius: 10,
  },
  sidebarStats: { borderTop: "1px solid #1E293B", paddingTop: 20, display: "flex", gap: 12 },
  stat: { flex: 1 },
  statVal: { fontFamily: "Space Grotesk, sans-serif", fontWeight: 700, fontSize: 22, color: "#F59E0B" },
  statLabel: { fontSize: 11, color: "#475569", marginTop: 2 },
  dashMain: { flex: 1, padding: "32px 36px", overflowY: "auto" },
  dashSectionHead: { marginBottom: 28 },
  dashTitle: { fontFamily: "Space Grotesk, sans-serif", fontWeight: 700, fontSize: 24, margin: "0 0 6px" },
  bidList: { display: "flex", flexDirection: "column", gap: 16 },
  bidCard: {
    background: "#0F172A", border: "1px solid #1E293B", borderRadius: 14,
    padding: 24, transition: "border-color 0.3s",
  },
  bidCardTop: { display: "flex", justifyContent: "space-between", marginBottom: 24 },
  bidRoom: { fontFamily: "Space Grotesk, sans-serif", fontWeight: 700, fontSize: 18, marginBottom: 4 },
  bidGuest: { fontSize: 13, color: "#475569" },
  bidAmount: { fontFamily: "Space Grotesk, sans-serif", fontWeight: 700, fontSize: 32, color: "#F59E0B" },
  bidCardBottom: { display: "flex", alignItems: "center", gap: 24, paddingTop: 20, borderTop: "1px solid #1E293B" },
  decideButtons: { display: "flex", gap: 12, flex: 1 },
  decideBtn: {
    flex: 1, padding: "14px 0", borderRadius: 10, border: "none",
    cursor: "pointer", fontFamily: "Inter, sans-serif", fontWeight: 700,
    fontSize: 15, transition: "opacity 0.2s",
  },
  acceptBtn: { background: "#22C55E", color: "#052E16" },
  declineBtn: { background: "#1E293B", color: "#94A3B8" },
  emptyState: {
    background: "#0F172A", border: "1px solid #1E293B", borderRadius: 14,
    padding: "60px 32px", textAlign: "center",
  },
  histTable: { background: "#0F172A", border: "1px solid #1E293B", borderRadius: 14, overflow: "hidden" },
  histHead: {
    display: "grid", gridTemplateColumns: "2fr 1.5fr 0.8fr 0.8fr 1.2fr",
    padding: "12px 20px", background: "#0A0F1E",
    fontSize: 11, color: "#475569", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 600,
  },
  histRow: {
    display: "grid", gridTemplateColumns: "2fr 1.5fr 0.8fr 0.8fr 1.2fr",
    padding: "16px 20px", borderTop: "1px solid #1E293B", alignItems: "center",
  },
  roomSettingsList: { display: "flex", flexDirection: "column", gap: 16 },
  roomSettingCard: {
    background: "#0F172A", border: "1px solid #1E293B", borderRadius: 14,
    padding: 24, display: "flex", gap: 20, alignItems: "center",
  },
  floorControl: { minWidth: 140 },
  floorInput: {
    width: 80, background: "#1E293B", border: "1px solid #2D3F55", borderRadius: 6,
    padding: "8px 12px", color: "#F7F5F0", fontSize: 18, fontWeight: 700,
    fontFamily: "Space Grotesk, sans-serif", outline: "none", textAlign: "center",
  },
  setFloorBtn: {
    padding: "8px 14px", background: "#F59E0B", color: "#0A0F1E",
    border: "none", borderRadius: 6, fontWeight: 700, fontSize: 13,
    fontFamily: "Inter, sans-serif", cursor: "pointer",
  },
  // ── Toast ──
  toast: {
    position: "fixed", top: 24, left: "50%", transform: "translateX(-50%)",
    background: "#0F172A", border: "1px solid #22C55E", borderRadius: 12,
    padding: "14px 20px", display: "flex", gap: 12, alignItems: "flex-start",
    zIndex: 2000, boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
    fontFamily: "Inter, sans-serif", color: "#F7F5F0", minWidth: 280,
  },
  toastDot: {
    width: 8, height: 8, borderRadius: "50%", background: "#22C55E",
    marginTop: 4, flexShrink: 0, animation: "pulse 1.5s infinite",
  },
};
