import type { Question } from "@/lib/types";
import { parseStreetViewSource } from "@/lib/geoguesser";
import { extractYouTubeId } from "@/lib/youtube";
import { getImageRevealAreas, getImageAreaPlayableIndexes } from "@/lib/imageReveal";

function hasText(value: string | null | undefined): boolean {
  return Boolean(value?.trim());
}

export function getQuestionIssues(question: Question): string[] {
  const type = question.type ?? "standard";
  const issues: string[] = [];

  if (type === "joker") return issues;

  if (type === "trivia") {
    const items = question.triviaItems ?? [];
    if (items.length < 2) issues.push("Add at least two questions to the trivia round");
    if (items.some(item => !item.id || !hasText(item.prompt) || !hasText(item.answer))) issues.push("Every trivia question needs a question and answer");
    if (new Set(items.map(item => item.id)).size !== items.length) issues.push("Trivia questions must have unique IDs");
    return issues;
  }

  if (type === "imageReveal") {
    if (!question.imageData) issues.push("Add the image to reveal");
    if (!hasText(question.answer)) issues.push("Add the answer");
    if (question.imageRevealStyle === "areas") {
      const areas = getImageRevealAreas(question);
      if (areas.length < 2 || areas.some(tiles => !tiles.length)) issues.push("Paint at least two areas, with tiles in every numbered area");
      if (areas.some(tiles => tiles.length) && getImageAreaPlayableIndexes(question).length < areas.filter(tiles => tiles.length).length) issues.push("Each area must reveal a covered cell. Reduce opening clues or redraw the area");
      if (question.imageRevealAreaMode === "limited" && question.points < areas.length) issues.push("Use fewer areas or more points so every guess can have a lower positive reward");
    }
    return issues;
  }

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
    if (options.length !== 4 || options.some((option) => !hasText(option))) {
      issues.push("Complete all four answer options");
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
