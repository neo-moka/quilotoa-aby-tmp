import { expect, test } from "@playwright/test";

import { waitForAnimations } from "../helpers/animations";
import { installMockBridge } from "../helpers/bridge";

const SHOTS = "test-results/agent-runs-avatar";

// Arbitrary distinct pubkeys — the runs list only needs them as row keys.
const ABY_PUBKEY = "a".repeat(64);
const HERMES_PUBKEY = "b".repeat(64);
const JENY_PUBKEY = "c".repeat(64);

test.describe("agent runs list avatar initials", () => {
  test("two-word names get two initials sized to the avatar", async ({
    page,
  }) => {
    await installMockBridge(page, {
      managedAgents: [
        {
          pubkey: ABY_PUBKEY,
          name: "Aby",
          status: "running" as const,
          channelNames: ["agents"],
        },
        {
          pubkey: JENY_PUBKEY,
          name: "Jeny",
          status: "running" as const,
          channelNames: ["agents"],
        },
        {
          pubkey: HERMES_PUBKEY,
          name: "Hermes Agent",
          status: "running" as const,
          channelNames: ["agents"],
        },
      ],
    });

    // The right dock is open by default, resting on the runs list.
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const panel = page.getByTestId("agent-activity-panel");
    await expect(panel).toBeVisible({ timeout: 10_000 });

    const runsList = page.getByTestId("agent-runs-list");
    await expect(runsList).toBeVisible({ timeout: 10_000 });

    const hermesRow = runsList
      .getByTestId("agent-runs-list-row")
      .filter({ hasText: "Hermes Agent" });
    await expect(hermesRow).toBeVisible();

    // The two-letter monogram must render at the avatar's own text step, not
    // at the row's inherited size — inherited, "HA" overflows the h-7 circle.
    const initials = hermesRow.getByText("HA", { exact: true });
    await expect(initials).toBeVisible();
    const fontSize = await initials.evaluate((el) =>
      Number.parseFloat(window.getComputedStyle(el).fontSize),
    );
    expect(fontSize).toBeLessThan(13);

    await waitForAnimations(page);
    await panel.screenshot({ path: `${SHOTS}/01-two-word-initials.png` });
  });
});
