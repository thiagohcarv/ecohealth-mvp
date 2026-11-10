import { test, expect } from "@playwright/test";
import { BACKEND, mockBilling, mockConsultations } from "./helpers/auth";

/**
 * Cadastro completo obrigatório
 *
 * Conta sem CPF/data de nascimento não acessa o sistema: vai para /completar-cadastro
 * e só volta ao destino depois de salvar os dados.
 */
test("Sem CPF e nascimento: bloqueia acesso até completar o cadastro", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("eco_token", "fake.test.token");
    localStorage.setItem("eco_user", JSON.stringify({ userId: "usr_incompleto", nome: "Dr. Incompleto" }));
  });
  await mockConsultations(page);
  await mockBilling(page);

  let completo = false;
  await page.route(`${BACKEND}/api/auth/me`, (route) => {
    if (route.request().method() === "PATCH") completo = true;
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        user: {
          id: "usr_incompleto",
          email: "inc@ecohealth.com",
          name: "Dr. Incompleto",
          crm: "SP-123",
          isVerified: true,
          cpf: completo ? "39053344705" : null,
          birthDate: completo ? "1985-05-15T00:00:00.000Z" : null,
        },
      }),
    });
  });

  await page.goto("/dashboard");
  await page.waitForURL(/\/completar-cadastro/);
  await expect(page.getByRole("heading", { name: "Complete seu cadastro" })).toBeVisible();

  // Validação no navegador
  await page.getByPlaceholder("000.000.000-00").fill("111.111.111-11");
  await page.getByPlaceholder("DD/MM/AAAA").fill("15/05/1985");
  await page.getByRole("button", { name: "Salvar e continuar" }).click();
  await expect(page.getByText("CPF inválido")).toBeVisible();

  await page.getByPlaceholder("000.000.000-00").fill("390.533.447-05");
  await page.getByRole("button", { name: "Salvar e continuar" }).click();
  await page.waitForURL(/\/dashboard/);
});
