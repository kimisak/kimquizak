export function GeoguesserSetupInfo() {
  return <aside className="geo-setup-info" aria-label="Geoguesser setup">
    <strong>Street View requires host login and setup</strong>
    <p>Interactive Geoguesser is unavailable to visitors who are not signed in as the host. There is no offline or image fallback.</p>
    <p>Hosting your own KimQuizak? The setup guide covers Google Cloud, Supabase, and Vercel.</p>
    <div className="geo-setup-info-links">
      <a href="/login" target="_blank" rel="noopener noreferrer">Host login ↗</a>
      <a href="https://github.com/kimisak/kimquizak/blob/main/README.md#self-hosting-guide" target="_blank" rel="noopener noreferrer">Read the setup guide ↗</a>
    </div>
    <small>After signing in or completing setup, reload this page to try again.</small>
  </aside>;
}
