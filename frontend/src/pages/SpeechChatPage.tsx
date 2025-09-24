import { useCallback, useEffect, useRef, useState } from 'react';

// Import avatar GIFs
// These paths assume gifs/ is at frontend/gifs
// Adjust the relative paths if your structure differs.
// Vite will bundle these assets automatically.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - image imports are handled by Vite
import stationaryGif from '../../gifs/stationary.gif';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import talkingGif from '../../gifs/talking.gif';

// Minimal Web Speech API typings to avoid any
type SpeechRecognitionConstructor = new () => {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onresult: ((ev: { results: SpeechRecognitionResultList }) => void) | null;
  start: () => void;
  stop: () => void;
};

declare global {
  interface Window {
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
    SpeechRecognition?: SpeechRecognitionConstructor;
  }
}

type VoiceOption = {
  name: string;
  lang: string;
  voice?: SpeechSynthesisVoice;
};

const PY_API_BASE = (import.meta.env.VITE_PY_BACKEND_URL as string) || 'http://127.0.0.1:8000';

export default function SpeechChatPage() {
  const [log, setLog] = useState<string>('');
  const [recLang, setRecLang] = useState<string>('en-US');
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [voiceIndex, setVoiceIndex] = useState<number>(-1);
  const [isRecognizing, setIsRecognizing] = useState<boolean>(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const avatarRef = useRef<HTMLImageElement | null>(null);
  const recognitionRef = useRef<InstanceType<SpeechRecognitionConstructor> | null>(null);

  // Initialize session for chat memory
  useEffect(() => {
    const initSession = async () => {
      try {
        const res = await fetch(`${PY_API_BASE}/new-session`, { method: 'POST' });
        const data = await res.json();
        if (data?.session_id) setSessionId(data.session_id);
      } catch (e) {
        console.warn('[speech-chat] Failed to init session', e);
      }
    };
    initSession();
  }, []);

  // Populate available voices and default to Microsoft Zira (en-IN) if present
  useEffect(() => {
    const synth = window.speechSynthesis;
    const populate = () => {
      const vs = synth.getVoices();
      const options: VoiceOption[] = vs.map(v => ({ name: v.name, lang: v.lang, voice: v }));
      setVoices(options);
      // Prefer Zira en-IN; else prefer first en-*; else index 0
      const ziraIdx = options.findIndex(o => o.name.toLowerCase().includes('zira') && o.lang.toLowerCase() === 'en-in');
      if (ziraIdx >= 0) setVoiceIndex(ziraIdx);
      else {
        const enIdx = options.findIndex(o => o.lang.toLowerCase().startsWith('en'));
        setVoiceIndex(enIdx >= 0 ? enIdx : (options.length ? 0 : -1));
      }
    };
    populate();
    if (typeof synth.onvoiceschanged !== 'undefined') {
      synth.onvoiceschanged = populate;
    }
  }, []);

  // Setup SpeechRecognition
  const fetchReply = useCallback(async (userText: string): Promise<string> => {
    try {
      const res = await fetch(`${PY_API_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userText, session_id: sessionId })
      });
      if (!res.ok) {
        const txt = await res.text();
        return `(error) ${txt || 'failed to get reply'}`;
      }
      const data = await res.json();
      return (data?.response as string) || '(no reply)';
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'network error';
      return `(error) ${msg}`;
    }
  }, [sessionId]);

  const speak = useCallback((text: string) => {
    const synth = window.speechSynthesis;
    if (!synth) return;
    const rec = recognitionRef.current;
    if (rec && isRecognizing) {
      try { rec.stop(); } catch (err) { /* ignore */ }
    }
    const utter = new SpeechSynthesisUtterance(text);
    if (voiceIndex >= 0 && voices[voiceIndex]?.voice) {
      utter.voice = voices[voiceIndex].voice!;
    }
    utter.onstart = () => { if (avatarRef.current) avatarRef.current.src = talkingGif; };
    utter.onend = () => { if (avatarRef.current) avatarRef.current.src = stationaryGif; };
    synth.speak(utter);
  }, [isRecognizing, voiceIndex, voices]);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => { setIsRecognizing(true); };
    recognition.onend = () => { setIsRecognizing(false); };
    recognition.onresult = async (ev: { results: SpeechRecognitionResultList }) => {
      const text = Array.from(ev.results).map(r => r[0].transcript).join(' ').trim();
      if (!text) return;
      appendToLog(`You: ${text}`);
      const reply = await fetchReply(text);
      appendToLog(`Bot: ${reply}`);
      speak(reply);
    };
    recognitionRef.current = recognition;
  }, [sessionId, voices, voiceIndex, isRecognizing, fetchReply, speak]);

  const appendToLog = (line: string) => {
    setLog(prev => (prev ? prev + '\n' + line : line));
  };


  const onStart = () => {
    const rec = recognitionRef.current;
    if (!rec) return;
    rec.lang = recLang || 'en-US';
    try { rec.start(); } catch (e) {
      const msg = e instanceof Error ? e.message : 'failed to start recognition';
      appendToLog(`[error] ${msg}`);
    }
  };
  const onStop = () => { const rec = recognitionRef.current; if (rec && isRecognizing) rec.stop(); };
  const onClear = () => setLog('');

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 text-center">
      <h1 className="text-2xl font-semibold mb-4">Speech Chatbot</h1>
      <img ref={avatarRef} src={stationaryGif} alt="avatar" className="w-48 inline-block mb-4 rounded" />

      <div className="flex flex-wrap items-center justify-center gap-4 mb-4">
        <label className="flex items-center gap-2 text-sm">
          <span>Recognition language:</span>
          <input className="border rounded px-2 py-1" value={recLang} onChange={e => setRecLang(e.target.value)} />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <span>Voice:</span>
          <select className="border rounded px-2 py-1" value={voiceIndex}
            onChange={e => setVoiceIndex(Number(e.target.value))}>
            {voices.map((v, i) => (
              <option key={`${v.name}-${v.lang}-${i}`} value={i}>{`${v.name} — ${v.lang}`}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex items-center justify-center gap-2 mb-4">
        <button className="px-3 py-2 rounded bg-primary text-primary-foreground" onClick={onStart} disabled={isRecognizing}>Start</button>
        <button className="px-3 py-2 rounded border" onClick={onStop} disabled={!isRecognizing}>Stop</button>
        <button className="px-3 py-2 rounded border" onClick={onClear}>Clear</button>
      </div>

      <div className="text-left">
        <label className="block text-sm mb-1">Conversation:</label>
        <textarea className="w-full h-40 border rounded p-2 text-sm" value={log} readOnly />
      </div>
    </div>
  );
}
