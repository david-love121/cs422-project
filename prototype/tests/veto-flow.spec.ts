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
  const dialog = page.getByRole("dialog", { name: title, exact: true });
  const add = dialog.getByRole("button", { name: "Add my suggestion", exact: true });
  await expect(add).toBeDisabled();
  await dialog.getByLabel("English subtitles are available on this service").check();
  await expect(add).toBeDisabled();
  await dialog.getByLabel("I checked playback access and audio on this service, including subtitle needs. There is no extra charge.").check();
  await expect(add).toBeEnabled();
  await add.click();
  await expect(dialog).toHaveCount(0);
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

test("two viewers nominate, submit covered ballots, respect a hard veto, and confirm a surviving film", async ({ page }, testInfo) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
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
  await expect(eliminated.getByRole("button", { name: `Choose ${FIRST}`, exact: true })).toHaveCount(0);
  await expect(survivor.getByText("Available — no vetoes", { exact: true })).toBeVisible();
  await expect(survivor.locator(".v-counts > div")).toHaveText(["0Really Want", "1Okay", "1Prefer another", "0Veto"]);
  await expectNoOverflow(page);
  await page.screenshot({ path: `/tmp/veto-${testInfo.project.name}-results.png`, fullPage: true });
  await survivor.getByRole("button", { name: `Choose ${SECOND}`, exact: true }).click();
  await expect(page.getByRole("heading", { name: "One last check, together." })).toBeVisible();
  await expect(page.getByText("Estimated film end", { exact: true })).toBeVisible();
  const confirm = page.getByRole("button", { name: "Confirm our choice" });
  await expect(confirm).toBeDisabled();
  await page.getByLabel("We rechecked this service, audio, subtitles, and no extra charge.").check();
  await confirm.click();
  await expect(page.getByRole("heading", { name: "Your evening is decided." })).toBeVisible();
  await expect(page.getByText(/Decision recorded\. Open Netflix yourselves/)).toBeVisible();
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
  await expect(resultFor(page, FIRST).getByText("Available — no vetoes", { exact: true })).toBeVisible();
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


test("confirmation rechecks the actual time before recording a choice even when the displayed window is stale", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-11-05T20:00:00Z") });
  await prepareRound(page);
  await submitTurn(page, ["Okay", "Okay"]);
  await submitTurn(page, ["Okay", "Okay"]);
  await page.getByRole("button", { name: "Show group results" }).click();
  await resultFor(page, SECOND).getByRole("button", { name: `Choose ${SECOND}`, exact: true }).click();
  await page.getByLabel("We rechecked this service, audio, subtitles, and no extra charge.").check();
  const confirm = page.getByRole("button", { name: "Confirm our choice" });
  await expect(confirm).toBeEnabled();
  // Move wall-clock time without triggering the 15-second display refresh.
  await page.clock.setSystemTime(new Date("2026-11-05T21:30:00Z"));
  await confirm.click();
  await expect(page.getByRole("heading", { name: "One last check, together." })).toBeVisible();
  await expect(page.getByText("This movie no longer meets the shared limits. Return to results and choose a shorter option.", { exact: true })).toBeVisible();
  await expect(confirm).toBeDisabled();
  await expect(page.getByRole("heading", { name: "Your evening is decided." })).toHaveCount(0);
});
