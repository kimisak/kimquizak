'use client';

import { useEffect, useMemo, useRef, useState } from "react";
import { parseStreetViewSource } from "@/lib/geoguesser";
import { GeoguesserSetupInfo } from "@/components/GeoguesserSetupInfo";

export type Panorama = {
  setOptions: (options: Record<string, unknown>) => void;
  setPosition: (position: { lat: number; lng: number }) => void;
  setPano: (pano: string) => void;
  getPov: () => { heading: number; pitch: number };
  setPov: (pov: { heading: number; pitch: number }) => void;
  getPosition: () => { lat: () => number; lng: () => number } | null;
  getPano: () => string;
  getZoom: () => number;
  addListener: (event: string, listener: () => void) => { remove: () => void };
  getStatus: () => string | null;
};

export type MapsApi = {
  StreetViewPanorama: new (element: HTMLElement, options: Record<string, unknown>) => Panorama;
  StreetViewService: new () => { getPanorama: (request: { location: { lat: number; lng: number }; radius: number }) => Promise<{ data: { location: { latLng?: { lat: () => number; lng: () => number } } } }> };
  importLibrary?: (name: string) => Promise<unknown>;
};

type MapsWindow = Window & {
  google?: { maps?: MapsApi };
  __kimquizakMapsReady?: () => void;
};

let mapsPromise: Promise<MapsApi> | null = null;

export function loadMaps(): Promise<MapsApi> {
  const mapsWindow = window as MapsWindow;
  if (mapsWindow.google?.maps?.StreetViewPanorama) return Promise.resolve(mapsWindow.google.maps);
  if (mapsPromise) return mapsPromise;
  mapsPromise = fetch("/api/maps/config", { cache: "no-store" })
    .then(async (response) => {
      if (response.status === 401) throw new Error("Sign in through Host to use Street View.");
      if (!response.ok) throw new Error("Google Maps is not configured");
      const data = await response.json() as { apiKey?: string };
      if (!data.apiKey) throw new Error("Google Maps is not configured");
      return new Promise<MapsApi>((resolve, reject) => {
        const script = document.createElement("script");
        const url = new URL("https://maps.googleapis.com/maps/api/js");
        url.searchParams.set("key", data.apiKey!);
        url.searchParams.set("loading", "async");
        url.searchParams.set("callback", "__kimquizakMapsReady");
        mapsWindow.__kimquizakMapsReady = () => {
          const maps = mapsWindow.google?.maps;
          Promise.resolve(maps?.importLibrary?.("streetView"))
            .then(() => {
              if (maps?.StreetViewPanorama) resolve(maps);
              else reject(new Error("Street View could not be loaded"));
            })
            .catch(() => reject(new Error("Street View could not be loaded")))
            .finally(() => { delete mapsWindow.__kimquizakMapsReady; });
        };
        script.src = url.toString();
        script.async = true;
        script.onerror = () => {
          delete mapsWindow.__kimquizakMapsReady;
          reject(new Error("Google Maps could not be loaded"));
        };
        document.head.appendChild(script);
      });
    })
    .catch((error: unknown) => {
      mapsPromise = null;
      throw error;
    });
  return mapsPromise;
}

type Props = {
  sourceUrl: string;
  interaction: "fixed" | "look" | "explore";
  className?: string;
  onReadyChange?: (ready: boolean) => void;
  allowZoom?: boolean;
};

export function StreetViewPanorama({ sourceUrl, interaction, className = "", onReadyChange, allowZoom = false }: Props) {
  const source = useMemo(() => parseStreetViewSource(sourceUrl), [sourceUrl]);
  const lat = source?.lat;
  const lng = source?.lng;
  const heading = source?.heading;
  const pitch = source?.pitch;
  const zoom = source?.zoom;
  const pano = source?.pano;
  const containerRef = useRef<HTMLDivElement>(null);
  const panoramaRef = useRef<Panorama | null>(null);
  const interactionRef = useRef(interaction);
  const frozenPovRef = useRef({ heading: heading ?? 0, pitch: pitch ?? 0 });
  const frozenPanoRef = useRef<string | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "unavailable">("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    if (lat === undefined || lng === undefined || !containerRef.current) return;
    let cancelled = false;
    let retriedAtLocation = false;
    let listener: { remove: () => void } | undefined;
    let povListener: { remove: () => void } | undefined;
    let panoListener: { remove: () => void } | undefined;
    const container = containerRef.current;
    loadMaps().then((maps) => {
      if (cancelled) return;
      const panorama = new maps.StreetViewPanorama(container, {
        position: { lat, lng },
        ...(pano ? { pano } : {}),
        pov: { heading: heading ?? 0, pitch: pitch ?? 0 },
        ...(zoom !== undefined ? { zoom } : {}),
        visible: true,
        disableDefaultUI: true,
        addressControl: false,
        showRoadLabels: false,
        linksControl: interactionRef.current === "explore",
        clickToGo: interactionRef.current === "explore",
        fullscreenControl: false,
        panControl: false,
        zoomControl: interactionRef.current === "look" || allowZoom,
        motionTrackingControl: false,
        imageDateControl: false,
        enableCloseButton: false,
        scrollwheel: interactionRef.current === "look" || allowZoom,
      });
      panoramaRef.current = panorama;
      frozenPovRef.current = { heading: heading ?? 0, pitch: pitch ?? 0 };
      povListener = panorama.addListener("pov_changed", () => {
        if (interactionRef.current !== "fixed") return;
        const actual = panorama.getPov();
        const frozen = frozenPovRef.current;
        if (actual.heading !== frozen.heading || actual.pitch !== frozen.pitch) panorama.setPov(frozen);
      });
      panoListener = panorama.addListener("pano_changed", () => {
        if (interactionRef.current !== "look" || !frozenPanoRef.current) return;
        if (panorama.getPano() !== frozenPanoRef.current) panorama.setPano(frozenPanoRef.current);
      });
      const updateStatus = () => {
        const status = panorama.getStatus();
        if (status === "ZERO_RESULTS" && pano && !retriedAtLocation) {
          retriedAtLocation = true;
          panorama.setPosition({ lat, lng });
          return;
        }
        if (status === "OK") {
          if (interactionRef.current === "look" && !frozenPanoRef.current) frozenPanoRef.current = panorama.getPano();
          setError(""); setState("ready"); onReadyChange?.(true);
        }
        else if (status) { setState("unavailable"); onReadyChange?.(false); }
      };
      listener = panorama.addListener("status_changed", updateStatus);
      updateStatus();
    }).catch((reason: unknown) => {
      if (!cancelled) {
        setError(reason instanceof Error ? reason.message : "Google Maps could not be loaded");
        setState("unavailable");
        onReadyChange?.(false);
      }
    });
    return () => {
      cancelled = true;
      listener?.remove();
      povListener?.remove();
      panoListener?.remove();
      panoramaRef.current = null;
      frozenPanoRef.current = null;
    };
  }, [lat, lng, pano, heading, pitch, zoom, allowZoom, onReadyChange]);

  useEffect(() => {
    if (interaction === "fixed" && interactionRef.current !== "fixed" && panoramaRef.current) frozenPovRef.current = panoramaRef.current.getPov();
    if (interaction === "look" && interactionRef.current !== "look" && panoramaRef.current) frozenPanoRef.current = panoramaRef.current.getPano();
    if (interaction !== "look") frozenPanoRef.current = null;
    interactionRef.current = interaction;
    panoramaRef.current?.setOptions({
      linksControl: interaction === "explore",
      clickToGo: interaction === "explore",
      zoomControl: interaction === "look" || allowZoom,
      scrollwheel: interaction === "look" || allowZoom,
    });
  }, [interaction, allowZoom]);

  return (
    <div
      className={`street-view-panorama ${className}`}
      onKeyDownCapture={(event) => {
        if (interaction === "fixed" && !["Tab", "Enter", " "].includes(event.key)) {
          event.preventDefault();
          event.stopPropagation();
        }
      }}
      onPointerDownCapture={(event) => {
        if (interaction === "fixed" && !(event.target as HTMLElement).closest("a, button")) {
          event.preventDefault();
          event.stopPropagation();
        }
      }}
      onWheelCapture={(event) => {
        if (interaction === "fixed") event.stopPropagation();
      }}
    >
      <div className="street-view-panorama-canvas" ref={containerRef} />
      {!source && <div className="street-view-panorama-status">Paste a Google Street View link with coordinates.</div>}
      {source && state === "loading" && <div className="street-view-panorama-status">Loading Street View…</div>}
      {source && state === "unavailable" && <div className="street-view-panorama-status street-view-setup-status">
        <p role="status">{error || "No Street View panorama was found here."}</p>
        <GeoguesserSetupInfo />
      </div>}
    </div>
  );
}
