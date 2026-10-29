import { test, expect } from "@playwright/test";
import { BACKEND, setupAuth, mockBilling } from "./helpers/auth";

/**
 * Teste 5 — Configurações
 *
 * Só há controles que funcionam: plano (sem botão de pagamento por enquanto), dados da conta e sair.
 */
test("Configurações: plano, conta e sessão", async ({ page }) => {
  await setupAuth(page);
  await mockBilling(page);
  await page.route(`${BACKEND}/api/auth/me`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        user: { id: "usr_test", email: "dr@ecohealth.com", name: "Dr. Playwright", crm: "123456/SP", isVerified: true },
      }),
    })
  );

  await page.goto("/configuracoes");

  await expect(page.getByRole("heading", { name: "Configurações" })).toBeVisible();
  await expect(page.getByText("Plano Gratuito")).toBeVisible();
  await expect(page.getByText("Plano Pro — em breve")).toBeVisible();

  // Dados reais da conta
  await expect(page.getByText("dr@ecohealth.com")).toBeVisible();
  await expect(page.getByText("123456/SP")).toBeVisible();

  // Sem controles que não funcionam
  await expect(page.getByRole("button", { name: /Assinar/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "PT" })).toHaveCount(0);

  await expect(page.getByRole("button", { name: "Sair" })).toBeVisible();
});
