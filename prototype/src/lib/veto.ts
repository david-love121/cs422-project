import type { Movie } from "./tmdb";

export type Response = "want" | "okay" | "prefer" | "veto";

export type Limits = {
  viewers: number;
  deadline: string;
  services: number[];
  audioLanguages: string[];
  subtitles: boolean;
};

/** Access fields describe the group's own check, never inferred provider data. */
export type Candidate = {
  movie: Movie;
  source: number;
  audio: string;
  subtitles: boolean;
  accessConfirmed: boolean;
  nominatedBy: number | null;
};

export type Ballot = Record<number, Response>;

export const RESPONSE_OPTIONS: {
  value: Response;
  label: string;
  description: string;
}[] = [
  {
    value: "want",
    label: "Really Want",
    description: "I'm excited to watch this.",
  },
  { value: "okay", label: "Okay", description: "I'm willing to watch this." },
  {
    value: "prefer",
    label: "Prefer another",
    description: "I'd prefer another, but I could watch this.",
  },
  {
    value: "veto",
    label: "Veto",
    description: "I can't watch this. Remove it from this round.",
  },
];

export function remainingMinutes(deadline: string, now = Date.now()): number {
  const remaining = Date.parse(deadline) - now;
  return Number.isFinite(remaining)
    ? Math.max(0, Math.floor(remaining / 60_000))
    : 0;
}

/** An empty list means the title meets every explicitly confirmed shared limit. */
export function eligibility(
  candidate: Candidate,
  limits: Limits,
  now = Date.now(),
): string[] {
  const reasons: string[] = [];
  const deadline = Date.parse(limits.deadline);
  const runtime = candidate.movie.runtime;
  if (!Number.isFinite(deadline) || !Number.isFinite(now)) {
    reasons.push("Set a valid movie end time.");
  } else if (deadline <= now) {
    reasons.push("Tonight's movie end time has passed. Review shared limits.");
  } else if (
    typeof runtime === "number" &&
    Number.isFinite(runtime) &&
    runtime > 0 &&
    now + runtime * 60_000 > deadline
  ) {
    reasons.push(
      `${runtime} min runtime exceeds the ${remainingMinutes(limits.deadline, now)} min remaining.`,
    );
  }
  if (
    typeof runtime !== "number" ||
    !Number.isFinite(runtime) ||
    runtime <= 0
  ) {
    reasons.push("Confirm the movie's runtime before adding it.");
  }
  if (!candidate.accessConfirmed) {
    reasons.push(
      "Confirm playback access, audio, subtitles, and any extra charge on the service.",
    );
  }
  if (
    !Number.isInteger(candidate.source) ||
    !limits.services.includes(candidate.source)
  ) {
    reasons.push("Choose one of tonight's agreed streaming services.");
  }
  if (!candidate.audio || !limits.audioLanguages.includes(candidate.audio)) {
    reasons.push("Choose an audio language everyone has agreed to.");
  }
  if (limits.subtitles && !candidate.subtitles) {
    reasons.push("Required English subtitles have not been confirmed.");
  }
  return reasons;
}

/** Preserve shortlist order: response totals explain eligibility, not a ranking. */
export function tally(candidates: Candidate[], ballots: Ballot[]) {
  return candidates.map((candidate) => {
    const counts: Record<Response, number> = {
      want: 0,
      okay: 0,
      prefer: 0,
      veto: 0,
    };
    for (const ballot of ballots) {
      const response = ballot[candidate.movie.id];
      if (Object.prototype.hasOwnProperty.call(counts, response))
        counts[response] += 1;
    }
    return { candidate, counts, eliminated: counts.veto > 0 };
  });
}

export function defaultLimits(now = Date.now()): Limits {
  return {
    viewers: 3,
    deadline: new Date(now + 180 * 60_000).toISOString(),
    services: [8, 9],
    audioLanguages: ["en"],
    subtitles: false,
  };
}
