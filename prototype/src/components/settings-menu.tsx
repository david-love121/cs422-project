"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Globe2, Moon } from "lucide-react";

export default function SettingsMenu({
  theme,
  dataMode,
  onThemeChange,
  onDataModeChange,
}: {
  theme: "light" | "dark";
  dataMode: "demo" | "live";
  onThemeChange: (theme: "light" | "dark") => void;
  onDataModeChange: (mode: "demo" | "live") => void;
}) {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const options = useRef<(HTMLButtonElement | null)[]>([]);
  const firstFocus = useRef(0);
  const menuId = useId();
  const triggerId = useId();

  useEffect(() => {
    if (!open) return;
    options.current[firstFocus.current]?.focus();
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !container.current?.contains(event.target))
        setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);

  function close() {
    setOpen(false);
    trigger.current?.focus();
  }
  function openAt(index: number) {
    firstFocus.current = index;
    if (open) options.current[index]?.focus();
    else setOpen(true);
  }
  function menuKey(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
    } else if (event.key === "Tab") {
      close();
    } else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      const index = options.current.findIndex((option) => option === document.activeElement);
      const next = event.key === "Home" ? 0
        : event.key === "End" ? 1
          : (index + (event.key === "ArrowDown" ? 1 : -1) + 2) % 2;
      options.current[next]?.focus();
    }
  }

  return (
    <div className="settings" ref={container}>
      <button
        ref={trigger}
        id={triggerId}
        type="button"
        className="brand settings-trigger"
        aria-label="Veto settings"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => {
          firstFocus.current = 0;
          setOpen((value) => !value);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            openAt(event.key === "ArrowDown" ? 0 : 1);
          }
        }}
      >
        <span className="brand-mark" aria-hidden="true">
          <svg viewBox="0 0 32 32" width="25" height="25" fill="none">
            <path d="m7 9 9 16L26 7" stroke="currentColor" strokeWidth="3.5" strokeLinecap="square" />
          </svg>
        </span>
        <span>veto</span>
      </button>
      {open && (
        <div id={menuId} className="settings-menu" role="menu" aria-labelledby={triggerId} onKeyDown={menuKey}>
          <button
            ref={(element) => { options.current[0] = element; }}
            type="button"
            role="menuitemcheckbox"
            aria-label="Dark mode"
            aria-checked={theme === "dark"}
            onClick={() => onThemeChange(theme === "dark" ? "light" : "dark")}
          >
            <Moon size={17} aria-hidden="true" />
            <span className="settings-copy">Dark mode<small>{theme === "dark" ? "Dark theme" : "Light theme"}</small></span>
            <span className="settings-value" aria-hidden="true">{theme === "dark" ? "On" : "Off"}</span>
          </button>
          <button
            ref={(element) => { options.current[1] = element; }}
            type="button"
            role="menuitemcheckbox"
            aria-label="Live data"
            aria-checked={dataMode === "live"}
            onClick={() => onDataModeChange(dataMode === "live" ? "demo" : "live")}
          >
            <Globe2 size={17} aria-hidden="true" />
            <span className="settings-copy">Live data<small>{dataMode === "live" ? "Live TMDB collection" : "Prepared demo collection"}</small></span>
            <span className="settings-value" aria-hidden="true">{dataMode === "live" ? "On" : "Off"}</span>
          </button>
        </div>
      )}
    </div>
  );
}
