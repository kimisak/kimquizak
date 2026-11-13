'use client';

import { useEffect, useState, type ReactNode } from "react";

export function GeoPanoramaFrame({ children, status, autoFullscreen = false }: {
  children: ReactNode;
  status?: ReactNode;
  autoFullscreen?: boolean;
}) {
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    setFullscreen(autoFullscreen);
  }, [autoFullscreen]);

  useEffect(() => {
    if (!fullscreen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        setFullscreen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [fullscreen]);

  return <div className={`geo-panorama-frame${fullscreen ? " is-fullscreen" : ""}`}>
    {children}
    {status && <div className="geo-panorama-fullscreen-status">{status}</div>}
    <button
      type="button"
      className="geo-panorama-fullscreen-toggle"
      aria-label={fullscreen ? "Exit full-screen Street View" : "Open full-screen Street View"}
      aria-pressed={fullscreen}
      title={fullscreen ? "Exit full screen (Esc)" : "Open Street View full screen"}
      onClick={() => setFullscreen(current => !current)}
    >
      <span aria-hidden>{fullscreen ? "×" : "↗"}</span>
      {fullscreen ? "Exit" : "Full screen"}
    </button>
  </div>;
}
