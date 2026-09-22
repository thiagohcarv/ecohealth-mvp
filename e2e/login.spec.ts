import { test, expect } from "@playwright/test";
import { BACKEND, mockConsultations } from "./helpers/auth";

/**
 * Teste 2 — Login
 *
 * Preenche email e senha, mocka o endpoint de login, verifica redirect para /dashboard.
 */
test("Login: preenche credenciais e redireciona para /dashboard", async ({ page }) => {
  // Mock do endpoint de login — retorna token falso
  await page.route(`${BACKEND}/api/auth/login`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        token: "fake.test.token",
        userId: "usr_test",
        nome: "Dr. Playwright",
      }),
    })
  );

  // Mock do dashboard para evitar erros de rede após redirect
  await mockConsultations(page);

  await page.goto("/login");

  await expect(page.getByText("Entrar na sua Conta")).toBeVisible();

  await page.getByPlaceholder("seuemail@exemplo.com").fill("dr@ecohealth.com");
  await page.getByPlaceholder("••••••••").fill("senha123");
  await page.getByRole("button", { name: "Entrar" }).click();

  await page.waitForURL(/\/dashboard/);
  await expect(page.getByText("Seus resultados")).toBeVisible();
});
