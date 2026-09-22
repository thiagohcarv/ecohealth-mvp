import { Page } from "@playwright/test";

export const BACKEND = "http://localhost:3001";

/** Injects a fake token and user into localStorage before the page loads. */
export async function setupAuth(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem("eco_token", "fake.test.token");
    localStorage.setItem(
      "eco_user",
      JSON.stringify({ userId: "usr_test", nome: "Dr. Playwright" })
    );
  });
}

/** Mocks GET /api/consultations to return an empty list. */
export async function mockConsultations(page: Page): Promise<void> {
  await page.route(`${BACKEND}/api/consultations*`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, consultations: [], total: 0 }),
    })
  );
}

/** Mocks GET /api/patients to return an empty list. */
export async function mockPatients(page: Page): Promise<void> {
  await page.route(`${BACKEND}/api/patients*`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, patients: [] }),
    })
  );
}

/** Mocks GET /api/billing/status to return a trial plan. */
export async function mockBilling(page: Page): Promise<void> {
  await page.route(`${BACKEND}/api/billing/status*`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        plan: "trial",
        daysRemaining: 28,
        isExpired: false,
        trialEndsAt: new Date(Date.now() + 28 * 864e5).toISOString(),
      }),
    })
  );
}
