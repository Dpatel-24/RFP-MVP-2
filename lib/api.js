import { supabase } from "./supabaseClient";

// Timing constants — source of truth is requests.expires_at in the DB; these are
// used to set that column on write and to drive the display countdown.
export const TIMER_SECONDS = 600; // initial bid window
export const COUNTER_TIMER = 300; // guest's window to answer a counter

function genCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

// ── Row → view-model mapping (keeps existing components unchanged) ────────────
// Pick a RoomIcon key from the room's descriptive fields.
function iconForRoom({ room_type = "", name = "" }) {
  const s = `${room_type} ${name}`.toLowerCase();
  if (/suite|loft/.test(s)) return "suite";
  if (/two|double|twin|2 /.test(s)) return "standard"; // standard icon = 2 beds
  return "deluxe";
}

function mapRoom(r) {
  return {
    id: r.id,
    hotelId: r.hotel_id,
    name: r.name,
    type: r.room_type,
    sqft: r.sqft,
    floor: r.floor,
    rack: Number(r.rack_rate),
    amenities: r.amenities || [],
    image: iconForRoom(r),
    available: r.available_tonight,
    // bid_floor only present when sourced from owner_rooms() RPC
    floor_price: r.bid_floor != null ? Number(r.bid_floor) : undefined,
  };
}

function mapHotel(h) {
  return {
    id: h.id,
    name: h.name,
    location: h.location,
    city: h.city,
    tagline: h.tagline,
    rating: Number(h.rating),
    reviewCount: h.review_count,
    rooms: (h.rooms || []).map(mapRoom),
  };
}

// A request row + embedded room/hotel + (optional) guest profile → bid view model
export function mapRequest(row, guest) {
  return {
    id: row.id,
    status: row.status,
    amount: Number(row.bid_amount),
    counterAmount: row.counter_amount != null ? Number(row.counter_amount) : null,
    confirmationCode: row.confirmation_code || null,
    submittedAt: row.created_at,
    expiresAt: row.expires_at,
    resolvedAt: row.resolved_at,
    hotel: { id: row.hotel_id, name: row.hotel?.name },
    room: row.room
      ? {
          id: row.room_id,
          name: row.room.name,
          type: row.room.room_type,
          rack: Number(row.room.rack_rate),
        }
      : { id: row.room_id },
    guest: guest || null,
  };
}

// A pending/countered request whose expires_at has passed reads as "expired" in
// the UI without needing a DB write (guests can't update non-countered rows).
export function effectiveStatus(bid) {
  if (
    (bid.status === "pending" || bid.status === "countered") &&
    bid.expiresAt &&
    Date.now() > new Date(bid.expiresAt).getTime()
  ) {
    return "expired";
  }
  return bid.status;
}

export function secondsLeft(bid) {
  if (!bid?.expiresAt) return 0;
  return Math.max(0, Math.round((new Date(bid.expiresAt).getTime() - Date.now()) / 1000));
}

const guestEmbed = "*, room:rooms(name,room_type,rack_rate), hotel:hotels(name)";

// ── Auth ──────────────────────────────────────────────────────────────────────
export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}
export function onAuthChange(cb) {
  return supabase.auth.onAuthStateChange((_event, session) => cb(session));
}
export async function sendOtp(email) {
  return supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
}
export async function verifyOtp(email, token) {
  return supabase.auth.verifyOtp({ email, token, type: "email" });
}
export async function signOut() {
  return supabase.auth.signOut();
}

// ── Guest profile ──────────────────────────────────────────────────────────────
export async function ensureGuestProfile(user, name) {
  const payload = { id: user.id };
  if (name) payload.name = name;
  const { error } = await supabase
    .from("guest_profiles")
    .upsert(payload, { onConflict: "id", ignoreDuplicates: false });
  if (error) throw error;
  return getGuestProfile(user.id);
}
export async function getGuestProfile(userId) {
  const { data } = await supabase
    .from("guest_profiles")
    .select("id,name,rating,stays_count,created_at")
    .eq("id", userId)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    name: data.name || "Guest",
    rating: Number(data.rating || 0),
    stays: data.stays_count || 0,
    reviews: 0,
    verified: false,
    memberSince: data.created_at ? new Date(data.created_at).getFullYear().toString() : "—",
  };
}

// ── Browse (guest-facing reads — never selects bid_floor) ──────────────────────
export async function getHotelsWithRooms() {
  const { data, error } = await supabase
    .from("hotels")
    .select(
      "id,name,location,city,tagline,rating,review_count," +
        "rooms(id,hotel_id,name,room_type,sqft,floor,rack_rate,amenities,available_tonight)"
    )
    .order("name");
  if (error) throw error;
  return (data || [])
    .map(mapHotel)
    .map((h) => ({ ...h, rooms: h.rooms.filter((r) => r.available !== false) }))
    .filter((h) => h.rooms.length > 0);
}

// ── Guest request writes/reads ─────────────────────────────────────────────────
export async function submitBid({ hotelId, roomId, guestId, amount }) {
  const { data, error } = await supabase
    .from("requests")
    .insert({
      hotel_id: hotelId,
      room_id: roomId,
      guest_id: guestId,
      bid_amount: amount,
      status: "pending",
      expires_at: new Date(Date.now() + TIMER_SECONDS * 1000).toISOString(),
    })
    .select(guestEmbed)
    .single();
  if (error) throw error;
  return mapRequest(data);
}

export async function getMyRequests(guestId, guest) {
  const { data, error } = await supabase
    .from("requests")
    .select(guestEmbed)
    .eq("guest_id", guestId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map((r) => mapRequest(r, guest));
}

export async function acceptCounter(id) {
  const { error } = await supabase
    .from("requests")
    .update({ status: "accepted", confirmation_code: genCode(), resolved_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}
export async function declineCounter(id) {
  const { error } = await supabase
    .from("requests")
    .update({ status: "declined", resolved_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

// ── Hotel dashboard ────────────────────────────────────────────────────────────
export async function getOwnerHotel(userId) {
  const { data, error } = await supabase
    .from("hotels")
    .select("id,name,location,city,tagline,rating,review_count")
    .eq("owner_user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapHotel(data) : null;
}

// Reads rooms WITH bid_floor via the SECURITY DEFINER RPC (column is revoked for
// direct selects, exposed only to the owning hotel through this function).
export async function getOwnerRooms() {
  const { data, error } = await supabase.rpc("owner_rooms");
  if (error) throw error;
  return (data || []).map(mapRoom);
}

export async function getHotelRequests(hotelId) {
  const { data, error } = await supabase
    .from("requests")
    .select(guestEmbed)
    .eq("hotel_id", hotelId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const rows = data || [];

  // guest_profiles isn't FK-embeddable from requests; fetch the visible ones.
  const guestIds = [...new Set(rows.map((r) => r.guest_id))];
  let profiles = {};
  if (guestIds.length) {
    const { data: gp } = await supabase
      .from("guest_profiles")
      .select("id,name,rating,stays_count,created_at")
      .in("id", guestIds);
    (gp || []).forEach((g) => {
      profiles[g.id] = {
        email: g.id,
        name: g.name || "Guest",
        rating: Number(g.rating || 0),
        stays: g.stays_count || 0,
        reviews: 0,
        verified: false,
        memberSince: g.created_at ? new Date(g.created_at).getFullYear().toString() : "—",
      };
    });
  }
  return rows.map((r) => mapRequest(r, profiles[r.guest_id] || { email: r.guest_id, name: "Guest", rating: 0, stays: 0 }));
}

export async function hotelDecide(id, status) {
  const patch = { status, resolved_at: new Date().toISOString() };
  if (status === "accepted") patch.confirmation_code = genCode();
  const { error } = await supabase.from("requests").update(patch).eq("id", id);
  if (error) throw error;
}

export async function hotelCounter(id, amount) {
  const { error } = await supabase
    .from("requests")
    .update({
      status: "countered",
      counter_amount: amount,
      expires_at: new Date(Date.now() + COUNTER_TIMER * 1000).toISOString(),
    })
    .eq("id", id);
  if (error) throw error;
}

export async function setBidFloor(roomId, amount) {
  const { error } = await supabase.from("rooms").update({ bid_floor: amount }).eq("id", roomId);
  if (error) throw error;
}

// ── Realtime ───────────────────────────────────────────────────────────────────
export function subscribeRequests(column, value, cb) {
  const channel = supabase
    .channel(`reqs-${column}-${value}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "requests", filter: `${column}=eq.${value}` },
      (payload) => cb(payload)
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
}
