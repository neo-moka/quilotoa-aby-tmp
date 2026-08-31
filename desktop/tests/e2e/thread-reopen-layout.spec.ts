import { expect, test } from "@playwright/test";

import { installMockBridge } from "../helpers/bridge";
import { waitForAnimations } from "../helpers/animations";

async function waitForMockLiveSubscription(
  page: import("@playwright/test").Page,
  channelName: string,
) {
  await expect
    .poll(async () => {
      return page.evaluate(
        ({ ch }) =>
          (
            window as Window & {
              __BUZZ_E2E_HAS_MOCK_LIVE_SUBSCRIPTION__?: (input: {
                channelName: string;
              }) => boolean;
            }
          ).__BUZZ_E2E_HAS_MOCK_LIVE_SUBSCRIPTION__?.({ channelName: ch }) ??
          false,
        { ch: channelName },
      );
    })
    .toBe(true);
}

async function emitMockMessage(
  page: import("@playwright/test").Page,
  channelName: string,
  content: string,
  options?: { parentEventId?: string },
): Promise<{ id: string }> {
  const event = await page.evaluate(
    ({ ch, msg, parentEventId }) => {
      return (
        window as Window & {
          __BUZZ_E2E_EMIT_MOCK_MESSAGE__?: (input: {
            channelName: string;
            content: string;
            parentEventId?: string | null;
          }) => { id: string };
        }
      ).__BUZZ_E2E_EMIT_MOCK_MESSAGE__?.({
        channelName: ch,
        content: msg,
        parentEventId: parentEventId ?? undefined,
      });
    },
    { ch: channelName, msg: content, parentEventId: options?.parentEventId },
  );
  if (!event) throw new Error("Mock message emit failed");
  return event;
}

// Regression: closing the thread panel and reopening it must restore the
// split layout — the animated right pane once re-entered wider than the
// available space and pushed itself past the window edge.
test("thread panel reopen keeps its layout inside the viewport", async ({
  page,
}) => {
  await installMockBridge(page);
  await page.goto("/");
  await page.getByTestId("channel-general").click();
  await expect(page.getByTestId("chat-title")).toHaveText("general");
  await waitForMockLiveSubscription(page, "general");

  const root = await emitMockMessage(page, "general", "Thread reopen root");
  await emitMockMessage(page, "general", "First reply", {
    parentEventId: root.id,
  });

  const threadSummary = page.getByTestId("message-thread-summary").first();
  const panel = page.getByTestId("message-thread-panel");

  // The user-reported repro had the right dock closed — cover that state.
  await page.getByTestId("right-dock-close").click();
  await expect(page.getByTestId("right-dock")).not.toBeVisible();
  await waitForAnimations(page);

  await threadSummary.click();
  await expect(panel).toBeVisible();
  await waitForAnimations(page);
  const firstOpen = await panel.boundingBox();

  await panel.getByTestId("auxiliary-panel-close").click();
  await expect(panel).not.toBeVisible();
  await waitForAnimations(page);

  await threadSummary.click();
  await expect(panel).toBeVisible();
  await waitForAnimations(page);
  const reopened = await panel.boundingBox();

  const viewportWidth = page.viewportSize()?.width ?? 0;
  expect(firstOpen).not.toBeNull();
  expect(reopened).not.toBeNull();
  if (!firstOpen || !reopened) throw new Error("Thread panel not measurable");

  await page.screenshot({
    path: "test-results/screenshots/thread-reopen.png",
  });

  // Fully inside the window, and the same geometry as the first open.
  expect(reopened.x + reopened.width).toBeLessThanOrEqual(viewportWidth + 1);
  expect(Math.abs(reopened.width - firstOpen.width)).toBeLessThanOrEqual(2);
  expect(Math.abs(reopened.x - firstOpen.x)).toBeLessThanOrEqual(2);
});
