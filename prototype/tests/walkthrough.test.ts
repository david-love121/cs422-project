import assert from "node:assert/strict";
import { test } from "node:test";
import { DEMO_BALLOTS, DEMO_FILMS, DEMO_PARTY, DEMO_SURVIVORS, WALKTHROUGH_DURATION, walkthroughSteps } from "../src/lib/walkthrough";
import { assumeCandidate, defaultLimits, eligibility, tally } from "../src/lib/veto";

test("the five-viewer walkthrough respects eligibility and veto rules and ends with three real survivors", () => {
  const now = Date.now();
  const limits = { ...defaultLimits(now), viewers: 5, audioLanguages: ["en", "hi", "ta"], subtitles: true };
  const candidates = DEMO_FILMS.map((movie, index) => assumeCandidate(movie, limits, index));
  assert.equal(DEMO_PARTY.length, 5);
  assert.equal(WALKTHROUGH_DURATION, 135_000);
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


test("the 2:15 presentation shows two voting turns and devotes 70 seconds to results and the shortlist", () => {
  const steps = walkthroughSteps();
  const weights = [0, 1, 2, 3, 4].map((chapter) => steps.filter((step) => step.chapter === chapter).reduce((total, step) => total + step.weight, 0));
  assert.deepEqual(weights, [12_000, 20_700, 32_300, 40_000, 30_000]);
  assert.equal(weights.reduce((total, value) => total + value, 0), WALKTHROUGH_DURATION);
  assert.equal(steps.filter((step) => step.kind === "skip-votes").length, 1);
  assert.equal(steps.filter((step) => step.selector === '[data-demo="begin-turn"]').length, 2);
  const fade = steps.findIndex((step) => step.kind === "skip-votes");
  assert.equal(steps[fade].weight, 8000);
  assert.equal(steps[fade - 1].selector, ".v-review-row");
  assert.equal(steps[fade - 1].title, "Leo reviews his responses.");
});
