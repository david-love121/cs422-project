import { test, expect, type Page } from "@playwright/test";

const FIRST = "Soul";
const SECOND = "The Grand Budapest Hotel";
type Answer = "Really Want" | "Okay" | "Prefer another" | "Veto";
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

async function expectNoOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
}

async function setup(page: Page) {
  await page.goto("/");
  await page.getByLabel("Number of viewers").selectOption("2");
  await page.getByLabel("Viewer 1 name").fill("Alex");
  await page.getByLabel("Viewer 2 name").fill("Sam");
  await page.getByLabel("Require English subtitles for every movie").check();
  const deadline = await page.getByLabel("Movie must end by", { exact: true }).inputValue();
  await expectNoOverflow(page);
  await page.getByRole("button", { name: "Continue to suggestions" }).click();
  return deadline;
}

async function addCandidate(page: Page, title: string) {
  await page.getByRole("searchbox", { name: "Find a movie" }).fill(title);
  await page.getByRole("button", { name: new RegExp(`^${escape(title)} \\d{4}`) }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".v-shortlist-item").filter({ hasText: title })).toBeVisible();
}

async function prepareRound(page: Page) {
  const deadline = await setup(page);
  await addCandidate(page, FIRST);
  await expect(page.getByRole("heading", { name: "Sam, add your suggestion." })).toBeVisible();
  await addCandidate(page, SECOND);
  await expect(page.getByRole("heading", { name: "Your shared shortlist." })).toBeVisible();
  await page.getByRole("button", { name: "Start private voting" }).click();
  return deadline;
}

async function beginTurn(page: Page) {
  await page.getByRole("button", { name: "I’m ready — begin my turn" }).click();
}

async function answer(page: Page, response: Answer) {
  await page.getByRole("group", { name: "Your response" }).getByRole("button", { name: new RegExp(`^${escape(response)} `) }).click();
  await expect(page.getByText("Selected — not saved yet.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Save & next" }).click();
}

async function submitTurn(page: Page, responses: [Answer, Answer]) {
  await beginTurn(page);
  for (const response of responses) await answer(page, response);
  await expect(page.getByRole("heading", { name: "Review your responses." })).toBeVisible();
  await page.getByRole("button", { name: "Finish my turn" }).click();
  await expect(page.getByText("RESPONSES COVERED", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: FIRST, exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: SECOND, exact: true })).toHaveCount(0);
}

function resultFor(page: Page, title: string) {
  return page.getByRole("article").filter({ has: page.getByRole("heading", { name: title, exact: true }) });
}

test("two viewers nominate, submit covered ballots, and save a surviving movie permanently", async ({ page }, testInfo) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Who’s watching?", exact: true })).toBeVisible();
  await expect(page.getByText("One shared device · 2–6 viewers", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "A shared choice.", exact: true })).toHaveCount(0);
  await expect(page.getByText("Set the limits. Suggest a film. Decide together.", { exact: true })).toHaveCount(0);
  await page.screenshot({ path: `/tmp/veto-${testInfo.project.name}-setup.png`, fullPage: true });
  await prepareRound(page);
  await submitTurn(page, ["Veto", "Okay"]);
  await expect(page.getByRole("heading", { name: "Pass the device to Sam." })).toBeVisible();
  await submitTurn(page, ["Really Want", "Prefer another"]);
  await page.getByRole("button", { name: "Show group results" }).click();
  const eliminated = resultFor(page, FIRST);
  const survivor = resultFor(page, SECOND);
  await expect(eliminated.getByText("Eliminated", { exact: true })).toBeVisible();
  await expect(eliminated.locator(".v-counts > div")).toHaveText(["1Really Want", "0Okay", "0Prefer another", "1Veto"]);
  await expect(eliminated.getByRole("button", { name: `Add ${FIRST} to shortlist`, exact: true })).toHaveCount(0);
  await expect(survivor.getByText("Survived — no vetoes", { exact: true })).toBeVisible();
  await expect(survivor.locator(".v-counts > div")).toHaveText(["0Really Want", "1Okay", "1Prefer another", "0Veto"]);
  await expectNoOverflow(page);
  await page.screenshot({ path: `/tmp/veto-${testInfo.project.name}-results.png`, fullPage: true });
  await survivor.getByRole("button", { name: `Add ${SECOND} to shortlist`, exact: true }).click();
  await expect(survivor.getByRole("button", { name: `${SECOND} is in your shortlist`, exact: true })).toBeDisabled();
  await expect(page.getByRole("heading", { name: "Your surviving movies.", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirm our choice", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "View shortlist", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Your shortlist.", exact: true })).toBeFocused();
  await expect(page.getByRole("button", { name: `Remove ${SECOND} from shortlist`, exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: `Remove ${FIRST} from shortlist`, exact: true })).toHaveCount(0);
  await page.reload();
  await expect(resultFor(page, SECOND).getByRole("button", { name: `${SECOND} is in your shortlist`, exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Shortlist", exact: true }).click();
  await expect(page.getByRole("button", { name: `Remove ${SECOND} from shortlist`, exact: true })).toBeVisible();
  await expectNoOverflow(page);
});

test("a second genuine objection can pause the round, while correcting an accidental veto restores it", async ({ page }) => {
  await prepareRound(page);
  await beginTurn(page);
  await answer(page, "Veto");
  await page.getByRole("group", { name: "Your response" }).getByRole("button", { name: /^Okay / }).click();
  await page.getByRole("group", { name: "Your response" }).getByRole("button", { name: /^Veto / }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Your one active veto is already saved." })).toContainText("Your one active veto is already saved.");
  await expect(page.getByRole("button", { name: "Save & next" })).toBeDisabled();
  await expect(page.getByRole("group", { name: "Your response" }).getByRole("button", { pressed: true })).toHaveCount(0);
  await page.getByRole("alert").filter({ hasText: "Your one active veto is already saved." }).getByRole("button", { name: "Pause this round" }).click();
  await expect(page.getByRole("heading", { name: "The round is paused." })).toBeVisible();
  await expect(page.getByText(FIRST, { exact: true })).toHaveCount(0);
  await expect(page.getByText(SECOND, { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Resume private turn" }).click();
  await beginTurn(page);
  await expect(page.getByText("0 veto remaining", { exact: true })).toBeVisible();
  await page.getByRole("group", { name: "Your response" }).getByRole("button", { name: /^Veto / }).click();
  await page.getByRole("button", { name: "Review existing veto" }).click();
  await expect(page.getByRole("button", { name: "Finish my turn" })).toBeDisabled();
  await page.getByRole("button", { name: `Edit ${FIRST}`, exact: true }).click();
  await answer(page, "Really Want");
  await expect(page.getByText("1 veto remaining", { exact: true })).toBeVisible();
  await answer(page, "Veto");
  await page.getByRole("button", { name: "Finish my turn" }).click();
  await submitTurn(page, ["Okay", "Okay"]);
  await page.getByRole("button", { name: "Show group results" }).click();
  await expect(resultFor(page, FIRST).getByText("Survived — no vetoes", { exact: true })).toBeVisible();
  await expect(resultFor(page, SECOND).getByText("Eliminated", { exact: true })).toBeVisible();
});

test("an all-eliminated round starts again only by agreement and preserves limits and excluded titles", async ({ page }) => {
  const deadline = await prepareRound(page);
  await submitTurn(page, ["Veto", "Okay"]);
  await submitTurn(page, ["Okay", "Veto"]);
  await page.getByRole("button", { name: "Show group results" }).click();
  await expect(page.getByRole("heading", { name: "No movie survived this round." })).toBeVisible();
  await page.getByRole("button", { name: "Try another set" }).click();
  const agreement = page.getByRole("region", { name: "Fresh round agreement" });
  await expect(agreement).toContainText("Existing ballots will be cleared.");
  await agreement.getByRole("button", { name: "Keep this round" }).click();
  await expect(page.getByRole("heading", { name: "No movie survived this round." })).toBeVisible();
  await page.getByRole("button", { name: "Try another set" }).click();
  await page.getByRole("button", { name: "Agree to a fresh round" }).click();
  await expect(page.getByRole("heading", { name: "Alex, add your suggestion." })).toBeVisible();
  await expect(page.getByRole("searchbox", { name: "Find a movie" })).toHaveValue("");
  await expect(page.getByRole("button", { name: /^Soul \d{4}/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^The Grand Budapest Hotel \d{4}/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Interstellar \d{4}/ })).toBeVisible();
  await page.getByRole("button", { name: "Review shared limits" }).click();
  await page.getByRole("button", { name: "Agree to a fresh round" }).click();
  await expect(page.getByLabel("Number of viewers")).toHaveValue("2");
  await expect(page.getByLabel("Viewer 1 name")).toHaveValue("Alex");
  await expect(page.getByLabel("Viewer 2 name")).toHaveValue("Sam");
  await expect(page.getByLabel("Movie must end by", { exact: true })).toHaveValue(deadline);
  await expect(page.getByRole("button", { name: "Netflix", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("Require English subtitles for every movie")).toBeChecked();
  await expectNoOverflow(page);
});

test("reload covers an active private ballot while preserving saved responses and discarding an unsaved selection", async ({ page }) => {
  await prepareRound(page);
  await beginTurn(page);
  await answer(page, "Really Want");
  await page.getByRole("group", { name: "Your response" }).getByRole("button", { name: /^Veto / }).click();
  await page.reload();
  await expect(page.getByText("RESPONSES COVERED", { exact: true })).toBeVisible();
  await expect(page.getByText(FIRST, { exact: true })).toHaveCount(0);
  await expect(page.getByText(SECOND, { exact: true })).toHaveCount(0);
  await beginTurn(page);
  await expect(page.getByRole("heading", { name: SECOND, exact: true })).toBeVisible();
  await expect(page.getByRole("group", { name: "Your response" }).getByRole("button", { name: /^Veto / })).toHaveAttribute("aria-pressed", "false");
  await answer(page, "Okay");
  await expect(page.getByText("2 of 2 answered", { exact: false })).toBeVisible();
  const firstReview = page.locator(".v-review-row").filter({ hasText: FIRST });
  await expect(firstReview).toContainText("Really Want");
  await expectNoOverflow(page);
});


test("multiple survivors stay saveable after the original deadline and persist without duplicates", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-11-05T20:00:00Z") });
  await prepareRound(page);
  await submitTurn(page, ["Okay", "Okay"]);
  await submitTurn(page, ["Okay", "Okay"]);
  await page.getByRole("button", { name: "Show group results" }).click();
  await expect(page.getByText("Group favorite", { exact: true })).toHaveCount(0);
  await expect(page.locator(".v-favorite-sticker")).toHaveCount(0);
  await page.clock.setSystemTime(new Date("2026-11-06T20:00:00Z"));
  await page.reload();
  for (const title of [FIRST, SECOND]) {
    const result = resultFor(page, title);
    const add = result.getByRole("button", { name: `Add ${title} to shortlist`, exact: true });
    await expect(add).toBeEnabled();
    await add.click();
    await expect(result.getByRole("button", { name: `${title} is in your shortlist`, exact: true })).toBeDisabled();
  }
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("movie-night-shortlist-v1") || "[]").length)).toBe(2);
  await page.reload();
  for (const title of [FIRST, SECOND])
    await expect(resultFor(page, title).getByRole("button", { name: `${title} is in your shortlist`, exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "View shortlist", exact: true }).click();
  for (const title of [FIRST, SECOND])
    await expect(page.getByRole("button", { name: `Remove ${title} from shortlist`, exact: true })).toBeVisible();
});

test("a clear favorite receives a teal highlight and star while every survivor remains saveable", async ({ page }, testInfo) => {
  await prepareRound(page);
  await submitTurn(page, ["Really Want", "Okay"]);
  await submitTurn(page, ["Really Want", "Okay"]);
  await page.getByRole("button", { name: "Show group results" }).click();
  const favorite = resultFor(page, FIRST);
  const other = resultFor(page, SECOND);
  await expect(favorite.getByText("Group favorite", { exact: true })).toBeVisible();
  await expect(favorite.locator(".v-favorite-sticker")).toBeVisible();
  await expect(page.locator(".v-favorite-sticker")).toHaveCount(1);
  for (const title of [FIRST, SECOND])
    await expect(resultFor(page, title).getByRole("button", { name: `Add ${title} to shortlist`, exact: true })).toBeEnabled();
  for (const theme of ["light", "dark"]) {
    if (theme === "dark") {
      await page.getByRole("button", { name: "Veto settings", exact: true }).click();
      await page.getByRole("menuitemcheckbox", { name: "Dark mode", exact: true }).click();
      await page.keyboard.press("Escape");
    }
    const background = await favorite.evaluate((element) => getComputedStyle(element).backgroundColor);
    expect(background).not.toBe(await other.evaluate((element) => getComputedStyle(element).backgroundColor));
    await expectNoOverflow(page);
    await favorite.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `/tmp/veto-${testInfo.project.name}-favorite-${theme}.png`, fullPage: true });
  }
  await favorite.getByRole("button", { name: `Add ${FIRST} to shortlist`, exact: true }).click();
  await expect(favorite.getByText("Group favorite", { exact: true })).toBeVisible();
  await expect(other.getByRole("button", { name: `Add ${SECOND} to shortlist`, exact: true })).toBeEnabled();
});

test("an older confirmed round reopens at results so other survivors can be saved", async ({ page }) => {
  await prepareRound(page);
  await submitTurn(page, ["Okay", "Okay"]);
  await submitTurn(page, ["Okay", "Okay"]);
  await page.getByRole("button", { name: "Show group results" }).click();
  await page.evaluate(() => {
    const round = JSON.parse(sessionStorage.getItem("veto-session-v1")!);
    sessionStorage.setItem("veto-session-v1", JSON.stringify({ ...round, phase: "done",
      chosen: round.candidates[0].movie.id, confirmedAt: Date.now() }));
  });
  await page.reload();
  await expect(page.getByRole("heading", { name: "Your surviving movies.", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your evening is decided.", exact: true })).toHaveCount(0);
  await resultFor(page, SECOND).getByRole("button", { name: `Add ${SECOND} to shortlist`, exact: true }).click();
  await expect(resultFor(page, FIRST).getByRole("button", { name: `Add ${FIRST} to shortlist`, exact: true })).toBeEnabled();
});

test("saving a survivor explains a failed persistent write while retaining it in memory", async ({ page }) => {
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (this === localStorage && key === "movie-night-shortlist-v1")
        throw new DOMException("Storage full", "QuotaExceededError");
      original.call(this, key, value);
    };
  });
  await prepareRound(page);
  await submitTurn(page, ["Veto", "Okay"]);
  await submitTurn(page, ["Okay", "Okay"]);
  await page.getByRole("button", { name: "Show group results" }).click();
  await resultFor(page, SECOND).getByRole("button", { name: `Add ${SECOND} to shortlist`, exact: true }).click();
  await expect(page.getByText("Changes to your shortlist couldn’t be saved on this device. Keep this page open; reloading may lose them.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "View shortlist", exact: true }).click();
  await expect(page.getByRole("button", { name: `Remove ${SECOND} from shortlist`, exact: true })).toBeVisible();
});

test("fresh-round recovery excludes objections while deliberate reconsideration releases them", async ({ page }) => {
  const deadline = await prepareRound(page);
  await submitTurn(page, ["Veto", "Okay"]);
  await submitTurn(page, ["Okay", "Okay"]);
  await page.getByRole("button", { name: "Show group results" }).click();
  await page.getByRole("button", { name: "Try another set", exact: true }).click();
  const agreement = page.getByRole("region", { name: "Fresh round agreement" });
  await expect(agreement).toContainText("Films without an objection may be suggested again.");
  await agreement.getByRole("button", { name: "Agree to a fresh round", exact: true }).click();
  await expect(page.getByRole("button", { name: /^Soul \d{4}/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^The Grand Budapest Hotel \d{4}/ })).toBeVisible();
  await page.getByRole("button", { name: "Reconsider rejected titles", exact: true }).click();
  await expect(agreement).toContainText("Previously rejected titles may be suggested again by agreement.");
  await agreement.getByRole("button", { name: "Keep this round", exact: true }).click();
  await expect(page.getByRole("button", { name: /^Soul \d{4}/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Reconsider rejected titles", exact: true }).click();
  await agreement.getByRole("button", { name: "Agree to reconsider in a fresh round", exact: true }).click();
  await expect(page.getByRole("button", { name: /^Soul \d{4}/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Alex, add your suggestion." })).toBeFocused();
  await page.getByRole("button", { name: "Review shared limits", exact: true }).click();
  await page.getByRole("button", { name: "Agree to a fresh round", exact: true }).click();
  await expect(page.getByLabel("Movie must end by", { exact: true })).toHaveValue(deadline);
  await expect(page.getByLabel("Require English subtitles for every movie")).toBeChecked();
});

test("nomination and keyboard voting focus announce the new viewer and movie", async ({ page }) => {
  await setup(page);
  await addCandidate(page, FIRST);
  await expect(page.getByRole("heading", { name: "Sam, add your suggestion." })).toBeFocused();
  await addCandidate(page, SECOND);
  await page.getByRole("button", { name: "Start private voting" }).click();
  await beginTurn(page);
  await expect(page.getByRole("heading", { name: FIRST, exact: true })).toBeFocused();
  const okay = page.getByRole("group", { name: "Your response" }).getByRole("button", { name: /^Okay / });
  await okay.focus();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Save & next" }).focus();
  await page.keyboard.press("Enter");
  const nextHeading = page.getByRole("heading", { name: SECOND, exact: true });
  await expect(nextHeading).toBeFocused();
  await expect(nextHeading).toHaveAttribute("aria-describedby", "v-movie-position");
  await expect(page.locator("#v-movie-position")).toHaveText("MOVIE 2 OF 2");
});

test("a saved film with unknown metadata is nominated immediately using prototype defaults", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("movie-night-shortlist-v1", JSON.stringify([{
      id: 9000001, title: "Prototype film", original_language: "ja", genre_ids: [],
      release_date: "2024-01-01", overview: "An idea with incomplete catalog data.",
    }]));
  });
  await setup(page);
  await page.getByRole("searchbox", { name: "Find a movie" }).fill("Prototype film");
  await page.getByRole("button", { name: /^Prototype film 2024/ }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const added = page.locator(".v-shortlist-item").filter({ hasText: "Prototype film" });
  await expect(added).toContainText("120 min");
  await expect(added).toContainText("Netflix");
  await expect(added).toContainText("English audio");
  await expect(page.getByText("English subtitles assumed", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Prototype access assumptions", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Sam, add your suggestion." })).toBeFocused();
});

test("ineligible proposals and a private access review never spend a preference veto", async ({ page }) => {
  await setup(page);
  for (const title of ["Interstellar", "Oppenheimer"]) {
    // These known runtimes exceed the short viewing window; access is assumed.
    if (title === "Interstellar") {
      await page.getByRole("button", { name: "Review shared limits", exact: true }).click();
      await page.getByRole("button", { name: "Agree to a fresh round", exact: true }).click();
      const deadline = new Date(Date.now() + 150 * 60_000);
      const local = new Date(deadline.getTime() - deadline.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
      await page.getByLabel("Movie must end by", { exact: true }).fill(local);
      await page.getByRole("button", { name: "Continue to suggestions", exact: true }).click();
    }
    await page.getByRole("searchbox", { name: "Find a movie" }).fill(title);
    await page.getByRole("button", { name: new RegExp(`^${escape(title)} \\d{4}`) }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    const reason = page.getByRole("alert").filter({ hasText: title });
    await expect(reason).toContainText(title);
    await expect(reason).toContainText("runtime exceeds");
    await expect(page.locator(".v-shortlist-item")).toHaveCount(0);
  }
  await addCandidate(page, FIRST);
  await addCandidate(page, SECOND);
  await page.getByRole("button", { name: "Start private voting" }).click();
  await beginTurn(page);
  await expect(page.getByText("1 veto remaining", { exact: true })).toBeVisible();
  await answer(page, "Veto");
  await page.getByRole("button", { name: "Access or accessibility issue", exact: true }).click();
  const agreement = page.getByRole("region", { name: "Fresh round agreement" });
  await expect(agreement).toBeVisible();
  await expect(page.getByText(FIRST, { exact: true })).toHaveCount(0);
  await expect(page.getByText(SECOND, { exact: true })).toHaveCount(0);
  await agreement.getByRole("button", { name: "Keep this round", exact: true }).click();
  await page.getByRole("button", { name: "Resume private turn", exact: true }).click();
  await beginTurn(page);
  await expect(page.getByText("0 veto remaining", { exact: true })).toBeVisible();
  await answer(page, "Okay");
  await expect(page.locator(".v-review-row").filter({ hasText: FIRST })).toContainText("Veto");
  await expect(page.locator(".v-review-row").filter({ hasText: SECOND })).toContainText("Okay");
  await page.getByRole("button", { name: "Access or accessibility issue", exact: true }).click();
  await agreement.getByRole("button", { name: "Agree to a fresh round", exact: true }).click();
  await expect(page.getByLabel("Require English subtitles for every movie")).toBeChecked();
  await page.getByRole("button", { name: "Continue to suggestions", exact: true }).click();
  await expect(page.getByRole("button", { name: /^Soul \d{4}/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^The Grand Budapest Hotel \d{4}/ })).toBeVisible();
});

test("three desktop viewers and six mobile viewers complete larger rounds with truthful totals", async ({ page, isMobile }) => {
  test.setTimeout(60_000);
  const viewers = isMobile ? 6 : 3;
  const titles = [FIRST, SECOND, "Fantastic Mr. Fox", "Interstellar", "Taxi Driver", "Transformers"].slice(0, viewers);
  await page.goto("/");
  await page.getByLabel("Number of viewers").selectOption(String(viewers));
  await page.getByRole("button", { name: "Continue to suggestions", exact: true }).click();
  for (const title of titles) {
    await page.getByRole("searchbox", { name: "Find a movie" }).fill(title);
    await page.getByRole("button", { name: new RegExp(`^${escape(title)} \\d{4}`) }).click();
    await expect(page.locator(".v-shortlist-item").filter({ hasText: title })).toBeVisible();
  }
  await page.getByRole("button", { name: "Start private voting", exact: true }).click();
  for (let viewer = 0; viewer < viewers; viewer += 1) {
    await beginTurn(page);
    for (let index = 0; index < titles.length; index += 1) await answer(page, "Okay");
    await page.getByRole("button", { name: "Finish my turn", exact: true }).click();
    await expect(page.getByText("RESPONSES COVERED", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: FIRST, exact: true })).toHaveCount(0);
  }
  await page.getByRole("button", { name: "Show group results", exact: true }).click();
  for (const title of titles) {
    await expect(resultFor(page, title).locator(".v-counts > div")).toHaveText([
      "0Really Want", `${viewers}Okay`, "0Prefer another", "0Veto",
    ]);
  }
  await expectNoOverflow(page);
  for (const title of titles.slice(0, 2)) {
    await resultFor(page, title).getByRole("button", { name: `Add ${title} to shortlist`, exact: true }).click();
    await expect(resultFor(page, title).getByRole("button", { name: `${title} is in your shortlist`, exact: true })).toBeDisabled();
  }
  await expect(page.getByRole("heading", { name: "Your surviving movies.", exact: true })).toBeVisible();
  await expectNoOverflow(page);
});
