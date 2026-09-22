"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { MobileScreen } from "@/components/layout/MobileScreen";
import { BottomNav } from "@/components/ui/BottomNav";
import { api } from "@/lib/api";

interface Patient {
  id: string;
  name: string;
  dateOfBirth: string | null;
  consultations: Array<{ date: string }>;
}

interface PatientsResponse {
  success: boolean;
  patients: Patient[];
}

interface PatientCreateResponse {
  success: boolean;
  patient: { id: string; name: string };
}

interface ConsultationCreateResponse {
  success: boolean;
  consultation: { id: string };
}

export default function NovaConsultaPage() {
  const router = useRouter();

  const [busca, setBusca] = useState("");
  const [pacientes, setPacientes] = useState<Patient[]>([]);
  const [carregando, setCarregando] = useState(true);

  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [novoNome, setNovoNome] = useState("");
  const [novoNasc, setNovoNasc] = useState("");
  const [queixa, setQueixa] = useState("");

  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    api.get<PatientsResponse>("/api/patients").then((res) => {
      if (!("error" in res)) setPacientes(res.data.patients);
      setCarregando(false);
    });
  }, []);

  const filtrados = pacientes.filter(
    (p) => !busca || p.name.toLowerCase().includes(busca.toLowerCase())
  );

  function formatUltima(consultations: Array<{ date: string }>): string {
    if (!consultations.length) return "Primeiro atendimento";
    return new Date(consultations[0]!.date).toLocaleDateString("pt-BR");
  }

  async function handleIniciar() {
    if (!selecionado) return;
    setLoading(true);
    setErro(null);

    try {
      let patientId: string | undefined;
      let patientName: string;

      if (selecionado === "novo") {
        const nome = novoNome.trim();
        if (!nome) {
          setErro("Nome do paciente é obrigatório.");
          setLoading(false);
          return;
        }
        const patRes = await api.post<PatientCreateResponse>("/api/patients", {
          name: nome,
          ...(novoNasc ? { dateOfBirth: novoNasc } : {}),
        });
        if ("error" in patRes) {
          setErro(patRes.error ?? "Erro ao criar paciente.");
          setLoading(false);
          return;
        }
        patientId = patRes.data.patient.id;
        patientName = nome;
      } else {
        const p = pacientes.find((x) => x.id === selecionado);
        patientId = selecionado;
        patientName = p?.name ?? "";
      }

      const conRes = await api.post<ConsultationCreateResponse>("/api/consultations", {
        patientName,
        patientId,
        ...(queixa.trim() ? { chiefComplaint: queixa.trim() } : {}),
      });

      if ("error" in conRes) {
        setErro(conRes.error ?? "Erro ao criar consulta.");
        setLoading(false);
        return;
      }

      router.push(`/gravacao?id=${conRes.data.consultation.id}`);
    } catch {
      setErro("Erro de conexão com o servidor.");
      setLoading(false);
    }
  }

  return (
    <MobileScreen>
      <div className="flex flex-col min-h-screen pb-36 lg:pb-0">
        {/* Status bar */}
        <div className="h-[47px] flex items-center justify-between px-6">
          <span className="text-[16px] font-medium font-inter text-neutral-black">9:41</span>
        </div>

        {/* Header */}
        <div className="flex items-center gap-3 px-[37px] pb-5 pt-2">
          <Link href="/dashboard" className="text-secondary-500" aria-label="Voltar">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="font-inter font-bold text-xl text-secondary-500 tracking-tight">
              Nova Consulta
            </h1>
            <p className="text-xs text-secondary-400">Selecione ou busque um paciente</p>
          </div>
        </div>

        <div className="px-[37px] flex flex-col gap-6 animate-fade-in">
          {/* Busca */}
          <div className="flex items-center bg-secondary-100 rounded-[10px] h-[46px] px-3.5 gap-2">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6C7278" strokeWidth="2">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Buscar paciente..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="flex-1 bg-transparent text-sm font-inter text-secondary-500 outline-none placeholder:text-secondary-400"
            />
            {busca && (
              <button onClick={() => setBusca("")} className="text-secondary-300">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>

          {/* Novo paciente */}
          <div className="flex flex-col gap-2">
            <button
              onClick={() => setSelecionado(selecionado === "novo" ? null : "novo")}
              className={`flex items-center gap-3 border-2 rounded-[10px] p-3 transition-colors ${
                selecionado === "novo"
                  ? "border-primary bg-primary-50"
                  : "border-dashed border-secondary-100"
              }`}
            >
              <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2260FF" strokeWidth="2.5">
                  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </div>
              <div className="text-left">
                <p className="text-sm font-medium font-inter text-secondary-500">Novo paciente</p>
                <p className="text-xs text-secondary-400">Cadastrar na consulta</p>
              </div>
            </button>

            {selecionado === "novo" && (
              <div className="flex flex-col gap-2 pl-1 animate-fade-in">
                <input
                  type="text"
                  placeholder="Nome completo *"
                  value={novoNome}
                  onChange={(e) => setNovoNome(e.target.value)}
                  className="border border-secondary-100 rounded-[10px] px-3.5 py-2.5 text-sm font-inter text-secondary-500 outline-none placeholder:text-secondary-300 focus:border-primary transition-colors"
                />
                <input
                  type="date"
                  value={novoNasc}
                  onChange={(e) => setNovoNasc(e.target.value)}
                  className="border border-secondary-100 rounded-[10px] px-3.5 py-2.5 text-sm font-inter text-secondary-400 outline-none focus:border-primary transition-colors"
                />
                <p className="text-[11px] text-secondary-300 -mt-1">Data de nascimento (opcional)</p>
              </div>
            )}
          </div>

          {/* Lista de pacientes */}
          <div>
            <p className="text-xs font-medium font-jakarta text-secondary-400 mb-3 tracking-wider uppercase">
              Pacientes recentes
            </p>

            {carregando ? (
              <div className="flex items-center justify-center py-8">
                <svg className="animate-spin w-6 h-6 text-primary" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.2" />
                  <path d="M12 2a10 10 0 0110 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
              </div>
            ) : filtrados.length === 0 ? (
              <p className="text-sm text-secondary-400 text-center py-4">
                {busca ? "Nenhum paciente encontrado." : "Nenhum paciente cadastrado ainda."}
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {filtrados.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setSelecionado(p.id)}
                    className={`flex items-center gap-3 p-3 rounded-[10px] border transition-all ${
                      selecionado === p.id
                        ? "border-primary bg-primary-50"
                        : "border-secondary-100 bg-white"
                    }`}
                  >
                    <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2260FF" strokeWidth="2">
                        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" />
                      </svg>
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-sm font-medium font-inter text-secondary-500">{p.name}</p>
                      <p className="text-xs text-secondary-400">Última: {formatUltima(p.consultations)}</p>
                    </div>
                    {selecionado === p.id && (
                      <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center shrink-0">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Queixa principal */}
          {selecionado && (
            <div className="flex flex-col gap-1 animate-fade-in">
              <span className="text-xs font-medium font-jakarta text-secondary-400">
                Queixa principal (opcional)
              </span>
              <textarea
                placeholder="Ex: Dor de cabeça há 3 dias..."
                value={queixa}
                onChange={(e) => setQueixa(e.target.value)}
                rows={3}
                className="border border-secondary-100 rounded-[10px] px-3.5 py-3 text-sm font-inter text-secondary-500 input-shadow outline-none resize-none placeholder:text-secondary-300 focus:border-primary transition-colors"
              />
            </div>
          )}

          {/* Erro */}
          {erro && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
              {erro}
            </div>
          )}

          <Button
            type="button"
            onClick={handleIniciar}
            loading={loading}
            disabled={!selecionado || loading}
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <circle cx="12" cy="12" r="10" /><path d="M10 8l6 4-6 4V8z" fill="white" stroke="none" />
              </svg>
            }
          >
            Iniciar Gravação
          </Button>
        </div>
      </div>

      <BottomNav actionLabel="Nova Consulta" actionHref="/nova-consulta" />
    </MobileScreen>
  );
}
