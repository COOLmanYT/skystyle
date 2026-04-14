"use client";

import Link from "next/link";

interface Props {
  content: string;
  className?: string;
  style?: React.CSSProperties;
  /** If provided, matching closet item names become links to /closet */
  closetItems?: string[];
}

// ── URL sanitizer ─────────────────────────────────────────────────────────────
// Allows only http/https absolute URLs and relative paths. Returns null for
// unsafe schemes (javascript:, data:, vbscript:, etc.).

function sanitizeUrl(url: string): string | null {
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("/") || trimmed.startsWith("./") || trimmed.startsWith("../")) return trimmed;
  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmed)) return null; // unsafe scheme
  return trimmed; // relative path with no scheme
}

// ── Closet link helper ────────────────────────────────────────────────────────

function applyClosetLinks(text: string, closetItems: string[]): React.ReactNode[] {
  if (!closetItems.length) return [text];
  const sorted = [...closetItems].sort((a, b) => b.length - a.length);
  const escaped = sorted.map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const regex = new RegExp(`(${escaped.join("|")})`, "gi");
  const parts = text.split(regex);
  return parts.map((part, i) => {
    const isMatch = sorted.some((item) => item.toLowerCase() === part.toLowerCase());
    if (isMatch) {
      return (
        <Link
          key={i}
          href={`/closet?highlight=${encodeURIComponent(part)}`}
          style={{ textDecoration: "underline", textDecorationStyle: "dotted", color: "inherit" }}
          aria-label={`View ${part} in your closet`}
        >
          {part}
        </Link>
      );
    }
    return part;
  });
}

// ── Inline parser ─────────────────────────────────────────────────────────────
// Handles: **bold**, *italic*, ~~strikethrough~~, `code`, [text](url)

const INLINE_RE =
  /(\*\*(?:[^*]|\*(?!\*))+\*\*|~~[^~]+~~|\*(?:[^*])+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;

function renderInline(text: string, closetItems: string[], keyPrefix: string): React.ReactNode[] {
  const parts = text.split(INLINE_RE);
  const nodes: React.ReactNode[] = [];

  parts.forEach((seg, i) => {
    const k = `${keyPrefix}-${i}`;
    if (!seg) return;

    if (seg.startsWith("**") && seg.endsWith("**") && seg.length > 4) {
      nodes.push(<strong key={k}>{seg.slice(2, -2)}</strong>);
    } else if (seg.startsWith("~~") && seg.endsWith("~~") && seg.length > 4) {
      nodes.push(<del key={k}>{seg.slice(2, -2)}</del>);
    } else if (seg.startsWith("*") && seg.endsWith("*") && seg.length > 2) {
      nodes.push(<em key={k}>{seg.slice(1, -1)}</em>);
    } else if (seg.startsWith("`") && seg.endsWith("`") && seg.length > 2) {
      nodes.push(
        <code
          key={k}
          style={{
            fontFamily: "monospace",
            background: "rgba(0,0,0,0.07)",
            borderRadius: 3,
            padding: "0 3px",
            fontSize: "0.9em",
          }}
        >
          {seg.slice(1, -1)}
        </code>
      );
    } else if (seg.startsWith("[") && seg.includes("](")) {
      const m = seg.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (m) {
        const [, linkText, rawUrl] = m;
        const safeUrl = sanitizeUrl(rawUrl);
        if (safeUrl) {
          const isExternal = /^https?:\/\//i.test(safeUrl);
          nodes.push(
            <a
              key={k}
              href={safeUrl}
              target={isExternal ? "_blank" : undefined}
              rel={isExternal ? "noopener noreferrer" : undefined}
              style={{ color: "var(--accent)", textDecoration: "underline" }}
            >
              {linkText}
            </a>
          );
        } else {
          // Unsafe URL — render link text as plain text
          nodes.push(<span key={k}>{linkText}</span>);
        }
      } else {
        // Malformed link — render as plain text with closet links
        applyClosetLinks(seg, closetItems).forEach((n, j) =>
          nodes.push(<span key={`${k}-cl-${j}`}>{n}</span>)
        );
      }
    } else {
      applyClosetLinks(seg, closetItems).forEach((n, j) =>
        nodes.push(<span key={`${k}-cl-${j}`}>{n}</span>)
      );
    }
  });

  return nodes;
}

// ── List helpers ──────────────────────────────────────────────────────────────

function getIndent(line: string): number {
  return line.match(/^(\s*)/)?.[1]?.length ?? 0;
}

function isUnorderedItem(line: string): boolean {
  return /^\s*[-*]\s/.test(line);
}

function isOrderedItem(line: string): boolean {
  return /^\s*\d+\.\s/.test(line);
}

function getItemText(line: string): string {
  return line.replace(/^\s*(?:[-*]|\d+\.)\s/, "");
}

function buildList(
  lines: string[],
  startIdx: number,
  baseIndent: number,
  ordered: boolean,
  closetItems: string[],
  keyPrefix: string
): [React.ReactNode, number] {
  const items: React.ReactNode[] = [];
  let i = startIdx;

  while (i < lines.length) {
    const line = lines[i];
    const indent = getIndent(line);
    if (ordered ? !isOrderedItem(line) : !isUnorderedItem(line)) break;
    if (indent < baseIndent) break;
    if (indent > baseIndent) break;

    const text = getItemText(line);
    i++;

    // Check for nested list
    let nestedList: React.ReactNode | null = null;
    if (i < lines.length) {
      const nextLine = lines[i];
      const nextIndent = getIndent(nextLine);
      if ((isUnorderedItem(nextLine) || isOrderedItem(nextLine)) && nextIndent > baseIndent) {
        const nextOrdered = isOrderedItem(nextLine);
        const [nested, newI] = buildList(lines, i, nextIndent, nextOrdered, closetItems, `${keyPrefix}-n-${i}`);
        nestedList = nested;
        i = newI;
      }
    }

    items.push(
      <li key={`${keyPrefix}-li-${i}`} style={{ marginBottom: 2 }}>
        {renderInline(text, closetItems, `${keyPrefix}-lt-${i}`)}
        {nestedList}
      </li>
    );
  }

  const Tag = ordered ? "ol" : "ul";
  return [
    <Tag
      key={keyPrefix}
      style={{ paddingLeft: 20, margin: "4px 0", listStyleType: ordered ? "decimal" : "disc" }}
    >
      {items}
    </Tag>,
    i,
  ];
}

// ── Custom Sky Style syntax ───────────────────────────────────────────────────

interface CTABlock { type: "cta"; text: string; url: string }
interface ImageBlock { type: "image"; alt: string; url: string }
interface CarouselBlock { type: "carousel"; items: { alt: string; url: string; link?: string }[] }
type CustomBlock = CTABlock | ImageBlock | CarouselBlock;

function parseCTAButton(line: string): CTABlock | null {
  // Syntax: ![CTA-BUTTON]{Button Text}[https://example.com]
  const m = line.match(/^!\[CTA-BUTTON\]\{([^}]+)\}\[([^\]]+)\]$/);
  if (!m) return null;
  return { type: "cta", text: m[1], url: m[2] };
}

function parseSkyImage(line: string): ImageBlock | null {
  // Syntax: ![IMAGE-alt text][https://image-url.com]
  const m = line.match(/^!\[IMAGE-([^\]]*)\]\[([^\]]+)\]$/);
  if (!m) return null;
  return { type: "image", alt: m[1].trim(), url: m[2].trim() };
}

function parseSkyCarousel(line: string): CarouselBlock | null {
  // Syntax: !![IMAGE-CAR]{alt1}{alt2}[url1][url2]{link1}{link2}
  // Number of images determined by number of [url] groups.
  // {alt} groups: first N match images, remaining N are optional links.
  if (!line.startsWith("!![IMAGE-CAR]")) return null;
  const rest = line.slice("!![IMAGE-CAR]".length);

  const alts: string[] = [];
  const urls: string[] = [];

  // Extract all {...} groups
  const bracesRe = /\{([^}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = bracesRe.exec(rest)) !== null) alts.push(m[1]);

  // Extract all [...] groups
  const bracketsRe = /\[([^\]]+)\]/g;
  while ((m = bracketsRe.exec(rest)) !== null) urls.push(m[1]);

  if (urls.length === 0) return null;

  const N = urls.length;
  const imageAlts = alts.slice(0, N);
  const imageLinks = alts.slice(N);

  const items = urls.map((url, idx) => ({
    alt: imageAlts[idx] ?? "",
    url,
    link: imageLinks[idx] || undefined,
  }));

  return { type: "carousel", items };
}

function tryParseCustomBlock(line: string): CustomBlock | null {
  return parseCTAButton(line) ?? parseSkyImage(line) ?? parseSkyCarousel(line);
}

function renderCustomBlock(block: CustomBlock, key: string): React.ReactNode {
  if (block.type === "cta") {
    const safeUrl = sanitizeUrl(block.url);
    if (!safeUrl) return null;
    return (
      <div key={key} style={{ margin: "8px 0" }}>
        <a
          href={safeUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-block",
            background: "var(--accent)",
            color: "#fff",
            padding: "8px 20px",
            borderRadius: 12,
            fontWeight: 600,
            fontSize: "0.875rem",
            textDecoration: "none",
            cursor: "pointer",
          }}
        >
          {block.text}
        </a>
      </div>
    );
  }

  if (block.type === "image") {
    const safeUrl = sanitizeUrl(block.url);
    if (!safeUrl) return null;
    return (
      <figure key={key} style={{ margin: "8px 0", display: "block" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={safeUrl}
          alt={block.alt}
          style={{ maxWidth: "100%", borderRadius: 10, display: "block" }}
        />
        {block.alt && (
          <figcaption
            style={{
              marginTop: 4,
              fontSize: "0.8em",
              fontStyle: "italic",
              color: "var(--foreground)",
              opacity: 0.6,
            }}
          >
            {block.alt}
          </figcaption>
        )}
      </figure>
    );
  }

  // carousel
  return (
    <div
      key={key}
      style={{ display: "flex", gap: 12, overflowX: "auto", margin: "8px 0", paddingBottom: 8 }}
      role="region"
      aria-label="Image carousel"
    >
      {block.items.map((item, idx) => {
        const safeImgUrl = sanitizeUrl(item.url);
        if (!safeImgUrl) return null;
        const figure = (
          <figure key={idx} style={{ flex: "0 0 auto", maxWidth: 240, margin: 0 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={safeImgUrl}
              alt={item.alt}
              style={{ width: "100%", borderRadius: 10, display: "block", objectFit: "cover" }}
            />
            {item.alt && (
              <figcaption
                style={{
                  marginTop: 4,
                  fontSize: "0.8em",
                  fontStyle: "italic",
                  color: "var(--foreground)",
                  opacity: 0.6,
                }}
              >
                {item.alt}
              </figcaption>
            )}
          </figure>
        );
        if (item.link) {
          const safeLink = sanitizeUrl(item.link);
          if (!safeLink) return figure;
          return (
            <a key={idx} href={safeLink} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
              {figure}
            </a>
          );
        }
        return figure;
      })}
    </div>
  );
}

// ── Main renderer ─────────────────────────────────────────────────────────────

export default function MarkdownRenderer({
  content,
  className,
  style,
  closetItems = [],
}: Props) {
  if (!content) return null;

  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // ── Fenced code block ───────────────────────────────────────────────────
    if (trimmed.startsWith("```")) {
      const lang = trimmed.slice(3).trim() || "text";
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++; // consume closing fence
      elements.push(
        <pre
          key={`code-${i}`}
          style={{
            background: "rgba(0,0,0,0.06)",
            borderRadius: 10,
            padding: "12px 14px",
            overflowX: "auto",
            margin: "6px 0",
            fontSize: "0.85em",
          }}
        >
          <code
            style={{ fontFamily: "monospace", whiteSpace: "pre" }}
            data-language={lang}
          >
            {codeLines.join("\n")}
          </code>
        </pre>
      );
      continue;
    }

    // ── Custom Sky Style syntax ─────────────────────────────────────────────
    const customBlock = tryParseCustomBlock(trimmed);
    if (customBlock) {
      elements.push(renderCustomBlock(customBlock, `custom-${i}`));
      i++;
      continue;
    }

    // ── Headings ────────────────────────────────────────────────────────────
    if (trimmed.startsWith("#### ")) {
      elements.push(
        <h4 key={i} className="text-xs font-semibold mt-1.5 mb-0.5" style={{ color: "var(--foreground)", opacity: 0.7 }}>
          {renderInline(trimmed.slice(5).trim(), closetItems, `h4-${i}`)}
        </h4>
      );
      i++;
      continue;
    }
    if (trimmed.startsWith("### ")) {
      elements.push(
        <h3 key={i} className="text-sm font-semibold mt-2 mb-0.5" style={{ color: "var(--foreground)", opacity: 0.8 }}>
          {renderInline(trimmed.slice(4).trim(), closetItems, `h3-${i}`)}
        </h3>
      );
      i++;
      continue;
    }
    if (trimmed.startsWith("## ")) {
      elements.push(
        <h2 key={i} className="text-base font-semibold mt-3 mb-1" style={{ color: "var(--foreground)" }}>
          {renderInline(trimmed.slice(3).trim(), closetItems, `h2-${i}`)}
        </h2>
      );
      i++;
      continue;
    }
    if (trimmed.startsWith("# ")) {
      elements.push(
        <h1 key={i} className="text-lg font-bold mt-3 mb-1" style={{ color: "var(--foreground)" }}>
          {renderInline(trimmed.slice(2).trim(), closetItems, `h1-${i}`)}
        </h1>
      );
      i++;
      continue;
    }

    // ── Blockquote ──────────────────────────────────────────────────────────
    if (trimmed.startsWith("> ")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("> ")) {
        quoteLines.push(lines[i].trim().slice(2));
        i++;
      }
      elements.push(
        <blockquote
          key={`bq-${i}`}
          style={{
            borderLeft: "3px solid var(--accent)",
            paddingLeft: 12,
            margin: "6px 0",
            opacity: 0.75,
            fontStyle: "italic",
          }}
        >
          {quoteLines.map((ql, qi) => (
            <p key={qi} style={{ margin: "2px 0" }}>
              {renderInline(ql, closetItems, `bq-${i}-${qi}`)}
            </p>
          ))}
        </blockquote>
      );
      continue;
    }

    // ── Ordered list ────────────────────────────────────────────────────────
    if (isOrderedItem(line)) {
      const baseIndent = getIndent(line);
      const [listEl, newI] = buildList(lines, i, baseIndent, true, closetItems, `ol-${i}`);
      elements.push(listEl);
      i = newI;
      continue;
    }

    // ── Unordered list ──────────────────────────────────────────────────────
    if (isUnorderedItem(line)) {
      const baseIndent = getIndent(line);
      const [listEl, newI] = buildList(lines, i, baseIndent, false, closetItems, `ul-${i}`);
      elements.push(listEl);
      i = newI;
      continue;
    }

    // ── Empty line ──────────────────────────────────────────────────────────
    if (trimmed === "") {
      i++;
      continue;
    }

    // ── Regular paragraph ───────────────────────────────────────────────────
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !lines[i].trim().startsWith("#") &&
      !lines[i].trim().startsWith("> ") &&
      !lines[i].trim().startsWith("```") &&
      !isUnorderedItem(lines[i]) &&
      !isOrderedItem(lines[i]) &&
      !tryParseCustomBlock(lines[i].trim())
    ) {
      paraLines.push(lines[i]);
      i++;
    }

    if (paraLines.length) {
      const paraContent: React.ReactNode[] = [];
      paraLines.forEach((pLine, pIdx) => {
        if (pIdx > 0) paraContent.push(<br key={`br-${pIdx}`} />);
        paraContent.push(...renderInline(pLine, closetItems, `p-${i}-${pIdx}`));
      });
      elements.push(
        <p key={`p-${i}`} style={{ margin: "4px 0", lineHeight: 1.6 }}>
          {paraContent}
        </p>
      );
    }
  }

  return (
    <div className={className} style={style}>
      {elements}
    </div>
  );
}
