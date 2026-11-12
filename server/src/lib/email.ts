/**
 * Envio de e-mails transacionais (código de verificação) pela API HTTP do Resend.
 * Ligado apenas quando RESEND_API_KEY e EMAIL_FROM estão definidas; sem elas o sistema
 * mantém o modo alpha (código fixo, nada é enviado).
 *
 * EMAIL_FROM precisa usar um domínio verificado no Resend, ex.: "EcoHealth <nao-responda@ecohealth.com.br>".
 */

export function emailEnabled(): boolean {
  return Boolean(process.env["RESEND_API_KEY"]?.trim() && process.env["EMAIL_FROM"]?.trim());
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** Envia o código de verificação. Retorna true se o provedor aceitou o envio. */
export async function sendOtpEmail(to: string, code: string): Promise<boolean> {
  if (!emailEnabled()) return false;
  const safe = escapeHtml(code);
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env["RESEND_API_KEY"]!.trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env["EMAIL_FROM"]!.trim(),
        to: [to],
        subject: `Seu código de verificação EcoHealth: ${code}`,
        text: `Seu código de verificação do EcoHealth é ${code}.\n\nEle vale por 10 minutos. Se você não pediu este código, ignore este e-mail.`,
        html:
          `<p>Seu código de verificação do EcoHealth é:</p>` +
          `<p style="font-size:28px;font-weight:700;letter-spacing:6px;font-family:monospace">${safe}</p>` +
          `<p>Ele vale por 10 minutos. Se você não pediu este código, ignore este e-mail.</p>`,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      console.error(`[EMAIL] Falha no envio (HTTP ${res.status})`); // sem logar e-mail nem código
      return false;
    }
    return true;
  } catch (err) {
    console.error("[EMAIL] Erro no envio:", err instanceof Error ? err.message : err);
    return false;
  }
}
