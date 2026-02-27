"use client";

import { useState, useRef } from "react";

export interface ResolvedLocation {
  lat: number;
  lon: number;
  displayName: string;
  source: "gps" | "manual";
}

interface Props {
  onLocationResolved: (location: ResolvedLocation) => void;
}

type Tab = "gps" | "manual";
type GpsState = "idle" | "requesting" | "error";

interface GeocodeCandidate {
  lat: number;
  lon: number;
  displayName: string;
}

export default function LocationPicker({ onLocationResolved }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("gps");

  // GPS state
  const [gpsState, setGpsState] = useState<GpsState>("idle");
  const [gpsError, setGpsError] = useState<string | null>(null);

  // Manual state
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<GeocodeCandidate[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // --- GPS handler ---
  function handleGps() {
    if (!navigator.geolocation) {
      setGpsError("Your browser does not support geolocation.");
      return;
    }
    setGpsState("requesting");
    setGpsError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsState("idle");
        onLocationResolved({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          displayName: `${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`,
          source: "gps",
        });
      },
      (err) => {
        setGpsState("error");
        if (err.code === err.PERMISSION_DENIED) {
          setGpsError(
            "Location permission denied. Please allow access in your browser settings or enter a location manually."
          );
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setGpsError("Location unavailable. Try entering it manually.");
        } else {
          setGpsError("Location timed out. Try entering it manually.");
        }
      },
      { timeout: 10000, maximumAge: 60000 }
    );
  }

  // --- Manual search handler ---
  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setSearchError(null);
    setCandidates([]);
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
      if (!res.ok) {
        let errorMessage = "Location not found.";
        try {
          const data = await res.json();
          errorMessage = data.error ?? errorMessage;
        } catch { /* non-JSON error response */ }
        setSearchError(errorMessage);
      } else {
        const data = await res.json();
        setCandidates(data.candidates);
      }
    } catch {
      setSearchError("Network error. Please try again.");
    } finally {
      setSearching(false);
    }
  }

  function handleCandidateSelect(c: GeocodeCandidate) {
    setCandidates([]);
    setQuery(c.displayName);
    onLocationResolved({
      lat: c.lat,
      lon: c.lon,
      displayName: c.displayName,
      source: "manual",
    });
  }

  return (
    <div
      className="w-full rounded-2xl overflow-hidden"
      style={{
        background: "var(--card)",
        border: "1px solid var(--card-border)",
        boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
      }}
    >
      {/* Tab bar */}
      <div
        className="flex"
        style={{ borderBottom: "1px solid var(--card-border)" }}
      >
        {(["gps", "manual"] as Tab[]).map((tab) => {
          const label = tab === "gps" ? "📍 Use My Location" : "🔍 Enter Location";
          const active = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                setGpsError(null);
                setSearchError(null);
                setCandidates([]);
              }}
              className="flex-1 py-3 text-sm font-medium transition-colors"
              style={{
                color: active ? "var(--accent)" : "var(--foreground)",
                opacity: active ? 1 : 0.5,
                borderBottom: active ? `2px solid var(--accent)` : "2px solid transparent",
                background: "transparent",
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="p-5">
        {activeTab === "gps" ? (
          <div className="flex flex-col items-center gap-3 py-2">
            <p className="text-sm text-center" style={{ color: "var(--foreground)", opacity: 0.6 }}>
              Allow browser access to your precise location for the most accurate weather.
            </p>
            <button
              onClick={handleGps}
              disabled={gpsState === "requesting"}
              className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium btn-interact disabled:opacity-50"
              style={{ background: "var(--accent)", color: "#fff" }}
            >
              {gpsState === "requesting" ? (
                <>
                  <SpinnerIcon />
                  Requesting…
                </>
              ) : (
                <>
                  <LocationIcon />
                  Allow Location Access
                </>
              )}
            </button>
            {gpsError && (
              <p className="text-xs text-center text-red-500 mt-1 max-w-xs">
                {gpsError}
              </p>
            )}
          </div>
        ) : (
          <form onSubmit={handleSearch} className="flex flex-col gap-3">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setCandidates([]);
                  setSearchError(null);
                }}
                placeholder="City, suburb, or address…"
                className="flex-1 rounded-xl px-4 py-2.5 text-sm outline-none"
                style={{
                  background: "var(--background)",
                  color: "var(--foreground)",
                  border: "1px solid var(--card-border)",
                }}
              />
              <button
                type="submit"
                disabled={searching || !query.trim()}
                className="rounded-xl px-4 py-2.5 text-sm font-medium btn-interact disabled:opacity-40"
                style={{ background: "var(--accent)", color: "#fff" }}
              >
                {searching ? <SpinnerIcon /> : "Search"}
              </button>
            </div>

            {searchError && (
              <p className="text-xs text-red-500">{searchError}</p>
            )}

            {/* Candidate list */}
            {candidates.length > 0 && (
              <ul
                className="rounded-xl overflow-hidden text-sm divide-y"
                style={{ border: "1px solid var(--card-border)" }}
              >
                {candidates.map((c, i) => (
                  <li key={i}>
                    <button
                      type="button"
                      onClick={() => handleCandidateSelect(c)}
                      className="w-full text-left px-4 py-2.5 transition-colors hover:opacity-70"
                      style={{
                        background: "var(--card)",
                        color: "var(--foreground)",
                      }}
                    >
                      {c.displayName}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </form>
        )}
      </div>
    </div>
  );
}

function LocationIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="10" r="3" />
      <path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 13 8 13s8-7.75 8-13a8 8 0 0 0-8-8z" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg className="animate-spin" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}
