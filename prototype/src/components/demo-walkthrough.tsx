"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Pause, Play, RotateCcw, X } from "lucide-react";
import {
  DEMO_CHAPTERS, WALKTHROUGH_DURATION, runWalkthrough,
  type DemoCaption, type DemoPoint,
} from "@/lib/walkthrough";
import "@/app/demo.css";

const clock = (milliseconds: number) => `${Math.floor(milliseconds / 60000)}:${String(Math.floor(milliseconds / 1000) % 60).padStart(2, "0")}`;

export default function DemoWalkthrough({ onExit, onReplay }: { onExit: () => void; onReplay: () => void }) {
  const paused = useRef(false);
  const firstControl = useRef<HTMLButtonElement>(null);
  const [isPaused, setPaused] = useState(false);
  const [status, setStatus] = useState<"playing" | "complete" | "error">("playing");
  const [elapsed, setElapsed] = useState(0);
  const [caption, setCaption] = useState<DemoCaption>({ chapter: 0, title: "Five friends. One movie night.", detail: "Start with the people, the time, and what everyone needs." });
  const [pointer, setPointer] = useState<DemoPoint | null>(null);
  const [ripple, setRipple] = useState<(DemoPoint & { id: number }) | null>(null);
  const rippleId = useRef(0);

  useEffect(() => {
    if (!ripple) return;
    const timer = setTimeout(() => setRipple(null), 900);
    return () => clearTimeout(timer);
  }, [ripple]);

  useEffect(() => {
    firstControl.current?.focus();
    const controller = new AbortController();
    runWalkthrough({
      signal: controller.signal,
      isPaused: () => paused.current,
      onCaption: setCaption,
      onPointer: setPointer,
      onRipple: (point) => setRipple({ ...point, id: ++rippleId.current }),
      onProgress: setElapsed,
    }).then(() => {
      if (!controller.signal.aborted) { setStatus("complete"); setPointer(null); }
    }).catch(() => {
      if (!controller.signal.aborted) { setStatus("error"); setPointer(null); }
    });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); onExit(); }
    };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [onExit]);

  return (
    <>
      {pointer && <div className="demo-pointer" aria-hidden="true" style={{ transform: `translate3d(${pointer.x}px, ${pointer.y}px, 0)` }} />}
      {ripple && <div key={ripple.id} className="demo-ripple" aria-hidden="true" style={{ left: ripple.x, top: ripple.y }}><i /><i /></div>}
      <section className="demo-bar" aria-label="Guided demo" data-demo-status={status}>
        <div className="demo-progress" role="progressbar" aria-label="Demo progress" aria-valuemin={0} aria-valuemax={120} aria-valuenow={Math.floor(elapsed / 1000)}>
          <span style={{ transform: `scaleX(${elapsed / WALKTHROUGH_DURATION})` }} />
        </div>
        <div className="demo-caption" aria-live="polite" aria-atomic="true">
          <p className="demo-eyebrow"><span className="demo-live-dot" />{status === "complete" ? "Demo complete" : isPaused ? "Demo paused" : "Guided demo"}<span>5 viewers · Demo data</span></p>
          <h2>{status === "error" ? "Let’s give that another try." : caption.title}</h2>
          <p className="demo-detail">{status === "error" ? "Restart the walkthrough, or exit to return to your evening." : caption.detail}</p>
        </div>
        <div className="demo-controls">
          <span className="demo-time">{clock(elapsed)} <span>/ 2:00</span></span>
          {status === "playing" && <button ref={firstControl} type="button" aria-label={isPaused ? "Resume demo" : "Pause demo"} onClick={() => { paused.current = !paused.current; setPaused(paused.current); }}>
            {isPaused ? <Play size={18} /> : <Pause size={18} />}
          </button>}
          <button type="button" aria-label={status === "playing" ? "Restart demo" : "Replay demo"} onClick={onReplay}><RotateCcw size={18} /></button>
          <button type="button" className="demo-exit" aria-label="Exit demo" onClick={onExit}>{status === "complete" ? <Check size={17} /> : <X size={17} />}<span>Exit demo</span></button>
        </div>
        <ol className="demo-chapters" aria-label="Walkthrough chapters">
          {DEMO_CHAPTERS.map((chapter, index) => <li key={chapter} className={index <= caption.chapter ? "is-active" : ""} aria-current={index === caption.chapter ? "step" : undefined}><span>{index + 1}</span>{chapter}</li>)}
        </ol>
      </section>
    </>
  );
}
