"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Bookmark,
  Check,
  Clock3,
  EyeOff,
  Film,
  LockKeyhole,
  Plus,
  ShieldCheck,
  X,
} from "lucide-react";
import { DEMO_LANGUAGES, DEMO_MOVIES, DEMO_PROVIDERS } from "@/lib/demo";
import { imageUrl, type Movie } from "@/lib/tmdb";
import {
  assumeCandidate,
  eligibility,
  PROTOTYPE_RUNTIME_MINUTES,
  remainingMinutes,
  RESPONSE_OPTIONS,
  tally,
  type Candidate,
  type Response,
} from "@/lib/veto";
import "@/app/veto.css";

import {
  SESSION_KEY,
  freshSession,
  readSession,
  restartSession,
  saveResponse as saveSessionResponse,
  submitTurn,
  startVoting as startSessionVoting,
  pauseSession,
  type Phase,
  type Recovery,
  type Session,
} from "@/lib/session";
import MoviePoster from "@/components/movie-poster";

const serviceName = (id: number) =>
  DEMO_PROVIDERS.find((p) => p.provider_id === id)?.provider_name ||
  "Selected service";
const languageName = (code: string) =>
  DEMO_LANGUAGES.find((l) => l.iso_639_1 === code)?.english_name || code;
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

function CandidateInfo({ candidate }: { candidate: Candidate }) {
  return (
    <div className="v-meta">
      <span>{candidate.movie.runtime} min</span>
      <span>{serviceName(candidate.source)}</span>
      <span>{languageName(candidate.audio)} audio</span>
      <span>
        {candidate.subtitles
          ? "English subtitles assumed"
          : "Subtitles not required"}
      </span>
      <span>Prototype access assumptions</span>
    </div>
  );
}

export default function VetoSession({
  saved,
  onSaveMovie,
  onOpenShortlist,
  onExplore,
  catalogMovies = DEMO_MOVIES,
  catalogNote,
  demo = false,
}: {
  saved: Movie[];
  onSaveMovie: (movie: Movie) => void;
  onOpenShortlist: () => void;
  onExplore: () => void;
  catalogMovies?: Movie[];
  catalogNote?: string;
  demo?: boolean;
}) {
  const [s, setSession] = useState<Session | null>(null);
  const [now, setNow] = useState(0);
  const [storageNote, setStorageNote] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [suggestionError, setSuggestionError] = useState("");
  const [choice, setChoice] = useState<Response | null>(null);
  const [conflict, setConflict] = useState(false);
  const [restart, setRestart] = useState<Recovery | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const movieHeadingRef = useRef<HTMLHeadingElement>(null);
  const recoveryHeadingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      let restored: Session | null = null;
      try {
        if (!demo) restored = readSession(sessionStorage.getItem(SESSION_KEY));
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
  }, [demo]);
  useEffect(() => {
    if (!s || demo) return;
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
  }, [s, demo]);
  const activePhase = s?.phase;
  const activeNomination = s?.nomination;
  const activeVoter = s?.voter;
  const activeMovie = s?.candidates[s.index]?.movie.id;
  const candidateCount = s?.candidates.length;
  useEffect(() => {
    const target = restart
      ? recoveryHeadingRef
      : activePhase === "vote"
        ? movieHeadingRef
        : headingRef;
    target.current?.focus();
  }, [activePhase, activeNomination, activeVoter, activeMovie, candidateCount, restart]);

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
  const results = tally(s.candidates, s.ballots);
  const savedIds = new Set(saved.map((movie) => movie.id));
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
      : "Your surviving movies.",
    paused: "The round is paused.",
    stopped: "That’s a wrap for tonight.",
  };
  const combined = [...saved, ...catalogMovies].filter(
    (m, i, list) => list.findIndex((x) => x.id === m.id) === i,
  );
  const available = combined.filter(
    (m) =>
      !s.candidates.some((c) => c.movie.id === m.id) &&
      !s.excluded.includes(m.id) &&
      m.title.toLowerCase().includes(search.toLowerCase()),
  );
  function addMovie(movie: Movie) {
    if (s!.phase !== "suggest" || s!.candidates.length >= 6 ||
      s!.candidates.some((candidate) => candidate.movie.id === movie.id)) return;
    const candidate = assumeCandidate(movie, s!.limits, nominating ? s!.nomination : null);
    const reasons = eligibility(candidate, s!.limits);
    if (reasons.length) {
      setSuggestionError(`${movie.title}: ${reasons.join(" ")}`);
      return;
    }
    update({
      candidates: [...s!.candidates, candidate],
      nomination: nominating ? s!.nomination + 1 : s!.nomination,
    });
    setSearch("");
    setSuggestionError("");
    setNotice(`${movie.title} added to this round.`);
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
    setSession(saveSessionResponse(s!, choice));
    setChoice(null);
    setConflict(false);
    setNotice("Response saved to your turn.");
  }
  function beginFresh() {
    if (!restart) return;
    setSession(restartSession(s!, restart));
    setNotice(restart === "reconsider"
      ? "Fresh round agreed. Previously rejected titles may be suggested again, with fresh responses."
      : "Fresh round started. Only recorded objections stay excluded; other films may be suggested again.");
    setRestart(null);
    setSuggestionError("");
    setSearch("");
    setChoice(null);
    setConflict(false);
  }
  function startEvening() {
    setSession(freshSession());
    setSuggestionError("");
    setSearch("");
    setChoice(null);
    setNotice("");
    setConflict(false);
    setRestart(null);
  }
  function pause() {
    setSession(pauseSession(s!));
    setNotice("");
    setChoice(null);
    setConflict(false);
  }
  function reviewAccess() {
    pause();
    setRestart("limits");
  }
  function startVoting() {
    const next = startSessionVoting(s!);
    if (next === s) {
      setNotice(
        "The viewing window has changed. Review the shortlist or shared limits.",
      );
      return;
    }
    setSession(next);
    setNotice("");
  }
  return (
    <section className="v-session" aria-label="Veto shared movie decision">
      <ol className="v-stages" aria-label="Decision progress">
        {["Setup", "Suggest", "Vote", "Results"].map((label, i) => (
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
      {s.phase !== "setup" && <header className="v-intro">
        <div>
          <h1 ref={headingRef} tabIndex={-1}>
            {stageTitle[s.phase]}
          </h1>
          <p>
            {s.phase === "suggest"
                ? "Everyone gets a suggestion. Only movies that fit your agreed limits enter the round."
                : ["vote", "review"].includes(s.phase)
                  ? "Your responses stay covered when you finish. You can correct them before submitting."
                  : s.phase === "choose"
                    ? "Voting is complete. Add any surviving movies to your shortlist to keep them for later."
                    : "A little clarity makes room for a better evening."}
          </p>
        </div>
          {s.phase !== "choose" && <div className="v-time-chip">
            <Clock3 size={17} />
            <span>
              <strong>{windowMinutes} min</strong> remaining
              <br />
              End by {time(s.limits.deadline)}
            </span>
          </div>}
      </header>}
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
          <h2 ref={recoveryHeadingRef} tabIndex={-1}>
            {restart === "limits"
              ? "Review limits in a fresh round?"
              : restart === "reconsider"
                ? "Reconsider rejected titles in a fresh round?"
                : "Try another set?"}
          </h2>
          <div className="v-recovery-grid">
            <div>
              <strong>Keep</strong>
              <p>
                Viewers, deadline, services, audio, and subtitles.
                {restart === "reconsider"
                  ? " Previously rejected titles may be suggested again by agreement."
                  : " Recorded objections stay excluded. Films without an objection may be suggested again."}
              </p>
            </div>
            <div>
              <strong>Reset</strong>
              <p>
                All candidates and responses. Everyone gets a
                fresh nomination opportunity, a new turn, and one veto.
              </p>
            </div>
            <div>
              <strong>Recheck</strong>
              <p>Remaining time and shared requirements for every new nomination.</p>
            </div>
          </div>
          <p>
            Only continue when the group agrees. Existing ballots will be
            cleared. {restart === "limits"
              ? "Review the shared limits, then nominate each movie again."
              : "Nominate each movie again before starting private turns."}
          </p>
          <div className="v-actions">
            <button className="v-primary" onClick={beginFresh}>
              {restart === "reconsider"
                ? "Agree to reconsider in a fresh round"
                : "Agree to a fresh round"} <ArrowRight size={16} />
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
                    <h1 ref={headingRef} tabIndex={-1}>Who’s watching?</h1>
                  </div>
                </div>
                <label className="v-field">
                  Number of viewers
                  <select
                    data-demo="viewer-count"
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
                        data-demo-viewer={i}
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
                    {DEMO_LANGUAGES.map((l) => (
                      <button
                        data-demo-language={l.iso_639_1}
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
                    data-demo="subtitles"
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
                  <button type="submit" className="v-primary" data-demo="continue">
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
                        data-demo="search"
                        placeholder="Search the collection or your saved ideas"
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setSuggestionError(""); }}
                      />
                    </label>
                    <div className="v-catalog">
                      {available.map((m) => (
                        <button
                          key={m.id}
                          data-demo-movie={m.id}
                          className="v-catalog-row"
                          onClick={() => addMovie(m)}
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
                                : `${PROTOTYPE_RUNTIME_MINUTES} min assumed`}
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
                      {catalogNote && <>{catalogNote} </>}
                      Prototype assumes agreed streaming, audio and subtitle access.
                    </p>
                    {suggestionError && <p className="v-error" role="alert">{suggestionError}</p>}
                  </>
                )}
                {nominating ? (
                  <div className="v-actions">
                    <button
                      className="v-secondary"
                      onClick={() => {
                        update({ nomination: s.nomination + 1 });
                        setSearch("");
                        setSuggestionError("");
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
                      data-demo="start-voting"
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
                      Add a movie that fits, review shared limits, or
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
                  <button className="v-text" onClick={() => setRestart("reconsider")}>
                    Reconsider rejected titles
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
                        ? "Group-added choice"
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
              {s.voter < s.limits.viewers && (
                <p className="v-hint">
                  Access, accessibility, audio, subtitles, and time are hard
                  requirements. If one is unmet, use access review rather than
                  spending your preference veto.
                </p>
              )}
              <button
                className="v-primary"
                data-demo={s.voter < s.limits.viewers ? "begin-turn" : "show-results"}
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
                <span className="v-kicker" id="v-movie-position">
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
                <MoviePoster movie={current.movie} className="v-artwork" fallbackClassName="" showFallbackTitle={false} iconSize={30} lazy={false} />
                <div>
                  <p className="v-kicker">
                    {current.movie.release_date?.slice(0, 4)} ·{" "}
                    {current.movie.runtime} MINUTES
                  </p>
                  <h2 ref={movieHeadingRef} tabIndex={-1} aria-describedby="v-movie-position">
                    {current.movie.title}
                  </h2>
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
                    data-demo-response={r.value}
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
              <p className="v-hint">
                These responses express preference. A newly discovered access,
                audio, subtitle, or accessibility problem needs a shared review;
                it does not use your preference veto.
              </p>
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
                  data-demo="save-response"
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
                <button className="v-text" onClick={reviewAccess}>
                  Access or accessibility issue
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
                  data-demo="finish-turn"
                  onClick={() => {
                    setSession(submitTurn(s));
                    setNotice("");
                    setChoice(null);
                  }}
                >
                  Finish my turn <Check size={16} />
                </button>
                <button className="v-text" onClick={pause}>
                  Pause this round
                </button>
                <button className="v-text" onClick={reviewAccess}>
                  Access or accessibility issue
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
                  row shows all four totals. A veto removes a movie. Keep as
                  many survivors as you like in Shortlist; they stay saved on
                  this device. Order follows your round.
                </p>
              </div>
              <div className="v-results">
                {results.map(({ candidate: c, counts, eliminated }) => (
                  <article
                    data-demo-result={c.movie.id}
                    className={`v-panel v-result ${eliminated ? "is-eliminated" : ""}`}
                    key={c.movie.id}
                  >
                    <div className="v-result-title">
                      <h2>{c.movie.title}</h2>
                      <span
                        className={`v-status ${eliminated ? "v-status-no" : ""}`}
                      >
                        {eliminated ? "Eliminated" : "Survived — no vetoes"}
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
                      <button
                        className="v-secondary"
                        data-demo-save={c.movie.id}
                        disabled={savedIds.has(c.movie.id)}
                        aria-label={savedIds.has(c.movie.id)
                          ? `${c.movie.title} is in your shortlist`
                          : `Add ${c.movie.title} to shortlist`}
                        onClick={() => {
                          onSaveMovie(c.movie);
                          setNotice(`${c.movie.title} added to your shortlist.`);
                        }}
                      >
                        {savedIds.has(c.movie.id)
                          ? <>In shortlist <Check size={15} /></>
                          : <>Add to shortlist <Bookmark size={15} /></>}
                      </button>
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
                <button className="v-primary" onClick={onOpenShortlist} data-demo="view-shortlist">
                  View shortlist <Bookmark size={16} />
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
                <button className="v-text" onClick={() => setRestart("reconsider")}>
                  Reconsider rejected titles
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
                <button className="v-text" onClick={() => setRestart("reconsider")}>
                  Reconsider rejected titles
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


    </section>
  );
}
