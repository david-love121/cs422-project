import assert from "node:assert/strict";
import { test } from "node:test";
import { DEMO_MOVIES } from "../src/lib/demo";
import {
  confirmDecision,
  freshSession,
  parseSession,
  pauseSession,
  readSession,
  rejectedIds,
  restartSession,
  saveResponse,
  startVoting,
  submitTurn,
  type Session,
} from "../src/lib/session";
import { assumeCandidate, eligibility, type Candidate } from "../src/lib/veto";

const now = Date.parse("2026-11-05T20:00:00Z");
const movies = ["Soul", "The Grand Budapest Hotel"].map((title) => DEMO_MOVIES.find((movie) => movie.title === title)!);
const candidates: Candidate[] = movies.map((movie, index) => ({
  movie, source: 8, audio: "en", subtitles: true, accessConfirmed: true, nominatedBy: index,
}));

function session(overrides: Partial<Session> = {}): Session {
  const fresh = freshSession(now);
  return { ...fresh, phase: "suggest", limits: { ...fresh.limits, viewers: 2 },
    nomination: 2, candidates, ...overrides };
}
const complete = (first = "okay", second = "okay") => ({
  [movies[0].id]: first,
  [movies[1].id]: second,
}) as Session["draft"];

test("restoration validates ballots, phase invariants, chosen identity, and metadata", () => {
  const result = session({ phase: "choose", voter: 2, ballots: [complete(), complete()] });
  assert.ok(parseSession(result));
  const invalid: unknown[] = [
    { ...result, ballots: [{}, {}] },
    { ...result, ballots: [[], []] },
    { ...result, ballots: [complete(), { ...complete(), 999999: "okay" }] },
    { ...result, ballots: [complete("veto", "veto"), complete()] },
    { ...result, phase: "vote" },
    { ...result, phase: "confirm", chosen: 999999 },
    { ...result, phase: "confirm", chosen: movies[0].id, ballots: [complete("veto"), complete()] },
    { ...result, phase: "done", chosen: movies[0].id, confirmedAt: null },
    { ...result, candidates: [{ ...candidates[0], movie: { id: -1, title: "Broken" } }] },
    { ...result, candidates: [{ ...candidates[0], movie: { ...movies[0], runtime: "101" } }, candidates[1]] },
    { ...result, excluded: [movies[0].id] },
  ];
  for (const value of invalid) assert.equal(parseSession(value), null);
  assert.equal(readSession("{broken"), null);
  assert.equal(readSession(null), null);
});

test("restoring a private vote or review covers it without discarding saved responses", () => {
  for (const phase of ["vote", "review"] as const) {
    const prior = session({ phase, draft: { [movies[0].id]: "veto" }, index: 1 });
    const restored = readSession(JSON.stringify(prior));
    assert.equal(restored?.phase, "handoff");
    assert.equal(restored?.resume, phase);
    assert.deepEqual(restored?.draft, prior.draft);
  }
});

test("fresh rounds preserve actual objections while acceptable titles remain available", () => {
  const prior = session({ phase: "choose", voter: 2, ballots: [complete("veto"), complete()] });
  for (const recovery of ["limits", "another"] as const) {
    const next = restartSession(prior, recovery, now);
    assert.equal(next.phase, recovery === "limits" ? "setup" : "suggest");
    assert.deepEqual(next.excluded, [movies[0].id]);
    assert.ok(!next.excluded.includes(movies[1].id));
    assert.deepEqual(next.candidates, []);
    assert.deepEqual(next.ballots, []);
    assert.deepEqual(next.draft, {});
    assert.equal(next.nomination, 0);
    assert.equal(next.voter, 0);
    assert.deepEqual(next.limits, prior.limits);
    assert.deepEqual(next.names, prior.names);
    assert.ok(parseSession(next));
  }
  const allWilling = session({ phase: "choose", voter: 2, ballots: [complete(), complete()] });
  assert.deepEqual(restartSession(allWilling, "limits", now).excluded, []);
});

test("only explicit reconsideration releases rejected titles and always clears old ballots", () => {
  const prior = session({ phase: "paused", excluded: [999], draft: { [movies[0].id]: "veto" } });
  assert.deepEqual(rejectedIds(prior), [999, movies[0].id]);
  assert.deepEqual(restartSession(prior, "another", now).excluded, [999, movies[0].id]);
  const reconsidered = restartSession(prior, "reconsider", now);
  assert.equal(reconsidered.phase, "suggest");
  assert.deepEqual(reconsidered.excluded, []);
  assert.deepEqual(reconsidered.candidates, []);
  assert.deepEqual(reconsidered.draft, {});
  assert.deepEqual(prior.draft, { [movies[0].id]: "veto" });
});

test("saving and correcting a veto enforces one active objection and complete submission", () => {
  let prior = session({ phase: "vote" });
  prior = saveResponse(prior, "veto");
  assert.equal(saveResponse(prior, "veto"), prior);
  const incomplete: Session = { ...prior, phase: "review" };
  assert.equal(submitTurn(incomplete), incomplete);
  // Return to the first title and correct its saved veto before objecting to the next.
  prior = saveResponse({ ...prior, index: 0 }, "want");
  prior = saveResponse(prior, "veto");
  const submitted = submitTurn(prior);
  assert.equal(submitted.phase, "handoff");
  assert.equal(submitted.voter, 1);
  assert.deepEqual(submitted.ballots, [complete("want", "veto")]);
  assert.deepEqual(submitted.draft, {});
  assert.ok(parseSession(submitted));
});

test("prototype defaults preserve requirements and access review never spends a preference veto", () => {
  const prior = session({ phase: "vote", limits: { ...session().limits, subtitles: true } });
  const assumed = assumeCandidate({ ...movies[0], runtime: undefined }, prior.limits, 0);
  assert.equal(assumed.subtitles, true);
  assert.equal(assumed.accessConfirmed, true);
  assert.deepEqual(eligibility(assumed, prior.limits, now), []);
  const ineligible: Candidate[] = [
    { ...assumed, movie: { ...assumed.movie, runtime: 181 } },
    { ...assumed, source: 337 },
    { ...assumed, audio: "fr" },
  ];
  for (const candidate of ineligible) {
    assert.ok(eligibility(candidate, prior.limits, now).length > 0);
    const proposed = session({ limits: prior.limits, candidates: [candidate] });
    assert.equal(startVoting(proposed, now), proposed);
  }
  assert.deepEqual(prior.draft, {});
  const covered = pauseSession(prior);
  assert.equal(covered.phase, "paused");
  assert.deepEqual(covered.draft, prior.draft);
  assert.deepEqual(rejectedIds(covered), []);
  assert.equal(saveResponse(prior, "veto").draft[movies[0].id], "veto");
  const next = restartSession(covered, "limits", now);
  assert.deepEqual(next.excluded, []);
  assert.deepEqual(next.ballots, []);
});

test("confirmation rejects expired or vetoed choices using the actual confirmation time", () => {
  const prior = session({ phase: "confirm", chosen: movies[0].id, voter: 2, ballots: [complete(), complete()] });
  assert.equal(confirmDecision(prior, now).phase, "done");
  assert.equal(confirmDecision(prior, Date.parse(prior.limits.deadline)), prior);
  const vetoed = { ...prior, ballots: [complete("veto"), complete()] };
  assert.equal(confirmDecision(vetoed, now), vetoed);
  const done = confirmDecision(prior, now);
  assert.ok(parseSession(done));
  done.limits.services.push(337);
  assert.deepEqual(freshSession(now).limits.services, [8, 9]);
});
