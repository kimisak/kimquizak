'use client';

import React, { useEffect, useMemo, useState } from "react";
import { YouTubeClipPreview } from "@/components/config/YouTubeClipPreview";
import { ImageRevealFields } from "@/components/config/ImageRevealFields";
import { usePersistentState } from "@/hooks/usePersistentState";
import { usePersistentQuestions } from "@/hooks/usePersistentQuestions";
import { useSettings } from "@/hooks/useSettings";
import { useTurnState } from "@/hooks/useTurnState";
import {
  LEGACY_TEAM_STORAGE_KEY,
  SCORE_HISTORY_STORAGE_KEY,
  TEAM_STORAGE_KEY,
} from "@/lib/storage";
import {
  POINT_STEP,
  POINT_VALUES,
  type PointValue,
  type Question,
  type QuestionTypeDraft,
  type ScoreTransaction,
  type Team,
} from "@/lib/types";
import { makeId } from "@/lib/defaultData";
import { DEFAULT_SETTINGS, type BoardRevealRule, type BoardRevealRules, type HostMessage, type HostMessageRevealStyle } from "@/lib/settings";
import { OWN_CATEGORY } from "@/lib/boardReveal";
import {
  createHostMessagePreviewRandom,
  getHostMessageRandomPoolIssues,
  getUnavailableHostMessageVariables,
  getUnknownHostMessageVariables,
  hasRandomHostMessageVariable,
  HOST_MESSAGE_VARIABLES,
  resolveHostMessageTemplate,
} from "@/lib/hostMessageTemplates";
import { HostMessageRichText } from "@/components/game/HostMessageRichText";
import { HostMessageOverlay } from "@/components/game/HostMessageOverlay";
import { buildYouTubeEmbedUrl, getYouTubeStartSeconds } from "@/lib/youtube";
import { getAudioReplayValue } from "@/lib/audioScoring";
import { extractEmbedUrl } from "@/lib/embed";
import { DEFAULT_GEO_STAGE_BANDS_KM, getGeoExploreValue, getGeoStageBands, isGoogleMapsShortLink, parseStreetViewSource } from "@/lib/geoguesser";
import { StreetViewPicker } from "@/components/config/StreetViewPicker";
import { StorageBackupPanel } from "@/components/StorageBackupPanel";
import { getQuestionIssues, isQuestionReady } from "@/lib/questionValidation";

type FieldProps = {
  category: string;
  points: PointValue;
  q: Question | undefined;
  upsertQuestion: (
    category: string,
    points: PointValue,
    updates: Partial<Question>,
  ) => void;
  handleImageChange?: (
    category: string,
    points: PointValue,
    file: File | null,
  ) => void;
  handleAnswerImageChange?: (
    category: string,
    points: PointValue,
    file: File | null,
  ) => void;
};

type QuestionType = NonNullable<Question["type"]>;

function RevealRuleEditor({ label, rule, categories, ownCategory, ownLabel, onChange }: {
  label: string;
  rule?: BoardRevealRule;
  categories: string[];
  ownCategory?: string;
  ownLabel?: string;
  onChange: (rule: BoardRevealRule | null) => void;
}) {
  const sourceOptions = categories.filter((category) => category !== ownCategory);
  const canUseCategory = Boolean(ownLabel || sourceOptions.length);
  return (
    <div className="question-reveal-rule">
      <span>{label}</span>
      <select
        className="input"
        aria-label={`${label} visibility`}
        value={rule?.when ?? "visible"}
        onChange={(event) => {
          if (event.target.value === "visible") onChange(null);
          else if (event.target.value === "board-complete") onChange({ when: "board-complete" });
          else onChange({ when: "category-complete", category: ownLabel ? OWN_CATEGORY : sourceOptions[0] });
        }}
      >
        <option value="visible">Visible from start</option>
        <option value="category-complete" disabled={!canUseCategory}>{ownLabel ? "After this category is complete" : "After a category is complete"}</option>
        <option value="board-complete">After the opening board is complete</option>
      </select>
      {rule?.when === "category-complete" && !ownLabel && (
        <select
          className="input"
          aria-label={`${label} source category`}
          value={rule.category}
          onChange={(event) => onChange({ when: "category-complete", category: event.target.value })}
        >
          {sourceOptions.map((category) => <option key={category} value={category}>{category}</option>)}
        </select>
      )}
      {ownLabel && rule?.when === "category-complete" && (
        <small className="question-reveal-rule-note">Only this final question stays hidden. It appears when the other questions in {ownCategory} have all been played.</small>
      )}
    </div>
  );
}

type HostMessageEditorProps = {
  message: HostMessage;
  index: number;
  teams: Team[];
  playableQuestionCount: number;
  onUpdate: (updates: Partial<HostMessage>) => void;
  onRemove: () => void;
};

const HOST_MESSAGE_REVEAL_STYLES: Array<{ value: HostMessageRevealStyle; label: string }> = [
  { value: "spin-wheel", label: "Spin the wheel" },
  { value: "direct", label: "Direct" },
];

function HostMessageEditor({
  message,
  index,
  teams,
  playableQuestionCount,
  onUpdate,
  onRemove,
}: HostMessageEditorProps) {
  const [showRevealPreview, setShowRevealPreview] = useState(false);
  const unknownVariables = getUnknownHostMessageVariables(message.text);
  const unavailableVariables = getUnavailableHostMessageVariables(message.text, teams);
  const randomPoolIssues = getHostMessageRandomPoolIssues(message.text, teams);
  const preview = resolveHostMessageTemplate(
    message.text,
    teams,
    createHostMessagePreviewRandom(message.id),
  );
  const memberRanges = teams
    .map((team, teamIndex) => `team${teamIndex + 1}: 1–${team.players.length}`)
    .join(" · ");
  const appendVariable = (token: string) => {
    const separator = message.text && !/\s$/.test(message.text) ? " " : "";
    onUpdate({ text: `${message.text}${separator}${token}` });
  };
  const hasRandomVariable = hasRandomHostMessageVariable(message.text);
  const revealStyle = message.revealStyle === "direct" ? "direct" : "spin-wheel";

  return (
    <div className="question-host-message-row">
      <span className="question-host-message-index" aria-hidden>{index + 1}</span>
      <label className="question-host-message-trigger">
        <span>After</span>
        <input
          className={`input${playableQuestionCount > 0 && message.afterQuestionCount > playableQuestionCount ? " beyond-board" : ""}`}
          type="number"
          min={1}
          step={1}
          value={message.afterQuestionCount}
          aria-label={`Show message ${index + 1} after this many questions`}
          onChange={(event) => onUpdate({
            afterQuestionCount: Math.max(1, Math.round(Number(event.target.value) || 1)),
          })}
        />
        <span>questions</span>
      </label>
      <input
        className="input question-host-message-copy"
        value={message.text}
        aria-label={`Message ${index + 1} text`}
        placeholder="e.g. A challenge for {random.team}!"
        onChange={(event) => onUpdate({ text: event.target.value })}
      />
      <button
        className="question-host-message-remove"
        type="button"
        aria-label={`Remove message ${index + 1}`}
        onClick={onRemove}
      >
        ×
      </button>
      <div className="question-host-message-variables" aria-label="Insert a message variable">
        <span>Insert</span>
        {HOST_MESSAGE_VARIABLES.map((variable) => (
          <button key={variable.token} type="button" onClick={() => appendVariable(variable.token)} title={variable.label}>
            {variable.token}
          </button>
        ))}
      </div>
      <small className="question-host-message-variable-help">
        The insert buttons use team 1 as an example. Edit the numbers directly in the message.
        {teams.length > 0
          ? ` Team range: 1–${teams.length}. Member ranges: ${memberRanges}.`
          : " Add teams to make numbered variables available."}
        {" "}{"{males}"} and {"{females}"} show every labelled player; {"{random.male}"} and {"{random.female}"} draw one individual.
        {" "}Countdowns accept minutes, seconds, or both: {"{5m}"}, {"{10s}"}, {"{1m30s}"}, or {"{100s}"}.
      </small>
      <div className={`question-host-message-reveal-setting${hasRandomVariable ? "" : " direct-preview"}`}>
        <span>{hasRandomVariable ? "Random reveal" : "Full-screen preview"}</span>
        {hasRandomVariable ? (
          <div className="question-host-message-reveal-options">
            {HOST_MESSAGE_REVEAL_STYLES.map((style) => (
              <button
                className={revealStyle === style.value ? "selected" : ""}
                type="button"
                key={style.value}
                onClick={() => onUpdate({ revealStyle: style.value })}
              >
                {style.label}
              </button>
            ))}
          </div>
        ) : (
          <small className="question-host-message-reveal-description">
            See the message exactly as it will interrupt the board.
          </small>
        )}
        <button
          className="button secondary compact question-host-message-reveal-preview"
          type="button"
          disabled={!message.text.trim()}
          onClick={() => setShowRevealPreview(true)}
        >
          {hasRandomVariable && revealStyle === "spin-wheel" ? "Preview animation" : "Preview message"}
        </button>
      </div>
      {message.text.trim() && (
        <div className="question-host-message-preview">
          <span>Example only — not the saved result</span>
          <p><HostMessageRichText template={message.text} resolution={preview} teams={teams} /></p>
          {message.text.includes("{random.") && (
            <small>The actual result is drawn live and saved when this message appears.</small>
          )}
        </div>
      )}
      {playableQuestionCount > 0 && message.afterQuestionCount > playableQuestionCount && (
        <small className="question-host-message-warning">
          This is beyond the current board and will not appear.
        </small>
      )}
      {unknownVariables.length > 0 && (
        <small className="question-host-message-variable-error">
          Unknown {unknownVariables.length === 1 ? "variable" : "variables"}: {unknownVariables.join(", ")}
        </small>
      )}
      {unavailableVariables.length > 0 && (
        <small className="question-host-message-variable-error">
          Add the referenced team or named player before using: {unavailableVariables.join(", ")}
        </small>
      )}
      {randomPoolIssues.map((issue) => (
        <small className="question-host-message-variable-error" key={issue}>{issue}</small>
      ))}
      {showRevealPreview && (
        <HostMessageOverlay
          key={`${message.id}-${revealStyle}`}
          message={{ ...message, revealStyle: hasRandomVariable ? revealStyle : "direct" }}
          resolution={preview}
          teams={teams}
          answeredQuestionCount={message.afterQuestionCount}
          playableQuestionCount={Math.max(playableQuestionCount, message.afterQuestionCount)}
          onDismiss={() => setShowRevealPreview(false)}
        />
      )}
    </div>
  );
}

const QUESTION_TYPE_META: Record<
  QuestionType,
  { label: string; icon: string; accent: string; soft: string }
> = {
  standard: { label: "Standard", icon: "Q", accent: "#60a5fa", soft: "rgba(96,165,250,0.14)" },
  imageReveal: { label: "Image reveal", icon: "▧", accent: "#d4ad68", soft: "rgba(212,173,104,0.14)" },
  mcq: { label: "Multiple choice", icon: "A", accent: "#a78bfa", soft: "rgba(167,139,250,0.14)" },
  audio: { label: "Guess the audio", icon: "♪", accent: "#f472b6", soft: "rgba(244,114,182,0.14)" },
  booby: { label: "Challenge", icon: "🎁", accent: "#e8b86a", soft: "rgba(232,184,106,0.14)" },
  lyrics: { label: "Text grid", icon: "▦", accent: "#2dd4bf", soft: "rgba(45,212,191,0.14)" },
  geoguesser: { label: "Geoguesser", icon: "⌖", accent: "#f59e0b", soft: "rgba(245,158,11,0.14)" },
  joker: { label: "Joker high/low", icon: "♠", accent: "#fb7185", soft: "rgba(251,113,133,0.14)" },
  timeline: { label: "Timeline", icon: "↔", accent: "#34d399", soft: "rgba(52,211,153,0.14)" },
};

const QUESTION_TYPES = Object.keys(QUESTION_TYPE_META) as QuestionType[];

function isCardEdgeTogglePoint(card: HTMLElement, x: number, y: number): boolean {
  const bounds = card.getBoundingClientRect();
  const sideEdge = 36;
  const horizontalEdge = 18;
  return x - bounds.left <= sideEdge
    || bounds.right - x <= sideEdge
    || y - bounds.top <= horizontalEdge
    || bounds.bottom - y <= horizontalEdge;
}

const BoobyFields = React.memo(function BoobyFields({
  category,
  points,
  q,
  upsertQuestion,
  handleImageChange,
}: FieldProps) {
  const [message, setMessage] = useState(q?.prompt ?? "");
  const [timerInput, setTimerInput] = useState(String(q?.challengeTimerSeconds ?? 60));
  const timerEnabled = Boolean(q?.challengeTimerSeconds && q.challengeTimerSeconds > 0);
  const timerMode = q?.challengeTimerMode === "countup" ? "countup" : "countdown";

  React.useEffect(() => {
    setMessage(q?.prompt ?? "");
    setTimerInput(String(q?.challengeTimerSeconds ?? 60));
  }, [q?.prompt, q?.challengeTimerSeconds]);

  const normalizedTimerSeconds = () => {
    const parsed = Number(timerInput);
    return Number.isFinite(parsed) ? Math.max(5, Math.min(1800, Math.round(parsed))) : 60;
  };

  return (
    <>
      <p style={{ margin: "0 0 14px", color: "var(--muted)", fontSize: "0.88rem", lineHeight: 1.45 }}>
        The board shows {points} points. The team earns all {points} if they complete the challenge; otherwise they earn 0. The host decides the outcome after the reveal.
      </p>
      <label className="label" htmlFor={`booby-message-${category}-${points}`}>Challenge instructions</label>
      <textarea
        id={`booby-message-${category}-${points}`}
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        onBlur={() => upsertQuestion(category, points, { prompt: message })}
        placeholder="What should the team do to win the points?"
        style={{ width: "100%", minHeight: "110px", padding: "10px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.04)", color: "var(--foreground)", resize: "vertical" }}
      />
      <label className="label" style={{ display: "block", marginTop: "10px" }}>Picture (optional)</label>
      <label className="input" style={{ display: "inline-flex", alignItems: "center", width: "fit-content", padding: "0.6rem 0.8rem", cursor: "pointer" }}>
        <input
          type="file"
          accept="image/*"
          onChange={(event) => handleImageChange?.(category, points, event.target.files?.[0] ?? null)}
          style={{ display: "none" }}
        />
        <span style={{ fontWeight: 600 }}>⬆️ Upload picture</span>
      </label>
      {q?.imageData && (
        <div style={{ position: "relative", width: "fit-content", maxWidth: "100%", marginTop: "10px" }}>
          <img src={q.imageData} alt={q.imageName || "Challenge picture"} style={{ display: "block", maxWidth: "100%", maxHeight: "220px", borderRadius: "12px" }} />
          <button
            type="button"
            onClick={() => upsertQuestion(category, points, { imageData: null, imageName: null })}
            aria-label="Remove picture"
            style={{ position: "absolute", top: "7px", right: "7px", width: "28px", height: "28px", border: "1px solid rgba(255,255,255,.5)", borderRadius: "50%", background: "rgba(10,20,16,.8)", color: "white", cursor: "pointer" }}
          >
            ×
          </button>
        </div>
      )}
      <div className="challenge-timer-config">
        <label className="challenge-timer-duration">
          <span>Challenge clock</span>
          <select
            className="input"
            value={timerEnabled ? timerMode : "none"}
            onChange={(event) => upsertQuestion(category, points, {
              challengeTimerSeconds: event.target.value === "none" ? null : normalizedTimerSeconds(),
              challengeTimerMode: event.target.value === "countup" ? "countup" : "countdown",
            })}
          >
            <option value="none">No clock</option>
            <option value="countdown">Countdown · time runs down</option>
            <option value="countup">Count-up timer · time runs up</option>
          </select>
        </label>
        {timerEnabled && (
          <>
          <label className="challenge-timer-duration">
            <span>Time limit (seconds)</span>
            <input
              className="input"
              type="number"
              min={5}
              max={1800}
              step={1}
              value={timerInput}
              onChange={(event) => setTimerInput(event.target.value)}
              onBlur={() => {
                const seconds = normalizedTimerSeconds();
                setTimerInput(String(seconds));
                upsertQuestion(category, points, { challengeTimerSeconds: seconds });
              }}
              onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }}
            />
          </label>
          <label className="challenge-timer-toggle">
            <input
              type="checkbox"
              checked={q?.challengeTimerShowTime !== false}
              onChange={(event) => upsertQuestion(category, points, { challengeTimerShowTime: event.target.checked })}
            />
            <span>Show exact time during play</span>
          </label>
          </>
        )}
        <small>The host starts the clock after the challenge is revealed. With exact time hidden, teams still see the progress bar move. Reaching the limit does not decide the score automatically.</small>
      </div>
    </>
  );
});

const McqFields = React.memo(function McqFields({
  category,
  points,
  q,
  upsertQuestion,
  handleImageChange,
  handleAnswerImageChange,
}: FieldProps) {
  const [options, setOptions] = useState<string[]>(() => {
    const base = q?.mcqOptions && q.mcqOptions.length ? q.mcqOptions : [];
    return base.slice(0, 4).concat(new Array(Math.max(0, 4 - base.length)).fill(""));
  });
  const [correctIndex, setCorrectIndex] = useState<number>(q?.mcqCorrectIndex ?? 0);
  const [rotateOnMiss, setRotateOnMiss] = useState<boolean>(q?.mcqRotateOnMiss ?? false);

  useEffect(() => {
    const id = setTimeout(() => {
      const base = q?.mcqOptions && q.mcqOptions.length ? q.mcqOptions : [];
      const normalized = base.slice(0, 4).concat(new Array(Math.max(0, 4 - base.length)).fill(""));
      setOptions(normalized);
      setCorrectIndex(q?.mcqCorrectIndex ?? 0);
      setRotateOnMiss(q?.mcqRotateOnMiss ?? false);
    }, 0);
    return () => clearTimeout(id);
  }, [q?.mcqOptions, q?.mcqCorrectIndex, q?.mcqRotateOnMiss]);

  const persist = (
    opts: string[],
    correct: number,
    rotateOverride?: boolean,
  ) => {
    const trimmed = opts.slice(0, 4).map((o) => o.trim());
    const boundedCorrect = Math.min(trimmed.length - 1, Math.max(0, correct));
    upsertQuestion(category, points, {
      mcqOptions: trimmed,
      mcqCorrectIndex: boundedCorrect,
      mcqRotateOnMiss: rotateOverride ?? rotateOnMiss,
    });
  };

  return (
    <>
      <label className="label" style={{ marginTop: "8px" }}>
        Question
      </label>
      <textarea
        value={q?.prompt ?? ""}
        onChange={(e) => upsertQuestion(category, points, { prompt: e.target.value })}
        style={{
          width: "100%",
          minHeight: "70px",
          borderRadius: "10px",
          border: "1px solid rgba(255,255,255,0.12)",
          background: "rgba(255,255,255,0.04)",
          color: "var(--foreground)",
          padding: "10px",
        }}
        placeholder="Question text"
      />
      <label className="label" style={{ marginTop: "8px" }}>
        Question image (optional)
      </label>
      <label className="input" style={{ display: "inline-flex", alignItems: "center", gap: "8px", width: "fit-content", cursor: "pointer", padding: "0.6rem 0.8rem" }}>
        <input
          type="file"
          accept="image/*"
          onChange={(e) =>
            handleImageChange?.(
              category,
              points,
              e.target.files?.[0] ?? null,
            )
          }
          style={{ display: "none" }}
        />
        <span style={{ fontWeight: 600 }}>⬆️ Upload</span>
      </label>
      {q?.imageData && (
        <div
          style={{
            marginTop: "10px",
            borderRadius: "10px",
            overflow: "hidden",
            border: "1px solid rgba(255,255,255,0.1)",
            position: "relative",
          }}
        >
          <button
            onClick={() =>
              upsertQuestion(category, points, {
                imageData: null,
                imageName: null,
              })
            }
            aria-label="Remove image"
            style={{
              position: "absolute",
              top: "8px",
              right: "8px",
              width: "28px",
              height: "28px",
              borderRadius: "50%",
              border: "1px solid rgba(255,255,255,0.2)",
              background: "rgba(0,0,0,0.35)",
              color: "#fff",
              display: "grid",
              placeItems: "center",
              cursor: "pointer",
              zIndex: 2,
            }}
          >
            ×
          </button>
          <img
            src={q.imageData}
            alt={q.imageName || "Question image"}
            style={{
              width: "100%",
              height: "auto",
              display: "block",
              maxHeight: "240px",
              objectFit: "contain",
            }}
          />
          {q.imageName && (
            <div
              style={{
                padding: "6px 10px",
                fontSize: "0.9rem",
                color: "var(--muted)",
                background: "rgba(255,255,255,0.03)",
              }}
            >
              {q.imageName}
            </div>
          )}
        </div>
      )}
      <div style={{ display: "grid", gap: "8px", marginTop: "8px" }}>
        {options.map((opt, idx) => (
          <div key={idx} style={{ display: "grid", gap: "6px" }}>
            <label className="label" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <input
                type="radio"
                name={`correct-${category}-${points}`}
                checked={correctIndex === idx}
                onChange={() => {
                  setCorrectIndex(idx);
                  persist(options, idx);
                }}
                style={{ width: "16px", height: "16px", cursor: "pointer" }}
              />
              Correct
            </label>
            <input
              className="input"
              value={opt}
              onChange={(e) => {
                const nextOpts = [...options];
                nextOpts[idx] = e.target.value;
                setOptions(nextOpts);
              }}
              onBlur={() => persist(options, correctIndex)}
              placeholder={`Option ${idx + 1}`}
            />
          </div>
        ))}
      </div>
      <div className="mcq-config-rule">
        <label>
          <input
            type="checkbox"
            checked={rotateOnMiss}
            onChange={(event) => {
              const next = event.target.checked;
              setRotateOnMiss(next);
              persist(options, correctIndex, next);
            }}
          />
          <span>
            <strong>Rollover after a wrong answer</strong>
            <small>{rotateOnMiss
              ? "The wrong option disappears and the next team may answer."
              : "A wrong answer ends the question for 0 points."}</small>
          </span>
        </label>
      </div>
      <label className="label" style={{ marginTop: "10px" }}>
        Answer image (optional)
      </label>
      <label className="input" style={{ display: "inline-flex", alignItems: "center", gap: "8px", width: "fit-content", cursor: "pointer", padding: "0.6rem 0.8rem" }}>
        <input
          type="file"
          accept="image/*"
          onChange={(e) =>
            handleAnswerImageChange?.(
              category,
              points,
              e.target.files?.[0] ?? null,
            )
          }
          style={{ display: "none" }}
        />
        <span style={{ fontWeight: 600 }}>⬆️ Upload</span>
      </label>
      {q?.answerImageData && (
        <div
          style={{
            marginTop: "10px",
            borderRadius: "10px",
            overflow: "hidden",
            border: "1px solid rgba(255,255,255,0.1)",
            position: "relative",
          }}
        >
          <button
            onClick={() =>
              upsertQuestion(category, points, {
                answerImageData: null,
                answerImageName: null,
              })
            }
            aria-label="Remove answer image"
            style={{
              position: "absolute",
              top: "8px",
              right: "8px",
              width: "28px",
              height: "28px",
              borderRadius: "50%",
              border: "1px solid rgba(255,255,255,0.2)",
              background: "rgba(0,0,0,0.35)",
              color: "#fff",
              display: "grid",
              placeItems: "center",
              cursor: "pointer",
              zIndex: 2,
            }}
          >
            ×
          </button>
          <img
            src={q.answerImageData}
            alt={q.answerImageName || "Answer image"}
            style={{
              width: "100%",
              height: "auto",
              display: "block",
              maxHeight: "240px",
              objectFit: "contain",
            }}
          />
          {q.answerImageName && (
            <div
              style={{
                padding: "6px 10px",
                fontSize: "0.9rem",
                color: "var(--muted)",
                background: "rgba(255,255,255,0.03)",
              }}
            >
              {q.answerImageName}
            </div>
          )}
        </div>
      )}
    </>
  );
});
const StandardFields = React.memo(function StandardFields({
  category,
  points,
  q,
  upsertQuestion,
  handleImageChange,
  handleAnswerImageChange = () => {},
}: FieldProps) {
  const [prompt, setPrompt] = useState(q?.prompt ?? "");
  const [answer, setAnswer] = useState(q?.answer ?? "");

  React.useEffect(() => {
    setPrompt(q?.prompt ?? "");
    setAnswer(q?.answer ?? "");
  }, [q?.prompt, q?.answer]);

  return (
    <>
      <label className="label">Question</label>
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onBlur={() =>
          upsertQuestion(category, points, {
            prompt,
          })
        }
        style={{
          width: "100%",
          minHeight: "70px",
          borderRadius: "10px",
          border: "1px solid rgba(255,255,255,0.12)",
          background: "rgba(255,255,255,0.04)",
          color: "var(--foreground)",
          padding: "10px",
        }}
        placeholder="Write the clue"
      />
      <label className="label" style={{ marginTop: "8px" }}>
        Answer
      </label>
      <textarea
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        onBlur={() =>
          upsertQuestion(category, points, {
            answer,
          })
        }
        style={{
          width: "100%",
          minHeight: "60px",
          borderRadius: "10px",
          border: "1px solid rgba(255,255,255,0.12)",
          background: "rgba(255,255,255,0.04)",
          color: "var(--foreground)",
          padding: "10px",
        }}
        placeholder="Write the expected answer"
      />
      <label className="label" style={{ marginTop: "8px" }}>
        Image (optional)
      </label>
      <label className="input" style={{ display: "inline-flex", alignItems: "center", gap: "8px", width: "fit-content", cursor: "pointer", padding: "0.6rem 0.8rem" }}>
        <input
          type="file"
          accept="image/*"
          onChange={(e) =>
            handleImageChange?.(
              category,
              points,
              e.target.files?.[0] ?? null,
            )
          }
          style={{ display: "none" }}
        />
        <span style={{ fontWeight: 600 }}>⬆️ Upload</span>
      </label>
      {q?.imageData && (
        <div
          style={{
            marginTop: "10px",
            borderRadius: "10px",
            overflow: "hidden",
            border: "1px solid rgba(255,255,255,0.1)",
            position: "relative",
          }}
        >
          <button
            onClick={() =>
              upsertQuestion(category, points, {
                imageData: null,
                imageName: null,
              })
            }
            aria-label="Remove image"
            style={{
              position: "absolute",
              top: "8px",
              right: "8px",
              width: "28px",
              height: "28px",
              borderRadius: "50%",
              border: "1px solid rgba(255,255,255,0.2)",
              background: "rgba(0,0,0,0.35)",
              color: "#fff",
              display: "grid",
              placeItems: "center",
              cursor: "pointer",
              zIndex: 2,
            }}
          >
            ×
          </button>
          <img
            src={q.imageData}
            alt={q.imageName || "Question image"}
            style={{
              width: "100%",
              height: "auto",
              display: "block",
              maxHeight: "240px",
              objectFit: "contain",
            }}
          />
          {q.imageName && (
            <div
              style={{
                padding: "6px 10px",
                fontSize: "0.9rem",
                color: "var(--muted)",
                background: "rgba(255,255,255,0.03)",
              }}
            >
              {q.imageName}
            </div>
          )}
        </div>
      )}
      <label className="label" style={{ marginTop: "8px" }}>
        Answer image (optional)
      </label>
      <label className="input" style={{ display: "inline-flex", alignItems: "center", gap: "8px", width: "fit-content", cursor: "pointer", padding: "0.6rem 0.8rem" }}>
        <input
          type="file"
          accept="image/*"
          onChange={(e) =>
            handleAnswerImageChange(
              category,
              points,
              e.target.files?.[0] ?? null,
            )
          }
          style={{ display: "none" }}
        />
        <span style={{ fontWeight: 600 }}>⬆️ Upload</span>
      </label>
      {q?.answerImageData && (
        <div
          style={{
            marginTop: "10px",
            borderRadius: "10px",
            overflow: "hidden",
            border: "1px solid rgba(255,255,255,0.1)",
            position: "relative",
          }}
        >
          <button
            onClick={() =>
              upsertQuestion(category, points, {
                answerImageData: null,
                answerImageName: null,
              })
            }
            aria-label="Remove answer image"
            style={{
              position: "absolute",
              top: "8px",
              right: "8px",
              width: "28px",
              height: "28px",
              borderRadius: "50%",
              border: "1px solid rgba(255,255,255,0.2)",
              background: "rgba(0,0,0,0.35)",
              color: "#fff",
              display: "grid",
              placeItems: "center",
              cursor: "pointer",
              zIndex: 2,
            }}
          >
            ×
          </button>
          <img
            src={q.answerImageData}
            alt={q.answerImageName || "Answer image"}
            style={{
              width: "100%",
              height: "auto",
              display: "block",
              maxHeight: "240px",
              objectFit: "contain",
            }}
          />
          {q.answerImageName && (
            <div
              style={{
                padding: "6px 10px",
                fontSize: "0.9rem",
                color: "var(--muted)",
                background: "rgba(255,255,255,0.03)",
              }}
            >
              {q.answerImageName}
            </div>
          )}
        </div>
      )}
    </>
  );
});

const AudioFields = React.memo(function AudioFields({
  category,
  points,
  q,
  upsertQuestion,
  boardValues,
}: FieldProps & { boardValues: readonly number[] }) {
  const [prompt, setPrompt] = useState(q?.prompt ?? "");
  const [answer, setAnswer] = useState(q?.answer ?? "");
  const [audioUrl, setAudioUrl] = useState(q?.audioUrl ?? "");
  const [startSeconds, setStartSeconds] = useState<number>(
    q?.audioStartSeconds ?? getYouTubeStartSeconds(q?.audioUrl),
  );
  const [stopSeconds, setStopSeconds] = useState<number>(q?.audioStopSeconds ?? 10);
  const [showPreview, setShowPreview] = useState(false);

  React.useEffect(() => {
    setPrompt(q?.prompt ?? "");
    setAnswer(q?.answer ?? "");
    setAudioUrl(q?.audioUrl ?? "");
    setStartSeconds(q?.audioStartSeconds ?? getYouTubeStartSeconds(q?.audioUrl));
    setStopSeconds(q?.audioStopSeconds ?? 10);
  }, [q?.prompt, q?.answer, q?.audioUrl, q?.audioStartSeconds, q?.audioStopSeconds]);

  const persistSeconds = () => {
    const safe = Number.isFinite(stopSeconds) ? Math.max(1, Math.round(stopSeconds)) : 10;
    setStopSeconds(safe);
    upsertQuestion(category, points, { audioStopSeconds: safe });
  };
  const validVideoUrl = buildYouTubeEmbedUrl(audioUrl, { startSeconds });
  const replayValue = getAudioReplayValue(points, boardValues);

  return (
    <>
      <label className="label">Question title or clue</label>
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onBlur={() =>
          upsertQuestion(category, points, {
            prompt,
          })
        }
        style={{
          width: "100%",
        minHeight: "70px",
        borderRadius: "10px",
        border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(255,255,255,0.04)",
        color: "var(--foreground)",
        padding: "10px",
      }}
      placeholder="Describe what they need to identify from the audio"
    />
      <label className="label" style={{ marginTop: "8px" }}>
        YouTube URL (audio source)
      </label>
      <input
        className="input"
        value={audioUrl}
        onChange={(e) => setAudioUrl(e.target.value)}
        onBlur={() => {
          const detectedStart = getYouTubeStartSeconds(audioUrl);
          const nextStart = q?.audioStartSeconds == null && detectedStart > 0
            ? detectedStart
            : startSeconds;
          setStartSeconds(nextStart);
          upsertQuestion(category, points, {
            audioUrl: audioUrl.trim() || null,
            audioStartSeconds: Math.max(0, Math.round(nextStart)),
          });
        }}
        placeholder="https://youtube.com/watch?v=..."
      />
      {audioUrl && !validVideoUrl && (
        <div style={{ color: "#fca5a5", fontSize: "0.9rem", marginTop: "6px" }}>
          This does not look like a supported YouTube link.
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(120px, 180px))", gap: "10px", marginTop: "8px" }}>
        <div>
          <label className="label">Start at (seconds)</label>
          <input
            className="input"
            type="number"
            min={0}
            value={startSeconds}
            onChange={(e) => setStartSeconds(Number(e.target.value))}
            onBlur={() => {
              const safe = Number.isFinite(startSeconds) ? Math.max(0, Math.round(startSeconds)) : 0;
              setStartSeconds(safe);
              upsertQuestion(category, points, { audioStartSeconds: safe });
            }}
          />
        </div>
        <div>
          <label className="label">Clip length (seconds)</label>
          <input
            className="input"
            type="number"
            min={1}
            value={stopSeconds}
            onChange={(e) => setStopSeconds(Number(e.target.value))}
            onBlur={persistSeconds}
          />
        </div>
      </div>
      {validVideoUrl && (
        <div style={{ marginTop: "10px" }}>
          <button className="button ghost compact" type="button" onClick={() => setShowPreview((value) => !value)}>
            {showPreview ? "Hide source preview" : "Preview source at start time"}
          </button>
          {showPreview && (
            <div style={{ marginTop: "8px", aspectRatio: "16 / 9", overflow: "hidden", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.12)" }}>
              <iframe
                title="Audio source preview"
                src={validVideoUrl}
                allow="accelerometer; encrypted-media; picture-in-picture"
                allowFullScreen
                style={{ width: "100%", height: "100%", border: 0 }}
              />
            </div>
          )}
        </div>
      )}
      <label className="label" style={{ marginTop: "8px" }}>
        Expected answer
      </label>
      <textarea
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        onBlur={() =>
          upsertQuestion(category, points, {
            answer,
          })
        }
        style={{
          width: "100%",
          minHeight: "60px",
          borderRadius: "10px",
          border: "1px solid rgba(255,255,255,0.12)",
          background: "rgba(255,255,255,0.04)",
          color: "var(--foreground)",
          padding: "10px",
        }}
        placeholder="What answer should score as correct?"
      />
      <div style={{ color: "var(--muted)", marginTop: "6px", fontSize: "0.9rem" }}>
        YouTube timestamps are detected automatically. The first listen is always worth full points.
      </div>
      <label className="label" style={{ display: "inline-flex", alignItems: "center", gap: "8px", marginTop: "10px", cursor: replayValue !== null ? "pointer" : "default" }}>
        <input
          type="checkbox"
          checked={replayValue !== null && Boolean(q?.audioReplayEnabled)}
          disabled={replayValue === null}
          onChange={(event) => upsertQuestion(category, points, { audioReplayEnabled: event.target.checked })}
          style={{ width: "16px", height: "16px", cursor: replayValue !== null ? "pointer" : "default" }}
        />
        Allow one replay
      </label>
      <div style={{ color: "var(--muted)", marginTop: "4px", fontSize: "0.82rem" }}>
        {replayValue !== null
          ? `If replayed, this ${points}-point question pays ${replayValue} points for a correct answer. No existing points are deducted.`
          : "Replay is unavailable because the board has no lower point tier."}
      </div>
    </>
  );
});

const LyricsFields = React.memo(function LyricsFields(props: FieldProps) {
  const { category, points, q, upsertQuestion } = props;
  const lyricsInputRef = React.useRef<HTMLTextAreaElement>(null);
  const [prompt, setPrompt] = useState(q?.prompt ?? "");
  const [infoText, setInfoText] = useState(q?.lyricsInfoText ?? "");
  const [lyrics, setLyrics] = useState((q?.lyricsSegments ?? []).join("\n"));
  const [answer, setAnswer] = useState(q?.answer ?? "");
  const [answerVideoUrl, setAnswerVideoUrl] = useState(q?.answerVideoUrl ?? "");
  const [autoplay, setAutoplay] = useState(q?.answerVideoAutoplay ?? true);
  const [showAnswerVideoPreview, setShowAnswerVideoPreview] = useState(false);
  const answerVideoStart = getYouTubeStartSeconds(answerVideoUrl);
  const answerVideoPreviewUrl = buildYouTubeEmbedUrl(answerVideoUrl, {
    startSeconds: answerVideoStart,
  });
  const configuredTileCount = lyrics.split(/\r?\n/).filter((line) => line.trim()).length;
  const randomPassTileCount = configuredTileCount > 0
    ? Math.max(1, Math.round(configuredTileCount * 0.4))
    : 0;

  React.useEffect(() => {
    setPrompt(q?.prompt ?? "");
    setInfoText(q?.lyricsInfoText ?? "");
    setLyrics((q?.lyricsSegments ?? []).join("\n"));
    setAnswer(q?.answer ?? "");
    setAnswerVideoUrl(q?.answerVideoUrl ?? "");
    setAutoplay(q?.answerVideoAutoplay ?? true);
  }, [q?.prompt, q?.lyricsInfoText, q?.lyricsSegments, q?.answer, q?.answerVideoUrl, q?.answerVideoAutoplay]);

  React.useEffect(() => {
    const input = lyricsInputRef.current;
    if (!input) return;
    const resizeInput = () => {
      input.style.height = "auto";
      const borderHeight = input.offsetHeight - input.clientHeight;
      input.style.height = `${Math.max(110, input.scrollHeight + borderHeight)}px`;
    };
    resizeInput();
    window.addEventListener("resize", resizeInput);
    return () => window.removeEventListener("resize", resizeInput);
  }, [lyrics]);

  return (
    <>
      <label className="label">Question title</label>
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onBlur={() =>
          upsertQuestion(category, points, {
            prompt,
          })
        }
        style={{
          width: "100%",
          minHeight: "60px",
          borderRadius: "10px",
          border: "1px solid rgba(255,255,255,0.12)",
          background: "rgba(255,255,255,0.04)",
          color: "var(--foreground)",
          padding: "10px",
        }}
        placeholder="e.g. Which Christmas song is hidden here?"
      />
      <label className="label" style={{ marginTop: "8px" }}>More info (optional)</label>
      <textarea
        value={infoText}
        onChange={(e) => setInfoText(e.target.value)}
        onBlur={() => upsertQuestion(category, points, { lyricsInfoText: infoText || null })}
        style={{
          width: "100%",
          minHeight: "60px",
          borderRadius: "10px",
          border: "1px solid rgba(255,255,255,0.12)",
          background: "rgba(255,255,255,0.04)",
          color: "var(--foreground)",
          padding: "10px",
        }}
        placeholder="Optional context, hint, or instruction shown below the title"
      />
      <label className="label" style={{ marginTop: "8px" }}>
        Answer video URL
      </label>
      <input
        className="input"
        value={answerVideoUrl}
        onChange={(e) => setAnswerVideoUrl(e.target.value)}
        onBlur={() =>
          upsertQuestion(category, points, {
            answerVideoUrl: answerVideoUrl || null,
          })
        }
        placeholder="https://youtube.com/watch?v=..."
      />
      {answerVideoUrl && !answerVideoPreviewUrl && (
        <small className="question-text-grid-video-error">Enter a supported YouTube URL.</small>
      )}
      {answerVideoPreviewUrl && (
        <div className="question-text-grid-video-source">
          <button
            className="button ghost compact"
            type="button"
            onClick={() => setShowAnswerVideoPreview((visible) => !visible)}
          >
            {showAnswerVideoPreview ? "Close video preview" : "Preview answer video"}
          </button>
          <small>
            {answerVideoStart > 0
              ? `Preview starts at ${answerVideoStart} seconds from the URL timestamp.`
              : "Preview starts at the beginning of the video."}
          </small>
          {showAnswerVideoPreview && (
            <div className="question-text-grid-video-preview">
              <iframe
                key={answerVideoPreviewUrl}
                title="Text Grid answer video preview"
                src={answerVideoPreviewUrl}
                allow="accelerometer; encrypted-media; picture-in-picture"
                allowFullScreen
              />
            </div>
          )}
        </div>
      )}
      <label
        className="label"
        style={{
          marginTop: "6px",
          display: "inline-flex",
          alignItems: "center",
          gap: "8px",
          cursor: "pointer",
          userSelect: "none",
        }}
      >
        <input
          type="checkbox"
          checked={autoplay}
          onChange={(e) => {
            const next = e.target.checked;
            setAutoplay(next);
            upsertQuestion(category, points, { answerVideoAutoplay: next });
          }}
          style={{ width: "16px", height: "16px" }}
        />
        Autoplay video when revealing answer
      </label>
      <label className="label" style={{ marginTop: "8px" }}>
        One line per tile
      </label>
      <textarea
        ref={lyricsInputRef}
        value={lyrics}
        onChange={(e) => setLyrics(e.target.value)}
        onBlur={() =>
          upsertQuestion(category, points, {
            lyricsSegments: lyrics.split(/\r?\n/),
          })
        }
        style={{
          width: "100%",
          minHeight: "110px",
          borderRadius: "10px",
          border: "1px solid rgba(255,255,255,0.12)",
          background: "rgba(255,255,255,0.04)",
          color: "var(--foreground)",
          padding: "10px",
          overflowY: "hidden",
          resize: "vertical",
        }}
        placeholder={"First tile\nSecond tile can contain several words\nThird tile"}
      />
      <div style={{ marginTop: "6px", color: "var(--muted)", fontSize: "0.9rem" }}>
        {configuredTileCount} {configuredTileCount === 1 ? "tile" : "tiles"}. Each non-empty line becomes one clickable tile.
      </div>
      <div className="question-text-grid-pass-info">
        <span aria-hidden>✦</span>
        <div>
          <strong>Cranberry pass tiles are randomly selected</strong>
          <p>
            When this question opens for play, the app randomly chooses approximately 40% of its tiles, with at least one pass tile. Every tile has an equal chance, and the host cannot see or choose their positions beforehand.
          </p>
          <small>
            {configuredTileCount > 0
              ? `With ${configuredTileCount} tiles, ${randomPassTileCount} will be random pass ${randomPassTileCount === 1 ? "tile" : "tiles"}. Reopening the question draws a fresh pattern.`
              : "Add words above to see how many random pass tiles will be used."}
          </small>
        </div>
      </div>
      <label className="label" style={{ marginTop: "8px" }}>
        Answer
      </label>
      <textarea
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        onBlur={() =>
          upsertQuestion(category, points, {
            answer,
          })
        }
        style={{
          width: "100%",
          minHeight: "60px",
          borderRadius: "10px",
          border: "1px solid rgba(255,255,255,0.12)",
          background: "rgba(255,255,255,0.04)",
          color: "var(--foreground)",
          padding: "10px",
        }}
        placeholder="Expected song title or answer"
      />
    </>
  );
});

const GeoguesserFields = React.memo(function GeoguesserFields({
  category,
  points,
  q,
  upsertQuestion,
  boardValues,
}: FieldProps & { boardValues: readonly number[] }) {
  const [prompt, setPrompt] = useState(q?.prompt ?? "");
  const [mapUrl, setMapUrl] = useState(q?.mapEmbedUrl ?? "");
  const [answer, setAnswer] = useState(q?.answer ?? "");
  const [answerLink, setAnswerLink] = useState(q?.answerLocationUrl ?? "");
  const [timerSeconds, setTimerSeconds] = useState<number>(q?.geoTimerSeconds ?? 10);
  const [unlockLevels, setUnlockLevels] = useState<1 | 2>(q?.geoUnlockLevels === 2 ? 2 : 1);
  const [explorationMode, setExplorationMode] = useState<"timed" | "look" | "free" | "stage">(q?.geoExplorationMode ?? "timed");
  const [stageExploreSeconds, setStageExploreSeconds] = useState(q?.geoStageExploreSeconds ?? 30);
  const [stageGuessSeconds, setStageGuessSeconds] = useState(q?.geoStageGuessSeconds ?? 30);
  const [stageBandsUnit, setStageBandsUnit] = useState<"km" | "m">(q?.geoStageDistanceUnit === "m" ? "m" : "km");
  const [stageBandsText, setStageBandsText] = useState(getGeoStageBands(q?.geoStageDistanceBandsKm).map((band) => q?.geoStageDistanceUnit === "m" ? band * 1000 : band).join(", "));
  const [stageBandsError, setStageBandsError] = useState("");
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [linkLoading, setLinkLoading] = useState(false);
  const [linkError, setLinkError] = useState("");

  React.useEffect(() => {
    setPrompt(q?.prompt ?? "");
    setMapUrl(q?.mapEmbedUrl ?? "");
    setAnswer(q?.answer ?? "");
    setAnswerLink(q?.answerLocationUrl ?? "");
    setTimerSeconds(q?.geoTimerSeconds ?? 10);
    setUnlockLevels(q?.geoUnlockLevels === 2 ? 2 : 1);
    setExplorationMode(q?.geoExplorationMode ?? "timed");
    setStageExploreSeconds(q?.geoStageExploreSeconds ?? 30);
    setStageGuessSeconds(q?.geoStageGuessSeconds ?? 30);
    setStageBandsUnit(q?.geoStageDistanceUnit === "m" ? "m" : "km");
    setStageBandsText(getGeoStageBands(q?.geoStageDistanceBandsKm).map((band) => q?.geoStageDistanceUnit === "m" ? band * 1000 : band).join(", "));
  }, [q?.prompt, q?.mapEmbedUrl, q?.answer, q?.answerLocationUrl, q?.geoTimerSeconds, q?.geoUnlockLevels, q?.geoExplorationMode, q?.geoStageExploreSeconds, q?.geoStageGuessSeconds, q?.geoStageDistanceBandsKm, q?.geoStageDistanceUnit]);

  const normalizedMapUrl = extractEmbedUrl(mapUrl);
  const validMapUrl = Boolean(parseStreetViewSource(normalizedMapUrl));
  const shortMapUrl = isGoogleMapsShortLink(normalizedMapUrl);
  const exploredValue = getGeoExploreValue(points, unlockLevels, boardValues);

  const openMapPicker = async () => {
    setLinkError("");
    let resolvedUrl = normalizedMapUrl;
    if (shortMapUrl) {
      setLinkLoading(true);
      try {
        const response = await fetch("/api/maps/resolve-link", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: resolvedUrl }),
        });
        const result = await response.json() as { url?: string; error?: string };
        if (!response.ok || !result.url) throw new Error(result.error || "Could not resolve this link.");
        resolvedUrl = result.url;
      } catch (error) {
        setLinkError(error instanceof Error ? error.message : "Could not resolve this link.");
        setLinkLoading(false);
        return;
      }
      setLinkLoading(false);
    }
    if (!parseStreetViewSource(resolvedUrl)) {
      setLinkError("Use a Google Maps link with a location, or a complete Street View iframe. If this is a short link, open it in Google Maps and copy the address-bar URL.");
      return;
    }
    setMapUrl(resolvedUrl);
    setShowMapPicker(true);
  };

  return (
    <>
      <label className="label">Hint (optional)</label>
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onBlur={() =>
          upsertQuestion(category, points, {
            prompt,
          })
        }
        style={{
          width: "100%",
          minHeight: "60px",
          borderRadius: "10px",
          border: "1px solid rgba(255,255,255,0.12)",
          background: "rgba(255,255,255,0.04)",
          color: "var(--foreground)",
          padding: "10px",
        }}
        placeholder="Optional hint or instructions"
      />
      <section className="geo-panorama-setup" aria-labelledby={`geo-panorama-${q?.id ?? `${category}-${points}`}`}>
        <div className="geo-panorama-setup-heading">
          <div>
            <strong id={`geo-panorama-${q?.id ?? `${category}-${points}`}`}>Player starting panorama</strong>
            <small>Paste, load, adjust, and confirm one exact opening frame.</small>
          </div>
          <span className={q?.mapEmbedUrl ? "saved" : "empty"}>{q?.mapEmbedUrl ? "View saved" : "Not set"}</span>
        </div>
        <div className="geo-panorama-source-row">
          <input
            className="input"
            value={mapUrl}
            onChange={(event) => { setMapUrl(event.target.value); setLinkError(""); }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && mapUrl.trim()) {
                event.preventDefault();
                void openMapPicker();
              }
            }}
            placeholder="Paste a Google Maps URL, share link, or Street View iframe"
            aria-label="Google Maps or Street View link"
          />
          <button className="button compact" type="button" disabled={linkLoading || !mapUrl.trim()} onClick={() => void openMapPicker()}>
            {linkLoading ? "Loading…" : showMapPicker ? "Reload link" : q?.mapEmbedUrl ? "Edit panorama" : "Load panorama"}
          </button>
        </div>
        {mapUrl && !validMapUrl && !shortMapUrl && (
          <p className="geo-panorama-error">Use a Google Maps link with coordinates, or the complete Street View iframe code.</p>
        )}
        {shortMapUrl && <p className="geo-panorama-note">Short share link detected. Load it to resolve the Street View location.</p>}
        {linkError && <p className="geo-panorama-error" role="alert">{linkError}</p>}
        {showMapPicker ? (
          <StreetViewPicker
            key={normalizedMapUrl}
            sourceUrl={normalizedMapUrl}
            onClose={() => {
              setShowMapPicker(false);
              setMapUrl(q?.mapEmbedUrl ?? "");
              setLinkError("");
            }}
            onSave={(url) => {
              setMapUrl(url);
              upsertQuestion(category, points, { mapEmbedUrl: url });
              setShowMapPicker(false);
            }}
          />
        ) : q?.mapEmbedUrl ? (
          <div className="geo-panorama-confirmed">
            <span aria-hidden>✓</span>
            <p>The saved frame is exactly where players begin. Load it above to make another adjustment.</p>
            <button className="button ghost compact" type="button" onClick={() => {
              setMapUrl("");
              upsertQuestion(category, points, { mapEmbedUrl: null });
            }}>Remove view</button>
          </div>
        ) : (
          <p className="geo-panorama-note">Find the place in Google Maps, copy its link, then load it here. Road-label overlays are hidden; photographed signs remain visible.</p>
        )}
      </section>
      <label className="label" style={{ marginTop: "8px" }}>Player exploration</label>
      <select
        className="input"
        value={explorationMode}
        onChange={(event) => {
          const mode = event.target.value as "timed" | "look" | "free" | "stage";
          setExplorationMode(mode);
          upsertQuestion(category, points, { geoExplorationMode: mode });
        }}
      >
        <option value="timed">Fixed view · pay to explore for a limited time</option>
        <option value="look">Look around and zoom · no movement</option>
        <option value="free">Explore freely · no time limit or point cost</option>
        <option value="stage">Stage challenge · timed explore, then timed map guess</option>
      </select>
      {explorationMode === "stage" && <div className="geo-stage-config">
        <p>One player explores, then places a pin on a world map. The map timer locks the pin; the host reveals the distance and awards points.</p>
        <div className="geo-stage-config-times">
          <label className="label">Street View time (seconds)
            <input className="input" type="number" min={5} max={180} value={stageExploreSeconds} onChange={(event) => setStageExploreSeconds(Number(event.target.value))} onBlur={() => upsertQuestion(category, points, { geoStageExploreSeconds: Math.max(5, Math.min(180, stageExploreSeconds || 30)) })} />
          </label>
          <label className="label">Map guess time (seconds)
            <input className="input" type="number" min={5} max={180} value={stageGuessSeconds} onChange={(event) => setStageGuessSeconds(Number(event.target.value))} onBlur={() => upsertQuestion(category, points, { geoStageGuessSeconds: Math.max(5, Math.min(180, stageGuessSeconds || 30)) })} />
          </label>
        </div>
        <label className="label">Distance bands (nearest to farthest)</label>
        <div className="geo-stage-bands-controls">
          <input className="input" value={stageBandsText} onChange={(event) => { setStageBandsText(event.target.value); setStageBandsError(""); }} onBlur={() => {
            const bands = stageBandsText.split(",").map((part) => Number(part.trim()));
            if (bands.length !== 5 || bands.some((band, index) => !Number.isFinite(band) || band <= 0 || (index > 0 && band <= bands[index - 1]))) {
              setStageBandsError("Enter five increasing distances, separated by commas.");
              return;
            }
            upsertQuestion(category, points, { geoStageDistanceBandsKm: bands.map((band) => stageBandsUnit === "m" ? band / 1000 : band) });
          }} placeholder={stageBandsUnit === "m" ? "25000, 100000, 500000, 2000000, 5000000" : "25, 100, 500, 2000, 5000"} />
          <select className="input geo-stage-bands-unit" value={stageBandsUnit} aria-label="Distance band unit" onChange={(event) => {
            const nextUnit = event.target.value === "m" ? "m" : "km";
            const values = stageBandsText.split(",").map((part) => Number(part.trim()));
            const valid = values.length === 5 && values.every((band, index) => Number.isFinite(band) && band > 0 && (index === 0 || band > values[index - 1]));
            const bandsKm = valid ? values.map((band) => stageBandsUnit === "m" ? band / 1000 : band) : getGeoStageBands(q?.geoStageDistanceBandsKm);
            setStageBandsUnit(nextUnit);
            setStageBandsText(bandsKm.map((band) => nextUnit === "m" ? Number((band * 1000).toFixed(6)) : band).join(", "));
            setStageBandsError("");
            upsertQuestion(category, points, { geoStageDistanceUnit: nextUnit, geoStageDistanceBandsKm: bandsKm });
          }}>
            <option value="km">km</option>
            <option value="m">m</option>
          </select>
          <button className="button ghost compact" type="button" onPointerDown={(event) => event.preventDefault()} onClick={() => {
            const defaults = [...DEFAULT_GEO_STAGE_BANDS_KM];
            setStageBandsText(defaults.map((band) => stageBandsUnit === "m" ? band * 1000 : band).join(", "));
            setStageBandsError("");
            upsertQuestion(category, points, { geoStageDistanceBandsKm: defaults });
          }}>Reset distance bands</button>
        </div>
        {stageBandsError && <small role="alert" className="geo-stage-config-error">{stageBandsError}</small>}
        <small>Within each band earns 100%, 80%, 60%, 40%, or 20% of the tile. Farther away, or no pin: 0 points.</small>
      </div>}
      {explorationMode === "timed" && <>
      <label className="label" style={{ marginTop: "8px" }}>
        Exploration time (seconds)
      </label>
      <input
        className="input"
        type="number"
        min={3}
        max={90}
        value={timerSeconds}
        onChange={(e) => setTimerSeconds(Number(e.target.value))}
        onBlur={() =>
          upsertQuestion(category, points, {
            geoTimerSeconds: Number.isFinite(timerSeconds) ? timerSeconds : 10,
          })
        }
        placeholder="e.g. 10"
      />
      <label className="label" style={{ marginTop: "8px" }}>Exploration cost</label>
      <select
        className="input"
        value={unlockLevels}
        onChange={(event) => {
          const levels = Number(event.target.value) === 2 ? 2 : 1;
          setUnlockLevels(levels);
          upsertQuestion(category, points, { geoUnlockLevels: levels });
        }}
      >
        <option value={1}>One point level · {points} → {getGeoExploreValue(points, 1, boardValues)} pts</option>
        <option value={2}>Two point levels · {points} → {getGeoExploreValue(points, 2, boardValues)} pts</option>
      </select>
      </>}
      <details className="question-help">
        <summary>How this mode works</summary>
        <p>
          {explorationMode === "timed"
            ? `Players first see only the saved starting frame. Choosing to explore unlocks movement for ${timerSeconds || 10} seconds and changes a correct answer from ${points} to ${exploredValue} points.`
            : explorationMode === "stage"
              ? "A player starts a timed Street View exploration. When it ends, a separate map timer starts only after the map loads. The last pin placed before time runs out is locked. The host then reveals a straight-line distance and awards points from the configured bands."
            : explorationMode === "look"
              ? "Players may turn and zoom immediately, but cannot move to another panorama. Full points remain available."
              : "Players may turn, zoom, and move between panoramas for as long as they want. Full points remain available."}
          {" "}On the answer side, the host can always explore freely. Google&apos;s road labels and address overlay are hidden, but words photographed in the scene are not.
        </p>
      </details>
      <label className="label" style={{ marginTop: "8px" }}>
        Answer text (address / location)
      </label>
      <textarea
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        onBlur={() =>
          upsertQuestion(category, points, {
            answer,
          })
        }
        style={{
          width: "100%",
          minHeight: "60px",
          borderRadius: "10px",
          border: "1px solid rgba(255,255,255,0.12)",
          background: "rgba(255,255,255,0.04)",
          color: "var(--foreground)",
          padding: "10px",
        }}
        placeholder="Expected location description or address"
      />
      <label className="label" style={{ marginTop: "8px" }}>
        Answer link (Google Maps URL)
      </label>
      <input
        className="input"
        value={answerLink}
        onChange={(e) => setAnswerLink(e.target.value)}
        onBlur={() =>
          upsertQuestion(category, points, {
            answerLocationUrl: answerLink || null,
          })
        }
        placeholder="https://maps.google.com/..."
      />
    </>
  );
});

const JokerFields = React.memo(function JokerFields({
  category,
  points,
  q,
  upsertQuestion,
}: FieldProps) {
  const [count, setCount] = useState<number>(q?.jokerCount ?? 5);
  const [minVal, setMinVal] = useState<number>(q?.jokerMin ?? 1);
  const [maxVal, setMaxVal] = useState<number>(q?.jokerMax ?? 9);
  const [jokerPrompt, setJokerPrompt] = useState<string>(q?.prompt ?? "");
  const [rotateOnMiss, setRotateOnMiss] = useState<boolean>(q?.jokerRotateOnMiss ?? true);

  React.useEffect(() => {
    setCount(q?.jokerCount ?? 5);
    setMinVal(q?.jokerMin ?? 1);
    setMaxVal(q?.jokerMax ?? 9);
    setJokerPrompt(q?.prompt ?? "");
    setRotateOnMiss(q?.jokerRotateOnMiss ?? true);
  }, [q?.jokerCount, q?.jokerMin, q?.jokerMax, q?.jokerRotateOnMiss, q?.prompt]);

  const clampInt = (value: number, min: number, max: number) =>
    Math.min(max, Math.max(min, Math.round(value)));

  const persistSettings = (next: Partial<Question>) =>
    upsertQuestion(category, points, next);

  const handleCountBlur = () => {
    const safe = clampInt(count || 5, 3, 9);
    setCount(safe);
    persistSettings({ jokerCount: safe });
  };

  const handleRangeBlur = (which: "min" | "max") => {
    let nextMin = minVal || 1;
    let nextMax = maxVal || 9;
    nextMin = clampInt(nextMin, -50, 100);
    nextMax = clampInt(nextMax, -50, 100);
    if (nextMin >= nextMax) {
      if (which === "min") nextMax = nextMin + 1;
      else nextMin = nextMax - 1;
    }
    setMinVal(nextMin);
    setMaxVal(nextMax);
    persistSettings({ jokerMin: nextMin, jokerMax: nextMax });
  };

  return (
    <>
      <div
        style={{
          padding: "10px",
          borderRadius: "12px",
          border: "1px solid rgba(255,255,255,0.12)",
          background: "rgba(255,255,255,0.04)",
          color: "var(--muted)",
          marginBottom: "20px",
          fontSize: "0.95rem",
          lineHeight: 1.4,
        }}
      >
        The player starts at level 1 (20%). Correct moves up one level, wrong moves down one level, and the hidden 🎩 Joker jumps directly to level 6 (100%).
      </div>
      <label className="label">Title or question (optional)</label>
      <textarea
        className="input joker-config-prompt"
        value={jokerPrompt}
        onChange={(event) => setJokerPrompt(event.target.value)}
        onBlur={() => persistSettings({ prompt: jokerPrompt })}
        placeholder="For example: Can you survive the Christmas Joker?"
      />
      <small className="joker-config-prompt-help">
        Shown above the higher-or-lower board. Leave blank to use the standard game instruction.
      </small>
      <label className="label">Circles per row</label>
      <input
        className="input"
        type="number"
        min={3}
        max={9}
        value={count}
        onChange={(e) => setCount(Number(e.target.value))}
        onBlur={handleCountBlur}
      />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "10px", marginTop: "10px" }}>
        <div>
          <label className="label">Min value</label>
          <input
            className="input"
            type="number"
          value={minVal}
          onChange={(e) => setMinVal(Number(e.target.value))}
          onBlur={() => handleRangeBlur("min")}
        />
      </div>
      <div>
        <label className="label">Max value</label>
        <input
            className="input"
            type="number"
            value={maxVal}
            onChange={(e) => setMaxVal(Number(e.target.value))}
            onBlur={() => handleRangeBlur("max")}
          />
        </div>
      </div>
      <div
        style={{
          marginTop: "6px",
          color: "var(--muted)",
          fontSize: "0.9rem",
        }}
      >
        Prize ladder: 20% · 25% · 33% · 44% · 72% · 100% of this question&apos;s {points} points. Results are rounded to whole points.
      </div>
      <div style={{ display: "grid", gap: "8px", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", marginTop: "10px" }}>
        <label
          className="label"
          style={{ display: "inline-flex", alignItems: "center", gap: "8px", cursor: "pointer" }}
        >
          <input
            type="checkbox"
            checked={rotateOnMiss}
            onChange={(e) => {
              setRotateOnMiss(e.target.checked);
              persistSettings({ jokerRotateOnMiss: e.target.checked });
            }}
            style={{ width: "16px", height: "16px", cursor: "pointer" }}
          />
          Rotate teams on wrong guess
        </label>
      </div>
    </>
  );
});

const TimelineFields = React.memo(function TimelineFields({
  category,
  points,
  q,
  upsertQuestion,
}: FieldProps) {
  const [centerYear, setCenterYear] = useState<number>(q?.timelineCenterYear ?? 2000);
  const [centerLabel, setCenterLabel] = useState<string>(q?.timelineCenterLabel ?? "Center year");
  const [title, setTitle] = useState<string>(q?.timelineTitle ?? "Timeline");
  const [rotateOnMiss, setRotateOnMiss] = useState<boolean>(q?.timelineRotateOnMiss ?? true);
  const [bulkEvents, setBulkEvents] = useState(
    (q?.timelineEvents ?? [])
      .map((ev) => {
        const baseYear = Math.abs(ev.year ?? 0);
        const era = ev.year && ev.year < 0 ? "BC" : "AC";
        const eventText = ev.text ?? "";
        const timelineText = ev.timelineText ?? ev.text ?? "";
        return `${baseYear} ${era}, ${eventText}, ${timelineText}`;
      })
      .join("\n"),
    );

  React.useEffect(() => {
    setCenterYear(q?.timelineCenterYear ?? 2000);
    setCenterLabel(q?.timelineCenterLabel ?? "Center year");
    setTitle(q?.timelineTitle ?? "Timeline");
    setRotateOnMiss(q?.timelineRotateOnMiss ?? true);
    setBulkEvents(
      (q?.timelineEvents ?? [])
        .map((ev) => {
          const baseYear = Math.abs(ev.year ?? 0);
          const era = ev.year && ev.year < 0 ? "BC" : "AC";
          const eventText = ev.text ?? "";
          const timelineText = ev.timelineText ?? ev.text ?? "";
          return `${baseYear} ${era}, ${eventText}, ${timelineText}`;
        })
        .join("\n"),
    );
  }, [q?.timelineCenterYear, q?.timelineEvents]);

  const persistCenterYear = () => {
    const safe = Number.isFinite(centerYear) ? Math.round(centerYear) : 2000;
    setCenterYear(safe);
    upsertQuestion(category, points, { timelineCenterYear: safe });
  };
  const persistCenterLabel = () => {
    upsertQuestion(category, points, { timelineCenterLabel: centerLabel });
  };
  const persistSettings = () => {
    upsertQuestion(category, points, {
      timelineRotateOnMiss: rotateOnMiss,
    });
  };
  const persistTitle = () => {
    upsertQuestion(category, points, { timelineTitle: title });
  };

  const parseBulkEvents = (raw: string): Question["timelineEvents"] => {
    return raw
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        // Expect "YEAR AC/BC, Event prompt, Timeline text"
        const [yearPart, ...rest] = line.split(",").map((p) => p.trim());
        const promptText = rest[0] ?? "";
        const timelineText = rest.slice(1).join(", ") || promptText;
        const yearTokens = (yearPart || "").split(/\s+/);
        const yearNum = Number(yearTokens[0]);
        const eraToken = (yearTokens[1] || "AC").toUpperCase();
        const signedYear = Number.isFinite(yearNum)
          ? eraToken === "BC"
            ? -Math.abs(yearNum)
            : Math.abs(yearNum)
          : null;
        return {
          id: makeId("timeline"),
          text: promptText,
          year: signedYear,
          isBC: eraToken === "BC",
          timelineText,
        };
      });
  };

  return (
    <>
      <div
        style={{
          padding: "10px",
          borderRadius: "12px",
          border: "1px solid rgba(255,255,255,0.12)",
          background: "rgba(255,255,255,0.04)",
          color: "var(--muted)",
          marginBottom: "8px",
          fontSize: "0.95rem",
          lineHeight: 1.4,
        }}
      >
        Paste one event per line: YEAR AC/BC, Event prompt, Timeline text.
      </div>
      <label className="label">Center year</label>
      <input
        className="input"
        type="number"
        value={centerYear}
        onChange={(e) => setCenterYear(Number(e.target.value))}
        onBlur={persistCenterYear}
      />
      <label className="label" style={{ marginTop: "8px" }}>
        Center label (shown on the timeline)
      </label>
      <input
        className="input"
        value={centerLabel}
        onChange={(e) => setCenterLabel(e.target.value)}
        onBlur={persistCenterLabel}
        placeholder="Center year"
      />
      <label className="label" style={{ marginTop: "8px" }}>
        Timeline title (shown in modal)
      </label>
      <input
        className="input"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={persistTitle}
        placeholder="Timeline"
      />
      <div style={{ display: "grid", gap: "8px", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", marginTop: "10px" }}>
        <label
          className="label"
          style={{ display: "inline-flex", alignItems: "center", gap: "8px", cursor: "pointer" }}
        >
          <input
            type="checkbox"
            checked={rotateOnMiss}
            onChange={(e) => setRotateOnMiss(e.target.checked)}
            onBlur={persistSettings}
            style={{ width: "16px", height: "16px", cursor: "pointer" }}
          />
          Rotate teams on wrong guess
        </label>
      </div>
      <p className="muted" style={{ margin: "8px 0", fontSize: ".85rem" }}>
        Each event is worth one share of the question’s points. Correct placements earn that share. Wrong cards return to the back of the deck without revealing their year or losing points. With rotation enabled, the next team takes the next card. If only one card remains, it is tried again. The full pool is awarded once every card is placed correctly.
      </p>
      <label className="label" style={{ marginTop: "10px" }}>
        Events (one per line: YEAR AC/BC, Event prompt, Timeline text)
      </label>
      <textarea
        className="input"
        style={{ minHeight: "160px" }}
        value={bulkEvents}
        onChange={(e) => {
          setBulkEvents(e.target.value);
        }}
        onBlur={() => {
          const parsed = parseBulkEvents(bulkEvents);
          upsertQuestion(category, points, { timelineEvents: parsed });
        }}
        placeholder={`e.g.\n1998 AC, Google founded, Google's rise\n44 BC, Julius Caesar assassinated, End of the Roman Republic`}
      />
    </>
  );
});

export default function QuestionConfigPage() {
  const [settings, setSettings] = useSettings();
  const [questions, setQuestions, questionsHydrated] = usePersistentQuestions();
  const [newCategory, setNewCategory] = useState("");
  const [categoryNames, setCategoryNames] = useState<Record<string, string>>({});
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [dragging, setDragging] = useState<{ category: string; points: PointValue } | null>(null);
  const [dragOver, setDragOver] = useState<PointValue | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const dragOrigin = React.useRef<{ x: number; y: number } | null>(null);
  const [draggingCategory, setDraggingCategory] = useState<string | null>(null);
  const [categoryDragOver, setCategoryDragOver] = useState<string | null>(null);
  const [categoryDragOffset, setCategoryDragOffset] = useState(0);
  const categoryDragOrigin = React.useRef<number | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [showFinaleMusicPreview, setShowFinaleMusicPreview] = useState(false);
  const [hostMessagesExpanded, setHostMessagesExpanded] = useState(false);
  const [expandedQuestions, setExpandedQuestions] = useState<Set<string>>(
    () => new Set(),
  );
  const cardPresses = React.useRef(new Map<string, { x: number; y: number; blocked: boolean }>());
  const [teams, setTeams] = usePersistentState<Team[]>(
    TEAM_STORAGE_KEY,
    [],
    [LEGACY_TEAM_STORAGE_KEY],
  );
  const [, setScoreHistory] = usePersistentState<ScoreTransaction[]>(
    SCORE_HISTORY_STORAGE_KEY,
    [],
  );
  const { reset: resetTurnState } = useTurnState();

  const finaleMusicEnabled = settings.finaleMusicEnabled ?? DEFAULT_SETTINGS.finaleMusicEnabled;
  const finaleMusicUrl = settings.finaleMusicUrl ?? DEFAULT_SETTINGS.finaleMusicUrl;
  const finaleMusicStartSeconds = settings.finaleMusicStartSeconds
    ?? getYouTubeStartSeconds(finaleMusicUrl);
  const finaleMusicVolume = settings.finaleMusicVolume ?? DEFAULT_SETTINGS.finaleMusicVolume;
  const legacyFinaleDuration = settings.finaleMusicDurationSeconds
    ?? (DEFAULT_SETTINGS.finaleMusicEndSeconds - DEFAULT_SETTINGS.finaleMusicStartSeconds);
  const finaleMusicEndSeconds = settings.finaleMusicEndSeconds
    ?? (finaleMusicStartSeconds + legacyFinaleDuration);
  const finaleMusicRangeValid = finaleMusicEndSeconds > finaleMusicStartSeconds;
  const finaleMusicPreviewUrl = finaleMusicRangeValid ? buildYouTubeEmbedUrl(finaleMusicUrl, {
    startSeconds: finaleMusicStartSeconds,
    endSeconds: finaleMusicEndSeconds,
  }) : "";
  const hostMessages = settings.hostMessages ?? DEFAULT_SETTINGS.hostMessages;
  const playableBoardQuestionCount = questions.filter(isQuestionReady).length;

  const addHostMessage = () => {
    const lastTrigger = hostMessages.reduce(
      (highest, message) => Math.max(highest, message.afterQuestionCount),
      0,
    );
    setSettings((previous) => ({
      ...previous,
      hostMessages: [
        ...(previous.hostMessages ?? []),
        {
          id: makeId("host-message"),
          afterQuestionCount: lastTrigger > 0
            ? lastTrigger + 5
            : playableBoardQuestionCount > 0
              ? Math.min(5, playableBoardQuestionCount)
              : 5,
          text: "",
          revealStyle: "spin-wheel",
        },
      ],
    }));
    setHostMessagesExpanded(true);
  };

  const updateHostMessage = (
    id: string,
    updates: Partial<HostMessage>,
  ) => {
    setSettings((previous) => ({
      ...previous,
      hostMessages: (previous.hostMessages ?? []).map((message) =>
        message.id === id ? { ...message, ...updates } : message,
      ),
    }));
  };

  const removeHostMessage = (id: string) => {
    setSettings((previous) => ({
      ...previous,
      hostMessages: (previous.hostMessages ?? []).filter((message) => message.id !== id),
    }));
  };

  const categories = useMemo(() => {
    const list = questionsHydrated && Array.isArray(questions) ? questions : [];
    return Array.from(new Set(list.map((q) => q.category)));
  }, [questions, questionsHydrated]);
  const finalRowPoints = Math.max(0, ...questions.map((question) => question.points));
  const finalRowMissingCategories = categories.filter((category) =>
    !questions.some((question) => question.category === category && question.points === finalRowPoints),
  );
  const finalCategory = Object.keys(settings.boardRevealRules?.categories ?? {})[0] ?? "";
  const finalMode = Object.keys(settings.boardRevealRules?.rows ?? {}).length ? "row" : finalCategory ? "category" : "none";
  const setRevealRule = (scope: keyof BoardRevealRules, key: string, rule: BoardRevealRule | null) => {
    setSettings((previous) => {
      const scoped = scope === "categories" || scope === "rows"
        ? {} as Record<string, BoardRevealRule>
        : { ...(previous.boardRevealRules?.[scope] ?? {}) };
      if (rule) scoped[key] = rule;
      else delete scoped[key];
      return {
        ...previous,
        boardRevealRules: { ...previous.boardRevealRules, [scope]: scoped },
      };
    });
  };
  const setFinalReveal = (mode: "none" | "row" | "category", category = finalCategory || categories[categories.length - 1]) => {
    setSettings((previous) => ({
      ...previous,
      boardRevealRules: {
        ...previous.boardRevealRules,
        rows: mode === "row" && finalRowPoints ? { [String(finalRowPoints)]: { when: "board-complete" } } : {},
        categories: mode === "category" && category ? { [category]: { when: "board-complete" } } : {},
      },
    }));
    if (mode === "category" && category) {
      setQuestions((previous) => [
        ...previous.filter((question) => question.category !== category),
        ...previous.filter((question) => question.category === category),
      ]);
    }
  };

  useEffect(() => {
    const finalQuestionIds = new Set(categories.map((category) =>
      questions.filter((question) => question.category === category)
        .sort((first, second) => second.points - first.points)[0]?.id,
    ).filter(Boolean));
    const current = settings.boardRevealRules?.questions ?? {};
    const cleaned: Record<string, BoardRevealRule> = Object.fromEntries(Object.entries(current)
      .filter(([id]) => finalQuestionIds.has(id))
      .map(([id, rule]) => [id, rule.when === "category-complete"
        ? { when: "category-complete" as const, category: OWN_CATEGORY }
        : rule]));
    if (JSON.stringify(cleaned) === JSON.stringify(current)) return;
    setSettings((previous) => ({
      ...previous,
      boardRevealRules: { ...previous.boardRevealRules, questions: cleaned },
    }));
  }, [categories, questions, setSettings, settings.boardRevealRules?.questions]);

  useEffect(() => {
    setCategoryNames((prev) => {
      const next = { ...prev };
      categories.forEach((cat) => {
        if (!next[cat]) next[cat] = cat;
      });
      // prune removed categories
      Object.keys(next).forEach((key) => {
        if (!categories.includes(key)) {
          delete next[key];
        }
      });
      return next;
    });
  }, [categories]);

  useEffect(() => {
    setActiveCategory((prev) => {
      if (prev && categories.includes(prev)) return prev;
      return categories[0] ?? null;
    });
  }, [categories]);

  useEffect(() => {
    const update = () => {
      if (typeof window === "undefined") return;
      setIsMobile(window.innerWidth <= 768);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const upsertQuestion = (
    category: string,
    points: PointValue,
    updates: Partial<Question>,
  ) => {
    setQuestions((prev) => {
      const index = prev.findIndex(
        (q) => q.category === category && q.points === points,
      );
      if (index >= 0) {
        const updated = [...prev];
        updated[index] = { ...updated[index], ...updates };
        return updated;
      }
      return [
        ...prev,
        {
          id: makeId("q"),
          category,
          points,
          prompt: "",
          answer: "",
          answered: false,
          type: "standard",
          ...updates,
        },
      ];
    });
  };

  const switchQuestionType = (
    category: string,
    points: PointValue,
    nextType: QuestionType,
  ) => {
    setQuestions((previous) => {
      if (!previous.some((question) => question.category === category && question.points === points)) {
        return [...previous, {
          id: makeId("q"),
          category,
          points,
          prompt: "",
          answer: "",
          answered: false,
          type: nextType,
        }];
      }
      return previous.map((question) => {
        if (question.category !== category || question.points !== points) return question;
        const currentType = (question.type ?? "standard") as QuestionType;
        if (currentType === nextType) return question;

        const activeDraft: Partial<Question> = { ...question };
        delete activeDraft.id;
        delete activeDraft.category;
        delete activeDraft.points;
        delete activeDraft.answered;
        delete activeDraft.type;
        delete activeDraft.typeDrafts;
        const drafts = { ...(question.typeDrafts ?? {}) };
        drafts[currentType] = activeDraft as QuestionTypeDraft;
        const restoredDraft = drafts[nextType];
        delete drafts[nextType];

        return {
          id: question.id,
          category: question.category,
          points: question.points,
          answered: question.answered,
          prompt: "",
          answer: "",
          ...(restoredDraft ?? {}),
          type: nextType,
          typeDrafts: Object.keys(drafts).length ? drafts : undefined,
        };
      });
    });
  };

  const moveQuestionTo = (category: string, fromPoints: PointValue, toPoints: PointValue) => {
    if (fromPoints === toPoints) return;
    setQuestions((prev) => {
      const next = [...prev];
      const fromIdx = next.findIndex((q) => q.category === category && q.points === fromPoints);
      const toIdx = next.findIndex((q) => q.category === category && q.points === toPoints);
      if (fromIdx === -1 || toIdx === -1) return prev;
      const fromQ = next[fromIdx];
      const toQ = next[toIdx];
      next[fromIdx] = { ...toQ, points: fromPoints };
      next[toIdx] = { ...fromQ, points: toPoints };
      return next;
    });
  };

  const bumpQuestion = (category: string, points: PointValue, direction: -1 | 1) => {
    const values = questions.filter((question) => question.category === category)
      .map((question) => question.points).sort((first, second) => first - second);
    const idx = values.indexOf(points);
    const target = values[idx + direction];
    if (idx === -1 || target === undefined) return;
    moveQuestionTo(category, points, target);
  };

  const addQuestion = (category: string) => {
    const categoryQuestions = questions.filter((question) => question.category === category);
    const occupied = new Set(categoryQuestions.map((question) => question.points));
    let points = POINT_STEP;
    while (occupied.has(points)) points += POINT_STEP;
    const previousFinal = Math.max(0, ...questions.map((question) => question.points));
    if (points > previousFinal) {
      const oldRule = settings.boardRevealRules?.rows?.[String(previousFinal)];
      if (oldRule) setRevealRule("rows", String(points), oldRule);
    }
    const previousFinalQuestion = [...categoryQuestions].sort((a, b) => b.points - a.points)[0];
    const previousQuestionRule = previousFinalQuestion
      ? settings.boardRevealRules?.questions?.[previousFinalQuestion.id]
      : undefined;
    const id = makeId("q");
    upsertQuestion(category, points, { id });
    if (previousQuestionRule) {
      setRevealRule("questions", previousFinalQuestion.id, null);
      setRevealRule("questions", id, previousQuestionRule);
    }
    setExpandedQuestions((previous) => {
      const next = new Set(previous);
      next.delete(`${category}-${points}`);
      return next;
    });
  };

  const removeQuestion = (question: Question) => {
    const inCategory = questions.filter((candidate) => candidate.category === question.category);
    if (inCategory.length <= 1) return;
    if (finalMode === "row" && question.points === finalRowPoints) return;
    if (!window.confirm(
      `Remove the ${question.points}-point question from ${question.category}? Any points already awarded will stay on the scoreboard.`,
    )) return;
    const finalPoints = Math.max(0, ...questions.map((candidate) => candidate.points));
    const remaining = questions.filter((candidate) => candidate.id !== question.id);
    const nextFinal = Math.max(0, ...remaining.map((candidate) => candidate.points));
    if (question.points === finalPoints && nextFinal < finalPoints) {
      const oldRule = settings.boardRevealRules?.rows?.[String(finalPoints)];
      if (oldRule) setRevealRule("rows", String(nextFinal), oldRule);
    }
    const questionRule = settings.boardRevealRules?.questions?.[question.id];
    const nextCategoryFinal = remaining
      .filter((candidate) => candidate.category === question.category)
      .sort((a, b) => b.points - a.points)[0];
    if (questionRule && nextCategoryFinal) setRevealRule("questions", nextCategoryFinal.id, questionRule);
    setQuestions((previous) => previous.filter((candidate) => candidate.id !== question.id));
    setRevealRule("questions", question.id, null);
    setExpandedQuestions((previous) => {
      const next = new Set(previous);
      next.delete(`${question.category}-${question.points}`);
      return next;
    });
  };

  const moveCategoryTo = (category: string, targetCategory: string) => {
    if (category === targetCategory) return;
    setQuestions((previous) => {
      const order = Array.from(new Set(previous.map((question) => question.category)));
      const fromIndex = order.indexOf(category);
      const toIndex = order.indexOf(targetCategory);
      if (fromIndex < 0 || toIndex < 0) return previous;
      const bonusCategory = Object.keys(settings.boardRevealRules?.categories ?? {})[0];
      if (bonusCategory && (order[fromIndex] === bonusCategory || order[toIndex] === bonusCategory)) return previous;

      const [moved] = order.splice(fromIndex, 1);
      order.splice(toIndex, 0, moved);
      const questionsByCategory = new Map<string, Question[]>();
      previous.forEach((question) => {
        const group = questionsByCategory.get(question.category) ?? [];
        group.push(question);
        questionsByCategory.set(question.category, group);
      });

      return order.flatMap((name) => questionsByCategory.get(name) ?? []);
    });
  };

  const setCategoryCollapsed = (category: string, collapsed: boolean) => {
    setExpandedQuestions((previous) => {
      const next = new Set(previous);
      questions.filter((question) => question.category === category).forEach(({ points }) => {
        const key = `${category}-${points}`;
        if (collapsed) next.delete(key);
        else next.add(key);
      });
      return next;
    });
  };

  const handleNewCategory = () => {
    if (!newCategory.trim()) return;
    const name = newCategory.trim();
    setQuestions((prev) => {
      const hasCategory = prev.some((q) => q.category === name);
      if (hasCategory) return prev;
      const categoryPointValues = finalMode === "row"
        ? Array.from({ length: finalRowPoints / POINT_STEP }, (_, index) => (index + 1) * POINT_STEP)
        : POINT_VALUES;
      const additions = categoryPointValues.map<Question>((points) => ({
        id: makeId("q"),
        category: name,
        points,
        prompt: "",
        answer: "",
        answered: false,
        type: "standard",
      }));
      const bonusCategory = Object.keys(settings.boardRevealRules?.categories ?? {})[0];
      const firstBonusIndex = bonusCategory ? prev.findIndex((question) => question.category === bonusCategory) : -1;
      return firstBonusIndex < 0
        ? [...prev, ...additions]
        : [...prev.slice(0, firstBonusIndex), ...additions, ...prev.slice(firstBonusIndex)];
    });
    setNewCategory("");
    setActiveCategory(name);
  };

  const deleteCategory = (category: string) => {
    setSettings((previous) => {
      const rules = previous.boardRevealRules ?? {};
      const categories = { ...rules.categories };
      delete categories[category];
      const remap = (items?: Record<string, BoardRevealRule>) => Object.fromEntries(
        Object.entries(items ?? {}).filter(([, rule]) => rule.when !== "category-complete" || rule.category !== category),
      );
      return { ...previous, boardRevealRules: {
        categories: remap(categories), rows: remap(rules.rows), questions: remap(rules.questions),
      } };
    });
    setQuestions((prev) => prev.filter((q) => q.category !== category));
    setActiveCategory((prevActive) => {
      if (!prevActive) return null;
      if (prevActive !== category) return prevActive;
      const idx = categories.findIndex((c) => c === category);
      if (idx === -1) return categories[0] ?? null;
      const left = categories[idx - 1];
      const right = categories[idx + 1];
      return right ?? left ?? categories[0] ?? null;
    });
  };

  const renameCategory = (oldName: string, newNameRaw: string) => {
    const newName = newNameRaw.trim();
    if (!newName || newName === oldName) return;
    // avoid duplicates
    if (categories.includes(newName)) {
      alert("A category with that name already exists.");
      return;
    }
    setSettings((previous) => {
      const rules = previous.boardRevealRules ?? {};
      const renamed = (items?: Record<string, BoardRevealRule>) => Object.fromEntries(
        Object.entries(items ?? {}).map(([key, rule]) => [key, rule.when === "category-complete" && rule.category === oldName
          ? { ...rule, category: newName } : rule]),
      );
      const categoryRules = renamed(rules.categories);
      if (categoryRules[oldName]) {
        categoryRules[newName] = categoryRules[oldName];
        delete categoryRules[oldName];
      }
      return { ...previous, boardRevealRules: {
        categories: categoryRules, rows: renamed(rules.rows), questions: renamed(rules.questions),
      } };
    });
    setQuestions((prev) =>
      prev.map((q) =>
        q.category === oldName
          ? {
              ...q,
              category: newName,
            }
          : q,
      ),
    );
  };

  const resetGameProgress = () => {
    if (!window.confirm(
      "Reset all scores, played tiles, score visibility, audio replay usage, turn order, revealed categories, dismissed host messages, and score history? Team and question content will be kept.",
    )) return;

    setQuestions((prev) => prev.map((q) => ({ ...q, answered: false })));
    setTeams((previous) => previous.map((team) => ({ ...team, score: 0 })));
    setScoreHistory([]);
    resetTurnState();
  };

  const getQuestion = (category: string, points: PointValue) =>
    questions.find((q) => q.category === category && q.points === points);

  const handleImageChange = (
    category: string,
    points: PointValue,
    file: File | null,
  ) => {
    if (!file) {
      upsertQuestion(category, points, { imageData: null, imageName: null });
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      alert("Image is too large. Please keep it under ~3MB.");
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result?.toString() ?? "";
      upsertQuestion(category, points, {
        imageData: result,
        imageName: file.name,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleAnswerImageChange = (
    category: string,
    points: PointValue,
    file: File | null,
  ) => {
    if (!file) {
      upsertQuestion(category, points, {
        answerImageData: null,
        answerImageName: null,
      });
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      alert("Image is too large. Please keep it under ~3MB.");
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result?.toString() ?? "";
      upsertQuestion(category, points, {
        answerImageData: result,
        answerImageName: file.name,
      });
    };
    reader.readAsDataURL(file);
};


  return (
    <main className="question-studio">
      <div className="question-studio-header">
        <div>
          <span className="question-studio-kicker">Quiz studio</span>
          <h1>Build the board</h1>
          <p>
            Choose a category, then shape each clue from 100 to 500 points.
          </p>
        </div>
        <div className="question-studio-actions">
          <button className="button ghost compact" onClick={resetGameProgress} style={{ cursor: "pointer" }}>
            Reset game progress
          </button>
        </div>
      </div>

      <section className="question-board-config" aria-labelledby="board-config-title">
        <div className="question-board-config-heading">
          <div>
            <span className="question-studio-kicker">Show controls</span>
            <h2 id="board-config-title">Board config</h2>
          </div>
          <p>Set what the audience sees at the opening and hears at the finale.</p>
        </div>

        <div className="question-board-config-grid">
          <label className="question-board-reveal-setting" htmlFor="question-hide-category-headers">
            <input
              id="question-hide-category-headers"
              type="checkbox"
              checked={settings.hideCategoryHeadersAtStart !== false}
              onChange={(event) => setSettings((previous) => ({
                ...previous,
                hideCategoryHeadersAtStart: event.target.checked,
              }))}
            />
            <span>
              <strong>Hide category titles at start</strong>
              <small>Reveal each title from the board during the show.</small>
            </span>
          </label>

          <div className="question-reveal-settings">
            <strong>Final board reveal</strong>
            <small>Choose one expansion for the endgame. It appears when every opening-board question has been played.</small>
            <div className="question-final-mode" role="radiogroup" aria-label="Final board reveal">
              {([
                ["none", "No expansion"],
                ["row", `Final ${finalRowPoints || "—"}-point row`],
                ["category", "Final category"],
              ] as const).map(([mode, label]) => (
                <label key={mode} className={finalMode === mode ? "selected" : ""}>
                  <input
                    type="radio"
                    name="final-board-reveal"
                    value={mode}
                    checked={finalMode === mode}
                    disabled={mode !== "none" && (mode === "row" ? !finalRowPoints : !categories.length)}
                    onChange={() => setFinalReveal(mode)}
                  />
                  {label}
                </label>
              ))}
            </div>
            {finalMode === "row" && finalRowMissingCategories.length > 0 && (
              <aside className="question-final-row-hint" role="status">
                <span className="question-final-row-hint-icon" aria-hidden>!</span>
                <span className="question-final-row-hint-copy">
                  <strong>Final row is incomplete</strong>
                  <small>Add a {finalRowPoints}-point question to: {finalRowMissingCategories.join(", ")}.</small>
                </span>
                <button type="button" onClick={() => finalRowMissingCategories.forEach((category) => upsertQuestion(category, finalRowPoints, {}))}>
                  + Add missing slots
                </button>
              </aside>
            )}
            {finalMode === "category" && (
              <label className="question-final-category-picker">
                <span>Category to reveal</span>
                <select className="input" value={finalCategory} onChange={(event) => setFinalReveal("category", event.target.value)}>
                  {categories.map((category) => <option key={category} value={category}>{category}</option>)}
                </select>
                <small>We move it to the far right of the board automatically.</small>
              </label>
            )}
            <aside className="question-reveal-info">
              <strong>Want just one bonus question?</strong>
              <span>Open that category’s final question and choose “After this category is complete,” or reveal it after the entire opening board. This hides one question—not a whole row.</span>
            </aside>
          </div>

          <div className="question-finale-music-setting">
            <label className="question-finale-music-toggle question-finale-reveal-toggle" htmlFor="question-staged-podium-reveal">
              <input
                id="question-staged-podium-reveal"
                type="checkbox"
                checked={settings.stagedPodiumReveal !== false}
                onChange={(event) => setSettings((previous) => ({
                  ...previous,
                  stagedPodiumReveal: event.target.checked,
                }))}
              />
              <span>
                <strong>Reveal podium tier by tier</strong>
                <small>Reveal each place from last to first. Tied teams reveal together. The WRAP song and full celebration start when first place is revealed.</small>
              </span>
            </label>

            <label className="question-finale-music-toggle" htmlFor="question-finale-music-enabled">
              <input
                id="question-finale-music-enabled"
                type="checkbox"
                checked={finaleMusicEnabled}
                onChange={(event) => setSettings((previous) => ({
                  ...previous,
                  finaleMusicEnabled: event.target.checked,
                }))}
              />
              <span>
                <strong>WRAP song</strong>
                <small>Choose the exact part of a YouTube song that starts with the podium reveal.</small>
              </span>
            </label>

            <div className="question-finale-music-fields" aria-disabled={!finaleMusicEnabled}>
              <label>
                <span>YouTube URL</span>
                <input
                  className="input"
                  value={finaleMusicUrl}
                  disabled={!finaleMusicEnabled}
                  onChange={(event) => setSettings((previous) => ({
                    ...previous,
                    finaleMusicUrl: event.target.value,
                  }))}
                  onBlur={() => {
                    const detectedStart = getYouTubeStartSeconds(finaleMusicUrl);
                    if (detectedStart <= 0) return;
                    const currentDuration = Math.max(0.1, finaleMusicEndSeconds - finaleMusicStartSeconds);
                    setSettings((previous) => ({
                      ...previous,
                      finaleMusicStartSeconds: detectedStart,
                      finaleMusicEndSeconds: detectedStart + currentDuration,
                    }));
                  }}
                />
              </label>
              <label>
                <span>Start at</span>
                <span className="question-number-unit">
                  <input
                    className="input"
                    type="number"
                    min={0}
                    step={0.1}
                    value={finaleMusicStartSeconds}
                    disabled={!finaleMusicEnabled}
                    onChange={(event) => setSettings((previous) => ({
                      ...previous,
                      finaleMusicStartSeconds: Math.max(0, Number(event.target.value) || 0),
                    }))}
                  />
                  <small>sec</small>
                </span>
              </label>
              <label>
                <span>Finish at</span>
                <span className="question-number-unit">
                  <input
                    className="input"
                    type="number"
                    min={0.1}
                    step={0.1}
                    value={finaleMusicEndSeconds}
                    disabled={!finaleMusicEnabled}
                    onChange={(event) => setSettings((previous) => ({
                      ...previous,
                      finaleMusicEndSeconds: Math.max(0.1, Number(event.target.value) || 0.1),
                    }))}
                  />
                  <small>sec</small>
                </span>
              </label>
              <label>
                <span>Volume</span>
                <span className="question-number-unit">
                  <input
                    className="input"
                    type="number"
                    min={0}
                    max={100}
                    value={finaleMusicVolume}
                    disabled={!finaleMusicEnabled}
                    onChange={(event) => setSettings((previous) => ({
                      ...previous,
                      finaleMusicVolume: Math.min(100, Math.max(0, Number(event.target.value) || 0)),
                    }))}
                  />
                  <small>%</small>
                </span>
              </label>
            </div>

            <div className="question-finale-music-footer">
              <span>
                {finaleMusicRangeValid
                  ? `${Math.round((finaleMusicEndSeconds - finaleMusicStartSeconds) * 10) / 10}s clip · decimals supported`
                  : "Finish time must be later than start time"}
              </span>
              <button
                className="button ghost compact"
                type="button"
                disabled={!finaleMusicEnabled || !finaleMusicPreviewUrl}
                onClick={() => setShowFinaleMusicPreview((visible) => !visible)}
              >
                {showFinaleMusicPreview ? "Close preview" : "Preview source"}
              </button>
            </div>
            {finaleMusicEnabled && finaleMusicUrl && !finaleMusicPreviewUrl && (
              <small className="question-finale-music-error">
                {finaleMusicRangeValid
                  ? "Enter a supported YouTube URL."
                  : "Finish time must be later than start time."}
              </small>
            )}
            {showFinaleMusicPreview && finaleMusicPreviewUrl && (
              <YouTubeClipPreview
                key={`${finaleMusicUrl}-${finaleMusicStartSeconds}-${finaleMusicEndSeconds}`}
                url={finaleMusicUrl}
                startSeconds={finaleMusicStartSeconds}
                endSeconds={finaleMusicEndSeconds}
              />
            )}
          </div>
        </div>

        <div className={`question-host-messages-setting${hostMessagesExpanded ? " expanded" : " collapsed"}`}>
          <div className="question-host-messages-heading">
            <div>
              <strong>Host messages</strong>
              <small>
                {hostMessages.length} {hostMessages.length === 1 ? "message" : "messages"} scheduled · {playableBoardQuestionCount} playable board questions
              </small>
            </div>
            <div className="question-host-messages-actions">
              <button
                className="button ghost compact"
                type="button"
                aria-expanded={hostMessagesExpanded}
                aria-controls="question-host-message-list"
                onClick={() => setHostMessagesExpanded((expanded) => !expanded)}
              >
                {hostMessagesExpanded ? "Collapse messages" : "Expand messages"}
              </button>
              <button className="button secondary compact" type="button" onClick={addHostMessage}>
                + Add message
              </button>
            </div>
          </div>

          {hostMessagesExpanded && (
            <div id="question-host-message-list">
              {hostMessages.length === 0 ? (
                <div className="question-host-messages-empty">
                  No messages scheduled. Add one for reminders such as “Fellesskål”.
                </div>
              ) : (
                <div className="question-host-message-list">
                  {hostMessages.map((message, index) => (
                    <HostMessageEditor
                      key={message.id}
                      message={message}
                      index={index}
                      teams={teams}
                      playableQuestionCount={playableBoardQuestionCount}
                      onUpdate={(updates) => updateHostMessage(message.id, updates)}
                      onRemove={() => removeHostMessage(message.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      <section className="question-content-divider" aria-labelledby="question-content-title">
        <div className="question-content-divider-copy">
          <span className="question-studio-kicker">Board content</span>
          <h2 id="question-content-title">Categories &amp; questions</h2>
          <p>Organize the board, name each category, and write the clues players will choose.</p>
        </div>
        <div className="question-content-divider-mark" aria-hidden>
          <span>100</span>
          <span>200</span>
          <span>300</span>
        </div>
      </section>

      <div className="question-category-create">
        <div style={{ flex: 1 }}>
          <label className="label">Add a category</label>
          <input
            className="input"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleNewCategory();
            }}
            placeholder="e.g. Local Jokes"
          />
        </div>
        <button className="button secondary" onClick={handleNewCategory} style={{ cursor: "pointer" }}>
          Add category
        </button>
      </div>

      {categories.length > 0 && (
        <nav className="question-category-tabs" aria-label="Question categories">
          {categories.map((cat) => {
            const isActive = activeCategory === cat;
            const label = categoryNames[cat] ?? cat;
            const isDraggingCategory = draggingCategory === cat;
            const isCategoryDropTarget = categoryDragOver === cat && draggingCategory !== cat;
            const isFinalCategory = Boolean(settings.boardRevealRules?.categories?.[cat]);
            return (
              <div
                key={cat}
                className={`question-category-tab${isActive ? " active" : ""}${isDraggingCategory ? " dragging" : ""}${isCategoryDropTarget ? " drag-over" : ""}`}
                data-category-tab={cat}
                style={{ transform: isDraggingCategory ? `translate3d(${categoryDragOffset}px,0,0)` : undefined }}
              >
                <button
                  className="question-category-tab-select"
                  type="button"
                  onClick={() => setActiveCategory(cat)}
                >
                  {label || cat}
                </button>
                <button
                  className={`question-category-drag-handle${isFinalCategory ? " disabled" : ""}`}
                  type="button"
                  disabled={isFinalCategory}
                  aria-label={isFinalCategory ? `${label || cat} is fixed as the final category` : `Drag ${label || cat} to reorder categories`}
                  title={isFinalCategory ? "The final category stays on the right" : "Drag to reorder categories"}
                  onPointerDown={(event) => {
                    if (isFinalCategory || event.button !== 0) return;
                    event.preventDefault();
                    event.stopPropagation();
                    event.currentTarget.setPointerCapture(event.pointerId);
                    categoryDragOrigin.current = event.clientX;
                    setCategoryDragOffset(0);
                    setDraggingCategory(cat);
                    setCategoryDragOver(null);
                  }}
                  onPointerMove={(event) => {
                    if (categoryDragOrigin.current === null || draggingCategory !== cat) return;
                    setCategoryDragOffset(event.clientX - categoryDragOrigin.current);
                    const target = document.elementsFromPoint(event.clientX, event.clientY)
                      .map((element) => element.closest<HTMLElement>(".question-category-tab[data-category-tab]"))
                      .find((tab) => tab?.dataset.categoryTab !== cat && !settings.boardRevealRules?.categories?.[tab?.dataset.categoryTab ?? ""]);
                    setCategoryDragOver(target?.dataset.categoryTab ?? null);
                  }}
                  onPointerUp={(event) => {
                    if (categoryDragOrigin.current === null) return;
                    const target = document.elementsFromPoint(event.clientX, event.clientY)
                      .map((element) => element.closest<HTMLElement>(".question-category-tab[data-category-tab]"))
                      .find((tab) => tab?.dataset.categoryTab !== cat && !settings.boardRevealRules?.categories?.[tab?.dataset.categoryTab ?? ""]);
                    if (target?.dataset.categoryTab) moveCategoryTo(cat, target.dataset.categoryTab);
                    categoryDragOrigin.current = null;
                    setCategoryDragOver(null);
                    setDraggingCategory(null);
                    setCategoryDragOffset(0);
                  }}
                  onPointerCancel={() => {
                    categoryDragOrigin.current = null;
                    setCategoryDragOver(null);
                    setDraggingCategory(null);
                    setCategoryDragOffset(0);
                  }}
                >
                  <span aria-hidden>⠿</span>
                </button>
              </div>
            );
          })}
        </nav>
      )}

      <div className="question-category-list">
        {(activeCategory ? categories.filter((c) => c === activeCategory) : categories).map((category) => {
          const categoryQuestions = questions.filter((question) => question.category === category)
            .sort((first, second) => first.points - second.points);
          const categoryPoints = categoryQuestions.map((question) => question.points);
          return (
          <div
            key={category}
            className="question-category-panel"
          >
            <div className="question-category-heading">
              <div className="question-category-name">
                <input
                  aria-label={`Rename ${category}`}
                  value={categoryNames[category] ?? category}
                  onChange={(e) =>
                    setCategoryNames((prev) => ({
                      ...prev,
                      [category]: e.target.value,
                    }))
                  }
                  onBlur={() =>
                    renameCategory(category, categoryNames[category] ?? category)
                  }
                />
              </div>
              <div className="question-category-actions">
                <button type="button" onClick={() => addQuestion(category)} title="Add the next available 100-point level">
                  + Add question
                </button>
                <button type="button" onClick={() => setCategoryCollapsed(category, false)}>
                  Open all
                </button>
                <button type="button" onClick={() => setCategoryCollapsed(category, true)}>
                  Collapse all
                </button>
                <button
                  className="question-icon-button danger"
                  onClick={() => deleteCategory(category)}
                  aria-label={`Delete ${category}`}
                  title="Delete category"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="question-card-grid">
              {categoryQuestions.map(({ points }) => {
                const q = getQuestion(category, points);
                const isDragging = dragging?.category === category && dragging.points === points;
                const isDragOver = dragOver === points && dragging?.category === category;
                const canDrag = !isMobile;
                const questionIssues = q ? getQuestionIssues(q) : ["Question is missing"];
                const questionKey = `${category}-${points}`;
                const isExpanded = expandedQuestions.has(questionKey);
                const questionType = (q?.type ?? "standard") as QuestionType;
                const typeMeta = QUESTION_TYPE_META[questionType];
                const summary = questionType === "timeline"
                  ? `${q?.timelineEvents?.length ?? 0} timeline events`
                  : questionType === "lyrics"
                    ? `${q?.lyricsSegments?.filter((line) => line.trim()).length ?? 0} reveal lines`
                    : questionType === "joker"
                      ? `${q?.jokerCount ?? 5} circles · ${q?.jokerMin ?? 1}–${q?.jokerMax ?? 9}`
                      : questionType === "mcq"
                        ? `${q?.mcqOptions?.filter(Boolean).length ?? 0} answer options`
                        : questionType === "booby"
                          ? q?.prompt?.trim() || "Add the challenge instructions"
                        : q?.prompt?.trim() || q?.answer?.trim() || "Add the first detail";
                return (
                  <div
                    key={`${category}-${points}`}
                    className={`question-card${isExpanded ? " expanded" : ""}${questionIssues.length ? " incomplete" : " ready"}`}
                    data-question-category={category}
                    data-question-points={points}
                    tabIndex={-1}
                    onKeyDown={(event) => {
                      if (event.key !== "Escape" || !isExpanded || event.defaultPrevented) return;
                      if (event.target instanceof Element && event.target.closest('[role="dialog"], [aria-modal="true"]')) return;
                      event.preventDefault();
                      event.stopPropagation();
                      event.currentTarget.querySelector<HTMLButtonElement>(".question-card-toggle")?.focus({ preventScroll: true });
                      setExpandedQuestions((previous) => {
                        const next = new Set(previous);
                        next.delete(questionKey);
                        return next;
                      });
                    }}
                    onClick={(event) => {
                      const target = event.target;
                      if (isExpanded) {
                        const press = cardPresses.current.get(questionKey);
                        cardPresses.current.delete(questionKey);
                        const onToggleSurface = target instanceof Element && Boolean(target.closest(".question-card-identity"))
                          || (target === event.currentTarget && isCardEdgeTogglePoint(event.currentTarget, event.clientX, event.clientY));
                        if (!press?.blocked && onToggleSurface) {
                          setExpandedQuestions((previous) => {
                            const next = new Set(previous);
                            next.delete(questionKey);
                            return next;
                          });
                        }
                        return;
                      }
                      if (target instanceof Element && target.closest("button, .question-card-actions")) return;
                      event.currentTarget.focus({ preventScroll: true });
                      setExpandedQuestions((previous) => new Set(previous).add(questionKey));
                    }}
                    onPointerDownCapture={(event) => {
                      if (!isExpanded) return;
                      const target = event.target;
                      cardPresses.current.set(questionKey, {
                        x: event.clientX,
                        y: event.clientY,
                        blocked: target instanceof Element && Boolean(target.closest(".question-editor, .question-type-picker, .question-issues")),
                      });
                    }}
                    onPointerMove={(event) => {
                      if (!isExpanded) return;
                      const press = cardPresses.current.get(questionKey);
                      if (press && Math.hypot(event.clientX - press.x, event.clientY - press.y) > 5) press.blocked = true;
                      const target = event.target;
                      const overOuterSurface = (target === event.currentTarget && isCardEdgeTogglePoint(event.currentTarget, event.clientX, event.clientY))
                        || (target instanceof Element
                          && !target.closest(".question-card-actions")
                          && Boolean(target.closest(".question-card-topbar, .question-card-identity")));
                      event.currentTarget.dataset.surfaceHover = overOuterSurface ? "true" : "false";
                    }}
                    onPointerLeave={(event) => {
                      delete event.currentTarget.dataset.surfaceHover;
                    }}
                    onPointerCancel={() => cardPresses.current.delete(questionKey)}
                    style={{
                      "--question-accent": typeMeta.accent,
                      "--question-soft": typeMeta.soft,
                      outline: isDragOver ? `2px dashed ${typeMeta.accent}` : "none",
                      transform: isDragging ? `translate3d(${dragOffset.x}px, ${dragOffset.y}px, 0)` : undefined,
                      position: isDragging ? "relative" : undefined,
                      zIndex: isDragging ? 30 : undefined,
                      boxShadow: isDragging ? "0 24px 52px rgba(7, 20, 16, .36)" : undefined,
                    } as React.CSSProperties}
                  >
                    <div className="question-card-topbar">
                      <div className="question-card-actions">
                        {canDrag ? (
                          <div
                            className="question-drag-handle"
                            title="Drag the card to reorder"
                            aria-label={`Drag ${points} point question to reorder`}
                            style={{ touchAction: "none", cursor: dragging ? "grabbing" : "grab" }}
                            onPointerDown={(e) => {
                              if (e.button !== 0) return;
                              e.preventDefault();
                              e.currentTarget.setPointerCapture(e.pointerId);
                              dragOrigin.current = { x: e.clientX, y: e.clientY };
                              setDragOffset({ x: 0, y: 0 });
                              setDragging({ category, points });
                              setDragOver(null);
                            }}
                            onPointerMove={(e) => {
                              if (!dragOrigin.current || dragging?.category !== category || dragging.points !== points) return;
                              setDragOffset({ x: e.clientX - dragOrigin.current.x, y: e.clientY - dragOrigin.current.y });
                              const target = document.elementsFromPoint(e.clientX, e.clientY)
                                .map((element) => element.closest<HTMLElement>(".question-card[data-question-category]"))
                                .find((card) => card?.dataset.questionCategory === category && Number(card.dataset.questionPoints) !== points);
                              setDragOver(target ? Number(target.dataset.questionPoints) : null);
                            }}
                            onPointerUp={(e) => {
                              if (!dragOrigin.current) return;
                              const target = document.elementsFromPoint(e.clientX, e.clientY)
                                .map((element) => element.closest<HTMLElement>(".question-card[data-question-category]"))
                                .find((card) => card?.dataset.questionCategory === category && Number(card.dataset.questionPoints) !== points);
                              if (target) moveQuestionTo(category, points, Number(target.dataset.questionPoints));
                              dragOrigin.current = null;
                              setDragOver(null);
                              setDragging(null);
                              setDragOffset({ x: 0, y: 0 });
                            }}
                            onPointerCancel={() => {
                              dragOrigin.current = null;
                              setDragOver(null);
                              setDragging(null);
                              setDragOffset({ x: 0, y: 0 });
                            }}
                          >
                            <span aria-hidden>⠿</span>
                          </div>
                        ) : (
                          <div className="question-move-buttons">
                            <button
                              type="button"
                              onClick={() => bumpQuestion(category, points, -1)}
                              disabled={categoryPoints.indexOf(points) === 0}
                              aria-label="Move question up"
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              onClick={() => bumpQuestion(category, points, 1)}
                              disabled={categoryPoints.indexOf(points) === categoryPoints.length - 1}
                              aria-label="Move question down"
                            >
                              ↓
                            </button>
                          </div>
                        )}
                      </div>
                      <button
                        className="question-card-toggle"
                        type="button"
                        aria-expanded={isExpanded}
                        aria-label={`${isExpanded ? "Collapse" : "Open"} ${points} point ${typeMeta.label} question`}
                        onClick={() => setExpandedQuestions((previous) => {
                          const next = new Set(previous);
                          if (next.has(questionKey)) next.delete(questionKey);
                          else next.add(questionKey);
                          return next;
                        })}
                      >
                        <span className="question-card-toggle-meta">
                          <span className="question-points">{points}</span>
                          <span className="question-points-unit">points</span>
                          {!isExpanded && <span className="question-card-identity compact">
                            <span className="question-type-icon" aria-hidden>{typeMeta.icon}</span>
                            <strong>{typeMeta.label}</strong>
                          </span>}
                          {!isExpanded && <span className="question-card-summary" title={summary}>{summary}</span>}
                          <span className="question-card-status" title={questionIssues.join(" · ")}>
                            <span aria-hidden>{questionIssues.length ? "○" : "●"}</span>
                            {questionIssues.length ? `${questionIssues.length} left` : "Ready"}
                          </span>
                          {q?.answered && <span className="question-played-status">Played</span>}
                        </span>
                      </button>
                    </div>
                    <button
                      type="button"
                      className="question-card-remove"
                      onClick={() => q && removeQuestion(q)}
                      disabled={categoryQuestions.length <= 1 || (finalMode === "row" && points === finalRowPoints)}
                      aria-label={`Remove ${points}-point question from ${category}`}
                      title={categoryQuestions.length <= 1 ? "Use Delete category to remove the last question" : finalMode === "row" && points === finalRowPoints ? "Turn off final-row reveal before removing this slot" : `Remove ${points}-point question`}
                    >
                      ×
                    </button>
                    {isExpanded && <div className="question-card-identity">
                      <span className="question-type-icon" aria-hidden>{typeMeta.icon}</span>
                      <strong>{typeMeta.label}</strong>
                    </div>}
                    {isExpanded && (
                      <>
                        {q && points === categoryPoints[categoryPoints.length - 1] && <RevealRuleEditor
                          label="This question"
                          rule={settings.boardRevealRules?.questions?.[q.id]}
                          categories={categories}
                          ownCategory={category}
                          ownLabel="This category"
                          onChange={(rule) => setRevealRule("questions", q.id, rule)}
                        />}
                        <div className="question-type-picker" aria-label="Question type">
                          {QUESTION_TYPES.map((type) => {
                            const option = QUESTION_TYPE_META[type];
                            const selected = type === questionType;
                            return (
                              <button
                                key={type}
                                type="button"
                                className={selected ? "selected" : ""}
                                aria-pressed={selected}
                                onClick={() => switchQuestionType(category, points, type)}
                                style={{ "--type-color": option.accent } as React.CSSProperties}
                              >
                                <span aria-hidden>{option.icon}</span>
                                {option.label}
                              </button>
                            );
                          })}
                        </div>
                        {questionIssues.length > 0 && (
                          <div className="question-issues" role="status">
                            <strong>Finish this clue</strong>
                            <span>{questionIssues.join(" · ")}</span>
                          </div>
                        )}
                        <div className="question-editor">
                    {questionType === "imageReveal" && q && (
                      <ImageRevealFields question={q} boardValues={questions.map(question => question.points)}
                        onChange={patch => upsertQuestion(category, points, patch)}
                        onImage={file => handleImageChange(category, points, file)} />
                    )}
                    {questionType === "standard" && (
                      <StandardFields
                        category={category}
                        points={points}
                        q={q}
                        upsertQuestion={upsertQuestion}
                        handleImageChange={handleImageChange}
                        handleAnswerImageChange={handleAnswerImageChange}
                      />
                    )}
                    {questionType === "lyrics" && (
                      <LyricsFields
                        category={category}
                        points={points}
                        q={q}
                        upsertQuestion={upsertQuestion}
                        handleAnswerImageChange={handleAnswerImageChange}
                      />
                    )}
                    {questionType === "geoguesser" && (
                      <GeoguesserFields
                        category={category}
                        points={points}
                        q={q}
                        upsertQuestion={upsertQuestion}
                        boardValues={questions.map((question) => question.points)}
                      />
                    )}
                    {questionType === "joker" && (
                      <JokerFields
                        category={category}
                        points={points}
                        q={q}
                        upsertQuestion={upsertQuestion}
                      />
                    )}
                    {questionType === "timeline" && (
                      <TimelineFields
                        category={category}
                        points={points}
                        q={q}
                        upsertQuestion={upsertQuestion}
                      />
                    )}
                    {questionType === "mcq" && (
                      <McqFields
                        category={category}
                        points={points}
                        q={q}
                        upsertQuestion={upsertQuestion}
                        handleImageChange={handleImageChange}
                        handleAnswerImageChange={handleAnswerImageChange}
                      />
                    )}
                    {questionType === "audio" && (
                      <AudioFields
                        category={category}
                        points={points}
                        q={q}
                        upsertQuestion={upsertQuestion}
                        boardValues={questions.map((question) => question.points)}
                      />
                    )}
                    {questionType === "booby" && (
                      <BoobyFields
                        category={category}
                        points={points}
                        q={q}
                        upsertQuestion={upsertQuestion}
                        handleImageChange={handleImageChange}
                      />
                    )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          );
        })}
        {categories.length === 0 && (
          <div className="card" style={{ padding: "16px", color: "var(--muted)" }}>
            Add a category to start entering questions.
          </div>
        )}
      </div>
      <section className="backup-drawer question-backup-drawer" aria-label="Quiz backup and local data">
        <StorageBackupPanel />
      </section>
    </main>
  );
}
