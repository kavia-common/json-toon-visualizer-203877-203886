import React, { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";

/**
 * Safely parse JSON from user input.
 * Returns { value, error } where value is the parsed object on success.
 */
function safeJsonParse(text) {
  try {
    const parsed = JSON.parse(text);
    return { value: parsed, error: null };
  } catch (e) {
    return { value: null, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Create a stable pseudo-random number from a string. Used for color variation.
 */
function hashStringToInt(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/**
 * Convert a number into an HSL color string within a pleasant range.
 */
function intToHsl(n, s = 75, l = 55) {
  const hue = n % 360;
  return `hsl(${hue} ${s}% ${l}%)`;
}

/**
 * Normalize JSON value to a node list with simple types.
 * Each node: { keyPath, label, type, sizeHint }
 */
function jsonToNodes(value, maxNodes = 60) {
  const nodes = [];

  const pushNode = (keyPath, label, type, sizeHint) => {
    nodes.push({ keyPath, label, type, sizeHint });
  };

  const walk = (v, path, depth) => {
    if (nodes.length >= maxNodes) return;

    const t = Array.isArray(v) ? "array" : v === null ? "null" : typeof v;

    // Stop recursion depth to keep visuals readable
    if (depth > 3) {
      pushNode(path, `${path || "root"} (… )`, "truncated", 1);
      return;
    }

    if (t === "object") {
      const keys = Object.keys(v);
      pushNode(path, path || "root", "object", Math.max(1, Math.min(6, keys.length)));
      keys.slice(0, 10).forEach((k) => {
        const childPath = path ? `${path}.${k}` : k;
        walk(v[k], childPath, depth + 1);
      });
      if (keys.length > 10) {
        pushNode(path ? `${path}.__more__` : "__more__", `+${keys.length - 10} more`, "more", 1);
      }
      return;
    }

    if (t === "array") {
      pushNode(path, path || "root", "array", Math.max(1, Math.min(6, v.length)));
      v.slice(0, 10).forEach((item, idx) => {
        const childPath = `${path || "root"}[${idx}]`;
        walk(item, childPath, depth + 1);
      });
      if (v.length > 10) {
        pushNode(`${path || "root"}.__more__`, `+${v.length - 10} more`, "more", 1);
      }
      return;
    }

    if (t === "string") {
      const preview = v.length > 18 ? `${v.slice(0, 18)}…` : v;
      pushNode(path, `${path || "root"}: "${preview}"`, "string", 1);
      return;
    }

    if (t === "number") {
      pushNode(path, `${path || "root"}: ${v}`, "number", 1);
      return;
    }

    if (t === "boolean") {
      pushNode(path, `${path || "root"}: ${v}`, "boolean", 1);
      return;
    }

    if (t === "null") {
      pushNode(path, `${path || "root"}: null`, "null", 1);
      return;
    }

    pushNode(path, `${path || "root"}: ${String(v)}`, "unknown", 1);
  };

  walk(value, "", 0);
  return nodes.slice(0, maxNodes);
}

/**
 * Simple toon-style "scene" renderer based on extracted nodes.
 * Renders an SVG with thick outlines, soft highlights, and playful shapes.
 */
function ToonScene({ nodes, title }) {
  const viewBoxW = 900;
  const viewBoxH = 520;

  // Layout: place nodes on a loose spiral / grid to feel "cartoon-y".
  const placed = useMemo(() => {
    const centerX = viewBoxW * 0.55;
    const centerY = viewBoxH * 0.52;

    const res = nodes.map((n, i) => {
      const angle = i * 0.62;
      const radius = 30 + i * 7.5;
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius * 0.75;

      const seed = hashStringToInt(n.keyPath || n.label || String(i));
      const fill =
        n.type === "object"
          ? "var(--accent-primary)"
          : n.type === "array"
            ? "var(--accent-success)"
            : intToHsl(seed, 78, 56);

      const sizeBase =
        n.type === "object" ? 64 : n.type === "array" ? 58 : n.type === "string" ? 44 : 42;

      const size = sizeBase + Math.min(30, (n.sizeHint || 1) * 6);
      return { ...n, x, y, fill, size, seed };
    });

    return res;
  }, [nodes]);

  return (
    <div className="vizCard" role="region" aria-label="Toon visualization">
      <div className="vizHeader">
        <div className="vizTitle">{title}</div>
        <div className="vizSubtitle">
          Thick outlines, soft highlights, and node “bubbles” derived from your JSON structure.
        </div>
      </div>

      <div className="vizStage" aria-hidden="false">
        <svg
          className="vizSvg"
          viewBox={`0 0 ${viewBoxW} ${viewBoxH}`}
          role="img"
          aria-label="Toon-style JSON visualization"
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            <linearGradient id="bgGrad" x1="0" x2="1" y1="0" y2="1">
              <stop offset="0" stopColor="rgba(59,130,246,0.10)" />
              <stop offset="1" stopColor="rgba(6,182,212,0.10)" />
            </linearGradient>

            <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="8" stdDeviation="10" floodColor="rgba(15,23,42,0.18)" />
            </filter>

            <filter id="toonOutline" x="-20%" y="-20%" width="140%" height="140%">
              <feMorphology in="SourceAlpha" operator="dilate" radius="2.2" result="dilated" />
              <feColorMatrix
                in="dilated"
                type="matrix"
                values="
                  0 0 0 0 0.05
                  0 0 0 0 0.10
                  0 0 0 0 0.18
                  0 0 0 0.9 0"
                result="outline"
              />
              <feMerge>
                <feMergeNode in="outline" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            <clipPath id="roundClip">
              <rect x="28" y="28" width={viewBoxW - 56} height={viewBoxH - 56} rx="28" ry="28" />
            </clipPath>
          </defs>

          {/* Background */}
          <g clipPath="url(#roundClip)">
            <rect x="0" y="0" width={viewBoxW} height={viewBoxH} fill="url(#bgGrad)" />
            <circle cx="190" cy="110" r="110" fill="rgba(59,130,246,0.12)" />
            <circle cx="740" cy="150" r="140" fill="rgba(6,182,212,0.12)" />
            <circle cx="700" cy="450" r="180" fill="rgba(100,116,139,0.10)" />
          </g>

          {/* Ground "cloud" */}
          <path
            d="M120,410
               C140,380 190,380 210,410
               C240,372 300,372 320,410
               C350,380 410,380 430,410
               C460,372 520,372 540,410
               C570,380 630,380 650,410
               C680,372 740,372 760,410
               C785,392 825,396 840,420
               C860,452 845,478 805,482
               L170,482
               C120,476 98,450 120,410 Z"
            fill="rgba(255,255,255,0.80)"
            filter="url(#softShadow)"
          />

          {/* Connectors */}
          {placed.slice(1).map((n, i) => {
            const prev = placed[Math.max(0, i)];
            const midX = (prev.x + n.x) / 2;
            const midY = (prev.y + n.y) / 2;
            return (
              <path
                key={`edge-${n.keyPath}-${i}`}
                d={`M ${prev.x} ${prev.y} Q ${midX + 18} ${midY - 18} ${n.x} ${n.y}`}
                fill="none"
                stroke="rgba(15,23,42,0.20)"
                strokeWidth="5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            );
          })}

          {/* Nodes */}
          {placed.map((n) => {
            const r = n.size / 2;

            // Slight wobble for toon feel
            const wobble = (n.seed % 11) - 5;
            const x = n.x + wobble * 0.6;
            const y = n.y - wobble * 0.4;

            const highlightX = x - r * 0.25;
            const highlightY = y - r * 0.25;

            return (
              <g key={n.keyPath || n.label} filter="url(#toonOutline)">
                {/* Blob/bubble */}
                <path
                  d={`
                    M ${x} ${y - r}
                    C ${x + r * 0.85} ${y - r * 0.92}, ${x + r} ${y - r * 0.25}, ${x + r} ${y}
                    C ${x + r} ${y + r * 0.75}, ${x + r * 0.45} ${y + r}, ${x} ${y + r}
                    C ${x - r * 0.95} ${y + r * 0.95}, ${x - r} ${y + r * 0.2}, ${x - r} ${y}
                    C ${x - r} ${y - r * 0.8}, ${x - r * 0.5} ${y - r}, ${x} ${y - r}
                    Z
                  `}
                  fill={n.fill}
                  opacity="0.92"
                />
                {/* Highlight */}
                <ellipse
                  cx={highlightX}
                  cy={highlightY}
                  rx={r * 0.35}
                  ry={r * 0.24}
                  fill="rgba(255,255,255,0.35)"
                />

                {/* Label plate */}
                <rect
                  x={x - r * 0.9}
                  y={y + r * 0.35}
                  width={r * 1.8}
                  height={Math.max(26, r * 0.42)}
                  rx="12"
                  fill="rgba(255,255,255,0.85)"
                />
                <text
                  x={x}
                  y={y + r * 0.35 + Math.max(18, r * 0.28)}
                  textAnchor="middle"
                  fontSize={Math.max(11, Math.min(15, r * 0.22))}
                  fontFamily="Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif"
                  fill="rgba(15,23,42,0.9)"
                >
                  {n.type}
                </text>

                {/* Hover label */}
                <title>{n.label}</title>
              </g>
            );
          })}

          {/* Frame */}
          <rect
            x="24"
            y="24"
            width={viewBoxW - 48}
            height={viewBoxH - 48}
            rx="28"
            fill="none"
            stroke="rgba(15,23,42,0.22)"
            strokeWidth="5"
          />
        </svg>
      </div>

      <div className="vizLegend" role="list" aria-label="Legend">
        <div className="legendItem" role="listitem">
          <span className="legendDot dotPrimary" aria-hidden="true" /> objects
        </div>
        <div className="legendItem" role="listitem">
          <span className="legendDot dotSuccess" aria-hidden="true" /> arrays
        </div>
        <div className="legendItem" role="listitem">
          <span className="legendDot dotInk" aria-hidden="true" /> connectors
        </div>
        <div className="legendHint">Tip: hover bubbles to see the full JSON path/value preview.</div>
      </div>
    </div>
  );
}

// PUBLIC_INTERFACE
function App() {
  const EXAMPLE = `{
  "character": {
    "name": "Captain JSON",
    "mood": "curious",
    "stats": { "level": 7, "hp": 42, "mana": 13 },
    "inventory": ["key", "map", "cookie"]
  },
  "scene": {
    "location": "Neo Schema City",
    "weather": "sunny",
    "flags": [true, false, true]
  }
}`;

  const [jsonText, setJsonText] = useState(EXAMPLE);
  const [parseError, setParseError] = useState(null);
  const [parsedValue, setParsedValue] = useState(null);

  const [lastGoodTitle, setLastGoodTitle] = useState("Example JSON");

  const textareaRef = useRef(null);

  useEffect(() => {
    // Parse on load for immediate visualization
    const { value, error } = safeJsonParse(jsonText);
    if (error) {
      setParseError(error);
      setParsedValue(null);
    } else {
      setParseError(null);
      setParsedValue(value);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const nodes = useMemo(() => {
    if (!parsedValue) return [];
    return jsonToNodes(parsedValue, 60);
  }, [parsedValue]);

  // PUBLIC_INTERFACE
  const handleVisualize = () => {
    const { value, error } = safeJsonParse(jsonText);

    if (error) {
      setParseError(error);
      setParsedValue(null);
      return;
    }

    // Basic validation: require object/array at root for best visualization
    const rootType = Array.isArray(value) ? "array" : value === null ? "null" : typeof value;
    if (rootType !== "object" && rootType !== "array") {
      setParseError("Root JSON value should be an object or array for a meaningful visualization.");
      setParsedValue(null);
      return;
    }

    setParseError(null);
    setParsedValue(value);

    // Try to name the scene based on common keys (optional)
    let title = "Custom JSON";
    try {
      if (value && typeof value === "object" && !Array.isArray(value)) {
        if (value.character?.name) title = String(value.character.name);
        else if (value.name) title = String(value.name);
        else if (value.title) title = String(value.title);
      }
    } catch {
      // ignore
    }
    setLastGoodTitle(title);
  };

  // PUBLIC_INTERFACE
  const handleFormat = () => {
    const { value, error } = safeJsonParse(jsonText);
    if (error) {
      setParseError(error);
      return;
    }
    setParseError(null);
    setJsonText(JSON.stringify(value, null, 2));
    // Keep cursor position reasonable by focusing back
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  // PUBLIC_INTERFACE
  const handleLoadExample = () => {
    setJsonText(EXAMPLE);
    setParseError(null);
    const { value } = safeJsonParse(EXAMPLE);
    setParsedValue(value);
    setLastGoodTitle("Example JSON");
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  // PUBLIC_INTERFACE
  const handleClear = () => {
    setJsonText("");
    setParseError(null);
    setParsedValue(null);
    setLastGoodTitle("Custom JSON");
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  return (
    <div className="AppRoot">
      <header className="TopBar">
        <div className="Brand">
          <div className="BrandMark" aria-hidden="true">
            JT
          </div>
          <div className="BrandText">
            <div className="BrandTitle">JSON Toon Visualizer</div>
            <div className="BrandSubtitle">Paste JSON → get a playful toon-style scene</div>
          </div>
        </div>

        <div className="TopBarRight">
          <a className="TopLink" href="https://www.json.org/json-en.html" target="_blank" rel="noreferrer">
            JSON spec
          </a>
        </div>
      </header>

      <main className="Shell">
        <section className="InputCard" aria-label="JSON input">
          <div className="CardHeader">
            <div>
              <div className="CardTitle">JSON Input</div>
              <div className="CardSubtitle">Valid JSON object/array recommended. Click “Visualize”.</div>
            </div>

            <div className="Actions">
              <button className="btn btnSecondary" type="button" onClick={handleLoadExample}>
                Load example
              </button>
              <button className="btn btnSecondary" type="button" onClick={handleFormat}>
                Format
              </button>
              <button className="btn btnGhost" type="button" onClick={handleClear}>
                Clear
              </button>
            </div>
          </div>

          <label className="srOnly" htmlFor="jsonText">
            JSON input
          </label>
          <textarea
            id="jsonText"
            ref={textareaRef}
            className={`JsonTextarea ${parseError ? "JsonTextareaError" : ""}`}
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            spellCheck={false}
            placeholder='e.g. {"name":"Ava","items":[1,2,3]}'
          />

          <div className="CardFooter">
            <div className="Status">
              {parseError ? (
                <div className="ErrorBox" role="alert">
                  <div className="ErrorTitle">JSON error</div>
                  <div className="ErrorMsg">{parseError}</div>
                </div>
              ) : (
                <div className="OkBox" role="status">
                  Ready. {parsedValue ? `Rendered ${nodes.length} nodes.` : "Click Visualize to render."}
                </div>
              )}
            </div>

            <div className="PrimaryAction">
              <button className="btn btnPrimary" type="button" onClick={handleVisualize}>
                Visualize
              </button>
            </div>
          </div>
        </section>

        <section className="VizWrap" aria-label="Visualization area">
          {parsedValue ? (
            <ToonScene nodes={nodes} title={lastGoodTitle} />
          ) : (
            <div className="EmptyViz" role="region" aria-label="Empty visualization state">
              <div className="EmptyTitle">Your toon scene will appear here</div>
              <div className="EmptySubtitle">
                Paste JSON on the left, then click <strong>Visualize</strong>.
              </div>

              <div className="EmptyTips">
                <div className="Tip">
                  <span className="TipDot dotPrimary" aria-hidden="true" /> Objects become big “bubbles”
                </div>
                <div className="Tip">
                  <span className="TipDot dotSuccess" aria-hidden="true" /> Arrays become energetic nodes
                </div>
                <div className="Tip">
                  <span className="TipDot dotInk" aria-hidden="true" /> Connections show structure flow
                </div>
              </div>
            </div>
          )}
        </section>
      </main>

      <footer className="Footer">
        <div className="FooterLeft">Single-page tool. No data leaves your browser.</div>
        <div className="FooterRight">Accents: #3b82f6 • #06b6d4</div>
      </footer>
    </div>
  );
}

export default App;
