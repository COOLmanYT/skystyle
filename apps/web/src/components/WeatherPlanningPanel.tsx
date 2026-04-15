"use client";

import { useState, useEffect, useCallback, useMemo } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

export type EnvironmentType = "outside" | "inside" | "hybrid";

export interface TimeSlot {
  id: string;
  startTime: string; // "HH:MM"
  endTime: string;   // "HH:MM"
  environment: EnvironmentType;
  temperature: string; // only relevant for inside/hybrid
}

export type ComplexityLevel = 0 | 1 | 2 | 3;
export const COMPLEXITY_LABELS: Record<ComplexityLevel, string> = {
  0: "Simple",
  1: "Simple+",
  2: "Advanced",
  3: "Pro",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function newSlot(): TimeSlot {
  return {
    id: crypto.randomUUID(),
    startTime: "09:00",
    endTime: "17:00",
    environment: "outside",
    temperature: "",
  };
}

function formatSlotTime(time: string) {
  if (!time || !time.includes(":")) return time || "";
  const parts = time.split(":");
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (isNaN(h) || isNaN(m)) return time;
  const ampm = h < 12 ? "am" : "pm";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${m.toString().padStart(2, "0")}${ampm}`;
}

const ENV_LABELS: Record<EnvironmentType, string> = {
  outside: "🌳 Outside",
  inside: "🏠 Inside",
  hybrid: "🔀 Hybrid",
};

// ─── Sub-components ──────────────────────────────────────────────────────────

interface SlotRowProps {
  slot: TimeSlot;
  onChange: (updated: TimeSlot) => void;
  onRemove: () => void;
  canRemove: boolean;
}

function SlotRow({ slot, onChange, onRemove, canRemove }: SlotRowProps) {
  const showTemp = slot.environment === "inside" || slot.environment === "hybrid";

  return (
    <div
      className="rounded-xl p-3 space-y-2.5"
      style={{
        background: "var(--background)",
        border: "1px solid var(--card-border)",
      }}
    >
      {/* Time range row */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1 flex-1 min-w-0">
          <input
            type="time"
            value={slot.startTime}
            onChange={(e) => onChange({ ...slot, startTime: e.target.value })}
            className="rounded-lg px-2 py-1.5 text-xs flex-1 min-w-0 outline-none"
            style={{
              background: "var(--card)",
              border: "1px solid var(--card-border)",
              color: "var(--foreground)",
            }}
            aria-label="Start time"
          />
          <span className="text-xs opacity-40 shrink-0" style={{ color: "var(--foreground)" }}>–</span>
          <input
            type="time"
            value={slot.endTime}
            onChange={(e) => onChange({ ...slot, endTime: e.target.value })}
            className="rounded-lg px-2 py-1.5 text-xs flex-1 min-w-0 outline-none"
            style={{
              background: "var(--card)",
              border: "1px solid var(--card-border)",
              color: "var(--foreground)",
            }}
            aria-label="End time"
          />
        </div>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="rounded-lg px-2 py-1.5 text-xs opacity-50 hover:opacity-80 transition-opacity shrink-0"
            style={{ color: "var(--foreground)" }}
            aria-label="Remove time slot"
          >
            ✕
          </button>
        )}
      </div>

      {/* Environment selector */}
      <div className="flex gap-1.5 flex-wrap">
        {(["outside", "inside", "hybrid"] as EnvironmentType[]).map((env) => {
          const active = slot.environment === env;
          return (
            <button
              key={env}
              type="button"
              onClick={() => onChange({ ...slot, environment: env, temperature: "" })}
              className="rounded-lg px-2.5 py-1 text-xs font-medium transition-all"
              style={{
                background: active ? "var(--accent)" : "var(--card)",
                color: active ? "#fff" : "var(--foreground)",
                border: active ? "1px solid var(--accent)" : "1px solid var(--card-border)",
                opacity: active ? 1 : 0.65,
              }}
            >
              {ENV_LABELS[env]}
            </button>
          );
        })}
      </div>

      {/* Temperature input (inside/hybrid only) */}
      {showTemp && (
        <div className="flex items-center gap-2">
          <label className="text-xs opacity-60 shrink-0" style={{ color: "var(--foreground)" }}>
            🌡️ Approx. temp:
          </label>
          <input
            type="text"
            value={slot.temperature}
            onChange={(e) => onChange({ ...slot, temperature: e.target.value.slice(0, 10) })}
            placeholder="e.g. 22°C"
            className="rounded-lg px-2 py-1.5 text-xs flex-1 min-w-0 outline-none"
            style={{
              background: "var(--card)",
              border: "1px solid var(--card-border)",
              color: "var(--foreground)",
            }}
            aria-label="Approximate indoor temperature"
          />
        </div>
      )}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export interface WeatherPlanningState {
  slots: TimeSlot[];
  complexity: ComplexityLevel;
}

interface Props {
  onChange?: (state: WeatherPlanningState) => void;
}

export default function WeatherPlanningPanel({ onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [slots, setSlots] = useState<TimeSlot[]>([newSlot()]);
  const [complexity, setComplexity] = useState<ComplexityLevel>(0);
  // Prevents showing stale default slot summary before localStorage has loaded
  const [mounted, setMounted] = useState(false);
  // Visibility setting: "always_open" | "closed_default" | "disabled"
  const [visibility, setVisibility] = useState<"always_open" | "closed_default" | "disabled">("closed_default");

  // Load persisted state on mount
  useEffect(() => {
    try {
      const vis = (localStorage.getItem("skystyle_weather_planning") ?? "closed_default") as "always_open" | "closed_default" | "disabled";
      setVisibility(vis);

      const saved = localStorage.getItem("skystyle_planning_panel");
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<WeatherPlanningState & { open: boolean }>;
        if (Array.isArray(parsed.slots) && parsed.slots.length > 0) setSlots(parsed.slots);
        if (parsed.complexity != null) setComplexity(parsed.complexity as ComplexityLevel);
        // Respect visibility setting when restoring open state
        if (vis === "always_open") {
          setOpen(true);
        } else if (parsed.open != null) {
          setOpen(parsed.open as boolean);
        }
      } else if (vis === "always_open") {
        setOpen(true);
      }
    } catch { /* ignore */ }
    setMounted(true);
  }, []);

  // Persist and notify parent on state changes
  const persist = useCallback(
    (nextSlots: TimeSlot[], nextComplexity: ComplexityLevel, nextOpen: boolean) => {
      try {
        localStorage.setItem(
          "skystyle_planning_panel",
          JSON.stringify({ slots: nextSlots, complexity: nextComplexity, open: nextOpen })
        );
      } catch { /* ignore */ }
      onChange?.({ slots: nextSlots, complexity: nextComplexity });
    },
    [onChange]
  );

  function handleToggle() {
    const next = !open;
    setOpen(next);
    persist(slots, complexity, next);
  }

  function handleSlotChange(updated: TimeSlot) {
    const next = slots.map((s) => (s.id === updated.id ? updated : s));
    setSlots(next);
    persist(next, complexity, open);
  }

  function handleAddSlot() {
    const next = [...slots, newSlot()];
    setSlots(next);
    persist(next, complexity, open);
  }

  function handleRemoveSlot(id: string) {
    if (slots.length <= 1) return;
    const next = slots.filter((s) => s.id !== id);
    setSlots(next);
    persist(next, complexity, open);
  }

  function handleComplexity(val: number) {
    const next = val as ComplexityLevel;
    setComplexity(next);
    persist(slots, next, open);
  }

  // Build a short summary string for the collapsed header
  const slotSummary = useMemo(
    () => slots.map((s) => `${formatSlotTime(s.startTime)}–${formatSlotTime(s.endTime)}`).join(", "),
    [slots]
  );

  // Hidden when user has disabled this panel
  if (visibility === "disabled") return null;

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: "var(--card)",
        border: "1px solid var(--card-border)",
        boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
      }}
    >
      {/* ── Header / Toggle ── */}
      <button
        type="button"
        onClick={handleToggle}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium transition-colors hover:opacity-80"
        style={{ color: "var(--foreground)", background: "transparent" }}
        aria-expanded={open}
      >
        <span className="flex items-center gap-2">
          <span>🗓️ Weather Planning</span>
          {!open && mounted && slots.length > 0 && (
            <span
              className="text-xs font-normal truncate max-w-[180px]"
              style={{ color: "var(--foreground)", opacity: 0.45 }}
            >
              {slotSummary}
            </span>
          )}
        </span>
        <span
          className="text-xs transition-transform duration-200"
          style={{
            display: "inline-block",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            color: "var(--foreground)",
            opacity: 0.5,
          }}
          aria-hidden="true"
        >
          ▾
        </span>
      </button>

      {/* ── Collapsible body ── */}
      <div className={`planning-panel-body${open ? "" : " collapsed"}`}>
        <div
          className="planning-panel-inner"
          aria-hidden={!open}
          inert={open ? undefined : true}
        >
          <div
            className="px-4 pb-4 space-y-4"
            style={{ borderTop: "1px solid var(--card-border)" }}
          >
            {/* ── Time slots ── */}
            <div className="space-y-2 pt-3">
              <p className="text-xs font-semibold uppercase tracking-wide opacity-50" style={{ color: "var(--foreground)" }}>
                Time Slots
              </p>
              {slots.map((slot) => (
                <SlotRow
                  key={slot.id}
                  slot={slot}
                  onChange={handleSlotChange}
                  onRemove={() => handleRemoveSlot(slot.id)}
                  canRemove={slots.length > 1}
                />
              ))}
              <button
                type="button"
                onClick={handleAddSlot}
                className="w-full rounded-xl py-2 text-xs font-medium transition-opacity hover:opacity-70"
                style={{
                  background: "var(--background)",
                  border: "1px dashed var(--card-border)",
                  color: "var(--foreground)",
                  opacity: 0.7,
                }}
              >
                + Add Time Slot
              </button>
            </div>

            {/* ── Complexity slider ── */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide opacity-50" style={{ color: "var(--foreground)" }}>
                  Recommendation Mode
                </p>
                <span
                  className="text-xs font-semibold px-2 py-0.5 rounded-full"
                  style={{
                    background: "var(--accent)",
                    color: "#fff",
                    opacity: 0.9,
                  }}
                >
                  {COMPLEXITY_LABELS[complexity]}
                </span>
              </div>

              <div className="px-1">
                <input
                  type="range"
                  min={0}
                  max={3}
                  step={1}
                  value={complexity}
                  onChange={(e) => handleComplexity(Number(e.target.value))}
                  className="w-full accent-[var(--accent)] cursor-pointer"
                  aria-label="Recommendation complexity level"
                  aria-valuetext={COMPLEXITY_LABELS[complexity]}
                />
                <div className="flex justify-between mt-1">
                  {([0, 1, 2, 3] as ComplexityLevel[]).map((lvl) => (
                    <span
                      key={lvl}
                      className="text-[10px]"
                      style={{
                        color: "var(--foreground)",
                        opacity: complexity === lvl ? 0.9 : 0.35,
                        fontWeight: complexity === lvl ? 600 : 400,
                      }}
                    >
                      {COMPLEXITY_LABELS[lvl]}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
