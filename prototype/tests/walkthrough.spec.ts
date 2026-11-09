import { expect, test, type Page } from "@playwright/test";

const personal = { id: 508442, title: "My saved movie", runtime: 101 };
async function openMenu(page: Page) {
  await page.getByRole("button", { name: "Veto settings", exact: true }).click();
  return page.getByRole("menu");
}

test("clear shortlist removes persistent saves and an empty menu skips the disabled action", async ({ page }) => {
  await page.addInitScript((movie) => {
    if (!localStorage.getItem("movie-night-shortlist-v1")) localStorage.setItem("movie-night-shortlist-v1", JSON.stringify([movie]));
  }, personal);
  await page.goto("/");
  const menu = await openMenu(page);
  await menu.getByRole("menuitem", { name: "Clear shortlist", exact: true }).click();
  await expect(page.getByText("Shortlist cleared.", { exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("movie-night-shortlist-v1") || "null"))).toEqual([]);
  await page.reload();
  await openMenu(page);
  await expect(menu.getByRole("menuitem", { name: "Clear shortlist", exact: true })).toBeDisabled();
  await page.getByRole("menuitemcheckbox", { name: "Live data", exact: true }).focus();
  await page.keyboard.press("ArrowDown");
  await expect(menu.getByRole("menuitem", { name: "Start demo", exact: true })).toBeFocused();
});

test("the automated five-viewer demo reaches three survivors without overwriting a personal round or shortlist", async ({ page }) => {
  test.setTimeout(60_000);
  const errors: string[] = [], upstream: string[] = [], live: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.hostname === "api.themoviedb.org") upstream.push(url.href);
    if (url.pathname.startsWith("/api/") && url.searchParams.get("mode") === "live") live.push(url.href);
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.clock.install();
  await page.goto("/");
  await page.getByLabel("Viewer 1 name").fill("My own evening");
  await page.evaluate((movie) => localStorage.setItem("movie-night-shortlist-v1", JSON.stringify([movie])), personal);
  await page.reload();
  await expect(page.getByLabel("Viewer 1 name")).toHaveValue("My own evening");
  const original = await page.evaluate(() => sessionStorage.getItem("veto-session-v1"));
  const menu = await openMenu(page);
  await menu.getByRole("menuitem", { name: "Start demo", exact: true }).click();
  const demo = page.getByRole("region", { name: "Guided demo", exact: true });
  await expect(demo).toBeVisible();
  // Virtual time exercises the same full 120-second script with reduced motion.
  await page.clock.runFor(140_000);
  await expect(demo).toHaveAttribute("data-demo-status", "complete");
  await expect(page.locator(".movie-grid .movie-card")).toHaveCount(3);
  await expect(page.locator(".movie-grid")).toContainText("Glass Onion");
  await expect(page.locator(".movie-grid")).toContainText("Maharaja");
  await expect(page.locator(".movie-grid")).toContainText("The Adam Project");
  await expect(page.locator(".movie-grid")).not.toContainText("The Tomorrow War");
  expect(await page.evaluate(() => sessionStorage.getItem("veto-session-v1"))).toBe(original);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("movie-night-shortlist-v1")!)[0].title)).toBe(personal.title);
  await page.getByRole("button", { name: "Exit demo", exact: true }).click();
  await expect(page.getByLabel("Viewer 1 name")).toHaveValue("My own evening");
  await page.getByRole("button", { name: "Shortlist", exact: true }).click();
  await expect(page.getByRole("button", { name: "View details for My saved movie", exact: true })).toBeVisible();
  expect(errors).toEqual([]); expect(upstream).toEqual([]); expect(live).toEqual([]);
});

test("pause, resume, replay, and exit control the walkthrough", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.clock.install();
  await page.goto("/");
  const menu = await openMenu(page);
  await menu.getByRole("menuitem", { name: "Start demo", exact: true }).click();
  await page.clock.runFor(12_000);
  await page.getByRole("button", { name: "Pause demo", exact: true }).click();
  const progress = page.getByRole("progressbar", { name: "Demo progress", exact: true });
  const pausedAt = await progress.getAttribute("aria-valuenow");
  await page.clock.runFor(10_000);
  await expect(progress).toHaveAttribute("aria-valuenow", pausedAt!);
  await page.getByRole("button", { name: "Resume demo", exact: true }).click();
  await page.clock.runFor(5000);
  expect(Number(await progress.getAttribute("aria-valuenow"))).toBeGreaterThan(Number(pausedAt));
  await page.getByRole("button", { name: "Restart demo", exact: true }).click();
  await expect(progress).toHaveAttribute("aria-valuenow", "0");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("region", { name: "Guided demo", exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Number of viewers")).toHaveValue("3");
});


test("starting from live data uses only prepared movies during playback and restores the source on exit", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.clock.install();
  await page.addInitScript(() => localStorage.setItem("veto-preferences-v1", JSON.stringify({ theme: "dark", dataMode: "live" })));
  let playing = false;
  const duringDemo: string[] = [];
  await page.route("**/api/**", (route) => {
    const url = new URL(route.request().url());
    if (playing) duringDemo.push(url.searchParams.get("mode") || "missing");
    const body = url.pathname === "/api/catalog"
      ? { mode: url.searchParams.get("mode"), genres: [], providers: [], languages: [] }
      : { results: [], page: 1, total_pages: 0, total_results: 0 };
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
  await page.goto("/");
  const menu = await openMenu(page);
  await expect(menu.getByRole("menuitemcheckbox", { name: "Live data", exact: true })).toHaveAttribute("aria-checked", "true");
  playing = true;
  await menu.getByRole("menuitem", { name: "Start demo", exact: true }).click();
  await page.clock.runFor(22_000);
  await expect(page.locator('[data-demo="search"]')).toBeVisible();
  await expect(page.locator('[data-demo-movie]')).not.toHaveCount(0);
  expect(duringDemo).not.toContain("live");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("veto-preferences-v1")!).dataMode)).toBe("live");
  playing = false;
  await page.getByRole("button", { name: "Exit demo", exact: true }).click();
  await openMenu(page);
  await expect(menu.getByRole("menuitemcheckbox", { name: "Live data", exact: true })).toHaveAttribute("aria-checked", "true");
});
