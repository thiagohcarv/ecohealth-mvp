"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SoapNoteData } from "@/app/hooks/useSoapGenerator";

type SoapTab = "S" | "O" | "A" | "P";

const TABS: { key: SoapTab; label: string; field: keyof SoapNoteData; color: string }[] = [
  { key: "S", label: "Subjetivo",  field: "subjective", color: "text-blue-600"  },
  { key: "O", label: "Objetivo",   field: "objective",  color: "text-purple-600" },
  { key: "A", label: "Avaliação",  field: "assessment", color: "text-amber-600" },
  { key: "P", label: "Plano",      field: "plan",       color: "text-green-600"  },
];

interface Props {
  soapData: SoapNoteData;
  consultationId: string;
  onChange?: (updated: SoapNoteData) => void;
}

export function SoapNote({ soapData, consultationId, onChange }: Props) {
  const [activeTab, setActiveTab] = useState<SoapTab>("S");
  const [edited, setEdited] = useState<SoapNoteData>(soapData);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sincroniza quando soapData mudar externamente
  useEffect(() => { setEdited(soapData); }, [soapData]);

  const handleChange = useCallback((field: keyof SoapNoteData, value: string) => {
    setEdited((prev) => {
      const updated = { ...prev, [field]: value };

      // Auto-save debounced no localStorage
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        localStorage.setItem(`eco_soap_${consultationId}`, JSON.stringify(updated));
      }, 600);

      onChange?.(updated);
      return updated;
    });
  }, [consultationId, onChange]);

  const activeTabDef = TABS.find((t) => t.key === activeTab) ?? TABS[0]!;
  const confidence = edited.confidence !== null ? Math.round((edited.confidence ?? 0) * 100) : null;
  const confidenceColor =
    confidence === null ? "text-secondary-400"
    : confidence >= 85   ? "text-green-600"
    : confidence >= 65   ? "text-amber-600"
    : "text-red-500";

  return (
    <div className="w-full animate-fade-in">
      {/* Cabeçalho com confiança e modelo */}
      <div className="flex items-center justify-between mb-3 px-1">
        <span className="text-xs font-medium text-secondary-400 uppercase tracking-wider">
          Nota SOAP
        </span>
        <div className="flex items-center gap-2">
          {confidence !== null && (
            <span className={`text-xs font-medium ${confidenceColor}`}>
              {confidence}% confiança
            </span>
          )}
          <span className="text-xs bg-secondary-100 text-secondary-400 rounded-full px-2 py-0.5">
            {edited.model}
          </span>
        </div>
      </div>

      {/* Tabs S / O / A / P */}
      <div className="flex gap-1 mb-3">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 h-9 rounded-xl text-xs font-bold transition-all ${
              activeTab === tab.key
                ? "bg-primary text-white shadow-md"
                : "bg-secondary-100 text-secondary-400"
            }`}
          >
            {tab.key}
          </button>
        ))}
      </div>

      {/* Label da tab ativa */}
      <p className={`text-xs font-semibold mb-2 ${activeTabDef.color}`}>
        {activeTabDef.label}
      </p>

      {/* Área de texto editável */}
      <textarea
        value={String(edited[activeTabDef.field] ?? "")}
        onChange={(e) => handleChange(activeTabDef.field, e.target.value)}
        rows={6}
        className="w-full border border-secondary-100 rounded-xl px-3.5 py-3 text-sm font-inter text-secondary-500 outline-none resize-none placeholder:text-secondary-300 focus:border-primary transition-colors leading-relaxed"
        placeholder={`Digite o ${activeTabDef.label.toLowerCase()}...`}
      />

      {/* CID-10 */}
      {edited.icd10Codes.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          <span className="text-xs text-secondary-400 self-center">CID-10:</span>
          {edited.icd10Codes.map((code) => (
            <span
              key={code}
              className="text-xs font-medium bg-primary-50 text-primary border border-primary-100 rounded-full px-2.5 py-0.5"
            >
              {code}
            </span>
          ))}
        </div>
      )}

      {/* Dica de edição */}
      <p className="text-xs text-secondary-300 mt-2 text-center">
        Toque no texto para editar · Salvo automaticamente
      </p>
    </div>
  );
}
