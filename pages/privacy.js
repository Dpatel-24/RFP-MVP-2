// TODO: extract shared Header component (replicated inline here, in terms.js,
// and in for-hotels.js per the no-refactor-of-index.js constraint).
// Privacy Policy — structure only; every section body is {LEGAL COPY PENDING}.
// This page must stay live: Google OAuth verification requires a reachable
// privacy policy URL.
import { useState } from "react";
import Head from "next/head";
import { useWindowWidth, MOBILE_BREAKPOINT, SL } from "../lib/components";

const SECTIONS = [
  ["What we collect", "We collect the information you give us when you create an account and use LastKey: email address, first and last name, phone number, and your bid history (offers made, amounts, and outcomes). {LEGAL COPY PENDING}"],
  ["How we use it", "Account information is used to operate your profile, deliver your rate requests to hotels, and show hotels your star rating and stay count (never your name, email, or phone). {LEGAL COPY PENDING}"],
  ["Supabase as data processor", "LastKey stores account and request data with Supabase, which acts as our hosting and database processor. {LEGAL COPY PENDING}"],
  ["Google OAuth data", "If you sign in with Google, we receive your email address and basic profile information from Google and use it only to create and operate your LastKey account. {LEGAL COPY PENDING}"],
  ["No payment data", "LastKey does not collect or store payment card data. If a hotel accepts your rate, you pay the hotel directly at check-in. {LEGAL COPY PENDING}"],
  ["Contact", "Questions about this policy: {LEGAL COPY PENDING — contact email}."],
  ["Effective date", "{LEGAL COPY PENDING — effective date}."],
];

export default function PrivacyPage() {
  const width = useWindowWidth();
  const isMobile = width < MOBILE_BREAKPOINT;
  const [menuOpen, setMenuOpen] = useState(false);
  const pad = isMobile ? "48px 20px" : "80px 24px";

  return (
    <>
      <Head>
        <title>Privacy Policy — LastKey</title>
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
              <a href="/for-hotels" style={SL.headerLink}>List your property</a>
              <a href="/" style={{ ...SL.ghostBtn, padding:"9px 16px", fontSize:13.5, textDecoration:"none" }}>Register</a>
              <a href="/" style={{ ...SL.headerBtnPrimary, textDecoration:"none" }}>Sign in</a>
            </div>
          ) : (
            <button style={SL.hamburgerBtn} onClick={() => setMenuOpen(o => !o)} aria-label="Menu">☰</button>
          )}
        </div>
        {isMobile && menuOpen && (
          <div style={SL.mobileMenuPanel}>
            <a href="/for-hotels" style={SL.mobileMenuItem}>List your property</a>
            <a href="/" style={SL.mobileMenuItem}>Register</a>
            <a href="/" style={SL.mobileMenuItem}>Sign in</a>
          </div>
        )}
      </header>

      <main style={{ ...SL.wrap, padding: pad }}>
        <h1 style={SL.h1}>Privacy Policy</h1>
        <p style={{ fontSize:14, color:SL.sub, lineHeight:1.7, margin:"14px 0 28px" }}>
          Draft structure — all copy below is pending legal review and is not final.
        </p>
        {SECTIONS.map(([title, body]) => (
          <section key={title} style={{ ...SL.panel, padding:"22px 24px", marginBottom:14 }}>
            <h2 style={{ ...SL.h1, fontSize:17, marginBottom:8 }}>{title}</h2>
            <p style={{ fontSize:14, color:SL.sub, lineHeight:1.7, margin:0 }}>{body}</p>
          </section>
        ))}
      </main>

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
