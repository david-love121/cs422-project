import { expect, test } from "@playwright/test";

test("the native movie-end field fits inside its setup card and remains editable", async ({ page, isMobile }) => {
  await page.goto("/");
  const widths = isMobile ? [320, 390, 430] : [1440];
  for (const width of widths) {
    await page.setViewportSize({ width, height: 844 });
    const field = page.getByLabel("Movie must end by", { exact: true });
    await field.fill("2026-12-31T23:59");
    await expect(field).toHaveValue("2026-12-31T23:59");
    const bounds = await field.evaluate((input) => {
      const rect = input.getBoundingClientRect();
      const label = input.closest("label")!.getBoundingClientRect();
      const panel = input.closest(".v-panel")!.getBoundingClientRect();
      return { left: rect.left, right: rect.right, width: rect.width,
        labelLeft: label.left, labelRight: label.right, panelRight: panel.right,
        pageWidth: document.documentElement.scrollWidth, viewportWidth: innerWidth };
    });
    expect(bounds.left).toBeGreaterThanOrEqual(bounds.labelLeft - 1);
    expect(bounds.right).toBeLessThanOrEqual(bounds.labelRight + 1);
    expect(bounds.right).toBeLessThan(bounds.panelRight - 10);
    expect(bounds.width).toBeGreaterThan(150);
    expect(bounds.pageWidth).toBeLessThanOrEqual(bounds.viewportWidth + 1);
  }
});
