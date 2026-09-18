import type { Question } from "@/lib/types";
import { parseStreetViewSource } from "@/lib/geoguesser";
import { extractYouTubeId } from "@/lib/youtube";

function hasText(value: string | null | undefined): boolean {
  return Boolean(value?.trim());
}

export function getQuestionIssues(question: Question): string[] {
  const type = question.type ?? "standard";
  const issues: string[] = [];

  if (type === "joker") return issues;

  if (type === "booby") {
    if (!hasText(question.prompt)) issues.push("Add the challenge instructions");
    return issues;
  }

  if (type === "timeline") {
    const events = question.timelineEvents ?? [];
    if (events.length < 2) issues.push("Add at least two timeline events");
    if (events.some((event) => !hasText(event.text) || event.year == null)) {
      issues.push("Every event needs a year and prompt");
    }
    return issues;
  }

  if (type === "lyrics") {
    if (!(question.lyricsSegments ?? []).some(hasText)) issues.push("Add reveal lines");
    if (!hasText(question.answer)) issues.push("Add the answer");
    return issues;
  }

  if (type === "geoguesser") {
    if (!parseStreetViewSource(question.mapEmbedUrl)) {
      issues.push("Add a Google Street View link with coordinates");
    }
    if (!hasText(question.answer)) issues.push("Add the location answer");
    return issues;
  }

  if (type === "audio") {
    if (!hasText(question.prompt)) issues.push("Add a clue");
    if (!extractYouTubeId(question.audioUrl)) issues.push("Add a valid YouTube source");
    if (!hasText(question.answer)) issues.push("Add the answer");
    if ((question.audioStopSeconds ?? 10) < 1) issues.push("Set a clip length");
    return issues;
  }

  if (type === "mcq") {
    if (!hasText(question.prompt) && !question.imageData) issues.push("Add a question or image");
    const options = question.mcqOptions ?? [];
    if (options.length < 2 || options.some((option) => !hasText(option))) {
      issues.push("Complete every answer option");
    }
    const correct = question.mcqCorrectIndex ?? -1;
    if (correct < 0 || correct >= options.length) issues.push("Choose the correct option");
    return issues;
  }

  if (!hasText(question.prompt) && !question.imageData) issues.push("Add a question or image");
  if (!hasText(question.answer) && !question.answerImageData) issues.push("Add the answer");
  return issues;
}

export function isQuestionReady(question: Question | undefined): question is Question {
  return Boolean(question && getQuestionIssues(question).length === 0);
}
