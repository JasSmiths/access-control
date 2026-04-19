"use client";

import { useEffect, useMemo, useRef } from "react";
import { X } from "lucide-react";

interface ExpandModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  origin?: { x: number; y: number } | null;
  children: React.ReactNode;
}

export function ExpandModal({
  open,
  onClose,
  title,
  origin,
  children,
}: ExpandModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (open && panelRef.current) panelRef.current.focus();
  }, [open]);

  const backdropClass = useMemo(
    () => "absolute inset-0 bg-black/40 backdrop-blur-sm animate-[fadeIn_200ms_ease-out]",
    []
  );

  const panelClass = useMemo(
    () =>
      "relative z-10 flex max-h-[min(85vh,720px)] w-[min(92vw,42rem)] flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] shadow-xl outline-none animate-[growFromPoint_220ms_cubic-bezier(0.2,0.8,0.2,1)]",
    []
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className={backdropClass} onClick={onClose} />

      <div
        ref={panelRef}
        tabIndex={-1}
        className={panelClass}
        style={{ transformOrigin: origin ? `${origin.x}px ${origin.y}px` : "50% 50%" }}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
          {title ? (
            <h2 className="text-base font-semibold text-[var(--fg)]">{title}</h2>
          ) : (
            <span />
          )}
          <button
            onClick={onClose}
            className="rounded-md p-1 text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--bg)] transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">{children}</div>
      </div>
    </div>
  );
}
