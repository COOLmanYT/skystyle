"use client";

/**
 * CSS-only Apple-style checkbox.
 *
 * No SVGs, no images. Uses appearance:none + ::after pseudo-element for
 * the checkmark drawn with CSS borders. Smooth cubic-bezier transitions.
 * The 'checked' state uses the user's plan-gradient accent color.
 */

import { useId } from "react";

interface CheckboxProps {
  checked: boolean;
  onChange: (val: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  accentColor?: string;
}

export default function Checkbox({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  accentColor,
}: CheckboxProps) {
  const id = useId();
  const accent = accentColor ?? "var(--accent)";

  return (
    <label
      htmlFor={id}
      className="sky-checkbox-label flex items-start gap-3 cursor-pointer select-none"
      style={{ opacity: disabled ? 0.45 : 1 }}
    >
      <span className="sky-checkbox-wrapper flex-shrink-0 mt-0.5">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => !disabled && onChange(e.target.checked)}
          className="sky-checkbox-input"
          style={
            {
              "--cb-accent": accent,
            } as React.CSSProperties
          }
        />
        <span className="sky-checkbox-box" aria-hidden="true" />
      </span>

      {(label || description) && (
        <span>
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
        </span>
      )}

      <style>{`
        .sky-checkbox-label {
          -webkit-tap-highlight-color: transparent;
        }
        .sky-checkbox-label[style*="opacity: 0.45"] {
          cursor: not-allowed;
        }
        .sky-checkbox-wrapper {
          position: relative;
          width: 18px;
          height: 18px;
        }
        .sky-checkbox-input {
          position: absolute;
          inset: 0;
          opacity: 0;
          width: 100%;
          height: 100%;
          cursor: inherit;
          margin: 0;
          z-index: 1;
        }
        .sky-checkbox-box {
          position: absolute;
          inset: 0;
          border-radius: 5px;
          background: var(--card);
          border: 1.5px solid var(--card-border);
          transition: background 0.18s cubic-bezier(0.25, 0.46, 0.45, 0.94),
                      border-color 0.18s cubic-bezier(0.25, 0.46, 0.45, 0.94),
                      box-shadow 0.18s cubic-bezier(0.25, 0.46, 0.45, 0.94);
        }
        .sky-checkbox-box::after {
          content: "";
          position: absolute;
          top: 2px;
          left: 5px;
          width: 5px;
          height: 9px;
          border: 1.5px solid #fff;
          border-top: none;
          border-left: none;
          transform: rotate(45deg) scale(0);
          transform-origin: center;
          transition: transform 0.16s cubic-bezier(0.25, 0.46, 0.45, 0.94);
        }
        .sky-checkbox-input:checked + .sky-checkbox-box {
          background: var(--cb-accent, var(--accent));
          border-color: transparent;
        }
        .sky-checkbox-input:checked + .sky-checkbox-box::after {
          transform: rotate(45deg) scale(1);
        }
        .sky-checkbox-input:focus-visible + .sky-checkbox-box {
          box-shadow: 0 0 0 2px var(--card), 0 0 0 4px var(--cb-accent, var(--accent));
        }
        .sky-checkbox-label:hover .sky-checkbox-box {
          border-color: var(--cb-accent, var(--accent));
        }
        .sky-checkbox-label:hover .sky-checkbox-input:checked + .sky-checkbox-box {
          opacity: 0.88;
        }
        .sky-checkbox-label:active .sky-checkbox-box {
          transform: scale(0.92);
        }
      `}</style>
    </label>
  );
}
