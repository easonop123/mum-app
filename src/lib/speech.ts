// Optional, tap-initiated spoken cues. Handles missing Chinese voices,
// offline voice limits and unsupported speech APIs without failing.

export type VoiceKind = 'mandarin' | 'english';
export type SpeakResult = 'ok' | 'no_voice' | 'unsupported';

export function speechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance === 'function';
}

function isMandarin(lang: string): boolean {
  const l = lang.toLowerCase().replace('_', '-');
  if (l.startsWith('zh-hk') || l.startsWith('yue') || l.includes('-yue')) return false; // Cantonese
  return l.startsWith('zh-cn') || l.startsWith('cmn') || l.startsWith('zh-tw') || l.startsWith('zh-sg') || l === 'zh' || l.startsWith('zh-hans');
}

export function findVoice(kind: VoiceKind): SpeechSynthesisVoice | null {
  if (!speechSupported()) return null;
  const voices = window.speechSynthesis.getVoices();
  if (kind === 'mandarin') {
    return voices.find((v) => v.lang.toLowerCase().startsWith('zh-cn')) ?? voices.find((v) => isMandarin(v.lang)) ?? null;
  }
  return voices.find((v) => v.lang.toLowerCase().startsWith('en-nz')) ?? voices.find((v) => v.lang.toLowerCase().startsWith('en')) ?? null;
}

/** Voices often load asynchronously; wait briefly for them. */
export function voicesReady(timeoutMs = 1500): Promise<void> {
  if (!speechSupported()) return Promise.resolve();
  if (window.speechSynthesis.getVoices().length > 0) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      window.speechSynthesis.removeEventListener?.('voiceschanged', done);
      resolve();
    };
    window.speechSynthesis.addEventListener?.('voiceschanged', done);
    window.setTimeout(done, timeoutMs);
  });
}

export async function speak(text: string, kind: VoiceKind): Promise<SpeakResult> {
  if (!speechSupported()) return 'unsupported';
  await voicesReady();
  const voice = findVoice(kind);
  if (!voice) return 'no_voice';
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.voice = voice;
    u.lang = voice.lang;
    u.rate = 0.9;
    window.speechSynthesis.speak(u);
    return 'ok';
  } catch {
    return 'unsupported';
  }
}

export function stopSpeaking(): void {
  if (speechSupported()) window.speechSynthesis.cancel();
}
