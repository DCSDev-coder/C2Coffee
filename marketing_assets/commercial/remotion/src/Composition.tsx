import React from "react";
import { AbsoluteFill, Composition, Easing, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

const C = { espresso: "#25001f", plum: "#650052", blush: "#f8eaf4", cream: "#fffaf4", gold: "#dcb36a" };
const screens = {
  home: staticFile("latest/Home.PNG"),
  menu: staticFile("latest/Menu.PNG"),
  bestSeller: staticFile("latest/Best Seller.PNG"),
  reward: staticFile("latest/Reward.PNG"),
  tier: staticFile("latest/Tier.PNG"),
  profile: staticFile("latest/Profile.PNG"),
  news: staticFile("latest/News.PNG"),
  partner: staticFile("latest/PartnerSpotlight.PNG"),
};
const ease = Easing.bezier(0.16, 1, 0.3, 1);

function Ambient({ frame }: { frame: number }) {
  const drift = Math.sin(frame / 38) * 18;
  return <>
    <div style={{ position: "absolute", inset: 0, background: `radial-gradient(circle at 50% 42%, #60321f 0%, ${C.espresso} 42%, #100907 100%)` }} />
    <div style={{ position: "absolute", width: 600, height: 600, borderRadius: "50%", left: -180 + drift, top: 190, background: C.plum, filter: "blur(110px)", opacity: 0.5 }} />
    <div style={{ position: "absolute", width: 520, height: 520, borderRadius: "50%", right: -170 - drift, bottom: 260, background: "#dc73c4", filter: "blur(120px)", opacity: 0.24 }} />
    <div style={{ position: "absolute", inset: 0, opacity: 0.14, backgroundImage: "radial-gradient(#f8efe1 1px, transparent 1px)", backgroundSize: "34px 34px" }} />
  </>;
}

function Wordmark() {
  return <div style={{ display: "flex", alignItems: "center", gap: 16 }}><Img src={staticFile("c2-logo.png")} style={{ width: 62, height: 62, objectFit: "contain", filter: "brightness(0) invert(1)" }} /><span style={{ fontFamily: "Afacad", fontSize: 32, letterSpacing: 5, color: C.cream }}>C2 COFFEE</span></div>;
}

function Phone({ frame, source, hero }: { frame: number; source: string; hero: boolean }) {
  const { fps } = useVideoConfig();
  const entrance = spring({ frame, fps, config: { damping: 17, stiffness: 90, mass: 0.8 } });
  const float = Math.sin(frame / 18) * 14;
  const scale = hero ? 1.06 : interpolate(entrance, [0, 1], [0.62, 0.94]);
  const y = hero ? float : interpolate(entrance, [0, 1], [520, 90]) + float;
  const rotate = Math.sin(frame / 42) * 2.6;
  return <div style={{ position: "absolute", width: 610, height: 1240, left: "50%", top: "50%", transform: `translate(-50%, -50%) translateY(${y}px) scale(${scale}) rotateZ(${rotate}deg)`, borderRadius: 82, background: "linear-gradient(130deg, #5a514a 0%, #0b0b0d 15%, #050506 70%, #75685d 100%)", boxShadow: "0 50px 90px rgba(0,0,0,.48), inset 0 0 0 5px rgba(255,255,255,.13)", padding: 18, overflow: "hidden", zIndex: 4 }}>
    <div style={{ position: "absolute", top: 24, left: "50%", transform: "translateX(-50%)", width: 160, height: 34, borderRadius: 24, background: "#050505", zIndex: 3 }} />
    <Img src={source} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top center", borderRadius: 66, display: "block" }} />
    <div style={{ position: "absolute", inset: 18, borderRadius: 66, boxShadow: "inset 0 0 0 2px rgba(255,255,255,.28)" }} />
  </div>;
}

function Splash({ frame }: { frame: number }) {
  const opacity = interpolate(frame, [0, 12, 54, 72], [0, 1, 1, 0], { extrapolateRight: "clamp", easing: ease });
  return <AbsoluteFill style={{ opacity, zIndex: 6, background: "rgba(37,0,31,.3)", display: "flex", alignItems: "center", justifyContent: "center" }}><div style={{ width: 310, height: 310, borderRadius: 80, background: C.plum, boxShadow: "0 0 90px rgba(220,115,196,.58)", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 20 }}><Img src={staticFile("c2-logo.png")} style={{ width: 120, height: 120, objectFit: "contain", filter: "brightness(0) invert(1)" }} /><div style={{ width: 42, height: 42, border: "4px solid rgba(255,255,255,.35)", borderTopColor: "white", borderRadius: "50%", transform: `rotate(${frame * 8}deg)` }} /></div></AbsoluteFill>;
}

function Headline({ children, frame, start, end, color = C.cream }: { children: React.ReactNode; frame: number; start: number; end: number; color?: string }) {
  const opacity = interpolate(frame, [start, start + 12, end - 12, end], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
  const y = interpolate(frame, [start, start + 18], [38, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
  return <div style={{ position: "absolute", top: 150, left: 80, right: 80, textAlign: "center", opacity, transform: `translateY(${y}px)`, fontFamily: "Recoleta", fontSize: 76, lineHeight: 1.04, color }}>{children}</div>;
}

function Pill({ children, frame, start }: { children: React.ReactNode; frame: number; start: number }) {
  const opacity = interpolate(frame, [start, start + 14, start + 76, start + 92], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
  const scale = interpolate(frame, [start, start + 18], [0.88, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
  return <div style={{ position: "absolute", bottom: 170, left: "50%", transform: `translateX(-50%) scale(${scale})`, opacity, padding: "18px 34px", borderRadius: 50, background: "rgba(248,239,225,.12)", border: "1px solid rgba(248,239,225,.35)", color: C.cream, fontFamily: "Afacad", fontSize: 34, letterSpacing: 1 }}>{children}</div>;
}

export const MyComponent: React.FC = () => {
  const frame = useCurrentFrame();
  const loadingEnd = 78;
  const source = frame < 110 ? screens.home : frame < 220 ? screens.menu : frame < 310 ? screens.bestSeller : frame < 420 ? screens.reward : frame < 510 ? screens.tier : frame < 590 ? screens.profile : frame < 650 ? screens.news : screens.partner;
  const ctaOpacity = interpolate(frame, [690, 735], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
  return <AbsoluteFill style={{ backgroundColor: C.espresso, overflow: "hidden", fontFamily: "Afacad" }}>
    <style>{`@font-face{font-family:Recoleta;src:url(${staticFile("fonts/recoleta-bold.woff2")})} @font-face{font-family:Afacad;src:url(${staticFile("fonts/afacad-regular.woff2")})} @font-face{font-family:Afacad;src:url(${staticFile("fonts/afacad-semibold.woff2")});font-weight:600}`}</style>
    <Ambient frame={frame} />
    <div style={{ position: "absolute", top: 94, left: 70, right: 70, display: "flex", justifyContent: "space-between", alignItems: "center", zIndex: 10, opacity: interpolate(frame, [0, 50], [0, 1], { extrapolateRight: "clamp" }) }}><Wordmark /></div>
    <Phone frame={frame} source={source} hero={frame < loadingEnd} />
    <Splash frame={frame} />
    <Headline frame={frame} start={78} end={170}>Your C2 moment<br />starts here.</Headline>
    <Headline frame={frame} start={180} end={285} color={C.gold}>Discover favourites.<br />Order with tokens.</Headline>
    <Headline frame={frame} start={300} end={410}>Every visit brings<br />more rewards.</Headline>
    <Headline frame={frame} start={430} end={545} color={C.gold}>Level up your<br />coffee journey.</Headline>
    <Headline frame={frame} start={560} end={675}>Offers, stories<br />and community.</Headline>
    <Pill frame={frame} start={92}>Coffee, rewards and more in one app</Pill>
    <Pill frame={frame} start={195}>Browse the menu and find your next favourite</Pill>
    <Pill frame={frame} start={325}>Collect cups. Unlock exclusive benefits.</Pill>
    <Pill frame={frame} start={570}>Stay close to everything C2</Pill>
    <AbsoluteFill style={{ opacity: ctaOpacity, zIndex: 12, background: `linear-gradient(145deg, ${C.espresso}, ${C.plum})`, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 30 }}><Img src={staticFile("c2-logo.png")} style={{ width: 190, height: 190, objectFit: "contain", filter: "brightness(0) invert(1)" }} /><div style={{ color: C.cream, fontFamily: "Recoleta", fontSize: 86, textAlign: "center", lineHeight: 1.05 }}>Good coffee.<br />Brighter days.</div><div style={{ color: C.gold, fontFamily: "Afacad", fontWeight: 600, fontSize: 42, letterSpacing: 4 }}>C2 COFFEE APP</div><div style={{ marginTop: 22, padding: "20px 48px", borderRadius: 60, background: C.blush, color: C.plum, fontFamily: "Afacad", fontSize: 36, fontWeight: 600 }}>SOFT LAUNCH 2026</div></AbsoluteFill>
  </AbsoluteFill>;
};

export const MyComposition = () => <Composition id="C2SoftLaunchCommercial" component={MyComponent} durationInFrames={750} fps={30} width={1080} height={1920} />;
