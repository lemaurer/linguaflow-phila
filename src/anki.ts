import { invoke } from "@tauri-apps/api/core";

export type AnkiCard = {
  cardId: number;
  ord?: number;
  fieldOrder?: number;
  question: string;
  answer: string;
  deckName: string;
  modelName: string;
  fields: Record<string, { value: string; order: number }>;
  css?: string;
  nextReviews?: string[];
  buttons?: number[];
  template?: string;
  note?: number;
  interval?: number;
  due?: number;
  type?: number;
  queue?: number;
  reps?: number;
  lapses?: number;
  mod?: number;
};

export type AnkiNote = {
  noteId: number;
  profile?: string;
  modelName: string;
  tags: string[];
  fields: Record<string, { value: string; order: number }>;
  mod?: number;
  cards?: number[];
};

export type DeckLearningStats = {
  total: number;
  learned: number;
  new: number;
  learning: number;
  young: number;
  mature: number;
  suspended: number;
};

export type AnkiDeckStats = {
  deck_id: number;
  name: string;
  new_count: number;
  learn_count: number;
  review_count: number;
  total_in_deck?: number;
};

export const ANKI_DECKS = {
  finnish: "Finnish",
  swiss: "Sprachen::Schweizerdeutsch",
  french: "Sprachen::Französisch",
  cantonese: "Sprachen::Cantonese",
} as const;

async function callAnki<T>(action: string, params: Record<string, unknown> = {}): Promise<T> {
  if ("__TAURI_INTERNALS__" in window) {
    return invoke<T>("anki_invoke", { action, params });
  }

  const response = await fetch("http://127.0.0.1:8765", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, version: 6, params }),
  });
  const payload = await response.json();
  if (payload.error) throw new Error(payload.error);
  return payload.result as T;
}

async function callSilentReviewAction<T>(action: string, fallbackAction: string, params: Record<string, unknown> = {}) {
  try {
    return await callAnki<T>(action, params);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/unsupported action/i.test(message)) throw error;
    const result = await callAnki<T>(fallbackAction, params);
    await stopAnkiNativeAudio();
    return result;
  }
}

function deckQuery(deckName: string, query = "") {
  return [`deck:\"${deckName}\"`, query.trim()].filter(Boolean).join(" ");
}

export async function getAnkiOverview() {
  const version = await callAnki<number>("version");
  const deckNames = await callAnki<string[]>("deckNames");
  return { version, deckNames };
}

export async function getReviewedToday() {
  return callAnki<number>("getNumCardsReviewedToday");
}

export async function getReviewHistory() {
  return callAnki<Array<[string, number]>>("getNumCardsReviewedByDay");
}

export async function findAllCardIds(deckName: string) {
  return callAnki<number[]>("findCards", { query: `deck:\"${deckName}\"` });
}

export async function findLearnedCardIds(deckName: string) {
  return callAnki<number[]>("findCards", { query: `deck:\"${deckName}\" -is:new` });
}

export async function getDeckDueCount(deckName: string) {
  const result = await callAnki<Record<string, AnkiDeckStats>>("getDeckStats", { decks: [deckName] });
  const stats = Object.values(result)[0];
  return stats ? stats.new_count + stats.learn_count + stats.review_count : 0;
}

export async function getDeckLearningStats(deckName: string): Promise<DeckLearningStats> {
  const searches = ["", "-is:new", "is:new", "is:learn", "-is:new prop:ivl<21", "prop:ivl>=21", "is:suspended"];
  const result = await callAnki<number[][]>("multi", {
    actions: searches.map((query) => ({ action: "findCards", params: { query: deckQuery(deckName, query) } })),
  });
  return {
    total: result[0]?.length ?? 0,
    learned: result[1]?.length ?? 0,
    new: result[2]?.length ?? 0,
    learning: result[3]?.length ?? 0,
    young: result[4]?.length ?? 0,
    mature: result[5]?.length ?? 0,
    suspended: result[6]?.length ?? 0,
  };
}

export async function searchAnkiCards(deckName: string, query = "", limit = 80) {
  const ids = await callAnki<number[]>("findCards", { query: deckQuery(deckName, query) });
  const cards = ids.length ? await callAnki<AnkiCard[]>("cardsInfo", { cards: ids.slice(0, limit) }) : [];
  return { items: cards, total: ids.length };
}

export async function searchAnkiNotes(deckName: string, query = "", limit = 80) {
  const ids = await callAnki<number[]>("findNotes", { query: deckQuery(deckName, query) });
  const notes = ids.length ? await callAnki<AnkiNote[]>("notesInfo", { notes: ids.slice(0, limit) }) : [];
  return { items: notes, total: ids.length };
}

export async function openAnkiBrowser(deckName: string, query = "") {
  return callAnki<number[]>("guiBrowse", { query: deckQuery(deckName, query) });
}

export async function editAnkiNote(noteId: number) {
  return callAnki<void>("guiEditNote", { note: noteId });
}

export async function syncAnkiWeb() {
  return callAnki<void>("sync");
}

export async function startAnkiReview(deckName: string) {
  const started = await callSilentReviewAction<boolean>("guiDeckReviewWithoutAudio", "guiDeckReview", { name: deckName });
  if (!started) throw new Error(`Der Stapel „${deckName}“ konnte nicht geöffnet werden.`);
  return currentAnkiCard({ settleMs: 35 });
}

type CurrentCardOptions = { previousCardId?: number; settleMs?: number };

const wait = (milliseconds: number) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));

async function hydrateGuiCard(guiCard: AnkiCard) {
  if (!guiCard?.cardId) throw new Error("Anki meldet gerade keine aktive Karte.");
  const info = (await callAnki<AnkiCard[]>("cardsInfo", { cards: [guiCard.cardId] }))[0];
  return info ? {
    ...guiCard,
    ...info,
    question: guiCard.question,
    answer: guiCard.answer,
    nextReviews: guiCard.nextReviews,
    buttons: guiCard.buttons,
    template: guiCard.template || info.template,
  } : guiCard;
}

export async function currentAnkiCard({ previousCardId, settleMs = 80 }: CurrentCardOptions = {}) {
  if (settleMs) await wait(settleMs);
  let lastCard: AnkiCard | null = null;
  let stableReads = 0;
  const startedAt = Date.now();
  for (let attempt = 0; attempt < 18; attempt += 1) {
    // guiCurrentCard is intentionally the only operation in the polling loop.
    // cardsInfo is comparatively expensive, so hydrate only after Anki's GUI
    // has exposed a stable next-card snapshot.
    const card = await callAnki<AnkiCard>("guiCurrentCard");
    const sameSnapshot = lastCard?.cardId === card.cardId
      && lastCard.question === card.question
      && JSON.stringify(lastCard.nextReviews ?? []) === JSON.stringify(card.nextReviews ?? []);
    stableReads = sameSnapshot ? stableReads + 1 : 0;
    lastCard = card;
    const movedToNextCard = previousCardId === undefined || card.cardId !== previousCardId;
    const repeatedSameCardHasSettled = previousCardId === card.cardId && Date.now() - startedAt >= 170;
    if (stableReads >= 1 && (movedToNextCard || repeatedSameCardHasSettled)) {
      const hydrated = await hydrateGuiCard(card);
      await callAnki<boolean>("guiStartCardTimer");
      return hydrated;
    }
    await wait(30);
  }
  if (!lastCard) throw new Error("Anki konnte die nächste Karte nicht bereitstellen.");
  const hydrated = await hydrateGuiCard(lastCard);
  await callAnki<boolean>("guiStartCardTimer");
  return hydrated;
}

export async function showAnkiAnswer() {
  return callSilentReviewAction<boolean>("guiShowAnswerWithoutAudio", "guiShowAnswer");
}

export async function rateAnkiCard(ease: number, previousCardId: number) {
  const answered = await callSilentReviewAction<boolean>("guiAnswerCardWithoutAudio", "guiAnswerCard", { ease });
  if (!answered) throw new Error("Anki hat diese Bewertung nicht angenommen.");
  try {
    return await currentAnkiCard({ previousCardId, settleMs: 25 });
  } catch {
    return null;
  }
}

export async function undoAnkiReview(currentCardId?: number) {
  const undone = await callAnki<boolean>("guiUndo");
  if (!undone) throw new Error("Anki konnte die letzte Bewertung nicht rückgängig machen.");
  return currentAnkiCard({ previousCardId: currentCardId, settleMs: 100 });
}

export async function isAnkiCardDueAgainToday(cardId: number) {
  return callAnki<boolean>("cardDueAgainToday", { card: cardId });
}

export async function getCard(cardId: number) {
  const cards = await callAnki<AnkiCard[]>("cardsInfo", { cards: [cardId] });
  return cards[0] ?? null;
}

export async function getMediaFile(filename: string) {
  return callAnki<string | false>("retrieveMediaFile", { filename });
}

const mediaCache = new Map<string, Promise<string | false>>();

function cachedMediaFile(filename: string) {
  const cached = mediaCache.get(filename);
  if (cached) return cached;
  const request = getMediaFile(filename).catch((error) => {
    mediaCache.delete(filename);
    throw error;
  });
  mediaCache.set(filename, request);
  if (mediaCache.size > 64) mediaCache.delete(mediaCache.keys().next().value as string);
  return request;
}

export async function enrichAnkiHtml(html: string) {
  const filenames = new Set<string>();
  html.replace(/(?:src|href)=["']([^"']+)["']/gi, (_match, source: string) => {
    if (!/^(?:https?:|data:|#|javascript:)/i.test(source)) filenames.add(decodeURIComponent(source));
    return _match;
  });

  const media = await Promise.all([...filenames].map(async (filename) => {
    try {
      const encoded = await cachedMediaFile(filename);
      return encoded ? [filename, `data:${mimeFor(filename)};base64,${encoded}`] as const : null;
    } catch {
      return null;
    }
  }));

  return media.reduce((result, item) => {
    if (!item) return result;
    return result.split(item[0]).join(item[1]);
  }, html);
}

export function audioFilesFromCard(card: AnkiCard, preferredFields?: string[]) {
  const filenames = new Set<string>();
  const orderedFields = preferredFields === undefined
    ? Object.values(card.fields)
    : preferredFields.map((name) => card.fields[name]).filter(Boolean);
  orderedFields.forEach(({ value }) => {
    for (const match of value.matchAll(/\[sound:([^\]]+)\]/gi)) filenames.add(match[1]);
  });
  return [...filenames];
}

let activeCardAudio: HTMLAudioElement | null = null;
let audioRequest = 0;

function stopActiveCardAudio() {
  if ("__TAURI_INTERNALS__" in window) void invoke("stop_audio", { request: audioRequest });
  if (!activeCardAudio) return;
  activeCardAudio.pause();
  activeCardAudio.currentTime = 0;
  activeCardAudio.src = "";
  activeCardAudio = null;
}

export async function stopAnkiNativeAudio() {
  try {
    return await callAnki<boolean>("guiStopAudio");
  } catch {
    return false;
  }
}

export async function releaseAnkiReviewAudio() {
  try {
    return await callAnki<boolean>("guiReleaseAudioSuppression");
  } catch {
    return false;
  }
}

export async function preloadAnkiAudio(card: AnkiCard, preferredFields?: string[]) {
  const filename = audioFilesFromCard(card, preferredFields)[0];
  if (!filename) return false;
  return Boolean(await cachedMediaFile(filename));
}

export function stopAnkiAudio() {
  audioRequest += 1;
  stopActiveCardAudio();
}

export async function playAnkiAudio(card: AnkiCard, preferredFields?: string[], isCurrent: () => boolean = () => true) {
  const filename = audioFilesFromCard(card, preferredFields)[0];
  if (!filename) return false;
  const request = ++audioRequest;
  const encoded = await cachedMediaFile(filename);
  if (!encoded || request !== audioRequest || !isCurrent()) return false;
  if ("__TAURI_INTERNALS__" in window) {
    await invoke("play_audio", { filename, base64Data: encoded, request });
    return request === audioRequest && isCurrent();
  }
  stopActiveCardAudio();
  const audio = new Audio(`data:${mimeFor(filename)};base64,${encoded}`);
  if (request !== audioRequest || !isCurrent()) return false;
  activeCardAudio = audio;
  audio.addEventListener("ended", () => { if (activeCardAudio === audio) activeCardAudio = null; }, { once: true });
  await audio.play();
  return true;
}

function mimeFor(filename: string) {
  const extension = filename.split(".").pop()?.toLowerCase();
  const mimes: Record<string, string> = {
    mp3: "audio/mpeg", ogg: "audio/ogg", wav: "audio/wav", m4a: "audio/mp4",
    png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif",
    webp: "image/webp", svg: "image/svg+xml",
  };
  return mimes[extension ?? ""] ?? "application/octet-stream";
}
