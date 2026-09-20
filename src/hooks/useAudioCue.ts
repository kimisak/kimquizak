'use client';

import { useEffect, useRef } from "react";

const SPIN_CUE_VOLUME = 0.68;
const SELECTION_CUE_FALLBACK_VOLUME = 0.32;

function getActiveRms(buffer: AudioBuffer) {
  const windowSize = Math.max(1, Math.round(buffer.sampleRate * 0.05));
  const activeWindows: number[] = [];

  for (let offset = 0; offset < buffer.length; offset += windowSize) {
    let sumOfSquares = 0;
    let sampleCount = 0;

    for (let channelIndex = 0; channelIndex < buffer.numberOfChannels; channelIndex += 1) {
      const channel = buffer.getChannelData(channelIndex);
      const end = Math.min(channel.length, offset + windowSize);
      for (let sampleIndex = offset; sampleIndex < end; sampleIndex += 1) {
        sumOfSquares += channel[sampleIndex] ** 2;
        sampleCount += 1;
      }
    }

    const rms = Math.sqrt(sumOfSquares / Math.max(1, sampleCount));
    if (rms > 10 ** (-45 / 20)) activeWindows.push(rms);
  }

  if (activeWindows.length === 0) return 0;
  return Math.sqrt(
    activeWindows.reduce((sum, rms) => sum + rms ** 2, 0) / activeWindows.length,
  );
}

export function useAudioCue() {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const selectionCueVolumeRef = useRef(SELECTION_CUE_FALLBACK_VOLUME);
  const slotSpinStopRef = useRef<(() => void) | null>(null);
  const finaleDrumrollStopRef = useRef<(() => void) | null>(null);
  const finaleDrumrollAudioRef = useRef<HTMLAudioElement | null>(null);
  const podiumBronzeAudioRef = useRef<HTMLAudioElement | null>(null);
  const podiumSilverAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const spinAudio = new Audio("/audio/sleigh-bells-fast.mp3");
    const selectionAudio = new Audio("/audio/christmas-selection-glockenspiel.mp3");
    const finaleDrumrollAudio = new Audio("/audio/drum-roll-intro-cc0.mp3");
    const podiumBronzeAudio = new Audio("/audio/podium-bronze-tada-cc0.mp3");
    const podiumSilverAudio = new Audio("/audio/podium-silver-anime-wow.mp3");
    spinAudio.preload = "auto";
    selectionAudio.preload = "auto";
    finaleDrumrollAudio.preload = "auto";
    finaleDrumrollAudio.loop = false;
    finaleDrumrollAudio.volume = 0.52;
    podiumBronzeAudio.preload = "auto";
    podiumSilverAudio.preload = "auto";
    podiumBronzeAudio.volume = 0.58;
    podiumSilverAudio.volume = 0.58;
    spinAudio.load();
    selectionAudio.load();
    finaleDrumrollAudio.load();
    podiumBronzeAudio.load();
    podiumSilverAudio.load();
    finaleDrumrollAudioRef.current = finaleDrumrollAudio;
    podiumBronzeAudioRef.current = podiumBronzeAudio;
    podiumSilverAudioRef.current = podiumSilverAudio;

    let cancelled = false;
    const normalizeCueVolumes = async () => {
      try {
        const decode = async (path: string) => {
          const response = await fetch(path);
          if (!response.ok) throw new Error(`Unable to load ${path}`);
          const context = new OfflineAudioContext(2, 1, 48_000);
          return context.decodeAudioData(await response.arrayBuffer());
        };
        const [spinBuffer, selectionBuffer] = await Promise.all([
          decode("/audio/sleigh-bells-fast.mp3"),
          decode("/audio/christmas-selection-glockenspiel.mp3"),
        ]);
        const spinRms = getActiveRms(spinBuffer);
        const selectionRms = getActiveRms(selectionBuffer);
        if (!cancelled && spinRms > 0 && selectionRms > 0) {
          selectionCueVolumeRef.current = Math.max(
            0.08,
            Math.min(1, SPIN_CUE_VOLUME * (spinRms / selectionRms)),
          );
        }
      } catch (error) {
        console.warn("Unable to normalize the spinner cue volumes", error);
      }
    };
    void normalizeCueVolumes();

    return () => {
      cancelled = true;
      slotSpinStopRef.current?.();
      finaleDrumrollStopRef.current?.();
      spinAudio.pause();
      selectionAudio.pause();
      finaleDrumrollAudio.pause();
      podiumBronzeAudio.pause();
      podiumSilverAudio.pause();
      finaleDrumrollAudioRef.current = null;
      podiumBronzeAudioRef.current = null;
      podiumSilverAudioRef.current = null;
    };
  }, []);

  const ensureCtx = () => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContext();
      }
    } catch (e) {
      console.error("Audio error", e);
    }
    return audioCtxRef.current;
  };

  const playSadBlip = () => {
    const ctx = ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(180, now + 0.4);
    gain.gain.value = 0.16;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);
    osc.stop(now + 0.45);
  };

  const playCountdownBeep = (frequency = 900) => {
    const ctx = ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(frequency, now);
    osc.frequency.exponentialRampToValueAtTime(frequency * 1.1, now + 0.18);
    gain.gain.setValueAtTime(0.26, now);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
    osc.stop(now + 0.3);
  };

  const playFinalAlarm = () => {
    const ctx = ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(440, now + 0.9);
    gain.gain.setValueAtTime(0.28, now);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.05);
    osc.stop(now + 1.1);
  };

  const playSuccessChime = () => {
    const ctx = ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(660, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.25);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.4);
  };

  const playDownbeat = () => {
    const ctx = ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(240, now);
    osc.frequency.exponentialRampToValueAtTime(130, now + 0.25);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.32);
  };

  const playSlotResolve = () => {
    const audio = new Audio("/audio/christmas-selection-glockenspiel.mp3");
    audio.preload = "auto";
    audio.volume = selectionCueVolumeRef.current;
    audio.currentTime = 0;
    void audio.play().catch((error) => {
      console.warn("Unable to play the Christmas selection cue", error);
    });
  };

  const playJokerSparkle = () => {
    const ctx = ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const osc3 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = "sine";
    osc2.type = "triangle";
    osc3.type = "sine";

    osc1.frequency.setValueAtTime(660, now);
    osc1.frequency.exponentialRampToValueAtTime(1200, now + 0.8);

    osc2.frequency.setValueAtTime(880, now + 0.05);
    osc2.frequency.exponentialRampToValueAtTime(1400, now + 0.9);

    osc3.frequency.setValueAtTime(520, now + 0.1);
    osc3.frequency.exponentialRampToValueAtTime(980, now + 1.1);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.35);

    osc1.connect(gain);
    osc2.connect(gain);
    osc3.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now + 0.02);
    osc3.start(now + 0.05);

    osc1.stop(now + 1.4);
    osc2.stop(now + 1.4);
    osc3.stop(now + 1.4);
  };

  const playBigWin = () => {
    const ctx = ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();
    osc1.type = "sine";
    osc2.type = "sine";
    osc1.frequency.setValueAtTime(660, now);
    osc2.frequency.setValueAtTime(990, now);
    osc1.frequency.exponentialRampToValueAtTime(880, now + 0.35);
    osc2.frequency.exponentialRampToValueAtTime(1320, now + 0.35);
    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);
    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);
    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.6);
    osc2.stop(now + 0.6);
  };

  const startSlotSpinLoop = () => {
    if (slotSpinStopRef.current) {
      slotSpinStopRef.current();
    }
    let stopped = false;
    const audio = new Audio("/audio/sleigh-bells-fast.mp3");
    audio.preload = "auto";
    audio.volume = SPIN_CUE_VOLUME;
    audio.currentTime = 0;

    const handleEnded = () => stop();
    const stop = () => {
      if (stopped) return;
      stopped = true;
      audio.removeEventListener("ended", handleEnded);
      audio.pause();
      audio.currentTime = 0;
      slotSpinStopRef.current = null;
    };

    audio.addEventListener("ended", handleEnded, { once: true });
    void audio.play().catch((error) => {
      console.warn("Unable to play the sleigh-bell spin cue", error);
      stop();
    });

    slotSpinStopRef.current = stop;
    return stop;
  };

  const stopSlotSpinLoop = () => {
    if (slotSpinStopRef.current) {
      slotSpinStopRef.current();
      slotSpinStopRef.current = null;
    }
  };

  const startFinaleDrumroll = (onFinished?: () => void) => {
    if (finaleDrumrollStopRef.current) return finaleDrumrollStopRef.current;
    const audio = finaleDrumrollAudioRef.current;
    if (!audio) return () => undefined;
    let stopped = false;
    audio.currentTime = 0;
    audio.loop = false;
    const handleEnded = () => {
      stop();
      onFinished?.();
    };
    void audio.play().catch((error) => {
      console.warn("Unable to play the finale drumroll", error);
      stop();
      onFinished?.();
    });
    const stop = () => {
      if (stopped) return;
      stopped = true;
      audio.removeEventListener("ended", handleEnded);
      audio.pause();
      audio.currentTime = 0;
      finaleDrumrollStopRef.current = null;
    };

    audio.addEventListener("ended", handleEnded, { once: true });
    finaleDrumrollStopRef.current = stop;
    return stop;
  };

  const stopFinaleDrumroll = () => {
    finaleDrumrollStopRef.current?.();
  };

  const playPodiumReveal = (place: 2 | 3) => {
    const bronze = podiumBronzeAudioRef.current;
    const silver = podiumSilverAudioRef.current;
    bronze?.pause();
    silver?.pause();
    if (bronze) bronze.currentTime = 0;
    if (silver) silver.currentTime = 0;
    const audio = place === 3 ? bronze : silver;
    if (!audio) return;
    void audio.play().catch((error) => {
      console.warn(`Unable to play the ${place === 3 ? "bronze" : "silver"} podium cue`, error);
    });
  };

  return {
    playSadBlip,
    playCountdownBeep,
    playFinalAlarm,
    playSuccessChime,
    playDownbeat,
    playBigWin,
    playSlotResolve,
    playJokerSparkle,
    startSlotSpinLoop,
    stopSlotSpinLoop,
    startFinaleDrumroll,
    stopFinaleDrumroll,
    playPodiumReveal,
  };
}
