import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import ArrowLeft from "lucide-react/dist/esm/icons/arrow-left.mjs";
import ArrowRight from "lucide-react/dist/esm/icons/arrow-right.mjs";
import BarChart3 from "lucide-react/dist/esm/icons/bar-chart-3.mjs";
import BookOpen from "lucide-react/dist/esm/icons/book-open.mjs";
import CalendarDays from "lucide-react/dist/esm/icons/calendar-days.mjs";
import Cloud from "lucide-react/dist/esm/icons/cloud.mjs";
import CloudOff from "lucide-react/dist/esm/icons/cloud-off.mjs";
import Check from "lucide-react/dist/esm/icons/check.mjs";
import ChevronRight from "lucide-react/dist/esm/icons/chevron-right.mjs";
import Clock3 from "lucide-react/dist/esm/icons/clock-3.mjs";
import ExternalLink from "lucide-react/dist/esm/icons/external-link.mjs";
import Flag from "lucide-react/dist/esm/icons/flag.mjs";
import Flame from "lucide-react/dist/esm/icons/flame.mjs";
import Home from "lucide-react/dist/esm/icons/home.mjs";
import Languages from "lucide-react/dist/esm/icons/languages.mjs";
import Layers3 from "lucide-react/dist/esm/icons/layers-3.mjs";
import LoaderCircle from "lucide-react/dist/esm/icons/loader-circle.mjs";
import Monitor from "lucide-react/dist/esm/icons/monitor.mjs";
import Moon from "lucide-react/dist/esm/icons/moon.mjs";
import Mic from "lucide-react/dist/esm/icons/mic.mjs";
import Music2 from "lucide-react/dist/esm/icons/music-2.mjs";
import MessageSquare from "lucide-react/dist/esm/icons/message-square.mjs";
import Play from "lucide-react/dist/esm/icons/play.mjs";
import RotateCcw from "lucide-react/dist/esm/icons/rotate-ccw.mjs";
import Search from "lucide-react/dist/esm/icons/search.mjs";
import Settings from "lucide-react/dist/esm/icons/settings.mjs";
import ShieldCheck from "lucide-react/dist/esm/icons/shield-check.mjs";
import Snowflake from "lucide-react/dist/esm/icons/snowflake.mjs";
import Sparkles from "lucide-react/dist/esm/icons/sparkles.mjs";
import Star from "lucide-react/dist/esm/icons/star.mjs";
import Square from "lucide-react/dist/esm/icons/square.mjs";
import Target from "lucide-react/dist/esm/icons/target.mjs";
import Trophy from "lucide-react/dist/esm/icons/trophy.mjs";
import Tags from "lucide-react/dist/esm/icons/tags.mjs";
import Volume2 from "lucide-react/dist/esm/icons/volume-2.mjs";
import VolumeX from "lucide-react/dist/esm/icons/volume-x.mjs";
import X from "lucide-react/dist/esm/icons/x.mjs";
import Zap from "lucide-react/dist/esm/icons/zap.mjs";
import { createUi, type Translator, type UiLanguage } from "./i18n";
import {
  ANKI_DECKS,
  type AnkiCard,
  type AnkiNote,
  audioFilesFromCard,
  enrichAnkiHtml,
  getDeckDueCount,
  getDeckLearningStats,
  getAnkiOverview,
  getReviewHistory,
  getReviewedToday,
  isAnkiCardDueAgainToday,
  playAnkiAudio,
  preloadAnkiAudio,
  releaseAnkiReviewAudio,
  stopAnkiAudio,
  searchAnkiCards,
  searchAnkiNotes,
  openAnkiBrowser,
  editAnkiNote,
  syncAnkiWeb,
  rateAnkiCard,
  undoAnkiReview,
  showAnkiAnswer,
  startAnkiReview,
} from "./anki";

type Page = "home" | "review" | "review-setup" | "cards" | "progress" | "stats" | "settings" | "feedback" | "language" | "streak";
type Rating = "Again" | "Hard" | "Good" | "Easy";
type LanguageId = "finnish" | "swiss" | "french" | "cantonese";

type LanguageInfo = {
  id: LanguageId;
  name: string;
  flag: string;
  color: "red" | "blue" | "green";
  greeting: string;
  level: string;
  progress: number;
  due: number;
  activeDays: number;
  learned: number;
  total: number;
  topics: Array<{ name: string; detail: string; progress: number }>;
};

type ReviewCard = {
  deck: string;
  eyebrow: string;
  prompt: string;
  answer: string;
  note: string;
};

type ReviewUndoEntry = { cardId?: number; index: number; counted: boolean };

type AnkiStatus = "checking" | "connected" | "offline";
type LanguageStats = Record<LanguageId, { due: number; total: number; learned: number; available: boolean; new: number; learning: number; young: number; mature: number; suspended: number }>;
type AppSettings = {
  soundEffects: boolean;
  autoPlayAudio: boolean;
  reducedMotion: boolean;
  immersiveUi: boolean;
  autoSync: boolean;
};

const defaultSettings: AppSettings = {
  soundEffects: true,
  autoPlayAudio: false,
  reducedMotion: false,
  immersiveUi: false,
  autoSync: true,
};

type SyncStatus = "idle" | "syncing" | "success" | "error";
const emptyLanguageStats = { due: 0, total: 0, learned: 0, available: false, new: 0, learning: 0, young: 0, mature: 0, suspended: 0 };

type UiContextValue = { t: Translator; locale: string };
const UiContext = createContext<UiContextValue>(createUi("german"));
const useUi = () => useContext(UiContext);

const languageMilestones = [
  { label: "A0", cards: 0, title: "Start", description: "Erste Wörter und Laute" },
  { label: "A1", cards: 200, title: "Grundlagen", description: "Einfache Alltagssituationen" },
  { label: "A2", cards: 600, title: "Basis", description: "Kurze Gespräche verstehen" },
  { label: "B1", cards: 1200, title: "Selbstständig", description: "Über vertraute Themen sprechen" },
  { label: "B2", cards: 2500, title: "Sicher", description: "Spontan und detailliert kommunizieren" },
  { label: "C1", cards: 4500, title: "Fortgeschritten", description: "Komplexe Inhalte flexibel nutzen" },
  { label: "C2", cards: 7000, title: "Sehr sicher", description: "Nahezu mühelos verstehen" },
];

const languages: LanguageInfo[] = [
  {
    id: "finnish",
    name: "Suomi",
    flag: "🇫🇮",
    color: "blue",
    greeting: "Moi Phila!",
    level: "A0",
    progress: 0,
    due: 0,
    activeDays: 0,
    learned: 0,
    total: 0,
    topics: [],
  },
  {
    id: "swiss",
    name: "Schweizerdeutsch",
    flag: "🇨🇭",
    color: "red",
    greeting: "Grüezi",
    level: "A1",
    progress: 78,
    due: 23,
    activeDays: 5,
    learned: 642,
    total: 642,
    topics: [
      { name: "Alltag", detail: "Redewendungen & Gespräche", progress: 86 },
      { name: "Grammatik", detail: "Wortstellung & Verben", progress: 72 },
      { name: "Aussprache", detail: "Laute & Rhythmus", progress: 61 },
    ],
  },
  {
    id: "french",
    name: "Français",
    flag: "🇫🇷",
    color: "blue",
    greeting: "Bonjour",
    level: "A1",
    progress: 67,
    due: 18,
    activeDays: 4,
    learned: 518,
    total: 518,
    topics: [
      { name: "Grammaire", detail: "Temps & pronoms", progress: 74 },
      { name: "Vocabulaire", detail: "Alltag & Reisen", progress: 69 },
      { name: "Expressions", detail: "Natürliche Wendungen", progress: 55 },
    ],
  },
  {
    id: "cantonese",
    name: "Cantonese",
    flag: "🇭🇰",
    color: "green",
    greeting: "Nei5 hou2",
    level: "A1",
    progress: 58,
    due: 11,
    activeDays: 3,
    learned: 397,
    total: 397,
    topics: [
      { name: "Jat6 soeng4 jung6 jyu5", detail: "Alltag & Höflichkeit", progress: 68 },
      { name: "Faat3 jam1", detail: "Töne & Aussprache", progress: 52 },
      { name: "Geoi3 zi2", detail: "Satzmuster", progress: 43 },
    ],
  },
];

const cardsByLanguage: Record<LanguageId, ReviewCard[]> = {
  finnish: [],
  swiss: [
    { deck: "Alltag › Redewendungen", eyebrow: "Bedeutung", prompt: "Was bedeutet «Es isch mir gliich»?", answer: "Es ist mir egal. / Es macht für mich keinen Unterschied.", note: "«Gliich» kann je nach Kontext auch «gleich» oder «bald» bedeuten." },
    { deck: "Alltag › Im Restaurant", eyebrow: "Übersetzung", prompt: "Wie würdest du sagen: «Ich hätte gern noch einen Kaffee»?", answer: "Ich hett gärn no en Kafi.", note: "«Hett gärn» ist eine natürliche, höfliche Formulierung." },
    { deck: "Grammatik › Wortstellung", eyebrow: "Satzbau", prompt: "Vervollständige: «Wänn ich Ziit ___, chum ich mit.»", answer: "ha", note: "Im Nebensatz steht das konjugierte Verb am Ende." },
  ],
  french: [
    { deck: "Grammaire › Passé composé", eyebrow: "Conjugaison", prompt: "Nous ___ au restaurant hier.\n(aller)", answer: "Nous sommes allés au restaurant hier.", note: "Bei Verben mit être richtet sich das Partizip nach dem Subjekt." },
    { deck: "Vocabulaire › Au café", eyebrow: "Traduction", prompt: "Wie sagt man: «Die Rechnung, bitte»?", answer: "L’addition, s’il vous plaît.", note: "Eine kurze und übliche Formulierung im Restaurant." },
    { deck: "Grammaire › Pronoms", eyebrow: "Complète la phrase", prompt: "Je donne le livre à Marie.\nJe ___ donne le livre.", answer: "lui", note: "«Lui» ersetzt ein indirektes Objekt im Singular." },
  ],
  cantonese: [
    { deck: "日常用語 › Begrüßung", eyebrow: "Wortschatz", prompt: "Wie sagt man «Guten Morgen» auf Kantonesisch?", answer: "早晨 — zou2 san4", note: "Eine typische Begrüßung am Morgen in Hongkong." },
    { deck: "日常用語 › Höflichkeit", eyebrow: "Wortschatz", prompt: "Was bedeutet «唔該» (m4 goi1)?", answer: "Danke / Bitte / Entschuldigung", note: "Wird oft für kleine Gefälligkeiten und im Service-Kontext verwendet." },
    { deck: "發音 › Töne", eyebrow: "Aussprache", prompt: "Welchen Ton hat 好 in 你好?", answer: "hou2 — Ton 2", note: "Der steigende zweite Ton wird mit der Ziffer 2 markiert." },
  ],
};

const philaLanguages: LanguageId[] = ["finnish"];

function App() {
  const [page, setPage] = useState<Page>("home");
  const [reviewIndex, setReviewIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [completed, setCompleted] = useState(0);
  const [activeLanguageId, setActiveLanguageId] = useState<LanguageId>("finnish");
  const [detailLanguageId, setDetailLanguageId] = useState<LanguageId>("finnish");
  const [progressLanguageId, setProgressLanguageId] = useState<LanguageId>("finnish");
  const [onboardingDone, setOnboardingDone] = useState(() => localStorage.getItem("linguaflow-phila-onboarding") === "done");
  const [ankiStatus, setAnkiStatus] = useState<AnkiStatus>("checking");
  const [ankiError, setAnkiError] = useState("");
  const [deckNames, setDeckNames] = useState<string[]>([]);
  const [finnishDeck, setFinnishDeck] = useState(() => localStorage.getItem("linguaflow-finnish-deck") || "");
  const [languageStats, setLanguageStats] = useState<LanguageStats>({
    finnish: { ...emptyLanguageStats },
    swiss: { ...emptyLanguageStats },
    french: { ...emptyLanguageStats },
    cantonese: { ...emptyLanguageStats },
  });
  const [ankiCard, setAnkiCard] = useState<AnkiCard | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState("");
  const [reviewUsesAnki, setReviewUsesAnki] = useState(false);
  const [reviewTotal, setReviewTotal] = useState(0);
  const [reviewUndoDepth, setReviewUndoDepth] = useState(0);
  const [reviewedToday, setReviewedToday] = useState(0);
  const [reviewHistory, setReviewHistory] = useState<Array<[string, number]>>([]);
  const [appSettings, setAppSettings] = useState<AppSettings>(loadSettings);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [syncError, setSyncError] = useState("");
  const syncTimer = useRef<number | null>(null);
  const reviewRequest = useRef(0);
  const reviewHasChanges = useRef(false);
  const clearedReviewCards = useRef<Set<number>>(new Set());
  const reviewUndoStack = useRef<ReviewUndoEntry[]>([]);

  const hydratedLanguages = useMemo(() => languages.filter((language) => philaLanguages.includes(language.id)).map((language) => {
    const live = languageStats[language.id];
    const learned = ankiStatus === "connected" ? live.learned : 0;
    const journey = getLanguageJourney(learned);
    const parentDeck = language.id === "finnish" ? finnishDeck : ANKI_DECKS[language.id];
    const liveTopics = deckNames
      .filter((name) => name.startsWith(`${parentDeck}::`))
      .map((name) => name.slice(parentDeck.length + 2).split("::")[0])
      .filter((name, index, all) => all.indexOf(name) === index)
      .slice(0, 5)
      .map((name, index) => ({ name, detail: "Anki-Unterstapel", progress: Math.max(24, language.progress - index * 9) }));
    return {
      ...language,
      due: ankiStatus === "connected" ? live.due : 0,
      learned,
      total: ankiStatus === "connected" ? live.total : 0,
      level: journey.current.label,
      progress: journey.progress,
      topics: liveTopics.length ? liveTopics : language.topics,
    };
  }), [ankiStatus, deckNames, finnishDeck, languageStats]);

  const activeLanguage = hydratedLanguages.find((language) => language.id === activeLanguageId)!;
  const detailLanguage = hydratedLanguages.find((language) => language.id === detailLanguageId)!;
  const reviewCards = cardsByLanguage[activeLanguageId];
  const streak = calculateStreak(reviewHistory);
  const ui = useMemo(() => createUi((appSettings.immersiveUi ? activeLanguageId : "german") as UiLanguage), [appSettings.immersiveUi, activeLanguageId]);

  const refreshAnki = async (finnishDeckOverride = finnishDeck) => {
    setAnkiStatus("checking");
    setAnkiError("");
    try {
      const [overview, today, history] = await Promise.all([getAnkiOverview(), getReviewedToday(), getReviewHistory()]);
      setReviewedToday(today);
      setReviewHistory(history);
      setDeckNames(overview.deckNames);
      const stats = await Promise.all(philaLanguages.map(async (id) => {
        const deck = id === "finnish" ? finnishDeckOverride : ANKI_DECKS[id];
        const available = Boolean(deck && overview.deckNames.includes(deck));
        if (!available) return [id, { ...emptyLanguageStats, available }] as const;
        const [due, learningStats] = await Promise.all([getDeckDueCount(deck), getDeckLearningStats(deck)]);
        return [id, { due, ...learningStats, available }] as const;
      }));
      setLanguageStats((current) => ({ ...current, ...Object.fromEntries(stats) } as LanguageStats));
      setAnkiStatus("connected");
    } catch (error) {
      setAnkiStatus("offline");
      setAnkiError(error instanceof Error ? error.message : String(error));
    }
  };

  const selectFinnishDeck = (deck: string) => {
    setFinnishDeck(deck);
    localStorage.setItem("linguaflow-finnish-deck", deck);
    void refreshAnki(deck);
  };

  useEffect(() => { void refreshAnki(); }, []);
  useEffect(() => {
    localStorage.setItem("linguaflow-settings", JSON.stringify(appSettings));
    document.documentElement.classList.toggle("reduce-motion", appSettings.reducedMotion);
  }, [appSettings]);

  useEffect(() => () => { if (syncTimer.current) window.clearTimeout(syncTimer.current); }, []);

  const runSync = async () => {
    if (syncStatus === "syncing") return;
    setSyncStatus("syncing");
    setSyncError("");
    try {
      await syncAnkiWeb();
      setSyncStatus("success");
      await refreshAnki();
      window.setTimeout(() => setSyncStatus("idle"), 3500);
    } catch (error) {
      setSyncStatus("error");
      setSyncError(error instanceof Error ? error.message : String(error));
    }
  };

  const scheduleSync = () => {
    if (!appSettings.autoSync) return;
    if (syncTimer.current) window.clearTimeout(syncTimer.current);
    syncTimer.current = window.setTimeout(() => void runSync(), 5000);
  };

  const flushReviewChanges = () => {
    if (!reviewHasChanges.current) return;
    reviewHasChanges.current = false;
    void refreshAnki();
    scheduleSync();
  };

  const startReview = async (languageId: LanguageId = activeLanguageId) => {
    const canUseAnki = ankiStatus === "connected" && languageStats[languageId].available;
    if (!canUseAnki) return;
    const request = ++reviewRequest.current;
    setActiveLanguageId(languageId);
    setReviewIndex(0);
    setCompleted(0);
    clearedReviewCards.current.clear();
    reviewUndoStack.current = [];
    setReviewUndoDepth(0);
    setRevealed(false);
    setReviewError("");
    setReviewTotal(0);
    setAnkiCard(null);
    setPage("review");
    setReviewUsesAnki(canUseAnki);
    setReviewTotal(languageStats[languageId].due);
    if (!languageStats[languageId].due) return;
    setReviewLoading(true);
    try {
      const deck = languageId === "finnish" ? finnishDeck : ANKI_DECKS[languageId];
      const firstCard = await startAnkiReview(deck);
      if (request === reviewRequest.current) setAnkiCard(firstCard);
    } catch (error) {
      if (request === reviewRequest.current) setReviewError(error instanceof Error ? error.message : String(error));
    } finally {
      if (request === reviewRequest.current) setReviewLoading(false);
    }
  };

  const rateCard = async (rating: Rating) => {
    if (reviewUsesAnki && ankiCard) {
      const request = reviewRequest.current;
      const ratedCardId = ankiCard.cardId;
      setReviewLoading(true);
      try {
        const ease = ({ Again: 1, Hard: 2, Good: 3, Easy: 4 } as const)[rating];
        const next = await rateAnkiCard(ease, ratedCardId);
        if (request !== reviewRequest.current) return;
        const dueAgainToday = await isAnkiCardDueAgainToday(ratedCardId);
        if (request !== reviewRequest.current) return;
        const counted = !dueAgainToday && !clearedReviewCards.current.has(ratedCardId);
        reviewUndoStack.current = [...reviewUndoStack.current.slice(-2), { cardId: ratedCardId, index: reviewIndex, counted }];
        setReviewUndoDepth(reviewUndoStack.current.length);
        if (counted) {
          clearedReviewCards.current.add(ratedCardId);
          setCompleted((count) => count + 1);
        }
        setRevealed(false);
        setAnkiCard(next);
        reviewHasChanges.current = true;
        if (!next) flushReviewChanges();
      } catch (error) {
        if (request === reviewRequest.current) setReviewError(error instanceof Error ? error.message : String(error));
      } finally {
        if (request === reviewRequest.current) setReviewLoading(false);
      }
      return;
    }
    reviewUndoStack.current = [...reviewUndoStack.current.slice(-2), { index: reviewIndex, counted: true }];
    setReviewUndoDepth(reviewUndoStack.current.length);
    if (reviewIndex < reviewCards.length - 1) {
      setReviewIndex((index) => index + 1);
      setCompleted((count) => count + 1);
      setRevealed(false);
    } else {
      setCompleted(reviewCards.length);
    }
  };

  const undoLastReview = async () => {
    if (reviewLoading || !reviewUndoStack.current.length) return;
    const entry = reviewUndoStack.current[reviewUndoStack.current.length - 1];
    if (!reviewUsesAnki) {
      reviewUndoStack.current.pop();
      setReviewUndoDepth(reviewUndoStack.current.length);
      setReviewIndex(entry.index);
      if (entry.counted) setCompleted((count) => Math.max(0, count - 1));
      setRevealed(false);
      return;
    }

    const request = reviewRequest.current;
    setReviewLoading(true);
    stopAnkiAudio();
    try {
      const restored = await undoAnkiReview(ankiCard?.cardId);
      if (request !== reviewRequest.current) return;
      reviewUndoStack.current.pop();
      setReviewUndoDepth(reviewUndoStack.current.length);
      if (entry.counted) {
        if (entry.cardId) clearedReviewCards.current.delete(entry.cardId);
        setCompleted((count) => Math.max(0, count - 1));
      }
      setReviewError("");
      setRevealed(false);
      setAnkiCard(restored);
      reviewHasChanges.current = true;
    } catch (error) {
      if (request === reviewRequest.current) setReviewError(error instanceof Error ? error.message : String(error));
    } finally {
      if (request === reviewRequest.current) setReviewLoading(false);
    }
  };

  const revealAnswer = async () => {
    if (reviewUsesAnki) {
      try {
        await showAnkiAnswer();
      } catch (error) {
        setReviewError(error instanceof Error ? error.message : String(error));
        return;
      }
    }
    setRevealed(true);
  };

  const openLanguage = (languageId: LanguageId) => {
    setDetailLanguageId(languageId);
    setProgressLanguageId(languageId);
    setPage("progress");
  };

  if (!onboardingDone) {
    return <Onboarding onComplete={() => {
      localStorage.setItem("linguaflow-phila-onboarding", "done");
      setOnboardingDone(true);
      void refreshAnki();
    }} />;
  }

  if (ankiStatus === "checking") return <ConnectionScreen checking onRetry={() => void refreshAnki()} onFeedback={() => setPage("feedback")} />;
  if (ankiStatus === "offline" && page !== "feedback") return <ConnectionScreen error={ankiError} onRetry={() => void refreshAnki()} onFeedback={() => setPage("feedback")} />;
  if (ankiStatus === "connected" && !languageStats.finnish.available && page !== "feedback") return <DeckSetupScreen decks={deckNames} selectedDeck={finnishDeck} onSelect={selectFinnishDeck} onRetry={() => void refreshAnki()} onFeedback={() => setPage("feedback")} />;

  if (page === "review") {
    return (
      <UiContext.Provider value={ui}><ReviewView
        index={reviewIndex}
        revealed={revealed}
        completed={completed}
        cards={reviewCards}
        language={activeLanguage}
        deckName={finnishDeck}
        ankiCard={ankiCard}
        usesAnki={reviewUsesAnki}
        loading={reviewLoading}
        error={reviewError}
        total={reviewTotal}
        settings={appSettings}
        onSettingsChange={setAppSettings}
        onReveal={() => void revealAnswer()}
        onRate={rateCard}
        undoDepth={reviewUndoDepth}
        onUndo={() => void undoLastReview()}
        onExit={() => { reviewRequest.current += 1; stopAnkiAudio(); void releaseAnkiReviewAudio(); flushReviewChanges(); setPage("home"); }}
        onRetry={() => void startReview(activeLanguageId)}
      /></UiContext.Provider>
    );
  }

  return (
    <UiContext.Provider value={ui}><div className={`app-shell accent-${activeLanguage.color}`} lang={ui.locale}>
      <Sidebar
        page={page}
        onNavigate={(nextPage) => { if (nextPage === "progress") setProgressLanguageId(activeLanguageId); setPage(nextPage); }}
        activeLanguageId={activeLanguageId}
        activeDue={activeLanguage.due}
        onOpenProfile={() => setPage("settings")}
        onSelectLanguage={(languageId) => { setActiveLanguageId(languageId); setPage("home"); }}
      />
      <main className="main-content">
        <button
          className={`global-streak ${page === "streak" ? "active" : ""} ${hasActivityToday(reviewHistory) ? "renewed" : "pending"}`}
          onClick={() => setPage("streak")}
          aria-label={`${streak} ${streak === 1 ? ui.t("day") : ui.t("days")}`}
        >
          <Flame size={29} fill="currentColor" />
          <strong>{streak}</strong>
        </button>
        {page === "home" && (
          <HomePage
            activeLanguage={activeLanguage}
            allLanguages={hydratedLanguages}
            reviewHistory={reviewHistory}
            onStartReview={() => startReview()}
            onSelectLanguage={(id) => setActiveLanguageId(id)}
            onOpenLanguage={openLanguage}
          />
        )}
        {page === "language" && (
          <LanguagePage
            language={detailLanguage}
            isActive={detailLanguageId === activeLanguageId}
            onBack={() => setPage("home")}
            onActivate={() => setActiveLanguageId(detailLanguageId)}
            onStartReview={() => startReview(detailLanguageId)}
          />
        )}
        {page === "progress" && <ProgressPage languages={hydratedLanguages} selectedId={progressLanguageId} onSelect={setProgressLanguageId} onStartReview={(id) => void startReview(id)} />}
        {page === "review-setup" && <ReviewSetupPage languages={hydratedLanguages} activeLanguageId={activeLanguageId} onSelectLanguage={setActiveLanguageId} onStart={(id) => void startReview(id)} />}
        {page === "streak" && <StreakPage onBack={() => setPage("home")} reviewHistory={reviewHistory} streak={streak} />}
        {page === "cards" && <CardsPage languages={hydratedLanguages} activeLanguageId={activeLanguageId} deckName={finnishDeck} />}
        {page === "stats" && <StatsPage languages={hydratedLanguages} stats={languageStats} reviewedToday={reviewedToday} reviewHistory={reviewHistory} />}
        {page === "settings" && <SettingsPage settings={appSettings} onChange={setAppSettings} onReconnect={() => void refreshAnki()} onSync={() => void runSync()} ankiStatus={ankiStatus} ankiError={ankiError} syncStatus={syncStatus} syncError={syncError} deckNames={deckNames} selectedDeck={finnishDeck} onSelectDeck={selectFinnishDeck} />}
        {page === "feedback" && <FeedbackPage onBack={() => setPage("home")} />}
      </main>
    </div></UiContext.Provider>
  );
}

function Onboarding({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(0);
  const slides = [
    {
      icon: <span className="onboarding-flag">🇫🇮</span>,
      eyebrow: "TERVETULOA",
      title: "Moi Phila!",
      text: "LinguaFlow ist dein ruhiger Ort für Finnisch – mit deinen echten Karten und deinem echten Fortschritt aus Anki.",
    },
    {
      icon: <Monitor size={36} />,
      eyebrow: "DEINE KARTEN",
      title: "Anki bleibt das Herzstück",
      text: "Öffne beim Lernen zuerst Anki. Danach wählst du einmal deinen Finnisch-Stapel aus – LinguaFlow übernimmt jede Bewertung direkt in Anki.",
    },
    {
      icon: <Sparkles size={36} />,
      eyebrow: "ALLES BEREIT",
      title: "Pidä hauskaa!",
      text: "Vorder- und Rückwärtskarte einer Notiz werden getrennt gelernt. Audio, Glossing und deine Wiederholungsintervalle bleiben vollständig erhalten.",
    },
  ];
  const slide = slides[step];
  return <div className="welcome-shell accent-blue">
    <div className="welcome-card">
      <div className="welcome-brand"><span className="brand-mark"><Languages size={21} /></span><strong>LinguaFlow</strong></div>
      <div className="welcome-art">{slide.icon}</div>
      <p>{slide.eyebrow}</p>
      <h1>{slide.title}</h1>
      <span>{slide.text}</span>
      <div className="welcome-dots">{slides.map((_, index) => <i className={index === step ? "active" : ""} key={index} />)}</div>
      <button className="primary-button welcome-next" onClick={() => step < slides.length - 1 ? setStep(step + 1) : onComplete()}>
        {step < slides.length - 1 ? <>Weiter <ArrowRight size={18} /></> : <>Los geht’s <Sparkles size={18} /></>}
      </button>
      {step > 0 && <button className="welcome-back" onClick={() => setStep(step - 1)}>Zurück</button>}
    </div>
  </div>;
}

function ConnectionScreen({ checking = false, error, onRetry, onFeedback }: { checking?: boolean; error?: string; onRetry: () => void; onFeedback: () => void }) {
  return <div className="welcome-shell accent-blue">
    <div className="connection-card">
      <div className={`connection-hero-icon ${checking ? "checking" : ""}`}>{checking ? <LoaderCircle className="spin" size={38} /> : <CloudOff size={38} />}</div>
      <p>ANKI-VERBINDUNG</p>
      <h1>{checking ? "Einen Moment, Phila …" : "Bitte öffne Anki"}</h1>
      <span>{checking ? "LinguaFlow sucht deine lokale Anki-Sammlung." : "Deine Karten bleiben sicher in Anki. Öffne Anki mit installiertem AnkiConnect und versuche es danach noch einmal."}</span>
      {!checking && error && <small>{error}</small>}
      {!checking && <button className="primary-button" onClick={onRetry}><RotateCcw size={17} />Erneut verbinden</button>}
      {!checking && <button className="welcome-back" onClick={onFeedback}>Feedback geben</button>}
    </div>
  </div>;
}

function DeckSetupScreen({ decks, selectedDeck, onSelect, onRetry, onFeedback }: { decks: string[]; selectedDeck: string; onSelect: (deck: string) => void; onRetry: () => void; onFeedback: () => void }) {
  const [choice, setChoice] = useState(selectedDeck);
  return <div className="welcome-shell accent-blue">
    <div className="connection-card">
      <div className="connection-hero-icon"><Layers3 size={38} /></div>
      <p>DEIN FINNISCH-STAPEL</p>
      <h1>Welchen Stapel möchtest du lernen?</h1>
      <span>Anki ist verbunden. Wähle den Hauptstapel mit deinen Finnisch-Karten aus. Seine Unterstapel werden automatisch mitgenommen.</span>
      {decks.length ? <div className="deck-picker">
        <label htmlFor="onboarding-deck">Anki-Stapel</label>
        <select id="onboarding-deck" value={choice} onChange={(event) => setChoice(event.target.value)}>
          <option value="" disabled>Stapel auswählen …</option>
          {decks.map((deck) => <option value={deck} key={deck}>{deck.replaceAll("::", " › ")}</option>)}
        </select>
      </div> : <small>In Anki wurden noch keine Stapel gefunden.</small>}
      <button className="primary-button" disabled={!choice} onClick={() => onSelect(choice)}><Check size={17} />Diesen Stapel verwenden</button>
      <button className="welcome-back" onClick={onRetry}><RotateCcw size={15} /> Stapelliste aktualisieren</button>
      <button className="welcome-back" onClick={onFeedback}>Feedback geben</button>
    </div>
  </div>;
}

function FeedbackPage({ onBack }: { onBack: () => void }) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const sendFeedback = async () => {
    setError("");
    setStatus("sending");
    try {
      if ("__TAURI_INTERNALS__" in window) {
        await invoke("send_feedback", { message: message.trim() });
      } else {
        const response = await fetch("https://formsubmit.co/ajax/leif.maurer@gmail.com", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ name: "Phila", message: message.trim(), _subject: "LinguaFlow Feedback von Phila", _captcha: "false" }),
        });
        if (!response.ok) throw new Error(`Status ${response.status}`);
      }
      setMessage("");
      setStatus("sent");
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : String(sendError));
      setStatus("idle");
    }
  };
  return <div className="utility-page feedback-page content-page">
    <button className="back-button" onClick={onBack}><ArrowLeft size={18} />Zurück</button>
    <header className="utility-header"><div><p>DEIN FEEDBACK</p><h1>Was können wir besser machen, Phila?</h1><span>Ideen, Fehler oder Wünsche – schreib Leif einfach kurz, was dir aufgefallen ist.</span></div></header>
    <section className="feedback-panel surface">
      <div className="feedback-icon"><MessageSquare size={24} /></div>
      <label htmlFor="feedback-message">Deine Nachricht</label>
      <textarea id="feedback-message" value={message} onChange={(event) => { setMessage(event.target.value); if (status === "sent") setStatus("idle"); }} placeholder="Zum Beispiel: Bei dieser Karte wurde das Audio nicht abgespielt …" autoFocus />
      {status === "sent" && <p className="feedback-success"><Check size={16} />Danke, dein Feedback wurde gesendet.</p>}
      {error && <p className="feedback-error">Feedback konnte nicht gesendet werden: {error}</p>}
      <button className="primary-button" disabled={!message.trim() || status === "sending"} onClick={() => void sendFeedback()}>{status === "sending" ? <LoaderCircle className="spin" size={17} /> : <MessageSquare size={17} />}{status === "sending" ? "Wird gesendet …" : "Senden"}</button>
    </section>
  </div>;
}

function Sidebar({
  page,
  onNavigate,
  activeLanguageId,
  activeDue,
  onOpenProfile,
  onSelectLanguage,
}: {
  page: Page;
  onNavigate: (page: Page) => void;
  activeLanguageId: LanguageId;
  activeDue: number;
  onOpenProfile: () => void;
  onSelectLanguage: (language: LanguageId) => void;
}) {
  const { t } = useUi();
  const links: { label: string; icon: typeof Home; page: Page; badge?: string }[] = [
    { label: t("home"), icon: Home, page: "home" },
    { label: t("review"), icon: RotateCcw, page: "review-setup", badge: String(activeDue) },
    { label: t("cards"), icon: BookOpen, page: "cards" },
    { label: t("progress"), icon: Trophy, page: "progress" },
    { label: t("stats"), icon: BarChart3, page: "stats" },
    { label: t("settings"), icon: Settings, page: "settings" },
    { label: "Feedback", icon: MessageSquare, page: "feedback" },
  ];

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark"><Languages size={21} strokeWidth={2.4} /></div>
        <span>LinguaFlow</span>
      </div>
      <nav className="main-nav" aria-label="Hauptnavigation">
        {links.map((link) => {
          const Icon = link.icon;
          const active = page === link.page;
          return (
            <button
              key={link.label}
              className={`nav-item ${active ? "active" : ""}`}
              onClick={() => onNavigate(link.page)}
            >
              <Icon size={20} />
              <span>{link.label}</span>
              {link.badge !== undefined && <b>{link.badge}</b>}
            </button>
          );
        })}
      </nav>
      <div className="sidebar-divider" />
      <div className="language-nav">
        {languages.filter((language) => philaLanguages.includes(language.id)).map((language) => (
          <button
            key={language.name}
            className={activeLanguageId === language.id ? "active-language" : ""}
            onClick={() => onSelectLanguage(language.id)}
          >
            <span>{language.flag}</span>
            <span className="language-nav-name">{language.name}</span>
            {activeLanguageId === language.id && <i aria-hidden="true" />}
          </button>
        ))}
      </div>
      <button className="profile-button" onClick={onOpenProfile}>
        <span className="avatar">P</span>
        <span>Phila</span>
        <Settings size={16} />
      </button>
    </aside>
  );
}

function HomePage({
  activeLanguage,
  allLanguages,
  reviewHistory,
  onStartReview,
  onSelectLanguage,
  onOpenLanguage,
}: {
  activeLanguage: LanguageInfo;
  allLanguages: LanguageInfo[];
  reviewHistory: Array<[string, number]>;
  onStartReview: () => void;
  onSelectLanguage: (language: LanguageId) => void;
  onOpenLanguage: (language: LanguageId) => void;
}) {
  const { t } = useUi();
  const swipeStart = useRef<number | null>(null);
  const moveLanguage = (direction: number) => {
    const current = allLanguages.findIndex((language) => language.id === activeLanguage.id);
    const next = (current + direction + allLanguages.length) % allLanguages.length;
    onSelectLanguage(allLanguages[next].id);
  };
  return (
    <div className="home-page content-page">
      <header className="page-header">
        <div><h1>{activeLanguage.greeting}, Leif! <span aria-hidden="true">👋</span></h1></div>
      </header>

      <section className="top-grid single-panel">
        <div
          className="review-card surface swipe-panel"
          onPointerDown={(event) => { swipeStart.current = event.clientX; }}
          onPointerUp={(event) => {
            if (swipeStart.current === null) return;
            const distance = event.clientX - swipeStart.current;
            if (Math.abs(distance) > 55) moveLanguage(distance < 0 ? 1 : -1);
            swipeStart.current = null;
          }}
        >
          <button className="carousel-arrow previous" onClick={() => moveLanguage(-1)} aria-label={t("previousLanguage")}><ArrowLeft size={19} /></button>
          <div className="review-copy">
            <p className="red-label">{t("dueToday").toUpperCase()} · {activeLanguage.name.toUpperCase()}</p>
            <div className="review-number">{activeLanguage.due}</div>
            <button className="primary-button" onClick={onStartReview}>{activeLanguage.due ? t("startReview") : t("viewDeck")} <ArrowRight size={19} /></button>
          </div>
          <div className="due-overview">
            <p>{t("allDue")}</p>
            <div>
              {allLanguages.map((language) => (
                <button key={language.id} className={language.id === activeLanguage.id ? "selected" : ""} onClick={() => onSelectLanguage(language.id)}>
                  <span>{language.flag}</span><strong>{language.due}</strong><small>{language.name}</small>
                </button>
              ))}
            </div>
          </div>
          <button className="carousel-arrow next" onClick={() => moveLanguage(1)} aria-label={t("nextLanguage")}><ArrowRight size={19} /></button>
        </div>
      </section>

      <div className="home-lower-grid">
        <section className="languages-section surface">
          <div className="section-heading"><h2>{t("yourLanguages")}</h2></div>
          <div className="language-grid">
            {allLanguages.map((language) => (
              <button
                className={`language-card ${language.color}`}
                key={language.name}
                onClick={() => onOpenLanguage(language.id)}
              >
                <div className="language-title">
                  <span>{language.flag}</span>
                  <strong>{language.name}</strong>
                  <ChevronRight size={20} />
                </div>
                <div className="progress-track"><i style={{ width: `${language.progress}%` }} /></div>
                <div className="language-meta"><span>{t("cardsLearned", { count: language.learned })}</span><span>{language.level}</span></div>
              </button>
            ))}
          </div>
        </section>
        <HomeHeatmap reviewHistory={reviewHistory} />
      </div>
    </div>
  );
}

function HomeHeatmap({ reviewHistory }: { reviewHistory: Array<[string, number]> }) {
  const { t, locale } = useUi();
  const [view, setView] = useState<"week" | "month" | "year">("month");
  const days = getHeatmapDays(view, reviewHistory, locale);
  const activeDays = reviewHistory.filter(([, count]) => count > 0).length;
  const freezes = Math.min(2, Math.floor(activeDays / 7));
  return (
    <section className="home-heatmap surface">
      <div className="home-heatmap-header">
        <div><h2>{t("learningActivity")}</h2><span><Snowflake size={13} /> {freezes}/2</span></div>
        <div className="heatmap-switch compact"><button className={view === "week" ? "active" : ""} onClick={() => setView("week")}>W</button><button className={view === "month" ? "active" : ""} onClick={() => setView("month")}>M</button><button className={view === "year" ? "active" : ""} onClick={() => setView("year")}>J</button></div>
      </div>
      <div className={`activity-heatmap home-view view-${view}`}>
        {days.map((day) => <div key={day.date} className={`heat-cell level-${heatLevel(day.count)}`} title={`${formatHeatDate(day.date, locale)} · ${day.count} Reviews`}><i />{view === "week" && <span>{day.weekday}</span>}</div>)}
      </div>
      <div className="heat-legend"><span>{t("fewer")}</span>{[0, 1, 2, 3, 4].map((level) => <i key={level} className={`level-${level}`} />)}<span>{t("more")}</span></div>
    </section>
  );
}

function ProgressPage({ languages, selectedId, onSelect, onStartReview }: {
  languages: LanguageInfo[];
  selectedId: LanguageId;
  onSelect: (id: LanguageId) => void;
  onStartReview: (id: LanguageId) => void;
}) {
  const { t } = useUi();
  const language = languages.find((item) => item.id === selectedId)!;
  const journey = getLanguageJourney(language.learned);
  const remaining = journey.next ? Math.max(0, journey.next.cards - language.learned) : 0;
  return (
    <div className={`utility-page progress-page content-page theme-${language.color}`}>
      <header className="utility-header"><div><p>{t("progressPath").toUpperCase()}</p><h1>{t("languageJourney")}</h1><span>{t("eachCard")}</span></div></header>
      <div className="progress-language-tabs">
        {languages.map((item) => <button key={item.id} className={item.id === selectedId ? "selected" : ""} onClick={() => onSelect(item.id)}><span>{item.flag}</span>{item.name}</button>)}
      </div>
      <section className="progress-hero-card surface">
        <div className="progress-level-badge"><small>{t("yourLevel").toUpperCase()}</small><strong>{journey.current.label}</strong></div>
        <div className="progress-hero-copy"><span>{language.flag} {language.name}</span><h2>{t(milestoneTitleKey(journey.current.label))}</h2><p>{journey.next ? t("cardsUntil", { count: remaining, level: journey.next.label }) : t("highestLevel")}</p><div className="journey-progress"><i style={{ width: `${journey.progress}%` }} /></div><small>{t("cardsLearned", { count: language.learned })}</small></div>
        <button className="primary-button compact" onClick={() => onStartReview(language.id)}>{t("continueLearning")} <ArrowRight size={17} /></button>
      </section>
      <section className="milestone-path surface">
        <div className="milestone-track" aria-hidden="true"><i style={{ width: `${Math.min(100, (languageMilestones.findIndex((item) => item.label === journey.current.label) / (languageMilestones.length - 1)) * 100 + journey.progress / (languageMilestones.length - 1))}%` }} /></div>
        <div className="milestone-nodes">
          {languageMilestones.map((milestone) => {
            const completed = language.learned >= milestone.cards;
            const current = milestone.label === journey.current.label;
            return <div className={`milestone ${completed ? "completed" : "locked"} ${current ? "current" : ""}`} key={milestone.label}><span>{completed ? <Flag size={18} /> : milestone.label}</span><strong>{milestone.label}</strong><h3>{t(milestoneTitleKey(milestone.label))}</h3><p>{t(`milestone${languageMilestones.indexOf(milestone)}`)}</p><small>{milestone.cards.toLocaleString()} {t("cards")}</small></div>;
          })}
        </div>
      </section>
      <div className="progress-facts"><div className="surface"><BookOpen size={19} /><span><strong>{language.learned}</strong><small>{t("learned")}</small></span></div><div className="surface"><Layers3 size={19} /><span><strong>{language.total}</strong><small>{t("inDeck")}</small></span></div><div className="surface"><Clock3 size={19} /><span><strong>{language.due}</strong><small>{t("dueToday")}</small></span></div></div>
    </div>
  );
}

function LanguagePage({
  language,
  isActive,
  onBack,
  onActivate,
  onStartReview,
}: {
  language: LanguageInfo;
  isActive: boolean;
  onBack: () => void;
  onActivate: () => void;
  onStartReview: () => void;
}) {
  return (
    <div className={`detail-page language-page content-page theme-${language.color}`}>
      <header className="detail-header">
        <button className="back-button" onClick={onBack}><ArrowLeft size={18} /> Übersicht</button>
        <div className="detail-header-actions">
          <button className="primary-button compact" onClick={onStartReview}>Review starten<ArrowRight size={17} /></button>
        </div>
      </header>

      <section className="language-hero surface">
        <div className="hero-identity">
          <span className="hero-flag">{language.flag}</span>
          <div><p>DEIN FORTSCHRITT</p><h1>{language.name}</h1><span>Level {language.level}</span></div>
        </div>
        <div className="hero-progress">
          <div className="progress-ring" style={{ "--progress": `${language.progress * 3.6}deg` } as React.CSSProperties}>
            <span><strong>{language.progress}%</strong><small>gesamt</small></span>
          </div>
          <div className="hero-progress-copy"><strong>{language.learned} Karten gelernt</strong><p>Das Sprachlevel wird aus deinem tatsächlichen Anki-Lernstand berechnet.</p></div>
        </div>
      </section>

      <section className="language-stats-grid">
        <div className="mini-stat surface"><span className="stat-icon"><BookOpen size={21} /></span><div><strong>{language.due}</strong><small>heute fällig</small></div></div>
        <div className="mini-stat surface"><span className="stat-icon"><CalendarDays size={21} /></span><div><strong>{language.activeDays}</strong><small>aktive Tage diese Woche</small></div></div>
        <div className="mini-stat surface"><span className="stat-icon"><Trophy size={21} /></span><div><strong>{language.learned}</strong><small>Karten im Stapel</small></div></div>
      </section>

      <section className="topics-card surface">
        <div className="section-heading"><h2>Bereiche</h2><span>{language.topics.length} Unterstapel</span></div>
        <div className="topic-list">
          {language.topics.map((topic) => (
            <div className="topic-row" key={topic.name}>
              <div className="topic-copy"><strong>{topic.name}</strong><small>{topic.detail}</small></div>
              <div className="topic-progress"><div className="progress-track"><i style={{ width: `${topic.progress}%` }} /></div><span>{topic.progress}%</span></div>
              <ChevronRight size={18} />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function StreakPage({ onBack, reviewHistory, streak }: { onBack: () => void; reviewHistory: Array<[string, number]>; streak: number }) {
  const { t, locale } = useUi();
  const [view, setView] = useState<"week" | "month" | "year">("month");
  const days = getHeatmapDays(view, reviewHistory, locale);
  const total = days.reduce((sum, day) => sum + day.count, 0);
  const activeDays = reviewHistory.filter(([, count]) => count > 0).length;
  const freezes = Math.min(2, Math.floor(activeDays / 7));
  return (
    <div className="detail-page streak-page content-page">
      <header className="detail-header"><button className="back-button" onClick={onBack}><ArrowLeft size={18} /> {t("overview")}</button></header>
      <section className="heatmap-hero surface">
        <span className="big-flame"><Flame size={39} fill="currentColor" /></span><div><small>{t("currentStreak").toUpperCase()}</small><strong>{streak}</strong><p>{streak === 1 ? t("day") : t("days")}</p></div>
        <div className="heatmap-summary"><span><strong>{total}</strong><small>{t("reviewsPeriod")}</small></span><span><strong>{days.filter((day) => day.count > 0).length}</strong><small>{t("activeDays")}</small></span><span className="freeze-inline"><Snowflake size={16} /><strong>{freezes}/2</strong><small>{freezes === 1 ? t("freezeReady") : t("freezesReady")}</small></span></div>
      </section>
      <section className="heatmap-panel surface">
        <div className="heatmap-panel-header"><div><h1>{t("learningActivity")}</h1><p>{view === "week" ? t("lastWeek") : view === "month" ? t("lastMonth") : t("lastYear")}</p></div><div className="heatmap-switch"><button className={view === "week" ? "active" : ""} onClick={() => setView("week")}>{t("week")}</button><button className={view === "month" ? "active" : ""} onClick={() => setView("month")}>{t("month")}</button><button className={view === "year" ? "active" : ""} onClick={() => setView("year")}>{t("year")}</button></div></div>
        <div className={`activity-heatmap view-${view}`}>
          {days.map((day) => <div key={day.date} className={`heat-cell level-${heatLevel(day.count)}`} title={`${formatHeatDate(day.date, locale)} · ${day.count} Reviews`}><i />{view !== "year" && <span>{view === "week" ? day.weekday : day.day}</span>}</div>)}
        </div>
        <div className="heat-legend"><span>{t("fewer")}</span>{[0, 1, 2, 3, 4].map((level) => <i key={level} className={`level-${level}`} />)}<span>{t("more")}</span></div>
      </section>
    </div>
  );
}

function ReviewSetupPage({ languages, activeLanguageId, onSelectLanguage, onStart }: {
  languages: LanguageInfo[];
  activeLanguageId: LanguageId;
  onSelectLanguage: (id: LanguageId) => void;
  onStart: (id: LanguageId) => void;
}) {
  const { t } = useUi();
  const selected = languages.find((language) => language.id === activeLanguageId)!;
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (["ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight"].includes(event.key)) {
        event.preventDefault();
        const direction = event.key === "ArrowUp" || event.key === "ArrowLeft" ? -1 : 1;
        const current = languages.findIndex((language) => language.id === activeLanguageId);
        onSelectLanguage(languages[(current + direction + languages.length) % languages.length].id);
        return;
      }
      if (event.key !== "Enter" || event.repeat) return;
      event.preventDefault();
      const target = event.target instanceof HTMLElement ? event.target.closest<HTMLButtonElement>(".review-deck-choice") : null;
      const languageId = (target?.dataset.languageId as LanguageId | undefined) ?? selected.id;
      onStart(languageId);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeLanguageId, languages, onSelectLanguage, onStart, selected.id]);
  return (
    <div className="utility-page review-setup-page content-page">
      <header className="utility-header"><div><p>{t("review").toUpperCase()}</p><h1>{t("chooseReview")}</h1></div></header>
      <div className="review-deck-choices">
        {languages.map((language) => <button key={language.id} data-language-id={language.id} className={`review-deck-choice theme-${language.color} ${language.id === activeLanguageId ? "selected" : ""}`} onClick={() => onSelectLanguage(language.id)}><span>{language.flag}</span><div><strong>{language.name}</strong><small>{t("cardsLearned", { count: language.learned })}</small></div><b>{language.due}</b><ChevronRight size={18} /></button>)}
      </div>
      <section className="review-launch surface">
        <span className="launch-flag">{selected.flag}</span><div><small>{t("dueToday").toUpperCase()}</small><strong>{selected.due}</strong><p>{selected.name}</p></div><button className="primary-button" onClick={() => onStart(selected.id)}>{selected.due ? t("startReview") : t("viewDeck")}<ArrowRight size={18} /></button>
      </section>
    </div>
  );
}

function ReviewView({
  index,
  revealed,
  completed,
  cards,
  language,
  deckName,
  ankiCard,
  usesAnki,
  loading,
  error,
  total,
  settings,
  onSettingsChange,
  onReveal,
  onRate,
  undoDepth,
  onUndo,
  onExit,
  onRetry,
}: {
  index: number;
  revealed: boolean;
  completed: number;
  cards: ReviewCard[];
  language: LanguageInfo;
  deckName: string;
  ankiCard: AnkiCard | null;
  usesAnki: boolean;
  loading: boolean;
  error: string;
  total: number;
  settings: AppSettings;
  onSettingsChange: (settings: AppSettings) => void;
  onReveal: () => void;
  onRate: (rating: Rating) => void | Promise<void>;
  undoDepth: number;
  onUndo: () => void;
  onExit: () => void;
  onRetry: () => void;
}) {
  const { t } = useUi();
  const [feedback, setFeedback] = useState<Rating | null>(null);
  const [transitioning, setTransitioning] = useState(false);
  const [typedAnswer, setTypedAnswer] = useState("");
  const [requestingMic, setRequestingMic] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordedUrl, setRecordedUrl] = useState("");
  const [recordingError, setRecordingError] = useState("");
  const [milestoneSeen, setMilestoneSeen] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const audioGenerationRef = useRef(0);
  const autoPlayedSideRef = useRef<{ card: AnkiCard; side: "front" | "back" } | null>(null);
  const currentCardRef = useRef<AnkiCard | null>(ankiCard);
  currentCardRef.current = ankiCard;
  const card = cards[index];
  const presentation = useMemo(() => ankiCard ? deriveCardPresentation(ankiCard, language.id, t) : null, [ankiCard, language.id, t]);
  const activeAudioFields = revealed ? presentation?.answerAudioFields : presentation?.audioFields;
  const canPracticePronunciation = ankiCard ? Boolean(presentation?.targetOnBack) : true;
  const hasSolutionAudio = Boolean(ankiCard && presentation && audioFilesFromCard(ankiCard, presentation.answerAudioFields).length);
  const finished = usesAnki ? !loading && !ankiCard && completed > 0 && !error : completed === cards.length;
  const empty = usesAnki && !loading && !ankiCard && completed === 0 && !error;
  const displayedTotal = usesAnki ? Math.max(total, completed + (ankiCard ? 1 : 0)) : cards.length;
  const progress = finished ? 100 : usesAnki ? (completed / Math.max(1, displayedTotal)) * 100 : (index / cards.length) * 100;
  const milestoneDue = completed > 0 && completed % 10 === 0 && completed !== milestoneSeen && !finished;
  const nextReviews = ankiCard?.nextReviews ?? [];
  const ratings = useMemo(() => [
    { name: "Again" as Rating, label: t("again"), shortcut: "1", interval: nextReviews[0] || "1 Min.", className: "again" },
    { name: "Hard" as Rating, label: t("hard"), shortcut: "2", interval: nextReviews[1] || "6 Min.", className: "hard" },
    { name: "Good" as Rating, label: t("good"), shortcut: "3", interval: nextReviews[2] || "10 Min.", className: "good" },
    { name: "Easy" as Rating, label: t("easy"), shortcut: "4", interval: nextReviews[3] || "4 Tage", className: "easy" },
  ], [nextReviews.join("|"), t]);

  const stopRecording = () => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
  };

  const startRecording = async () => {
    setRecordingError("");
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setRecordingError(t("micUnavailable"));
      return;
    }
    try {
      setRequestingMic(true);
      if (recordedUrl) URL.revokeObjectURL(recordedUrl);
      setRecordedUrl("");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      setRequestingMic(false);
      recordingStreamRef.current = stream;
      recordingChunksRef.current = [];
      const candidates = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm"];
      const mimeType = candidates.find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => { if (event.data.size) recordingChunksRef.current.push(event.data); };
      recorder.onstop = () => {
        const blob = new Blob(recordingChunksRef.current, { type: recorder.mimeType || mimeType || "audio/webm" });
        if (blob.size) setRecordedUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((track) => track.stop());
        recordingStreamRef.current = null;
        recorderRef.current = null;
        setRecording(false);
      };
      recorder.start(100);
      setRecording(true);
    } catch (error) {
      setRequestingMic(false);
      recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
      recordingStreamRef.current = null;
      setRecording(false);
      setRecordingError(error instanceof DOMException && (error.name === "NotAllowedError" || error.name === "SecurityError") ? t("micDenied") : t("micUnavailable"));
    }
  };

  const playRecording = () => { if (recordedUrl) void new Audio(recordedUrl).play(); };
  const playCurrentCardAudio = (card: AnkiCard, fields: string[]) => {
    const generation = audioGenerationRef.current;
    return playAnkiAudio(card, fields, () => audioGenerationRef.current === generation && currentCardRef.current === card);
  };
  const recordControl = canPracticePronunciation ? <button className={`pronunciation-button record-inline ${recording ? "recording" : ""}`} disabled={requestingMic} onClick={recording ? stopRecording : () => void startRecording()}>{recording ? <Square size={16} fill="currentColor" /> : <Mic size={18} />}{requestingMic ? t("openingMic") : recording ? t("stopRecording") : recordedUrl ? t("rerecord") : t("record")}{recording && <i />}</button> : null;
  const comparisonControls = canPracticePronunciation ? <div className="pronunciation-tools comparison-tools">{recordedUrl && <button className="pronunciation-button mine" onClick={playRecording}><Play size={17} fill="currentColor" />{t("playMine")}</button>}{hasSolutionAudio && <button className="pronunciation-button solution" onClick={() => ankiCard && presentation ? void playCurrentCardAudio(ankiCard, presentation.answerAudioFields) : undefined}><Volume2 size={18} />{t("playSolution")}</button>}{recordingError && <small>{recordingError}</small>}</div> : null;

  const handleReveal = () => {
    if (revealed || transitioning || loading) return;
    if (recording) stopRecording();
    playFeedbackSound("reveal", settings.soundEffects);
    onReveal();
  };

  const handleRate = (rating: Rating) => {
    if (!revealed || transitioning || loading) return;
    setTransitioning(true);
    setFeedback(rating);
    playFeedbackSound(rating, settings.soundEffects);
    stopAnkiAudio();
    setTypedAnswer("");
    setRecordingError("");
    setRecordedUrl((url) => { if (url) URL.revokeObjectURL(url); return ""; });
    if (recorderRef.current?.state !== "inactive") recorderRef.current?.stop();
    recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
    void onRate(rating);
    window.setTimeout(() => {
      setFeedback(null);
      setTransitioning(false);
    }, 150);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const editing = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement;
      if (event.key === "Escape") onExit();
      if (!editing && undoDepth > 0 && event.metaKey && event.key.toLowerCase() === "z") {
        event.preventDefault();
        onUndo();
        return;
      }
      if (milestoneDue && event.key === "Enter") {
        event.preventDefault();
        setMilestoneSeen(completed);
        return;
      }
      if (((event.key === " " && !editing) || event.key === "Enter") && !revealed) {
        event.preventDefault();
        handleReveal();
      }
      if (revealed && ["1", "2", "3", "4"].includes(event.key)) {
        handleRate((['Again', 'Hard', 'Good', 'Easy'] as Rating[])[Number(event.key) - 1]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [revealed, transitioning, loading, index, settings.soundEffects, milestoneDue, completed, undoDepth, onUndo]);

  useEffect(() => {
    if (finished) playFeedbackSound("complete", settings.soundEffects);
  }, [finished]);

  useEffect(() => {
    if (completed === 0) setMilestoneSeen(0);
    if (milestoneDue) playFeedbackSound("complete", settings.soundEffects);
  }, [completed, milestoneDue, settings.soundEffects]);

  useEffect(() => {
    audioGenerationRef.current += 1;
    stopAnkiAudio();
    setTypedAnswer("");
    setRecordingError("");
    setRecordedUrl((url) => { if (url) URL.revokeObjectURL(url); return ""; });
    if (recorderRef.current?.state !== "inactive") recorderRef.current?.stop();
    recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
  }, [ankiCard, index]);

  useEffect(() => () => {
    if (recorderRef.current?.state !== "inactive") recorderRef.current?.stop();
    recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
  }, [recordedUrl]);

  useEffect(() => {
    if (!ankiCard || !presentation || !settings.autoPlayAudio || loading || milestoneDue) return;
    const side = revealed ? "back" : "front";
    if (revealed && !presentation.targetOnBack) return;
    const fields = revealed ? presentation.answerAudioFields : presentation.audioFields;
    if (!audioFilesFromCard(ankiCard, fields).length) return;
    if (autoPlayedSideRef.current?.card === ankiCard && autoPlayedSideRef.current.side === side) return;
    autoPlayedSideRef.current = { card: ankiCard, side };
    void playCurrentCardAudio(ankiCard, fields);
  }, [ankiCard, presentation, revealed, settings.autoPlayAudio, loading, milestoneDue]);

  useEffect(() => {
    if (!ankiCard || !presentation) return;
    void preloadAnkiAudio(ankiCard, presentation.audioFields);
    void preloadAnkiAudio(ankiCard, presentation.answerAudioFields);
  }, [ankiCard, presentation]);

  return (
    <div className={`review-view accent-${language.color}`}>
      <header className="review-header">
        <div className="review-header-left">
          <button className="exit-review" onClick={onExit}><X size={21} /><span>{t("endReview")}</span></button>
          <button className="undo-review" disabled={!undoDepth || loading} onClick={onUndo} title={t("undoLastReview")} aria-label={t("undoLastReview")}><ArrowLeft size={19} /></button>
        </div>
        <div className="review-progress"><i style={{ width: `${progress}%` }} /></div>
        <div className="review-header-right">
          <button className="sound-toggle" onClick={() => onSettingsChange({ ...settings, soundEffects: !settings.soundEffects })} aria-label={settings.soundEffects ? t("soundOff") : t("soundOn")}>{settings.soundEffects ? <Volume2 size={17} /> : <VolumeX size={17} />}</button>
          <span className="review-count">{finished ? displayedTotal : Math.min(completed + 1, displayedTotal)} / {displayedTotal}</span>
        </div>
      </header>
      <main className="review-stage">
        {loading && !ankiCard ? (
          <div className="review-state-card"><span className="loading-orbit" /><h1>{t("preparing")}</h1><p>{t("loadingDeck")}</p></div>
        ) : error ? (
          <div className="review-state-card error-state"><span><RotateCcw size={28} /></span><h1>{t("connectionLost")}</h1><p>{error}</p><button className="primary-button" onClick={onRetry}>{t("retry")} <ArrowRight size={18} /></button></div>
        ) : empty ? (
          <div className="review-state-card empty-state"><span><Check size={29} /></span><h1>{t("nothingDue")}</h1><p>{t("emptyDeck", { language: language.name })}</p><button className="primary-button" onClick={onExit}>{t("backOverview")} <ArrowRight size={18} /></button></div>
        ) : finished ? (
          <div className="completion-card">
            <div className="completion-sparkle one">✦</div><div className="completion-sparkle two">✦</div>
            <span><Check size={34} /></span>
            <h1>{t("finished")}</h1>
            <p>{t("completed", { count: completed, language: language.name })}</p>
            <button className="primary-button" onClick={onExit}>{t("backOverview")} <ArrowRight size={18} /></button>
          </div>
        ) : milestoneDue ? (
          <div className="review-milestone-card">
            <div className="milestone-rays" aria-hidden="true"><i /><i /><i /><i /><i /><i /></div>
            <span className="milestone-trophy"><Trophy size={38} /></span>
            <small>{t("milestoneCards", { count: completed })}</small>
            <h1>{t("reviewMilestoneTitle")}</h1>
            <p>{t("reviewMilestoneBody")}</p>
            <button className="primary-button" onClick={() => setMilestoneSeen(completed)}>{t("keepGoing")} <ArrowRight size={18} /></button>
          </div>
        ) : (
          <>
            <div className="flashcard-wrap">
              <div key={`${language.id}-${ankiCard?.cardId ?? index}`} className={`flashcard ${revealed ? "revealed" : ""} ${loading ? "card-loading" : ""}`}>
                <div className="flashcard-topline">
                  <div className="review-language"><span>{language.flag}</span>{language.name}</div>
                  <span className="deck-path">{ankiCard ? formatDeckPath(ankiCard.deckName, deckName) : card.deck}</span>
                  <button
                    className={ankiCard && !audioFilesFromCard(ankiCard, activeAudioFields ?? []).length ? "audio-unavailable" : ""}
                    aria-label={t("playCardAudio")}
                    title={ankiCard && !audioFilesFromCard(ankiCard, activeAudioFields ?? []).length ? t("noCardAudio") : t("playCardAudio")}
                    onClick={() => ankiCard ? void playCurrentCardAudio(ankiCard, activeAudioFields ?? []) : playFeedbackSound("audio", settings.soundEffects)}
                  ><Volume2 size={20} /></button>
                </div>
                <div className="flashcard-body">
                  {ankiCard ? (
                    <AppOwnedCard presentation={presentation!} revealed={revealed} typedAnswer={typedAnswer} onType={setTypedAnswer} recordControl={recordControl} comparisonControls={comparisonControls} recordingError={recordingError} />
                  ) : (
                    <>
                      <p className="eyebrow">{card.eyebrow}</p>
                      <h1>{card.prompt}</h1>
                      {!revealed && <label className="type-answer"><div className="type-answer-row"><input value={typedAnswer} onChange={(event) => setTypedAnswer(event.target.value)} autoComplete="off" spellCheck={false} placeholder={t("typeAnswer")} aria-label={t("yourAnswer")} />{recordControl}</div>{recordingError && <small className="recording-error">{recordingError}</small>}</label>}
                      {revealed && (
                        <div className="answer-area">
                          <div className="answer-divider" />
                          <p className="answer">{card.answer}</p>
                          <p className="answer-note">{card.note}</p>
                          {comparisonControls}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
              {feedback && <div className={`rating-flash ${feedback.toLowerCase()}`}>{feedback === "Good" || feedback === "Easy" ? <Sparkles size={17} /> : null}{feedback}</div>}
            </div>
            <div className="review-actions">
              {!revealed ? (
                <button className="show-answer" onClick={handleReveal}>{t("showAnswer")}</button>
              ) : (
                <div className="rating-grid">
                  {ratings.map((rating) => (
                    <button disabled={transitioning || loading} className={`rating-button ${rating.className}`} key={rating.name} onClick={() => handleRate(rating.name)}>
                      <span>{rating.label}</span><small>{rating.interval}</small>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

type CardFieldBlock = { label?: string; html: string; emphasis?: "main" | "secondary" | "example" };
type CardPresentation = {
  kicker: string;
  prompt: CardFieldBlock[];
  answer: CardFieldBlock[];
  inputTarget?: string;
  inputLabel?: string;
  audioFields: string[];
  answerAudioFields: string[];
  targetOnBack: boolean;
};

function AppOwnedCard({ presentation, revealed, typedAnswer, onType, recordControl, comparisonControls, recordingError }: { presentation: CardPresentation; revealed: boolean; typedAnswer: string; onType: (value: string) => void; recordControl?: ReactNode; comparisonControls?: ReactNode; recordingError?: string }) {
  const { t } = useUi();
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (!revealed && presentation.inputTarget) inputRef.current?.focus(); }, [presentation.inputTarget, revealed]);
  const matches = presentation.inputTarget ? normalizeAnswer(typedAnswer) === normalizeAnswer(presentation.inputTarget) : false;
  const answerDiff = useMemo(() => compareAnswers(typedAnswer, presentation.inputTarget || ""), [typedAnswer, presentation.inputTarget]);
  return (
    <div className="app-card-content">
      <div className="anki-prompt-fields">{presentation.prompt.map((block, index) => <CardField key={`${block.label}-${index}`} block={block} />)}</div>
      {!revealed && presentation.inputTarget && (
        <label className="type-answer"><div className="type-answer-row"><input ref={inputRef} value={typedAnswer} onChange={(event) => onType(event.target.value)} autoComplete="off" autoCapitalize="none" spellCheck={false} placeholder={t("typeAnswer")} aria-label={presentation.inputLabel || t("yourAnswer")} />{presentation.targetOnBack && recordControl}</div>{recordingError && <small className="recording-error">{recordingError}</small>}</label>
      )}
      {revealed && (
        <div className="anki-answer-area">
          {presentation.inputTarget && (
            <div className={`typed-result ${matches ? "match" : "different"}`}>
              <div className="typed-result-heading"><span>{matches ? t("answerCorrect") : t("answerDifference")}</span>{matches && <Check size={16} />}</div>
              <AnswerDiffLine label={t("yourInput")} parts={answerDiff.actual} emptyLabel={t("noInput")} tone="actual" />
              {!matches && <AnswerDiffLine label={t("correctAnswer")} parts={answerDiff.expected} tone="expected" />}
            </div>
          )}
          <div className="answer-divider" />
          <div className="anki-answer-fields">{presentation.answer.map((block, index) => <CardField key={`${block.label}-${index}`} block={block} />)}</div>
          {presentation.targetOnBack && comparisonControls}
        </div>
      )}
    </div>
  );
}

type AnswerDiffPart = { text: string; kind: "same" | "wrong" | "missing" | "extra" | "placeholder" };

function AnswerDiffLine({ label, parts, emptyLabel, tone }: { label: string; parts: AnswerDiffPart[]; emptyLabel?: string; tone: "actual" | "expected" }) {
  return <div className={`answer-diff-line ${tone}`}><span>{label}</span><strong>{parts.length ? parts.map((part, index) => <mark className={part.kind} key={`${index}-${part.text}`}>{part.text}</mark>) : <em>{emptyLabel}</em>}</strong></div>;
}

function compareAnswers(actualValue: string, expectedValue: string) {
  const actual = Array.from(normalizeAnswer(actualValue));
  const expected = Array.from(normalizeAnswer(expectedValue));
  const costs = Array.from({ length: actual.length + 1 }, () => Array(expected.length + 1).fill(0));
  for (let i = 0; i <= actual.length; i += 1) costs[i][0] = i;
  for (let j = 0; j <= expected.length; j += 1) costs[0][j] = j;
  for (let i = 1; i <= actual.length; i += 1) {
    for (let j = 1; j <= expected.length; j += 1) {
      costs[i][j] = actual[i - 1] === expected[j - 1]
        ? costs[i - 1][j - 1]
        : Math.min(costs[i - 1][j - 1], costs[i - 1][j], costs[i][j - 1]) + 1;
    }
  }
  const aligned: Array<{ actual?: string; expected?: string; same: boolean }> = [];
  let i = actual.length;
  let j = expected.length;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && actual[i - 1] === expected[j - 1]) {
      aligned.push({ actual: actual[--i], expected: expected[--j], same: true });
    } else if (i > 0 && j > 0 && costs[i][j] === costs[i - 1][j - 1] + 1) {
      aligned.push({ actual: actual[--i], expected: expected[--j], same: false });
    } else if (i > 0 && costs[i][j] === costs[i - 1][j] + 1) {
      aligned.push({ actual: actual[--i], same: false });
    } else {
      aligned.push({ expected: expected[--j], same: false });
    }
  }
  aligned.reverse();
  return {
    actual: actual.length ? aligned.flatMap((item): AnswerDiffPart[] => item.actual
      ? [{ text: item.actual, kind: item.same ? "same" : item.expected ? "wrong" : "extra" }]
      : []) : [],
    expected: aligned.flatMap((item): AnswerDiffPart[] => item.expected
      ? [{ text: item.expected, kind: item.same ? "same" : "missing" }]
      : []),
  };
}

function CardField({ block }: { block: CardFieldBlock }) {
  const [html, setHtml] = useState(cleanFieldHtml(block.html));
  useEffect(() => {
    let active = true;
    const clean = cleanFieldHtml(block.html);
    setHtml(clean);
    void enrichAnkiHtml(clean).then((value) => { if (active) setHtml(value); });
    return () => { active = false; };
  }, [block.html]);
  if (!plainText(html) && !/<(?:img|table|video|svg)\b/i.test(html)) return null;
  return <div className={`anki-field ${block.emphasis || "secondary"}`}>{block.label && <small>{block.label}</small>}<div dangerouslySetInnerHTML={{ __html: html }} /></div>;
}

function deriveCardPresentation(card: AnkiCard, languageId: LanguageId, t: Translator): CardPresentation {
  const get = (name: string) => card.fields[name]?.value || "";
  const model = card.modelName.toLowerCase();
  const template = (card.template || "").toLowerCase();
  const block = (html: string, label?: string, emphasis: CardFieldBlock["emphasis"] = "secondary"): CardFieldBlock => ({ html, label, emphasis });

  if (languageId === "finnish" && get("Finnish")) {
    const reverseCard = card.ord === 1 || card.fieldOrder === 1 || template.includes("card 2") || template.includes("karte 2") || template.includes("english");
    const finnish = get("Finnish");
    const glossing = get("Glossing");
    const english = get("English");
    if (reverseCard) {
      return {
        kicker: "ENGLISH → FINNISH",
        prompt: [block(english, undefined, "main")],
        answer: [block(finnish, "Suomi", "main"), ...(plainText(glossing) ? [block(glossing, "Glossing")] : [])],
        inputTarget: plainText(finnish),
        inputLabel: "Finnische Antwort",
        audioFields: [],
        answerAudioFields: ["Audio"],
        targetOnBack: true,
      };
    }
    return {
      kicker: "FINNISH → ENGLISH",
      prompt: [block(finnish, undefined, "main"), ...(plainText(glossing) ? [block(glossing, "Glossing")] : [])],
      answer: [block(english, "English", "main")],
      inputTarget: plainText(english),
      inputLabel: "Englische Antwort",
      audioFields: ["Audio"],
      answerAudioFields: ["Audio"],
      targetOnBack: false,
    };
  }

  if (model.includes("züridütsch sentence")) {
    const swissGerman = get("SwissGerman");
    return {
      kicker: "SCHWEIZERDEUTSCH",
      prompt: [block(get("Front") || get("German"), undefined, "main")],
      answer: [block(swissGerman, "Schweizerdeutsch", "main")],
      inputTarget: plainText(swissGerman),
      inputLabel: t("answer"),
      // The recording belongs to the Swiss-German solution, so it must remain
      // silent while the German prompt is visible.
      audioFields: [],
      answerAudioFields: ["Audio"],
      targetOnBack: true,
    };
  }

  if (model.includes("cantonese vocabulary")) {
    const examples: CardFieldBlock[] = [1, 2, 3].flatMap((number) => {
      const chinese = get(`Sentence ${number} Chinese`);
      if (!plainText(chinese)) return [];
      return [block(`${chinese}<br><span>${get(`Sentence ${number} Jyutping`)}</span><br><small>${get(`Sentence ${number} Definition`)}</small>`, number === 1 ? t("examples") : undefined, "example")];
    });
    const mnemonic = get("mnemonic") || get("Mnemonic");
    const answerExtras = [
      ...(hasRenderableField(mnemonic) ? [block(mnemonic, t("mnemonic"))] : []),
      ...examples,
    ];
    const reverseCard = card.ord === 1 || card.fieldOrder === 1 || template.includes("card 2") || template.includes("karte 2");
    if (reverseCard) {
      return {
        kicker: "ENGLISH → CANTONESE",
        prompt: [block(get("Definition"), undefined, "main")],
        answer: [block(get("Chinese"), "中文", "main"), block(get("Jyutping"), "Jyutping"), ...answerExtras],
        inputTarget: plainText(get("Jyutping")),
        inputLabel: t("enterJyutping"),
        audioFields: [],
        answerAudioFields: ["Audio"],
        targetOnBack: true,
      };
    }
    return {
      kicker: "CANTONESE → ENGLISH",
      prompt: [block(get("Chinese"), undefined, "main")],
      answer: [block(get("Jyutping"), "Jyutping", "main"), block(get("Definition"), t("meaning")), ...answerExtras],
      inputTarget: plainText(get("Jyutping")),
      inputLabel: t("enterJyutping"),
      audioFields: ["Audio"],
      answerAudioFields: ["Audio"],
      targetOnBack: false,
    };
  }

  if (model.includes("ltl note type")) {
    return {
      kicker: t("translateType").toUpperCase(),
      prompt: [block(get("Back"), undefined, "main")],
      answer: [block(get("Front"), "Français", "main"), ...(plainText(get("Pinyin")) ? [block(get("Pinyin"), t("pronunciation"))] : [])],
      inputTarget: plainText(get("Front")),
      inputLabel: t("frenchAnswer"),
      audioFields: ["Eng Audio", "Audio"],
      answerAudioFields: ["Audio", "Eng Audio"],
      targetOnBack: true,
    };
  }

  if (model.includes("sentences speak")) return { kicker: t("speakTranslate").toUpperCase(), prompt: [block(get("Back"), undefined, "main")], answer: [block(get("Front"), "Français", "main")], inputTarget: plainText(get("Front")), inputLabel: t("frenchAnswer"), audioFields: [], answerAudioFields: [], targetOnBack: true };
  if (model.includes("sentences read")) return { kicker: t("readUnderstand").toUpperCase(), prompt: [block(get("Front"), undefined, "main")], answer: [block(get("Back"), t("meaning"), "main")], audioFields: [], answerAudioFields: [], targetOnBack: false };
  if (model.includes("ear training")) return { kicker: t("listening").toUpperCase(), prompt: [block(get("Front"), undefined, "main")], answer: [block(get("Back"), t("answer"), "main"), block(get("3"), undefined, "secondary")], audioFields: ["Front"], answerAudioFields: ["Front"], targetOnBack: false };
  if (model.includes("french verbs")) return { kicker: t("verbs").toUpperCase(), prompt: [block(get("1"), undefined, "main"), block(get("2"))], answer: [block(get("3"), t("answer"), "main"), block(get("4"))], inputTarget: plainText(get("3")), inputLabel: t("frenchAnswer"), audioFields: ["audio"], answerAudioFields: ["audio"], targetOnBack: true };
  if (model.includes("irregular pronunciation")) return { kicker: t("phonetics").toUpperCase(), prompt: [block(get("word"), undefined, "main")], answer: [block(get("ipa"), "IPA", "main"), block(get("meaning"), t("meaning"))], audioFields: ["audio"], answerAudioFields: ["audio"], targetOnBack: false };
  if (model.includes("aspirated h")) return { kicker: "H ASPIRÉ", prompt: [block(get("word"), undefined, "main")], answer: [block(get("word with article"), t("withArticle"), "main"), block(get("IPA"), "IPA"), block(get("translation"), t("meaning"))], audioFields: ["audio"], answerAudioFields: ["audio"], targetOnBack: false };
  if (model.includes("phonology")) return { kicker: t("sounds").toUpperCase(), prompt: [block(get("sample words (table)") || get("sample words"), undefined, "main")], answer: [block(get("phoneme"), t("phoneme"), "main"), block(get("sample words"), t("examples"))], audioFields: ["audio 1", "audio 2", "audio 3", "audio 4"], answerAudioFields: ["audio 1", "audio 2", "audio 3", "audio 4"], targetOnBack: false };

  const front = get("Front") || get("Vorderseite") || Object.values(card.fields)[0]?.value || "";
  const back = get("Back") || get("Rückseite") || Object.values(card.fields)[1]?.value || "";
  const needsTyping = model.includes("antwort eintippen") || model.includes("tippen");
  const targetOnBack = Boolean(plainText(back)) && (needsTyping || languageId === "swiss" || languageId === "cantonese" || model.includes("speak") || model.includes("production") || template.includes("card 2") || template.includes("karte 2"));
  return {
    kicker: languageId === "finnish" ? "SUOMI" : languageId === "french" ? "FRANÇAIS" : languageId === "cantonese" ? "GWONG2 DUNG1 WAA2" : "SCHWEIZERDEUTSCH",
    prompt: [block(front, undefined, "main")],
    answer: [block(back || t("answer"), t("answer"), "main")],
    inputTarget: targetOnBack ? plainText(back) : undefined,
    inputLabel: targetOnBack ? t("answer") : undefined,
    audioFields: targetOnBack ? [] : ["Audio", "audio"],
    answerAudioFields: ["Audio", "audio"],
    targetOnBack,
  };
}

function cleanFieldHtml(value: string) {
  return value
    .replace(/\[sound:[^\]]+\]/gi, "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/\s(?:style|class|id|on\w+)=("[^"]*"|'[^']*')/gi, "")
    .replace(/\[\[type:[^\]]+\]\]/gi, "")
    .replace(/\[anki:play:[^\]]+\]/gi, "")
    .trim();
}

function plainText(value: string) {
  const element = document.createElement("div");
  element.innerHTML = cleanFieldHtml(value);
  return (element.textContent || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function hasRenderableField(value: string) {
  return Boolean(plainText(value) || /<(?:img|picture|video|svg|table)\b/i.test(cleanFieldHtml(value)));
}

function normalizeAnswer(value: string) {
  return plainText(value).toLocaleLowerCase().normalize("NFKC").replace(/[.,!?;:。，！？]/g, "").replace(/\s+/g, " ").trim();
}

function formatDeckPath(deckName: string, parent: string) {
  const child = deckName.startsWith(`${parent}::`) ? deckName.slice(parent.length + 2) : "";
  return child ? child.replaceAll("::", " › ") : parent;
}

type BrowserMode = "cards" | "notes";
type BrowserStatus = "" | "is:due" | "is:new" | "-is:new" | "is:suspended";

function CardsPage({ languages, activeLanguageId, deckName }: { languages: LanguageInfo[]; activeLanguageId: LanguageId; deckName: string }) {
  const { t } = useUi();
  const [languageId, setLanguageId] = useState(activeLanguageId);
  const [mode, setMode] = useState<BrowserMode>("cards");
  const [status, setStatus] = useState<BrowserStatus>("");
  const [query, setQuery] = useState("");
  const [cards, setCards] = useState<AnkiCard[]>([]);
  const [notes, setNotes] = useState<AnkiNote[]>([]);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const searchInput = useRef<HTMLInputElement>(null);
  const language = languages.find((item) => item.id === languageId)!;
  const fullQuery = [query.trim(), status].filter(Boolean).join(" ");
  const items = mode === "cards" ? cards : notes;
  const selectedItem = items[selected];

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    const timer = window.setTimeout(async () => {
      try {
        if (mode === "cards") {
          const result = await searchAnkiCards(deckName, fullQuery);
          if (!cancelled) { setCards(result.items); setTotal(result.total); }
        } else {
          const result = await searchAnkiNotes(deckName, fullQuery);
          if (!cancelled) { setNotes(result.items); setTotal(result.total); }
        }
        if (!cancelled) setSelected(0);
      } catch (searchError) {
        if (!cancelled) setError(searchError instanceof Error ? searchError.message : String(searchError));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 260);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [languageId, mode, fullQuery, deckName]);

  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); searchInput.current?.focus(); }
    };
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);

  const itemFields = selectedItem ? Object.entries(selectedItem.fields).sort((a, b) => a[1].order - b[1].order) : [];
  const selectedNoteId = selectedItem ? (mode === "notes" ? (selectedItem as AnkiNote).noteId : (selectedItem as AnkiCard).note) : undefined;
  return (
    <div className={`utility-page cards-browser-page content-page theme-${language.color}`}>
      <header className="utility-header"><div><p>{t("cardCollection").toUpperCase()}</p><h1>{t("cardBrowser")}</h1><span>{t("browserSubtitle")}</span></div></header>
      <section className="browser-toolbar surface">
        <div className="browser-language-tabs">{languages.map((item) => <button key={item.id} className={languageId === item.id ? "active" : ""} onClick={() => setLanguageId(item.id)}><span>{item.flag}</span>{item.name}</button>)}</div>
        <div className="browser-search"><Search size={18} /><input ref={searchInput} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("searchCards")} /><kbd>⌘ K</kbd></div>
        <div className="browser-mode-switch"><button className={mode === "cards" ? "active" : ""} onClick={() => setMode("cards")}><BookOpen size={16} />{t("cards")}</button><button className={mode === "notes" ? "active" : ""} onClick={() => setMode("notes")}><Tags size={16} />{t("notes")}</button></div>
        <button className="secondary-button browser-open-anki" onClick={() => void openAnkiBrowser(deckName, fullQuery)}><ExternalLink size={15} />{t("openInAnki")}</button>
        <div className="browser-filters">{(["", "is:due", "is:new", "-is:new", "is:suspended"] as BrowserStatus[]).map((value) => <button className={status === value ? "active" : ""} key={value || "all"} onClick={() => setStatus(value)}>{t(value === "" ? "all" : value === "is:due" ? "due" : value === "is:new" ? "newCards" : value === "-is:new" ? "learned" : "suspended")}</button>)}</div>
      </section>
      <section className="browser-workspace surface">
        <div className="browser-results">
          <div className="browser-results-head"><strong>{loading ? t("searching") : t("results", { count: total })}</strong><span>{total > items.length ? t("showingFirst", { count: items.length }) : t("allShown")}</span></div>
          <div className="browser-list">
            {error && <div className="browser-empty"><CloudOff size={24} /><strong>{t("searchError")}</strong><span>{error}</span></div>}
            {!error && loading && <div className="browser-empty"><LoaderCircle className="spin" size={25} /><span>{t("searching")}</span></div>}
            {!error && !loading && !items.length && <div className="browser-empty"><Search size={25} /><strong>{t("noResults")}</strong><span>{t("trySearch")}</span></div>}
            {!loading && items.map((item, index) => {
              const fields = Object.entries(item.fields).sort((a, b) => a[1].order - b[1].order).map(([name, field]) => ({ name, value: plainText(field.value) })).filter((field) => field.value);
              const identity = mode === "cards" ? (item as AnkiCard).cardId : (item as AnkiNote).noteId;
              return <button className={`browser-result ${selected === index ? "selected" : ""}`} key={identity} onClick={() => setSelected(index)}><span className="result-kind">{mode === "cards" ? <BookOpen size={15} /> : <Tags size={15} />}</span><span className="result-copy"><strong>{fields[0]?.value || t("emptyCard")}</strong><small>{fields[1]?.value || item.modelName}</small><em>{item.modelName}</em></span><ChevronRight size={17} /></button>;
            })}
          </div>
        </div>
        <aside className="browser-inspector">
          {selectedItem ? <>
            <div className="inspector-head"><div><small>{mode === "cards" ? t("cardDetails") : t("noteDetails")}</small><h2>{selectedItem.modelName}</h2></div>{selectedNoteId && <button onClick={() => void editAnkiNote(selectedNoteId)}><ExternalLink size={15} />{t("editInAnki")}</button>}</div>
            {mode === "cards" && <div className="inspector-meta"><span>{formatDeckPath((selectedItem as AnkiCard).deckName, deckName)}</span><span>{t("interval")}: {formatInterval((selectedItem as AnkiCard).interval ?? 0, t)}</span><span>{t("reviews")}: {(selectedItem as AnkiCard).reps ?? 0}</span><span>{t("lapses")}: {(selectedItem as AnkiCard).lapses ?? 0}</span></div>}
            {mode === "notes" && <div className="inspector-tags">{((selectedItem as AnkiNote).tags || []).length ? (selectedItem as AnkiNote).tags.map((tag) => <span key={tag}>#{tag}</span>) : <span>{t("noTags")}</span>}</div>}
            <div className="inspector-fields">{itemFields.map(([name, field]) => <div key={name}><small>{name}</small><div dangerouslySetInnerHTML={{ __html: cleanFieldHtml(field.value) || `<span class="empty-field">${t("emptyField")}</span>` }} /></div>)}</div>
          </> : <div className="browser-empty"><BookOpen size={26} /><span>{t("selectResult")}</span></div>}
        </aside>
      </section>
    </div>
  );
}

function StatsPage({ languages, stats, reviewedToday, reviewHistory }: { languages: LanguageInfo[]; stats: LanguageStats; reviewedToday: number; reviewHistory: Array<[string, number]> }) {
  const { t, locale } = useUi();
  const totalDue = languages.reduce((sum, language) => sum + language.due, 0);
  const totalLearned = languages.reduce((sum, language) => sum + language.learned, 0);
  const history = getHeatmapDays("month", reviewHistory, locale).slice(-30);
  const maxReviews = Math.max(1, ...history.map((day) => day.count));
  const reviews30 = history.reduce((sum, day) => sum + day.count, 0);
  const active30 = history.filter((day) => day.count > 0).length;
  const average = active30 ? Math.round(reviews30 / active30) : 0;
  return (
    <div className="utility-page stats-page content-page">
      <header className="utility-header"><div><p>{t("learningOverview").toUpperCase()}</p><h1>{t("ankiStatistics")}</h1><span>{t("liveAnki")}</span></div></header>
      <section className="stats-summary-grid expanded">
        <div className="summary-panel surface"><span><Clock3 size={22} /></span><strong>{totalDue}</strong><small>{t("dueToday")}</small></div>
        <div className="summary-panel surface"><span><Check size={22} /></span><strong>{reviewedToday}</strong><small>{t("answeredToday")}</small></div>
        <div className="summary-panel surface"><span><BookOpen size={22} /></span><strong>{totalLearned}</strong><small>{t("learnedCards")}</small></div>
        <div className="summary-panel surface"><span><BarChart3 size={22} /></span><strong>{average}</strong><small>{t("averageActiveDay")}</small></div>
      </section>
      <section className="review-chart-panel surface">
        <div className="section-heading"><div><h2>{t("reviewsLast30")}</h2><span>{t("reviewChartSubtitle")}</span></div><strong>{reviews30}<small>{t("reviews")}</small></strong></div>
        <div className="review-bars">{history.map((day, index) => <div className="review-bar" key={day.date} title={`${formatHeatDate(day.date, locale)} · ${day.count}`}><i style={{ height: `${Math.max(day.count ? 7 : 2, (day.count / maxReviews) * 100)}%` }} /><span>{index % 5 === 0 ? day.day : ""}</span></div>)}</div>
      </section>
      <section className="language-stats-panel surface detailed">
        <div className="section-heading"><h2>{t("collectionStructure")}</h2><span>{t("languageDecksCount", { count: languages.length })}</span></div>
        <div className="language-stat-list">
          {languages.map((language) => {
            const values = stats[language.id];
            const known = Math.max(1, values.learned);
            return <div className={`language-stat-row detailed theme-${language.color}`} key={language.id}><span className="stat-language"><b>{language.flag}</b><span><strong>{language.name}</strong><small>{values.total.toLocaleString(locale)} {t("cardsOverall")}</small></span></span><div className="stat-distribution"><div><i className="mature" style={{ width: `${(values.mature / Math.max(1, values.total)) * 100}%` }} /><i className="young" style={{ width: `${(values.young / Math.max(1, values.total)) * 100}%` }} /><i className="new" style={{ width: `${(values.new / Math.max(1, values.total)) * 100}%` }} /></div><small>{Math.round((values.mature / known) * 100)}% {t("mature")}</small></div><div className="stat-category-grid"><span><strong>{values.new}</strong><small>{t("newCards")}</small></span><span><strong>{values.learning}</strong><small>{t("learning")}</small></span><span><strong>{values.young}</strong><small>{t("young")}</small></span><span><strong>{values.mature}</strong><small>{t("mature")}</small></span><span><strong>{values.suspended}</strong><small>{t("suspended")}</small></span><span><strong>{language.due}</strong><small>{t("due")}</small></span></div></div>;
          })}
        </div>
      </section>
    </div>
  );
}

function SettingsPage({ settings, onChange, onReconnect, onSync, ankiStatus, ankiError, syncStatus, syncError, deckNames, selectedDeck, onSelectDeck }: {
  settings: AppSettings;
  onChange: (settings: AppSettings) => void;
  onReconnect: () => void;
  onSync: () => void;
  ankiStatus: AnkiStatus;
  ankiError: string;
  syncStatus: SyncStatus;
  syncError: string;
  deckNames: string[];
  selectedDeck: string;
  onSelectDeck: (deck: string) => void;
}) {
  const { t } = useUi();
  const update = (key: keyof AppSettings, value: boolean) => onChange({ ...settings, [key]: value });
  return (
    <div className="utility-page settings-page content-page">
      <header className="utility-header"><div><p>{t("appSettings").toUpperCase()}</p><h1>{t("learningExperience")}</h1><span>{t("settingsLocal")}</span></div></header>
      <section className="settings-panel surface">
        <h2>{t("review")}</h2>
        <ToggleRow icon={Music2} title={t("pleasantSounds")} detail={t("pleasantSoundsDetail")} enabled={settings.soundEffects} onToggle={(value) => update("soundEffects", value)} />
        <ToggleRow icon={Volume2} title={t("autoplay")} detail={t("autoplayDetail")} enabled={settings.autoPlayAudio} onToggle={(value) => update("autoPlayAudio", value)} />
        <ToggleRow icon={Languages} title={t("immersiveUi")} detail={t("immersiveUiDetail")} enabled={settings.immersiveUi} onToggle={(value) => update("immersiveUi", value)} />
        <ToggleRow icon={Cloud} title={t("autoSync")} detail={t("autoSyncDetail")} enabled={settings.autoSync} onToggle={(value) => update("autoSync", value)} />
        <ToggleRow icon={Zap} title={t("reduceMotion")} detail={t("reduceMotionDetail")} enabled={settings.reducedMotion} onToggle={(value) => update("reducedMotion", value)} />
        <div className="setting-info-row"><span><Moon size={20} /></span><div><strong>{t("darkMode")}</strong><small>{t("darkModeDetail")}</small></div><b>{t("system")}</b></div>
      </section>
      <section className="deck-settings-panel surface">
        <span className="connection-icon connected"><Layers3 size={21} /></span>
        <div><h2>Finnisch-Stapel</h2><p>LinguaFlow verwendet diesen Anki-Stapel und alle darin enthaltenen Unterstapel.</p></div>
        <select value={selectedDeck} onChange={(event) => onSelectDeck(event.target.value)} aria-label="Finnisch-Stapel auswählen">
          {deckNames.map((deck) => <option value={deck} key={deck}>{deck.replaceAll("::", " › ")}</option>)}
        </select>
      </section>
      <section className="connection-panel surface"><span className={`connection-icon ${ankiStatus}`}><Monitor size={21} /></span><div><h2>{t("ankiConnection")}</h2><p>{ankiStatus === "connected" ? t("connected") : ankiStatus === "checking" ? t("checking") : ankiError || t("disconnected")}</p></div><button className="secondary-button" onClick={onReconnect}>{t("reconnect")}</button></section>
      <section className={`connection-panel sync-panel surface ${syncStatus}`}><span className={`connection-icon ${syncStatus === "success" ? "connected" : ""}`}>{syncStatus === "syncing" ? <LoaderCircle className="spin" size={21} /> : syncStatus === "error" ? <CloudOff size={21} /> : <Cloud size={21} />}</span><div><h2>{t("ankiWebSync")}</h2><p>{syncStatus === "syncing" ? t("syncing") : syncStatus === "success" ? t("syncComplete") : syncStatus === "error" ? syncError || t("syncFailed") : t("syncReady")}</p></div><button className="secondary-button" disabled={ankiStatus !== "connected" || syncStatus === "syncing"} onClick={onSync}>{t("syncNow")}</button></section>
    </div>
  );
}

function ToggleRow({ icon: Icon, title, detail, enabled, onToggle }: { icon: typeof Music2; title: string; detail: string; enabled: boolean; onToggle: (value: boolean) => void }) {
  return <div className="toggle-row"><span><Icon size={20} /></span><div><strong>{title}</strong><small>{detail}</small></div><button role="switch" aria-checked={enabled} className={`toggle ${enabled ? "on" : ""}`} onClick={() => onToggle(!enabled)}><i /></button></div>;
}

function getLanguage(id: LanguageId) {
  return languages.find((language) => language.id === id)!;
}

function playFeedbackSound(kind: Rating | "reveal" | "complete" | "audio", enabled: boolean) {
  if (!enabled || !window.AudioContext) return;
  const context = new window.AudioContext();
  const master = context.createGain();
  master.gain.setValueAtTime(0.0001, context.currentTime);
  master.gain.exponentialRampToValueAtTime(0.055, context.currentTime + 0.018);
  master.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.42);
  master.connect(context.destination);

  const notes: Record<string, number[]> = {
    reveal: [440],
    Again: [220],
    Hard: [330],
    Good: [523, 659],
    Easy: [523, 659, 784],
    complete: [523, 659, 784, 1047],
    audio: [392, 523, 659],
  };

  notes[kind].forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const start = context.currentTime + index * 0.075;
    oscillator.type = kind === "Again" ? "sine" : "triangle";
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.55, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.19);
    oscillator.connect(gain);
    gain.connect(master);
    oscillator.start(start);
    oscillator.stop(start + 0.21);
  });

  window.setTimeout(() => void context.close(), 650);
}

function getLanguageJourney(learned: number) {
  let current = languageMilestones[0];
  for (const milestone of languageMilestones) if (learned >= milestone.cards) current = milestone;
  const index = languageMilestones.indexOf(current);
  const next = languageMilestones[index + 1] ?? null;
  const progress = next ? Math.round(((learned - current.cards) / (next.cards - current.cards)) * 100) : 100;
  return { current, next, progress: Math.max(0, Math.min(100, progress)) };
}

function milestoneTitleKey(level: string) {
  return ({ A0: "milestoneStart", A1: "milestoneFoundations", A2: "milestoneBasis", B1: "milestoneIndependent", B2: "milestoneConfident", C1: "milestoneAdvanced", C2: "milestoneMastery" } as Record<string, string>)[level] || "milestoneStart";
}

function calculateStreak(history: Array<[string, number]>) {
  const active = new Set(history.filter(([, count]) => count > 0).map(([date]) => date));
  const cursor = new Date();
  if (!active.has(dateKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (active.has(dateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function hasActivityToday(history: Array<[string, number]>) {
  return history.some(([date, count]) => date === dateKey(new Date()) && count > 0);
}

function formatInterval(days: number, t: Translator) {
  if (!days) return t("newCards");
  if (days < 30) return `${days} ${days === 1 ? t("day") : t("days")}`;
  if (days < 365) return `${Math.round(days / 30)} ${t("month")}`;
  return `${(days / 365).toFixed(days >= 730 ? 0 : 1)} ${t("year")}`;
}

function getHeatmapDays(view: "week" | "month" | "year", history: Array<[string, number]>, locale = "de-CH") {
  const counts = new Map(history);
  const length = view === "week" ? 7 : view === "month" ? 35 : 364;
  return Array.from({ length }, (_, index) => {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() - (length - 1 - index));
    const key = dateKey(date);
    return { date: key, count: counts.get(key) ?? 0, day: String(date.getDate()), weekday: date.toLocaleDateString(locale, { weekday: "short" }) };
  });
}

function heatLevel(count: number) {
  if (!count) return 0;
  if (count < 15) return 1;
  if (count < 50) return 2;
  if (count < 100) return 3;
  return 4;
}

function formatHeatDate(value: string, locale = "de-CH") {
  return new Date(`${value}T12:00:00`).toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" });
}

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function loadSettings(): AppSettings {
  try {
    const saved = localStorage.getItem("linguaflow-settings");
    return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
  } catch {
    return defaultSettings;
  }
}

export default App;
