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

No environment variables needed for this MVP.

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

## Next steps for real MVP

- [ ] Connect Stripe for payment on acceptance
- [ ] Add SMS/push notifications for hotel (Twilio)
- [ ] Replace in-memory state with a real-time database (Supabase or Firebase)
- [ ] Add a shareable guest link (e.g. `yourhotel.com/tonight`)
- [ ] Add check-in date / nights selector
- [ ] Rate parity: position as "Rate Request" not "Discount"

## Tech stack

- Next.js 14 (Pages Router)
- React 18
- No external UI libraries
- No backend (MVP uses in-memory state — resets on refresh)
