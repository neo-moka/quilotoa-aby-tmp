import { expect, test } from "@playwright/test";

import { installMockBridge } from "../helpers/bridge";

/**
 * The four lenses on a channel — conversation, work, threads, artifacts.
 *
 * What matters here is not that each body renders (their contents depend on
 * relay data the mock bridge does not seed) but that the switcher behaves like
 * a reading posture rather than a location: it defaults to the conversation,
 * it is remembered per channel, and it stays out of the surfaces that already
 * have their own shape.
 */

async function openChannel(
  page: import("@playwright/test").Page,
  testId: string,
  title: string,
) {
  await page.getByTestId(testId).click();
  await expect(page.getByTestId("chat-title")).toHaveText(title);
}

test.describe("channel view lenses", () => {
  test("01 — a channel opens on its conversation", async ({ page }) => {
    await installMockBridge(page);
    await page.goto("/");
    await openChannel(page, "channel-general", "general");

    await expect(page.getByTestId("channel-view-tabs")).toBeVisible();
    await expect(page.getByTestId("channel-view-tab-all")).toHaveAttribute(
      "data-state",
      "active",
    );
    for (const tab of ["work", "threads", "artifacts"]) {
      await expect(page.getByTestId(`channel-view-tab-${tab}`)).toHaveAttribute(
        "data-state",
        "inactive",
      );
    }
  });

  test("02 — the chosen lens is remembered per channel", async ({ page }) => {
    await installMockBridge(page);
    await page.goto("/");
    await openChannel(page, "channel-general", "general");
    await page.getByTestId("channel-view-tab-threads").click();
    await expect(page.getByTestId("channel-view-tab-threads")).toHaveAttribute(
      "data-state",
      "active",
    );

    // A different channel is a different reading, so it opens on its own
    // conversation rather than inheriting the lens chosen next door.
    await openChannel(page, "channel-random", "random");
    await expect(page.getByTestId("channel-view-tab-all")).toHaveAttribute(
      "data-state",
      "active",
    );

    // Coming back restores what was being read here.
    await openChannel(page, "channel-general", "general");
    await expect(page.getByTestId("channel-view-tab-threads")).toHaveAttribute(
      "data-state",
      "active",
    );
  });

  test("03 — direct messages keep their plain header", async ({ page }) => {
    await installMockBridge(page);
    await page.goto("/");
    await openChannel(page, "channel-general", "general");
    await expect(page.getByTestId("channel-view-tabs")).toBeVisible();

    // Opened second so the assertion below cannot pass merely because the
    // header had not rendered yet: the tabs were on screen a moment ago.
    await page.getByTestId("channel-alice-tyler").click();
    await expect(page.getByTestId("chat-header-dm-avatar")).toBeVisible();
    await expect(page.getByTestId("channel-view-tabs")).toHaveCount(0);
    await expect(page.getByTestId("channel-status-strip")).toHaveCount(0);
  });
});
