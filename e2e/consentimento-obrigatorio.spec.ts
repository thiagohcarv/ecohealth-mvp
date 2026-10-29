import { test, expect } from "@playwright/test";
import { BACKEND, setupAuth, mockPatients, mockConsultations, mockLgpdConsent } from "./helpers/auth";

/**
 * Aceite obrigatório (LGPD + Termos de Uso)
 *
 * Reproduz o caso do André: usuário autenticado SEM aceite tenta iniciar uma
 * consulta. A API responde 403 LGPD_CONSENT_REQUIRED → o app leva para /lgpd,
 * o usuário aceita os dois itens e volta para /nova-consulta.
 */
test("Sem aceite: iniciar consulta leva a /lgpd e volta após aceitar os dois itens", async ({ page }) => {
  await setupAuth(page);
  await mockConsultations(page); // (a rota de criação é sobrescrita abaixo)

  await page.route(`${BACKEND}/api/patients*`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        patients: [{ id: "pat_1", name: "Maria Teste", dateOfBirth: null, consultations: [] }],
      }),
    })
  );

  // POST de consulta barrado por falta de aceite (como em produção)
  await page.route(`${BACKEND}/api/consultations`, (route) =>
    route.request().method() === "POST"
      ? route.fulfill({
          status: 403,
          contentType: "application/json",
          body: JSON.stringify({
            error: "É necessário aceitar a Política de Privacidade (LGPD) e os Termos de Uso para continuar.",
            code: "LGPD_CONSENT_REQUIRED",
            consentUrl: "/lgpd",
          }),
        })
      : route.fallback()
  );

  // POST de aceite: confere que o app envia OS DOIS aceites
  let consentBody: unknown = null;
  await page.route(`${BACKEND}/api/auth/lgpd-consent`, (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    consentBody = route.request().postDataJSON();
    return route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ success: true, consent: { id: "c1", version: "2.0" } }),
    });
  });

  await page.goto("/nova-consulta");
  await page.getByRole("button", { name: /Maria Teste/ }).click();
  await page.getByRole("button", { name: /Iniciar Gravação/ }).click();

  // Barrado → tela de aceite
  await page.waitForURL(/\/lgpd\?next=%2Fnova-consulta|\/lgpd\?next=\/nova-consulta/);
  await expect(page.getByText("Privacidade & LGPD")).toBeVisible();
  await expect(page.getByText("9. Termos de Uso")).toBeVisible();

  const continuar = page.getByRole("button", { name: /Continuar/i });
  await expect(continuar).toBeDisabled();
  await page.getByRole("checkbox", { name: /Política de Privacidade/ }).click();
  await page.getByRole("checkbox", { name: /Termos de Uso/ }).click();
  await continuar.click();

  // Volta para a tela de origem e o aceite enviado contém os dois itens
  await page.waitForURL(/\/nova-consulta/);
  expect(consentBody).toEqual({ acceptLgpd: true, acceptTerms: true });
});

test("Login sem aceite vigente: vai para /lgpd em vez do dashboard", async ({ page }) => {
  await page.route(`${BACKEND}/api/auth/login`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, token: "fake.test.token", userId: "usr_test", nome: "André" }),
    })
  );
  await mockLgpdConsent(page, false);
  await mockConsultations(page);

  await page.goto("/login");
  await page.getByPlaceholder("seuemail@exemplo.com").fill("andre@ecohealth.com");
  await page.getByPlaceholder("••••••••").fill("senha123");
  await page.getByRole("button", { name: "Entrar" }).click();

  await page.waitForURL(/\/lgpd/);
  await expect(page.getByText("Privacidade & LGPD")).toBeVisible();
});
