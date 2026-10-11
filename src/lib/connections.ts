import type { ConnectionsGroup, ConnectionsProgress, Question } from "@/lib/types";

export const CONNECTIONS_GUESS_SECONDS = 120;
export const CONNECTIONS_MISTAKE_LIMIT = 4;
export const connectionsRequired = (question: Question) => question.connectionsRequired ?? 4;
export const connectionsGuessSeconds = (question: Question) => question.connectionsGuessSeconds ?? CONNECTIONS_GUESS_SECONDS;
export const connectionsMistakeLimit = (question: Question) => question.connectionsMistakeLimit ?? CONNECTIONS_MISTAKE_LIMIT;

// Split delimiters outside quoted text, preserving escaped double quotes.
function splitConnectionText(text: string, delimiter: string, firstOnly = false): string[] {
  const parts: string[] = [];
  let start = 0;
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '"') {
      if (quoted && text[i + 1] === '"') { i++; continue; }
      quoted = !quoted;
    } else if (!quoted && text[i] === delimiter) {
      parts.push(text.slice(start, i));
      start = i + 1;
      if (firstOnly) break;
    }
  }
  parts.push(text.slice(start));
  return parts;
}

function decodeConnectionText(raw: string): string | null {
  const text = raw.trim();
  if (!text.includes('"')) return text;
  if (!/^"(?:[^"\n]|"")*"$/.test(text)) return null;
  return text.slice(1, -1).replace(/""/g, '"').trim();
}

export function parseConnectionsText(text: string): { groups: ConnectionsGroup[]; issues: string[] } {
  const groups: ConnectionsGroup[] = [];
  const issues: string[] = [];
  text.split(/\r?\n/).forEach((line, index) => {
    if (!line.trim()) return;
    const parts = splitConnectionText(line, ":", true);
    if (parts.length !== 2) { issues.push(`Line ${index + 1}: use Connection: tile 1, tile 2, tile 3, tile 4`); return; }
    const label = decodeConnectionText(parts[0]);
    const words = splitConnectionText(parts[1], ",").map(decodeConnectionText);
    const isFiller = label !== null && /^(filler|filler words|blindspor)$/i.test(label);
    if (isFiller) { issues.push(`Line ${index + 1}: replace filler with named connections of four tiles`); return; }
    if (!label || words.length !== 4 || words.some(word => !word)) {
      issues.push(`Line ${index + 1}: add a connection name and exactly four non-empty tiles; close any quotation marks`);
      return;
    }
    groups.push({ label, words: words as string[] });
  });
  if (groups.length !== 4) issues.push("Add four connections, with four tiles in each");
  return { groups, issues };
}

export function formatConnectionsText(groups: ConnectionsGroup[], filler: string[] = []): string {
  const quote = (text: string) => /[:,"\r\n]/.test(text) ? `"${text.replace(/"/g, '\"\"')}"` : text;
  const lines = groups.map(group => `${quote(group.label)}: ${group.words.map(quote).join(", ")}`);
  if (filler.length) lines.push(`Filler: ${filler.map(quote).join(", ")}`);
  return lines.join("\n");
}

export function getConnectionsIssues(question: Question): string[] {
  const groups = question.connectionsGroups ?? [];
  const issues = question.connectionsText !== undefined ? parseConnectionsText(question.connectionsText).issues : [];
  if (groups.length !== 4 || groups.some(group => !group.label?.trim() || group.words?.length !== 4 || group.words.some(word => !word.trim()))) {
    issues.push("Add four connections, each with a name and four tiles");
  }
  if (question.connectionsFiller?.length) issues.push("Replace filler with named connections of four tiles");
  const required = connectionsRequired(question);
  if (!Number.isInteger(required) || required < 1 || required > 4) issues.push("Choose 1–4 connections needed to finish");
  const allWords = groups.flatMap(group => group.words ?? []);
  if (allWords.length !== 16 || allWords.some(word => !word.trim())) issues.push("Use exactly 16 non-empty tiles");
  const words = allWords.map(word => word.trim().normalize("NFC").toLocaleLowerCase());
  if (new Set(words).size !== words.length) issues.push("Every tile must be unique");
  const seconds = connectionsGuessSeconds(question);
  const mistakes = connectionsMistakeLimit(question);
  if (!Number.isInteger(seconds) || seconds < 0 || seconds > 3600) issues.push("Set guess time to 0–3600 seconds (0 means no timer)");
  if (!Number.isInteger(mistakes) || mistakes < 0 || mistakes > 100) issues.push("Set mistake limit to 0–100 (0 means unlimited)");
  return issues;
}

// Keep solved tiles in place and guarantee a changed order when at least two remain.
export function shuffleConnectionsOrder(order: number[], solved: number[] = [], random = Math.random): number[] {
  const original = order.filter(tile => !solved.includes(Math.floor(tile / 4)));
  const shuffled = [...original];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  if (shuffled.length > 1 && shuffled.every((tile, index) => tile === original[index])) shuffled.push(shuffled.shift()!);
  let next = 0;
  return order.map(tile => solved.includes(Math.floor(tile / 4)) ? tile : shuffled[next++]);
}

export function createConnectionsProgress(teamId: string, random = Math.random): ConnectionsProgress {
  const order = shuffleConnectionsOrder(Array.from({ length: 16 }, (_, index) => index), [], random);
  return { order, solved: [], mistakes: 0, attempts: [], pointsByTeam: {}, teamId, started: false, deadline: null, finished: false };
}

export type ConnectionsAction = { type: "start" | "timeout" | "end" | "shuffle" } | { type: "guess"; tiles: number[] };

export function advanceConnections(question: Question, previous: ConnectionsProgress, action: ConnectionsAction, teamOrder: string[], now: number, random = Math.random) {
  if (previous.finished || getConnectionsIssues(question).length || !teamOrder.includes(previous.teamId)) return null;
  const progress = { ...previous };
  const nextDeadline = () => connectionsGuessSeconds(question) > 0 ? now + connectionsGuessSeconds(question) * 1000 : null;
  let points = 0;
  let correct = false;
  if (action.type === "end") {
    progress.finished = true;
    progress.finishReason = "host";
  } else if (action.type === "start") {
    if (previous.started) return null;
    progress.order = shuffleConnectionsOrder(previous.order, previous.solved, random);
    progress.started = true;
    progress.deadline = nextDeadline();
  } else {
    if (!previous.started) return null;
    const expired = previous.deadline !== null && now >= previous.deadline;
    if (action.type === "timeout" && !expired) return null;
    if (action.type === "shuffle" && !expired) {
      progress.order = shuffleConnectionsOrder(previous.order, previous.solved, random);
      return { progress, points: 0, correct: false, awardedTeamId: previous.teamId };
    }
    if (!expired && action.type === "guess") {
      const tiles = [...new Set(action.tiles)].sort((a, b) => a - b);
      if (tiles.length !== 4 || tiles.some(tile => !Number.isInteger(tile) || tile < 0 || tile >= 16 || previous.solved.includes(Math.floor(tile / 4)))) return null;
      const key = tiles.join(",");
      if (previous.attempts.includes(key)) return null;
      progress.attempts = [...previous.attempts, key];
      const group = Math.floor(tiles[0] / 4);
      const groupCount = question.connectionsGroups!.length;
      const required = connectionsRequired(question);
      correct = group < groupCount && tiles.every(tile => Math.floor(tile / 4) === group);
      if (correct) {
        const total = Math.max(0, Math.round(question.points));
        points = Math.floor(total * (previous.solved.length + 1) / required) - Math.floor(total * previous.solved.length / required);
        progress.solved = [...previous.solved, group];
        progress.pointsByTeam = { ...previous.pointsByTeam, [previous.teamId]: (previous.pointsByTeam[previous.teamId] ?? 0) + points };
        progress.feedback = `Connection found! +${points} points. Keep playing.`;
        if (progress.solved.length >= required) { progress.finished = true; progress.finishReason = "solved"; }
      } else {
        const oneAway = tiles.some(tile => Math.floor(tile / 4) < groupCount && tiles.filter(other => Math.floor(other / 4) === Math.floor(tile / 4)).length === 3);
        progress.feedback = oneAway ? "Three are correct" : "Not a connection. That guess uses a mistake.";
      }
    } else {
      progress.feedback = "Time’s up! That uses a mistake.";
    }
    if (!correct) {
      progress.mistakes += 1;
      const limit = connectionsMistakeLimit(question);
      if (limit > 0 && progress.mistakes >= limit) { progress.finished = true; progress.finishReason = "mistakes"; }
      else if (question.connectionsRotateOnMiss !== false) {
        progress.teamId = teamOrder[(teamOrder.indexOf(previous.teamId) + 1) % teamOrder.length];
      }
    }
    progress.deadline = nextDeadline();
  }
  if (progress.finished) progress.deadline = null;
  return { progress, points, correct, awardedTeamId: previous.teamId };
}
