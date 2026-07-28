// TODO: extract shared Header component (replicated inline here, in privacy.js,
// and in terms.js per the no-refactor-of-index.js constraint).
// Hotel partner landing page — audience is hotel GMs and owners.
import { useState } from "react";
import Head from "next/head";
import { useWindowWidth, MOBILE_BREAKPOINT, SL } from "../lib/components";
import { RESPONSE_LABEL } from "../lib/api";

const STEPS = [
  ["1", "A guest names a price", "Guests browsing tonight's inventory send you a private offer on a specific room. It never appears on any public channel."],
  ["2", `You answer in ${RESPONSE_LABEL}`, "Accept, counter, or decline from your dashboard. Your published rates never move; every response is a one-to-one decision."],
  ["3", "Guest pays you at check-in", "An accepted offer produces a confirmation code. The guest pays you directly at the desk — LastKey never touches the payment."],
];

const VALUE_PROPS = [
  ["No rate parity conflict", "Offers are guest-initiated and private. You are not publishing a discounted rate, so OTA parity clauses are not triggered."],
  ["No commission during the pilot", "Pilot partners pay a flat fee — no percentage of the room rate. {LEGAL COPY PENDING — final pilot pricing}"],
  ["You keep pricing control", "Set a hidden bid floor per room. Offers below it are declined automatically before anyone at the desk lifts a finger."],
];

export default function ForHotelsPage() {
  const width = useWindowWidth();
  const isMobile = width < MOBILE_BREAKPOINT;
  const [menuOpen, setMenuOpen] = useState(false);
  const pad = isMobile ? "48px 20px" : "80px 24px";

  return (
    <>
      <Head>
        <title>For Hotels — LastKey</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="true" />
        <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <header style={SL.headerBar}>
        <div style={SL.headerInner}>
          <a href="/" style={{ display:"flex", alignItems:"center", gap:10, textDecoration:"none" }}>
            <div style={SL.logo}>LK</div>
            <div style={{ fontWeight:700, fontSize:15, color:SL.ink, fontFamily:"Space Grotesk,sans-serif" }}>LastKey</div>
          </a>
          {!isMobile ? (
            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
              <a href="/hotel" style={SL.headerLink}>Partner login</a>
              <a href="/" style={{ ...SL.ghostBtn, padding:"9px 16px", fontSize:13.5, textDecoration:"none" }}>Guest site</a>
              <a href="#contact" style={{ ...SL.headerBtnPrimary, textDecoration:"none" }}>Talk to us</a>
            </div>
          ) : (
            <button style={SL.hamburgerBtn} onClick={() => setMenuOpen(o => !o)} aria-label="Menu">☰</button>
          )}
        </div>
        {isMobile && menuOpen && (
          <div style={SL.mobileMenuPanel}>
            <a href="/hotel" style={SL.mobileMenuItem}>Partner login</a>
            <a href="/" style={SL.mobileMenuItem}>Guest site</a>
            <a href="#contact" style={SL.mobileMenuItem}>Talk to us</a>
          </div>
        )}
      </header>

      {/* Hero — dark, quiet, one message: fill tonight's rooms without touching rates */}
      <section style={{ background:SL.navy, padding: isMobile ? "72px 20px" : "120px 24px", textAlign:"center" }}>
        <h1 style={{ ...SL.heroTitle, fontSize: isMobile ? 32 : 46, maxWidth:760, margin:"0 auto" }}>
          Fill tonight&apos;s unsold rooms without touching your published rates.
        </h1>
        <p style={{ ...SL.heroSub, maxWidth:560 }}>
          Guests send you private offers on rooms that would otherwise sit empty tonight.
          You accept, counter, or decline — quietly, one offer at a time.
        </p>
        <a href="#contact" style={{ ...SL.heroCta, display:"inline-block", marginTop:34, textDecoration:"none" }}>
          Become a pilot partner
        </a>
      </section>

      {/* How it works — hotel side */}
      <section style={{ padding: pad }}>
        <div style={SL.homeLabel}>How it works for your property</div>
        <div style={{ maxWidth:1000, margin: isMobile ? "36px auto 0" : "56px auto 0",
          display:"flex", flexDirection: isMobile ? "column" : "row", gap: isMobile ? 40 : 56 }}>
          {STEPS.map(([n, label, copy]) => (
            <div key={n} style={{ flex:1 }}>
              <div style={SL.stepNumBig}>{n}</div>
              <div style={SL.stepLabel}>{label}</div>
              <div style={SL.stepCopy}>{copy}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Value props */}
      <section style={{ padding: pad, paddingTop: 0 }}>
        <div style={SL.homeLabel}>Why hotels join</div>
        <div style={{ maxWidth:1000, margin: isMobile ? "32px auto 0" : "48px auto 0",
          display:"grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap:22 }}>
          {VALUE_PROPS.map(([title, body]) => (
            <div key={title} style={{ ...SL.panel, padding:"26px 24px" }}>
              <div style={SL.stepLabel}>{title}</div>
              <div style={SL.stepCopy}>{body}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Contact CTA */}
      <section id="contact" style={{ background:SL.navy, padding: pad, textAlign:"center" }}>
        <h2 style={{ fontFamily:"Space Grotesk,sans-serif", fontWeight:700, fontSize: isMobile ? 20 : 24, color:SL.onNavy, margin:0 }}>
          Ready to put empty rooms to work?
        </h2>
        <p style={{ fontSize:15, color:SL.onNavyMuted, margin:"12px auto 0", maxWidth:460, lineHeight:1.6 }}>
          We are onboarding a small group of pilot properties in Greater New Orleans.
        </p>
        <a href="mailto:partners@lastkey.example" style={{ ...SL.heroCta, display:"inline-block", marginTop:26, textDecoration:"none" }}>
          Email us to get started
        </a>
        <p style={{ fontSize:12, color:SL.onNavyMuted, marginTop:14 }}>
          {"{CONTACT METHOD PENDING}"} — replace the placeholder address before sharing this page.
        </p>
      </section>

      <footer style={SL.footerBar}>
        <div style={{ ...SL.footerGrid, gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)" }}>
          <div>
            <div style={{ fontFamily:"Space Grotesk,sans-serif", fontWeight:700, fontSize:18, color:SL.onNavy }}>LastKey</div>
            <div style={{ fontSize:14, color:SL.onNavyMuted, marginTop:10, lineHeight:1.6, maxWidth:280 }}>
              The private bidding platform for same-night hotel rooms.
            </div>
          </div>
          <div>
            <div style={SL.footerHead}>Product</div>
            <a href="/" style={SL.footerLink}>Browse Hotels</a>
            <a href="/" style={SL.footerLink}>How it works</a>
          </div>
          <div>
            <div style={SL.footerHead}>Legal &amp; Partners</div>
            <a href="/privacy" style={SL.footerLink}>Privacy Policy</a>
            <a href="/terms" style={SL.footerLink}>Terms of Service</a>
            <a href="/hotel" style={SL.footerLink}>Hotel Partner Login</a>
          </div>
        </div>
      </footer>
    </>
  );
}
