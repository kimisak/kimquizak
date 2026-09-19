import type { Question } from "@/lib/types";
import { LEGACY_QUESTION_STORAGE_KEY, QUESTION_STORAGE_KEY } from "@/lib/storage";

const DATABASE_NAME = "kimquizak-content";
const STORE_NAME = "quiz";
const QUESTIONS_KEY = "questions";
let pendingWrite: Promise<void> = Promise.resolve();

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open question storage."));
  });
}

async function storedQuestions(): Promise<Question[] | undefined> {
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readonly");
      const request = transaction.objectStore(STORE_NAME).get(QUESTIONS_KEY);
      request.onsuccess = () => resolve(request.result as Question[] | undefined);
      request.onerror = () => reject(request.error);
    });
  } finally {
    database.close();
  }
}

function legacyQuestions(): Question[] | undefined {
  for (const key of [QUESTION_STORAGE_KEY, LEGACY_QUESTION_STORAGE_KEY]) {
    const raw = window.localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as Question[];
  }
  return undefined;
}

export async function readQuestions(): Promise<Question[]> {
  await pendingWrite.catch(() => undefined);
  const stored = await storedQuestions();
  if (stored !== undefined) return stored;
  const legacy = legacyQuestions();
  if (legacy !== undefined) {
    await writeQuestions(legacy);
    return legacy;
  }
  return [];
}

function persistQuestions(questions: Question[]): Promise<void> {
  return (async () => {
    const database = await openDatabase();
    try {
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction(STORE_NAME, "readwrite");
        transaction.objectStore(STORE_NAME).put(questions, QUESTIONS_KEY);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
      });
      // Only discard the old copy after IndexedDB confirms the complete write.
      window.localStorage.removeItem(QUESTION_STORAGE_KEY);
      window.localStorage.removeItem(LEGACY_QUESTION_STORAGE_KEY);
      if (typeof BroadcastChannel !== "undefined") {
        const channel = new BroadcastChannel("kimquizak-questions");
        channel.postMessage("updated");
        channel.close();
      }
    } finally {
      database.close();
    }
  })();
}

export function writeQuestions(questions: Question[]): Promise<void> {
  pendingWrite = pendingWrite.catch(() => undefined).then(() => persistQuestions(questions));
  return pendingWrite;
}

export async function clearQuestions(): Promise<void> {
  await pendingWrite.catch(() => undefined);
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).delete(QUESTIONS_KEY);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
    window.localStorage.removeItem(QUESTION_STORAGE_KEY);
    window.localStorage.removeItem(LEGACY_QUESTION_STORAGE_KEY);
  } finally {
    database.close();
  }
}
