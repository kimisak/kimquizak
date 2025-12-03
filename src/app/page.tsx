import { StorageBackupPanel } from "@/components/StorageBackupPanel";

export default function Home() {
  return (
    <main
      className="card"
      style={{
        padding: "32px",
      }}
    >
      <h1 style={{ fontSize: "2.4rem", marginBottom: "10px" }}>
        Julebord Jeopardy
      </h1>
      <p style={{ color: "var(--muted)", marginBottom: "20px" }}>
        Configure teams, enter categories and clues, then run the board from one
        screen. All data stays in your browser (localStorage).
      </p>
      <div
        style={{
          display: "grid",
          gap: "16px",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
        }}
      >
        <div className="card" style={{ padding: "16px 18px" }}>
          <div style={{ fontWeight: 700, marginBottom: "6px" }}>1) Teams</div>
          <p style={{ color: "var(--muted)", margin: "0 0 12px" }}>
            Create 3–5 teams, name them, and list the players.
          </p>
          <a className="button secondary" href="/config/teams">
            Open team config
          </a>
        </div>
        <div className="card" style={{ padding: "16px 18px" }}>
          <div style={{ fontWeight: 700, marginBottom: "6px" }}>
            2) Categories & clues
          </div>
          <p style={{ color: "var(--muted)", margin: "0 0 12px" }}>
            Enter questions and answers for 100–500 points for each category.
          </p>
          <a className="button secondary" href="/config/questions">
            Open question config
          </a>
        </div>
        <div className="card" style={{ padding: "16px 18px" }}>
          <div style={{ fontWeight: 700, marginBottom: "6px" }}>3) Play</div>
          <p style={{ color: "var(--muted)", margin: "0 0 12px" }}>
            Run the game board, show the modal, and score teams live.
          </p>
          <a className="button primary" href="/game">
            Go to board
          </a>
        </div>
      </div>
      <div className="card" style={{ padding: "16px 18px", marginTop: "16px" }}>
        <StorageBackupPanel />
      </div>
    </main>
  );
}
