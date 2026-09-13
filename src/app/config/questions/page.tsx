'use client';

import React, { useEffect, useMemo, useState } from "react";
import { YouTubeClipPreview } from "@/components/config/YouTubeClipPreview";
import { usePersistentState } from "@/hooks/usePersistentState";
import { useSettings } from "@/hooks/useSettings";
import { useTurnState } from "@/hooks/useTurnState";
import {
  LEGACY_QUESTION_STORAGE_KEY,
  LEGACY_TEAM_STORAGE_KEY,
  QUESTION_STORAGE_KEY,
  SCORE_HISTORY_STORAGE_KEY,
  TEAM_STORAGE_KEY,
} from "@/lib/storage";
import {
  POINT_VALUES,
  type PointValue,
  type Question,
  type ScoreTransaction,
  type Team,
} from "@/lib/types";
import { makeId } from "@/lib/defaultData";
import { DEFAULT_SETTINGS, type HostMessage, type HostMessageRevealStyle } from "@/lib/settings";
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
import { extractEmbedUrl, isSafeHttpUrl } from "@/lib/embed";
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
  mcq: { label: "Multiple choice", icon: "A", accent: "#a78bfa", soft: "rgba(167,139,250,0.14)" },
  audio: { label: "Guess the audio", icon: "♪", accent: "#f472b6", soft: "rgba(244,114,182,0.14)" },
  lyrics: { label: "Text grid", icon: "▦", accent: "#2dd4bf", soft: "rgba(45,212,191,0.14)" },
  geoguesser: { label: "Geoguesser", icon: "⌖", accent: "#f59e0b", soft: "rgba(245,158,11,0.14)" },
  joker: { label: "Joker high/low", icon: "♠", accent: "#fb7185", soft: "rgba(251,113,133,0.14)" },
  timeline: { label: "Timeline", icon: "↔", accent: "#34d399", soft: "rgba(52,211,153,0.14)" },
};

const QUESTION_TYPES = Object.keys(QUESTION_TYPE_META) as QuestionType[];

const McqFields = React.memo(function McqFields({
  category,
  points,
  q,
  upsertQuestion,
  handleImageChange,
  handleAnswerImageChange,
}: FieldProps) {
  const [optionCount, setOptionCount] = useState<number>(
    Math.max(2, Math.min(4, q?.mcqOptions?.length || 2)),
  );
  const [options, setOptions] = useState<string[]>(() => {
    const base = q?.mcqOptions && q.mcqOptions.length ? q.mcqOptions : ["", ""];
    return base.slice(0, 4).concat(new Array(Math.max(0, 4 - base.length)).fill(""));
  });
  const [correctIndex, setCorrectIndex] = useState<number>(q?.mcqCorrectIndex ?? 0);

  useEffect(() => {
    const id = setTimeout(() => {
      const base = q?.mcqOptions && q.mcqOptions.length ? q.mcqOptions : ["", ""];
      const normalized = base.slice(0, 4).concat(new Array(Math.max(0, 4 - base.length)).fill(""));
      setOptions(normalized);
      setOptionCount(Math.max(2, Math.min(4, q?.mcqOptions?.length || 2)));
      setCorrectIndex(q?.mcqCorrectIndex ?? 0);
    }, 0);
    return () => clearTimeout(id);
  }, [q?.mcqOptions, q?.mcqCorrectIndex]);

  const persist = (
    opts: string[],
    correct: number,
    countOverride?: number,
  ) => {
    const count = countOverride ?? optionCount;
    const trimmed = opts.slice(0, count).map((o) => o.trim());
    const boundedCorrect = Math.min(trimmed.length - 1, Math.max(0, correct));
    upsertQuestion(category, points, {
      mcqOptions: trimmed,
      mcqCorrectIndex: boundedCorrect,
      mcqRotateOnMiss: false,
    });
  };

  return (
    <>
      <label className="label" style={{ marginTop: "8px" }}>
        Number of options
      </label>
      <select
        className="input"
        value={optionCount}
        onChange={(e) => {
          const next = Number(e.target.value);
          setOptionCount(next);
          const trimmed = options.slice(0, next);
          const padded = trimmed.concat(new Array(Math.max(0, 4 - trimmed.length)).fill(""));
          setOptions(padded);
          const boundedCorrect = Math.min(next - 1, Math.max(0, correctIndex));
          setCorrectIndex(boundedCorrect);
          persist(padded, boundedCorrect, next);
        }}
        style={{ maxWidth: "140px", cursor: "pointer" }}
      >
        <option value={2}>2 options</option>
        <option value={4}>4 options</option>
      </select>
      <label className="label" style={{ marginTop: "8px" }}>
        Prompt
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
        {options.slice(0, optionCount).map((opt, idx) => (
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
      <div style={{ color: "var(--muted)", fontSize: "0.9rem", marginTop: "6px" }}>
        A wrong choice is removed and play passes to the next team without deducting points.
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
export default function QuestionConfigPage() {
  const [settings, setSettings] = useSettings();
  const [questions, setQuestions, questionsHydrated] = usePersistentState<Question[]>(
    QUESTION_STORAGE_KEY,
    [],
    [LEGACY_QUESTION_STORAGE_KEY],
  );
  const [newCategory, setNewCategory] = useState("");
  const [categoryNames, setCategoryNames] = useState<Record<string, string>>({});
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [dragging, setDragging] = useState<{ category: string; points: PointValue } | null>(null);
  const [dragOver, setDragOver] = useState<PointValue | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [showFinaleMusicPreview, setShowFinaleMusicPreview] = useState(false);
  const [hostMessagesExpanded, setHostMessagesExpanded] = useState(false);
  const [expandedQuestions, setExpandedQuestions] = useState<Set<string>>(
    () => new Set(),
  );
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
          imageData: null,
          imageName: null,
          answerImageData: null,
          answerImageName: null,
          type: "standard",
          lyricsSegments: [],
          lyricsInfoText: null,
          mapEmbedUrl: null,
          answerLocationLabel: null,
          answerLocationUrl: null,
          answerVideoUrl: null,
          answerVideoAutoplay: true,
          geoUnlockCost: 0,
          jokerCount: 5,
          jokerMin: 1,
          jokerMax: 9,
          jokerIncrement: 100,
          timelineCenterYear: 2000,
          timelineCenterLabel: "Center year",
          timelineTitle: "Timeline",
          timelineEvents: [],
          jokerRotateOnMiss: true,
          timelineRotateOnMiss: true,
          mcqOptions: [],
          mcqCorrectIndex: 0,
          audioUrl: null,
          audioStopSeconds: null,
          audioStartSeconds: null,
          ...updates,
        },
      ];
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
    const idx = POINT_VALUES.indexOf(points);
    const target = POINT_VALUES[idx + direction];
    if (idx === -1 || target === undefined) return;
    moveQuestionTo(category, points, target);
  };

  const moveCategory = (category: string, direction: -1 | 1) => {
    setQuestions((previous) => {
      const order = Array.from(new Set(previous.map((question) => question.category)));
      const fromIndex = order.indexOf(category);
      const toIndex = fromIndex + direction;
      if (fromIndex < 0 || toIndex < 0 || toIndex >= order.length) return previous;

      [order[fromIndex], order[toIndex]] = [order[toIndex], order[fromIndex]];
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
      POINT_VALUES.forEach((points) => {
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
      const additions = POINT_VALUES.map<Question>((points) => ({
        id: makeId("q"),
        category: name,
        points,
        prompt: "",
        answer: "",
        answered: false,
        imageData: null,
        imageName: null,
        answerImageData: null,
        answerImageName: null,
        type: "standard",
        lyricsSegments: [],
        lyricsInfoText: null,
        mapEmbedUrl: null,
        answerLocationLabel: null,
          answerLocationUrl: null,
          answerVideoUrl: null,
          answerVideoAutoplay: true,
          geoUnlockCost: 0,
          jokerCount: 5,
          jokerMin: 1,
          jokerMax: 9,
          jokerIncrement: 100,
          timelineCenterYear: 2000,
          timelineCenterLabel: "Center year",
          timelineTitle: "Timeline",
          timelineEvents: [],
          jokerRotateOnMiss: true,
          timelineRotateOnMiss: true,
          mcqOptions: [],
          mcqCorrectIndex: 0,
          audioUrl: null,
          audioStopSeconds: null,
          audioStartSeconds: null,
      }));
      return [...prev, ...additions];
    });
    setNewCategory("");
    setActiveCategory(name);
  };

  const deleteCategory = (category: string) => {
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
      "Reset all scores, played tiles, turn order, revealed categories, dismissed host messages, and score history? Team and question content will be kept.",
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
}: FieldProps) {
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
        YouTube timestamps are detected automatically. The clip plays once.
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
  handleAnswerImageChange = () => {},
}: FieldProps) {
  const [prompt, setPrompt] = useState(q?.prompt ?? "");
  const [mapUrl, setMapUrl] = useState(q?.mapEmbedUrl ?? "");
  const [answer, setAnswer] = useState(q?.answer ?? "");
  const [answerLink, setAnswerLink] = useState(q?.answerLocationUrl ?? "");
  const [timerSeconds, setTimerSeconds] = useState<number>(q?.geoTimerSeconds ?? 10);
  const [unlockCost, setUnlockCost] = useState<number>(q?.geoUnlockCost ?? 0);
  const [showMapPreview, setShowMapPreview] = useState(false);

  React.useEffect(() => {
    setPrompt(q?.prompt ?? "");
    setMapUrl(q?.mapEmbedUrl ?? "");
    setAnswer(q?.answer ?? "");
    setAnswerLink(q?.answerLocationUrl ?? "");
    setTimerSeconds(q?.geoTimerSeconds ?? 10);
    setUnlockCost(q?.geoUnlockCost ?? 0);
  }, [q?.prompt, q?.mapEmbedUrl, q?.answer, q?.answerLocationUrl, q?.geoTimerSeconds, q?.geoUnlockCost]);

  const normalizedMapUrl = extractEmbedUrl(mapUrl);
  const validMapUrl = isSafeHttpUrl(normalizedMapUrl);

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
      <label className="label" style={{ marginTop: "8px", display: "flex", alignItems: "center", gap: "8px" }}>
        <span>Street View embed</span>
        <span
          title="Find a place in Street View that does not show the street address on the road - this may be difficult."
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: "18px",
            height: "18px",
            borderRadius: "50%",
            border: "1px solid rgba(255,255,255,0.3)",
            fontSize: "12px",
            cursor: "help",
            color: "var(--muted)",
            background: "rgba(255,255,255,0.05)",
          }}
        >
          i
        </span>
      </label>
      <input
        className="input"
        value={mapUrl}
        onChange={(e) => setMapUrl(e.target.value)}
        onBlur={() => {
          const normalized = extractEmbedUrl(mapUrl);
          setMapUrl(normalized);
          upsertQuestion(category, points, {
            mapEmbedUrl: normalized || null,
          });
        }}
        placeholder="Paste the URL or the complete <iframe> from Google Maps"
      />
      {mapUrl && !validMapUrl && (
        <div style={{ color: "#fca5a5", fontSize: "0.9rem", marginTop: "6px" }}>
          Paste an embed URL or the complete iframe code copied from Google Maps.
        </div>
      )}
      {validMapUrl && (
        <div style={{ marginTop: "8px" }}>
          <button className="button ghost compact" type="button" onClick={() => setShowMapPreview((value) => !value)}>
            {showMapPreview ? "Hide player preview" : "Preview what players see"}
          </button>
          {showMapPreview && (
            <div style={{ marginTop: "8px", height: "260px", borderRadius: "12px", overflow: "hidden", position: "relative", border: "1px solid rgba(255,255,255,0.12)" }}>
              <iframe
                title="Street View player preview"
                src={normalizedMapUrl}
                style={{ width: "100%", height: "560px", border: 0, marginTop: "-140px", pointerEvents: "none" }}
              />
            </div>
          )}
        </div>
      )}
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
      <label className="label" style={{ marginTop: "8px" }}>
        Exploration cost (points)
      </label>
      <input
        className="input"
        type="number"
        min={0}
        step={10}
        value={unlockCost}
        onChange={(e) => setUnlockCost(Number(e.target.value))}
        onBlur={() =>
          upsertQuestion(category, points, {
            geoUnlockCost: Number.isFinite(unlockCost) ? unlockCost : 0,
          })
        }
        placeholder="e.g. 50"
      />
      <details className="question-help">
        <summary>How movement works</summary>
        <p>
          The panorama starts locked. Moving is an active choice that costs {unlockCost || 0} potential points and lasts {timerSeconds || 10} seconds. The crop hides Google&apos;s address header.
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
  const [rotateOnMiss, setRotateOnMiss] = useState<boolean>(q?.jokerRotateOnMiss ?? true);

  React.useEffect(() => {
    setCount(q?.jokerCount ?? 5);
    setMinVal(q?.jokerMin ?? 1);
    setMaxVal(q?.jokerMax ?? 9);
    setRotateOnMiss(q?.jokerRotateOnMiss ?? true);
  }, [q?.jokerCount, q?.jokerMin, q?.jokerMax, q?.jokerRotateOnMiss]);

  const persist = (next: Partial<Question>) =>
    upsertQuestion(category, points, {
      ...next,
    });

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
          marginBottom: "8px",
          fontSize: "0.95rem",
          lineHeight: 1.4,
        }}
      >
        Set the circles and number range. The hidden 🎩 Joker awards the maximum score.
      </div>
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
        Points per correct guess are auto-calculated from the question score and circle count.
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

          <div className="question-finale-music-setting">
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
            return (
              <button
                key={cat}
                className={`question-category-tab${isActive ? " active" : ""}`}
                onClick={() => setActiveCategory(cat)}
              >
                {label || cat}
              </button>
            );
          })}
        </nav>
      )}

      <div className="question-category-list">
        {(activeCategory ? categories.filter((c) => c === activeCategory) : categories).map((category) => (
          <div
            key={category}
            className="question-category-panel"
          >
            <div className="question-category-heading">
              <div className="question-category-name">
                <span aria-hidden>▦</span>
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
                <button
                  type="button"
                  onClick={() => moveCategory(category, -1)}
                  disabled={categories.indexOf(category) === 0}
                  aria-label={`Move ${category} left`}
                  title="Move category left on the board"
                >
                  ← Move
                </button>
                <button
                  type="button"
                  onClick={() => moveCategory(category, 1)}
                  disabled={categories.indexOf(category) === categories.length - 1}
                  aria-label={`Move ${category} right`}
                  title="Move category right on the board"
                >
                  Move →
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
              {POINT_VALUES.map((points) => {
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
                        : q?.prompt?.trim() || q?.answer?.trim() || "Add the first detail";
                return (
                  <div
                    key={`${category}-${points}`}
                    className={`question-card${isExpanded ? " expanded" : ""}${questionIssues.length ? " incomplete" : " ready"}`}
                    style={{
                      "--question-accent": typeMeta.accent,
                      "--question-soft": typeMeta.soft,
                      outline: isDragOver ? `2px dashed ${typeMeta.accent}` : "none",
                      opacity: isDragging ? 0.6 : 1,
                    } as React.CSSProperties}
                  >
                    <div className="question-card-topbar">
                      <span className="question-points">{points}</span>
                      <span className="question-points-unit">points</span>
                      <span className="question-card-status" title={questionIssues.join(" · ")}>
                        <span aria-hidden>{questionIssues.length ? "○" : "●"}</span>
                        {questionIssues.length ? `${questionIssues.length} left` : "Ready"}
                      </span>
                      {q?.answered && <span className="question-played-status">Played</span>}
                      <div className="question-card-actions">
                        {canDrag ? (
                          <div
                            className="question-drag-handle"
                            title="Drag to reorder"
                            draggable
                            onDragStart={(e) => {
                              setDragging({ category, points });
                              setDragOver(points);
                              e.dataTransfer?.setData("text/plain", `${category}-${points}`);
                            }}
                            onDragEnter={(e) => {
                              e.preventDefault();
                              if (dragging?.category === category) setDragOver(points);
                            }}
                            onDragOver={(e) => {
                              e.preventDefault();
                              if (dragging?.category === category) setDragOver(points);
                            }}
                            onDrop={(e) => {
                              e.preventDefault();
                              if (dragging?.category === category) {
                                moveQuestionTo(category, dragging.points, points);
                              }
                              setDragOver(null);
                              setDragging(null);
                            }}
                            onDragEnd={() => {
                              setDragOver(null);
                              setDragging(null);
                            }}
                          >
                            <span aria-hidden>⠿</span>
                            Reorder
                          </div>
                        ) : (
                          <div className="question-move-buttons">
                            <button
                              type="button"
                              onClick={() => bumpQuestion(category, points, -1)}
                              disabled={POINT_VALUES.indexOf(points) === 0}
                              aria-label="Move question up"
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              onClick={() => bumpQuestion(category, points, 1)}
                              disabled={POINT_VALUES.indexOf(points) === POINT_VALUES.length - 1}
                              aria-label="Move question down"
                            >
                              ↓
                            </button>
                          </div>
                        )}
                        <button
                          className="question-edit-button"
                          type="button"
                          aria-expanded={isExpanded}
                          onClick={() =>
                            setExpandedQuestions((previous) => {
                              const next = new Set(previous);
                              if (isExpanded) next.delete(questionKey);
                              else next.add(questionKey);
                              return next;
                            })
                          }
                        >
                          {isExpanded ? "Collapse" : "Open"}
                        </button>
                      </div>
                    </div>
                    <div className="question-card-identity">
                      <span className="question-type-icon" aria-hidden>{typeMeta.icon}</span>
                      <strong>{typeMeta.label}</strong>
                    </div>
                    {!isExpanded && (
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedQuestions((previous) => {
                            const next = new Set(previous);
                            next.add(questionKey);
                            return next;
                          })
                        }
                        className="question-card-summary"
                      >
                        {summary}
                      </button>
                    )}
                    {isExpanded && (
                      <>
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
                                onClick={() => upsertQuestion(category, points, { type })}
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
                        handleAnswerImageChange={handleAnswerImageChange}
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
        ))}
        {categories.length === 0 && (
          <div className="card" style={{ padding: "16px", color: "var(--muted)" }}>
            Add a category to start entering questions.
          </div>
        )}
      </div>
    </main>
  );
}
