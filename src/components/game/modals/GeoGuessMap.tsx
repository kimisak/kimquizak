'use client';

import { useEffect, useRef, useState } from "react";
import { loadMaps } from "@/components/game/StreetViewPanorama";
import { GeoguesserSetupInfo } from "@/components/GeoguesserSetupInfo";

export type GeoPoint = { lat: number; lng: number };

type MapInstance = {
  addListener: (name: string, callback: (event: { latLng?: { lat: () => number; lng: () => number } }) => void) => { remove: () => void };
  fitBounds: (bounds: unknown, padding?: number) => void;
  setMapTypeId: (mapTypeId: "satellite" | "hybrid") => void;
};
type MarkerInstance = { setMap: (map: MapInstance | null) => void };
type OverlayInstance = MarkerInstance & {
  onAdd: () => void;
  onRemove: () => void;
  draw: () => void;
  getPanes: () => { markerLayer: HTMLElement } | null;
  getProjection: () => { fromLatLngToDivPixel: (point: unknown) => { x: number; y: number } | null };
};
type PolylineInstance = { setMap: (map: MapInstance | null) => void };
type MapConstructors = {
  Map: new (element: HTMLElement, options: Record<string, unknown>) => MapInstance;
  OverlayView: new () => OverlayInstance;
  LatLng: new (point: GeoPoint) => unknown;
  Polyline: new (options: Record<string, unknown>) => PolylineInstance;
  LatLngBounds: new () => { extend: (point: GeoPoint) => void };
};

// Pixel-sized dots follow the map projection without requiring a cloud Map ID.
function createMapDot(constructors: MapConstructors, map: MapInstance, position: GeoPoint, answer: boolean): MarkerInstance {
  const overlay = new constructors.OverlayView();
  const point = new constructors.LatLng(position);
  const dot = document.createElement("span");
  dot.setAttribute("role", "img");
  dot.setAttribute("aria-label", answer ? "Correct location" : "Player guess");
  Object.assign(dot.style, {
    position: "absolute", width: "21px", height: "21px", boxSizing: "border-box",
    borderRadius: "50%", border: `3px solid ${answer ? "#142a22" : "#fff8e8"}`,
    background: answer ? "#e7ba57" : "#c53c61", transform: "translate(-50%, -50%)",
    pointerEvents: "none",
  });
  overlay.onAdd = () => { overlay.getPanes()?.markerLayer.appendChild(dot); };
  overlay.draw = () => {
    const pixel = overlay.getProjection().fromLatLngToDivPixel(point);
    dot.hidden = !pixel;
    if (pixel) {
      dot.style.left = `${pixel.x}px`;
      dot.style.top = `${pixel.y}px`;
    }
  };
  overlay.onRemove = () => dot.remove();
  overlay.setMap(map);
  return overlay;
}

type Props = {
  answer: GeoPoint;
  guess: GeoPoint | null;
  locked: boolean;
  revealed: boolean;
  labelsVisible: boolean;
  onGuess: (point: GeoPoint) => void;
  onReady: () => void;
};

export function GeoGuessMap({ answer, guess, locked, revealed, labelsVisible, onGuess, onReady }: Props) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapInstance | null>(null);
  const constructorsRef = useRef<MapConstructors | null>(null);
  const lockedRef = useRef(locked);
  const revealedRef = useRef(revealed);
  const onGuessRef = useRef(onGuess);
  const onReadyRef = useRef(onReady);
  const [mapReady, setMapReady] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    lockedRef.current = locked;
    revealedRef.current = revealed;
    onGuessRef.current = onGuess;
    onReadyRef.current = onReady;
  }, [locked, revealed, onGuess, onReady]);

  useEffect(() => {
    if (!canvasRef.current) return;
    let cancelled = false;
    let clickListener: { remove: () => void } | undefined;
    let tilesListener: { remove: () => void } | undefined;
    const canvas = canvasRef.current;
    loadMaps().then(async (maps) => {
      await maps.importLibrary?.("maps");
      if (cancelled) return;
      const constructors = maps as unknown as MapConstructors;
      if (!constructors.Map || !constructors.OverlayView || !constructors.LatLng || !constructors.Polyline) throw new Error("The guess map could not be loaded.");
      constructorsRef.current = constructors;
      const worldZoom = Math.max(1, Math.log2(Math.max(canvas.clientWidth * 1.06, 512) / 256));
      const map = new constructors.Map(canvas, {
        center: { lat: 18, lng: 0 },
        zoom: worldZoom,
        minZoom: worldZoom,
        maxZoom: 18,
        mapTypeId: "satellite",
        isFractionalZoomEnabled: true,
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: false,
        rotateControl: false,
        clickableIcons: false,
        gestureHandling: "greedy",
        backgroundColor: "#071b15",
      });
      mapRef.current = map;
      clickListener = map.addListener("click", (event) => {
        if (lockedRef.current || revealedRef.current || !event.latLng) return;
        onGuessRef.current({ lat: event.latLng.lat(), lng: event.latLng.lng() });
      });
      tilesListener = map.addListener("tilesloaded", () => {
        tilesListener?.remove();
        tilesListener = undefined;
        if (!cancelled) {
          setMapReady(true);
          onReadyRef.current();
        }
      });
    }).catch((reason: unknown) => {
      if (!cancelled) setError(reason instanceof Error ? reason.message : "The guess map could not be loaded.");
    });
    return () => {
      cancelled = true;
      clickListener?.remove();
      tilesListener?.remove();
      mapRef.current = null;
      constructorsRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    mapRef.current.setMapTypeId(revealed && labelsVisible ? "hybrid" : "satellite");
  }, [labelsVisible, mapReady, revealed]);

  useEffect(() => {
    const map = mapRef.current;
    const constructors = constructorsRef.current;
    if (!mapReady || !map || !constructors) return;
    const guessPin = guess ? createMapDot(constructors, map, guess, false) : null;
    let answerPin: MarkerInstance | null = null;
    let line: PolylineInstance | null = null;
    if (revealed) {
      answerPin = createMapDot(constructors, map, answer, true);
      if (guess) {
        line = new constructors.Polyline({
          map, path: [guess, answer], geodesic: true, strokeColor: "#fff0bd",
          strokeOpacity: 1, strokeWeight: 5, clickable: false,
        });
        const bounds = new constructors.LatLngBounds();
        bounds.extend(guess);
        bounds.extend(answer);
        map.fitBounds(bounds, 70);
      }
    }
    return () => {
      guessPin?.setMap(null);
      answerPin?.setMap(null);
      line?.setMap(null);
    };
  }, [answer, guess, revealed, mapReady]);

  return (
    <div className="geo-stage-map-wrap">
      <div className="geo-stage-map" ref={canvasRef} aria-label="World map for placing a guess" />
      {!mapReady && <div className="geo-stage-map-status street-view-setup-status">
        <p role="status">{error || "Loading the world map…"}</p>
        {error && <GeoguesserSetupInfo />}
      </div>}
    </div>
  );
}
