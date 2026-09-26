'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ImageRevealStyle, Question } from "@/lib/types";
import { getImageRevealLevels, getImageRevealPoints, getImageRevealStageFrame, getImageRevealAreas, getImageAreaPlayableIndexes, getImageAreaRewards, IMAGE_AREA_COLORS, IMAGE_REVEAL_STYLES, IMAGE_REVEAL_MAX_ZOOM, setImageRevealLevel, setImageRevealStageFocus } from "@/lib/imageReveal";
import { ImageRevealCanvas } from "@/components/game/ImageRevealCanvas";
import { clearImageRevealImage } from "@/lib/imageReveal";

export function ImageRevealFields({ question, boardValues, onChange, onImage }: {
  question: Question; boardValues: number[]; onChange: (patch: Partial<Question>) => void; onImage: (file: File | null) => void;
}) {
  const [selectedStage, setSelectedStage] = useState(0);
  const [framingRevision, setFramingRevision] = useState(0);
  const [selectedArea, setSelectedArea] = useState<number | null>(null);
  const [previewAreas, setPreviewAreas] = useState(false);
  const [showAreaSource, setShowAreaSource] = useState(false);
  const [frameAreas, setFrameAreas] = useState(false);
  const [pending, setPending] = useState<Partial<Question> | null>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const pendingRef = useRef<Partial<Question> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef({ question, onChange });
  useLayoutEffect(() => { latest.current = { question, onChange }; }, [question, onChange]);
  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    const patch = pendingRef.current;
    pendingRef.current = null;
    if (patch) { latest.current.onChange(patch); setPending(null); }
  }, []);
  useEffect(() => {
    window.addEventListener("pagehide", flush);
    return () => { window.removeEventListener("pagehide", flush); flush(); };
  }, [flush]);
  const queue = (patch: Partial<Question>) => {
    pendingRef.current = { ...pendingRef.current, ...patch };
    setPending(pendingRef.current);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, 180);
  };
  const removeImage = () => {
    // Discard delayed edits rather than allowing them to restore the removed image's setup.
    if (timer.current) clearTimeout(timer.current);
    pendingRef.current = null;
    setPending(null);
    setSelectedStage(0);
    setSelectedArea(null);
    setPreviewAreas(false);
    setShowAreaSource(false);
    setFrameAreas(false);
    setFramingRevision(value => value + 1);
    if (imageInput.current) imageInput.current.value = "";
    onChange(clearImageRevealImage());
  };
  const view = { ...question, ...pending };
  const startAreaFraming = () => {
    const current = { ...latest.current.question, ...pendingRef.current };
    const converting = !current.imageRevealAreaFrameAspect;
    if (converting && (getImageRevealAreas(current).length || Object.keys(current.imageRevealOpeningOverrides ?? {}).length || current.imageRevealInitiallyVisible?.length)) {
      if (!window.confirm("Use the framed crop as the area canvas? Existing areas and manual cell edits will be cleared so you can draw them on the crop.")) return;
    }
    flush();
    onChange({
      imageRevealFillFrame: true, imageRevealAreaFrameAspect: 1.6,
      ...(converting ? { imageRevealAreas: [], imageRevealOpeningOverrides: {}, imageRevealInitiallyVisible: [] } : {}),
    });
    setSelectedArea(null); setPreviewAreas(false); setFrameAreas(true);
  };
  const levels = getImageRevealLevels(view.imageRevealLevels);
  const stage = Math.min(selectedStage, levels.length - 1);
  const isZoom = (view.imageRevealStyle || "zoom") === "zoom";
  const isAreas = view.imageRevealStyle === "areas";
  const areas = getImageRevealAreas(view);
  const playableAreas = getImageAreaPlayableIndexes(view);
  const areaMode = view.imageRevealAreaMode ?? "rollover";
  const areaRewards = getImageAreaRewards(view, boardValues);
  const editStaticFraming = (patch: Partial<{ zoom: number; x: number; y: number }>) => {
    const current = { ...latest.current.question, ...pendingRef.current };
    const style = current.imageRevealStyle === "blur" ? "blur" : "areas";
    queue({ imageRevealFraming: { ...current.imageRevealFraming,
      [style]: { zoom:1, x:50, y:50, ...current.imageRevealFraming?.[style], ...patch },
    } });
  };
  const panStatic = (x: number, y: number) => { editStaticFraming({ x, y }); flush(); };
  const zoomStatic = (factor: number) => {
    const current = { ...latest.current.question, ...pendingRef.current };
    const style = current.imageRevealStyle === "blur" ? "blur" : "areas";
    editStaticFraming({ zoom:Math.max(1, Math.min(IMAGE_REVEAL_MAX_ZOOM, (current.imageRevealFraming?.[style]?.zoom ?? 1) * factor)) });
  };
  const paintArea = (tile: number, erase = false) => {
    const current = { ...latest.current.question, ...pendingRef.current };
    if (selectedArea === null) {
      queue({ imageRevealOpeningOverrides: { ...current.imageRevealOpeningOverrides, [tile]: !erase } });
      return;
    }
    if (!getImageRevealAreas(current)[selectedArea]) return;
    const next = getImageRevealAreas(current).map((tiles, index) => erase && index !== selectedArea ? tiles : tiles.filter(value => value !== tile));
    if (!erase) next[selectedArea].push(tile);
    queue({ imageRevealAreas: next });
  };
  const costs = view.imageRevealCostsPoints ?? true;
  const selectStage = (index: number) => {
    flush();
    setSelectedStage(index);
  };
  const copyPreviousFraming = () => {
    if (!stage) return;
    const current = { ...latest.current.question, ...pendingRef.current };
    const currentLevels = getImageRevealLevels(current.imageRevealLevels);
    const previous = getImageRevealStageFrame(current, stage - 1);
    const savedFrames = currentLevels.map((_, index) => {
      const frame = getImageRevealStageFrame(current, index);
      return { x: (frame.x + frame.size / 2) * 100, y: (frame.y + frame.size / 2) * 100 };
    });
    queue({
      imageRevealLevels: setImageRevealLevel(currentLevels, stage, currentLevels[stage - 1]),
      imageRevealStageFocus: setImageRevealStageFocus({ ...current, imageRevealStageFocus: savedFrames }, stage,
        (previous.x + previous.size / 2) * 100, (previous.y + previous.size / 2) * 100),
    });
    flush();
    setFramingRevision(value => value + 1);
  };
  const editDetail = (detail: number) => {
    const current = { ...latest.current.question, ...pendingRef.current };
    const frame = getImageRevealStageFrame(current, stage);
    queue({
      imageRevealLevels: setImageRevealLevel(getImageRevealLevels(current.imageRevealLevels), stage, detail),
      ...(isZoom ? { imageRevealStageFocus: setImageRevealStageFocus(current, stage, (frame.x + frame.size / 2) * 100, (frame.y + frame.size / 2) * 100) } : {}),
    });
  };
  const zoomBy = (factor: number) => {
    const current = { ...latest.current.question, ...pendingRef.current };
    const detail = getImageRevealLevels(current.imageRevealLevels)[stage];
    const zoom = Math.max(1, Math.min(IMAGE_REVEAL_MAX_ZOOM, Math.sqrt(100 / detail) * factor));
    editDetail(100 / zoom ** 2);
  };
  const moveStage = (x: number, y: number) => {
    const current = { ...latest.current.question, ...pendingRef.current };
    queue({ imageRevealStageFocus: setImageRevealStageFocus(current, stage, x, y) });
    flush();
  };

  return (
    <div className="image-reveal-config" onBlurCapture={event => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) flush();
    }}>
      <label className="label">Question (optional)
        <textarea className="input" value={question.prompt} placeholder="What are we looking at?" onChange={e => onChange({ prompt: e.target.value })} />
      </label>
      <label className="label">Answer
        <textarea className="input" value={question.answer} placeholder="The name of the person, object or place" onChange={e => onChange({ answer: e.target.value })} />
      </label>
      <label className="label">Image to reveal
        <input ref={imageInput} className="input" type="file" accept="image/*" onChange={e => { const file = e.target.files?.[0]; if (file) { flush(); onImage(file); } }} />
      </label>
      {question.imageData && <button type="button" className="button ghost" onClick={removeImage}>Remove image</button>}
      <div className="image-reveal-settings">
        <label className="label">Reveal style
          <select aria-label="Reveal style" className="input" value={view.imageRevealStyle || "zoom"} onChange={e => {
            const nextStyle = e.target.value as ImageRevealStyle;
            const current = { ...latest.current.question, ...pendingRef.current };
            const saved = { ...current.imageRevealStyleLevels, [current.imageRevealStyle || "zoom"]: getImageRevealLevels(current.imageRevealLevels) };
            const nextLevels = getImageRevealLevels(saved[nextStyle]);
            flush();
            onChange({ imageRevealStyle: nextStyle, imageRevealStyleLevels: saved, imageRevealLevels: nextLevels });
            setSelectedStage(index => Math.min(index, nextLevels.length - 1));
          }}>
            {Object.entries(IMAGE_REVEAL_STYLES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        {!isAreas && <label className="label">Image stages
          <select aria-label="Image stages" className="input" value={levels.length} onChange={e => {
            const count = Number(e.target.value);
            flush();
            onChange({
              imageRevealLevels: Array.from({ length: count }, (_, i) => Number((levels[0] + (100 - levels[0]) * (i / (count - 1)) ** 1.7).toFixed(4))),
              ...(view.imageRevealStageFocus ? { imageRevealStageFocus: Array.from({ length: count }, (_, i) => view.imageRevealStageFocus?.[i] ?? null) } : {}),
            });
            setSelectedStage(Math.min(stage, count - 1));
          }}>{Array.from({ length: 4 }, (_, i) => i + 2).map(n => <option key={n} value={n}>{n} stages · {n - 1} extra {n === 2 ? "reveal" : "reveals"}</option>)}</select>
        </label>}
      </div>
      {question.imageData && <div className="image-reveal-framing-tools">
        <button type="button" className="button ghost" aria-pressed={Boolean(view.imageRevealFillFrame)}
          title="Fill the frame without stretching. Edges may be cropped; the answer shows the full image."
          onClick={() => {
            if (isAreas && !view.imageRevealFillFrame) { startAreaFraming(); return; }
            if (isAreas && view.imageRevealAreaFrameAspect && !window.confirm("Switch to the whole image? Areas and manual cell edits will be cleared because the canvas changes.")) return;
            flush(); setFrameAreas(false);
            onChange({ imageRevealFillFrame: !view.imageRevealFillFrame,
              ...(isAreas ? { imageRevealAreaFrameAspect: undefined, imageRevealAreas: [], imageRevealOpeningOverrides: {}, imageRevealInitiallyVisible: [] } : {}) });
          }}>
          {view.imageRevealFillFrame ? "✓ Fill frame" : "Fill frame"}
        </button>
        <span>{isAreas
          ? "Frame the image first, then draw areas on that exact crop. Player view uses the same canvas."
          : "Fill crops the edges without stretching. The answer shows the whole image."}</span>
      </div>}
      {isAreas && question.imageData && <section className="image-reveal-preview area-builder" aria-label="Area editor">
        <header><strong>Build the reveal</strong><span>Start covered · add clues · draw areas</span></header>
        <label className="image-reveal-detail-control area-builder-opening">
          <span className="area-builder-step"><strong><b aria-hidden="true">1</b> Opening clues</strong><span>{view.imageRevealOpeningCoverage ?? 0}% random patches</span></span>
          <input type="range" aria-label="Opening clues" min={0} max={100} step={1} value={view.imageRevealOpeningCoverage ?? 0} onChange={event => queue({ imageRevealOpeningCoverage: Number(event.target.value) })} />
          <small>Reveal random cells, then use Opening tiles to hide or show specific cells. Your edits override the random pattern.{!!view.imageRevealInitiallyVisible?.length && " Previous opening clues are kept unless you hide them."}</small>
        </label>
        {!!view.imageRevealInitiallyVisible?.length && <button type="button" className="area-builder-clear-opening" onClick={() => {
          if (!window.confirm("Clear saved opening clues? Random patches and painted areas will be kept.")) return;
          queue({ imageRevealInitiallyVisible: [] }); flush();
        }}>Clear saved opening clues</button>}
        <div className="area-builder-step"><strong><b aria-hidden="true">2</b> Reveal areas</strong><span>Teams choose one area, then guess</span></div>
        <div className="area-builder-brushes" role="group" aria-label="Area brush">
          <button type="button" className="button ghost area-builder-opening-brush" aria-pressed={selectedArea === null} disabled={previewAreas || frameAreas} onClick={() => setSelectedArea(null)}>Opening tiles</button>
          {areas.map((tiles, index) => <button key={index} type="button" className="button ghost area-builder-chip" aria-pressed={selectedArea === index} disabled={previewAreas || frameAreas} title={`Area ${index + 1} · ${tiles.length} cells`} onClick={() => setSelectedArea(index)}>
            <i aria-hidden="true" style={{ backgroundColor: IMAGE_AREA_COLORS[index] }} />Area {index + 1}
          </button>)}
          <button type="button" className="button area-builder-add" disabled={previewAreas || frameAreas || areas.length >= 5} onClick={() => { queue({ imageRevealAreas: [...areas, []] }); flush(); setSelectedArea(areas.length); }}>+ Add area</button>
        </div>
        <div className="area-builder-canvas-tools">
          <p className="image-reveal-help">{frameAreas ? "Adjust the crop. Select Done framing to return to painting." : previewAreas ? "This is the starting view teams will see." : selectedArea === null ? "Click a cell to hide or show it. Drag to apply the same choice. Add an area when ready." : `Editing area ${selectedArea + 1}. Drag to paint. Start on this area to erase.`}</p>
          <div className="area-builder-view-options">
            {view.imageRevealFillFrame && <button type="button" className="button ghost" aria-pressed={frameAreas}
              onClick={() => { if (!frameAreas) startAreaFraming(); else { flush(); setFrameAreas(false); } }}>
              {frameAreas ? "Done framing" : "Frame image"}
            </button>}
            {frameAreas && <button type="button" className="button ghost" onClick={() => { editStaticFraming({ zoom:1, x:50, y:50 }); flush(); }}>Reset framing</button>}
            <label className="image-reveal-source-toggle"><input type="checkbox" checked={frameAreas || (!previewAreas && showAreaSource)} disabled={previewAreas || frameAreas} onChange={event => setShowAreaSource(event.target.checked)} /><span className="image-reveal-source-track" aria-hidden="true"><i /></span><span>Show source</span></label>
            <label className="image-reveal-source-toggle"><input type="checkbox" aria-label="Preview player view" checked={previewAreas} onChange={event => { setFrameAreas(false); setPreviewAreas(event.target.checked); }} /><span className="image-reveal-source-track" aria-hidden="true"><i /></span><span>Player view</span></label>
          </div>
        </div>
        {frameAreas && <p className="image-reveal-help">Scroll to zoom · drag to move · Done framing to paint areas on this crop. Reframing moves the image beneath your existing tiles.</p>}
        <ImageRevealCanvas question={view} step={0} selectedArea={selectedArea ?? -1} showSource={frameAreas || (!previewAreas && showAreaSource)} onPatch={previewAreas || frameAreas ? undefined : paintArea}
          onPan={frameAreas ? panStatic : undefined} onScrollZoom={frameAreas ? zoomStatic : undefined} />
        <div className="area-builder-cleanup">
          <div className="area-builder-cleanup-heading"><strong>Area tools</strong><span>{areas.length ? `${areas.length} of 5 areas` : "Unassigned cells stay covered."}</span></div>
            <div className="area-builder-cleanup-actions" role="group" aria-label="Area tools">
              {selectedArea !== null && <><button type="button" disabled={previewAreas || !areas[selectedArea]?.length} onClick={() => {
                queue({ imageRevealAreas: areas.map((tiles, index) => index === selectedArea ? [] : tiles) }); flush();
              }}>Clear area {selectedArea + 1}</button>
              <button type="button" disabled={previewAreas || !areas[selectedArea]} onClick={() => {
                if (areas[selectedArea]?.length && !window.confirm(`Remove area ${selectedArea + 1}? Opening clues will be kept.`)) return;
                queue({ imageRevealAreas: areas.filter((_, index) => index !== selectedArea) }); flush(); setSelectedArea(null);
              }}>Remove area {selectedArea + 1}</button></>}
              {!!Object.keys(view.imageRevealOpeningOverrides ?? {}).length && <button type="button" disabled={previewAreas} onClick={() => {
                if (!window.confirm("Reset manual cell edits? Random opening clues and drawn areas will be kept.")) return;
                queue({ imageRevealOpeningOverrides: {} }); flush();
              }}>Reset cell edits</button>}
              <button type="button" disabled={previewAreas || !areas.length} onClick={() => {
                if (!window.confirm("Reset all areas? Opening clues will be kept.")) return;
                queue({ imageRevealAreas: [] }); flush(); setSelectedArea(null);
              }}>Reset all areas</button>
            </div>
        </div>
        {areas.some(tiles => !tiles.length) && <p role="alert" className="image-reveal-help area-builder-warning">Paint each empty area, or remove it.</p>}
        {areas.some((tiles, index) => tiles.length && !playableAreas.includes(index)) && <p role="alert" className="image-reveal-help area-builder-warning">An area is already fully visible. Include a covered cell, or reduce the opening clues.</p>}
      </section>}
      {!isAreas && question.imageData && <section className="image-reveal-preview" aria-label="Image reveal preview">
        <header><strong>Build the reveal</strong><span>Stage {stage + 1}/{levels.length} · {getImageRevealPoints(question.points, stage, boardValues, costs)} pts</span></header>
        <div className="image-reveal-workspace">
          <div className="image-reveal-workspace-main">
            <div className="image-reveal-framing-tools">
              <span>{isZoom || view.imageRevealFillFrame ? "Scroll to zoom · drag to move" : "Set the blur for this stage"}</span>
              <div>
                {!isZoom && view.imageRevealFillFrame && <button type="button" className="button ghost" onClick={() => { editStaticFraming({ zoom:1, x:50, y:50 }); flush(); }}>Reset framing</button>}
                {isZoom && <button type="button" className="button ghost" onClick={() => { moveStage(50, 50); setFramingRevision(value => value + 1); }}>Recenter</button>}
              </div>
            </div>
            {!isZoom && <label className="image-reveal-detail-control">
              <span>Blur amount · {Math.round(100 - levels[stage])}%</span>
              <input type="range" aria-label="Blur amount" min={0} max={100} step={1}
                value={100 - levels[stage]} onChange={event => editDetail(100 - Number(event.target.value))} />
              <small>Sharp → heavily blurred</small>
            </label>}
            <ImageRevealCanvas key={`${question.id}-${stage}-${view.imageRevealStyle || "zoom"}-${framingRevision}`} question={view} step={stage}
              onPan={isZoom ? moveStage : view.imageRevealFillFrame ? panStatic : undefined} onScrollZoom={isZoom ? zoomBy : view.imageRevealFillFrame ? zoomStatic : undefined} />
            <div className="image-reveal-preview-actions">
              <label className="image-reveal-stage-scrubber">
                <span>Stage {stage + 1} of {levels.length}</span>
                <input type="range" aria-label="Preview stage" aria-valuetext={`Stage ${stage + 1} of ${levels.length}`} min={1} max={levels.length} step={1} value={stage + 1} onChange={event => selectStage(Number(event.target.value) - 1)} />
              </label>
              {isZoom && <button type="button" className="button ghost" disabled={!stage} onClick={copyPreviousFraming} title="Replace this stage’s zoom and position with the previous stage’s framing">Copy previous framing</button>}
              {!isZoom && <button type="button" className="button ghost" disabled={!stage} onClick={() => { editDetail(levels[stage - 1]); flush(); }}>Copy previous blur</button>}
            </div>
          </div>
        </div>
        <p className="image-reveal-help image-reveal-framing-help">The stage slider only navigates. {isZoom ? "Copy previous framing replaces the selected stage’s starting view. Scroll to zoom; drag to frame. Arrow keys pan; +/− zoom." : "Blur amount edits this stage; the stage slider previews your sequence."} You choose the final stage too. The answer reveal shows the full image.</p>
      </section>}
      {isAreas ? <fieldset className="area-builder-rules">
        <legend>How teams play</legend>
        <div className="area-builder-modes">
          <label className={areaMode === "rollover" ? "is-selected" : undefined}>
            <input type="radio" name={`area-mode-${question.id}`} value="rollover" checked={areaMode === "rollover"} onChange={() => { flush(); onChange({ imageRevealAreaMode: "rollover" }); }} />
            <span><strong>Teams take turns</strong><small>A wrong guess passes to the next team.</small></span>
          </label>
          <label className={areaMode === "limited" ? "is-selected" : undefined}>
            <input type="radio" name={`area-mode-${question.id}`} value="limited" checked={areaMode === "limited"} onChange={() => { flush(); onChange({ imageRevealAreaMode: "limited" }); }} />
            <span><strong>One team, limited guesses</strong><small>Extra guesses lower the reward.</small></span>
          </label>
        </div>
        {areaMode === "rollover" ? <p className="image-reveal-help area-builder-rule-summary">Choose an area, then guess. Revealed areas stay open for everyone. Keep taking turns until correct, always for the full <strong>{question.points} points</strong>.</p> : <>
          <p className="image-reveal-help area-builder-rule-summary">{playableAreas.length ? `${playableAreas.length} areas · up to ${playableAreas.length} ${playableAreas.length === 1 ? "guess" : "guesses"}.` : "Draw areas to set the number of guesses."} Choose one area before each guess. The first guess keeps the full reward; each extra guess lowers it.</p>
          {!!playableAreas.length && <ol className="area-builder-rewards" aria-label="Reward by guess">{areaRewards.map((reward, index) => <li key={index}><span>Guess {index + 1}</span><strong>{reward} <small>pts</small></strong></li>)}</ol>}
        </>}
      </fieldset> : <>
      <label className="image-reveal-cost"><input type="checkbox" checked={costs} onChange={e => { flush(); onChange({ imageRevealCostsPoints: e.target.checked }); }} /> Each extra reveal lowers the reward by one board level</label>
      <p className="image-reveal-help">Rewards never fall below the board’s lowest available level. Turn off the option above to keep the full reward throughout.</p>
      <label className="image-reveal-cost"><input type="checkbox" checked={view.imageRevealRotateOnMiss ?? true} onChange={e => { flush(); onChange({ imageRevealRotateOnMiss: e.target.checked }); }} /> Pass to next team on wrong guess</label>
      <p className="image-reveal-help">Judge the guess after revealing the answer. When off, Wrong finishes without points. When on, Wrong returns to the question for the next team at the same stage and reward.</p>
      </>}
    </div>
  );
}
