'use client';

import { useEffect, useRef, useState } from "react";
import { formatStreetViewSource, parseStreetViewSource } from "@/lib/geoguesser";
import { loadMaps, type MapsApi, type Panorama } from "@/components/game/StreetViewPanorama";

type Props = { sourceUrl: string; onSave: (url: string) => void; onClose: () => void };

export function StreetViewPicker({ sourceUrl, onSave, onClose }: Props) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const panoramaRef = useRef<Panorama | null>(null);
  const mapsRef = useRef<MapsApi | null>(null);
  const nearbySelectedRef = useRef(false);
  const [message, setMessage] = useState("Loading this Street View location…");
  const [ready, setReady] = useState(false);
  const [canFindNearby, setCanFindNearby] = useState(false);
  const [findingNearby, setFindingNearby] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let retriedAtLocation = false;
    let statusListener: { remove: () => void } | undefined;
    const source = parseStreetViewSource(sourceUrl);
    if (!source || !canvasRef.current) return;
    const canvas = canvasRef.current;

    setReady(false);
    setCanFindNearby(false);
    setMessage("Loading this Street View location…");
    nearbySelectedRef.current = false;
    loadMaps().then((maps) => {
      if (cancelled) return;
      mapsRef.current = maps;
      const panorama = new maps.StreetViewPanorama(canvas, {
        position: { lat: source.lat, lng: source.lng },
        ...(source.pano ? { pano: source.pano } : {}),
        pov: { heading: source.heading ?? 0, pitch: source.pitch ?? 0 },
        ...(source.zoom !== undefined ? { zoom: source.zoom } : {}),
        visible: true,
        addressControl: false,
        showRoadLabels: false,
        fullscreenControl: false,
        imageDateControl: false,
        motionTrackingControl: false,
        scrollwheel: true,
        zoomControl: true,
      });
      panoramaRef.current = panorama;
      const updateStatus = () => {
        if (cancelled) return;
        const status = panorama.getStatus();
        if (status === "ZERO_RESULTS" && source.pano && !retriedAtLocation) {
          retriedAtLocation = true;
          panorama.setPosition({ lat: source.lat, lng: source.lng });
          return;
        }
        if (status === "OK") {
          setReady(true);
          setCanFindNearby(false);
          setMessage(nearbySelectedRef.current
            ? "Nearby imagery selected. Move, turn, and zoom until this is the exact opening frame."
            : "This live panorama becomes the player’s opening frame. Move, turn, and zoom, then confirm it.");
        } else if (status === "ZERO_RESULTS") {
          setReady(false);
          setCanFindNearby(true);
          setMessage("No Street View at this exact location. You can choose nearby imagery instead.");
        }
      };
      statusListener = panorama.addListener("status_changed", updateStatus);
      updateStatus();
    }).catch((error: unknown) => {
      if (!cancelled) setMessage(error instanceof Error ? error.message : "Street View could not be loaded.");
    });

    return () => {
      cancelled = true;
      statusListener?.remove();
      panoramaRef.current = null;
      mapsRef.current = null;
    };
  }, [sourceUrl]);

  async function findNearby() {
    const source = parseStreetViewSource(sourceUrl);
    const maps = mapsRef.current;
    const panorama = panoramaRef.current;
    if (!source || !maps || !panorama) return;
    setFindingNearby(true);
    setCanFindNearby(false);
    setMessage("Finding Street View within 250 metres…");
    try {
      const response = await new maps.StreetViewService().getPanorama({
        location: { lat: source.lat, lng: source.lng },
        radius: 250,
      });
      const location = response.data.location.latLng;
      if (!location) throw new Error("No nearby Street View imagery was found.");
      nearbySelectedRef.current = true;
      panorama.setPosition({ lat: location.lat(), lng: location.lng() });
    } catch {
      setMessage("No Street View imagery was found within 250 metres. Try another Google Maps link.");
      setCanFindNearby(true);
    } finally {
      setFindingNearby(false);
    }
  }

  function saveView() {
    const panorama = panoramaRef.current;
    const position = panorama?.getPosition();
    if (!panorama || !position) return;
    const pov = panorama.getPov();
    onSave(formatStreetViewSource({
      lat: position.lat(),
      lng: position.lng(),
      pano: panorama.getPano(),
      heading: pov.heading,
      pitch: pov.pitch,
      zoom: panorama.getZoom(),
    }));
  }

  return (
    <div className="geo-view-picker">
      <div className="geo-view-picker-canvas" ref={canvasRef} />
      <p className="geo-view-picker-message" role="status">{message}</p>
      <div className="geo-view-picker-actions">
        {canFindNearby && <button className="button compact" type="button" disabled={findingNearby} onClick={findNearby}>Find nearby Street View</button>}
        <button className="button compact" type="button" disabled={!ready} onClick={saveView}>Confirm player starting view</button>
        <button className="button ghost compact" type="button" onClick={onClose}>Cancel changes</button>
      </div>
    </div>
  );
}
