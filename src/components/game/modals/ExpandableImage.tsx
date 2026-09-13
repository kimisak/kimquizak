'use client';

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Props = {
  src: string;
  alt: string;
  label?: string;
  className?: string;
  presentation?: "card" | "fluid";
};

export function ExpandableImage({ src, alt, label, className = "", presentation = "card" }: Props) {
  const [expanded, setExpanded] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const close = useCallback(() => {
    setExpanded(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);

  useEffect(() => {
    if (!expanded) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        close();
        return;
      }
      if (event.key === "Tab") {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        closeRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [close, expanded]);

  return (
    <>
      <button
        ref={triggerRef}
        className={`question-image-trigger is-${presentation} ${className}`.trim()}
        type="button"
        onClick={() => setExpanded(true)}
        aria-label={`Expand ${alt}`}
      >
        {label && <span className="question-image-label">{label}</span>}
        {presentation === "fluid" && (
          <img className="question-image-ambient" src={src} alt="" aria-hidden />
        )}
        <img className="question-image-primary" src={src} alt={alt} />
        <span className="question-image-expand-hint" aria-hidden>{presentation === "fluid" ? "⛶" : "↗ Expand"}</span>
      </button>
      {expanded && createPortal(
        <div
          className="question-image-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={alt}
          onClick={close}
        >
          <button
            ref={closeRef}
            className="question-image-lightbox-close"
            type="button"
            aria-label="Close expanded image"
            onClick={close}
            autoFocus
          >
            ×
          </button>
          <img src={src} alt={alt} onClick={(event) => event.stopPropagation()} />
          <span>Click outside the image or press Esc to return</span>
        </div>,
        document.body,
      )}
    </>
  );
}
