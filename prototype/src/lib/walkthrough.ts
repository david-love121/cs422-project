import { DEMO_MOVIES } from "./demo";
import { RESPONSE_OPTIONS, type Response } from "./veto";

export const WALKTHROUGH_DURATION = 160_000;
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
  kind: "click" | "type" | "select" | "look" | "hold";
  selector?: string;
  value?: string;
  weight: number;
  chapter: number;
  title: string;
  detail: string;
};
export type DemoCaption = Pick<Step, "chapter" | "title" | "detail">;
export type DemoPoint = { x: number; y: number };
const target = (name: string) => `[data-demo="${name}"]`;

/** A presentation script, executed through the same controls a person uses. */
export function walkthroughSteps(): Step[] {
  const steps: Step[] = [];
  let caption: DemoCaption = { chapter: 0, title: "Five friends. One movie night.", detail: "Start with the people, the time, and what everyone needs." };
  const add = (kind: Step["kind"], selector: string | undefined, weight: number, value?: string) =>
    steps.push({ ...caption, kind, selector, weight, value });
  add("hold", undefined, 3000);
  add("select", target("viewer-count"), 1400, "5");
  DEMO_PARTY.forEach((name, index) => add("type", `[data-demo-viewer="${index}"]`, 1800, name));
  caption = { chapter: 0, title: "Make room for everyone.", detail: "English, Hindi, Tamil, and required subtitles. Access needs never spend a veto." };
  add("click", '[data-demo-language="hi"]', 1200);
  add("click", '[data-demo-language="ta"]', 1200);
  add("click", target("subtitles"), 2000);
  add("click", target("continue"), 2000);
  DEMO_FILMS.forEach((movie, index) => {
    caption = { chapter: 1, title: `${DEMO_PARTY[index]} brings a suggestion.`, detail: `${movie.title}. Each person gets the same chance to contribute.` };
    add("type", target("search"), 2400, movie.title);
    add("click", `[data-demo-movie="${movie.id}"]`, 3200);
  });
  caption = { chapter: 1, title: "Five suggestions. Equal say.", detail: "The same five movies go to every viewer, one private turn at a time." };
  add("click", target("start-voting"), 2500);
  DEMO_BALLOTS.forEach((ballot, viewer) => {
    caption = { chapter: 2, title: `${DEMO_PARTY[viewer]}’s private turn.`, detail: viewer === 0
      ? "Really Want, Okay, Prefer another, or Veto. Select first, then save."
      : "Responses stay covered between turns. Every viewer answers every movie." };
    add("click", target("begin-turn"), 2200);
    ballot.forEach((response, movie) => {
      caption = {
        chapter: 2,
        title: `${DEMO_PARTY[viewer]}’s turn · ${movie + 1} of 5`,
        detail: `${DEMO_FILMS[movie].title} · ${viewer === 0 && movie === 0
          ? "A selection can change before it is saved."
          : response === "veto" ? "A veto removes this movie."
            : RESPONSE_OPTIONS.find((option) => option.value === response)!.label}`,
      };
      if (viewer === 0 && movie === 0) add("click", '[data-demo-response="okay"]', 900);
      add("click", `[data-demo-response="${response}"]`, viewer === 0 ? 1500 : 950);
      add("click", target("save-response"), 1000);
    });
    caption = { chapter: 2, title: `${DEMO_PARTY[viewer]} reviews, then hands over.`, detail: "Saved responses can be corrected before submitting the complete ballot." };
    add("look", ".v-review-row", 2800);
    add("click", target("finish-turn"), 1700);
  });
  caption = { chapter: 3, title: "Five voices. A clear result.", detail: "All five ballots count. Enthusiasm never overrides a firm veto." };
  add("click", target("show-results"), 2500);
  add("look", `[data-demo-result="${DEMO_FILMS[1].id}"]`, 4500);
  caption = { chapter: 3, title: "A veto means no.", detail: "The Tomorrow War and Jaane Jaan are out. The other three movies survive." };
  add("look", `[data-demo-result="${DEMO_FILMS[3].id}"]`, 3500);
  add("look", `[data-demo-result="${DEMO_FILMS[4].id}"]`, 3500);
  caption = { chapter: 4, title: "Keep every survivor.", detail: "Save three good options. Nobody has to force a single winner." };
  DEMO_SURVIVORS.forEach((movie) => add("click", `[data-demo-save="${movie.id}"]`, 2300));
  add("click", target("view-shortlist"), 1800);
  caption = { chapter: 4, title: "Five friends. Three movies to look forward to.", detail: "Everyone contributed. Real objections were respected. The good options stay together." };
  add("look", ".movie-grid", 8000);
  return steps;
}

/** Drive actual DOM events rather than inserting prepared session/results state. */
export async function runWalkthrough({
  signal, isPaused, onCaption, onPointer, onRipple, onProgress,
}: {
  signal: AbortSignal;
  isPaused: () => boolean;
  onCaption: (caption: DemoCaption) => void;
  onPointer: (point: DemoPoint) => void;
  onRipple: (point: DemoPoint) => void;
  onProgress: (elapsed: number) => void;
}) {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const steps = walkthroughSteps();
  const weight = steps.reduce((total, step) => total + step.weight, 0);
  let elapsed = 0;
  let last = performance.now();
  let reported = -100;
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
      const started = clock();
      if (step.selector) {
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
      await wait((step.weight / weight) * WALKTHROUGH_DURATION - (clock() - started));
    }
    onProgress(WALKTHROUGH_DURATION);
  } finally {
    document.querySelectorAll(".demo-target").forEach((item) => item.classList.remove("demo-target"));
  }
}
