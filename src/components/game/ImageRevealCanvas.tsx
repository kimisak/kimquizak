'use client';

import { useEffect, useId, useRef, useState } from "react";
import type { Question } from "@/lib/types";
import { constrainImageRevealFrame, getImageRevealVisibleFractions } from "@/lib/imageReveal";
import { getImageRevealFrame, getImageRevealStageFrame, getImageRevealLevels, getImageRevealAreas, getImageAreaIslands, getImageAreaOpeningTiles, getImageAreaPlayableIndexes, IMAGE_AREA_COLORS, panImageRevealFrame } from "@/lib/imageReveal";

export function ImageRevealCanvas({ question, step, full = false, onPan, onScrollZoom, onPatch, selectedArea = -1, showSource = false, revealedAreas = [], onChooseArea }: {
  question: Question; step: number; full?: boolean;
  onPan?: (x: number, y: number) => void; onScrollZoom?: (factor: number) => void;
  onPatch?: (tile: number, erase?: boolean) => void; selectedArea?: number; showSource?: boolean;
  revealedAreas?: number[]; onChooseArea?: (area: number) => void;
}) {
  const id = useId().replace(/:/g, "");
  const surfaceRef = useRef<HTMLDivElement>(null);
  const patchStroke = useRef<{ pointerId: number; visited: Set<number>; erase: boolean; last?: { x: number; y: number } } | null>(null);
  const patchTargets = useRef<Array<SVGRectElement | null>>([]);
  const [focusedTile, setFocusedTile] = useState(0);
  const drag = useRef<{ pointerId: number; x: number; y: number; focusX: number; focusY: number; detail: number; pending?: { x: number; y: number } } | null>(null);
  const [panPreview, setPanPreview] = useState<{ x: number; y: number } | null>(null);
  const [loaded, setLoaded] = useState<{ src: string; width: number; height: number } | null>(null);
  const [failed, setFailed] = useState(false);
  const [surfaceAspect, setSurfaceAspect] = useState(1);
  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) return;
    const update = () => {
      if (surface.clientWidth && surface.clientHeight) setSurfaceAspect(surface.clientWidth / surface.clientHeight);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(surface);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface || !onScrollZoom) return;
    const wheel = (event: WheelEvent) => {
      // React's delegated wheel listener is passive; a local listener lets this surface own scrolling.
      event.preventDefault();
      event.stopPropagation();
      if (drag.current) return;
      const pixels = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? surface.clientHeight : 1);
      onScrollZoom(Math.exp(-Math.max(-240, Math.min(240, pixels)) * .003));
    };
    surface.addEventListener("wheel", wheel, { passive: false });
    return () => surface.removeEventListener("wheel", wheel);
  }, [onScrollZoom]);
  useEffect(() => {
    let active = true;
    const image = new Image();
    image.onload = () => { if (active) { setLoaded({ src: image.src, width: image.naturalWidth, height: image.naturalHeight }); setFailed(false); } };
    image.onerror = () => { if (active) setFailed(true); };
    image.src = question.imageData || "";
    return () => { active = false; };
  }, [question.imageData]);
  const areas = getImageRevealAreas(question);
  const isAreas = question.imageRevealStyle === "areas";
  const openingTiles = getImageAreaOpeningTiles(question);
  const playableAreas = new Set(getImageAreaPlayableIndexes(question));
  const visiblePatches = isAreas ? [...new Set([...openingTiles, ...revealedAreas.flatMap(area => areas[area] ?? [])])] : [];
  const areaVisible = new Set(visiblePatches);
  const levels = getImageRevealLevels(question.imageRevealLevels);
  const detail = full ? 100 : levels[Math.min(levels.length - 1, Math.max(0, step))];
  const style = question.imageRevealStyle || "zoom";
  const width = 1000;
  const sourceHeight = loaded ? width * loaded.height / loaded.width : 650;
  const cropAreas = isAreas && !full && question.imageRevealFillFrame && !!question.imageRevealAreaFrameAspect;
  const height = cropAreas ? width / question.imageRevealAreaFrameAspect! : sourceHeight;
  // Paint on the whole source image; Player view previews the host's chosen crop.
  const fillFrame = !full && (!onPatch || cropAreas) && question.imageRevealFillFrame;
  const staticFraming = question.imageRevealFraming?.[style === "blur" ? "blur" : "areas"];
  const staticZoom = Math.max(1, Math.min(50, staticFraming?.zoom ?? 1));
  const framingDetail = style === "zoom" ? detail : 100 / staticZoom ** 2;
  const visible = fillFrame ? getImageRevealVisibleFractions(width / sourceHeight, cropAreas ? question.imageRevealAreaFrameAspect! : surfaceAspect) : { x: 1, y: 1 };
  const savedFrame = full || (onPatch && !cropAreas) ? getImageRevealFrame(100, 100) : style === "zoom" ? getImageRevealStageFrame(question, step)
    : fillFrame ? { size:1 / staticZoom, scale:staticZoom, x:(staticFraming?.x ?? 50) / 100 - .5 / staticZoom, y:(staticFraming?.y ?? 50) / 100 - .5 / staticZoom }
      : getImageRevealFrame(100, 100);
  const frame = constrainImageRevealFrame(panPreview
    ? { ...savedFrame, x: panPreview.x / 100 - savedFrame.size / 2, y: panPreview.y / 100 - savedFrame.size / 2 }
    : savedFrame, visible);
  const focusX = frame.x + frame.size / 2;
  const focusY = frame.y + frame.size / 2;
  const ready = loaded?.src === question.imageData;
  const sourceVisible = showSource && Boolean(onPatch || onPan) && !full;
  const belongsToBrush = (tile: number) => selectedArea < 0
    ? openingTiles.includes(tile)
    : (areas[selectedArea] ?? []).includes(tile);
  const localPoint = (svg: SVGSVGElement, x: number, y: number) => {
    const matrix = svg.getScreenCTM();
    if (!matrix) return null;
    const point = svg.createSVGPoint(); point.x = x; point.y = y;
    return point.matrixTransform(matrix.inverse());
  };
  const paintPatch = (svg: SVGSVGElement, x: number, y: number) => {
    const stroke = patchStroke.current;
    const point = localPoint(svg, x, y);
    if (!stroke || !point) return;
    if (point.x < 0 || point.y < 0 || point.x >= width || point.y >= height) { stroke.last = undefined; return; }
    const start = stroke.last ?? point;
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(point.x - start.x) / (width / 48), Math.abs(point.y - start.y) / (height / 32))));
    for (let i = 1; i <= steps; i++) {
      const px = start.x + (point.x - start.x) * i / steps;
      const py = start.y + (point.y - start.y) * i / steps;
      const tile = Math.floor(py / height * 16) * 24 + Math.floor(px / width * 24);
      if (stroke.visited.has(tile)) continue;
      stroke.visited.add(tile);
      onPatch?.(tile, stroke.erase);
    }
    stroke.last = { x: point.x, y: point.y };
  };
  return (
    <div ref={surfaceRef} className={`image-reveal-canvas${onPan ? " is-framing" : ""}${onPatch ? " is-patch-editing" : ""}${sourceVisible ? " is-source-visible" : ""}`} data-style={style} data-detail={detail}>
      {!ready ? <p role="status">{failed ? "Image could not load. Close the card and check its source in config." : "Loading image…"}</p> : (
        <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio={fillFrame && !cropAreas ? "xMidYMid slice" : "xMidYMid meet"} role={onPatch || onChooseArea ? "group" : "img"} aria-label={onPatch ? selectedArea < 0 ? "Opening tile editor. Arrow keys move between cells; Enter or Space hides or shows a cell." : "Area editor. Arrow keys move between cells; Enter or Space paints or erases the selected area." : onPan ? "Stage image framing. Scroll to zoom, drag to pan. Arrow keys pan; plus and minus zoom." : full ? "Revealed image" : showSource ? "Source image for area editing" : "Mystery image"}
          tabIndex={onPan || onScrollZoom ? 0 : undefined}
          style={onPatch ? { touchAction: "none", userSelect: "none" } : undefined}
          onPointerDown={onPan || onPatch ? event => {
            if (event.button !== 0 || drag.current || patchStroke.current) return;
            const local = localPoint(event.currentTarget, event.clientX, event.clientY);
            if (!local || local.x < 0 || local.x >= width || local.y < 0 || local.y >= height) return;
            event.preventDefault(); event.stopPropagation();
            if (onPatch) {
              const tile = Math.floor(local.y / height * 16) * 24 + Math.floor(local.x / width * 24);
              patchStroke.current = { pointerId: event.pointerId, visited: new Set(), erase: belongsToBrush(tile) };
              setFocusedTile(tile);
              patchTargets.current[tile]?.focus({ preventScroll: true });
              event.currentTarget.setPointerCapture(event.pointerId);
              paintPatch(event.currentTarget, event.clientX, event.clientY);
              return;
            }
            event.currentTarget.focus({ preventScroll: true });
            event.currentTarget.setPointerCapture(event.pointerId);
            drag.current = { pointerId: event.pointerId, x: local.x, y: local.y, focusX: focusX * 100, focusY: focusY * 100, detail: framingDetail };
          } : undefined}
          onPointerMove={onPan || onPatch ? event => {
            if (patchStroke.current?.pointerId === event.pointerId) {
              paintPatch(event.currentTarget, event.clientX, event.clientY);
              return;
            }
            const start = drag.current;
            if (!start || start.pointerId !== event.pointerId) return;
            const local = localPoint(event.currentTarget, event.clientX, event.clientY);
            if (!local) return;
            const focus = panImageRevealFrame(start.detail, start.focusX, start.focusY, (local.x - start.x) / width * (cropAreas ? visible.x : 1), (local.y - start.y) / height * (cropAreas ? visible.y : 1), visible);
            start.pending = focus;
            setPanPreview(focus);
          } : undefined}
          onPointerUp={event => {
            if (patchStroke.current?.pointerId === event.pointerId) {
              patchStroke.current = null;
              event.currentTarget.releasePointerCapture(event.pointerId);
              return;
            }
            if (drag.current?.pointerId !== event.pointerId) return;
            // Save once per gesture, not one full image-containing question record per mouse move.
            const focus = drag.current.pending;
            if (focus) onPan?.(focus.x, focus.y);
            drag.current = null; setPanPreview(null);
            event.currentTarget.releasePointerCapture(event.pointerId);
          }}
          onPointerCancel={() => { patchStroke.current = null; drag.current = null; setPanPreview(null); }}
          onLostPointerCapture={() => { patchStroke.current = null; drag.current = null; setPanPreview(null); }}
          onKeyDown={onPan || onScrollZoom ? event => {
            if (onScrollZoom && ["+", "=", "-"].includes(event.key)) {
              event.preventDefault(); event.stopPropagation();
              onScrollZoom(event.key === "-" ? 1 / 1.2 : 1.2);
              return;
            }
            const moves: Record<string, [number, number]> = { ArrowLeft: [-.04, 0], ArrowRight: [.04, 0], ArrowUp: [0, -.04], ArrowDown: [0, .04] };
            const move = moves[event.key];
            if (!move) return;
            event.preventDefault(); event.stopPropagation();
            const focus = panImageRevealFrame(framingDetail, focusX * 100, focusY * 100, ...move, visible);
            onPan?.(focus.x, focus.y);
          } : undefined}>
          <defs>
            <linearGradient id={`${id}-area-cover`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#234e3b" /><stop offset="1" stopColor="#102b21" /></linearGradient>
            <clipPath id={`${id}-bounds`}><rect width={width} height={height} /></clipPath>
            <clipPath id={`${id}-patches`}>
              {visiblePatches.map(cell => <rect key={cell} x={(cell % 24) * width / 24} y={Math.floor(cell / 24) * height / 16} width={width / 24} height={height / 16} />)}
            </clipPath>
            <filter id={`${id}-blur`} x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation={(100 - detail) / 100 * 40} edgeMode="duplicate" /></filter>
          </defs>
          <g clipPath={`url(#${id}-bounds)`}>
            <g transform={style !== "zoom" && fillFrame && !cropAreas ? `translate(${-frame.x * width * frame.scale} ${-frame.y * height * frame.scale}) scale(${frame.scale})` : undefined}>
            {cropAreas ? <svg width={width} height={height} viewBox={`0 0 ${width} ${sourceHeight}`} preserveAspectRatio="xMidYMid slice" overflow="hidden">
              <image href={question.imageData!} width={width} height={sourceHeight}
                transform={`translate(${-frame.x * width * frame.scale} ${-frame.y * sourceHeight * frame.scale}) scale(${frame.scale})`} />
            </svg> :
            <image href={question.imageData!} width={width} height={height}
              transform={style === "zoom" && !full ? `translate(${-frame.x * width * frame.scale} ${-frame.y * height * frame.scale}) scale(${frame.scale})` : undefined}
              filter={style === "blur" && detail < 100 ? `url(#${id}-blur)` : undefined}
            />}
            {isAreas && !full && <path className="image-reveal-opening-cover" fill="#102b21" opacity={sourceVisible ? .45 : 1} d={Array.from({ length: 384 }, (_, tile) => tile).filter(tile => !areaVisible.has(tile)).map(tile => `M${tile % 24 * width / 24},${Math.floor(tile / 24) * height / 16}h${width / 24}v${height / 16}h${-width / 24}Z`).join(' ')} />}
            {isAreas && !full && areas.map((tiles, area) => {
              if (onPatch && selectedArea < 0 && !sourceVisible) return null;
              if (!tiles.length || (!onPatch && (revealedAreas.includes(area) || !playableAreas.has(area)))) return null;
              const anchors = getImageAreaIslands(tiles).map(island => {
                const averageX = island.reduce((sum, tile) => sum + tile % 24, 0) / island.length;
                const averageY = island.reduce((sum, tile) => sum + Math.floor(tile / 24), 0) / island.length;
                return island.reduce((best, tile) => Math.hypot(tile % 24 - averageX, Math.floor(tile / 24) - averageY) < Math.hypot(best % 24 - averageX, Math.floor(best / 24) - averageY) ? tile : best, island[0]);
              });
              const cells = new Set(tiles);
              const cw = width / 24, ch = height / 16;
              const shape = tiles.filter(tile => onPatch || !areaVisible.has(tile)).map(tile => `M${tile % 24 * cw},${Math.floor(tile / 24) * ch}h${cw}v${ch}h${-cw}Z`).join(' ');
              const outline = tiles.map(tile => {
                const col = tile % 24, row = Math.floor(tile / 24), x = col * cw, y = row * ch;
                return `${!cells.has(tile - 24) ? `M${x},${y}h${cw}` : ''} ${col === 23 || !cells.has(tile + 1) ? `M${x + cw},${y}v${ch}` : ''} ${!cells.has(tile + 24) ? `M${x},${y + ch}h${cw}` : ''} ${col === 0 || !cells.has(tile - 1) ? `M${x},${y}v${ch}` : ''}`;
              }).join(' ');
              const badgeRadius = Math.min(26, Math.min(cw, ch) * .48);
              const activate = () => onChooseArea?.(area);
              return <g key={area} className="image-reveal-area-cover" role={onChooseArea ? "button" : undefined} tabIndex={onChooseArea ? 0 : undefined}
                aria-label={`Reveal area ${area + 1}`} onClick={activate}
                onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); activate(); } }}
                style={{ cursor: onChooseArea ? "pointer" : "default", pointerEvents: onPatch ? "none" : undefined }}>
                <title>Area {area + 1} · all sections reveal together</title>
                <path d={shape} fill={onPatch ? IMAGE_AREA_COLORS[area] : `url(#${id}-area-cover)`} opacity={onPatch || sourceVisible ? .3 : 1} />
                <path className="image-reveal-area-edge" d={outline} fill="none" stroke={onPatch ? IMAGE_AREA_COLORS[area] : '#bfa774'} strokeWidth={onPatch && area === selectedArea ? 3 : 1.5} strokeLinejoin="round" />
                {anchors.map(anchor => <g key={anchor} className="image-reveal-area-badge">
                  <circle cx={(anchor % 24 + .5) * width / 24} cy={(Math.floor(anchor / 24) + .5) * height / 16} r={badgeRadius} fill="#f1e5cb" />
                  <text x={(anchor % 24 + .5) * width / 24} y={(Math.floor(anchor / 24) + .5) * height / 16} dominantBaseline="central" textAnchor="middle" fill="#173729" fontSize={badgeRadius * 1.2} fontWeight={800}>{area + 1}</text>
                </g>)}
              </g>;
            })}
            {onPatch && !full && <g role="grid" aria-label="Image cells" aria-rowcount={16} aria-colcount={24}>
              {Array.from({ length: 16 }, (_, row) => <g role="row" aria-rowindex={row + 1} key={row}>
                {Array.from({ length: 24 }, (_, column) => {
                  const tile = row * 24 + column;
                  const assignedArea = areas.findIndex(tiles => tiles.includes(tile));
                  const isOpening = openingTiles.includes(tile);
                  const state = [isOpening ? "Opening clue" : "Covered", assignedArea >= 0 ? `area ${assignedArea + 1}` : "no area"].join(" · ");
                  return <rect key={tile} ref={element => { patchTargets.current[tile] = element; }} className="image-reveal-patch-target" role="gridcell" tabIndex={tile === focusedTile ? 0 : -1}
                    aria-label={`Cell ${tile + 1}: ${state}`} aria-colindex={column + 1} aria-selected={belongsToBrush(tile)}
                    x={column * width / 24} y={row * height / 16} width={width / 24} height={height / 16}
                    fill="transparent" stroke="#ffffff50" strokeWidth={1}
                    onFocus={() => setFocusedTile(tile)}
                    onClick={event => { event.stopPropagation(); if (event.detail === 0) onPatch(tile, belongsToBrush(tile)); }}
                    onKeyDown={event => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault(); event.stopPropagation();
                        if (!event.repeat) onPatch(tile, belongsToBrush(tile));
                        return;
                      }
                      const destination: Record<string, number> = {
                        ArrowLeft: row * 24 + Math.max(0, column - 1), ArrowRight: row * 24 + Math.min(23, column + 1),
                        ArrowUp: Math.max(0, row - 1) * 24 + column, ArrowDown: Math.min(15, row + 1) * 24 + column,
                        Home: event.ctrlKey ? 0 : row * 24, End: event.ctrlKey ? 383 : row * 24 + 23,
                      };
                      if (!(event.key in destination)) return;
                      event.preventDefault(); event.stopPropagation();
                      const next = destination[event.key];
                      setFocusedTile(next); patchTargets.current[next]?.focus({ preventScroll: true });
                    }} />;
                })}
              </g>)}
            </g>}
            </g>
          </g>
        </svg>
      )}
    </div>
  );
}
