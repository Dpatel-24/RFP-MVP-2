import { supabase } from "./supabaseClient";

// Timing constants — source of truth is requests.expires_at in the DB; these are
// used to set that column on write and to drive the display countdown.
export const TIMER_SECONDS = 600; // initial bid window
export const COUNTER_TIMER = 300; // guest's window to answer a counter
export const TAX_RATE = 0.14;     // est. taxes shown to guests at confirm/live

function genCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

// Local YYYY-MM-DD (avoids UTC day-drift for "same day" stays).
export function localDateStr(d = new Date()) {
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

// Current hotel "booking day" as a local YYYY-MM-DD. The hotel day starts at
// 6 AM, so between midnight and 5:59 AM we count the previous calendar date.
// Uses LOCAL date (via localDateStr) so it matches stored stay_date and never
// drifts by UTC — that consistency is required for the same-day filters.
export function getTodayKey() {
  const now = new Date();
  if (now.getHours() < 6) now.setDate(now.getDate() - 1);
  return localDateStr(now);
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
    // Prefer the rooms.image_url column (owner-uploaded photo); fall back to the
    // legacy imageUrl column. The images table is layered on in getOwnerRooms.
    imageUrl: r.image_url || r.imageUrl || null,
    available: r.available_tonight,
    inventoryCount: r.inventory_count != null ? r.inventory_count : undefined,
    isActive: r.is_active != null ? r.is_active : true,
    // bid_floor only present when sourced from owner_rooms() RPC
    floor_price: r.bid_floor != null ? Number(r.bid_floor) : undefined,
  };
}

function mapHotel(h) {
  const images = h.images || [];
  const hero = images
    .filter((i) => i.room_id == null)
    .sort((a, b) => (a.position || 0) - (b.position || 0))[0];
  const roomImage = (roomId) =>
    images
      .filter((i) => i.room_id === roomId)
      .sort((a, b) => (a.position || 0) - (b.position || 0))[0]?.url || null;
  return {
    id: h.id,
    name: h.name,
    location: h.location,
    city: h.city,
    tagline: h.tagline,
    rating: Number(h.rating),
    reviewCount: h.review_count,
    heroImage: hero?.url || null,
    googlePlaceId: h.google_place_id || null, // [GOOGLE-REVIEWS TEST]
    rooms: (h.rooms || []).map((r) => mapRoom({ ...r, imageUrl: roomImage(r.id) })),
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
    stayDate: row.stay_date || null,
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
export async function signIn(email, password) {
  return supabase.auth.signInWithPassword({ email, password });
}
export async function signUp(email, password) {
  return supabase.auth.signUp({ email, password });
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
    .select("id,name,first_name,last_name,phone,rating,stays_count,created_at")
    .eq("id", userId)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    name: data.name || "Guest",
    firstName: data.first_name || "",
    lastName: data.last_name || "",
    phone: data.phone || "",
    rating: Number(data.rating || 0),
    stays: data.stays_count || 0,
    reviews: 0,
    verified: false,
    memberSince: data.created_at ? new Date(data.created_at).getFullYear().toString() : "—",
  };
}

// Guest edits their own profile (RLS guest_self_all gates this).
export async function updateGuestProfile(userId, { firstName, lastName, phone }) {
  const name = [firstName, lastName].filter(Boolean).join(" ").trim();
  const { error } = await supabase
    .from("guest_profiles")
    .update({ first_name: firstName, last_name: lastName, phone, name: name || null })
    .eq("id", userId);
  if (error) throw error;
}

// ── Browse (guest-facing reads — never selects bid_floor) ──────────────────────
export async function getHotelsWithRooms() {
  const { data, error } = await supabase
    .from("hotels")
    .select(
      "id,name,location,city,tagline,rating,review_count,google_place_id," + // google_place_id: [GOOGLE-REVIEWS TEST]
        "rooms(id,hotel_id,name,room_type,sqft,floor,rack_rate,amenities,available_tonight)," +
        "images(url,position,room_id)"
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
      stay_date: localDateStr(),
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

// Guest soft-cancels a still-open request. RLS guest_self_all gates the update.
export async function cancelRequest(id) {
  const { error } = await supabase
    .from("requests")
    .update({ status: "cancelled", resolved_at: new Date().toISOString() })
    .eq("id", id)
    .in("status", ["pending", "countered"]);
  if (error) throw error;
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
  const rooms = (data || []).filter((r) => r.is_active !== false).map(mapRoom);
  // Attach room images (images table is public-read).
  const ids = rooms.map((r) => r.id);
  if (ids.length) {
    const { data: imgs } = await supabase
      .from("images")
      .select("url,position,room_id")
      .in("room_id", ids);
    const byRoom = {};
    (imgs || []).forEach((i) => {
      if (!byRoom[i.room_id] || (i.position || 0) < (byRoom[i.room_id].position || 0)) byRoom[i.room_id] = i;
    });
    // Keep an uploaded image_url (set on the room) if present; otherwise fall
    // back to the images table. Backward-compatible: when image_url is null
    // (today), this resolves exactly as before.
    rooms.forEach((r) => { r.imageUrl = r.imageUrl || byRoom[r.id]?.url || null; });
  }
  return rooms;
}

// ── Owner inventory / room management (RLS rooms_owner_all gates these) ─────────
export async function setInventory(roomId, count) {
  const c = Math.max(0, count);
  const { error } = await supabase
    .from("rooms")
    .update({ inventory_count: c, available_tonight: c > 0 })
    .eq("id", roomId);
  if (error) throw error;
}

export async function updateRoom(roomId, fields) {
  const { error } = await supabase.from("rooms").update(fields).eq("id", roomId);
  if (error) throw error;
}

// Owner uploads a room photo to the "room-images" storage bucket and saves the
// resulting public URL to rooms.image_url. Returns the public URL.
// One photo per room at a STABLE key ({hotelId}/{roomId}/cover) with upsert, so
// re-uploading replaces the file in place — no orphaned objects accumulate.
// Because the key is stable the public URL is identical each time, so we append
// a ?v= cache-buster to the saved URL to force the browser to refetch.
// (Bucket + image_url column are created by a separate migration.)
export async function uploadRoomImage(roomId, hotelId, file) {
  const path = `${hotelId}/${roomId}/cover`;
  const { error: upErr } = await supabase.storage
    .from("room-images")
    .upload(path, file, { cacheControl: "3600", upsert: true, contentType: file?.type || undefined });
  if (upErr) throw upErr;
  const { data: pub } = supabase.storage.from("room-images").getPublicUrl(path);
  const url = `${pub?.publicUrl}?v=${Date.now()}`;
  const { error: updErr } = await supabase.from("rooms").update({ image_url: url }).eq("id", roomId);
  if (updErr) throw updErr;
  return url;
}

export async function addRoom(hotelId, { name, room_type, rack_rate, bid_floor, inventory_count, amenities }) {
  const count = Math.max(0, inventory_count ?? 1);
  const { error } = await supabase.from("rooms").insert({
    hotel_id: hotelId,
    name,
    room_type,
    rack_rate,
    bid_floor,
    inventory_count: count,
    available_tonight: count > 0,
    amenities: amenities || [],
    is_active: true,
  });
  if (error) throw error;
}

export async function removeRoom(roomId) {
  const { error } = await supabase
    .from("rooms")
    .update({ is_active: false, available_tonight: false, inventory_count: 0 })
    .eq("id", roomId);
  if (error) throw error;
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

// ── [GOOGLE-REVIEWS — TEST FEATURE] ──────────────────────────────────────────
// Fetch Google reviews for a place via our own server-side proxy
// (/api/google-reviews) so the API key stays server-side. Returns an array
// (possibly empty); any failure resolves to [] so the UI can silently show
// nothing. Delete this function when removing the feature (see lib/GoogleReviews.js).
export async function fetchGoogleReviews(placeId) {
  if (!placeId) return [];
  try {
    const res = await fetch(`/api/google-reviews?place_id=${encodeURIComponent(placeId)}`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data?.reviews) ? data.reviews : [];
  } catch {
    return [];
  }
}
