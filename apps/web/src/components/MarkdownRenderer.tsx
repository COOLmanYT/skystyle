"use client";

import Link from "next/link";

interface Props {
  content: string;
  className?: string;
  style?: React.CSSProperties;
  /** If provided, matching closet item names become links to /closet */
  closetItems?: string[];
}

/** Splits text into segments, turning matched closet items into links */
function applyClosetLinks(
  text: string,
  closetItems: string[]
): React.ReactNode[] {
  if (!closetItems.length) return [text];

  // Sort by length descending to match longest first
  const sorted = [...closetItems].sort((a, b) => b.length - a.length);
  const escaped = sorted.map((s) =>
    s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  );
  const regex = new RegExp(`(${escaped.join("|")})`, "gi");

  const parts = text.split(regex);
  return parts.map((part, i) => {
    const isMatch = sorted.some(
      (item) => item.toLowerCase() === part.toLowerCase()
    );
    if (isMatch) {
      return (
        <Link
          key={i}
          href={`/closet?highlight=${encodeURIComponent(part)}`}
          style={{
            textDecoration: "underline",
            textDecorationStyle: "dotted",
            color: "inherit",
          }}
          aria-label={`View ${part} in your closet`}
        >
          {part}
        </Link>
      );
    }
    return part;
  });
}

/** Renders inline markdown (bold, italic, code) in a text node, with optional closet linking */
function renderInline(
  text: string,
  closetItems: string[],
  keyPrefix: string
): React.ReactNode[] {
  // Handle inline: **bold**, *italic*, `code`
  const inlineRegex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  const segments = text.split(inlineRegex);
  const nodes: React.ReactNode[] = [];

  segments.forEach((seg, i) => {
    const k = `${keyPrefix}-${i}`;
    if (seg.startsWith("**") && seg.endsWith("**")) {
      nodes.push(<strong key={k}>{seg.slice(2, -2)}</strong>);
    } else if (seg.startsWith("*") && seg.endsWith("*")) {
      nodes.push(<em key={k}>{seg.slice(1, -1)}</em>);
    } else if (seg.startsWith("`") && seg.endsWith("`")) {
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
    } else if (seg) {
      // Apply closet links to plain text
      const linked = closetItems.length
        ? applyClosetLinks(seg, closetItems)
        : [seg];
      nodes.push(...linked.map((node, j) => <span key={`${k}-cl-${j}`}>{node}</span>));
    }
  });

  return nodes;
}

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

    // H2
    if (line.startsWith("## ")) {
      elements.push(
        <h2
          key={i}
          className="text-base font-semibold mt-3 mb-1"
          style={{ color: "var(--foreground)" }}
        >
          {renderInline(line.slice(3).trim(), closetItems, `h2-${i}`)}
        </h2>
      );
      i++;
      continue;
    }

    // H3
    if (line.startsWith("### ")) {
      elements.push(
        <h3
          key={i}
          className="text-sm font-semibold mt-2 mb-0.5"
          style={{ color: "var(--foreground)", opacity: 0.8 }}
        >
          {renderInline(line.slice(4).trim(), closetItems, `h3-${i}`)}
        </h3>
      );
      i++;
      continue;
    }

    // Bullet list item (- or *)
    if (/^[-*]\s/.test(line)) {
      const listItems: React.ReactNode[] = [];
      while (i < lines.length && /^[-*]\s/.test(lines[i])) {
        listItems.push(
          <li key={i} style={{ marginBottom: 2 }}>
            {renderInline(lines[i].slice(2).trim(), closetItems, `li-${i}`)}
          </li>
        );
        i++;
      }
      elements.push(
        <ul
          key={`ul-${i}`}
          style={{ paddingLeft: 18, margin: "4px 0", listStyleType: "disc" }}
        >
          {listItems}
        </ul>
      );
      continue;
    }

    // Empty line → paragraph break (skip)
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Regular paragraph — collect consecutive non-special lines
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !lines[i].startsWith("## ") &&
      !lines[i].startsWith("### ") &&
      !/^[-*]\s/.test(lines[i])
    ) {
      paraLines.push(lines[i]);
      i++;
    }

    if (paraLines.length) {
      const paraContent: React.ReactNode[] = [];
      paraLines.forEach((pLine, pIdx) => {
        if (pIdx > 0) paraContent.push(<br key={`br-${pIdx}`} />);
        paraContent.push(
          ...renderInline(pLine, closetItems, `p-${i}-${pIdx}`)
        );
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
