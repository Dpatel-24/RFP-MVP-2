# LastKey — Private Rate Request MVP

A direct-to-consumer hotel room bidding platform. Guests submit rate requests, hotels respond within 10 minutes.

## What's included

- **Guest interface** — browse available rooms, submit a rate request, watch live countdown
- **Hotel dashboard** — real-time bid notifications, accept/decline with timer, bid floor settings, history

## Quick Start (Local)

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Deploy to Vercel (2 minutes)

### Option A: Vercel CLI
```bash
npm i -g vercel
vercel
```

### Option B: GitHub → Vercel
1. Push this folder to a GitHub repo
2. Go to [vercel.com](https://vercel.com) → New Project
3. Import your repo — Vercel auto-detects Next.js
4. Click Deploy

Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (see
`.env.local.example`). The anon key is safe to expose — Row Level Security is
the gate. Add the same two vars in the Vercel project settings.

## How to test the full flow

1. Open the app — you start on **Guest View**
2. Pick a room → enter a name, email, and bid amount
3. Submit — a 10-minute countdown starts
4. Switch to **Hotel Dashboard** (toggle top-right)
5. See the live bid appear with its own timer
6. Click **Accept** or **Decline**
7. Switch back to Guest View — result is shown instantly

## Bid floor logic

- Set per-room in **Hotel Dashboard → Room Settings**
- If a guest bids below the floor, the request is instantly declined
- The floor is **never shown to the guest**

## Data layer

State is backed by Supabase (project `kzzlfubehktzsuxutwmd`), not in-memory:

- **Auth** — email OTP via Supabase Auth for both guests and hotels.
- **Browse** — `getHotelsWithRooms()` reads hotels + rooms (never `bid_floor`,
  which is column-revoked for guests).
- **Bids** — a `requests` row is inserted on submit; a `BEFORE INSERT` trigger
  auto-declines any bid below the room's hidden `bid_floor`.
- **Realtime** — guest and hotel views subscribe to `requests` changes, so
  accept/decline/counter propagate live (no SMS, in-app only).
- **Bid floor** — the dashboard reads it through the `owner_rooms()` RPC, gated
  to the owning hotel.

LastKey is a messenger only: no payments and no SMS. On acceptance the guest
gets a confirmation code to present at check-in; the hotel keys the booking into
its own PMS.

> One-time setup per property: after a hotel signs in via OTP, set
> `hotels.owner_user_id` to that auth user's id so the dashboard resolves it.

## Next steps

- [ ] Add a shareable guest link (e.g. `yourhotel.com/tonight`)
- [ ] Google OAuth for guest login (dashboard config, no code change)
- [ ] Image gallery cards once storage bucket + uploads exist

## Tech stack

- Next.js 14 (Pages Router)
- React 18
- Supabase (`@supabase/supabase-js`) — Postgres, Auth, Realtime, RLS
- No external UI libraries
