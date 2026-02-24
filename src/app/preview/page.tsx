"use client";

import LocationPicker, { ResolvedLocation } from "@/components/LocationPicker";
import { useState } from "react";

export default function PreviewPage() {
  const [resolved, setResolved] = useState<ResolvedLocation | null>(null);

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "var(--background)" }}>
      <div className="w-full max-w-sm space-y-4">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-semibold" style={{ color: "var(--foreground)" }}>🌤️ Sky Style</h1>
          <p className="text-sm mt-1" style={{ color: "var(--foreground)", opacity: 0.5 }}>Choose how to share your location</p>
        </div>

        <LocationPicker onLocationResolved={setResolved} />

        {resolved && (
          <div className="rounded-2xl p-4 text-sm space-y-1" style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}>
            <p className="font-medium" style={{ color: "var(--foreground)" }}>✅ Location resolved</p>
            <p style={{ color: "var(--foreground)", opacity: 0.6 }}>{resolved.displayName}</p>
            <p style={{ color: "var(--foreground)", opacity: 0.4 }}>
              {resolved.lat.toFixed(4)}, {resolved.lon.toFixed(4)} · via {resolved.source}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
