import assert from "node:assert/strict";
import { test } from "node:test";
import { DEMO_MOVIES } from "../src/lib/demo";
import {
  assumeCandidate,
  defaultLimits,
  eligibility,
  remainingMinutes,
  tally,
  PROTOTYPE_RUNTIME_MINUTES,
  type Ballot,
  type Candidate,
} from "../src/lib/veto";

const now = Date.parse("2026-11-05T20:00:00Z");
const movie = DEMO_MOVIES.find((item) => item.title === "Interstellar")!;

function candidate(overrides: Partial<Candidate> = {}): Candidate {
  return {
    movie, source: 9, audio: "en", subtitles: true,
    accessConfirmed: true, nominatedBy: null, ...overrides,
  };
}
const reasons = (value: Candidate, limits = defaultLimits(now), at = now) =>
  eligibility(value, limits, at).join(" ");

test("default limits retain a three-hour window and do not share mutable selections", () => {
  const limits = defaultLimits(now);
  assert.deepEqual(limits, {
    viewers: 3, deadline: "2026-11-05T23:00:00.000Z", services: [8, 9],
    audioLanguages: ["en"], subtitles: false,
  });
  limits.services.push(337);
  assert.deepEqual(defaultLimits(now).services, [8, 9]);
  assert.equal(remainingMinutes(limits.deadline, now), 180);
  assert.equal(remainingMinutes("invalid", now), 0);
  assert.equal(remainingMinutes(limits.deadline, now + 181 * 60_000), 0);
});

test("eligibility preserves the agreed source, audio, and subtitle requirements", () => {
  assert.deepEqual(eligibility(candidate(), defaultLimits(now), now), []);
  assert.match(reasons(candidate({ accessConfirmed: false })), /Confirm playback access/);
  assert.match(reasons(candidate({ source: 337 })), /agreed streaming services/);
  assert.match(reasons(candidate({ audio: "hi" })), /audio language/);
  assert.match(reasons(candidate({ subtitles: false }), { ...defaultLimits(now), subtitles: true }), /subtitles/);
});

test("prototype assumptions fill unknown metadata and prefer matching agreed options", () => {
  const limits = { ...defaultLimits(now), audioLanguages: ["en", "ta"], subtitles: true };
  const known = { ...movie, runtime: 85, original_language: "ta", provider_ids: [9] };
  const matching = assumeCandidate(known, limits, 1);
  assert.equal(matching.movie.runtime, 85);
  assert.equal(matching.source, 9);
  assert.equal(matching.audio, "ta");
  assert.equal(matching.subtitles, true);
  assert.equal(matching.accessConfirmed, true);
  assert.equal(matching.nominatedBy, 1);
  const unknown = { ...movie, runtime: undefined, original_language: "ja", provider_ids: undefined };
  const assumed = assumeCandidate(unknown, limits, null);
  assert.equal(assumed.movie.runtime, PROTOTYPE_RUNTIME_MINUTES);
  assert.equal(assumed.source, 8);
  assert.equal(assumed.audio, "en");
  assert.deepEqual(eligibility(assumed, limits, now), []);
  assert.equal(unknown.runtime, undefined);
  assert.equal(assumeCandidate({ ...unknown, runtime: 0 }, limits, 0).movie.runtime, 120);
  const short = { ...limits, deadline: new Date(now + 119 * 60_000).toISOString() };
  assert.match(eligibility(assumed, short, now).join(" "), /120 min runtime exceeds/);
  assert.equal(assumeCandidate(movie, limits, 0).movie.runtime, 169);
});

test("runtime and final deadline checks reject unknown or newly overlong movies", () => {
  const limits = defaultLimits(now);
  assert.match(reasons(candidate({ movie: { ...movie, runtime: undefined } })), /runtime/);
  assert.match(reasons(candidate({ movie: { ...movie, runtime: 0 } })), /runtime/);
  assert.match(reasons(candidate(), limits, now + 12 * 60_000), /169 min runtime exceeds the 168 min remaining/);
  assert.deepEqual(eligibility(candidate(), { ...limits, deadline: new Date(now + 169 * 60_000).toISOString() }, now), []);
  assert.match(reasons(candidate(), limits, Date.parse(limits.deadline)), /has passed/);
  assert.match(reasons(candidate(), { ...limits, deadline: "invalid" }), /valid movie end time/);
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
  assert.deepEqual(results.map((result) => result.candidate.movie.id), [first.movie.id, second.movie.id]);
  assert.deepEqual(results[0], { candidate: first, counts: { want: 2, okay: 0, prefer: 0, veto: 1 }, eliminated: true });
  assert.deepEqual(results[1], { candidate: second, counts: { want: 1, okay: 1, prefer: 1, veto: 0 }, eliminated: false });
  for (const result of results) assert.equal(Object.values(result.counts).reduce((sum, count) => sum + count, 0), 3);
  assert.deepEqual(tally([first], [{}])[0].counts, { want: 0, okay: 0, prefer: 0, veto: 0 });
});
