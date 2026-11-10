"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { getUser } from "@/lib/auth";
import {
  extractItemsCount,
  extractPrescriptionId,
  loadMemed,
  openPrescription,
  setMemedHandlers,
  type MemedPaciente,
  type MemedWorkplace,
} from "@/lib/memed";

interface PrescriptionItem {
  id: string;
  memedId: string;
  itemsCount: number | null;
  printedAt: string;
  deletedAt: string | null;
}

interface TokenResponse {
  success: boolean;
  token: string;
  scriptUrl: string;
  workplace: MemedWorkplace | null;
}

interface PatientResponse {
  success: boolean;
  missing: string[];
  patient: MemedPaciente;
  current: { id: string; sex: string | null };
}

type Estado = "carregando" | "incompleto" | "pronto" | "erro";

/**
 * Seção "Prescrição" da consulta. Só aparece quando o backend tem as chaves da Memed configuradas;
 * caso contrário não renderiza nada e a tela fica exatamente como antes.
 */
export function MemedPrescricao({ consultationId }: { consultationId: string }) {
  const [enabled, setEnabled] = useState(false);
  const [estado, setEstado] = useState<Estado>("carregando");
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [abrindo, setAbrindo] = useState(false);
  const [lista, setLista] = useState<PrescriptionItem[]>([]);
  const [pedirSexo, setPedirSexo] = useState<{ patientId: string } | null>(null);
  const iniciado = useRef(false);

  const carregarLista = useCallback(async () => {
    const r = await api.get<{ prescriptions: PrescriptionItem[] }>(
      `/api/memed/consultations/${consultationId}/prescriptions`
    );
    if (!r.error && r.data) setLista(r.data.prescriptions);
  }, [consultationId]);

  // Eventos da Memed → prontuário (prescricaoImpressa salva; prescricaoExcluida sincroniza a exclusão)
  useEffect(() => {
    setMemedHandlers({
      onPrinted: async (data) => {
        const memedId = extractPrescriptionId(data);
        if (!memedId) return console.warn("[Memed] prescricaoImpressa sem id", data);
        const r = await api.post(`/api/memed/consultations/${consultationId}/prescriptions`, {
          memedId,
          itemsCount: extractItemsCount(data),
          payload: data,
        });
        if (r.error) setMensagem(`Receita emitida, mas não foi salva no prontuário: ${r.error}`);
        void carregarLista();
      },
      onDeleted: async (data) => {
        const memedId = extractPrescriptionId(data);
        if (!memedId) return;
        await api.del(`/api/memed/prescriptions/${encodeURIComponent(memedId)}`);
        void carregarLista();
      },
      onHide: () => setAbrindo(false),
    });
    return () => setMemedHandlers(null);
  }, [consultationId, carregarLista]);

  // Token do prescritor (sempre atualizado) + script carregado uma única vez
  const conectar = useCallback(async () => {
    setEstado("carregando");
    setMensagem(null);
    const tk = await api.post<TokenResponse>("/api/memed/token", {});
    if (tk.error || !tk.data) {
      // CPF e nascimento já são garantidos no acesso; aqui sobram casos como nome sem sobrenome ou CRM inválido
      setEstado(tk.code === "PRESCRIBER_INCOMPLETE" ? "incompleto" : "erro");
      setMensagem(tk.error ?? "Não foi possível conectar à Memed.");
      return;
    }
    try {
      await loadMemed({
        token: tk.data.token,
        scriptUrl: tk.data.scriptUrl,
        userId: getUser()?.userId ?? "anon",
        workplace: tk.data.workplace,
      });
      setEstado("pronto");
    } catch (err) {
      setEstado("erro");
      setMensagem(err instanceof Error ? err.message : "Falha ao carregar a Memed.");
    }
  }, []);

  // Início do atendimento
  useEffect(() => {
    if (iniciado.current) return;
    iniciado.current = true;

    (async () => {
      const cfg = await api.get<{ enabled: boolean }>("/api/memed/config");
      if (cfg.error || !cfg.data?.enabled) return; // integração desligada: nada aparece
      setEnabled(true);
      void carregarLista();
      await conectar();
    })();
  }, [carregarLista, conectar]);


  async function abrir() {
    setMensagem(null);
    setAbrindo(true);
    const r = await api.get<PatientResponse>(`/api/memed/consultations/${consultationId}/patient`);
    if (r.error || !r.data) {
      setMensagem(r.error ?? "Erro ao carregar o paciente.");
      setAbrindo(false);
      return;
    }
    if (r.data.missing.includes("sex")) {
      setPedirSexo({ patientId: r.data.current.id });
      setAbrindo(false);
      return;
    }
    try {
      await openPrescription(r.data.patient);
      // botão volta a ficar ativo quando o módulo fecha (core:moduleHide)
    } catch (err) {
      setMensagem(err instanceof Error ? err.message : "Erro ao abrir a prescrição.");
      setAbrindo(false);
    }
  }

  async function salvarSexo(sex: "Masculino" | "Feminino") {
    if (!pedirSexo) return;
    const r = await api.patch(`/api/patients/${pedirSexo.patientId}`, { sex });
    if (r.error) {
      setMensagem(r.error);
      return;
    }
    setPedirSexo(null);
    void abrir();
  }

  if (!enabled) return null;

  const ativas = lista.filter((p) => !p.deletedAt);
  const excluidas = lista.filter((p) => p.deletedAt);

  return (
    <div className="mx-6 mb-5 border border-secondary-100 rounded-2xl p-4 bg-white">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-bold text-secondary-500">Prescrição</p>
        <span className="text-[10px] text-secondary-300">Memed</span>
      </div>

      {estado === "incompleto" && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 mb-3">
          {mensagem}{" "}
          <Link href="/perfil#dados-prescricao" className="font-semibold underline underline-offset-2">
            Abrir Perfil
          </Link>
        </div>
      )}

      {pedirSexo && (
        <div className="bg-primary-50 border border-primary-100 rounded-xl p-3 mb-3">
          <p className="text-xs text-secondary-500 mb-2">Informe o sexo do paciente (exigido pela receita):</p>
          <div className="flex gap-2">
            {(["Feminino", "Masculino"] as const).map((s) => (
              <button
                key={s}
                onClick={() => salvarSexo(s)}
                className="flex-1 h-9 rounded-xl bg-white border border-primary-100 text-xs font-medium text-secondary-500"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {estado !== "incompleto" && (
        <button
          onClick={abrir}
          disabled={estado !== "pronto" || abrindo}
          className="w-full h-11 rounded-2xl btn-primary-gradient btn-primary-shadow border border-white text-white text-sm font-medium font-inter flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {estado === "carregando" ? "Carregando Memed..." : abrindo ? "Abrindo..." : "Prescrever (Memed)"}
        </button>
      )}

      {mensagem && estado !== "incompleto" && <p className="text-[11px] text-red-500 mt-2">{mensagem}</p>}

      {ativas.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1.5">
          {ativas.map((p) => (
            <li key={p.id} className="flex items-center justify-between text-xs bg-green-50 border border-green-100 rounded-xl px-3 py-2">
              <span className="text-secondary-500 font-medium">
                Receita emitida{p.itemsCount != null ? ` · ${p.itemsCount} item(ns)` : ""}
              </span>
              <span className="text-secondary-400">{new Date(p.printedAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</span>
            </li>
          ))}
        </ul>
      )}
      {excluidas.length > 0 && (
        <p className="text-[10px] text-secondary-300 mt-2">{excluidas.length} receita(s) excluída(s) na Memed</p>
      )}
    </div>
  );
}
