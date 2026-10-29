"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface WaveformBar {
  height: number; // 0–100
}

export interface UseAudioRecorderReturn {
  isRecording: boolean;
  /** true entre o clique em "parar" e o áudio estar pronto (mic sendo liberado) */
  isStopping: boolean;
  elapsed: number;
  waveform: WaveformBar[];
  audioBlob: Blob | null;
  error: string | null;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<Blob | null>;
}

const BARS = 30;
const IDLE_BARS: WaveformBar[] = Array.from({ length: BARS }, () => ({ height: 8 }));

// Ordem de preferência: Chrome/Edge/Firefox (webm), Safari (mp4)
const MIME_CANDIDATES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];

// Se o navegador não avisar que parou, finaliza mesmo assim (evita travar com o mic aberto)
const STOP_TIMEOUT_MS = 4000;

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") {
    return undefined;
  }
  return MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported(m));
}

export function useAudioRecorder(): UseAudioRecorderReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [waveform, setWaveform] = useState<WaveformBar[]>(IDLE_BARS);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const animFrameRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  // Fontes de verdade síncronas (o estado do React atualiza com atraso e causava "parar" ignorado)
  const recordingRef = useRef(false);
  const stoppingRef = useRef(false);

  /** Libera timer, animação, microfone e AudioContext. Seguro chamar mais de uma vez. */
  const releaseResources = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    cancelAnimationFrame(animFrameRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    analyserRef.current = null;
    const ctx = audioCtxRef.current;
    audioCtxRef.current = null;
    if (ctx && ctx.state !== "closed") {
      ctx.close().catch(() => {});
    }
  }, []);

  useEffect(() => {
    return () => {
      const r = recorderRef.current;
      if (r && r.state !== "inactive") {
        r.onstop = null;
        try {
          r.stop();
        } catch {
          /* já parado */
        }
      }
      releaseResources();
    };
  }, [releaseResources]);

  const animateWaveform = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;

    const data = new Uint8Array(analyser.frequencyBinCount);
    const step = Math.floor(data.length / BARS);

    const tick = () => {
      analyser.getByteFrequencyData(data);
      const bars: WaveformBar[] = Array.from({ length: BARS }, (_, i) => {
        const slice = data.slice(i * step, (i + 1) * step);
        const avg = slice.reduce((a, b) => a + b, 0) / (step || 1);
        return { height: Math.max(8, (avg / 255) * 100) };
      });
      setWaveform(bars);
      animFrameRef.current = requestAnimationFrame(tick);
    };

    animFrameRef.current = requestAnimationFrame(tick);
  }, []);

  const startRecording = useCallback(async () => {
    // Evita iniciar duas vezes (duplo clique) ou iniciar enquanto finaliza
    if (recordingRef.current || stoppingRef.current) return;

    setError(null);
    setAudioBlob(null);

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    } catch (err) {
      const name = err instanceof Error ? err.name : "";
      setError(
        name === "NotAllowedError"
          ? "Permissão para microfone negada"
          : name === "NotFoundError"
            ? "Nenhum microfone encontrado"
            : "Erro ao acessar microfone"
      );
      return;
    }

    streamRef.current = stream;

    // Waveform é opcional: se falhar (ex.: Safari), a gravação continua normalmente
    try {
      const AudioCtx =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioCtx = new AudioCtx();
      if (audioCtx.state === "suspended") await audioCtx.resume();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      audioCtxRef.current = audioCtx;
      analyserRef.current = analyser;
    } catch {
      analyserRef.current = null;
    }

    let recorder: MediaRecorder;
    try {
      const mimeType = pickMimeType();
      recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    } catch {
      releaseResources();
      setError("Seu navegador não suporta gravação de áudio. Use Chrome ou Safari atualizado.");
      return;
    }

    chunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onerror = () => setError("Erro durante a gravação. Tente novamente.");

    recorder.start(250);
    recorderRef.current = recorder;
    recordingRef.current = true;

    setIsRecording(true);
    setElapsed(0);

    timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    animateWaveform();
  }, [animateWaveform, releaseResources]);

  const stopRecording = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const recorder = recorderRef.current;
      // Usa refs (síncronos), não o estado do React
      if (!recorder || !recordingRef.current || stoppingRef.current) {
        resolve(null);
        return;
      }

      recordingRef.current = false;
      stoppingRef.current = true;

      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      cancelAnimationFrame(animFrameRef.current);
      setWaveform(IDLE_BARS);
      setIsRecording(false);
      setIsStopping(true);

      let finished = false;
      // Se o navegador não avisar que parou, finaliza mesmo assim (finish só roda depois, de forma assíncrona)
      const safety = setTimeout(() => finish(), STOP_TIMEOUT_MS);

      const finish = () => {
        if (finished) return;
        finished = true;
        clearTimeout(safety);

        // Normaliza o tipo (sem ";codecs=...") — o servidor e o Whisper esperam só o tipo base
        const rawType = recorder.mimeType || chunksRef.current[0]?.type || "audio/webm";
        const type = rawType.split(";")[0] ?? "audio/webm";
        const blob = new Blob(chunksRef.current, { type });

        recorderRef.current = null;
        releaseResources(); // desliga o microfone SEMPRE
        stoppingRef.current = false;
        setIsStopping(false);

        if (blob.size === 0) {
          setError("Nenhum áudio foi capturado. Verifique o microfone e tente novamente.");
          resolve(null);
          return;
        }

        setAudioBlob(blob);
        resolve(blob);
      };

      recorder.onstop = finish;

      try {
        if (recorder.state !== "inactive") recorder.stop();
        else finish();
      } catch {
        finish();
      }
    });
  }, [releaseResources]);

  return { isRecording, isStopping, elapsed, waveform, audioBlob, error, startRecording, stopRecording };
}
