"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { MobileScreen } from "@/components/layout/MobileScreen";
import { api } from "@/lib/api";

const LGPD_VERSION = "2.0"; // manter igual a CURRENT_CONSENT_VERSION (server/src/lib/consent.ts)

export default function LgpdPage() {
  const router = useRouter();
  const [acceptedLgpd, setAcceptedLgpd] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const canContinue = acceptedLgpd && acceptedTerms;
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");

  async function handleContinuar() {
    if (!canContinue) return;
    setLoading(true);

    const token =
      typeof window !== "undefined" ? localStorage.getItem("eco_token") : null;

    if (token) {
      // Usuário autenticado — salva consentimento agora
      const res = await api.post("/api/auth/lgpd-consent", { acceptLgpd: true, acceptTerms: true });
      if ("error" in res) {
        setErro(res.error ?? "Não foi possível registrar o aceite. Tente novamente.");
        setLoading(false);
        return;
      }
      // Volta para a tela de origem (ex.: /nova-consulta), só aceita caminho interno
      const next = new URLSearchParams(window.location.search).get("next");
      router.push(next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard");
    } else {
      // Pré-cadastro — salva pendente no localStorage
      localStorage.setItem("eco_lgpd_pending", LGPD_VERSION);
      router.push("/cadastro");
    }

    setLoading(false);
  }

  return (
    <MobileScreen>
      <div className="flex flex-col min-h-screen">
        {/* Status bar */}
        <div className="h-[47px] flex items-center px-6">
          <span className="text-[16px] font-medium font-inter text-neutral-black" suppressHydrationWarning>
            {new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>

        {/* Header */}
        <div className="px-6 pb-2 pt-2">
          <div className="w-8 h-8 rounded-xl bg-primary-50 flex items-center justify-center mb-4">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2260FF" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <h1 className="font-inter font-bold text-2xl text-secondary-500 tracking-tight leading-snug">
            Privacidade &amp; LGPD
          </h1>
          <p className="text-xs text-secondary-400 mt-1">
            Antes de continuar, leia como seus dados são tratados.
          </p>
        </div>

        {/* Conteúdo LGPD */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="bg-secondary-100 rounded-2xl p-5 text-secondary-500 text-[13px] font-inter leading-relaxed flex flex-col gap-5">

            <Section title="1. Quem somos">
              <p>
                <strong>EcoHealth Tecnologia Ltda.</strong> — plataforma de documentação médica assistida
                por inteligência artificial. Atuamos como <em>controladora</em> de dados nos termos da
                Lei Geral de Proteção de Dados (LGPD, Lei nº 13.709/2018).
              </p>
            </Section>

            <Section title="2. Dados coletados">
              <ul className="list-disc pl-4 flex flex-col gap-1.5">
                <li><strong>Gravação de áudio</strong> das consultas médicas realizadas no aplicativo.</li>
                <li><strong>Transcrição automática</strong> de voz gerada por inteligência artificial (OpenAI Whisper).</li>
                <li><strong>Dados de saúde dos pacientes</strong> presentes na transcrição e nas notas SOAP (dados sensíveis, art. 11 LGPD).</li>
                <li><strong>Dados cadastrais do médico</strong>: nome, CRM, e-mail, CPF.</li>
                <li><strong>Dados de acesso</strong>: endereço IP, tipo de dispositivo, horário de conexão.</li>
              </ul>
            </Section>

            <Section title="3. Finalidade do tratamento">
              <ul className="list-disc pl-4 flex flex-col gap-1.5">
                <li>Geração automatizada de notas SOAP e documentação clínica.</li>
                <li>Armazenamento de histórico de consultas para o médico usuário.</li>
                <li>Assinatura digital de prontuários (mock ICP-Brasil nesta versão alpha).</li>
                <li>Melhoria contínua dos modelos de IA utilizados, de forma anonimizada.</li>
              </ul>
            </Section>

            <Section title="4. Base legal (LGPD)">
              <ul className="list-disc pl-4 flex flex-col gap-1.5">
                <li>
                  <strong>Art. 7.º, II</strong> — execução de contrato de serviço solicitado pelo
                  titular.
                </li>
                <li>
                  <strong>Art. 11, § 1.º</strong> — tratamento de dados de saúde para tutela da
                  saúde, exclusivamente por profissional habilitado.
                </li>
              </ul>
            </Section>

            <Section title="5. Compartilhamento">
              <ul className="list-disc pl-4 flex flex-col gap-1.5">
                <li>
                  <strong>OpenAI</strong> — transcrição (Whisper) e estruturação de notas (GPT-4o),
                  regida pela Política de Privacidade OpenAI Business.
                </li>
                <li>Não vendemos nem cedemos dados a terceiros para fins publicitários.</li>
              </ul>
            </Section>

            <Section title="6. Retenção dos dados">
              <p>
                Os dados médicos são mantidos por <strong>5 (cinco) anos</strong>, em conformidade
                com a Resolução CFM nº 1.821/2007 (prazo mínimo de guarda de prontuários). Após esse
                período, os dados são anonimizados ou excluídos.
              </p>
            </Section>

            <Section title="7. Seus direitos (art. 18 LGPD)">
              <ul className="list-disc pl-4 flex flex-col gap-1.5">
                <li>Confirmar a existência do tratamento.</li>
                <li>Acessar os dados armazenados sobre você.</li>
                <li>Corrigir dados incompletos ou desatualizados.</li>
                <li>Solicitar anonimização, bloqueio ou eliminação de dados desnecessários.</li>
                <li>Portabilidade dos dados a outro fornecedor.</li>
                <li>Revogar o consentimento a qualquer momento via <strong>configuracoes@ecohealth.com.br</strong>.</li>
              </ul>
            </Section>

            <Section title="8. Segurança">
              <p>
                Utilizamos criptografia em trânsito (HTTPS/TLS 1.3), autenticação via JWT e
                segregação de dados por médico. Incidentes de segurança são comunicados à ANPD e
                aos titulares conforme exigido pela LGPD.
              </p>
            </Section>

            <Section title="9. Termos de Uso">
              <ul className="list-disc pl-4 flex flex-col gap-1.5">
                <li>
                  <strong>Responsabilidade clínica:</strong> o médico é o único responsável por revisar,
                  editar e validar notas SOAP, códigos CID-10 e qualquer conteúdo gerado por IA. A IA pode
                  errar e não substitui o julgamento clínico.
                </li>
                <li>
                  <strong>Consentimento do paciente:</strong> o médico deve informar o paciente e obter
                  seu consentimento para a gravação da consulta, conforme a LGPD e as normas do CFM.
                </li>
                <li>
                  <strong>Uso profissional:</strong> acesso exclusivo a médicos com CRM ativo. A conta é
                  pessoal e intransferível; não compartilhe suas credenciais.
                </li>
                <li>
                  <strong>Versão alpha:</strong> funcionalidades podem mudar ou ficar indisponíveis. A
                  assinatura digital é simulada, <strong>sem validade jurídica</strong>, e não deve ser
                  usada como documento oficial.
                </li>
                <li>
                  <strong>Uso adequado:</strong> é proibido inserir dados para fins alheios à prática
                  médica, tentar burlar a segurança ou realizar engenharia reversa da plataforma.
                </li>
              </ul>
            </Section>

            <div className="text-[11px] text-secondary-400 border-t border-secondary-100 pt-3 mt-1">
              Versão {LGPD_VERSION} · Vigente a partir de 29/10/2026 ·{" "}
              <strong>EcoHealth Tecnologia Ltda.</strong>
            </div>
          </div>
        </div>

        {/* Footer de aceite */}
        <div className="px-6 py-5 border-t border-secondary-100 bg-white">
          {/* Aceites obrigatórios (ambos) */}
          <CheckRow checked={acceptedLgpd} onToggle={() => setAcceptedLgpd((v) => !v)}>
            Li e concordo com a <strong>Política de Privacidade</strong> e o tratamento de dados
            pessoais e de saúde conforme a LGPD.
          </CheckRow>
          <CheckRow checked={acceptedTerms} onToggle={() => setAcceptedTerms((v) => !v)}>
            Li e aceito os <strong>Termos de Uso</strong> da EcoHealth.
          </CheckRow>
          <p className="text-[11px] text-secondary-400 font-inter mb-4">
            Os dois aceites são obrigatórios para usar o EcoHealth.
          </p>

          {erro && <p className="text-xs text-red-500 font-inter text-center">{erro}</p>}

          {/* Botão Continuar */}
          <button
            onClick={handleContinuar}
            disabled={!canContinue || loading}
            className={`w-full h-12 rounded-3xl text-sm font-semibold font-inter transition-all ${
              canContinue
                ? "bg-primary text-white shadow-md active:scale-[0.98]"
                : "bg-secondary-100 text-secondary-300 cursor-not-allowed"
            }`}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.3" />
                  <path d="M12 2a10 10 0 0110 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
                Aguarde...
              </span>
            ) : (
              "Continuar →"
            )}
          </button>

          <p className="text-[11px] text-secondary-300 text-center mt-3 leading-snug">
            Ao aceitar, você confirma ter lido e compreendido os termos acima.
            <br />O registro desta aceitação inclui data, hora e IP de acesso.
          </p>
        </div>
      </div>
    </MobileScreen>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="font-semibold text-secondary-500 mb-1.5">{title}</p>
      <div className="text-secondary-400">{children}</div>
    </div>
  );
}

function CheckRow({
  checked,
  onToggle,
  children,
}: {
  checked: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <button type="button" role="checkbox" aria-checked={checked} onClick={onToggle} className="flex items-start gap-3 w-full mb-3">
      <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
        checked ? "bg-primary border-primary" : "border-secondary-300"
      }`}>
        {checked && (
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </div>
      <span className="text-sm font-inter text-secondary-500 text-left leading-snug">{children}</span>
    </button>
  );
}
