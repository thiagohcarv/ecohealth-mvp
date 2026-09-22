import { test, expect } from "@playwright/test";
import { BACKEND } from "./helpers/auth";

/**
 * Teste 1 — Fluxo LGPD + Cadastro
 *
 * Pré-condição: usuário não autenticado (sem eco_token no localStorage).
 * Fluxo: /lgpd → aceita termos → /cadastro → preenche formulário → /verificar
 */
test("LGPD + Cadastro: aceite, preenchimento e redirect para /verificar", async ({ page }) => {
  // ── 1. Tela LGPD ──────────────────────────────────────────────────────────
  await page.goto("/lgpd");

  await expect(page.getByText("Privacidade & LGPD")).toBeVisible();

  // Botão "Continuar" desabilitado antes do checkbox
  const continuar = page.getByRole("button", { name: /Continuar/i });
  await expect(continuar).toBeDisabled();

  // Marca o checkbox de aceite
  await page.getByText("Li e concordo com a Política de Privacidade").click();
  await expect(continuar).toBeEnabled();

  // Clica em Continuar → seta eco_lgpd_pending, redireciona para /cadastro
  await continuar.click();
  await page.waitForURL(/\/cadastro/);

  // ── 2. Tela Cadastro ──────────────────────────────────────────────────────
  await expect(page.getByText("Crie sua conta")).toBeVisible();

  // Garante que o guard do cadastro não redirecionou de volta para /lgpd
  await expect(page).toHaveURL(/\/cadastro/);

  // Preenche o formulário
  await page.getByPlaceholder("Dr. João Silva").fill("Dr. Playwright Teste");
  await page.getByPlaceholder("000.000.000-00").fill("123.456.789-00");
  await page.getByPlaceholder("seuemail@exemplo.com").fill("playwright@ecohealth.com");
  await page.getByPlaceholder("123456").fill("99999");
  await page.getByPlaceholder("Mínimo 6 caracteres").fill("senha123");

  // Mock do endpoint de registro
  await page.route(`${BACKEND}/api/auth/register`, (route) =>
    route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        userId: "usr_new",
        message: "Código de verificação enviado para o email.",
      }),
    })
  );

  await page.getByRole("button", { name: "Criar conta" }).click();

  // Redireciona para /verificar após cadastro bem-sucedido
  await page.waitForURL(/\/verificar/);
  await expect(page.getByText("Verifique sua conta!")).toBeVisible();
});
