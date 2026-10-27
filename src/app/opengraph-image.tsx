import { ImageResponse } from "next/og";

export const alt = "KimQuizak — Remember the game. A preview of the quiz board with categories and point tiles.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// A public, deterministic preview: no saved quizzes, player names or login needed.
export default function SocialPreview() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#0d2016", color: "#fff8e8", padding: 46, backgroundImage: "radial-gradient(ellipse at 90% 10%, #29603a 0%, transparent 65%)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 52, height: 52, borderRadius: 14, background: "#ead08d", color: "#0d2016", fontSize: 28, fontWeight: 900 }}>KQ</div>
        <span style={{ fontSize: 30, fontWeight: 700, letterSpacing: -1 }}>KimQuizak</span>
        <span style={{ marginLeft: "auto", color: "#ead08d", fontSize: 17 }}>YOUR EVENING. YOUR SHOW.</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", flex: 1, gap: 34 }}>
        <div style={{ display: "flex", flexDirection: "column", width: 524 }}>
          <span style={{ fontSize: 17, letterSpacing: 3, color: "#ead08d", marginBottom: 20 }}>QUIZ NIGHT, LEVELLED UP</span>
          <div style={{ display: "flex", flexDirection: "column", fontSize: 66, fontWeight: 900, letterSpacing: -3, lineHeight: 1.06 }}>
            <span>Remember</span>
            <span style={{ color: "#ead08d" }}>the game.</span>
          </div>
          <span style={{ fontSize: 22, color: "#e0d5bd", marginTop: 24, lineHeight: 1.4 }}>Your questions. Your teams.<br />Their bragging rights.</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: 16, border: "1px solid #ead08d66", borderRadius: 22, background: "#07190f", boxShadow: "0 16px 40px #00000044", transform: "rotate(-3deg)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 4px 15px", color: "#ead08d", fontSize: 13, letterSpacing: 2 }}>
            <span>THE BOARD IS YOURS</span><span>LET’S PLAY</span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {["SCREEN TIME", "BRAIN FOOD", "WILD CARD"].map((category) => (
              <div key={category} style={{ display: "flex", flexDirection: "column", flex: 1, gap: 8 }}>
                <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 48, background: "#ead08d", borderRadius: 8, color: "#2d211b", fontSize: 13, fontWeight: 700 }}>{category}</div>
                {[100, 200, 300, 400].map((points) => (
                  <div key={points} style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 58, background: "#18452c", border: "1px solid #4b7450", borderBottom: "4px solid #0e2d1c", borderRadius: 9, color: "#fff8e8", fontSize: 29, fontWeight: 700 }}>{points}</div>
                ))}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "center", paddingTop: 15, color: "#e0d5bd", fontSize: 14 }}>TRIVIA · PUZZLES · TEAM RIVALRIES</div>
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 14, borderTop: "1px solid #ead08d44", fontSize: 17 }}>
        <span style={{ color: "#e0d5bd" }}>Build the board. Bring your people. Run the show.</span>
        <span style={{ color: "#ead08d", fontWeight: 700 }}>kimquizak.com</span>
      </div>
    </div>,
    size,
  );
}
