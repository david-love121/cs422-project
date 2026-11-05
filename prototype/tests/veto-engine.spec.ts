import { expect, test } from "@playwright/test";
import { DEMO_MOVIES } from "../src/lib/demo";
import {
  defaultLimits,
  eligibility,
  remainingMinutes,
  tally,
  type Ballot,
  type Candidate,
} from "../src/lib/veto";

const now = Date.parse("2026-11-05T20:00:00Z");
const movie = DEMO_MOVIES.find((item) => item.title === "Interstellar")!;

function candidate(overrides: Partial<Candidate> = {}): Candidate {
  return {
    movie,
    source: 9,
    audio: "en",
    subtitles: true,
    accessConfirmed: true,
    nominatedBy: null,
    ...overrides,
  };
}

test("default limits retain a three-hour window and do not share mutable selections", () => {
  const limits = defaultLimits(now);
  expect(limits).toEqual({
    viewers: 3,
    deadline: "2026-11-05T23:00:00.000Z",
    services: [8, 9],
    audioLanguages: ["en"],
    subtitles: false,
  });
  limits.services.push(337);
  expect(defaultLimits(now).services).toEqual([8, 9]);
  expect(remainingMinutes(limits.deadline, now)).toBe(180);
  expect(remainingMinutes("invalid", now)).toBe(0);
  expect(remainingMinutes(limits.deadline, now + 181 * 60_000)).toBe(0);
});

test("eligibility requires a manual access check rather than trusting the sample providers", () => {
  const limits = defaultLimits(now);
  expect(eligibility(candidate(), limits, now)).toEqual([]);
  expect(eligibility(candidate({ accessConfirmed: false }), limits, now).join(" ")).toContain("Confirm playback access");
  expect(eligibility(candidate({ source: 337 }), limits, now).join(" ")).toContain("agreed streaming services");
  expect(eligibility(candidate({ audio: "hi" }), limits, now).join(" ")).toContain("audio language");
  expect(eligibility(candidate({ subtitles: false }), { ...limits, subtitles: true }, now).join(" ")).toContain("subtitles");
});

test("runtime and final deadline checks reject unknown or newly overlong movies", () => {
  const limits = defaultLimits(now);
  expect(eligibility(candidate({ movie: { ...movie, runtime: undefined } }), limits, now).join(" ")).toContain("runtime");
  expect(eligibility(candidate({ movie: { ...movie, runtime: 0 } }), limits, now).join(" ")).toContain("runtime");
  expect(eligibility(candidate(), limits, now + 12 * 60_000).join(" ")).toContain("169 min runtime exceeds the 168 min remaining");
  expect(eligibility(candidate(), { ...limits, deadline: new Date(now + 169 * 60_000).toISOString() }, now)).toEqual([]);
  expect(eligibility(candidate(), limits, Date.parse(limits.deadline)).join(" ")).toContain("has passed");
  expect(eligibility(candidate(), { ...limits, deadline: "invalid" }, now).join(" ")).toContain("valid movie end time");
});

test("a veto overrides enthusiasm while a softer preference leaves a title available", () => {
  const first = candidate();
  const second = candidate({ movie: DEMO_MOVIES[0] });
  const ballots: Ballot[] = [
    { [first.movie.id]: "want", [second.movie.id]: "want" },
    { [first.movie.id]: "want", [second.movie.id]: "okay" },
    { [first.movie.id]: "veto", [second.movie.id]: "prefer" },
  ];
  const results = tally([first, second], ballots);
  expect(results.map((result) => result.candidate.movie.id)).toEqual([first.movie.id, second.movie.id]);
  expect(results[0]).toEqual({ candidate: first, counts: { want: 2, okay: 0, prefer: 0, veto: 1 }, eliminated: true });
  expect(results[1]).toEqual({ candidate: second, counts: { want: 1, okay: 1, prefer: 1, veto: 0 }, eliminated: false });
  for (const result of results) expect(Object.values(result.counts).reduce((sum, count) => sum + count, 0)).toBe(3);
  expect(tally([first], [{}])[0].counts).toEqual({ want: 0, okay: 0, prefer: 0, veto: 0 });
});
