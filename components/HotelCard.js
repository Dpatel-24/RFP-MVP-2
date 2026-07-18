// Guest-facing hotel card (image, name, from-price, city map link, rating).
// Pure presentational: everything arrives via props — no Supabase calls, no
// internal state. Used on the homepage "Available tonight" grid.
import { StarDisplay, SL } from "../lib/components";
import { elevation, color } from "../lib/tokens";

const HERO_FALLBACK = "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=1600&q=80";

export function HotelCard({ hotel, onSelect }) {
  const fromPrice = Math.min(...hotel.rooms.map(r => r.rack));
  return (
    <div style={SL.card} onClick={() => onSelect(hotel)}
      onMouseEnter={e=>{e.currentTarget.style.boxShadow=elevation.interactiveHover; e.currentTarget.style.transform="translateY(-2px)";}}
      onMouseLeave={e=>{e.currentTarget.style.boxShadow=elevation.interactiveResting; e.currentTarget.style.transform="none";}}>
      <div style={{ position:"relative" }}>
        <img src={hotel.heroImage || HERO_FALLBACK} alt="" loading="lazy"
          style={{ width:"100%", height:190, objectFit:"cover", display:"block" }} />
        <span style={SL.tonightTag}>{hotel.rooms.length} room{hotel.rooms.length>1?"s":""} left tonight</span>
      </div>
      <div style={{ padding:"14px 16px 16px" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:10 }}>
          <div style={{ fontFamily:"Space Grotesk,sans-serif", fontWeight:700, fontSize:16, lineHeight:1.25 }}>{hotel.name}</div>
          <div style={{ textAlign:"right", flexShrink:0 }}>
            <div style={{ fontSize:11, color:color.faint }}>from</div>
            <div style={{ fontFamily:"Space Grotesk,sans-serif", fontWeight:700, fontSize:20, color:color.price }}>${fromPrice}</div>
          </div>
        </div>
        <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(hotel.name + ' ' + hotel.location)}`}
          target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()}
          style={{ display:"inline-block", fontSize:13, color:color.muted, marginTop:3, textDecoration:"none", cursor:"pointer" }}
          onMouseEnter={e=>{ e.currentTarget.style.textDecoration="underline"; }}
          onMouseLeave={e=>{ e.currentTarget.style.textDecoration="none"; }}>
          {hotel.city || hotel.location}
        </a>
        <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:8 }}>
          <StarDisplay rating={hotel.rating} />
          <span style={{ fontSize:12, color:color.muted }}>{hotel.rating} ({hotel.reviewCount} reviews)</span>
        </div>
      </div>
    </div>
  );
}
