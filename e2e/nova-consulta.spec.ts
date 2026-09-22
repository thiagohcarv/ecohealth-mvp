import { test, expect } from "@playwright/test";
import { setupAuth, mockPatients, mockConsultations } from "./helpers/auth";

/**
 * Teste 3 — Nova Consulta
 *
 * Usuário autenticado acessa /nova-consulta.
 * Verifica que a tela carrega com campo de busca de pacientes.
 */
test("Nova Consulta: tela carrega com campo de busca de pacientes", async ({ page }) => {
  await setupAuth(page);
  await mockPatients(page);
  await mockConsultations(page);

  await page.goto("/nova-consulta");

  // Heading da tela
  await expect(page.getByRole("heading", { name: "Nova Consulta" })).toBeVisible();

  // Campo de busca de pacientes
  await expect(page.getByPlaceholder("Buscar paciente...")).toBeVisible();

  // Opção de novo paciente sempre presente
  await expect(page.getByText("Novo paciente")).toBeVisible();
  await expect(page.getByText("Cadastrar na consulta")).toBeVisible();
});
