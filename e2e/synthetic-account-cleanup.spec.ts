import { expect, test } from "@playwright/test";

import { deleteE2eSyntheticAccount, userOwnedCounts } from "./support/database.js";
import { accountFor, provisionAccount } from "./support/journey.js";

test("synthetic account cleanup bypasses public auth routes and removes owned records", async ({
  page
}, testInfo) => {
  const account = accountFor(testInfo, "direct-cleanup");
  const userId = await provisionAccount(page, account);

  await deleteE2eSyntheticAccount(account.email);

  const counts = await userOwnedCounts(userId);
  for (const [recordType, count] of Object.entries(counts)) {
    expect(count, `${recordType} should be removed`).toBe(0);
  }

  await expect(deleteE2eSyntheticAccount("learner@example.com")).rejects.toThrow(
    /synthetic Playwright account/u
  );
});
