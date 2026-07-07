// TODO: extract shared Header component (replicated inline here, in privacy.js,
// and in for-hotels.js per the no-refactor-of-index.js constraint).
// Terms of Service — structure only; every section body is {LEGAL COPY PENDING}.
import { useState } from "react";
import Head from "next/head";
import { useWindowWidth, MOBILE_BREAKPOINT, SL } from "../lib/components";

const SECTIONS = [
  ["Nature of the service", "LastKey delivers guest-initiated private rate requests to hotels. It is not a public discount, published rate, or OTA booking; each offer is a private negotiation the guest starts. {LEGAL COPY PENDING}"],
  ["No payment through the platform", "LastKey does not process payments. If a hotel accepts your rate, you pay the hotel directly at check-in under the hotel's own payment terms. {LEGAL COPY PENDING}"],
  ["Confirmation codes", "A confirmation code evidences the accepted rate for your stay. It is not a guarantee of room condition, amenities, or fitness for a particular purpose. {LEGAL COPY PENDING}"],
  ["Hotel policies", "Each hotel sets and enforces its own deposit, identification, and check-in policies. Review them with the hotel before arrival. {LEGAL COPY PENDING}"],
  ["Bids are binding offers", "Submitting a rate request creates a binding offer for the duration of the response window. If the hotel accepts within that window, you are expected to honor the stay at the accepted rate. {LEGAL COPY PENDING}"],
  ["Account terms", "You are responsible for the accuracy of your account information and the security of your credentials. {LEGAL COPY PENDING}"],
  ["Limitation of liability", "{LEGAL COPY PENDING}"],
  ["Effective date", "{LEGAL COPY PENDING — effective date}."],
];

export default function TermsPage() {
  const width = useWindowWidth();
  const isMobile = width < MOBILE_BREAKPOINT;
  const [menuOpen, setMenuOpen] = useState(false);
  const pad = isMobile ? "48px 20px" : "80px 24px";

  return (
    <>
      <Head>
        <title>Terms of Service — LastKey</title>
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
        <h1 style={SL.h1}>Terms of Service</h1>
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
