# Veto functional prototype

Veto is a shared-device decision tool for two to six viewers. Its purpose is to find a film the group is willing and able to watch before the agreed end time. A surviving title is an option for the group to choose; completing a ballot does not automatically select a winner.

## People and tasks

The **considerate coordinator** wants to include everyone, check practical constraints early, and avoid spending the evening searching. The **flexible contributor** is willing to compromise but needs a firm objection to count without having to defend it publicly. These are behavioral roles, not demographic categories.

The primary use case is a three-viewer movie night with a finish time and agreed streaming/language access. Each viewer nominates one title or skips. The group builds a shortlist of no more than six eligible titles, each viewer responds privately to the same titles, and the group selects a survivor. Final confirmation rechecks whether the movie still fits the available time.

The recovery use case begins when no title is eligible, every candidate receives a veto, or a viewer needs to raise a second firm objection. The group can pause, review its limits, try a fresh set, or stop. Another round retains practical limits and excluded movie IDs while clearing old ballots and restoring veto allowances.

## Study findings translated into implementation priorities

- **Make participation explicit.** Provide a visible nomination or skip opportunity for each viewer. Explain who nominated a candidate so the person holding the device does not acquire an extra vote.
- **Separate willingness from enthusiasm.** Keep Really Want, Okay, Prefer another, and Veto distinct. Prefer another remains a willingness response; Veto removes the title regardless of other totals.
- **Show commitment and progress.** Display the current stage, viewer, title position, selected response, saved response, and completed-turn state. A selection becomes part of the ballot only through an explicit save action; review precedes submission.
- **Cover the handoff.** Hide one viewer’s responses before passing the device. Explain the limits of privacy before voting: aggregate counts can support inference in a small group.
- **Check fit before and after voting.** Require runtime and access confirmation before nomination and recheck time before the final decision. A browsing result is not a verified streaming offer.
- **Preserve agreement during recovery.** Keep the shared limits and excluded IDs. Explain what resets before starting a fresh round, and offer a visible way to stop.

These priorities come from the team’s earlier low-fidelity evaluation. Raw participant records, identifying details, and private study materials are not included here.

## Requirements and implementation map

The decision engine is in [`src/lib/veto.ts`](../src/lib/veto.ts). The user-facing workflow is in [`src/components/veto-session.tsx`](../src/components/veto-session.tsx), connected to the main app’s Decide together workspace. Its visual styles are in [`src/app/veto.css`](../src/app/veto.css).

| Requirement | Functional behavior | Important boundary |
| --- | --- | --- |
| R1 — Equal participation | Two to six viewers; one nomination or explicit skip per viewer; one private ballot over the same candidates. | The device is passed between people; there are no remote rooms. |
| R2 — Shared limits | Set **Movie must end by**, streaming services, acceptable audio languages, and English subtitle needs before building the shortlist. | The deadline is the film’s end time, not a voting deadline. |
| R3 — Comparable information | Show real title metadata, runtime and synopsis; record the service, audio, subtitle, and access check for each candidate. | Provider examples and original-language metadata do not prove playback access. |
| R4 — Visible nominations | Each viewer can add a suggestion or skip; participant nominations are distinguishable from group-added choices. | A candidate is added only after the group confirms practical fit. |
| R5 — Bounded shortlist | Use up to six distinct eligible titles, then explicitly start private voting. | A smaller set is acceptable; practical constraints are not relaxed automatically. |
| R6 — Eligibility and changes | Explain ineligibility; changes to limits/candidates require a fresh ballot round. | Unknown runtime or unconfirmed required access blocks eligibility. |
| R7 — Response meanings | Really Want = enthusiasm; Okay = willing; Prefer another = willing but prefers an alternative; Veto = firm objection. | Soft preferences do not eliminate a film. |
| R8 — Correctable veto | One active veto per viewer; changing that response restores the allowance. A second objection offers review or pause. | The process must not force a false willingness response. |
| R9 — Progress and commitment | Setup → Suggest → Vote → Choose; explicit saving, ballot review, and turn submission. | Saved partial ballots are retained within the current round; a selected but unsaved response is not committed. |
| R10 — Concealed handoff | Cover a submitted turn and wait for the next viewer’s readiness; cover a restored session before resuming. | Visual concealment is not encryption or anonymity. |
| R11 — Explain results | Show all four totals and whether a title is available or eliminated. Any veto eliminates a title. | Counts explain the outcome; the app does not choose the group’s favorite. |
| R12 — Final confirmation | Present a populated, read-only selected-title summary with source, language/subtitles, start, estimated end, and deadline; recheck time. | No automatic playback or streaming-account integration. |
| R13 — Recovery | Distinguish no eligible titles from no survivors; preserve limits and exclusions for another set; clear ballots for an agreed new round; allow stopping. | There is no automatic recycling of rejected titles into a new set. |

## Information design

The app separates three kinds of information:

1. **Catalog facts:** TMDB movie ID, title, synopsis, release date, artwork, runtime, original language, genre IDs, and rating. Original language is not an audio-track or subtitle guarantee.
2. **The group’s practical agreement:** viewer count, a concrete end timestamp, agreed streaming service IDs, acceptable audio language codes, and whether English subtitles are required.
3. **The current decision:** confirmed candidates, nomination ownership, private responses, round progress, excluded IDs, and the group’s final choice.

The decision engine uses these structures:

```ts
type Limits = {
  viewers: number;
  deadline: string;       // A concrete ISO timestamp, including the date.
  services: number[];    // IDs from the streaming-provider directory.
  audioLanguages: string[];
  subtitles: boolean;    // English subtitles required by the group.
};

type Candidate = {
  movie: Movie;
  source: number;
  audio: string;
  subtitles: boolean;
  accessConfirmed: boolean;
  nominatedBy: number | null;
};

type Response = "want" | "okay" | "prefer" | "veto";
type Ballot = Record<number, Response>; // Movie ID → one response.
```

For example, a three-viewer round might set an end time of `2026-11-05T23:00:00Z`, services `[8, 9]`, audio languages `["en", "hi", "ta"]`, and required English subtitles. At 20:20 UTC, the viewing window is 160 minutes. A 180-minute title is ineligible even when access is confirmed. This is an example timestamp for explaining the model, not a hard-coded app clock.

Eligibility requires a positive known runtime, a valid future deadline, confirmed playback access, a source from the agreed services, an agreed audio language, and any required English subtitles. The runtime must fit the current remaining window. Reasons are returned as an array so the interface can explain every failed condition.

Results are derived from submitted ballots. For each candidate, the four counters start at zero and each ballot contributes at most one response. `eliminated = counts.veto > 0`. Shortlist order is retained: the engine does not turn the counts into a ranking. For a complete round, each movie’s four counts should sum to the number of viewers.

## Storage and message boundaries

The decision session stays on the current device under the session-storage key `veto-session-v1`. It includes the phase, limits, viewer display names, candidates, nomination/voter position, saved draft responses, submitted ballots, excluded IDs, and selected movie ID. Reloading a private voting/review phase restores the handoff cover before anyone resumes. Unsaved response selections are held only in component state and are discarded when the workflow is covered or unmounted. Individual ballots are not placed in long-lived local storage or sent to a server. Session storage is readable by code and by someone inspecting the browser, so it does not provide a security boundary between people sharing the device.

The movie browsing shortlist uses the existing local-storage key `movie-night-shortlist-v1` so earlier saved titles remain available. The catalog credential uses the existing session-storage key `movie-night-tmdb-token` and is entered by the user through Connect TMDB. Keeping these keys avoids silently discarding existing browser data during the rebrand.

In this `main` branch, catalog requests go directly from the browser to TMDB. There is no application server message API for votes. See the [catalog API guide](./tmdb-client-api.md) for request/response semantics, filter translation, errors, and credential handling. The separate `server-side` branch has a different server API and credential boundary.

## Demo walkthrough

1. Open **Decide together**. In Setup, choose three viewers, an end time sufficiently in the future, agreed services and audio languages, and any subtitle requirement.
2. Continue to Suggest. Give each viewer one nomination opportunity or explicit skip. Use the actual service to check the candidate’s playback access, agreed audio, subtitles, and extra charges. Add only eligible candidates; add group choices until the intended shortlist is ready.
3. Start private voting. Read the response meanings and privacy explanation. Pass the device only when the handoff cover is visible.
4. For the first viewer, select and save a response for each title. Use one veto, then change it to a willingness response to show the allowance being restored. Review the saved ballot and finish the turn.
5. Complete the other viewers’ turns. Demonstrate that a title with enthusiastic responses and one veto is eliminated. Check that every result’s four totals sum to three.
6. Choose a survivor together. Check the populated final summary and confirm only if the film still fits the deadline. Open the streaming service separately.
7. In a separate round, use a second firm objection to demonstrate pause/review, or eliminate all candidates to show recovery. Explain what is kept and reset before starting a fresh set.

Use real metadata and access checks in the study. Deterministic browser fixtures are for verifying behavior; they do not establish current streaming availability.

## Evaluation and next study

The following walkthrough checks are review criteria for this revision. Passing automated tests is not evidence that a real participant understood the interface.

| Check | What to observe | Study follow-up |
| --- | --- | --- |
| Visibility of state | Stages, current viewer, selected/saved state, and remaining veto allowance are visible. | Ask the participant to explain when a response becomes final. |
| Match to the task | The deadline says the movie must end by that time; source/audio/subtitle checks precede voting. | Ask what the end time means without coaching. |
| Error prevention | Ineligible movies cannot enter the round; a second veto does not silently replace another objection. | Observe recovery from an accidental veto and a genuine second objection. |
| Control and recovery | Review can correct a response; pause covers work; another set preserves agreement and exclusions. | Ask what will be kept and cleared before restarting. |
| Honest privacy | Handoff hides responses, while aggregate inference is explained. | Ask what the next viewer can see and what totals might reveal. |
| Understandable results | All four counts appear; a veto cannot be outvoted; final selection belongs to the group. | Ask whether a survivor means unanimous enthusiasm. |
| Current-time check | A film that no longer fits cannot be confirmed. | Delay the final selection and ask how to recover. |

Automated validation should cover the full shared-device flow, veto correction, handoff, session restoration, elimination and recovery, and deadline expiry, alongside the retained catalog interaction tests. The repository’s checks are `pnpm lint`, `pnpm typecheck`, `pnpm build`, and `pnpm test:e2e`. Record the actual results in the task handoff; this document does not substitute intended checks for completed runs.

Validation on 5 November 2026: ESLint, TypeScript, and the production build passed. All 26 Playwright checks passed against the production build across desktop and mobile, covering catalog requests/filtering, eligibility and totals, complete private turns, veto correction/pause, all-eliminated recovery, reload concealment, and a final-time change before confirmation. Desktop/mobile screenshots were visually reviewed for the minimal layout and horizontal overflow. These are implementation checks, not new participant study findings.

Known limitations for User Study 2: playback/access checks are manual, catalog/provider information can become stale, participants share one physical device, aggregate results can reveal preferences, and sequential voting may be slow for six viewers. The Suggest collection combines the prepared movie snapshot with saved browsing ideas; it does not automatically query the full catalog or generate personalized recommendations. The setup offers a bounded set of service/language options. If browser storage is unavailable, state is temporary and navigating away from the decision workspace can lose it. The next study should measure interpretation of willingness, completion and handoff errors, recovery understanding, and time spent choosing. Presentation slides, class submission, and new participant study results are outside this implementation.
