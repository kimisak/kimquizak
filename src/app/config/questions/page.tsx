'use client';

import React, { useEffect, useMemo, useState } from "react";
import { usePersistentState } from "@/hooks/usePersistentState";
import { QUESTION_STORAGE_KEY } from "@/lib/storage";
import { POINT_VALUES, type PointValue, type Question } from "@/lib/types";
import { makeId } from "@/lib/defaultData";

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
        Two or four options. The team that picked the question must answer; a wrong answer ends the question and costs the points.
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
  const [isClient, setIsClient] = useState(false);
  const [questions, setQuestions] = usePersistentState<Question[]>(
    QUESTION_STORAGE_KEY,
    [],
  );
  const [newCategory, setNewCategory] = useState("");
  const [categoryNames, setCategoryNames] = useState<Record<string, string>>({});
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [dragging, setDragging] = useState<{ category: string; points: PointValue } | null>(null);
  const [dragOver, setDragOver] = useState<PointValue | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient) return;
    setQuestions((prev) => (Array.isArray(prev) ? prev : []));
  }, [isClient, setQuestions]);

  const categories = useMemo(() => {
    const list = isClient ? questions : [];
    return Array.from(new Set(list.map((q) => q.category)));
  }, [questions, isClient]);

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

  const resetAnsweredFlags = () => {
    setQuestions((prev) => prev.map((q) => ({ ...q, answered: false })));
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
  const [stopSeconds, setStopSeconds] = useState<number>(q?.audioStopSeconds ?? 10);

  React.useEffect(() => {
    setPrompt(q?.prompt ?? "");
    setAnswer(q?.answer ?? "");
    setAudioUrl(q?.audioUrl ?? "");
    setStopSeconds(q?.audioStopSeconds ?? 10);
  }, [q?.prompt, q?.answer, q?.audioUrl, q?.audioStopSeconds]);

  const persistSeconds = () => {
    const safe = Number.isFinite(stopSeconds) ? Math.max(1, Math.round(stopSeconds)) : 10;
    setStopSeconds(safe);
    upsertQuestion(category, points, { audioStopSeconds: safe });
  };

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
        onBlur={() =>
          upsertQuestion(category, points, {
            audioUrl: audioUrl.trim() || null,
          })
        }
        placeholder="https://youtube.com/watch?v=..."
      />
      <label className="label" style={{ marginTop: "8px" }}>
        Auto-stop after (seconds)
      </label>
      <input
        className="input"
        type="number"
        min={1}
        value={stopSeconds}
        onChange={(e) => setStopSeconds(Number(e.target.value))}
        onBlur={persistSeconds}
        style={{ maxWidth: "160px" }}
      />
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
        The audio clip plays once, then locks. The hidden iframe uses the YouTube link above.
      </div>
    </>
  );
});

const LyricsFields = React.memo(function LyricsFields(props: FieldProps) {
  const { category, points, q, upsertQuestion } = props;
  const [prompt, setPrompt] = useState(q?.prompt ?? "");
  const [lyrics, setLyrics] = useState((q?.lyricsSegments ?? []).join("\n"));
  const [answer, setAnswer] = useState(q?.answer ?? "");
  const [answerVideoUrl, setAnswerVideoUrl] = useState(q?.answerVideoUrl ?? "");
  const [autoplay, setAutoplay] = useState(q?.answerVideoAutoplay ?? true);

  React.useEffect(() => {
    setPrompt(q?.prompt ?? "");
    setLyrics((q?.lyricsSegments ?? []).join("\n"));
    setAnswer(q?.answer ?? "");
    setAnswerVideoUrl(q?.answerVideoUrl ?? "");
    setAutoplay(q?.answerVideoAutoplay ?? true);
  }, [q?.prompt, q?.lyricsSegments, q?.answer, q?.answerVideoUrl, q?.answerVideoAutoplay]);

  return (
    <>
      <label className="label">Intro / hint (optional)</label>
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
        placeholder="Optional intro or clue"
      />
      <label className="label" style={{ marginTop: "8px" }}>
        Answer video URL (YouTube embed link, not share)
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
        Lyrics lines (one per line)
      </label>
      <textarea
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
        }}
        placeholder="Add each lyric line on its own line"
      />
      <div style={{ marginTop: "6px", color: "var(--muted)", fontSize: "0.9rem" }}>
        {q?.lyricsSegments?.length ?? 0} line(s). Players click squares to reveal each line.
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

  React.useEffect(() => {
    setPrompt(q?.prompt ?? "");
    setMapUrl(q?.mapEmbedUrl ?? "");
    setAnswer(q?.answer ?? "");
    setAnswerLink(q?.answerLocationUrl ?? "");
    setTimerSeconds(q?.geoTimerSeconds ?? 10);
    setUnlockCost(q?.geoUnlockCost ?? 0);
  }, [q?.prompt, q?.mapEmbedUrl, q?.answer, q?.answerLocationUrl, q?.geoTimerSeconds, q?.geoUnlockCost]);

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
        <span>Google Maps Street View embed URL</span>
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
        onBlur={() =>
          upsertQuestion(category, points, {
            mapEmbedUrl: mapUrl || null,
          })
        }
        placeholder="Paste the embed URL from Google Maps > Share > Embed"
      />
      <label className="label" style={{ marginTop: "8px" }}>
        Move time (seconds)
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
        Unlock cost (points)
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
      <div style={{ color: "var(--muted)", fontSize: "0.9rem", marginTop: "4px" }}>
        Tip: In Google Maps, pick a spot, go to Street View, click Share → Embed a map → Copy HTML, then paste the src URL here.
      </div>
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
        Configure how many circles to play, the number range, and the score per correct guess.
        A hidden 🎩 Joker awards the max score possible for this round.
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
        Enter timeline events as one per line: YEAR AC/BC, Event prompt, Timeline text. BC years
        stored as negative; AC/AD is implied if omitted. The center year anchors the starting point.
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
    <main className="card" style={{ padding: "24px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "16px",
          gap: "12px",
        }}
      >
        <div>
          <h1 style={{ margin: 0 }}>Categories & Clues</h1>
          <p style={{ color: "var(--muted)", marginTop: "6px" }}>
            Add categories (columns) and fill in a question + answer for each
            point value.
          </p>
        </div>
        <button className="button ghost" onClick={resetAnsweredFlags} style={{ cursor: "pointer" }}>
          Reset answered flags
        </button>
      </div>

      <div
        className="card"
        style={{
          padding: "16px",
          marginBottom: "16px",
          display: "flex",
          gap: "10px",
          alignItems: "flex-end",
        }}
      >
        <div style={{ flex: 1 }}>
          <label className="label">New category</label>
          <input
            className="input"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            placeholder="e.g. Local Jokes"
          />
        </div>
        <button className="button secondary" onClick={handleNewCategory} style={{ cursor: "pointer" }}>
          + Add
        </button>
      </div>

      {categories.length > 0 && (
        <div
          className="card"
          style={{
            padding: "10px",
            marginBottom: "16px",
            display: "flex",
            gap: "8px",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          {categories.map((cat) => {
            const isActive = activeCategory === cat;
            const label = categoryNames[cat] ?? cat;
            return (
              <button
                key={cat}
                className="button ghost"
                onClick={() => setActiveCategory(cat)}
                style={{
                  padding: "8px 12px",
                  borderColor: isActive ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.16)",
                  background: isActive
                    ? "linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.04))"
                    : "rgba(255,255,255,0.04)",
                  fontWeight: isActive ? 700 : 600,
                  whiteSpace: "nowrap",
                  cursor: "pointer",
                }}
              >
                {label || cat}
              </button>
            );
          })}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {(activeCategory ? categories.filter((c) => c === activeCategory) : categories).map((category) => (
          <div
            key={category}
            className="card"
            style={{ padding: "16px", borderColor: "rgba(255,255,255,0.16)" }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "12px",
                gap: "10px",
                flexWrap: "wrap",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", flex: "1 1 360px" }}>
                <input
                  className="input"
                  style={{ width: "100%", minWidth: "260px", maxWidth: "1000px", whiteSpace: "nowrap" }}
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
              <button
                className="button ghost compact"
                onClick={() => deleteCategory(category)}
                style={{ cursor: "pointer", paddingInline: "10px" }}
                aria-label={`Delete ${category}`}
              >
                ✕
              </button>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                gap: "12px",
              }}
            >
              {POINT_VALUES.map((points) => {
                const q = getQuestion(category, points);
                const isDragging = dragging?.category === category && dragging.points === points;
                const isDragOver = dragOver === points && dragging?.category === category;
                const canDrag = !isMobile;
                return (
                  <div
                    key={`${category}-${points}`}
                    className="card"
                    style={{
                      padding: "12px",
                      borderColor: "rgba(255,255,255,0.08)",
                      outline: isDragOver ? "2px dashed rgba(255,255,255,0.5)" : "none",
                      opacity: isDragging ? 0.6 : 1,
                      transition: "outline 0.15s ease, opacity 0.15s ease",
                      cursor: "default",
                    }}
                  >
                    {canDrag ? (
                      <div
                        style={{
                          height: "28px",
                          margin: "-12px -12px 10px",
                          borderRadius: "10px 10px 6px 6px",
                          background: isDragging
                            ? "linear-gradient(90deg, rgba(255,255,255,0.3), rgba(255,255,255,0.12))"
                            : "linear-gradient(90deg, rgba(255,255,255,0.12), rgba(255,255,255,0.05))",
                          border: "1px solid rgba(255,255,255,0.14)",
                          boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
                          position: "relative",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "var(--muted)",
                          fontWeight: 700,
                          letterSpacing: "0.04em",
                          cursor: "grab",
                        }}
                        title="Drag to reorder this question within the category"
                        draggable
                        onDragStart={(e) => {
                          setDragging({ category, points });
                          setDragOver(points);
                          e.dataTransfer?.setData("text/plain", `${category}-${points}`);
                        }}
                        onDragEnter={(e) => {
                          e.preventDefault();
                          if (dragging?.category === category) {
                            setDragOver(points);
                          }
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          if (dragging?.category === category) {
                            setDragOver(points);
                          }
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
                        ⇅ Drag to reorder
                      </div>
                    ) : (
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "flex-end",
                          gap: "6px",
                          padding: "6px",
                          margin: "-12px -12px 10px",
                        }}
                      >
                        <button
                          className="button ghost compact"
                          onClick={() => bumpQuestion(category, points, -1)}
                          disabled={POINT_VALUES.indexOf(points) === 0}
                          style={{ width: "100%" }}
                        >
                          ↑ Move up
                        </button>
                        <button
                          className="button ghost compact"
                          onClick={() => bumpQuestion(category, points, 1)}
                          disabled={POINT_VALUES.indexOf(points) === POINT_VALUES.length - 1}
                          style={{ width: "100%" }}
                        >
                          ↓ Move down
                        </button>
                      </div>
                    )}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "12px",
                        marginBottom: "8px",
                        flexWrap: "wrap",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                        <div style={{ fontWeight: 700 }}>{points} pts</div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", justifyContent: "flex-end", flexWrap: "wrap" }}>
                        {q?.answered && (
                          <span style={{ color: "#f2c14f", fontSize: "0.9rem" }}>
                            marked answered
                          </span>
                        )}
                        <div style={{ position: "relative", minWidth: "180px" }}>
                          <select
                            value={q?.type ?? "standard"}
                            onChange={(e) =>
                              upsertQuestion(category, points, {
                                type: e.target.value as Question["type"],
                              })
                            }
                          className="input"
                          style={{
                            width: "100%",
                            padding: "0.45rem 2rem 0.45rem 0.6rem",
                            cursor: "pointer",
                          }}
                        >
                            <option value="standard">Standard</option>
                            <option value="lyrics">Text grid</option>
                            <option value="geoguesser">Geoguesser</option>
                            <option value="joker">Joker high/low</option>
                            <option value="timeline">Timeline</option>
                            <option value="mcq">Multiple choice</option>
                            <option value="audio">Audio</option>
                          </select>
                          <span
                            aria-hidden
                            style={{
                              position: "absolute",
                              right: "10px",
                              top: "50%",
                              transform: "translateY(-50%)",
                              pointerEvents: "none",
                              color: "var(--muted)",
                              fontSize: "0.9rem",
                            }}
                          >
                            ▼
                          </span>
                        </div>
                      </div>
                    </div>
                    {(q?.type ?? "standard") === "standard" && (
                      <StandardFields
                        category={category}
                        points={points}
                        q={q}
                        upsertQuestion={upsertQuestion}
                        handleImageChange={handleImageChange}
                        handleAnswerImageChange={handleAnswerImageChange}
                      />
                    )}
                    {(q?.type ?? "standard") === "lyrics" && (
                      <LyricsFields
                        category={category}
                        points={points}
                        q={q}
                        upsertQuestion={upsertQuestion}
                        handleAnswerImageChange={handleAnswerImageChange}
                      />
                    )}
                    {(q?.type ?? "standard") === "geoguesser" && (
                      <GeoguesserFields
                        category={category}
                        points={points}
                        q={q}
                        upsertQuestion={upsertQuestion}
                        handleAnswerImageChange={handleAnswerImageChange}
                      />
                    )}
                    {(q?.type ?? "standard") === "joker" && (
                      <JokerFields
                        category={category}
                        points={points}
                        q={q}
                        upsertQuestion={upsertQuestion}
                      />
                    )}
                    {(q?.type ?? "standard") === "timeline" && (
                      <TimelineFields
                        category={category}
                        points={points}
                        q={q}
                        upsertQuestion={upsertQuestion}
                      />
                    )}
                    {(q?.type ?? "standard") === "mcq" && (
                      <McqFields
                        category={category}
                        points={points}
                        q={q}
                        upsertQuestion={upsertQuestion}
                        handleImageChange={handleImageChange}
                        handleAnswerImageChange={handleAnswerImageChange}
                      />
                    )}
                    {(q?.type ?? "standard") === "audio" && (
                      <AudioFields
                        category={category}
                        points={points}
                        q={q}
                        upsertQuestion={upsertQuestion}
                      />
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
