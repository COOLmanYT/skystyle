"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import LocationPicker, { ResolvedLocation } from "./LocationPicker";
import WeatherPlanningPanel from "./WeatherPlanningPanel";
import WeatherEffectCard, { getWeatherCondition, formatHourlyTime, isHourlyCurrentOrFuture, HOURLY_FORECAST_LIMIT } from "./WeatherEffectCard";
import UpgradePlanModal from "./UpgradePlanModal";
import FeedbackModal from "./FeedbackModal";
import ChangelogModal, { type ChangelogModalEntry } from "./ChangelogModal";
import { handleSignOut } from "@/app/actions";
import Link from "next/link";
import Checkbox from "@/components/Checkbox";
import MarkdownRenderer from "@/components/MarkdownRenderer";
import HamburgerNav from "@/components/HamburgerNav";

/** Returns true if version string `a` is strictly greater than `b`. */
function isVersionGreater(a: string, b: string): boolean {
  const parse = (v: string) => v.split(".").map(Number);
  const [aMaj = 0, aMin = 0, aPatch = 0] = parse(a);
  const [bMaj = 0, bMin = 0, bPatch = 0] = parse(b);
  if (aMaj !== bMaj) return aMaj > bMaj;
  if (aMin !== bMin) return aMin > bMin;
  return aPatch > bPatch;
}

type LayoutMode = "symmetric" | "large-weather" | "large-settings";

interface HourlyForecast {
  time: string;
  temp: number;
  description: string;
  rainChance: number;
  windSpeed: number;
}

interface StyleResponse {
  weather: {
    temp: number;
    feelsLike: number;
    humidity: number;
    windSpeed: number;
    windDir: string;
    description: string;
    rainChance: number;
    uvIndex: number;
    isDay: boolean;
    alerts: string[];
    stationName: string;
    stationDistanceKm: number;
    accuracyScore: "High" | "Medium" | "Low";
    source: "BOM" | "OpenWeather" | "Custom" | "Multi";
    hourly?: HourlyForecast[];
    sources?: {
      source: string;
      temp: number;
      feelsLike: number;
      humidity: number;
      windSpeed: number;
      windDir: string;
      description: string;
      rainChance: number;
      uvIndex: number;
    }[];
  };
  recommendation: {
    outfit: string;
    reasoning: string;
    closetWarning?: string;
    modelUsed?: string;
  };
  meta: {
    isPro: boolean;
    unitPreference: "metric" | "imperial";
    creditsRemaining: number | null;
    dailyLimits?: DailyLimits;
    modelUsed?: string;
  };
}

interface DailyLimits {
  ai: { used: number; limit: number | null };
  followUps: { used: number; limit: number | null };
  closet: { used: number; limit: number | null };
  sourcePicks: { used: number; limit: number | null };
}

const ACCURACY_COLOR: Record<string, string> = {
  High: "#34c759",
  Medium: "#ff9500",
  Low: "#ff3b30",
};

const SOURCE_LINKS: Record<string, string> = {
  OpenWeather: "https://openweathermap.org/",
  "Open-Meteo": "https://open-meteo.com/",
  BOM: "http://www.bom.gov.au/",
  WeatherAPI: "https://www.weatherapi.com/",
  VisualCrossing: "https://www.visualcrossing.com/",
  PirateWeather: "https://pirateweather.net/",
};

const MAX_GENDER_LENGTH = 30;

/** Returns true if the given option string matches the current gender state */
function isGenderActive(option: string, gender: string): boolean {
  return (option === "Other" && gender === "N/A") || gender === option;
}

interface DashboardProps {
  userName: string;
  isPro: boolean;
  isDev: boolean;
  initialCredits: number | null;
  initialDailyLimits: DailyLimits | null;
}

export default function Dashboard({
  userName,
  isPro,
  isDev,
  initialCredits,
  initialDailyLimits,
}: DashboardProps) {
  const [location, setLocation] = useState<ResolvedLocation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<StyleResponse | null>(null);
  const [followUpText, setFollowUpText] = useState("");
  const [followUpLoading, setFollowUpLoading] = useState(false);
  const [followUpError, setFollowUpError] = useState<string | null>(null);
  // Chat Mode: conversation history (alternative to Replace Mode)
  const [followUpHistory, setFollowUpHistory] = useState<{ question: string; outfit: string; reasoning: string }[]>([]);
  const [followUpMode, setFollowUpMode] = useState<"replace" | "chat">("replace");
  const [dailyLimits, setDailyLimits] = useState<DailyLimits | null>(initialDailyLimits);
  const [gender, setGender] = useState<string>("N/A");
  const [customGender, setCustomGender] = useState("");
  const [userApiKey, setUserApiKey] = useState<string>("");
  const [shareLocation, setShareLocation] = useState(false);
  const [closetItems, setClosetItems] = useState<string[]>([]);
  const [newClosetItem, setNewClosetItem] = useState("");
  const [closetLoading, setClosetLoading] = useState(false);
  const [forceCloset, setForceCloset] = useState(false);
  const [weatherOnly, setWeatherOnly] = useState(false);
  const [userUnitPreference, setUserUnitPreference] = useState<"metric" | "imperial">("metric");
  const [devChatMessage, setDevChatMessage] = useState("");
  const [devChatLoading, setDevChatLoading] = useState(false);
  const [devChatError, setDevChatError] = useState<string | null>(null);
  const [devChatResult, setDevChatResult] = useState<{ outfit: string; reasoning: string; rawOutput?: string } | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [changelogUnread, setChangelogUnread] = useState(false);
  // Login changelog popup (showOnNextLogin entries)
  const [loginPopupEntry, setLoginPopupEntry] = useState<ChangelogModalEntry | null>(null);
  // Two-stage fetch state: weather arrives first, AI recommendation second
  const [weatherData, setWeatherData] = useState<StyleResponse["weather"] | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiRevealed, setAiRevealed] = useState(false);
  // Feedback modal state
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackCategory, setFeedbackCategory] = useState<string | undefined>(undefined);
  const [simpleMode, setSimpleMode] = useState(true);
  // BYOK enhancements — provider selector + client-side custom prompt (Pro/Dev)
  const [byokProvider, setByokProvider] = useState<"openai" | "gemini">("openai");
  const [clientCustomPrompt, setClientCustomPrompt] = useState("");

  // Session diagnostics (dev-only by default, optionally enabled for all users)
  const [diagLastAiStatus, setDiagLastAiStatus] = useState<"success" | "error" | null>(null);
  const [diagLastAiProvider, setDiagLastAiProvider] = useState<string | null>(null);
  const [diagLastWeatherStatus, setDiagLastWeatherStatus] = useState<"success" | "error" | null>(null);
  const [diagSessionErrors, setDiagSessionErrors] = useState(0);
  const [diagLastFetchAt, setDiagLastFetchAt] = useState<string | null>(null);
  const [diagFallbackEvents] = useState<string[]>([]);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  // BYOK collapsible
  const [byokOpen, setByokOpen] = useState(false);

  // Returns the gradient/background CSS class for plan-based primary buttons
  const planBtnClass = isDev ? "btn-plan-dev" : isPro ? "btn-plan-pro" : "btn-plan-free";
  const planBtnStyle: React.CSSProperties = {};

  // Layout preferences (loaded from localStorage)
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("large-weather");
  const [extraSpacingEnabled, setExtraSpacingEnabled] = useState(false);
  const [customSpacingEnabled, setCustomSpacingEnabled] = useState(false);
  // Ratio: left column flex relative to right (right is always flex-1)
  const [customRatio, setCustomRatio] = useState(1.5);
  const customRatioRef = useRef(1.5);
  const isDraggingRef = useRef(false);
  const columnsContainerRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef({ x: 0, ratio: 1.5, containerWidth: 1000 });

  // Custom weather sources (stored in localStorage)
  type SourceMode = "builtin" | "custom" | "both";
  interface CustomSource {
    id: string;
    type: "rss" | "api_key" | "url";
    name: string;
    value: string;
    service?: string;
  }
  const [sourceMode, setSourceMode] = useState<SourceMode>("builtin");
  const [customSources, setCustomSources] = useState<CustomSource[]>([]);
  const [newSourceType, setNewSourceType] = useState<"rss" | "api_key" | "url">("url");
  const [newSourceName, setNewSourceName] = useState("");
  const [newSourceValue, setNewSourceValue] = useState("");
  const [newSourceService, setNewSourceService] = useState("weatherapi");
  const [sourcesExpanded, setSourcesExpanded] = useState(false);

  const syncStoredPreferences = useCallback(() => {
    try {
      const savedGender = localStorage.getItem("skystyle_gender");
      if (savedGender) {
        try {
          // Decode stored gender; fall back to raw value if decoding fails
          const decodedGender = atob(savedGender);
          setGender(decodedGender);
        } catch {
          setGender(savedGender);
        }
      }
      const savedCustomGender = localStorage.getItem("skystyle_custom_gender");
      if (savedCustomGender) {
        try {
          // Decode stored custom gender; fall back to raw value if decoding fails
          const decodedCustomGender = atob(savedCustomGender);
          setCustomGender(decodedCustomGender);
        } catch {
          setCustomGender(savedCustomGender);
        }
      }
      const savedApiKey = localStorage.getItem("skystyle_byok_key");
      if (savedApiKey) setUserApiKey(savedApiKey);
      const savedLocationConsent = localStorage.getItem("skystyle_location_consent");
      if (savedLocationConsent !== null) setShareLocation(savedLocationConsent === "true");
      const savedWeatherOnly = localStorage.getItem("skystyle_weather_only");
      if (savedWeatherOnly !== null) setWeatherOnly(savedWeatherOnly === "true");

      const savedLayoutMode = localStorage.getItem("skystyle_layout_mode") as LayoutMode | null;
      if (savedLayoutMode) setLayoutMode(savedLayoutMode);

      const extraEnabled = localStorage.getItem("skystyle_extra_spacing") === "true";
      const extraPages = (localStorage.getItem("skystyle_extra_spacing_pages") ?? "dashboard")
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);
      setExtraSpacingEnabled(extraEnabled && extraPages.includes("dashboard"));

      const customEnabled = localStorage.getItem("skystyle_custom_spacing") === "true";
      setCustomSpacingEnabled(customEnabled);
      const savedRatio = parseFloat(localStorage.getItem("skystyle_custom_spacing_ratio") ?? "1.5");
      if (!isNaN(savedRatio) && savedRatio > 0) {
        setCustomRatio(savedRatio);
        customRatioRef.current = savedRatio;
      }

      const savedSimpleMode = localStorage.getItem("skystyle_simple_mode");
      if (savedSimpleMode !== null) setSimpleMode(savedSimpleMode === "true");

      const savedByokProvider = localStorage.getItem("skystyle_byok_provider");
      if (savedByokProvider === "gemini") setByokProvider("gemini");
      else setByokProvider("openai");

      const savedClientCustomPrompt = localStorage.getItem("skystyle_byok_custom_prompt");
      if (savedClientCustomPrompt !== null) setClientCustomPrompt(savedClientCustomPrompt);

      // New behaviour settings
      const savedFollowUpMode = localStorage.getItem("skystyle_followup_mode");
      if (savedFollowUpMode === "chat" || savedFollowUpMode === "replace") setFollowUpMode(savedFollowUpMode);
      const savedShowDiag = localStorage.getItem("skystyle_show_diagnostics");
      setShowDiagnostics(savedShowDiag === "true");
      const savedByokOpen = localStorage.getItem("skystyle_byok_open");
      if (savedByokOpen !== null) setByokOpen(savedByokOpen === "true");
    } catch {
      /* ignore */
    }
  }, []);

  // Load custom sources from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("skystyle_custom_sources");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.customSources)) setCustomSources(parsed.customSources);
        if (parsed.sourceMode) setSourceMode(parsed.sourceMode);
      }
    } catch { /* ignore */ }
  }, []);

  // Persist gender preference to localStorage when changed
  useEffect(() => {
    try {
      // Encode gender before storing to avoid clear text storage
      localStorage.setItem("skystyle_gender", btoa(gender));
    } catch {
      /* ignore */
    }
  }, [gender]);

  useEffect(() => {
    try {
      // Encode custom gender before storing
      localStorage.setItem("skystyle_custom_gender", btoa(customGender));
    } catch {
      /* ignore */
    }
  }, [customGender]);

  // Check for unread changelog entries and showOnNextLogin popups on mount
  useEffect(() => {
    fetch("/api/changelog")
      .then((r) => r.json())
      .then((entries: {
        version: string;
        title: string;
        description?: string;
        imageUrl?: string;
        image?: string;
        ctaLabel?: string;
        ctaLink?: string;
        cta?: { text: string; url: string };
        content?: string;
        large?: boolean;
        showOnNextLogin?: boolean;
      }[]) => {
        if (!entries.length) return;
        const latest = entries[0].version;
        try {
          const seen = localStorage.getItem("skystyle_last_seen_changelog");
          if (!seen || isVersionGreater(latest, seen)) {
            setChangelogUnread(true);
          }
          // Check for showOnNextLogin entries
          const seenPopups: string[] = JSON.parse(
            localStorage.getItem("skystyle_seen_login_popups") ?? "[]"
          );
          const popup = entries.find(
            (e) => e.showOnNextLogin && !seenPopups.includes(e.version)
          );
          if (popup) {
            setLoginPopupEntry({
              version: popup.version,
              title: popup.title,
              description: popup.description,
              imageUrl: popup.imageUrl ?? popup.image,
              ctaLabel: popup.ctaLabel ?? popup.cta?.text,
              ctaLink: popup.ctaLink ?? popup.cta?.url,
              content: popup.content,
            });
          }
        } catch { /* ignore */ }
      })
      .catch(() => { /* ignore */ });
  }, []);

  // Trigger the slide-up animation after AI recommendation arrives
  useEffect(() => {
    if (result?.recommendation?.outfit) {
      const id = setTimeout(() => setAiRevealed(true), 50);
      return () => clearTimeout(id);
    } else {
      setAiRevealed(false);
    }
  }, [result]);

  // Save custom sources to localStorage when changed
  const saveSourcesLocal = useCallback((mode: SourceMode, sources: CustomSource[]) => {
    try {
      localStorage.setItem("skystyle_custom_sources", JSON.stringify({ sourceMode: mode, customSources: sources }));
    } catch { /* ignore */ }
  }, []);

  function addCustomSource(e: React.FormEvent) {
    e.preventDefault();
    if (!newSourceName.trim() || !newSourceValue.trim()) return;
    const newSource: CustomSource = {
      id: crypto.randomUUID(),
      type: newSourceType,
      name: newSourceName.trim().slice(0, 50),
      value: newSourceValue.trim().slice(0, 500),
      ...(newSourceType === "api_key" ? { service: newSourceService } : {}),
    };
    const updated = [...customSources, newSource];
    setCustomSources(updated);
    saveSourcesLocal(sourceMode, updated);
    setNewSourceName("");
    setNewSourceValue("");
  }

  function removeCustomSource(id: string) {
    const updated = customSources.filter((s) => s.id !== id);
    setCustomSources(updated);
    saveSourcesLocal(sourceMode, updated);
  }

  function updateSourceMode(mode: SourceMode) {
    setSourceMode(mode);
    saveSourcesLocal(mode, customSources);
  }

  // Fetch closet items and settings on mount
  useEffect(() => {
    (async () => {
      try {
        const [closetRes, settingsRes] = await Promise.all([
          fetch("/api/closet"),
          fetch("/api/settings"),
        ]);
        if (closetRes.ok) {
          const data = await closetRes.json();
          setClosetItems(data.items ?? []);
        }
        if (settingsRes.ok) {
          const data = await settingsRes.json();
          if (data.unit_preference === "imperial") {
            setUserUnitPreference("imperial");
          }
        }
      } catch {
        /* ignore */
      }
    })();
    syncStoredPreferences();
    window.addEventListener("storage", syncStoredPreferences);
    window.addEventListener("skystyle-preferences-updated", syncStoredPreferences);

    return () => {
      window.removeEventListener("storage", syncStoredPreferences);
      window.removeEventListener("skystyle-preferences-updated", syncStoredPreferences);
    };
  }, [syncStoredPreferences]);

  async function addClosetItem(e: React.FormEvent) {
    e.preventDefault();
    const item = newClosetItem.trim();
    if (!item) return;
    setClosetLoading(true);
    try {
      const res = await fetch("/api/closet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item }),
      });
      if (res.ok) {
        const data = await res.json();
        setClosetItems(data.items ?? []);
        setNewClosetItem("");
      }
    } catch {
      /* ignore */
    } finally {
      setClosetLoading(false);
    }
  }

  async function removeClosetItem(item: string) {
    setClosetLoading(true);
    try {
      const res = await fetch("/api/closet", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item }),
      });
      if (res.ok) {
        const data = await res.json();
        setClosetItems(data.items ?? []);
      }
    } catch {
      /* ignore */
    } finally {
      setClosetLoading(false);
    }
  }

  const creditsRemaining = result?.meta?.creditsRemaining ?? initialCredits;

  /** True when the user has hit their daily follow-up limit (client-side guard). */
  const isFollowUpLimitReached =
    dailyLimits !== null &&
    dailyLimits.followUps.limit !== null &&
    dailyLimits.followUps.used >= dailyLimits.followUps.limit;

  /** Called by LocationPicker — only stores the selected location, no auto-fetch. */
  const handleLocationResolved = useCallback((loc: ResolvedLocation) => {
    setLocation(loc);
    setError(null);
    setResult(null);
    setWeatherData(null);
    setAiRevealed(false);
    setFollowUpText("");
    setFollowUpError(null);
    setFollowUpHistory([]);
  }, []);

  /** Triggered by the "Fetch Weather & Style" button and the Refresh button. */
  const handleFetch = useCallback(async () => {
    if (!location) return;
    setError(null);
    setResult(null);
    setWeatherData(null);
    setAiRevealed(false);
    setFollowUpText("");
    setFollowUpError(null);
    setFollowUpHistory([]);

    if (weatherOnly) {
      // Weather-only mode: single fetch, no AI
      setLoading(true);
      setAiLoading(false);
      try {
        const res = await fetch(`/api/weather?lat=${location.lat}&lon=${location.lon}`);
        if (!res.ok) {
          let errorMessage = "Something went wrong.";
          try { const data = await res.json(); errorMessage = data.error ?? errorMessage; } catch { /* non-JSON */ }
          setError(errorMessage);
        } else {
          const weather = await res.json();
          setResult({
            weather,
            recommendation: { outfit: "", reasoning: "" },
            meta: { isPro, unitPreference: userUnitPreference, creditsRemaining: null },
          });
        }
      } catch {
        setError("Network error — please try again.");
      } finally {
        setLoading(false);
      }
      return;
    }

    // Two-stage mode: fire weather + style requests simultaneously
    setLoading(true);
    setAiLoading(true);

    const effectiveGender = gender === "Other - Manual" ? customGender.slice(0, MAX_GENDER_LENGTH) : gender;

    // Read planning data from localStorage (managed by WeatherPlanningPanel)
    let planningData: unknown = undefined;
    try {
      const raw = localStorage.getItem("skystyle_planning_panel");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object" && Array.isArray(parsed.slots)) {
          planningData = { slots: parsed.slots, complexity: parsed.complexity ?? 0 };
        }
      }
    } catch { /* ignore — planning data is optional */ }

    // Both requests start immediately (parallel)
    const weatherPromise = fetch(`/api/weather?lat=${location.lat}&lon=${location.lon}`);
    const stylePromise = fetch("/api/style", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lat: location.lat, lon: location.lon, gender: effectiveGender, shareLocation, forceCloset,
        unitPreference: userUnitPreference, sourceMode, customSources,
        ...(userApiKey ? { userApiKey, byokProvider } : {}),
        ...(clientCustomPrompt ? { clientCustomPrompt } : {}),
        ...(planningData ? { planningData } : {}),
      }),
    });

    // Stage 1: weather (fast — show as soon as it arrives)
    try {
      const weatherRes = await weatherPromise;
      if (weatherRes.ok) {
        const weather = await weatherRes.json();
        setWeatherData(weather);
        if (isDev || showDiagnostics) {
          setDiagLastWeatherStatus("success");
          setDiagLastFetchAt(new Date().toISOString());
        }
      } else if (isDev || showDiagnostics) {
        setDiagLastWeatherStatus("error");
        setDiagSessionErrors((n) => n + 1);
      }
    } catch {
      if (isDev || showDiagnostics) {
        setDiagLastWeatherStatus("error");
        setDiagSessionErrors((n) => n + 1);
      }
      /* weather network error — style result may still save us */
    }
    setLoading(false);

    // Stage 2: AI recommendation (slower — reveal with animation)
    try {
      const styleRes = await stylePromise;
      if (!styleRes.ok) {
        let errorMessage = "Something went wrong.";
        try { const data = await styleRes.json(); errorMessage = data.error ?? errorMessage; } catch { /* non-JSON */ }
        setError(errorMessage);
        if (isDev || showDiagnostics) {
          setDiagLastAiStatus("error");
          setDiagSessionErrors((n) => n + 1);
        }
      } else {
        const data = await styleRes.json() as StyleResponse;
        setResult(data);
        if (data.meta?.dailyLimits) setDailyLimits(data.meta.dailyLimits);
        if (isDev || showDiagnostics) {
          setDiagLastAiStatus("success");
          const provider = data.recommendation?.modelUsed ?? data.meta?.modelUsed ?? null;
          if (provider) setDiagLastAiProvider(provider);
        }
      }
    } catch {
      setError("Network error — please try again.");
      if (isDev || showDiagnostics) {
        setDiagLastAiStatus("error");
        setDiagSessionErrors((n) => n + 1);
      }
    } finally {
      setAiLoading(false);
    }
  }, [location, weatherOnly, gender, customGender, shareLocation, forceCloset, isPro, isDev, showDiagnostics, userUnitPreference, sourceMode, customSources, userApiKey, byokProvider, clientCustomPrompt]);

  async function handleFollowUp(e: React.FormEvent) {
    e.preventDefault();
    if (!followUpText.trim() || !result) return;
    // Client-side limit guard (server enforces definitively)
    if (isFollowUpLimitReached) {
      setFollowUpError(`Daily follow-up limit reached (${dailyLimits!.followUps.used}/${dailyLimits!.followUps.limit}).`);
      return;
    }
    const questionText = followUpText.trim();
    setFollowUpLoading(true);
    setFollowUpError(null);
    // In chat mode, always base follow-up on latest outfit
    const baseOutfit = followUpMode === "chat" && followUpHistory.length > 0
      ? followUpHistory[followUpHistory.length - 1].outfit
      : result.recommendation.outfit;
    const baseReasoning = followUpMode === "chat" && followUpHistory.length > 0
      ? followUpHistory[followUpHistory.length - 1].reasoning
      : result.recommendation.reasoning;
    try {
      const res = await fetch("/api/followup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: questionText,
          previousOutfit: baseOutfit,
          previousReasoning: baseReasoning,
          weather: result.weather,
          ...(userApiKey ? { userApiKey } : {}),
        }),
      });
      if (!res.ok) {
        let errorMessage = "Follow-up failed.";
        try {
          const data = await res.json();
          errorMessage = data.error ?? errorMessage;
        } catch {
          /* non-JSON */
        }
        setFollowUpError(errorMessage);
        if (isDev || showDiagnostics) {
          setDiagLastAiStatus("error");
          setDiagSessionErrors((n) => n + 1);
        }
      } else {
        const data = await res.json();
        if (followUpMode === "chat") {
          // Chat mode: append to history without replacing main result
          setFollowUpHistory((prev) => [
            ...prev,
            { question: questionText, outfit: data.recommendation.outfit, reasoning: data.recommendation.reasoning },
          ]);
        } else {
          // Replace mode: overwrite current result
          setResult((prev) =>
            prev ? { ...prev, recommendation: data.recommendation } : prev
          );
        }
        if (data.meta?.dailyLimits) {
          setDailyLimits(data.meta.dailyLimits);
        }
        setFollowUpText("");
        if (isDev || showDiagnostics) setDiagLastAiStatus("success");
      }
    } catch {
      setFollowUpError("Network error — please try again.");
      if (isDev || showDiagnostics) {
        setDiagLastAiStatus("error");
        setDiagSessionErrors((n) => n + 1);
      }
    } finally {
      setFollowUpLoading(false);
    }
  }

  async function handleDevChat(e: React.FormEvent) {
    e.preventDefault();
    if (!devChatMessage.trim()) return;
    setDevChatLoading(true);
    setDevChatError(null);
    setDevChatResult(null);
    try {
      const res = await fetch("/api/style", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat: 0, lon: 0, devMessage: devChatMessage.trim() }),
      });
      if (!res.ok) {
        let errorMessage = "Dev chat failed.";
        try {
          const data = await res.json();
          errorMessage = data.error ?? errorMessage;
        } catch {
          /* non-JSON */
        }
        setDevChatError(errorMessage);
      } else {
        const data = await res.json();
        setDevChatResult(data.recommendation);
        setDevChatMessage("");
      }
    } catch {
      setDevChatError("Network error — please try again.");
    } finally {
      setDevChatLoading(false);
    }
  }

  const w = result?.weather ?? weatherData;
  const rec = result?.recommendation;

  // ── Drag-to-resize column handler ──
  function onDividerMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    isDraggingRef.current = true;
    dragStartRef.current = {
      x: e.clientX,
      ratio: customRatioRef.current,
      containerWidth: columnsContainerRef.current?.offsetWidth ?? 1000,
    };

    function onMouseMove(ev: MouseEvent) {
      if (!isDraggingRef.current) return;
      const dx = ev.clientX - dragStartRef.current.x;
      // Recalculate container width each move so window-resize doesn't cause drift
      const containerWidth = columnsContainerRef.current?.offsetWidth ?? dragStartRef.current.containerWidth;
      const totalFlex = dragStartRef.current.ratio + 1;
      const dRatio = (dx / containerWidth) * totalFlex;
      const newRatio = Math.max(0.4, Math.min(4, dragStartRef.current.ratio + dRatio));
      customRatioRef.current = newRatio;
      setCustomRatio(newRatio);
    }

    function onMouseUp() {
      isDraggingRef.current = false;
      // Persist ratio
      try { localStorage.setItem("skystyle_custom_spacing_ratio", String(customRatioRef.current)); } catch { /* ignore */ }
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    }

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }

  // Compute column flex values based on active mode
  const leftFlex = customSpacingEnabled
    ? customRatio
    : layoutMode === "large-weather" ? 1.5
    : layoutMode === "large-settings" ? 1
    : 1; // symmetric
  const rightFlex = customSpacingEnabled
    ? 1
    : layoutMode === "large-settings" ? 1.5
    : 1; // symmetric or large-weather

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--background)" }}>
      {showUpgradeModal && (
        <UpgradePlanModal onClose={() => setShowUpgradeModal(false)} />
      )}
      {feedbackOpen && (
        <FeedbackModal
          isOpen={feedbackOpen}
          onClose={() => { setFeedbackOpen(false); setFeedbackCategory(undefined); }}
          isPro={isPro}
          isDev={isDev}
          initialCategory={feedbackCategory}
        />
      )}
      {loginPopupEntry && (
        <ChangelogModal
          entry={loginPopupEntry}
          showChangelogLink
          onClose={() => {
            try {
              const prev: string[] = JSON.parse(
                localStorage.getItem("skystyle_seen_login_popups") ?? "[]"
              );
              if (!prev.includes(loginPopupEntry.version)) {
                localStorage.setItem(
                  "skystyle_seen_login_popups",
                  JSON.stringify([...prev, loginPopupEntry.version])
                );
              }
            } catch { /* ignore */ }
            setLoginPopupEntry(null);
          }}
        />
      )}
      {/* ── Top Bar (unified HamburgerNav) ── */}
      <HamburgerNav
        currentPage="dashboard"
        userName={userName}
        title="🌤️ Sky Style"
        onTitleClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        signOutAction={handleSignOut}
        isDev={isDev}
        changelogUnread={changelogUnread}
        onChangelogClick={() => {
          setChangelogUnread(false);
          try { localStorage.setItem("skystyle_last_seen_changelog", "__dismiss__"); } catch { /* ignore */ }
        }}
        rightContent={
          <span className="text-sm hidden sm:inline" style={{ color: "var(--foreground)", opacity: 0.6 }}>
            Hello, {userName}!
          </span>
        }
      />

      {/* ── Main Content ── */}
      <main
        id="main-content"
        className="flex-1 py-6"
        style={{ paddingLeft: extraSpacingEnabled ? 32 : 16, paddingRight: extraSpacingEnabled ? 32 : 16 }}
      >
        <div
          ref={columnsContainerRef}
          className="max-w-7xl mx-auto flex flex-col lg:flex-row"
          style={{ gap: 24 }}
        >
          {/* ── Left Column: Weather ── */}
          <div
            className="space-y-5 min-w-0"
            style={{ flex: leftFlex }}
          >
            {/* ── Weather Planning Panel ── */}
            <WeatherPlanningPanel />

            {/* ── Location Picker ── */}
            <LocationPicker onLocationResolved={handleLocationResolved} />

            {location && (
              <WeatherEffectCard
                condition={w ? getWeatherCondition(w.description) : "default"}
                windSpeed={w?.windSpeed ?? 0}
                className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs"
                style={{
                  background: "var(--card)",
                  border: "1px solid var(--card-border)",
                  color: "var(--foreground)",
                  opacity: 0.8,
                }}
              >
                <span>{location.source === "gps" ? "📍" : "🔍"}</span>
                <span className="truncate">{location.displayName}</span>
              </WeatherEffectCard>
            )}

            {/* ── Fetch Button (shown after location selected, before fetch starts) ── */}
            {location && !loading && !aiLoading && !result && !weatherData && (
              <button
                onClick={handleFetch}
                className={`w-full rounded-2xl py-3 text-sm font-semibold btn-interact ${planBtnClass}`}
                aria-label={weatherOnly ? "Fetch weather for selected location" : "Fetch weather and generate AI outfit recommendation"}
              >
                {weatherOnly ? "🌤️ Fetch Weather" : "✨ Fetch Weather & Style"}
              </button>
            )}

            {/* ── Loading ── */}
            {(loading || aiLoading) && (
              <div
                role="status"
                aria-live="polite"
                className="rounded-2xl p-8 flex flex-col items-center gap-3"
                style={{
                  background: "var(--card)",
                  border: "1px solid var(--card-border)",
                }}
              >
                <div className="text-3xl animate-bounce" aria-hidden="true">✨</div>
                <p
                  className="text-sm"
                  style={{ color: "var(--foreground)", opacity: 0.6 }}
                >
                  {loading ? `Fetching weather${weatherOnly ? "…" : "…"}` : "Generating outfit recommendation…"}
                </p>
              </div>
            )}

            {/* ── Error ── */}
            {error && !loading && (
              <div
                role="alert"
                className="rounded-2xl p-4 text-sm"
                style={{
                  background: "#ff3b3015",
                  border: "1px solid #ff3b3040",
                  color: "#ff3b30",
                }}
              >
                <span aria-hidden="true">⚠️ </span>{error}
              </div>
            )}

            {/* ── Main Weather Card + Outfit + Follow-up + Refresh ── */}
            {(result || weatherData) && !loading && (
              <>
                <WeatherEffectCard
                  condition={getWeatherCondition(w?.description ?? "")}
                  windSpeed={w!.windSpeed}
                  className="rounded-2xl p-5 space-y-3"
                  style={{
                    background: "var(--card)",
                    border: "1px solid var(--card-border)",
                  }}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p
                        className="text-4xl font-thin"
                        style={{ color: "var(--foreground)" }}
                      >
                        {userUnitPreference === "imperial"
                          ? `${Math.round((w!.temp * 9) / 5 + 32)}°F`
                          : `${w!.temp}°C`}
                      </p>
                      <p
                        className="text-sm capitalize mt-0.5"
                        style={{ color: "var(--foreground)", opacity: 0.55 }}
                      >
                        {w!.description} · feels like{" "}
                        {userUnitPreference === "imperial"
                          ? `${Math.round((w!.feelsLike * 9) / 5 + 32)}°F`
                          : `${w!.feelsLike}°C`}
                      </p>
                    </div>
                    <span className="text-4xl" aria-hidden="true">
                      {weatherEmoji(w!.description, w!.isDay)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                    {[
                      { label: "Humidity", value: `${w!.humidity}%`, icon: "💧" },
                      { label: "Rain chance", value: `${w!.rainChance}%`, icon: "🌧" },
                      {
                        label: "Wind",
                        value: `${
                          userUnitPreference === "imperial"
                            ? `${Math.round(w!.windSpeed * 0.621)}mph`
                            : `${w!.windSpeed}km/h`
                        } ${w!.windDir}`,
                        icon: "💨",
                      },
                      { label: "UV Index", value: `${w!.uvIndex}`, icon: "☀️" },
                      {
                        label: "Feels like",
                        value: userUnitPreference === "imperial"
                          ? `${Math.round((w!.feelsLike * 9) / 5 + 32)}°F`
                          : `${w!.feelsLike}°C`,
                        icon: "🌡️",
                      },
                      { label: "Time", value: w!.isDay ? "Daytime" : "Night-time", icon: w!.isDay ? "🌞" : "🌙" },
                    ].map(({ label, value, icon }) => (
                      <div
                        key={label}
                        className="rounded-xl p-2.5 text-center"
                        style={{ background: "var(--background)" }}
                      >
                        <p
                          className="text-xs"
                          style={{ color: "var(--foreground)", opacity: 0.45 }}
                        >
                          <span aria-hidden="true">{icon} </span>{label}
                        </p>
                        <p
                          className="text-sm font-medium mt-0.5"
                          style={{ color: "var(--foreground)" }}
                        >
                          {value}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Alerts — shown prominently */}
                  {w!.alerts.length > 0 && (
                    <div
                      className="rounded-xl p-3 text-xs space-y-1"
                      style={{
                        background: "#ff950022",
                        border: "1px solid #ff950040",
                      }}
                    >
                      <p className="font-semibold uppercase tracking-widest" style={{ color: "#ff9500" }}>
                        ⚠️ Weather Alerts
                      </p>
                      {w!.alerts.map((a, i) => (
                        <p key={i} style={{ color: "#ff9500" }}>
                          {a}
                        </p>
                      ))}
                    </div>
                  )}

                  {/* Per-source breakdown */}
                  {w!.sources && w!.sources.length > 1 && (
                    <div className="pt-2">
                      <p
                        className="text-xs font-semibold uppercase tracking-widest mb-2"
                        style={{ color: "var(--foreground)", opacity: 0.4 }}
                      >
                        Per-Source Breakdown
                      </p>
                      <div className="overflow-x-auto" tabIndex={0} aria-label="Per-source weather data — scroll horizontally to see all columns">
                        <table className="w-full text-xs" style={{ color: "var(--foreground)" }}>
                          <caption className="sr-only">Per-source weather data breakdown</caption>
                          <thead>
                            <tr style={{ opacity: 0.5 }}>
                              <th scope="col" className="text-left py-1 pr-2">Source</th>
                              <th scope="col" className="text-right py-1 px-1">Temp</th>
                              <th scope="col" className="text-right py-1 px-1">Feels</th>
                              <th scope="col" className="text-right py-1 px-1">Hum.</th>
                              <th scope="col" className="text-right py-1 px-1">Wind</th>
                              <th scope="col" className="text-right py-1 px-1">Rain</th>
                              <th scope="col" className="text-right py-1 px-1">UV</th>
                            </tr>
                          </thead>
                          <tbody>
                            {w!.sources.map((s) => (
                              <tr key={s.source}>
                                <td className="py-1 pr-2">
                                  {SOURCE_LINKS[s.source] ? (
                                    <a
                                      href={SOURCE_LINKS[s.source]}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="underline hover:opacity-70"
                                      style={{ color: "var(--accent)" }}
                                      aria-label={`${s.source} (opens in new tab)`}
                                    >
                                      {s.source}
                                    </a>
                                  ) : (
                                    s.source
                                  )}
                                </td>
                                <td className="text-right py-1 px-1">
                                  {userUnitPreference === "imperial"
                                    ? `${Math.round((s.temp * 9) / 5 + 32)}°F`
                                    : `${s.temp}°C`}
                                </td>
                                <td className="text-right py-1 px-1">
                                  {userUnitPreference === "imperial"
                                    ? `${Math.round((s.feelsLike * 9) / 5 + 32)}°F`
                                    : `${s.feelsLike}°C`}
                                </td>
                                <td className="text-right py-1 px-1">{s.humidity}%</td>
                                <td className="text-right py-1 px-1">
                                  {userUnitPreference === "imperial"
                                    ? `${Math.round(s.windSpeed * 0.621)}mph`
                                    : `${s.windSpeed}km/h`}{" "}
                                  {s.windDir}
                                </td>
                                <td className="text-right py-1 px-1">{s.rainChance}%</td>
                                <td className="text-right py-1 px-1">{s.uvIndex}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Data sources badge */}
                  <div className="flex items-center gap-2 pt-1">
                    <span
                      className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                      style={{
                        background: ACCURACY_COLOR[w!.accuracyScore],
                      }}
                      aria-hidden="true"
                    />
                    <span
                      className="text-xs"
                      style={{ color: "var(--foreground)", opacity: 0.5 }}
                    >
                      {w!.accuracyScore} accuracy · {w!.stationName} (
                      {w!.stationDistanceKm} km) · {w!.source}
                      {w!.sources && w!.sources.length > 1 && (
                        <> — averaged from {w!.sources.length} sources</>
                      )}
                    </span>
                  </div>

                  {/* Weather source attribution */}
                  <div
                    className="rounded-xl p-3"
                    style={{ background: "var(--background)" }}
                  >
                    <p
                      className="text-xs font-semibold uppercase tracking-widest mb-1.5"
                      style={{ color: "var(--foreground)", opacity: 0.4 }}
                    >
                      Data Sources &amp; Credits
                    </p>
                    <p
                      className="text-xs leading-relaxed"
                      style={{ color: "var(--foreground)", opacity: 0.5 }}
                    >
                      Weather data from{" "}
                      {[...new Set([
                        ...(w!.sources ?? []).map((s) => s.source),
                        ...(w!.sources ? [] : [w!.source]),
                      ])]
                        .map((name) => {
                          const link = SOURCE_LINKS[name];
                          return link ? (
                            <a
                              key={name}
                              href={link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="underline hover:opacity-70"
                              style={{ color: "var(--accent)" }}
                              aria-label={`${name} (opens in new tab)`}
                            >
                              {name}
                            </a>
                          ) : (
                            <span key={name}>{name}</span>
                          );
                        })
                        .reduce<React.ReactNode[]>((acc, el, i) => {
                          if (i > 0) acc.push(<span key={`sep-${i}`}>, </span>);
                          acc.push(el);
                          return acc;
                        }, [])}
                      . AI by{" "}
                      <a href="https://openai.com/" target="_blank" rel="noopener noreferrer" className="underline hover:opacity-70" style={{ color: "var(--accent)" }} aria-label="OpenAI (opens in new tab)">OpenAI</a>
                      {" / "}
                      <a href="https://deepmind.google/technologies/gemini/" target="_blank" rel="noopener noreferrer" className="underline hover:opacity-70" style={{ color: "var(--accent)" }} aria-label="Google Gemini (opens in new tab)">Google Gemini</a>
                      . Geocoding by{" "}
                      <a href="https://nominatim.openstreetmap.org/" target="_blank" rel="noopener noreferrer" className="underline hover:opacity-70" style={{ color: "var(--accent)" }} aria-label="OpenStreetMap Nominatim (opens in new tab)">OpenStreetMap Nominatim</a>
                      .
                    </p>
                  </div>

                  {/* Hourly forecast */}
                  {w!.hourly && w!.hourly.length > 0 && (
                    <div className="pt-2">
                      <p
                        className="text-xs font-semibold uppercase tracking-widest mb-2"
                        style={{ color: "var(--foreground)", opacity: 0.4 }}
                      >
                        Hourly Forecast
                      </p>
                      <div className="flex gap-2 overflow-x-auto pb-1" tabIndex={0} role="region" aria-label="Hourly forecast — scroll horizontally">
                        {w!.hourly.filter(h => isHourlyCurrentOrFuture(h.time)).slice(0, HOURLY_FORECAST_LIMIT).map((h, i) => (
                          <div
                            key={i}
                            className="flex-shrink-0 rounded-xl p-2 text-center min-w-[72px]"
                            style={{ background: "var(--background)" }}
                          >
                            <p
                              className="text-xs"
                              style={{
                                color: "var(--foreground)",
                                opacity: 0.5,
                              }}
                            >
                              {formatHourlyTime(h.time)}
                            </p>
                            <p
                              className="text-sm font-medium"
                              style={{ color: "var(--foreground)" }}
                            >
                              {userUnitPreference === "imperial"
                                ? `${Math.round((h.temp * 9) / 5 + 32)}°`
                                : `${h.temp}°`}
                            </p>
                            <p
                              className="text-xs"
                              style={{
                                color: "var(--foreground)",
                                opacity: 0.4,
                              }}
                            >
                              <span aria-hidden="true">🌧</span>{h.rainChance}%
                            </p>
                            <p
                              className="text-xs"
                              style={{
                                color: "var(--foreground)",
                                opacity: 0.35,
                              }}
                            >
                              <span aria-hidden="true">💨</span>{userUnitPreference === "imperial"
                                ? `${Math.round(h.windSpeed * 0.621)}`
                                : h.windSpeed}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </WeatherEffectCard>

                {/* ── AI Loading Skeleton (weather arrived, AI still loading) ── */}
                {aiLoading && !rec?.outfit && (
                  <div
                    className="rounded-2xl p-5 space-y-3"
                    style={{
                      background: "var(--card)",
                      border: "1px solid var(--card-border)",
                    }}
                  >
                    <p
                      className="text-xs font-semibold uppercase tracking-widest"
                      style={{ color: "var(--accent)" }}
                    >
                      ✨ Generating outfit recommendation…
                    </p>
                    <div className="space-y-2 animate-pulse">
                      <div className="h-4 rounded-xl" style={{ background: "var(--background)", width: "80%" }} />
                      <div className="h-4 rounded-xl" style={{ background: "var(--background)", width: "65%" }} />
                      <div className="h-4 rounded-xl" style={{ background: "var(--background)", width: "50%" }} />
                    </div>
                  </div>
                )}

                {/* ── Outfit Recommendation + Follow-Up (revealed with animation) ── */}
                {rec?.outfit && (
                <div className={`space-y-4 ${aiRevealed ? "ai-slide-up-reveal" : ""}`}>
                  {rec.closetWarning && (
                    <div
                      className="rounded-xl px-3 py-2 text-xs"
                      style={{
                        background: "#ff950018",
                        border: "1px solid #ff950033",
                        color: "#ff9500",
                      }}
                    >
                      ⚠️ {rec.closetWarning}
                    </div>
                  )}
                  <WeatherEffectCard
                    condition={getWeatherCondition(w?.description ?? "")}
                    windSpeed={w!.windSpeed}
                    className="rounded-2xl p-5 space-y-3"
                    style={{
                      background: "var(--card)",
                      border: "1px solid var(--card-border)",
                    }}
                  >
                    <h2
                      className="text-xs font-semibold uppercase tracking-widest"
                      style={{ color: "var(--accent)" }}
                    >
                      Outfit Recommendation
                    </h2>
                    <MarkdownRenderer
                      content={rec!.outfit}
                      closetItems={closetItems}
                      className="text-base leading-relaxed"
                      style={{ color: "var(--foreground)" }}
                    />
                    {rec!.reasoning && (
                      <>
                        <h3
                          className="text-xs font-semibold uppercase tracking-widest pt-1"
                          style={{ color: "var(--foreground)", opacity: 0.4 }}
                        >
                          Reasoning
                        </h3>
                        <MarkdownRenderer
                          content={rec!.reasoning}
                          className="text-sm leading-relaxed"
                          style={{ color: "var(--foreground)", opacity: 0.7 }}
                        />
                        <div className="flex items-center gap-2 pt-1">
                          <span
                            className="text-xs"
                            style={{ color: "var(--foreground)", opacity: 0.5 }}
                          >
                            🤖 {result?.meta?.modelUsed ?? rec!.modelUsed ?? "unknown"}
                          </span>
                          {!isPro && !isDev && (
                            <button
                              onClick={() => setShowUpgradeModal(true)}
                              className="rounded-full px-2.5 py-1 text-xs btn-interact"
                              style={{
                                background: "var(--background)",
                                color: "var(--foreground)",
                                border: "1px solid var(--card-border)",
                                opacity: 0.7,
                              }}
                            >
                              ⭐ Upgrade to Pro for GPT-4o
                            </button>
                          )}
                        </div>
                      </>
                    )}
                    {isDev && (rec as { rawOutput?: string })?.rawOutput && (
                      <>
                        <h3
                          className="text-xs font-semibold uppercase tracking-widest pt-1"
                          style={{ color: "#ff9500", opacity: 0.7 }}
                        >
                          🛠️ Raw AI Output (Dev)
                        </h3>
                        <pre
                          className="text-xs leading-relaxed overflow-x-auto whitespace-pre-wrap rounded-xl p-3"
                          style={{
                            background: "var(--background)",
                            color: "var(--foreground)",
                            opacity: 0.6,
                            border: "1px solid var(--card-border)",
                          }}
                        >
                          {(rec as { rawOutput?: string }).rawOutput}
                        </pre>
                      </>
                    )}
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setFeedbackCategory("Style");
                          setFeedbackOpen(true);
                        }}
                        className="text-xs btn-interact rounded-xl px-2 py-1"
                        style={{ color: "var(--foreground)", opacity: 0.45 }}
                      >
                        Was this helpful?
                      </button>
                    </div>
                  </WeatherEffectCard>

                  {/* ── Follow-Up Input ── */}
                  <WeatherEffectCard
                    condition={getWeatherCondition(w?.description ?? "")}
                    windSpeed={w!.windSpeed}
                    className="rounded-2xl p-4"
                    style={{
                      background: "var(--card)",
                      border: "1px solid var(--card-border)",
                    }}
                  >
                    <p
                      className="text-xs font-semibold uppercase tracking-widest mb-2"
                      style={{ color: "var(--foreground)", opacity: 0.4 }}
                    >
                      {followUpMode === "chat" ? "💬 Chat" : "Follow Up"}
                      {dailyLimits && (
                        <span style={{ opacity: 0.7, fontWeight: "normal", textTransform: "none" }}>
                          {" "}
                          — {dailyLimits.followUps.used}/
                          {dailyLimits.followUps.limit === null
                            ? "∞"
                            : dailyLimits.followUps.limit}{" "}
                          used today
                        </span>
                      )}
                    </p>

                    {/* Chat Mode: conversation history */}
                    {followUpMode === "chat" && followUpHistory.length > 0 && (
                      <div className="space-y-3 mb-3">
                        {followUpHistory.map((item, idx) => (
                          <div key={idx} className="space-y-1">
                            <div
                              className="rounded-xl px-3 py-2 text-xs"
                              style={{ background: "var(--accent)", color: "#fff", opacity: 0.9, alignSelf: "flex-end", maxWidth: "85%", marginLeft: "auto" }}
                            >
                              {item.question}
                            </div>
                            <div
                              className="rounded-xl px-3 py-2 text-xs leading-relaxed"
                              style={{ background: "var(--background)", color: "var(--foreground)", border: "1px solid var(--card-border)" }}
                            >
                              {item.outfit}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <form onSubmit={handleFollowUp} className="flex gap-2">
                      <label htmlFor="followup-input" className="sr-only">Follow-up question</label>
                      <input
                        id="followup-input"
                        type="text"
                        value={followUpText}
                        onChange={(e) => setFollowUpText(e.target.value)}
                        placeholder={followUpMode === "chat" ? "Ask a follow-up…" : "e.g. what if I need to wear shoes?"}
                        className="flex-1 rounded-xl px-4 py-2.5 text-sm outline-none"
                        style={{
                          background: "var(--background)",
                          color: "var(--foreground)",
                          border: "1px solid var(--card-border)",
                        }}
                      />
                      <button
                        type="submit"
                        disabled={followUpLoading || !followUpText.trim() || isFollowUpLimitReached}
                        className={`rounded-xl px-4 py-2.5 text-sm font-medium btn-interact disabled:opacity-40 ${planBtnClass}`}
                      >
                        {followUpLoading ? "…" : "Ask"}
                      </button>
                    </form>
                    {followUpError && (
                      <p role="alert" className="text-xs text-red-500 mt-2">{followUpError}</p>
                    )}
                  </WeatherEffectCard>
                </div>
                )}
              </>
            )}

            {isDev && (
              <WeatherEffectCard
                condition={w ? getWeatherCondition(w.description) : "default"}
                windSpeed={w?.windSpeed ?? 0}
                className="rounded-2xl p-5 space-y-3"
                style={{
                  background: "var(--card)",
                  border: "1px solid #ff9500",
                }}
              >
                <h2
                  className="text-xs font-semibold uppercase tracking-widest"
                  style={{ color: "#ff9500" }}
                >
                  🛠️ Dev Chat (no weather context)
                </h2>
                <form onSubmit={handleDevChat} className="flex gap-2">
                  <label htmlFor="devchat-input" className="sr-only">Dev chat message</label>
                  <input
                    id="devchat-input"
                    type="text"
                    value={devChatMessage}
                    onChange={(e) => setDevChatMessage(e.target.value)}
                    placeholder="Send a message directly to the AI…"
                    className="flex-1 rounded-xl px-4 py-2.5 text-sm outline-none"
                    style={{
                      background: "var(--background)",
                      color: "var(--foreground)",
                      border: "1px solid var(--card-border)",
                    }}
                  />
                  <button
                    type="submit"
                    disabled={devChatLoading || !devChatMessage.trim()}
                    className="rounded-xl px-4 py-2.5 text-sm font-medium btn-interact disabled:opacity-40"
                    style={{ background: "#ff9500", color: "#fff" }}
                  >
                    {devChatLoading ? "…" : "Send"}
                  </button>
                </form>
                {devChatError && (
                  <p role="alert" className="text-xs text-red-500">{devChatError}</p>
                )}
                {devChatResult && (
                  <div className="space-y-2">
                    <p
                      className="text-sm leading-relaxed"
                      style={{ color: "var(--foreground)" }}
                    >
                      {devChatResult.outfit}
                    </p>
                    {devChatResult.reasoning && (
                      <p
                        className="text-sm leading-relaxed"
                        style={{ color: "var(--foreground)", opacity: 0.7 }}
                      >
                        {devChatResult.reasoning}
                      </p>
                    )}
                    {devChatResult.rawOutput && (
                      <>
                        <h3
                          className="text-xs font-semibold uppercase tracking-widest pt-1"
                          style={{ color: "#ff9500", opacity: 0.7 }}
                        >
                          Raw AI Output
                        </h3>
                        <pre
                          className="text-xs leading-relaxed overflow-x-auto whitespace-pre-wrap rounded-xl p-3"
                          style={{
                            background: "var(--background)",
                            color: "var(--foreground)",
                            opacity: 0.6,
                            border: "1px solid var(--card-border)",
                          }}
                        >
                          {devChatResult.rawOutput}
                        </pre>
                      </>
                    )}
                  </div>
                )}
              </WeatherEffectCard>
            )}

            {(isDev || showDiagnostics) && (
              <WeatherEffectCard
                condition={w ? getWeatherCondition(w.description) : "default"}
                windSpeed={w?.windSpeed ?? 0}
                className="rounded-2xl p-5 space-y-3"
                style={{
                  background: "var(--card)",
                  border: isDev ? "1px solid #ff9500" : "1px solid var(--card-border)",
                }}
              >
                <h2
                  className="text-xs font-semibold uppercase tracking-widest"
                  style={{ color: isDev ? "#ff9500" : "var(--foreground)" }}
                >
                  🔬 Session Diagnostics
                  {!isDev && <span className="ml-1 normal-case font-normal" style={{ opacity: 0.5 }}>(enabled in settings)</span>}
                </h2>
                <div className="grid grid-cols-2 gap-2 text-xs" style={{ color: "var(--foreground)" }}>
                  <div className="rounded-xl p-2" style={{ background: "var(--background)", border: "1px solid var(--card-border)" }}>
                    <span style={{ opacity: 0.5 }}>Last AI</span>
                    <p className="font-semibold mt-0.5" style={{ color: diagLastAiStatus === "success" ? "#30d158" : diagLastAiStatus === "error" ? "#ff3b30" : "var(--foreground)", opacity: diagLastAiStatus ? 1 : 0.4 }}>
                      {diagLastAiStatus ?? "—"}
                    </p>
                  </div>
                  <div className="rounded-xl p-2" style={{ background: "var(--background)", border: "1px solid var(--card-border)" }}>
                    <span style={{ opacity: 0.5 }}>AI Model</span>
                    <p className="font-semibold mt-0.5" style={{ opacity: diagLastAiProvider ? 1 : 0.4 }}>
                      {diagLastAiProvider ?? "—"}
                    </p>
                  </div>
                  <div className="rounded-xl p-2" style={{ background: "var(--background)", border: "1px solid var(--card-border)" }}>
                    <span style={{ opacity: 0.5 }}>Last Weather</span>
                    <p className="font-semibold mt-0.5" style={{ color: diagLastWeatherStatus === "success" ? "#30d158" : diagLastWeatherStatus === "error" ? "#ff3b30" : "var(--foreground)", opacity: diagLastWeatherStatus ? 1 : 0.4 }}>
                      {diagLastWeatherStatus ?? "—"}
                    </p>
                  </div>
                  <div className="rounded-xl p-2" style={{ background: "var(--background)", border: "1px solid var(--card-border)" }}>
                    <span style={{ opacity: 0.5 }}>Session Errors</span>
                    <p className="font-semibold mt-0.5" style={{ color: diagSessionErrors > 0 ? "#ff3b30" : "#30d158" }}>
                      {diagSessionErrors}
                    </p>
                  </div>
                  <div className="col-span-2 rounded-xl p-2" style={{ background: "var(--background)", border: "1px solid var(--card-border)" }}>
                    <span style={{ opacity: 0.5 }}>Last Fetch</span>
                    <p className="font-semibold mt-0.5" style={{ opacity: diagLastFetchAt ? 1 : 0.4, fontFamily: "monospace" }}>
                      {diagLastFetchAt ? new Date(diagLastFetchAt).toLocaleTimeString() : "—"}
                    </p>
                  </div>
                </div>
                {diagFallbackEvents.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "#ff9500", opacity: 0.7 }}>Fallback Events</p>
                    <ul className="space-y-1">
                      {diagFallbackEvents.map((ev, i) => (
                        <li key={i} className="text-xs rounded-xl px-2 py-1" style={{ background: "var(--background)", color: "#ff9500", border: "1px solid var(--card-border)" }}>{ev}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </WeatherEffectCard>
            )}

            {(result || weatherData) && !loading && !aiLoading && (
              <button
                onClick={handleFetch}
                className="w-full rounded-2xl py-3 text-sm font-medium btn-interact"
                style={{
                  background: "var(--card)",
                  border: "1px solid var(--card-border)",
                  color: "var(--foreground)",
                }}
              >
                🔄 Refresh
              </button>
            )}
          </div>

          {/* ── Drag Divider (only when custom spacing is enabled) ── */}
          {customSpacingEnabled && (
            <div
              role="separator"
              aria-label="Drag to resize columns. Use left/right arrow keys when focused."
              tabIndex={0}
              className="hidden lg:flex items-center justify-center cursor-col-resize self-stretch group"
              style={{ width: 12, marginLeft: -6, marginRight: -6, zIndex: 10 }}
              onMouseDown={onDividerMouseDown}
              onKeyDown={(e) => {
                const step = 0.05;
                if (e.key === "ArrowLeft") {
                  e.preventDefault();
                  const newRatio = Math.max(0.4, customRatioRef.current - step);
                  customRatioRef.current = newRatio;
                  setCustomRatio(newRatio);
                  try { localStorage.setItem("skystyle_custom_spacing_ratio", String(newRatio)); } catch { /* ignore */ }
                } else if (e.key === "ArrowRight") {
                  e.preventDefault();
                  const newRatio = Math.min(4, customRatioRef.current + step);
                  customRatioRef.current = newRatio;
                  setCustomRatio(newRatio);
                  try { localStorage.setItem("skystyle_custom_spacing_ratio", String(newRatio)); } catch { /* ignore */ }
                }
              }}
              title="Drag to resize columns"
            >
              <div
                className="w-1 rounded-full h-16 transition-opacity duration-150 group-hover:opacity-100 opacity-30"
                style={{ background: "var(--card-border)", minHeight: 48 }}
              />
            </div>
          )}

          {/* ── Right Column: Config & Settings ── */}
          <div
            className="space-y-5"
            style={{ flex: rightFlex }}
          >
            {/* ── Gender & Location Consent ── */}
            <div
              id="section-settings"
              className="rounded-2xl p-4 space-y-3"
              style={{
                background: "var(--card)",
                border: "1px solid var(--card-border)",
              }}
            >
              <div>
                <p
                  id="gender-label"
                  className="text-xs font-semibold uppercase tracking-widest mb-2"
                  style={{ color: "var(--foreground)", opacity: 0.4 }}
                >
                  Gender (for outfit recommendations)
                </p>
                <div className="flex flex-wrap gap-2" role="group" aria-labelledby="gender-label">
                  {["Male", "Female", "Other", "Other - Manual"].map((opt) => (
                    <button
                      key={opt}
                      onClick={() => setGender(opt === "Other" ? "N/A" : opt)}
                      className="rounded-xl px-3 py-1.5 text-xs font-medium btn-interact"
                      aria-pressed={isGenderActive(opt, gender)}
                      style={{
                        background: isGenderActive(opt, gender)
                          ? "var(--accent)"
                          : "var(--background)",
                        color: isGenderActive(opt, gender)
                          ? "#fff"
                          : "var(--foreground)",
                        border: "1px solid var(--card-border)",
                      }}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
                {gender === "Other - Manual" && (
                  <>
                    <label htmlFor="custom-gender-input" className="sr-only">Custom gender description</label>
                    <input
                      id="custom-gender-input"
                      type="text"
                      value={customGender}
                      onChange={(e) => setCustomGender(e.target.value.slice(0, MAX_GENDER_LENGTH))}
                      placeholder={`Type your gender (max ${MAX_GENDER_LENGTH} chars)`}
                      maxLength={MAX_GENDER_LENGTH}
                      className="mt-2 w-full rounded-xl px-3 py-2 text-xs outline-none"
                      style={{
                        background: "var(--background)",
                        color: "var(--foreground)",
                        border: "1px solid var(--card-border)",
                      }}
                    />
                  </>
                )}
              </div>
              <div>
                <p
                  id="units-label"
                  className="text-xs font-semibold uppercase tracking-widest mb-2"
                  style={{ color: "var(--foreground)", opacity: 0.4 }}
                >
                  Units
                </p>
                <div className="flex gap-2" role="group" aria-labelledby="units-label">
                  {(["metric", "imperial"] as const).map((unit) => (
                    <button
                      key={unit}
                      aria-pressed={userUnitPreference === unit}
                      onClick={async () => {
                        setUserUnitPreference(unit);
                        try {
                          await fetch("/api/settings", {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ unit_preference: unit }),
                          });
                        } catch {
                          /* ignore */
                        }
                      }}
                      className="rounded-xl px-3 py-1.5 text-xs font-medium btn-interact capitalize"
                      style={{
                        background: userUnitPreference === unit ? "var(--accent)" : "var(--background)",
                        color: userUnitPreference === unit ? "#fff" : "var(--foreground)",
                        border: "1px solid var(--card-border)",
                      }}
                    >
                      {unit === "metric" ? "°C / km/h" : "°F / mph"}
                    </button>
                  ))}
                </div>
              </div>
              <Checkbox
                checked={shareLocation}
                onChange={setShareLocation}
                label="Share my location with AI for more relevant recommendations"
              />
              <Checkbox
                checked={weatherOnly}
                onChange={setWeatherOnly}
                label="Weather only (skip AI outfit recommendation)"
              />
            </div>

            {/* ── Closet Management ── */}
            <div
              id="closet-section"
              className="rounded-2xl p-4 space-y-3"
              style={{
                background: "var(--card)",
                border: "1px solid var(--card-border)",
              }}
            >
              <p
                className="text-xs font-semibold uppercase tracking-widest"
                style={{ color: "var(--foreground)", opacity: 0.4 }}
              >
                👕 My Closet
              </p>
              <form onSubmit={addClosetItem} className="flex gap-2">
                <label htmlFor="closet-input" className="sr-only">Add a closet item</label>
                <input
                  id="closet-input"
                  type="text"
                  value={newClosetItem}
                  onChange={(e) => setNewClosetItem(e.target.value)}
                  placeholder="Add an item (e.g. Blue denim jacket)"
                  className="flex-1 rounded-xl px-4 py-2.5 text-sm outline-none"
                  style={{
                    background: "var(--background)",
                    color: "var(--foreground)",
                    border: "1px solid var(--card-border)",
                  }}
                />
                <button
                  type="submit"
                  disabled={closetLoading || !newClosetItem.trim()}
                  className={`rounded-xl px-4 py-2.5 text-sm font-medium btn-interact disabled:opacity-40 ${planBtnClass}`}
                >
                  {closetLoading ? "…" : "Add"}
                </button>
              </form>
              {closetItems.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {closetItems.map((item) => (
                    <span
                      key={item}
                      className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs"
                      style={{
                        background: "var(--background)",
                        color: "var(--foreground)",
                        border: "1px solid var(--card-border)",
                      }}
                    >
                      {item}
                      <button
                        onClick={() => removeClosetItem(item)}
                        disabled={closetLoading}
                        className="hover:opacity-70 disabled:opacity-30"
                        style={{ color: "#ff3b30" }}
                        aria-label={`Remove ${item}`}
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              )}
              {closetItems.length === 0 && (
                <p
                  className="text-xs"
                  style={{ color: "var(--foreground)", opacity: 0.4 }}
                >
                  No items in your closet yet. Add some to get personalized recommendations!
                </p>
              )}
              <Checkbox
                checked={forceCloset}
                onChange={setForceCloset}
                label="Force recommendation to use closet"
                description={closetItems.length === 0 ? "Add items to your closet for more accurate recommendations" : undefined}
              />
              <Link
                href="/closet"
                className="block w-full text-center rounded-xl py-2 text-xs btn-interact"
                style={{
                  color: "var(--foreground)",
                  opacity: 0.55,
                  border: "1px solid var(--card-border)",
                }}
              >
                See full closet →
              </Link>
            </div>

            {/* ── Weather Sources ── */}
            <div
              className="rounded-2xl p-4 space-y-3"
              style={{
                background: "var(--card)",
                border: "1px solid var(--card-border)",
              }}
            >
              <button
                onClick={() => setSourcesExpanded(!sourcesExpanded)}
                className="w-full flex items-center justify-between btn-interact"
                aria-expanded={sourcesExpanded}
                aria-controls="sources-panel"
              >
                <p
                  className="text-xs font-semibold uppercase tracking-widest"
                  style={{ color: "var(--foreground)", opacity: 0.4 }}
                >
                  🌐 Weather Sources
                </p>
                <span
                  className="text-xs"
                  style={{ color: "var(--foreground)", opacity: 0.4 }}
                >
                  {sourcesExpanded ? "▲" : "▼"}
                </span>
              </button>

              {sourcesExpanded && (
                <div id="sources-panel" className="space-y-3">
                  {/* Source mode selector */}
                  <div>
                    <p
                      className="text-xs mb-2"
                      style={{ color: "var(--foreground)", opacity: 0.5 }}
                    >
                      Source mode
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {([
                        { key: "builtin" as SourceMode, label: "Built-in only" },
                        { key: "both" as SourceMode, label: "Custom + Built-in" },
                        { key: "custom" as SourceMode, label: "Custom only" },
                      ]).map(({ key, label }) => (
                        <button
                          key={key}
                          onClick={() => updateSourceMode(key)}
                          className="rounded-xl px-3 py-1.5 text-xs font-medium btn-interact"
                          style={{
                            background: sourceMode === key ? "var(--accent)" : "var(--background)",
                            color: sourceMode === key ? "#fff" : "var(--foreground)",
                            border: "1px solid var(--card-border)",
                          }}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Existing custom sources */}
                  {customSources.length > 0 && (
                    <div className="space-y-2">
                      <p
                        className="text-xs"
                        style={{ color: "var(--foreground)", opacity: 0.5 }}
                      >
                        Your sources ({customSources.length})
                      </p>
                      {customSources.map((source) => (
                        <div
                          key={source.id}
                          className="flex items-center gap-2 rounded-xl px-3 py-2"
                          style={{
                            background: "var(--background)",
                            border: "1px solid var(--card-border)",
                          }}
                        >
                          <span className="text-xs">
                            {source.type === "rss" ? "📡" : source.type === "api_key" ? "🔑" : "🔗"}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p
                              className="text-xs font-medium truncate"
                              style={{ color: "var(--foreground)" }}
                            >
                              {source.name}
                            </p>
                            <p
                              className="text-xs truncate"
                              style={{ color: "var(--foreground)", opacity: 0.4 }}
                            >
                              {source.type === "api_key"
                                ? `${source.service} · ••••${source.value.slice(-4)}`
                                : source.value}
                            </p>
                          </div>
                          <span
                            className="rounded-full px-2 py-0.5 text-xs"
                            style={{
                              background: "var(--card)",
                              color: "var(--foreground)",
                              opacity: 0.5,
                            }}
                          >
                            {source.type === "rss" ? "RSS" : source.type === "api_key" ? "API Key" : "URL"}
                          </span>
                          <button
                            onClick={() => removeCustomSource(source.id)}
                            className="hover:opacity-70"
                            style={{ color: "#ff3b30" }}
                            aria-label={`Remove ${source.name}`}
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add new source form */}
                  <form onSubmit={addCustomSource} className="space-y-2">
                    <p
                      className="text-xs"
                      style={{ color: "var(--foreground)", opacity: 0.5 }}
                    >
                      Add a source
                    </p>
                    <div className="flex gap-2">
                      {([
                        { key: "url" as const, label: "🔗 URL" },
                        { key: "rss" as const, label: "📡 RSS" },
                        { key: "api_key" as const, label: "🔑 API Key" },
                      ]).map(({ key, label }) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setNewSourceType(key)}
                          className="rounded-xl px-3 py-1.5 text-xs font-medium btn-interact"
                          style={{
                            background: newSourceType === key ? "var(--accent)" : "var(--background)",
                            color: newSourceType === key ? "#fff" : "var(--foreground)",
                            border: "1px solid var(--card-border)",
                          }}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <input
                      type="text"
                      value={newSourceName}
                      onChange={(e) => setNewSourceName(e.target.value.slice(0, 50))}
                      placeholder="Source name (e.g. My Weather Feed)"
                      maxLength={50}
                      className="w-full rounded-xl px-3 py-2 text-xs outline-none"
                      style={{
                        background: "var(--background)",
                        color: "var(--foreground)",
                        border: "1px solid var(--card-border)",
                      }}
                    />
                    <input
                      type="text"
                      value={newSourceValue}
                      onChange={(e) => setNewSourceValue(e.target.value.slice(0, 500))}
                      placeholder={
                        newSourceType === "rss"
                          ? "RSS feed URL (https://...)"
                          : newSourceType === "api_key"
                          ? "API key"
                          : "URL (will be sent as context to AI, not fetched)"
                      }
                      maxLength={500}
                      className="w-full rounded-xl px-3 py-2 text-xs outline-none"
                      style={{
                        background: "var(--background)",
                        color: "var(--foreground)",
                        border: "1px solid var(--card-border)",
                      }}
                    />
                    {newSourceType === "api_key" && (
                      <select
                        value={newSourceService}
                        onChange={(e) => setNewSourceService(e.target.value)}
                        className="w-full rounded-xl px-3 py-2 text-xs outline-none"
                        style={{
                          background: "var(--background)",
                          color: "var(--foreground)",
                          border: "1px solid var(--card-border)",
                        }}
                      >
                        <option value="weatherapi">WeatherAPI.com</option>
                        <option value="visualcrossing">Visual Crossing</option>
                        <option value="pirateweather">Pirate Weather</option>
                        <option value="openweather">OpenWeather</option>
                      </select>
                    )}
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={!newSourceName.trim() || !newSourceValue.trim()}
                        className={`rounded-xl px-4 py-2 text-xs font-medium btn-interact disabled:opacity-40 ${planBtnClass}`}
                      >
                        Add Source
                      </button>
                    </div>
                  </form>

                  <p
                    className="text-xs"
                    style={{ color: "var(--foreground)", opacity: 0.3 }}
                  >
                    {newSourceType === "url"
                      ? "URLs are not fetched — they are sent as context to the AI."
                      : newSourceType === "rss"
                      ? "RSS feeds are fetched server-side for weather content."
                      : "API keys are used with the selected weather service."}
                    {" "}Sources are stored locally in your browser.
                  </p>
                </div>
              )}
            </div>

            {/* ── Plan & Credits Card ── */}
            <div
              className="rounded-2xl p-5 space-y-3"
              style={{
                background: "var(--card)",
                border: "1px solid var(--card-border)",
              }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2
                    className="text-sm font-semibold"
                    style={{ color: "var(--foreground)" }}
                  >
                    {isDev ? "🛠️ Dev Plan" : isPro ? "⭐ Pro Plan" : "Free Plan"}
                  </h2>
                  <p
                    className="text-xs mt-0.5"
                    style={{ color: "var(--foreground)", opacity: 0.5 }}
                  >
                    {isDev ? "Special Access" : isPro ? "A$4/month" : "A$0 — free forever"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {isPro && creditsRemaining !== null && (
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium ${planBtnClass}`}
                      style={planBtnStyle}
                    >
                      {creditsRemaining} credits
                    </span>
                  )}
                  {!isPro && !isDev && (
                    <button
                      onClick={() => setShowUpgradeModal(true)}
                      className="rounded-full px-3 py-1 text-xs font-medium btn-interact"
                      style={{ background: "var(--accent)", color: "#fff" }}
                    >
                      ☕ Upgrade to Pro
                    </button>
                  )}
                </div>
              </div>

              {/* Daily limits info */}
              {dailyLimits && !isPro && (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  {[
                    {
                      label: "AI uses",
                      used: dailyLimits.ai.used,
                      limit: dailyLimits.ai.limit,
                    },
                    {
                      label: "Follow-ups",
                      used: dailyLimits.followUps.used,
                      limit: dailyLimits.followUps.limit,
                    },
                    {
                      label: "Closet uses",
                      used: dailyLimits.closet.used,
                      limit: dailyLimits.closet.limit,
                    },
                    {
                      label: "Source picks",
                      used: dailyLimits.sourcePicks.used,
                      limit: dailyLimits.sourcePicks.limit,
                    },
                  ].map(({ label, used, limit }) => (
                    <div
                      key={label}
                      className="rounded-xl p-2 text-center"
                      style={{ background: "var(--background)" }}
                    >
                      <p
                        className="text-xs"
                        style={{ color: "var(--foreground)", opacity: 0.45 }}
                      >
                        {label}
                      </p>
                      <p
                        className="text-sm font-medium"
                        style={{
                          color:
                            limit !== null && used >= limit ? "#ff3b30" : "var(--foreground)",
                        }}
                      >
                        {used}/{limit === null ? "∞" : limit}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Bring Your Own Key (Pro / Dev) ── */}
            {(isPro || isDev) && (
              <div
                className="rounded-2xl overflow-hidden"
                style={{
                  background: "var(--card)",
                  border: "1px solid var(--card-border)",
                }}
              >
                {/* Collapsible header */}
                <button
                  type="button"
                  onClick={() => {
                    const next = !byokOpen;
                    setByokOpen(next);
                    try { localStorage.setItem("skystyle_byok_open", String(next)); } catch { /* ignore */ }
                  }}
                  className="w-full flex items-center justify-between px-4 py-3 text-xs btn-interact"
                  style={{ color: "var(--foreground)" }}
                  aria-expanded={byokOpen}
                >
                  <span className="font-semibold uppercase tracking-widest" style={{ opacity: 0.4 }}>
                    🔑 Bring Your Own Key
                  </span>
                  <span style={{ opacity: 0.4, fontSize: 10 }}>{byokOpen ? "▲" : "▼"}</span>
                </button>
                {byokOpen && (
                <div className="px-4 pb-4 space-y-3">

                {/* AI provider selector */}
                <div>
                  <p className="text-xs mb-1.5" style={{ color: "var(--foreground)", opacity: 0.55 }}>
                    AI provider for your key
                  </p>
                  <div className="flex gap-2">
                    {(["openai", "gemini"] as const).map((prov) => (
                      <button
                        key={prov}
                        type="button"
                        onClick={() => {
                          setByokProvider(prov);
                          try { localStorage.setItem("skystyle_byok_provider", prov); } catch { /* ignore */ }
                        }}
                        className="rounded-xl px-3 py-1.5 text-xs font-medium btn-interact"
                        style={{
                          background: byokProvider === prov ? "var(--accent)" : "var(--background)",
                          color: byokProvider === prov ? "#fff" : "var(--foreground)",
                          border: "1px solid var(--card-border)",
                        }}
                      >
                        {prov === "openai" ? "🤖 OpenAI" : "✨ Gemini"}
                      </button>
                    ))}
                  </div>
                </div>

                <p className="text-xs" style={{ color: "var(--foreground)", opacity: 0.55 }}>
                  {byokProvider === "openai"
                    ? "Provide your OpenAI API key (sk-…)."
                    : "Provide your Google Gemini API key."}{" "}
                  Stored locally on your device only — never sent to Sky Style servers.
                </p>
                <input
                  type="password"
                  value={userApiKey}
                  onChange={(e) => {
                    const val = e.target.value.slice(0, 200);
                    setUserApiKey(val);
                    try { localStorage.setItem("skystyle_byok_key", val); } catch { /* ignore */ }
                  }}
                  placeholder={byokProvider === "openai" ? "sk-… (optional)" : "AI… (optional)"}
                  autoComplete="off"
                  className="w-full rounded-xl px-3 py-2 text-xs outline-none"
                  style={{
                    background: "var(--background)",
                    color: "var(--foreground)",
                    border: "1px solid var(--card-border)",
                  }}
                />
                {userApiKey && (
                  <button
                    onClick={() => {
                      setUserApiKey("");
                      try { localStorage.removeItem("skystyle_byok_key"); } catch { /* ignore */ }
                    }}
                    className="text-xs btn-interact rounded-lg px-2 py-1"
                    style={{ color: "#ff3b30" }}
                  >
                    Clear key
                  </button>
                )}

                {/* Custom AI prompt (Pro/Dev) */}
                <div className="space-y-1.5 pt-1">
                  <p
                    className="text-xs font-semibold uppercase tracking-widest"
                    style={{ color: "var(--foreground)", opacity: 0.4 }}
                  >
                    ✏️ Custom AI Prompt
                  </p>
                  <p className="text-xs" style={{ color: "var(--foreground)", opacity: 0.5 }}>
                    Replaces the default Sky Style prompt. Must include JSON output instructions. Stored locally only.
                  </p>
                  <textarea
                    value={clientCustomPrompt}
                    onChange={(e) => {
                      const val = e.target.value.slice(0, 1000);
                      setClientCustomPrompt(val);
                      try { localStorage.setItem("skystyle_byok_custom_prompt", val); } catch { /* ignore */ }
                    }}
                    placeholder={`Leave blank to use the default Sky Style prompt…`}
                    rows={4}
                    className="w-full rounded-xl px-3 py-2 text-xs outline-none resize-none"
                    style={{
                      background: "var(--background)",
                      color: "var(--foreground)",
                      border: "1px solid var(--card-border)",
                    }}
                  />
                  {clientCustomPrompt && (
                    <button
                      onClick={() => {
                        setClientCustomPrompt("");
                        try { localStorage.removeItem("skystyle_byok_custom_prompt"); } catch { /* ignore */ }
                      }}
                      className="text-xs btn-interact rounded-lg px-2 py-1"
                      style={{ color: "#ff3b30" }}
                    >
                      Clear prompt
                    </button>
                  )}
                </div>
                </div>
                )}
              </div>
            )}

          </div>
        </div>
      </main>

      <footer
        className="px-6 py-6 text-center text-xs space-y-2"
        style={{ color: "var(--foreground)", opacity: 0.3 }}
      >
        <p>© {new Date().getFullYear()} Sky Style</p>
        <p>
          Weather data:{" "}
          {Object.entries(SOURCE_LINKS).map(([name, link], i) => (
            <span key={name}>
              {i > 0 && " · "}
              <a href={link} target="_blank" rel="noopener noreferrer" className="underline hover:opacity-70" style={{ color: "var(--foreground)" }}>{name}</a>
            </span>
          ))}
        </p>
        <p>
          AI:{" "}
          <a href="https://openai.com/" target="_blank" rel="noopener noreferrer" className="underline hover:opacity-70" style={{ color: "var(--foreground)" }}>OpenAI</a>
          {" · "}
          <a href="https://deepmind.google/technologies/gemini/" target="_blank" rel="noopener noreferrer" className="underline hover:opacity-70" style={{ color: "var(--foreground)" }}>Google Gemini</a>
          {" · Geocoding: "}
          <a href="https://nominatim.openstreetmap.org/" target="_blank" rel="noopener noreferrer" className="underline hover:opacity-70" style={{ color: "var(--foreground)" }}>OSM Nominatim</a>
          {" · Hosted on "}
          <a href="https://vercel.com/" target="_blank" rel="noopener noreferrer" className="underline hover:opacity-70" style={{ color: "var(--foreground)" }}>Vercel</a>
        </p>
        <p>
          <Link
            href="https://github.com/COOLmanYT/what2wear"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:opacity-70"
            style={{ color: "var(--foreground)" }}
          >
            View on GitHub
          </Link>
          {" · "}
          <Link
            href="/changelog"
            className="underline hover:opacity-70 inline-flex items-center gap-1"
            style={{ color: "var(--foreground)" }}
            onClick={() => {
              setChangelogUnread(false);
              try { localStorage.setItem("skystyle_last_seen_changelog", "__dismiss__"); } catch { /* ignore */ }
            }}
          >
            Changelog
            {changelogUnread && (
              <span
                style={{
                  display: "inline-block",
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "#ff3b30",
                  flexShrink: 0,
                  verticalAlign: "middle",
                  marginBottom: 1,
                }}
                aria-label="New updates"
              />
            )}
          </Link>
          {" · "}
          <Link href="/terms" className="underline hover:opacity-70" style={{ color: "var(--foreground)" }}>
            Terms
          </Link>
          {" · "}
          <Link href="/privacy" className="underline hover:opacity-70" style={{ color: "var(--foreground)" }}>
            Privacy
          </Link>
          {" · "}
          <button
            type="button"
            onClick={() => setFeedbackOpen(true)}
            className="underline hover:opacity-70"
            style={{ color: "var(--foreground)", background: "none", border: "none", cursor: "pointer", font: "inherit", padding: 0 }}
          >
            {simpleMode ? "Talk to the Developer" : "Send Feedback"}
          </button>
        </p>
      </footer>
    </div>
  );
}

function weatherEmoji(description: string, isDay: boolean): string {
  const d = description.toLowerCase();
  if (d.includes("thunder")) return "⛈️";
  if (d.includes("snow")) return "❄️";
  if (d.includes("rain") || d.includes("drizzle")) return "🌧️";
  if (d.includes("cloud") || d.includes("overcast")) return isDay ? "⛅" : "☁️";
  if (d.includes("fog") || d.includes("mist") || d.includes("haze")) return "🌫️";
  if (d.includes("wind")) return "💨";
  return isDay ? "☀️" : "🌙";
}
