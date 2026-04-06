"use client";

/**
 * CSS-only Apple-style toggle switch.
 *
 * Usage:
 *   <Toggle checked={value} onChange={setValue} label="Enable feature" />
 *
 * No SVGs, no images. Uses ::before/::after via CSS.
 * The 'on' state uses the user's plan-gradient accent color.
 */

import { useId } from "react";

interface ToggleProps {
  checked: boolean;
  onChange: (val: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  /** Override for the 'on' color (default: var(--accent)) */
  accentColor?: string;
}

export default function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  accentColor,
}: ToggleProps) {
  const id = useId();
  const accent = accentColor ?? "var(--accent)";

  return (
    <div className="flex items-center justify-between gap-3">
      {(label || description) && (
        <label
          htmlFor={id}
          className="flex-1 cursor-pointer select-none"
          style={{ opacity: disabled ? 0.45 : 1 }}
        >
          {label && (
            <span
              className="text-sm font-medium block"
              style={{ color: "var(--foreground)" }}
            >
              {label}
            </span>
          )}
          {description && (
            <span
              className="text-xs block mt-0.5"
              style={{ color: "var(--foreground)", opacity: 0.55 }}
            >
              {description}
            </span>
          )}
        </label>
      )}

      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-disabled={disabled}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className="sky-toggle flex-shrink-0"
        style={
          {
            "--toggle-accent": accent,
          } as React.CSSProperties
        }
      >
        <span className="sky-toggle__thumb" />
      </button>

      <style>{`
        .sky-toggle {
          position: relative;
          display: inline-flex;
          align-items: center;
          width: 44px;
          height: 26px;
          border-radius: 13px;
          border: none;
          cursor: pointer;
          background: var(--card-border);
          transition: background 0.22s cubic-bezier(0.25, 0.46, 0.45, 0.94),
                      box-shadow 0.22s cubic-bezier(0.25, 0.46, 0.45, 0.94);
          outline: none;
          -webkit-tap-highlight-color: transparent;
          flex-shrink: 0;
        }
        .sky-toggle[aria-checked="true"] {
          background: var(--toggle-accent, var(--accent));
        }
        .sky-toggle:focus-visible {
          box-shadow: 0 0 0 3px var(--toggle-accent, var(--accent)), 0 0 0 5px var(--card);
        }
        .sky-toggle[aria-disabled="true"] {
          cursor: not-allowed;
          opacity: 0.45;
        }
        .sky-toggle__thumb {
          position: absolute;
          top: 3px;
          left: 3px;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #fff;
          box-shadow: 0 1px 3px rgba(0,0,0,0.25), 0 1px 1px rgba(0,0,0,0.1);
          transition: transform 0.22s cubic-bezier(0.25, 0.46, 0.45, 0.94),
                      box-shadow 0.22s cubic-bezier(0.25, 0.46, 0.45, 0.94);
          pointer-events: none;
        }
        .sky-toggle[aria-checked="true"] .sky-toggle__thumb {
          transform: translateX(18px);
          box-shadow: 0 2px 5px rgba(0,0,0,0.3);
        }
        .sky-toggle:hover:not([aria-disabled="true"]) .sky-toggle__thumb {
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        }
        .sky-toggle:active:not([aria-disabled="true"]) .sky-toggle__thumb {
          width: 23px;
        }
        .sky-toggle[aria-checked="true"]:active:not([aria-disabled="true"]) .sky-toggle__thumb {
          transform: translateX(15px);
        }
      `}</style>
    </div>
  );
}
