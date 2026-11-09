import { DEMO_MOVIES } from "./demo";
import { RESPONSE_OPTIONS, type Response } from "./veto";

export const WALKTHROUGH_DURATION = 135_000;
export const DEMO_PARTY = ["Maya", "Leo", "Priya", "Sam", "Alex"];
export const DEMO_FILMS = [
  "Maharaja", "Glass Onion: A Knives Out Mystery", "The Adam Project",
  "The Tomorrow War", "Jaane Jaan",
].map((title) => {
  const movie = DEMO_MOVIES.find((item) => item.title === title);
  if (!movie) throw new Error(`Missing walkthrough movie: ${title}`);
  return movie;
});
export const DEMO_BALLOTS: Response[][] = [
  ["want", "okay", "okay", "veto", "okay"],
  ["okay", "want", "prefer", "okay", "okay"],
  ["okay", "want", "okay", "prefer", "veto"],
  ["prefer", "okay", "want", "okay", "okay"],
  ["want", "want", "okay", "prefer", "okay"],
];
export const DEMO_SURVIVORS = [DEMO_FILMS[1], DEMO_FILMS[0], DEMO_FILMS[2]];
export const DEMO_CHAPTERS = ["The party", "Suggestions", "Private votes", "The results", "Keep the good ones"];

type Step = {
  kind: "click" | "type" | "select" | "look" | "hold" | "skip-votes";
  selector?: string;
  value?: string;
  weight: number;
  chapter: number;
  title: string;
  detail: string;
};
export type DemoCaption = Pick<Step, "chapter" | "title" | "detail">;
export type DemoPoint = { x: number; y: number };
export type DemoTransition = { completed: number; leaving?: boolean };
const target = (name: string) => `[data-demo="${name}"]`;

/** A presentation script, executed through the same controls a person uses. */
export function walkthroughSteps(): Step[] {
  const steps: Step[] = [];
  let caption: DemoCaption = { chapter: 0, title: "Five friends. One movie night.", detail: "Start with the people, the time, and what everyone needs." };
  const add = (kind: Step["kind"], selector: string | undefined, weight: number, value?: string) =>
    steps.push({ ...caption, kind, selector, weight, value });
  add("hold", undefined, 2200);
  add("select", target("viewer-count"), 1000, "5");
  DEMO_PARTY.forEach((name, index) => add("type", `[data-demo-viewer="${index}"]`, 1100, name));
  caption = { chapter: 0, title: "Make room for everyone.", detail: "English, Hindi, Tamil, and required subtitles. Access needs never spend a veto." };
  add("click", '[data-demo-language="hi"]', 900);
  add("click", '[data-demo-language="ta"]', 900);
  add("click", target("subtitles"), 1800);
  add("click", target("continue"), 1700);
  DEMO_FILMS.forEach((movie, index) => {
    caption = { chapter: 1, title: `${DEMO_PARTY[index]} brings a suggestion.`, detail: `${movie.title}. Each person gets the same chance to contribute.` };
    add("type", target("search"), 2000, movie.title);
    add("click", `[data-demo-movie="${movie.id}"]`, 2800);
  });
  caption = { chapter: 1, title: "Five suggestions. Equal say.", detail: "The same five movies go to every viewer, one private turn at a time." };
  add("click", target("start-voting"), 2000);
  caption = { chapter: 2, title: "Maya’s private turn.", detail: "Really Want, Okay, Prefer another, or Veto. Select first, then save." };
  add("click", target("begin-turn"), 2000);
  DEMO_BALLOTS[0].forEach((response, movie) => {
    caption = {
      chapter: 2,
      title: `Maya’s turn · ${movie + 1} of 5`,
      detail: `${DEMO_FILMS[movie].title} · ${movie === 0
        ? "A selection can change before it is saved."
        : response === "veto" ? "A veto removes this movie."
          : RESPONSE_OPTIONS.find((option) => option.value === response)!.label}`,
    };
    if (movie === 0) add("click", '[data-demo-response="okay"]', 800);
    add("click", `[data-demo-response="${response}"]`, 1200);
    add("click", target("save-response"), 1000);
  });
  caption = { chapter: 2, title: "Maya reviews, then hands over.", detail: "Saved responses can be corrected before submitting the complete ballot." };
  add("look", ".v-review-row", 2300);
  add("click", target("finish-turn"), 1500);
  caption = { chapter: 2, title: "Skipping the repeated votes.", detail: "The other four viewers complete the same private steps. We’re moving ahead to their results." };
  add("skip-votes", undefined, 7400);

  caption = { chapter: 3, title: "Five voices. A clear result.", detail: "All five ballots count. Now there’s time to compare what survived, and why." };
  add("click", target("show-results"), 2000);
  caption = { chapter: 3, title: "A favourite, without forcing a winner.", detail: "Glass Onion: 3 Really Want, 2 Okay, and no vetoes. Everyone is willing to watch." };
  add("look", `[data-demo-result="${DEMO_FILMS[1].id}"]`, 10000);
  caption = { chapter: 3, title: "A softer preference still leaves room.", detail: "Maharaja: 2 Really Want, 2 Okay, and 1 Prefer another. It stays in the running." };
  add("look", `[data-demo-result="${DEMO_FILMS[0].id}"]`, 7000);
  caption = { chapter: 3, title: "Three movies the group can live with.", detail: "The Adam Project survives too. Prefer another expresses a preference, not a refusal." };
  add("look", `[data-demo-result="${DEMO_FILMS[2].id}"]`, 7000);
  caption = { chapter: 3, title: "A veto cannot be outvoted.", detail: "The Tomorrow War is eliminated. The other four responses cannot override that objection." };
  add("look", `[data-demo-result="${DEMO_FILMS[3].id}"]`, 7000);
  caption = { chapter: 3, title: "Two objections. Three survivors.", detail: "Jaane Jaan also received a veto. Glass Onion, Maharaja, and The Adam Project remain." };
  add("look", `[data-demo-result="${DEMO_FILMS[4].id}"]`, 7000);
  caption = { chapter: 4, title: "Keep every survivor.", detail: "Save three good options. Nobody has to force a single winner." };
  DEMO_SURVIVORS.forEach((movie) => add("click", `[data-demo-save="${movie.id}"]`, 3000));
  add("click", target("view-shortlist"), 2000);
  caption = { chapter: 4, title: "All three, saved together.", detail: "Glass Onion, Maharaja, and The Adam Project are now in Shortlist. Keep the options that work." };
  add("look", ".movie-grid", 10000);
  caption = { chapter: 4, title: "Five friends. Three movies to look forward to.", detail: "Everyone contributed. Real objections were respected. The good options stay together." };
  add("look", ".movie-grid", 9000);
  return steps;
}

/** Drive actual DOM events rather than inserting prepared session/results state. */
export async function runWalkthrough({
  signal, isPaused, onCaption, onPointer, onRipple, onProgress, onTransition,
}: {
  signal: AbortSignal;
  isPaused: () => boolean;
  onCaption: (caption: DemoCaption) => void;
  onPointer: (point: DemoPoint) => void;
  onRipple: (point: DemoPoint) => void;
  onProgress: (elapsed: number) => void;
  onTransition: (transition: DemoTransition | null) => void;
}) {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const steps = walkthroughSteps();
  const weight = steps.reduce((total, step) => total + step.weight, 0);
  let elapsed = 0;
  let last = performance.now();
  let reported = -100;
  let deadline = 0;
  function clock() {
    if (signal.aborted) throw new DOMException("Demo stopped", "AbortError");
    const now = performance.now();
    if (!isPaused()) elapsed += now - last;
    last = now;
    if (elapsed - reported >= 100) {
      onProgress(Math.min(elapsed, WALKTHROUGH_DURATION));
      reported = elapsed;
    }
    return elapsed;
  }
  async function wait(milliseconds: number) {
    const end = clock() + Math.max(0, milliseconds);
    while (clock() < end || isPaused()) await new Promise((resolve) => setTimeout(resolve, 32));
  }
  async function find(selector: string): Promise<HTMLElement> {
    const start = clock();
    while (clock() - start < 10_000) {
      await wait(0);
      const element = document.querySelector<HTMLElement>(selector);
      if (element && element.getClientRects().length && !element.matches(":disabled")) return element;
      await wait(32);
    }
    throw new Error("Walkthrough control unavailable");
  }
  async function approach(element: HTMLElement) {
    document.querySelectorAll(".demo-target").forEach((item) => item.classList.remove("demo-target"));
    const bounds = element.getBoundingClientRect();
    const bottomMargin = window.innerWidth < 700 ? 230 : 165;
    if (bounds.top < 90 || bounds.bottom > window.innerHeight - bottomMargin) {
      element.scrollIntoView({ behavior: reducedMotion ? "instant" : "smooth", block: "center" });
      if (reducedMotion) await wait(32);
      else {
        const started = clock();
        let previous = element.getBoundingClientRect().top;
        let settled = 0;
        while (settled < 3 && clock() - started < 1100) {
          await wait(32);
          const top = element.getBoundingClientRect().top;
          settled = Math.abs(top - previous) < .75 ? settled + 1 : 0;
          previous = top;
        }
      }
    }
    element.classList.add("demo-target");
    const rect = element.getBoundingClientRect();
    const point = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    onPointer(point);
    await wait(reducedMotion ? 32 : 320);
    return point;
  }
  function input(element: HTMLInputElement | HTMLSelectElement, value: string) {
    const prototype = element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(element, value);
    element.dispatchEvent(new Event(element instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
  }
  try {
    for (const step of steps) {
      await wait(0);
      onCaption(step);
      deadline += (step.weight / weight) * WALKTHROUGH_DURATION;
      if (step.kind === "skip-votes") {
        onTransition({ completed: 1 });
        document.querySelectorAll(".demo-target").forEach((item) => item.classList.remove("demo-target"));
        await wait(reducedMotion ? 32 : 500);
        const click = async (selector: string) => {
          const element = await find(selector);
          await wait(0);
          element.click();
          await wait(32);
        };
        for (let viewer = 1; viewer < DEMO_BALLOTS.length; viewer++) {
          await click(target("begin-turn"));
          for (const response of DEMO_BALLOTS[viewer]) {
            await click(`[data-demo-response="${response}"]`);
            await click(target("save-response"));
          }
          await click(target("finish-turn"));
          onTransition({ completed: viewer + 1 });
          await wait(350);
        }
        const ready = await find(target("show-results"));
        ready.scrollIntoView({ behavior: "instant", block: "center" });
        const fade = reducedMotion ? 32 : 500;
        await wait(deadline - clock() - fade);
        onTransition({ completed: DEMO_PARTY.length, leaving: true });
        await wait(fade);
        onTransition(null);
      } else if (step.selector) {
        const element = await find(step.selector);
        const point = await approach(element);
        if (step.kind === "click") {
          await wait(0);
          onRipple(point);
          element.click();
        } else if (step.kind === "type" && element instanceof HTMLInputElement) {
          onRipple(point);
          input(element, "");
          for (const character of step.value ?? "") {
            await wait(30);
            input(element, element.value + character);
          }
        } else if (step.kind === "select" && element instanceof HTMLSelectElement) {
          onRipple(point);
          input(element, step.value!);
        }
      }
      await wait(deadline - clock());
    }
    onProgress(WALKTHROUGH_DURATION);
  } finally {
    document.querySelectorAll(".demo-target").forEach((item) => item.classList.remove("demo-target"));
  }
}
