'use client';

import Link from "next/link";
import { TeamPill } from "@/components/game/TeamPill";
import { usePersistentState } from "@/hooks/usePersistentState";
import { usePersistentQuestions } from "@/hooks/usePersistentQuestions";
import { useSettings } from "@/hooks/useSettings";
import {
  getThemeById,
  teamThemes,
  type EmojiOption,
} from "@/lib/defaultData";
import { reconcileTeamTheme } from "@/lib/teamPresentation";
import { isQuestionReady } from "@/lib/questionValidation";
import { getVisibleBoardQuestions } from "@/lib/boardReveal";
import { DEFAULT_SETTINGS } from "@/lib/settings";
import {
  LEGACY_TEAM_STORAGE_KEY,
  TEAM_STORAGE_KEY,
} from "@/lib/storage";
import { POINT_STEP, type Team } from "@/lib/types";

export default function Home() {
  const [settings, setSettings] = useSettings();
  const [teams, setTeams] = usePersistentState<Team[]>(TEAM_STORAGE_KEY, [], [LEGACY_TEAM_STORAGE_KEY]);
  const [questions] = usePersistentQuestions();
  const activeTheme = getThemeById(settings.themeId);
  const emojiOptions = activeTheme.options;
  const concealCategoryHeaders = settings.hideCategoryHeadersAtStart !== false;
  const visibleQuestions = getVisibleBoardQuestions(questions, settings.boardRevealRules);
  const previewCategories = Array.from(new Set(
    visibleQuestions.map((question) => question.category),
  )).slice(0, 4);
  const monitorCategories = previewCategories.length ? previewCategories : ["Your board"];
  const previewRowCount = Math.min(4, Math.ceil(Math.max(POINT_STEP, ...visibleQuestions.map((question) => question.points)) / POINT_STEP));

  const applyThemeToTeams = (themeId: string) => {
    setTeams((previous) => previous.map((team) => reconcileTeamTheme(team, themeId)));
  };

  return (
    <main className="home-page">
      <section className="home-hero">
        <div className="home-hero-copy">
          <span className="eyebrow">LIVE QUIZ CONTROL ROOM</span>
          <h1>{settings.quizTitle || DEFAULT_SETTINGS.quizTitle}</h1>
          <p>Build the teams. Load the board. Command the room.</p>
          <div className="hero-actions">
            <Link className="button primary" href="/game">Enter game mode <span aria-hidden>→</span></Link>
            <Link className="button ghost" href="/config/questions">Edit the board</Link>
          </div>
        </div>
        <div className="home-monitor" aria-label="Preview of your quiz board opening state">
          <div className="home-monitor-header"><span>BOARD PREVIEW</span><small>{visibleQuestions.filter(isQuestionReady).length} clues ready</small></div>
          <div className="mini-board" style={{ gridTemplateColumns: `repeat(${monitorCategories.length}, 1fr)` }}>
            {monitorCategories.map((category, index) => (
              <div
                className={`mini-board-category${concealCategoryHeaders ? " concealed" : ""}`}
                key={category}
              >
                {concealCategoryHeaders ? `Reveal ${index + 1}` : category}
              </div>
            ))}
            {Array.from({ length: previewRowCount }, (_, index) => (index + 1) * POINT_STEP).flatMap((points) => monitorCategories.map((category) => {
              const question = visibleQuestions.find((candidate) => candidate.category === category && candidate.points === points);
              return <div className={`mini-board-cell${!question ? " empty" : isQuestionReady(question) ? " ready" : ""}`} key={`${category}-${points}`}>{question ? points : null}</div>;
            }))}
          </div>
          <small className="home-monitor-caption">
            OPENING PREVIEW · {concealCategoryHeaders ? "TITLES CONCEALED" : "TITLES VISIBLE"}
          </small>
        </div>
      </section>

      <ol className="workflow-strip">
        <li><span>01</span><strong>Cast</strong><small>{teams.length} teams ready</small></li>
        <li><span>02</span><strong>Write</strong><small>Build your clues</small></li>
        <li><span>03</span><strong>Play</strong><small>Run the show live</small></li>
      </ol>

      <section className="home-control-panel">
        <div className="section-heading"><span className="eyebrow">SHOW IDENTITY</span><h2>Name it. Color it.</h2></div>
        <div className="home-settings-grid">
          <div className="field-block">
            <label className="label" htmlFor="quiz-title">Quiz title</label>
            <input id="quiz-title" className="input title-input" value={settings.quizTitle} onChange={(event) => setSettings((previous) => ({ ...previous, quizTitle: event.target.value }))} placeholder={DEFAULT_SETTINGS.quizTitle} />
            <small>Shown on the host dashboard and game board.</small>
          </div>
          <div className="field-block">
            <label className="label" htmlFor="team-theme">Team palette</label>
            <div className="team-palette-controls">
            <select id="team-theme" className="input" value={activeTheme.id} onChange={(event) => {
              const nextTheme = event.target.value;
              setSettings((previous) => ({ ...previous, themeId: nextTheme }));
              applyThemeToTeams(nextTheme);
            }}>
              {teamThemes.map((theme) => <option key={theme.id} value={theme.id}>{theme.label}</option>)}
            </select>
            <label className="company-branding-toggle">
              <input type="checkbox" role="switch" checked={settings.companyBranding === true} onChange={(event) => setSettings((previous) => ({ ...previous, companyBranding: event.target.checked }))} />
              <span className="company-branding-track" aria-hidden="true" />
              <span>Brand the site</span>
            </label>
            </div>
            <div className="theme-cast">
              {emojiOptions.map((option: EmojiOption) => <TeamPill key={option.emoji} name={option.label} color={option.base} emoji={option.emoji} />)}
            </div>
            <small>{activeTheme.description}</small>
          </div>
          <div className="field-block board-reveal-setting">
            <label htmlFor="hide-category-headers">
              <input
                id="hide-category-headers"
                type="checkbox"
                checked={concealCategoryHeaders}
                onChange={(event) => setSettings((previous) => ({
                  ...previous,
                  hideCategoryHeadersAtStart: event.target.checked,
                }))}
              />
              <span>
                <strong>Stage the category reveal</strong>
                <small>Begin with category titles concealed. Click each header on the game board to reveal it.</small>
              </span>
            </label>
          </div>
        </div>
      </section>

      <section className="home-route-grid" aria-label="Setup workflow">
        <Link href="/config/teams" className="route-card route-card-blue"><span>01 / CAST</span><strong>Teams & players</strong><p>Name the squads, assign colors, shuffle the room.</p><b>Configure teams →</b></Link>
        <Link href="/config/questions" className="route-card route-card-acid"><span>02 / WRITE</span><strong>Categories & clues</strong><p>Compose every format from audio to your timeline.</p><b>Build the board →</b></Link>
        <Link href="/game" className="route-card route-card-orange"><span>03 / LIVE</span><strong>Game board</strong><p>Spin the order, open clues and keep the score.</p><b>Start the show →</b></Link>
      </section>
    </main>
  );
}
