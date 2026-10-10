import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";
import * as FileSystem from "expo-file-system";
import * as Speech from "expo-speech";
import { Platform } from "react-native";

const SPEECHIFY_API_URL = "https://api.speechify.ai/v1/audio/speech";
const SPEECHIFY_STORAGE_KEY = "toeic_trainer_speechify_api_key";
const SPEECHIFY_CACHE_DIRECTORY = "speechify-tts";

export const SPEECHIFY_MODEL = "simba-3.2";
export const SPEECHIFY_VOICE_ID = "george";
export const SPEECHIFY_VOICE_NAME = "George";

export type PronunciationSource = "speechify" | "fallback";

export type PronunciationOptions = {
  disableFallback?: boolean;
  fallbackSpeak?: (text: string, options: PronunciationOptions) => void;
  language?: string;
  onDone?: () => void;
  onError?: (error: Error) => void;
  onGenerating?: () => void;
  onStart?: () => void;
  pitch?: number;
  rate?: number;
};

type SpeechifyResponse = {
  audio_data?: string;
  error?: string;
  message?: string;
};

const audioUriByCacheKey = new Map<string, string>();
const pendingSynthesisByCacheKey = new Map<string, Promise<string>>();

let activeSound: AudioPlayer | null = null;
let activePlaybackId = 0;

function normalizeText(text: string) {
  return text.trim().replace(/\s+/g, " ");
}

function createCacheKey(text: string) {
  const source = `${SPEECHIFY_MODEL}|${SPEECHIFY_VOICE_ID}|${normalizeText(text)}`;
  let hashA = 0x811c9dc5;
  let hashB = 0x01000193;

  for (let index = 0; index < source.length; index += 1) {
    const code = source.charCodeAt(index);
    hashA ^= code;
    hashA = Math.imul(hashA, 0x01000193);
    hashB = Math.imul(hashB ^ code, 0x85ebca6b);
  }

  return `${(hashA >>> 0).toString(16)}-${(hashB >>> 0).toString(16)}-${source.length}`;
}

function base64ToBytes(base64: string) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const clean = base64.replace(/[^A-Za-z0-9+/=]/g, "");
  const padding = clean.endsWith("==") ? 2 : clean.endsWith("=") ? 1 : 0;
  const bytes = new Uint8Array(Math.max(0, (clean.length * 3) / 4 - padding));
  let byteIndex = 0;

  for (let index = 0; index < clean.length; index += 4) {
    const first = alphabet.indexOf(clean[index]);
    const second = alphabet.indexOf(clean[index + 1]);
    const third = clean[index + 2] === "=" ? 0 : alphabet.indexOf(clean[index + 2]);
    const fourth = clean[index + 3] === "=" ? 0 : alphabet.indexOf(clean[index + 3]);
    const value = (first << 18) | (second << 12) | (third << 6) | fourth;

    if (byteIndex < bytes.length) bytes[byteIndex++] = (value >> 16) & 0xff;
    if (byteIndex < bytes.length) bytes[byteIndex++] = (value >> 8) & 0xff;
    if (byteIndex < bytes.length) bytes[byteIndex++] = value & 0xff;
  }

  return bytes;
}

export async function getSpeechifyApiKey(): Promise<string | null> {
  try {
    const value = await AsyncStorage.getItem(SPEECHIFY_STORAGE_KEY);
    const key = value?.trim();
    return key ? key : null;
  } catch {
    return null;
  }
}

export async function saveSpeechifyApiKey(apiKey: string): Promise<void> {
  const key = apiKey.trim();
  if (!key) {
    throw new Error("Hãy nhập Speechify API key trước.");
  }
  await AsyncStorage.setItem(SPEECHIFY_STORAGE_KEY, key);
}

export async function removeSpeechifyApiKey(): Promise<void> {
  await AsyncStorage.removeItem(SPEECHIFY_STORAGE_KEY);
}

async function stopActiveSound() {
  const sound = activeSound;
  activeSound = null;
  if (!sound) return;

  try {
    sound.pause();
  } catch {
    // The player may already have finished or been removed.
  }
  try {
    sound.remove();
  } catch {
    // Ignore cleanup failures; a new playback can still be attempted.
  }
}

export async function stopPronunciation() {
  activePlaybackId += 1;
  await stopActiveSound();
  await Speech.stop().catch(() => undefined);

  if (Platform.OS === "web" && typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}

async function getOrCreateSpeechifyFile(text: string, apiKey: string): Promise<string> {
  const cacheKey = createCacheKey(text);
  const inMemoryUri = audioUriByCacheKey.get(cacheKey);
  if (inMemoryUri) return inMemoryUri;

  const pending = pendingSynthesisByCacheKey.get(cacheKey);
  if (pending) return pending;

  const synthesis = (async () => {
    if (Platform.OS !== "web") {
      const directory = new FileSystem.Directory(FileSystem.Paths.cache, SPEECHIFY_CACHE_DIRECTORY);
      if (!directory.exists) {
        directory.create({ idempotent: true, intermediates: true });
      }

      const file = new FileSystem.File(directory, `george-${cacheKey}.mp3`);
      if (file.exists && file.size > 0) {
        audioUriByCacheKey.set(cacheKey, file.uri);
        return file.uri;
      }
    }

    const response = await fetch(SPEECHIFY_API_URL, {
      body: JSON.stringify({
        audio_format: "mp3",
        input: normalizeText(text),
        model: SPEECHIFY_MODEL,
        voice_id: SPEECHIFY_VOICE_ID,
      }),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    });

    const payload = (await response.json().catch(() => null)) as SpeechifyResponse | null;
    if (!response.ok || !payload?.audio_data) {
      throw new Error(payload?.message || payload?.error || `Speechify trả về lỗi ${response.status}.`);
    }

    if (Platform.OS === "web") {
      const dataUri = `data:audio/mpeg;base64,${payload.audio_data}`;
      audioUriByCacheKey.set(cacheKey, dataUri);
      return dataUri;
    }

    const directory = new FileSystem.Directory(FileSystem.Paths.cache, SPEECHIFY_CACHE_DIRECTORY);
    if (!directory.exists) {
      directory.create({ idempotent: true, intermediates: true });
    }

    const file = new FileSystem.File(directory, `george-${cacheKey}.mp3`);
    file.create({ overwrite: true });
    file.write(base64ToBytes(payload.audio_data));
    audioUriByCacheKey.set(cacheKey, file.uri);
    return file.uri;
  })();

  pendingSynthesisByCacheKey.set(cacheKey, synthesis);
  try {
    return await synthesis;
  } finally {
    pendingSynthesisByCacheKey.delete(cacheKey);
  }
}

async function playSpeechifyAudio(uri: string, options: PronunciationOptions): Promise<void> {
  const playbackId = ++activePlaybackId;
  await stopActiveSound();
  await Speech.stop().catch(() => undefined);
  await setAudioModeAsync({ playsInSilentMode: true });

  await new Promise<void>((resolve, reject) => {
    const sound = createAudioPlayer({ uri }, { updateInterval: 250 });
    activeSound = sound;
    let started = false;
    let loadTimer: ReturnType<typeof setTimeout> | null = null;

    const clearLoadTimer = () => {
      if (!loadTimer) return;
      clearTimeout(loadTimer);
      loadTimer = null;
    };

    const subscription = sound.addListener("playbackStatusUpdate", (status) => {
      if (playbackId !== activePlaybackId) return;

      if (status.error) {
        const error = new Error(status.error);
        if (!started) {
          clearLoadTimer();
          subscription.remove();
          if (activeSound === sound) activeSound = null;
          try {
            sound.remove();
          } catch {
            // Ignore cleanup failures; the caller falls back to the device voice.
          }
          reject(error);
        } else {
          options.onError?.(error);
        }
        return;
      }

      if (!status.isLoaded) return;

      if (!started) {
        started = true;
        clearLoadTimer();
        options.onStart?.();
        resolve();
      }

      if (status.didJustFinish) {
        subscription.remove();
        if (activeSound === sound) activeSound = null;
        try {
          sound.remove();
        } catch {
          // Ignore cleanup failures after playback finishes.
        }
        options.onDone?.();
      }
    });

    loadTimer = setTimeout(() => {
      if (started || playbackId !== activePlaybackId) return;
      subscription.remove();
      if (activeSound === sound) activeSound = null;
      try {
        sound.remove();
      } catch {
        // Ignore cleanup failures; the caller falls back to the device voice.
      }
      reject(new Error("Không phát được audio Speechify."));
    }, 20000);

    try {
      sound.play();
    } catch (error) {
      clearLoadTimer();
      subscription.remove();
      if (activeSound === sound) activeSound = null;
      try {
        sound.remove();
      } catch {
        // Ignore cleanup failures; the caller falls back to the device voice.
      }
      reject(error instanceof Error ? error : new Error("Không phát được audio Speechify."));
    }
  });
}

async function speakWithDeviceVoice(text: string, options: PronunciationOptions): Promise<void> {
  if (options.fallbackSpeak) {
    options.fallbackSpeak(text, options);
    return;
  }

  await stopActiveSound();
  await Speech.stop().catch(() => undefined);
  Speech.speak(text, {
    language: options.language ?? "en-US",
    onDone: options.onDone,
    onError: options.onError,
    onStart: options.onStart,
    onStopped: options.onDone,
    pitch: options.pitch ?? 1,
    rate: options.rate ?? 1,
  });
}

export async function speakTextWithSpeechify(
  rawText: string,
  options: PronunciationOptions = {},
): Promise<PronunciationSource> {
  const text = normalizeText(rawText);
  if (!text) return "fallback";

  const apiKey = await getSpeechifyApiKey();
  if (!apiKey) {
    if (options.disableFallback) {
      throw new Error("Chưa lưu Speechify API key trên thiết bị này.");
    }
    await stopActiveSound();
    await speakWithDeviceVoice(text, options);
    return "fallback";
  }

  options.onGenerating?.();
  try {
    const uri = await getOrCreateSpeechifyFile(text, apiKey);
    await playSpeechifyAudio(uri, options);
    return "speechify";
  } catch (error) {
    const speechifyError = error instanceof Error ? error : new Error("Speechify không khả dụng.");
    options.onError?.(speechifyError);
    if (options.disableFallback) throw speechifyError;
    await stopActiveSound();
    await speakWithDeviceVoice(text, options);
    return "fallback";
  }
}
