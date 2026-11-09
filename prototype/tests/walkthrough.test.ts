import assert from "node:assert/strict";
import { test } from "node:test";
import { DEMO_BALLOTS, DEMO_FILMS, DEMO_PARTY, DEMO_SURVIVORS, WALKTHROUGH_DURATION } from "../src/lib/walkthrough";
import { assumeCandidate, defaultLimits, eligibility, tally } from "../src/lib/veto";

test("the five-viewer walkthrough respects eligibility and veto rules and ends with three real survivors", () => {
  const now = Date.now();
  const limits = { ...defaultLimits(now), viewers: 5, audioLanguages: ["en", "hi", "ta"], subtitles: true };
  const candidates = DEMO_FILMS.map((movie, index) => assumeCandidate(movie, limits, index));
  assert.equal(DEMO_PARTY.length, 5);
  assert.equal(WALKTHROUGH_DURATION, 120_000);
  for (const candidate of candidates) assert.deepEqual(eligibility(candidate, limits, now), []);
  const ballots = DEMO_BALLOTS.map((responses) => {
    assert.equal(responses.length, candidates.length);
    assert.ok(responses.filter((response) => response === "veto").length <= 1);
    return Object.fromEntries(candidates.map((candidate, index) => [candidate.movie.id, responses[index]]));
  });
  const results = tally(candidates, ballots);
  assert.deepEqual(results.filter((result) => !result.eliminated).map((result) => result.candidate.movie.id).sort(), DEMO_SURVIVORS.map((movie) => movie.id).sort());
  for (const result of results) assert.equal(Object.values(result.counts).reduce((sum, count) => sum + count, 0), 5);
  assert.equal(results[1].counts.want, 3);
});
