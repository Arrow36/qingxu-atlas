"use client";

import { ChangeEvent, PointerEvent, WheelEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import initialData from "./data/emotions.json";

type Emotion = {
  id: string;
  word: string;
  kind: "词语" | "成语" | "短语";
  family: string;
  tone: string;
  x: number;
  y: number;
  intensity: number;
  definition: string;
  nuance: string;
  examples: string[];
};

type View = { x: number; y: number; scale: number };

const WORLD = { width: 2400, height: 1600 };
const DEFAULT_SCALE = 0.72;
const MIN_SCALE = 0.42;
const MAX_SCALE = 1.65;
const CENTER = { x: WORLD.width / 2, y: WORLD.height / 2 };
const GUIDE_RADIUS = 460;
const HEX_X = Math.sqrt(3) * GUIDE_RADIUS / 2;

const primaryAxes: Record<string, { x: number; y: number }> = {
  亲近: { x: -Math.sqrt(3) / 2, y: -0.5 },
  惊奇: { x: 0, y: -1 },
  喜悦: { x: Math.sqrt(3) / 2, y: -0.5 },
  愤怒: { x: Math.sqrt(3) / 2, y: 0.5 },
  恐惧: { x: 0, y: 1 },
  悲伤: { x: -Math.sqrt(3) / 2, y: 0.5 },
};

const auxiliaryAxes: Record<string, { x: number; y: number }> = {
  期待: { x: 0.5, y: -Math.sqrt(3) / 2 },
  厌恶: { x: 0.5, y: Math.sqrt(3) / 2 },
  自省: { x: -0.5, y: Math.sqrt(3) / 2 },
  混合: { x: 1, y: 0 },
};

const guideLabels = [
  { label: "亲近", x: CENTER.x - HEX_X, y: CENTER.y - GUIDE_RADIUS / 2, tone: "rose" },
  { label: "惊奇", x: CENTER.x, y: CENTER.y - GUIDE_RADIUS, tone: "cyan" },
  { label: "喜悦", x: CENTER.x + HEX_X, y: CENTER.y - GUIDE_RADIUS / 2, tone: "amber" },
  { label: "愤怒", x: CENTER.x + HEX_X, y: CENTER.y + GUIDE_RADIUS / 2, tone: "coral" },
  { label: "恐惧", x: CENTER.x, y: CENTER.y + GUIDE_RADIUS, tone: "violet" },
  { label: "悲伤", x: CENTER.x - HEX_X, y: CENTER.y + GUIDE_RADIUS / 2, tone: "blue" },
  { label: "平静", x: CENTER.x, y: CENTER.y, tone: "sage" },
];

const familyLegend = [
  ["rose", "亲近"], ["cyan", "惊奇"], ["amber", "喜悦"],
  ["coral", "愤怒"], ["violet", "恐惧"], ["blue", "悲伤"], ["sage", "平静"],
];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function arrangeEmotions(source: Emotion[]) {
  const placements = new Map<string, { x: number; y: number }>();
  const primaryRadii = [0, 180, 320, GUIDE_RADIUS, 600, 730];
  const auxiliaryRadii = [0, 160, 270, 380, 490, 590];

  const placeBand = (
    items: Emotion[],
    axis: { x: number; y: number },
    radius: number,
    compact = false,
  ) => {
    const tangent = { x: -axis.y, y: axis.x };
    const sorted = [...items].sort((a, b) => a.id.localeCompare(b.id));

    sorted.forEach((emotion, index) => {
      const ring = Math.floor(index / 6);
      const ringStart = ring * 6;
      const ringCount = Math.min(6, sorted.length - ringStart);
      const position = index - ringStart;
      const angle = (position / ringCount) * Math.PI * 2 + ring * Math.PI / 6;
      const tangentRadius = (compact ? 104 : 126) + ring * (compact ? 72 : 88);
      const radialRadius = (compact ? 52 : 64) + ring * (compact ? 28 : 34);
      const radialOffset = Math.sin(angle) * radialRadius;
      const tangentOffset = Math.cos(angle) * tangentRadius;

      placements.set(emotion.id, {
        x: CENTER.x + axis.x * (radius + radialOffset) + tangent.x * tangentOffset,
        y: CENTER.y + axis.y * (radius + radialOffset) + tangent.y * tangentOffset,
      });
    });
  };

  Object.entries(primaryAxes).forEach(([family, axis]) => {
    for (let intensity = 1; intensity <= 5; intensity += 1) {
      placeBand(
        source.filter((item) => item.family === family && item.intensity === intensity),
        axis,
        primaryRadii[intensity],
      );
    }
  });

  Object.entries(auxiliaryAxes).forEach(([family, axis]) => {
    for (let intensity = 1; intensity <= 5; intensity += 1) {
      placeBand(
        source.filter((item) => item.family === family && item.intensity === intensity),
        axis,
        auxiliaryRadii[intensity],
        true,
      );
    }
  });

  const calmItems = source
    .filter((item) => item.family === "宁静")
    .sort((a, b) => a.intensity - b.intensity || a.id.localeCompare(b.id));
  let calmCursor = 0;
  let calmRing = 0;
  while (calmCursor < calmItems.length) {
    const capacity = 6 + calmRing * 2;
    const ringItems = calmItems.slice(calmCursor, calmCursor + capacity);
    const radius = 110 + calmRing * 60;
    ringItems.forEach((emotion, index) => {
      const angle = (index / ringItems.length) * Math.PI * 2 + calmRing * 0.31;
      placements.set(emotion.id, {
        x: CENTER.x + Math.cos(angle) * radius,
        y: CENTER.y + Math.sin(angle) * radius,
      });
    });
    calmCursor += ringItems.length;
    calmRing += 1;
  }

  const unplaced = source.filter((item) => !placements.has(item.id));
  unplaced.forEach((emotion, index) => {
    const angle = index * 2.39996;
    const radius = 220 + Math.sqrt(index + 1) * 34;
    placements.set(emotion.id, {
      x: CENTER.x + Math.cos(angle) * radius,
      y: CENTER.y + Math.sin(angle) * radius,
    });
  });

  type LayoutNode = Emotion & { anchorX: number; anchorY: number; halfWidth: number };
  const nodes: LayoutNode[] = source.map((emotion) => {
    const position = placements.get(emotion.id) ?? CENTER;
    return {
      ...emotion,
      x: position.x,
      y: position.y,
      anchorX: position.x,
      anchorY: position.y,
      halfWidth: Math.max(34, emotion.word.length * 8 + 14),
    };
  });

  const separateNodes = (withSpring: boolean) => {
    guideLabels.forEach((guide) => {
      nodes.forEach((node) => {
        const dx = node.x - guide.x;
        const dy = node.y - guide.y;
        const overlapX = node.halfWidth + 102 - Math.abs(dx);
        const overlapY = 58 - Math.abs(dy);
        if (overlapX <= 0 || overlapY <= 0) return;

        if (overlapX < overlapY) {
          node.x += (dx >= 0 ? 1 : -1) * overlapX;
        } else {
          node.y += (dy >= 0 ? 1 : -1) * overlapY;
        }
      });
    });

    for (let left = 0; left < nodes.length; left += 1) {
      for (let right = left + 1; right < nodes.length; right += 1) {
        const a = nodes[left];
        const b = nodes[right];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const overlapX = a.halfWidth + b.halfWidth + 13 - Math.abs(dx);
        const overlapY = 43 - Math.abs(dy);
        if (overlapX <= 0 || overlapY <= 0) continue;

        if (overlapX < overlapY) {
          const shift = overlapX / 2 + 0.5;
          const direction = dx === 0 ? (a.id < b.id ? -1 : 1) : Math.sign(dx);
          a.x += direction * shift;
          b.x -= direction * shift;
        } else {
          const shift = overlapY / 2 + 0.5;
          const direction = dy === 0 ? (a.id < b.id ? -1 : 1) : Math.sign(dy);
          a.y += direction * shift;
          b.y -= direction * shift;
        }
      }
    }

    nodes.forEach((node) => {
      if (withSpring) {
        node.x += (node.anchorX - node.x) * 0.025;
        node.y += (node.anchorY - node.y) * 0.025;
      }
      node.x = clamp(node.x, node.halfWidth + 42, WORLD.width - node.halfWidth - 42);
      node.y = clamp(node.y, 58, WORLD.height - 58);
    });
  };

  for (let iteration = 0; iteration < 90; iteration += 1) separateNodes(true);
  for (let iteration = 0; iteration < 20; iteration += 1) separateNodes(false);

  return nodes.map(({ anchorX: _anchorX, anchorY: _anchorY, halfWidth: _halfWidth, ...emotion }) => ({
    ...emotion,
    x: Math.round(emotion.x),
    y: Math.round(emotion.y),
  }));
}

function dictionaryUrl(word: string) {
  return `https://dict.revised.moe.edu.tw/search.jsp?la=0&powerMode=0&word=${encodeURIComponent(word)}`;
}

export default function Home() {
  const [emotions, setEmotions] = useState<Emotion[]>(() => arrangeEmotions(initialData as Emotion[]));
  const [selected, setSelected] = useState<Emotion | null>(null);
  const [view, setView] = useState<View>({ x: 0, y: 0, scale: DEFAULT_SCALE });
  const [query, setQuery] = useState("");
  const [showAbout, setShowAbout] = useState(false);
  const [notice, setNotice] = useState("");
  const viewportRef = useRef<HTMLDivElement>(null);
  const dragging = useRef({
    active: false,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    moved: false,
    targetId: null as string | null,
  });
  const fileInput = useRef<HTMLInputElement>(null);

  const resetView = useCallback(() => {
    const box = viewportRef.current?.getBoundingClientRect();
    if (!box) return;
    const scale = box.width < 720 ? 0.48 : DEFAULT_SCALE;
    setView({
      x: box.width / 2 - (WORLD.width / 2) * scale,
      y: box.height / 2 - (WORLD.height / 2) * scale,
      scale,
    });
  }, []);

  useEffect(() => {
    resetView();
    window.addEventListener("resize", resetView);
    return () => window.removeEventListener("resize", resetView);
  }, [resetView]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 3200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const neighbors = useMemo(() => {
    if (!selected) return [];
    return emotions
      .filter((item) => item.id !== selected.id)
      .map((item) => ({ item, distance: Math.hypot(item.x - selected.x, item.y - selected.y) }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 5)
      .map(({ item }) => item);
  }, [emotions, selected]);

  const focusEmotion = useCallback((emotion: Emotion) => {
    const box = viewportRef.current?.getBoundingClientRect();
    if (!box) return;
    const scale = Math.max(view.scale, 0.86);
    setView({
      x: box.width / 2 - emotion.x * scale - (box.width > 900 ? 150 : 0),
      y: box.height / 2 - emotion.y * scale,
      scale,
    });
    setSelected(emotion);
  }, [view.scale]);

  const handleSearch = () => {
    const clean = query.trim();
    if (!clean) return;
    const match = emotions.find((item) => item.word.includes(clean)) ??
      emotions.find((item) => item.definition.includes(clean) || item.family.includes(clean));
    if (match) focusEmotion(match);
    else setNotice(`还没有收录“${clean}”`);
  };

  const zoomAtCenter = (factor: number) => {
    const box = viewportRef.current?.getBoundingClientRect();
    if (!box) return;
    const cx = box.width / 2;
    const cy = box.height / 2;
    setView((current) => {
      const nextScale = clamp(current.scale * factor, MIN_SCALE, MAX_SCALE);
      const worldX = (cx - current.x) / current.scale;
      const worldY = (cy - current.y) / current.scale;
      return { x: cx - worldX * nextScale, y: cy - worldY * nextScale, scale: nextScale };
    });
  };

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const box = viewportRef.current?.getBoundingClientRect();
    if (!box) return;
    const px = event.clientX - box.left;
    const py = event.clientY - box.top;
    setView((current) => {
      const nextScale = clamp(current.scale * Math.exp(-event.deltaY * 0.0012), MIN_SCALE, MAX_SCALE);
      const worldX = (px - current.x) / current.scale;
      const worldY = (py - current.y) / current.scale;
      return { x: px - worldX * nextScale, y: py - worldY * nextScale, scale: nextScale };
    });
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const emotionNode = (event.target as HTMLElement).closest<HTMLElement>("[data-emotion-id]");
    dragging.current = {
      active: true,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      moved: false,
      targetId: emotionNode?.dataset.emotionId ?? null,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragging.current.active) return;
    const distance = Math.hypot(
      event.clientX - dragging.current.startX,
      event.clientY - dragging.current.startY,
    );
    if (!dragging.current.moved && distance < 6) return;

    if (!dragging.current.moved) {
      dragging.current.moved = true;
      event.currentTarget.classList.add("is-dragging");
    }

    const dx = event.clientX - dragging.current.lastX;
    const dy = event.clientY - dragging.current.lastY;
    dragging.current.lastX = event.clientX;
    dragging.current.lastY = event.clientY;
    setView((current) => ({ ...current, x: current.x + dx, y: current.y + dy }));
  };

  const finishPointer = (event: PointerEvent<HTMLDivElement>, cancelled = false) => {
    const gesture = { ...dragging.current };
    dragging.current.active = false;
    event.currentTarget.classList.remove("is-dragging");
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (cancelled || gesture.moved) return;
    if (gesture.targetId) {
      const emotion = emotions.find((item) => item.id === gesture.targetId);
      if (emotion) setSelected(emotion);
    } else {
      setSelected(null);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") { setSelected(null); setShowAbout(false); return; }
    if (event.key === "+" || event.key === "=") { zoomAtCenter(1.12); return; }
    if (event.key === "-") { zoomAtCenter(0.88); return; }
    if (event.key === "0") { resetView(); return; }
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [48, 0], ArrowRight: [-48, 0], ArrowUp: [0, 48], ArrowDown: [0, -48],
    };
    const move = moves[event.key];
    if (move) {
      event.preventDefault();
      setView((current) => ({ ...current, x: current.x + move[0], y: current.y + move[1] }));
    }
  };

  const importData = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as Emotion[];
      const valid = Array.isArray(parsed) && parsed.length > 0 && parsed.every((item) =>
        item.id && item.word && Number.isFinite(item.x) && Number.isFinite(item.y) && Array.isArray(item.examples)
      );
      if (!valid) throw new Error("invalid");
      setEmotions(arrangeEmotions(parsed));
      setSelected(null);
      setShowAbout(false);
      setNotice(`已在本地载入 ${parsed.length} 个词条`);
      window.setTimeout(resetView, 0);
    } catch {
      setNotice("导入失败：请使用情绪地图 JSON 格式");
    } finally {
      event.target.value = "";
    }
  };

  const downloadData = () => {
    const blob = new Blob([JSON.stringify(emotions, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "emotions.json";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-block">
          <div className="brand-mark" aria-hidden="true"><span /><span /><span /></div>
          <div>
            <p className="eyebrow">EMOTIONAL ATLAS</p>
            <h1>情绪地形图</h1>
          </div>
        </div>

        <div className="search-wrap">
          <label className="search-box">
            <span aria-hidden="true">⌕</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && handleSearch()}
              placeholder="寻找一种感受…"
              aria-label="搜索情绪词"
            />
            <kbd>↵</kbd>
          </label>
        </div>

        <nav className="header-actions" aria-label="页面工具">
          <button className="quiet-button" onClick={() => setShowAbout(true)}>关于与数据</button>
          <span className="open-pill"><i /> 开源原型</span>
        </nav>
      </header>

      <section className="atlas-stage" aria-label="可拖拽的情绪词地图">
        <div
          ref={viewportRef}
          className="atlas-viewport"
          tabIndex={0}
          onWheel={handleWheel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={(event) => finishPointer(event)}
          onPointerCancel={(event) => finishPointer(event, true)}
          onKeyDown={handleKeyDown}
        >
          <div
            className="emotion-world"
            style={{ width: WORLD.width, height: WORLD.height, transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}
          >
            <div className="world-glow glow-joy" />
            <div className="world-glow glow-calm" />
            <div className="world-glow glow-sad" />
            <div className="world-glow glow-fear" />
            <div className="world-glow glow-love" />
            <div className="world-glow glow-surprise" />
            <div className="world-glow glow-anger" />
            <div className="guide-line guide-horizontal" />
            <div className="guide-line guide-diagonal" />
            <div className="guide-line guide-diagonal-two" />

            {guideLabels.map((guide) => (
              <div
                key={guide.label}
                className={`guide-label tone-${guide.tone}`}
                style={{ left: guide.x, top: guide.y }}
                aria-hidden="true"
              >
                <span>{guide.label}</span>
              </div>
            ))}

            {emotions.map((emotion, index) => (
              <button
                key={emotion.id}
                data-emotion-id={emotion.id}
                className={`emotion-node tone-${emotion.tone} ${selected?.id === emotion.id ? "is-selected" : ""}`}
                style={{
                  left: emotion.x,
                  top: emotion.y,
                  zIndex: selected?.id === emotion.id ? 5 : 2,
                  animationDelay: `${(index % 12) * 35}ms`,
                }}
                onClick={(event) => event.detail === 0 && setSelected(emotion)}
                aria-label={`${emotion.word}，${emotion.family}，强度 ${emotion.intensity}/5`}
              >
                <span className="node-word">{emotion.word}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="map-caption">
          <p><span className="pulse-dot" /> 拖动画布，在词语之间漫游</p>
          <small>从“平静”向外强度逐渐升高；轻点空白处关闭详情</small>
        </div>

        <div className="zoom-controls" aria-label="地图缩放">
          <button onClick={() => zoomAtCenter(1.14)} aria-label="放大">＋</button>
          <span>{Math.round(view.scale * 100)}%</span>
          <button onClick={() => zoomAtCenter(0.86)} aria-label="缩小">−</button>
          <button className="reset-button" onClick={resetView} aria-label="重置地图">◎</button>
        </div>

        <div className="legend" aria-label="情绪方向图例">
          {familyLegend.map(([tone, label]) => <span key={tone}><i className={`tone-dot tone-${tone}`} />{label}</span>)}
        </div>
      </section>

      <aside className={`detail-panel ${selected ? "is-open" : ""}`} aria-hidden={!selected}>
        {selected && (
          <>
            <div className={`detail-hero tone-bg-${selected.tone}`}>
              <button className="close-button" onClick={() => setSelected(null)} aria-label="关闭词条详情">×</button>
              <p>{selected.family} · {selected.kind}</p>
              <h2>{selected.word}</h2>
              <div className="intensity-row">
                <span>表达强度</span>
                <div>{Array.from({ length: 5 }).map((_, index) => <i key={index} className={index < selected.intensity ? "filled" : ""} />)}</div>
                <strong>{selected.intensity}/5</strong>
              </div>
            </div>

            <div className="detail-scroll">
              <section className="detail-section">
                <p className="section-label">感受说明</p>
                <p className="definition">{selected.definition}</p>
                <p className="nuance">{selected.nuance}</p>
              </section>

              <section className="detail-section">
                <p className="section-label">使用案例</p>
                <div className="examples-list">
                  {selected.examples.map((example, index) => (
                    <article key={example}>
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <p>{example}</p>
                      <a href={dictionaryUrl(selected.word)} target="_blank" rel="noreferrer" aria-label={`查看“${selected.word}”的词义依据`} title="原创例句；外链用于词义核验">词义依据 ↗</a>
                    </article>
                  ))}
                </div>
                <p className="source-note">案例句为本站原创，不引自外部作品；外链用于核验词义。</p>
              </section>

              <section className="detail-section">
                <p className="section-label">邻近感受</p>
                <div className="neighbor-list">
                  {neighbors.map((emotion) => (
                    <button key={emotion.id} onClick={() => focusEmotion(emotion)}>{emotion.word}<span>→</span></button>
                  ))}
                </div>
              </section>

              <section className="detail-section source-section">
                <p className="section-label">参考与核验</p>
                <a href={dictionaryUrl(selected.word)} target="_blank" rel="noreferrer">
                  <span>教育部《重编国语辞典修订本》</span><b>检索词条 ↗</b>
                </a>
                <a href="https://bcc.blcu.edu.cn/" target="_blank" rel="noreferrer">
                  <span>BCC 汉语语料库</span><b>核验语境 ↗</b>
                </a>
              </section>
            </div>
          </>
        )}
      </aside>

      {showAbout && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setShowAbout(false)}>
          <section className="about-modal" role="dialog" aria-modal="true" aria-labelledby="about-title">
            <button className="close-button dark" onClick={() => setShowAbout(false)} aria-label="关闭">×</button>
            <p className="eyebrow">ABOUT THE ATLAS</p>
            <h2 id="about-title">词语自由，内容有据</h2>
            <p className="about-lead">单个常用词通常不由某一方垄断，但辞典释义、文学例句、数据库的选择与编排可能受版权或授权条款保护。</p>
            <div className="principle-grid">
              <div><span>01</span><h3>独立撰写</h3><p>本站释义与案例采用原创表达，避免复制商业辞典。</p></div>
              <div><span>02</span><h3>交叉核验</h3><p>词义连接权威辞典，用法可由语料库进一步核查。</p></div>
              <div><span>03</span><h3>数据分离</h3><p>地图内容使用独立 JSON，可替换、审校与版本管理。</p></div>
            </div>
            <div className="data-actions">
              <div><strong>本地数据工具</strong><small>导入只在当前页面生效，不会上传文件。</small></div>
              <button onClick={downloadData}>导出当前 JSON</button>
              <button className="primary" onClick={() => fileInput.current?.click()}>导入 JSON</button>
              <input ref={fileInput} type="file" accept="application/json,.json" onChange={importData} hidden />
            </div>
            <p className="legal-footnote">代码采用 MIT License；原创释义与案例采用 CC BY 4.0。外部链接内容仍适用各来源条款。本说明不构成法律意见。</p>
          </section>
        </div>
      )}

      {notice && <div className="toast" role="status">{notice}</div>}
    </main>
  );
}
