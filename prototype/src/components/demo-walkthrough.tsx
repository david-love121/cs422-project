"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Pause, Play, RotateCcw, X } from "lucide-react";
import {
  DEMO_CHAPTERS, DEMO_PARTY, WALKTHROUGH_DURATION, runWalkthrough,
  type DemoCaption, type DemoPoint, type DemoTransition,
} from "@/lib/walkthrough";
import "@/app/demo.css";

const clock = (milliseconds: number) => `${Math.floor(milliseconds / 60000)}:${String(Math.floor(milliseconds / 1000) % 60).padStart(2, "0")}`;

type Ripple = DemoPoint & { id: number };

function ClickRipple({ pulse, onFinish }: { pulse: Ripple; onFinish: (id: number) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onFinish(pulse.id), 1000);
    return () => clearTimeout(timer);
  }, [pulse.id, onFinish]);

  return <div className="demo-ripple" data-ripple-id={pulse.id} style={{ left: pulse.x, top: pulse.y }}><i /><i /></div>;
}

export default function DemoWalkthrough({ onExit, onReplay }: { onExit: () => void; onReplay: () => void }) {
  const paused = useRef(false);
  const firstControl = useRef<HTMLButtonElement>(null);
  const [isPaused, setPaused] = useState(false);
  const [status, setStatus] = useState<"playing" | "complete" | "error">("playing");
  const [elapsed, setElapsed] = useState(0);
  const [caption, setCaption] = useState<DemoCaption>({ chapter: 0, title: "Five friends. One movie night.", detail: "Start with the people, the time, and what everyone needs." });
  const [pointer, setPointer] = useState<DemoPoint | null>(null);
  const [transition, setTransition] = useState<DemoTransition | null>(null);
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const rippleId = useRef(0);
  const ripplePlane = useRef<HTMLDivElement>(null);
  const finishRipple = useCallback((id: number) => {
    setRipples((current) => current.filter((pulse) => pulse.id !== id));
  }, []);

  useEffect(() => {
    // Keep clicks attached to document coordinates without adding scrollable space.
    const syncScroll = () => {
      if (ripplePlane.current) ripplePlane.current.style.transform = `translate3d(${-window.scrollX}px, ${-window.scrollY}px, 0)`;
    };
    syncScroll();
    window.addEventListener("scroll", syncScroll, { passive: true });
    return () => window.removeEventListener("scroll", syncScroll);
  }, []);

  useEffect(() => {
    firstControl.current?.focus();
    const controller = new AbortController();
    runWalkthrough({
      signal: controller.signal,
      isPaused: () => paused.current,
      onCaption: setCaption,
      onPointer: setPointer,
      onRipple: (point) => {
        const pulse = { id: ++rippleId.current, x: point.x + window.scrollX, y: point.y + window.scrollY };
        setRipples((current) => [...current, pulse]);
      },
      onProgress: setElapsed,
      onTransition: (next) => {
        setTransition(next);
        if (next) { setPointer(null); setRipples([]); }
      },
    }).then(() => {
      if (!controller.signal.aborted) { setStatus("complete"); setPointer(null); }
    }).catch(() => {
      if (!controller.signal.aborted) { setStatus("error"); setPointer(null); setTransition(null); }
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
      {transition && <div className={`demo-skip ${transition.leaving ? "is-leaving" : ""}`} role="region" aria-label="Voting transition">
        <div className="demo-skip-copy">
          <p className="demo-eyebrow">Skipping repeated votes</p>
          <h2>Everyone gets their say.</h2>
          <p>Leo finishes his review. Priya, Sam, and Alex take their private turns.<br />We’re moving ahead to the group’s results.</p>
          <div className="demo-skip-viewers" aria-hidden="true">
            {DEMO_PARTY.map((name, index) => <span key={name} className={index < transition.completed ? "is-complete" : ""}>{index < transition.completed ? <Check size={18} /> : name[0]}</span>)}
          </div>
          <p className="demo-skip-count">{transition.completed} of 5 ballots complete</p>
        </div>
      </div>}
      {pointer && <div className="demo-pointer" aria-hidden="true" style={{ transform: `translate3d(${pointer.x}px, ${pointer.y}px, 0)` }} />}
      <div className="demo-ripples" aria-hidden="true">
        <div className="demo-ripple-plane" ref={ripplePlane}>
          {ripples.map((pulse) => <ClickRipple key={pulse.id} pulse={pulse} onFinish={finishRipple} />)}
        </div>
      </div>
      <section className="demo-bar" aria-label="Guided demo" data-demo-status={status}>
        <div className="demo-progress" role="progressbar" aria-label="Demo progress" aria-valuemin={0} aria-valuemax={WALKTHROUGH_DURATION / 1000} aria-valuenow={Math.floor(elapsed / 1000)}>
          <span style={{ transform: `scaleX(${elapsed / WALKTHROUGH_DURATION})` }} />
        </div>
        <div className="demo-caption" aria-live="polite" aria-atomic="true">
          <p className="demo-eyebrow"><span className="demo-live-dot" />{status === "complete" ? "Demo complete" : isPaused ? "Demo paused" : "Guided demo"}<span>5 viewers · Demo data</span></p>
          <h2>{status === "error" ? "Let’s give that another try." : caption.title}</h2>
          <p className="demo-detail">{status === "error" ? "Restart the walkthrough, or exit to return to your evening." : caption.detail}</p>
        </div>
        <div className="demo-controls">
          <span className="demo-time">{clock(elapsed)} <span>/ {clock(WALKTHROUGH_DURATION)}</span></span>
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
