"use client";

import { useCallback } from "react";
import { useAudioRecorder } from "@/app/hooks/useAudioRecorder";
import { useWhisper } from "@/app/hooks/useWhisper";

type RecorderState = "default" | "recording" | "sending" | "done";

interface Props {
  consultationId: string;
  onTranscriptionComplete: (text: string, duration: number) => void;
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60).toString().padStart(2, "0");
  const sec = (s % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
}

export function AudioRecorder({ consultationId, onTranscriptionComplete }: Props) {
  const recorder = useAudioRecorder();
  const whisper = useWhisper();

  const state: RecorderState = (() => {
    if (whisper.status === "done") return "done";
    if (whisper.status === "uploading") return "sending";
    if (recorder.isRecording) return "recording";
    return "default";
  })();

  const handleStart = useCallback(async () => {
    await recorder.startRecording();
  }, [recorder]);

  const handleStop = useCallback(async () => {
    const blob = await recorder.stopRecording();
    if (!blob) return;

    const text = await whisper.uploadAudio(blob, consultationId);
    if (text !== null) {
      onTranscriptionComplete(text, whisper.duration ?? 0);
    }
  }, [recorder, whisper, consultationId, onTranscriptionComplete]);

  const handleRetry = useCallback(async () => {
    whisper.reset();
    const cached = recorder.audioBlob;
    if (cached) {
      await whisper.uploadAudio(cached, consultationId);
    }
  }, [recorder.audioBlob, whisper, consultationId]);

  const handleNewRecording = useCallback(() => {
    whisper.reset();
  }, [whisper]);

  return (
    <div className="flex flex-col items-center w-full">
      {/* Microfone central com ripple */}
      <div className="relative flex items-center justify-center mt-10 mb-8">
        {state === "recording" && (
          <>
            <div className="absolute w-[164px] h-[164px] rounded-full border-2 border-primary-100 animate-ripple" />
            <div className="absolute w-[130px] h-[130px] rounded-full border-2 border-primary-100 animate-ripple-delay" />
            <div className="absolute w-[98px] h-[98px] rounded-full border-2 border-primary animate-ripple-delay-2" />
          </>
        )}

        {/* Botão central */}
        {state === "default" && (
          <button
            onClick={handleStart}
            className="w-[162px] h-[162px] rounded-full bg-primary shadow-xl flex items-center justify-center transition-transform active:scale-95"
            aria-label="Iniciar gravação"
          >
            <svg width="52" height="52" viewBox="0 0 24 24" fill="white">
              <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
              <path d="M19 10v2a7 7 0 01-14 0v-2" stroke="white" strokeWidth="2" fill="none" />
              <line x1="12" y1="19" x2="12" y2="23" stroke="white" strokeWidth="2" />
              <line x1="8" y1="23" x2="16" y2="23" stroke="white" strokeWidth="2" />
            </svg>
          </button>
        )}

        {state === "recording" && (
          <button
            onClick={handleStop}
            className="w-[162px] h-[162px] rounded-full bg-red-500 shadow-xl flex flex-col items-center justify-center gap-1 transition-transform active:scale-95"
            aria-label="Parar gravação"
          >
            <svg width="36" height="36" viewBox="0 0 24 24" fill="white">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
            <span className="text-white text-xs font-medium font-inter">{formatTime(recorder.elapsed)}</span>
          </button>
        )}

        {state === "sending" && (
          <div className="w-[162px] h-[162px] rounded-full bg-primary-50 border-2 border-primary flex flex-col items-center justify-center gap-2">
            <svg className="animate-spin w-10 h-10" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="#2260FF" strokeWidth="3" strokeOpacity="0.2" />
              <path d="M12 2a10 10 0 0110 10" stroke="#2260FF" strokeWidth="3" strokeLinecap="round" />
            </svg>
          </div>
        )}

        {state === "done" && (
          <button
            onClick={handleNewRecording}
            className="w-[162px] h-[162px] rounded-full bg-green-500 shadow-xl flex flex-col items-center justify-center gap-1 transition-transform active:scale-95"
            aria-label="Nova gravação"
          >
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span className="text-white text-xs font-medium font-inter">Concluído</span>
          </button>
        )}
      </div>

      {/* Label do estado */}
      <p className="text-sm font-medium font-inter text-secondary-400 mb-6 h-5">
        {state === "default" && "Toque para gravar"}
        {state === "recording" && (
          <span className="flex items-center gap-1.5 text-red-500">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            Gravando...
          </span>
        )}
        {state === "sending" && "Enviando para transcrição..."}
        {state === "done" && "Transcrição concluída"}
      </p>

      {/* Waveform — visível apenas durante gravação */}
      {state === "recording" && (
        <div className="w-full px-6 mb-6">
          <div className="flex items-end justify-center gap-[3px] h-14">
            {recorder.waveform.map((bar, i) => (
              <div
                key={i}
                className="w-[5px] rounded-full bg-primary transition-all duration-75"
                style={{ height: `${bar.height}%`, minHeight: "8px", maxHeight: "100%" }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Erro no microfone */}
      {recorder.error && (
        <div className="w-full px-6 mb-4">
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-600 text-center">
            {recorder.error}
          </div>
        </div>
      )}

      {/* Erro Whisper com retry */}
      {whisper.status === "error" && (
        <div className="w-full px-6 mb-4">
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-600 text-center mb-2">
            {whisper.error}
          </div>
          <button
            onClick={handleRetry}
            className="w-full h-10 rounded-xl border border-primary text-primary text-sm font-medium font-inter"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* Transcrição (estado done) */}
      {state === "done" && whisper.transcription && (
        <div className="w-full px-6 mb-4 animate-fade-in">
          <div className="bg-secondary-100 rounded-2xl p-4 max-h-48 overflow-y-auto">
            <p className="text-xs font-medium text-secondary-400 mb-2">Transcrição</p>
            <p className="text-sm font-inter text-secondary-500 leading-relaxed whitespace-pre-wrap">
              {whisper.transcription}
            </p>
          </div>
          {whisper.duration !== null && whisper.duration > 0 && (
            <p className="text-xs text-secondary-400 mt-2 text-right">
              Duração: {Math.round(whisper.duration)}s
            </p>
          )}
        </div>
      )}
    </div>
  );
}
