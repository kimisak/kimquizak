'use client';

import { useEffect, useRef, useState } from "react";
import { loadMaps } from "@/components/game/StreetViewPanorama";

export type GeoPoint = { lat: number; lng: number };

type MapInstance = {
  addListener: (name: string, callback: (event: { latLng?: { lat: () => number; lng: () => number } }) => void) => { remove: () => void };
  fitBounds: (bounds: unknown, padding?: number) => void;
  setMapTypeId: (mapTypeId: "satellite" | "hybrid") => void;
};
type MarkerInstance = { setMap: (map: MapInstance | null) => void };
type PolylineInstance = { setMap: (map: MapInstance | null) => void };
type MapConstructors = {
  Map: new (element: HTMLElement, options: Record<string, unknown>) => MapInstance;
  Marker: new (options: Record<string, unknown>) => MarkerInstance;
  Polyline: new (options: Record<string, unknown>) => PolylineInstance;
  LatLngBounds: new () => { extend: (point: GeoPoint) => void };
};

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
      if (!constructors.Map || !constructors.Marker || !constructors.Polyline) throw new Error("The guess map could not be loaded.");
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
    const guessPin = guess ? new constructors.Marker({
      map, position: guess, title: "Player guess", clickable: false,
      icon: { path: "M -9,0 A 9,9 0 1,0 9,0 A 9,9 0 1,0 -9,0 Z", fillColor: "#c53c61", fillOpacity: 1, strokeColor: "#fff8e8", strokeWeight: 3 },
    }) : null;
    let answerPin: MarkerInstance | null = null;
    let line: PolylineInstance | null = null;
    if (revealed) {
      answerPin = new constructors.Marker({
        map, position: answer, title: "Correct location", clickable: false,
        icon: { path: "M -9,0 A 9,9 0 1,0 9,0 A 9,9 0 1,0 -9,0 Z", fillColor: "#e7ba57", fillOpacity: 1, strokeColor: "#142a22", strokeWeight: 3 },
      });
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
      {!mapReady && <div className="geo-stage-map-status" role="status">{error || "Loading the world map…"}</div>}
    </div>
  );
}
