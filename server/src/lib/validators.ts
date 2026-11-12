/** Utilitários de validação/formatação de dados cadastrais. */

export const onlyDigits = (v: string | null | undefined): string => (v ?? "").replace(/\D/g, "");

/** Aceita "dd/mm/aaaa" ou "aaaa-mm-dd". Retorna null se inválida ou no futuro. */
export function parseBirthDate(v: string | null | undefined): Date | null {
  if (!v) return null;
  const s = v.trim();
  let y: number, m: number, d: number;
  let match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  if (match) {
    d = +match[1]!; m = +match[2]!; y = +match[3]!;
  } else if ((match = /^(\d{4})-(\d{2})-(\d{2})/.exec(s))) {
    y = +match[1]!; m = +match[2]!; d = +match[3]!;
  } else {
    return null;
  }
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  if (date > new Date() || y < 1900) return null;
  return date;
}

/** Validação de CPF pelos dígitos verificadores. */
export function isValidCpf(cpf: string): boolean {
  const c = onlyDigits(cpf);
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
  const calc = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(c[i]) * (len + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === Number(c[9]) && calc(10) === Number(c[10]);
}

/**
 * Remove títulos do início do nome ("Dr.", "Dra.", "Dr(a).", "Doutor", "Doutora"), inclusive repetidos.
 * Contas antigas podem ter o nome salvo com o título; o cadastro de prescritor exige nome civil.
 */
export function nomeSemTitulo(nome: string): string {
  let s = nome.trim();
  const titulo = /^(dr\(a\)|dra|dr|doutora|doutor)\.?\s+/i;
  while (titulo.test(s)) s = s.replace(titulo, "").trim();
  return s.replace(/\s+/g, " ");
}
