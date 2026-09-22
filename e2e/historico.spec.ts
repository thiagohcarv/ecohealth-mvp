import { test, expect } from "@playwright/test";
import { setupAuth, mockConsultations } from "./helpers/auth";

/**
 * Teste 4 — Histórico
 *
 * Usuário autenticado acessa /historico.
 * Verifica que a lista carrega (loading state ou consultas).
 */
test("Histórico: tela carrega com cabeçalho e filtros", async ({ page }) => {
  await setupAuth(page);
  await mockConsultations(page);

  await page.goto("/historico");

  // Heading
  await expect(page.getByRole("heading", { name: "Histórico" })).toBeVisible();

  // Campo de busca
  await expect(page.getByPlaceholder("Buscar paciente ou queixa...")).toBeVisible();

  // Filtros de status presentes
  await expect(page.getByRole("button", { name: "Todas" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Concluídas" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Pendentes" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Erros" })).toBeVisible();

  // Com lista vazia, mostra o sub-título de total
  await expect(page.getByText(/0 concluídas · 0 total/)).toBeVisible();
});
