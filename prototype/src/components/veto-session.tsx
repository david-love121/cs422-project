"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowRight,
  Check,
  Clock3,
  EyeOff,
  Film,
  LockKeyhole,
  Plus,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { DEMO_LANGUAGES, DEMO_MOVIES, DEMO_PROVIDERS } from "@/lib/demo";
import { imageUrl, type Movie } from "@/lib/tmdb";
import {
  defaultLimits,
  eligibility,
  remainingMinutes,
  RESPONSE_OPTIONS,
  tally,
  type Ballot,
  type Candidate,
  type Limits,
  type Response,
} from "@/lib/veto";
import "@/app/veto.css";

const SESSION_KEY = "veto-session-v1";
type Phase =
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
type Session = {
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
function freshSession(): Session {
  return {
    version: 1,
    phase: "setup",
    limits: defaultLimits(),
    names: [
      "Viewer 1",
      "Viewer 2",
      "Viewer 3",
      "Viewer 4",
      "Viewer 5",
      "Viewer 6",
    ],
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
function readSession(value: string | null): Session | null {
  if (!value) return null;
  try {
    const s = JSON.parse(value) as Session;
    const phases: Phase[] = [
      "setup",
      "suggest",
      "handoff",
      "vote",
      "review",
      "choose",
      "confirm",
      "done",
      "paused",
      "stopped",
    ];
    if (
      s.version !== 1 ||
      !["vote", "review"].includes(s.resume) ||
      !phases.includes(s.phase) ||
      !s.limits ||
      !Number.isInteger(s.limits.viewers) ||
      s.limits.viewers < 2 ||
      s.limits.viewers > 6 ||
      !Number.isFinite(Date.parse(s.limits.deadline)) ||
      !Array.isArray(s.limits.services) ||
      !Array.isArray(s.limits.audioLanguages) ||
      !Array.isArray(s.names) ||
      s.names.length !== 6 ||
      !s.names.every((n) => typeof n === "string") ||
      !Array.isArray(s.candidates) ||
      s.candidates.length > 6 ||
      !Array.isArray(s.ballots) ||
      !Array.isArray(s.excluded) ||
      !s.draft ||
      !Number.isInteger(s.voter) ||
      s.voter < 0 ||
      s.voter > s.limits.viewers ||
      !Number.isInteger(s.nomination) ||
      s.nomination < 0 ||
      s.nomination > s.limits.viewers ||
      !Number.isInteger(s.index) ||
      s.index < 0 ||
      s.index > 5
    )
      return null;
    if (
      !s.candidates.every(
        (c) =>
          c.movie &&
          Number.isInteger(c.movie.id) &&
          typeof c.movie.title === "string" &&
          typeof c.movie.overview === "string" &&
          typeof c.audio === "string" &&
          typeof c.accessConfirmed === "boolean",
      )
    )
      return null;
    if (
      new Set(s.candidates.map((c) => c.movie.id)).size !== s.candidates.length
    )
      return null;
    const validBallot = (b: Ballot) =>
      b &&
      typeof b === "object" &&
      Object.values(b).every((v) =>
        RESPONSE_OPTIONS.some((r) => r.value === v),
      ) &&
      Object.values(b).filter((v) => v === "veto").length <= 1;
    if (
      !validBallot(s.draft) ||
      !s.ballots.every(validBallot) ||
      s.ballots.length !== s.voter
    )
      return null;
    if (
      ["handoff", "vote", "review", "choose", "confirm", "done"].includes(
        s.phase,
      ) &&
      (!s.candidates.length || s.index >= s.candidates.length)
    )
      return null;
    if (
      ["choose", "confirm", "done"].includes(s.phase) &&
      s.ballots.length !== s.limits.viewers
    )
      return null;
    if (s.phase === "vote" || s.phase === "review")
      return { ...s, resume: s.phase, phase: "handoff" };
    return s;
  } catch {
    return null;
  }
}
const serviceName = (id: number) =>
  DEMO_PROVIDERS.find((p) => p.provider_id === id)?.provider_name ||
  "Selected service";
const languageName = (code: string) =>
  code === "ta"
    ? "Tamil"
    : DEMO_LANGUAGES.find((l) => l.iso_639_1 === code)?.english_name || code;
const LANGUAGES = [
  ...DEMO_LANGUAGES,
  { iso_639_1: "ta", english_name: "Tamil", name: "Tamil" },
];
const time = (value: number | string) =>
  new Date(value).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
const localDateTime = (value: string) => {
  const d = new Date(value);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
};

function AccessDialog({
  children,
  onClose,
}: {
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog?.close();
      document.body.style.overflow = previous;
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby="v-access-title"
      className="v-access-dialog"
      onCancel={onClose}
    >
      {children}
    </dialog>
  );
}
function MovieArtwork({ movie }: { movie: Movie }) {
  const [failed, setFailed] = useState(false);
  const src = imageUrl(movie.poster_path);
  return (
    <div className="v-artwork">
      {src && !failed ? (
        <img
          src={src}
          alt={`${movie.title} poster`}
          onError={() => setFailed(true)}
        />
      ) : (
        <Film size={30} />
      )}
    </div>
  );
}
function CandidateInfo({ candidate }: { candidate: Candidate }) {
  return (
    <div className="v-meta">
      <span>{candidate.movie.runtime} min</span>
      <span>{serviceName(candidate.source)}</span>
      <span>{languageName(candidate.audio)} audio</span>
      <span>
        {candidate.subtitles
          ? "English subtitles confirmed"
          : "Subtitles not required / not confirmed"}
      </span>
      <span>No extra charge · checked by group</span>
    </div>
  );
}

export default function VetoSession({
  saved,
  onExplore,
}: {
  saved: Movie[];
  onExplore: () => void;
}) {
  const [s, setSession] = useState<Session | null>(null);
  const [now, setNow] = useState(0);
  const [storageNote, setStorageNote] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [movie, setMovie] = useState<Movie | null>(null);
  const [source, setSource] = useState(8);
  const [audio, setAudio] = useState("en");
  const [subtitles, setSubtitles] = useState(false);
  const [access, setAccess] = useState(false);
  const [runtime, setRuntime] = useState("");
  const [choice, setChoice] = useState<Response | null>(null);
  const [conflict, setConflict] = useState(false);
  const [restart, setRestart] = useState<"another" | "limits" | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      let restored: Session | null = null;
      try {
        restored = readSession(sessionStorage.getItem(SESSION_KEY));
      } catch {
        setStorageNote(
          "This browser cannot save the round. Stay in Decide together; switching views or reloading will lose it.",
        );
      }
      setSession(restored || freshSession());
      setNow(Date.now());
    }, 0);
    const clock = setInterval(() => setNow(Date.now()), 15_000);
    return () => {
      clearTimeout(timer);
      clearInterval(clock);
    };
  }, []);
  useEffect(() => {
    if (!s) return;
    let warning: ReturnType<typeof setTimeout> | undefined;
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
    } catch {
      warning = setTimeout(
        () =>
          setStorageNote(
            "This round cannot be saved. Stay in Decide together; switching views or reloading will lose it.",
          ),
        0,
      );
    }
    return () => clearTimeout(warning);
  }, [s]);
  const activePhase = s?.phase;
  useEffect(() => {
    headingRef.current?.focus();
  }, [activePhase]); // Move focus only when the task changes.

  if (!s)
    return (
      <div className="v-loading" role="status">
        Preparing your evening…
      </div>
    );
  const update = (patch: Partial<Session>) => {
    setSession({ ...s, ...patch });
    setNotice("");
  };
  const name = (index: number) =>
    s.names[index]?.trim() || `Viewer ${index + 1}`;
  const windowMinutes = remainingMinutes(s.limits.deadline, now);
  const current = s.candidates[s.index];
  const selected = s.candidates.find((c) => c.movie.id === s.chosen);
  const results = tally(s.candidates, s.ballots);
  const eligible = s.candidates.every(
    (c) => eligibility(c, s.limits, now).length === 0,
  );
  const nominating = s.nomination < s.limits.viewers;
  const stage =
    s.phase === "setup"
      ? 0
      : s.phase === "suggest"
        ? 1
        : ["handoff", "vote", "review", "paused"].includes(s.phase)
          ? 2
          : 3;
  const stageTitle: Record<Phase, string> = {
    setup: "A shared choice.",
    suggest: nominating
      ? `${name(s.nomination)}, add your suggestion.`
      : "Your shared shortlist.",
    handoff:
      s.voter < s.limits.viewers
        ? `Pass the device to ${name(s.voter)}.`
        : "Bring the group back together.",
    vote: `${name(s.voter)}, what do you think?`,
    review: "Review your responses.",
    choose: results.every((r) => r.eliminated)
      ? "No movie survived this round."
      : "A shared choice starts here.",
    confirm: "One last check, together.",
    done: "Your evening is decided.",
    paused: "The round is paused.",
    stopped: "That’s a wrap for tonight.",
  };
  const combined = [...saved, ...DEMO_MOVIES].filter(
    (m, i, list) => list.findIndex((x) => x.id === m.id) === i,
  );
  const available = combined.filter(
    (m) =>
      !s.candidates.some((c) => c.movie.id === m.id) &&
      !s.excluded.includes(m.id) &&
      m.title.toLowerCase().includes(search.toLowerCase()),
  );
  const proposed: Candidate | null = movie
    ? {
        movie: { ...movie, runtime: Number(runtime) },
        source,
        audio,
        subtitles,
        accessConfirmed: access,
        nominatedBy: nominating ? s.nomination : null,
      }
    : null;
  const reasons = proposed ? eligibility(proposed, s.limits, now) : [];

  function openMovie(m: Movie) {
    setMovie(m);
    setRuntime(m.runtime ? String(m.runtime) : "");
    setSource(s!.limits.services[0] || 8);
    setAudio(
      s!.limits.audioLanguages.includes(m.original_language)
        ? m.original_language
        : s!.limits.audioLanguages[0],
    );
    setSubtitles(false);
    setAccess(false);
    setNotice("");
  }
  function addCandidate() {
    if (
      !proposed ||
      eligibility(proposed, s!.limits).length ||
      s!.candidates.length >= 6
    )
      return;
    update({
      candidates: [...s!.candidates, proposed],
      nomination: nominating ? s!.nomination + 1 : s!.nomination,
    });
    setMovie(null);
    setNotice(`${proposed.movie.title} added. Access recorded for this round.`);
  }
  function pick(value: Response) {
    if (
      value === "veto" &&
      Object.entries(s!.draft).some(
        ([id, response]) =>
          Number(id) !== current.movie.id && response === "veto",
      )
    ) {
      setChoice(null);
      setConflict(true);
      return;
    }
    setChoice(value);
    setConflict(false);
  }
  function saveResponse() {
    if (!choice || !current) return;
    if (
      choice === "veto" &&
      Object.entries(s!.draft).some(
        ([id, response]) =>
          Number(id) !== current.movie.id && response === "veto",
      )
    ) {
      setChoice(null);
      setConflict(true);
      return;
    }
    update({
      draft: { ...s!.draft, [current.movie.id]: choice },
      index: s!.index < s!.candidates.length - 1 ? s!.index + 1 : s!.index,
      phase: s!.index < s!.candidates.length - 1 ? "vote" : "review",
    });
    setChoice(null);
    setConflict(false);
    setNotice("Response saved to your turn.");
  }
  function beginFresh() {
    const reset = freshSession();
    setSession({
      ...reset,
      limits: s!.limits,
      names: s!.names,
      excluded: [
        ...new Set([...s!.excluded, ...s!.candidates.map((c) => c.movie.id)]),
      ],
      phase: restart === "limits" ? "setup" : "suggest",
    });
    setRestart(null);
    setMovie(null);
    setSearch("");
    setChoice(null);
    setConflict(false);
    setNotice("Fresh round started. Previous titles stay excluded.");
  }
  function startEvening() {
    setSession(freshSession());
    setMovie(null);
    setSearch("");
    setChoice(null);
    setAccess(false);
    setNotice("");
    setConflict(false);
    setRestart(null);
  }
  function pause() {
    update({
      phase: "paused",
      resume: s!.phase === "review" ? "review" : "vote",
    });
    setChoice(null);
    setConflict(false);
  }
  function startVoting() {
    if (
      !s!.candidates.length ||
      s!.candidates.some((c) => eligibility(c, s!.limits).length)
    ) {
      setNotice(
        "The viewing window has changed. Review the shortlist or shared limits.",
      );
      return;
    }
    update({
      phase: "handoff",
      voter: 0,
      index: 0,
      draft: {},
      ballots: [],
      resume: "vote",
    });
  }
  function confirmChoice(confirmedAt: number) {
    if (
      !selected ||
      eligibility(selected, s!.limits).length ||
      results.find((r) => r.candidate.movie.id === selected.movie.id)
        ?.eliminated
    ) {
      setNotice(
        "This movie no longer meets the shared limits. Return to results and choose a shorter option.",
      );
      setNow(confirmedAt);
      return;
    }
    update({ phase: "done", confirmedAt });
  }

  return (
    <section className="v-session" aria-label="Veto shared movie decision">
      <div className="v-topline">
        <span className="v-device">
          <Users size={14} /> One shared device · 2–6 viewers
        </span>
      </div>
      <ol className="v-stages" aria-label="Decision progress">
        {["Setup", "Suggest", "Vote", "Choose"].map((label, i) => (
          <li
            key={label}
            aria-current={i === stage ? "step" : undefined}
            className={i <= stage ? "is-active" : ""}
          >
            <span>{i < stage ? <Check size={14} /> : `0${i + 1}`}</span>
            {label}
          </li>
        ))}
      </ol>
      <header className="v-intro">
        <div>
          <h1 ref={headingRef} tabIndex={-1}>
            {stageTitle[s.phase]}
          </h1>
          <p>
            {s.phase === "setup"
              ? "Set the limits. Suggest a film. Decide together."
              : s.phase === "suggest"
                ? "Everyone gets a suggestion. Only movies that fit your agreed limits enter the round."
                : ["vote", "review"].includes(s.phase)
                  ? "Your responses stay covered when you finish. You can correct them before submitting."
                  : s.phase === "choose"
                    ? "A veto removes a film. The remaining options are yours to choose together."
                    : "A little clarity makes room for a better evening."}
          </p>
        </div>
        {s.phase !== "setup" && (
          <div className="v-time-chip">
            <Clock3 size={17} />
            <span>
              <strong>{windowMinutes} min</strong> remaining
              <br />
              End by {time(s.limits.deadline)}
            </span>
          </div>
        )}
      </header>
      {storageNote && (
        <p className="v-alert" role="status">
          {storageNote}
        </p>
      )}
      {notice && (
        <p className="v-notice" role="status">
          {notice}
        </p>
      )}

      {restart ? (
        <div
          className="v-panel v-recovery"
          role="region"
          aria-label="Fresh round agreement"
        >
          <p className="v-kicker">AGREE BEFORE STARTING AGAIN</p>
          <h2>
            {restart === "limits"
              ? "Review limits in a fresh round?"
              : "Try another set?"}
          </h2>
          <div className="v-recovery-grid">
            <div>
              <strong>Keep</strong>
              <p>
                Viewers, deadline, services, audio, subtitles, and previously
                considered titles.
              </p>
            </div>
            <div>
              <strong>Reset</strong>
              <p>
                All candidates and responses. Everyone gets a new turn and one
                veto.
              </p>
            </div>
            <div>
              <strong>Recheck</strong>
              <p>Remaining time and access for every new movie.</p>
            </div>
          </div>
          <p>
            Only continue when the group agrees. Existing ballots will be
            cleared.
          </p>
          <div className="v-actions">
            <button className="v-primary" onClick={beginFresh}>
              Agree to a fresh round <ArrowRight size={16} />
            </button>
            <button className="v-secondary" onClick={() => setRestart(null)}>
              Keep this round
            </button>
          </div>
        </div>
      ) : (
        <>
          {s.phase === "setup" && (
            <div className="v-grid v-setup-grid">
              <form
                className="v-panel v-setup"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (
                    windowMinutes > 0 &&
                    s.limits.services.length &&
                    s.limits.audioLanguages.length
                  )
                    update({ phase: "suggest" });
                  else
                    setNotice(
                      "Choose a future end time, at least one service, and an audio language.",
                    );
                }}
              >
                <div className="v-section-title">
                  <span>01</span>
                  <div>
                    <h2>Who’s watching?</h2>
                  </div>
                </div>
                <label className="v-field">
                  Number of viewers
                  <select
                    value={s.limits.viewers}
                    onChange={(e) =>
                      update({
                        limits: {
                          ...s.limits,
                          viewers: Number(e.target.value),
                        },
                      })
                    }
                  >
                    {[2, 3, 4, 5, 6].map((n) => (
                      <option key={n} value={n}>
                        {n} viewers
                      </option>
                    ))}
                  </select>
                </label>
                <div className="v-name-fields">
                  {s.names.slice(0, s.limits.viewers).map((n, i) => (
                    <label className="v-field" key={i}>
                      Viewer {i + 1}
                      <input
                        aria-label={`Viewer ${i + 1} name`}
                        maxLength={30}
                        value={n}
                        onChange={(e) =>
                          update({
                            names: s.names.map((old, j) =>
                              j === i ? e.target.value : old,
                            ),
                          })
                        }
                      />
                    </label>
                  ))}
                </div>
                <div className="v-divider" />
                <div className="v-section-title">
                  <span>02</span>
                  <div>
                    <h2>The evening</h2>
                  </div>
                </div>
                <label className="v-field">
                  Movie must end by
                  <input
                    type="datetime-local"
                    required
                    value={localDateTime(s.limits.deadline)}
                    onChange={(e) => {
                      const date = new Date(e.target.value);
                      if (Number.isFinite(date.getTime()))
                        update({
                          limits: { ...s.limits, deadline: date.toISOString() },
                        });
                    }}
                  />
                </label>
                <p className="v-hint">
                  Now {time(now)} · {windowMinutes} minutes available for the
                  film.
                </p>
                <fieldset className="v-fieldset">
                  <legend>Streaming services you can use</legend>
                  <div className="v-chips">
                    {DEMO_PROVIDERS.map((p) => (
                      <button
                        key={p.provider_id}
                        type="button"
                        aria-pressed={s.limits.services.includes(p.provider_id)}
                        onClick={() =>
                          update({
                            limits: {
                              ...s.limits,
                              services: s.limits.services.includes(
                                p.provider_id,
                              )
                                ? s.limits.services.filter(
                                    (id) => id !== p.provider_id,
                                  )
                                : [...s.limits.services, p.provider_id],
                            },
                          })
                        }
                      >
                        {s.limits.services.includes(p.provider_id) && (
                          <Check size={13} />
                        )}
                        {p.provider_name}
                      </button>
                    ))}
                  </div>
                </fieldset>
                <fieldset className="v-fieldset">
                  <legend>Audio languages everyone accepts</legend>
                  <div className="v-chips">
                    {LANGUAGES.map((l) => (
                      <button
                        key={l.iso_639_1}
                        type="button"
                        aria-pressed={s.limits.audioLanguages.includes(
                          l.iso_639_1,
                        )}
                        onClick={() =>
                          update({
                            limits: {
                              ...s.limits,
                              audioLanguages: s.limits.audioLanguages.includes(
                                l.iso_639_1,
                              )
                                ? s.limits.audioLanguages.filter(
                                    (code) => code !== l.iso_639_1,
                                  )
                                : [...s.limits.audioLanguages, l.iso_639_1],
                            },
                          })
                        }
                      >
                        {s.limits.audioLanguages.includes(l.iso_639_1) && (
                          <Check size={13} />
                        )}
                        {l.english_name}
                      </button>
                    ))}
                  </div>
                </fieldset>
                <label className="v-check">
                  <input
                    type="checkbox"
                    checked={s.limits.subtitles}
                    onChange={(e) =>
                      update({
                        limits: { ...s.limits, subtitles: e.target.checked },
                      })
                    }
                  />
                  <span>Require English subtitles for every movie</span>
                </label>
                <p className="v-hint v-setup-privacy">
                  <LockKeyhole size={13} /> Private turns; final counts may
                  reveal preferences.
                </p>
                <div className="v-actions">
                  <button type="submit" className="v-primary">
                    Continue to suggestions <ArrowRight size={17} />
                  </button>
                </div>
              </form>
            </div>
          )}

          {s.phase === "suggest" && (
            <div className="v-grid">
              <div className="v-panel">
                <div className="v-section-title">
                  <span>
                    {nominating ? (
                      String(s.nomination + 1).padStart(2, "0")
                    ) : (
                      <Plus size={17} />
                    )}
                  </span>
                  <div>
                    <h2>
                      {nominating
                        ? `Suggestion ${s.nomination + 1} of ${s.limits.viewers}`
                        : "Add a few more options"}
                    </h2>
                    <p>
                      {nominating
                        ? "Choose one movie, or explicitly skip your suggestion."
                        : "Up to six distinct movies. A smaller set is fine."}
                    </p>
                  </div>
                </div>
                {s.candidates.length < 6 && (
                  <>
                    <label className="v-field">
                      Find a movie
                      <input
                        type="search"
                        placeholder="Search the collection or your saved ideas"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </label>
                    <div className="v-catalog">
                      {available.map((m) => (
                        <button
                          key={m.id}
                          className="v-catalog-row"
                          onClick={() => openMovie(m)}
                        >
                          <span className="v-mini-poster">
                            {m.poster_path ? (
                              <img
                                src={imageUrl(m.poster_path)}
                                alt=""
                                loading="lazy"
                              />
                            ) : (
                              <Film size={15} />
                            )}
                          </span>
                          <span>
                            <strong>{m.title}</strong>
                            <small>
                              {m.release_date?.slice(0, 4)} ·{" "}
                              {m.runtime
                                ? `${m.runtime} min`
                                : "Runtime needs checking"}
                              {saved.some((x) => x.id === m.id)
                                ? " · Saved idea"
                                : ""}
                            </small>
                          </span>
                          <Plus size={17} />
                        </button>
                      ))}
                    </div>
                    {!available.length && (
                      <p className="v-hint">
                        No more movies match. Browse live TMDB and save another
                        idea, review the limits, or stop for tonight.
                      </p>
                    )}
                    <p className="v-hint">
                      Real film metadata from a local snapshot. Service, audio,
                      and subtitle access must be checked by your group.
                    </p>
                  </>
                )}
                {nominating ? (
                  <div className="v-actions">
                    <button
                      className="v-secondary"
                      onClick={() => {
                        update({ nomination: s.nomination + 1 });
                        setMovie(null);
                      }}
                    >
                      Skip my suggestion
                    </button>
                  </div>
                ) : (
                  <div className="v-actions">
                    <button
                      className="v-primary"
                      disabled={!s.candidates.length || !eligible}
                      onClick={startVoting}
                    >
                      Start private voting <ArrowRight size={16} />
                    </button>
                    <button className="v-text" onClick={onExplore}>
                      Explore more movies
                    </button>
                  </div>
                )}
                {!nominating && !s.candidates.length && (
                  <div className="v-alert">
                    <strong>No eligible titles yet.</strong>
                    <p>
                      Add and verify a movie that fits, review shared limits, or
                      stop for tonight. Your limits have not been relaxed.
                    </p>
                  </div>
                )}
                <div className="v-actions">
                  <button
                    className="v-text"
                    onClick={() => setRestart("limits")}
                  >
                    Review shared limits
                  </button>
                  <button
                    className="v-text"
                    onClick={() => update({ phase: "stopped" })}
                  >
                    Stop for tonight
                  </button>
                </div>
              </div>
              <aside className="v-panel v-shortlist">
                <div className="v-label-row">
                  <h2>Tonight’s shortlist</h2>
                  <span>{s.candidates.length} / 6</span>
                </div>
                <p className="v-hint">
                  End by {time(s.limits.deadline)} · {windowMinutes} min
                  remaining
                </p>
                {!s.candidates.length && (
                  <div className="v-empty">
                    <Film size={29} />
                    <p>
                      Your first suggestion
                      <br />
                      starts the conversation.
                    </p>
                  </div>
                )}
                {s.candidates.map((c) => (
                  <div className="v-shortlist-item" key={c.movie.id}>
                    <div className="v-label-row">
                      <strong>{c.movie.title}</strong>
                      <button
                        className="v-icon"
                        aria-label={`Remove ${c.movie.title} from round`}
                        onClick={() =>
                          update({
                            candidates: s.candidates.filter(
                              (x) => x.movie.id !== c.movie.id,
                            ),
                            nomination: s.nomination,
                          })
                        }
                      >
                        <X size={15} />
                      </button>
                    </div>
                    <small>
                      {c.nominatedBy === null
                        ? "Veto-added choice"
                        : `${name(c.nominatedBy)}’s suggestion`}
                    </small>
                    <CandidateInfo candidate={c} />
                    {eligibility(c, s.limits, now).map((reason) => (
                      <p className="v-error" key={reason}>
                        {reason}
                      </p>
                    ))}
                  </div>
                ))}
                <div className="v-privacy-note">
                  <EyeOff size={16} />
                  <p>
                    Next: private turns.
                    <br />
                    <span>
                      Each viewer responds to the same set. Changing the set
                      after voting begins requires a fresh round.
                    </span>
                  </p>
                </div>
              </aside>
            </div>
          )}

          {s.phase === "handoff" && (
            <div className="v-panel v-cover">
              <div className="v-cover-icon">
                <EyeOff size={34} />
              </div>
              <p className="v-kicker">RESPONSES COVERED</p>
              <h2>
                {s.voter < s.limits.viewers
                  ? `Ready, ${name(s.voter)}?`
                  : "Everyone has finished."}
              </h2>
              <p>
                {s.voter < s.limits.viewers
                  ? `${s.voter} of ${s.limits.viewers} turns complete. Only begin when you have the device.`
                  : "Individual answers stay covered. View the totals together and make your own choice."}
              </p>
              <p className="v-hint">
                Private on screen, not anonymous. Group totals can allow others
                to infer a response.
              </p>
              <button
                className="v-primary"
                onClick={() => {
                  update({
                    phase: s.voter < s.limits.viewers ? s.resume : "choose",
                  });
                  setChoice(null);
                }}
              >
                {s.voter < s.limits.viewers
                  ? "I’m ready — begin my turn"
                  : "Show group results"}
                <ArrowRight size={17} />
              </button>
            </div>
          )}

          {s.phase === "vote" && current && (
            <div className="v-ballot">
              <div className="v-label-row">
                <span className="v-kicker">
                  MOVIE {s.index + 1} OF {s.candidates.length}
                </span>
                <span className="v-allowance">
                  {1 -
                    Object.values(s.draft).filter((v) => v === "veto")
                      .length}{" "}
                  veto remaining
                </span>
              </div>
              <div className="v-panel v-vote-movie">
                <MovieArtwork key={current.movie.id} movie={current.movie} />
                <div>
                  <p className="v-kicker">
                    {current.movie.release_date?.slice(0, 4)} ·{" "}
                    {current.movie.runtime} MINUTES
                  </p>
                  <h2>{current.movie.title}</h2>
                  <p>{current.movie.overview}</p>
                  <CandidateInfo candidate={current} />
                </div>
              </div>
              <div
                className="v-responses"
                role="group"
                aria-label="Your response"
              >
                {RESPONSE_OPTIONS.map((r) => (
                  <button
                    key={r.value}
                    className={`v-response ${r.value === "veto" ? "v-veto" : ""}`}
                    aria-pressed={
                      !conflict &&
                      (choice || s.draft[current.movie.id]) === r.value
                    }
                    onClick={() => pick(r.value)}
                  >
                    <span className="v-radio">
                      {(choice || s.draft[current.movie.id]) === r.value && (
                        <Check size={14} />
                      )}
                    </span>
                    <strong>{r.label}</strong>
                    <small>{r.description}</small>
                  </button>
                ))}
              </div>
              {conflict && (
                <div className="v-alert" role="alert">
                  <strong>Your one active veto is already saved.</strong>
                  <p>
                    Correct an accidental veto in review. If both objections are
                    genuine, pause the round; you do not need to claim
                    willingness.
                  </p>
                  <div className="v-actions">
                    <button
                      className="v-secondary"
                      onClick={() => {
                        update({ phase: "review" });
                        setChoice(null);
                        setConflict(false);
                      }}
                    >
                      Review existing veto
                    </button>
                    <button className="v-secondary" onClick={pause}>
                      Pause this round
                    </button>
                  </div>
                </div>
              )}
              <div className="v-ballot-footer">
                <p className="v-hint">
                  {choice
                    ? "Selected — not saved yet."
                    : s.draft[current.movie.id]
                      ? "Saved. Select a response to change it."
                      : "Choose a response, then save it."}
                </p>
                <button
                  className="v-primary"
                  disabled={!choice || conflict}
                  onClick={saveResponse}
                >
                  Save &amp; next <ArrowRight size={16} />
                </button>
              </div>
              <div className="v-actions">
                <button
                  className="v-text"
                  onClick={() => {
                    update({ phase: "review" });
                    setChoice(null);
                  }}
                >
                  Review saved responses
                </button>
                <button className="v-text" onClick={pause}>
                  Pause this round
                </button>
              </div>
            </div>
          )}

          {s.phase === "review" && (
            <div className="v-panel v-ballot">
              <p className="v-hint">
                Saved for this turn · {Object.keys(s.draft).length} of{" "}
                {s.candidates.length} answered ·{" "}
                {1 - Object.values(s.draft).filter((v) => v === "veto").length}{" "}
                veto remaining
              </p>
              {s.candidates.map((c, i) => (
                <div className="v-review-row" key={c.movie.id}>
                  <div>
                    <strong>{c.movie.title}</strong>
                    <span>
                      {RESPONSE_OPTIONS.find(
                        (r) => r.value === s.draft[c.movie.id],
                      )?.label || "Not answered"}
                    </span>
                  </div>
                  <button
                    className="v-secondary"
                    onClick={() => {
                      update({ phase: "vote", index: i });
                      setChoice(null);
                    }}
                  >
                    Edit <span className="sr-only">{c.movie.title}</span>
                  </button>
                </div>
              ))}
              <p className="v-hint">
                Changing a saved veto to another response restores your
                allowance. Finish submits the complete ballot and covers it
                before handoff.
              </p>
              <div className="v-actions">
                <button
                  className="v-primary"
                  disabled={s.candidates.some((c) => !s.draft[c.movie.id])}
                  onClick={() => {
                    update({
                      ballots: [...s.ballots, { ...s.draft }],
                      draft: {},
                      voter: s.voter + 1,
                      index: 0,
                      phase: "handoff",
                      resume: "vote",
                    });
                    setChoice(null);
                  }}
                >
                  Finish my turn <Check size={16} />
                </button>
                <button className="v-text" onClick={pause}>
                  Pause this round
                </button>
              </div>
            </div>
          )}

          {s.phase === "choose" && (
            <>
              <div className="v-results-note">
                <ShieldCheck size={20} />
                <p>
                  <strong>{s.ballots.length} completed ballots.</strong> Every
                  row shows all four totals. A surviving title is an option; the
                  group decides. Order follows your shortlist.
                </p>
              </div>
              <div className="v-results">
                {results.map(({ candidate: c, counts, eliminated }) => (
                  <article
                    className={`v-panel v-result ${eliminated ? "is-eliminated" : ""}`}
                    key={c.movie.id}
                  >
                    <div className="v-result-title">
                      <h2>{c.movie.title}</h2>
                      <span
                        className={`v-status ${eliminated ? "v-status-no" : ""}`}
                      >
                        {eliminated ? "Eliminated" : "Available — no vetoes"}
                      </span>
                    </div>
                    <CandidateInfo candidate={c} />
                    <div className="v-counts">
                      {RESPONSE_OPTIONS.map((r) => (
                        <div key={r.value}>
                          <strong>{counts[r.value]}</strong>
                          <span>{r.label}</span>
                        </div>
                      ))}
                    </div>
                    {!eliminated && (
                      <>
                        {eligibility(c, s.limits, now).map((reason) => (
                          <p className="v-error" key={reason}>
                            {reason}
                          </p>
                        ))}
                        <button
                          className="v-secondary"
                          disabled={eligibility(c, s.limits, now).length > 0}
                          onClick={() => {
                            setNow(Date.now());
                            setAccess(false);
                            update({ chosen: c.movie.id, phase: "confirm" });
                          }}
                        >
                          Choose {c.movie.title} <ArrowRight size={15} />
                        </button>
                      </>
                    )}
                  </article>
                ))}
              </div>
              {results.every((r) => r.eliminated) && (
                <p className="v-alert">
                  Every title received a firm objection. Enthusiasm never
                  overrides a veto. Try another set, review limits by agreement,
                  or stop.
                </p>
              )}
              <div className="v-actions">
                <button
                  className="v-secondary"
                  onClick={() => setRestart("another")}
                >
                  Try another set
                </button>
                <button className="v-text" onClick={() => setRestart("limits")}>
                  Review shared limits
                </button>
                <button
                  className="v-text"
                  onClick={() => update({ phase: "stopped" })}
                >
                  Stop for tonight
                </button>
              </div>
            </>
          )}

          {(s.phase === "confirm" || s.phase === "done") && selected && (
            <div className="v-panel v-confirm">
              <MovieArtwork movie={selected.movie} />
              <div>
                <p className="v-kicker">
                  {s.phase === "done"
                    ? "CONFIRMED BY THE GROUP"
                    : "SELECTED BY THE GROUP"}
                </p>
                <h2>{selected.movie.title}</h2>
                <p>{selected.movie.overview}</p>
                <CandidateInfo candidate={selected} />
                <dl className="v-timing">
                  <div>
                    <dt>
                      {s.phase === "done" ? "Recorded start" : "Start now"}
                    </dt>
                    <dd>{time(s.confirmedAt || now)}</dd>
                  </div>
                  <div>
                    <dt>Estimated film end</dt>
                    <dd>
                      {time(
                        (s.confirmedAt || now) +
                          selected.movie.runtime! * 60_000,
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>Movie must end by</dt>
                    <dd>{time(s.limits.deadline)}</dd>
                  </div>
                </dl>
                {s.phase === "confirm" ? (
                  <>
                    {eligibility(selected, s.limits, now).map((reason) => (
                      <p className="v-error" key={reason}>
                        {reason}
                      </p>
                    ))}
                    <label className="v-check">
                      <input
                        type="checkbox"
                        checked={access}
                        onChange={(e) => setAccess(e.target.checked)}
                      />
                      <span>
                        We rechecked this service, audio, subtitles, and no
                        extra charge.
                      </span>
                    </label>
                    <div className="v-actions">
                      <button
                        className="v-primary"
                        disabled={
                          !access ||
                          eligibility(selected, s.limits, now).length > 0
                        }
                        onClick={() => confirmChoice(Date.now())}
                      >
                        Confirm our choice <Check size={17} />
                      </button>
                      <button
                        className="v-text"
                        onClick={() =>
                          update({ phase: "choose", chosen: null })
                        }
                      >
                        Back to results
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="v-notice">
                      Decision recorded. Open {serviceName(selected.source)}{" "}
                      yourselves to start watching. If you start later, recheck
                      the finish time.
                    </p>
                    <button className="v-secondary" onClick={startEvening}>
                      Plan another evening
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {s.phase === "paused" && (
            <div className="v-panel v-cover">
              <div className="v-cover-icon">
                <EyeOff size={34} />
              </div>
              <h2>Take a moment, together.</h2>
              <p>
                Responses are covered and retained. The movie and reason for
                pausing are not shown. A fresh round clears every ballot only
                after the group agrees.
              </p>
              <div className="v-actions">
                <button
                  className="v-primary"
                  onClick={() => update({ phase: "handoff" })}
                >
                  Resume private turn
                </button>
                <button
                  className="v-secondary"
                  onClick={() => setRestart("another")}
                >
                  Try another set
                </button>
                <button className="v-text" onClick={() => setRestart("limits")}>
                  Review shared limits
                </button>
                <button
                  className="v-text"
                  onClick={() => update({ phase: "stopped" })}
                >
                  Stop for tonight
                </button>
              </div>
            </div>
          )}
          {s.phase === "stopped" && (
            <div className="v-panel v-cover">
              <div className="v-cover-icon">
                <Film size={32} />
              </div>
              <h2>Time together is the point.</h2>
              <p>
                You can leave the choice for another evening. No one needs to
                withdraw a firm objection.
              </p>
              <button className="v-primary" onClick={startEvening}>
                Plan another evening <ArrowRight size={17} />
              </button>
            </div>
          )}
        </>
      )}

      {s.phase === "suggest" && movie && (
        <AccessDialog onClose={() => setMovie(null)}>
          <button
            className="v-icon v-dialog-close"
            onClick={() => setMovie(null)}
            aria-label="Close access check"
          >
            <X size={20} />
          </button>
          <p className="v-kicker">CHECK BEFORE ADDING</p>
          <h2 id="v-access-title">{movie.title}</h2>
          <p>{movie.overview}</p>
          <a
            className="v-text"
            href={`https://www.themoviedb.org/movie/${movie.id}`}
            target="_blank"
            rel="noreferrer"
          >
            View movie information ↗
          </a>
          <div className="v-form-row">
            <label className="v-field">
              Runtime in minutes
              <input
                type="number"
                min="1"
                max="600"
                value={runtime}
                onChange={(e) => setRuntime(e.target.value)}
              />
            </label>
            <label className="v-field">
              Confirmed service
              <select
                value={source}
                onChange={(e) => setSource(Number(e.target.value))}
              >
                {s.limits.services.map((id) => (
                  <option value={id} key={id}>
                    {serviceName(id)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="v-field">
            Confirmed audio
            <select value={audio} onChange={(e) => setAudio(e.target.value)}>
              {s.limits.audioLanguages.map((code) => (
                <option key={code} value={code}>
                  {languageName(code)}
                </option>
              ))}
            </select>
          </label>
          <label className="v-check">
            <input
              type="checkbox"
              checked={subtitles}
              onChange={(e) => setSubtitles(e.target.checked)}
            />
            <span>English subtitles are available on this service</span>
          </label>
          <label className="v-check">
            <input
              type="checkbox"
              checked={access}
              onChange={(e) => setAccess(e.target.checked)}
            />
            <span>
              I checked playback access and audio on this service, including
              subtitle needs. There is no extra charge.
            </span>
          </label>
          {reasons
            .filter((r) => !r.startsWith("Confirm playback"))
            .map((reason) => (
              <p className="v-error" key={reason}>
                {reason}
              </p>
            ))}
          <p className="v-hint">
            Streaming labels in the sample catalog are illustrative. Verify on
            the actual service before confirming.
          </p>
          <button
            className="v-primary"
            disabled={reasons.length > 0}
            onClick={addCandidate}
          >
            {nominating ? "Add my suggestion" : "Add Veto choice"}
            <Plus size={16} />
          </button>
          <button className="v-text" onClick={() => setMovie(null)}>
            Back to suggestions
          </button>
        </AccessDialog>
      )}
    </section>
  );
}
