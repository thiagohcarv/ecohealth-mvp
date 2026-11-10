"use client";

import { useEffect, useState } from "react";
import { api, type MeResponse } from "@/lib/api";

const UF_LIST = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

type Campos = {
  cpf: string;
  birthDate: string;
  phone: string;
  specialty: string;
  city: string;
  workplaceName: string;
  workplaceAddress: string;
  workplacePhone: string;
  workplaceCity: string;
  workplaceUf: string;
};

const VAZIO: Campos = {
  cpf: "", birthDate: "", phone: "", specialty: "", city: "",
  workplaceName: "", workplaceAddress: "", workplacePhone: "", workplaceCity: "", workplaceUf: "",
};

/** ISO (UTC) -> dd/mm/aaaa */
function isoParaBr(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
}

function deUsuario(u: MeResponse["user"]): Campos {
  return {
    cpf: u.cpf ?? "",
    birthDate: isoParaBr(u.birthDate),
    phone: u.phone ?? "",
    specialty: u.specialty ?? "",
    city: u.city ?? "",
    workplaceName: u.workplaceName ?? "",
    workplaceAddress: u.workplaceAddress ?? "",
    workplacePhone: u.workplacePhone ?? "",
    workplaceCity: u.workplaceCity ?? "",
    workplaceUf: u.workplaceUf ?? "",
  };
}

const inputCls =
  "w-full border border-secondary-100 rounded-[10px] px-3.5 py-2.5 text-sm font-inter text-secondary-500 outline-none placeholder:text-secondary-300 focus:border-primary transition-colors bg-white";

/**
 * Dados exigidos para emitir receitas digitais (RDC 1000/25: CPF e data de nascimento)
 * e o local de atendimento que aparece na receita.
 */
export function DadosPrescritorForm() {
  const [form, setForm] = useState<Campos>(VAZIO);
  const [original, setOriginal] = useState<Campos>(VAZIO);
  const [carregado, setCarregado] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);

  useEffect(() => {
    api.get<MeResponse>("/api/auth/me").then((r) => {
      if (!r.error && r.data) {
        const c = deUsuario(r.data.user);
        setForm(c);
        setOriginal(c);
      }
      setCarregado(true);
    });
  }, []);

  const set = (k: keyof Campos) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const faltando = !original.cpf || !original.birthDate;

  async function salvar(ev: React.FormEvent) {
    ev.preventDefault();
    setMsg(null);
    // Envia apenas o que mudou e está preenchido (campos vazios não apagam dados já salvos)
    const body: Partial<Campos> = {};
    (Object.keys(form) as (keyof Campos)[]).forEach((k) => {
      const v = form[k].trim();
      if (v && v !== original[k]) body[k] = v;
    });
    if (!Object.keys(body).length) {
      setMsg({ tipo: "ok", texto: "Nada para salvar." });
      return;
    }
    setSalvando(true);
    const r = await api.patch<MeResponse>("/api/auth/me", body);
    setSalvando(false);
    if (r.error || !r.data) {
      setMsg({ tipo: "erro", texto: r.error ?? "Erro ao salvar." });
      return;
    }
    const c = deUsuario(r.data.user);
    setForm(c);
    setOriginal(c);
    setMsg({ tipo: "ok", texto: "Dados salvos." });
  }

  if (!carregado) return null;

  return (
    <form id="dados-prescricao" onSubmit={salvar} className="px-6 mb-5 flex flex-col gap-2.5 scroll-mt-6">
      <p className="text-[11px] font-semibold font-jakarta text-secondary-400 uppercase tracking-widest">
        Dados para receitas
      </p>
      {faltando && (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
          CPF e data de nascimento são obrigatórios para emitir receitas digitais.
        </p>
      )}

      <div className="grid grid-cols-2 gap-2">
        <input className={inputCls} placeholder="CPF *" inputMode="numeric" value={form.cpf} onChange={set("cpf")} />
        <input className={inputCls} placeholder="Nascimento (DD/MM/AAAA) *" value={form.birthDate} onChange={set("birthDate")} />
        <input className={inputCls} placeholder="Especialidade" value={form.specialty} onChange={set("specialty")} />
        <input className={inputCls} placeholder="Cidade" value={form.city} onChange={set("city")} />
        <input className={`${inputCls} col-span-2`} placeholder="Telefone" type="tel" value={form.phone} onChange={set("phone")} />
      </div>

      <p className="text-xs text-secondary-400 mt-1">Local de atendimento (aparece na receita)</p>
      <div className="grid grid-cols-2 gap-2">
        <input className={`${inputCls} col-span-2`} placeholder="Nome da clínica / consultório" value={form.workplaceName} onChange={set("workplaceName")} />
        <input className={`${inputCls} col-span-2`} placeholder="Endereço" value={form.workplaceAddress} onChange={set("workplaceAddress")} />
        <input className={inputCls} placeholder="Telefone" type="tel" value={form.workplacePhone} onChange={set("workplacePhone")} />
        <div className="grid grid-cols-[1fr_72px] gap-2">
          <input className={inputCls} placeholder="Cidade" value={form.workplaceCity} onChange={set("workplaceCity")} />
          <select className={inputCls} value={form.workplaceUf} onChange={set("workplaceUf")} aria-label="UF">
            <option value="">UF</option>
            {UF_LIST.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
          </select>
        </div>
      </div>

      {msg && <p className={`text-xs ${msg.tipo === "ok" ? "text-green-600" : "text-red-500"}`}>{msg.texto}</p>}
      <button
        type="submit"
        disabled={salvando}
        className="h-11 rounded-2xl btn-primary-gradient btn-primary-shadow border border-white text-white text-sm font-medium font-inter disabled:opacity-60"
      >
        {salvando ? "Salvando..." : "Salvar dados"}
      </button>
    </form>
  );
}
