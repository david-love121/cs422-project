import { parseMovie } from "./movie";
import {
  defaultLimits,
  eligibility,
  RESPONSE_OPTIONS,
  tally,
  type Ballot,
  type Candidate,
  type Limits,
  type Response,
} from "./veto";

export const SESSION_KEY = "veto-session-v1";
export type Phase =
  | "setup"
  | "suggest"
  | "handoff"
  | "vote"
  | "review"
  | "choose"
  | "confirm"
  | "done"
  | "paused"
  | "stopped";
export type Recovery = "another" | "limits" | "reconsider";
export type Session = {
  version: 1;
  phase: Phase;
  limits: Limits;
  names: string[];
  candidates: Candidate[];
  nomination: number;
  voter: number;
  index: number;
  draft: Ballot;
  ballots: Ballot[];
  excluded: number[];
  chosen: number | null;
  confirmedAt: number | null;
  resume: "vote" | "review";
};

export function freshSession(now = Date.now()): Session {
  return {
    version: 1,
    phase: "setup",
    limits: defaultLimits(now),
    names: Array.from({ length: 6 }, (_, index) => `Viewer ${index + 1}`),
    candidates: [],
    nomination: 0,
    voter: 0,
    index: 0,
    draft: {},
    ballots: [],
    excluded: [],
    chosen: null,
    confirmedAt: null,
    resume: "vote",
  };
}

const PHASES: readonly string[] = [
  "setup", "suggest", "handoff", "vote", "review", "choose", "confirm",
  "done", "paused", "stopped",
];
const RESPONSES = new Set<string>(RESPONSE_OPTIONS.map(({ value }) => value));
const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const integer = (value: unknown, min: number, max: number): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= min && value <= max;
const movieId = (value: unknown): value is number =>
  integer(value, 1, Number.MAX_SAFE_INTEGER);
function ids(value: unknown): value is number[] {
  return Array.isArray(value) && value.every(movieId) && new Set(value).size === value.length;
}
function languages(value: unknown): value is string[] {
  return Array.isArray(value) &&
    value.every((code) => typeof code === "string" && /^[a-z]{2}$/.test(code)) &&
    new Set(value).size === value.length;
}

function validBallot(value: unknown, candidates: Candidate[], complete: boolean): value is Ballot {
  if (!object(value)) return false;
  const allowed = new Set(candidates.map(({ movie }) => String(movie.id)));
  const entries = Object.entries(value);
  return (!complete || entries.length === candidates.length) &&
    entries.every(([id, response]) => allowed.has(id) && typeof response === "string" && RESPONSES.has(response)) &&
    entries.filter(([, response]) => response === "veto").length <= 1;
}

/** Validate saved data before rendering it; storage is not a trusted Session. */
export function parseSession(value: unknown): Session | null {
  if (!object(value) || value.version !== 1 || !PHASES.includes(String(value.phase))) return null;
  const raw = value;
  const limits = raw.limits;
  if (!object(limits) ||
    !integer(limits.viewers, 2, 6) ||
    typeof limits.deadline !== "string" || !Number.isFinite(Date.parse(limits.deadline)) ||
    !ids(limits.services) || !languages(limits.audioLanguages) ||
    typeof limits.subtitles !== "boolean" ||
    !Array.isArray(raw.names) || raw.names.length !== 6 ||
    !raw.names.every((name) => typeof name === "string" && name.length <= 30) ||
    !Array.isArray(raw.candidates) || raw.candidates.length > 6 ||
    !Array.isArray(raw.ballots) || !ids(raw.excluded) ||
    !integer(raw.nomination, 0, limits.viewers) ||
    !integer(raw.voter, 0, limits.viewers) || !integer(raw.index, 0, 5) ||
    !["vote", "review"].includes(String(raw.resume))) return null;

  const candidates: Candidate[] = [];
  for (const item of raw.candidates) {
    if (!object(item)) return null;
    const movie = parseMovie(item.movie);
    if (!movie || typeof movie.runtime !== "number" || !Number.isFinite(movie.runtime) || movie.runtime <= 0 ||
      !movieId(item.source) || !limits.services.includes(item.source) ||
      typeof item.audio !== "string" || !limits.audioLanguages.includes(item.audio) ||
      typeof item.subtitles !== "boolean" || (limits.subtitles && !item.subtitles) ||
      item.accessConfirmed !== true ||
      !(item.nominatedBy === null || integer(item.nominatedBy, 0, limits.viewers - 1)) ||
      raw.excluded.includes(movie.id)) return null;
    candidates.push({ movie, source: item.source, audio: item.audio, subtitles: item.subtitles,
      accessConfirmed: true, nominatedBy: item.nominatedBy });
  }
  if (new Set(candidates.map(({ movie }) => movie.id)).size !== candidates.length ||
    !validBallot(raw.draft, candidates, false) ||
    !raw.ballots.every((ballot) => validBallot(ballot, candidates, true)) ||
    raw.ballots.length !== raw.voter) return null;

  const phase = raw.phase as Phase;
  const active = ["handoff", "vote", "review", "choose", "confirm", "done", "paused"].includes(phase);
  if (active && (!candidates.length || raw.index >= candidates.length ||
    raw.nomination !== limits.viewers || !limits.services.length || !limits.audioLanguages.length)) return null;
  if (["vote", "review", "paused"].includes(phase) && raw.voter >= limits.viewers) return null;
  if (["setup", "suggest"].includes(phase) &&
    (raw.voter !== 0 || raw.index !== 0 || Object.keys(raw.draft).length)) return null;
  if (["choose", "confirm", "done"].includes(phase) &&
    (raw.voter !== limits.viewers || Object.keys(raw.draft).length)) return null;
  if (phase === "handoff" && raw.voter === limits.viewers &&
    (Object.keys(raw.draft).length || raw.index !== 0 || raw.resume !== "vote")) return null;

  const selected = candidates.find(({ movie }) => movie.id === raw.chosen);
  if (phase === "confirm" || phase === "done") {
    if (!selected || tally(candidates, raw.ballots).find(({ candidate }) => candidate.movie.id === raw.chosen)?.eliminated) return null;
  } else if (raw.chosen !== null) return null;
  if (phase === "done") {
    if (typeof raw.confirmedAt !== "number" || !Number.isFinite(raw.confirmedAt) ||
      !Number.isFinite(new Date(raw.confirmedAt).getTime()) ||
      eligibility(selected!, limits as Limits, raw.confirmedAt).length) return null;
  } else if (raw.confirmedAt !== null) return null;

  return {
    version: 1, phase,
    limits: { viewers: limits.viewers, deadline: limits.deadline, services: [...limits.services],
      audioLanguages: [...limits.audioLanguages], subtitles: limits.subtitles },
    names: [...raw.names] as string[], candidates, nomination: raw.nomination, voter: raw.voter,
    index: raw.index, draft: { ...raw.draft }, ballots: raw.ballots.map((ballot) => ({ ...ballot })),
    excluded: [...raw.excluded], chosen: raw.chosen as number | null,
    confirmedAt: raw.confirmedAt as number | null, resume: raw.resume as "vote" | "review",
  };
}

/** Restoring any private turn first presents its handoff cover. */
export function readSession(value: string | null): Session | null {
  if (!value) return null;
  try {
    const session = parseSession(JSON.parse(value));
    if (!session) return null;
    if (session.phase === "vote" || session.phase === "review")
      return { ...session, resume: session.phase, phase: "handoff" };
    return session;
  } catch {
    return null;
  }
}

/** Only recorded objections survive a fresh round, never every considered film. */
export function rejectedIds(session: Session): number[] {
  const currentIds = new Set(session.candidates.map(({ movie }) => movie.id));
  return [...new Set([
    ...session.excluded,
    ...[...session.ballots, session.draft].flatMap((ballot) =>
      Object.entries(ballot).filter(([id, response]) => response === "veto" && currentIds.has(Number(id)))
        .map(([id]) => Number(id))),
  ])];
}

/** Every recovery is explicit: fresh nominations, assumptions, and ballots. */
export function restartSession(session: Session, recovery: Recovery, now = Date.now()): Session {
  return {
    ...freshSession(now),
    limits: { ...session.limits, services: [...session.limits.services], audioLanguages: [...session.limits.audioLanguages] },
    names: [...session.names],
    excluded: recovery === "reconsider" ? [] : rejectedIds(session),
    phase: recovery === "limits" ? "setup" : "suggest",
  };
}

export function saveResponse(session: Session, response: Response): Session {
  const current = session.candidates[session.index];
  if (session.phase !== "vote" || !current || session.voter >= session.limits.viewers ||
    !RESPONSES.has(response) ||
    (response === "veto" && Object.entries(session.draft).some(([id, value]) => Number(id) !== current.movie.id && value === "veto"))) return session;
  const next = session.index < session.candidates.length - 1;
  return { ...session, draft: { ...session.draft, [current.movie.id]: response },
    index: next ? session.index + 1 : session.index, phase: next ? "vote" : "review" };
}

export function submitTurn(session: Session): Session {
  if (session.phase !== "review" || session.voter >= session.limits.viewers ||
    !validBallot(session.draft, session.candidates, true)) return session;
  return { ...session, ballots: [...session.ballots, { ...session.draft }], draft: {},
    voter: session.voter + 1, index: 0, phase: "handoff", resume: "vote" };
}

export function startVoting(session: Session, now = Date.now()): Session {
  if (session.phase !== "suggest" || session.nomination < session.limits.viewers ||
    !session.candidates.length || session.candidates.some((candidate) => eligibility(candidate, session.limits, now).length)) return session;
  return { ...session, phase: "handoff", voter: 0, index: 0, draft: {}, ballots: [], resume: "vote" };
}

/** Cover a turn without recording any new response or revealing a reason. */
export function pauseSession(session: Session): Session {
  if (session.phase !== "vote" && session.phase !== "review") return session;
  return { ...session, phase: "paused", resume: session.phase };
}

export function confirmDecision(session: Session, now: number): Session {
  const selected = session.candidates.find(({ movie }) => movie.id === session.chosen);
  if (session.phase !== "confirm" || session.ballots.length !== session.limits.viewers ||
    !selected || eligibility(selected, session.limits, now).length ||
    tally(session.candidates, session.ballots).find(({ candidate }) => candidate.movie.id === selected.movie.id)?.eliminated) return session;
  return { ...session, phase: "done", confirmedAt: now };
}
