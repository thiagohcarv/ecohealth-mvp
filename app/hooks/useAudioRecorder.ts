"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface WaveformBar {
  height: number; // 0–100
}

export interface UseAudioRecorderReturn {
  isRecording: boolean;
  elapsed: number;
  waveform: WaveformBar[];
  audioBlob: Blob | null;
  error: string | null;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<Blob | null>;
}

const BARS = 30;
const IDLE_BARS: WaveformBar[] = Array.from({ length: BARS }, () => ({ height: 8 }));

export function useAudioRecorder(): UseAudioRecorderReturn {
  const [isRecording, setIsRecording] = useState(false);
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

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      cancelAnimationFrame(animFrameRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

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
    setError(null);
    setAudioBlob(null);

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    } catch (err) {
      const msg = err instanceof Error && err.name === "NotAllowedError"
        ? "Permissão para microfone negada"
        : "Erro ao acessar microfone";
      setError(msg);
      return;
    }

    streamRef.current = stream;

    // Configura analyser para waveform em tempo real
    const audioCtx = new AudioContext();
    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    analyserRef.current = analyser;

    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : "audio/webm";

    const recorder = new MediaRecorder(stream, { mimeType });
    chunksRef.current = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.start(100);
    recorderRef.current = recorder;

    setIsRecording(true);
    setElapsed(0);

    timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    animateWaveform();
  }, [animateWaveform]);

  const stopRecording = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const recorder = recorderRef.current;
      if (!recorder || !isRecording) {
        resolve(null);
        return;
      }

      if (timerRef.current) clearInterval(timerRef.current);
      cancelAnimationFrame(animFrameRef.current);
      setWaveform(IDLE_BARS);
      setIsRecording(false);

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        streamRef.current?.getTracks().forEach((t) => t.stop());
        resolve(blob);
      };

      recorder.stop();
    });
  }, [isRecording]);

  return { isRecording, elapsed, waveform, audioBlob, error, startRecording, stopRecording };
}
