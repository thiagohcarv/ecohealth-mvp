import { test, expect } from "@playwright/test";
import { setupAuth, mockBilling } from "./helpers/auth";

/**
 * Teste 5 — Configurações
 *
 * Usuário autenticado acessa /configuracoes.
 * Verifica card de Plano & Billing e toggle de idioma.
 */
test("Configurações: plano e toggle de idioma presentes", async ({ page }) => {
  await setupAuth(page);
  await mockBilling(page);

  await page.goto("/configuracoes");

  // Heading da tela
  await expect(page.getByRole("heading", { name: "Configurações" })).toBeVisible();

  // Card de plano (Plano Gratuito — estado trial)
  await expect(page.getByText("Plano Gratuito")).toBeVisible();

  // Botão de upgrade para Pro
  await expect(
    page.getByRole("button", { name: /Assinar Plano Pro/i })
  ).toBeVisible();

  // Seção Preferências
  await expect(page.getByText("Preferências")).toBeVisible();

  // Toggle de idioma: botões PT e EN
  await expect(page.getByRole("button", { name: "PT" })).toBeVisible();
  await expect(page.getByRole("button", { name: "EN" })).toBeVisible();
});
