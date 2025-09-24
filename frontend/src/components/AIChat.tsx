import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom"; // Import Link
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Bot, Send, User, Heart, AlertCircle, Shield, History, Mic, MicOff, X, Loader2 } from "lucide-react";

// Import API configuration
import { generateUUID, API_CONFIG } from "@/lib/api";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";

// Avatar GIFs for speech overlay
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import stationaryGif from '../../gifs/stationary.gif';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import talkingGif from '../../gifs/talking.gif';

// Minimal typings for Web Speech API to avoid any
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

const AIChat = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState([
    {
      id: 1,
      type: "bot",
      message: "Hi there! I'm your AI mental health companion. I'm here to provide support, coping strategies, and help you connect with resources. How are you feeling today?",
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [sessionId, setSessionId] = useState<string>(generateUUID());
  const [isLoading, setIsLoading] = useState(false);
  const [history, setHistory] = useState<Array<{id: string; created_at: string; message: string; ai_response: string}>>([]);
  // Speech state
  const [showSpeech, setShowSpeech] = useState(false);
  const [isRecognizing, setIsRecognizing] = useState(false);
  type SpeechMsg = { type: 'user' | 'bot', text: string };
  const [speechLog, setSpeechLog] = useState<SpeechMsg[]>([]);
  const [voiceIndex, setVoiceIndex] = useState<number>(-1);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const avatarRef = useRef<HTMLImageElement | null>(null);
  const recognitionRef = useRef<InstanceType<SpeechRecognitionConstructor> | null>(null);

  // Load chat history for the logged-in user
  useEffect(() => {
    (async () => {
      if (!user?.id) return;
      const { data, error } = await supabase
        .from('chat_messages')
        .select('id, created_at, message, ai_response')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(25);
      if (error) {
        console.error(error);
        return;
      }
      setHistory(data ?? []);
    })();
  }, [user?.id]);

  // Populate voices and prefer Microsoft Zira en-IN
  useEffect(() => {
    const synth = window.speechSynthesis;
    const populateVoices = () => {
      const vs = synth.getVoices();
      setVoices(vs);
      // Prefer Zira en-IN
      const ziraIdx = vs.findIndex(v => v.name.toLowerCase().includes('zira') && v.lang.toLowerCase() === 'en-in');
      if (ziraIdx >= 0) setVoiceIndex(ziraIdx);
      else {
        const enIdx = vs.findIndex(v => v.lang.toLowerCase().startsWith('en'));
        setVoiceIndex(enIdx >= 0 ? enIdx : (vs.length ? 0 : -1));
      }
    };
    populateVoices();
    if (typeof window.speechSynthesis.onvoiceschanged !== 'undefined') {
      window.speechSynthesis.onvoiceschanged = populateVoices;
    }
  }, []);

  const quickActions = [
    { text: "I'm feeling anxious", type: "anxiety" },
    { text: "Having trouble sleeping", type: "sleep" },
    { text: "Feeling overwhelmed", type: "stress" },
    { text: "Need someone to talk to", type: "support" },
  ];

  const sendText = useCallback(async (userMessage: string) => {
    if (!userMessage.trim() || isLoading) return;
    const userId = Date.now() + Math.floor(Math.random() * 1000);
    const newUserMessage = {
      id: userId,
      type: "user",
      message: userMessage,
      timestamp: new Date(),
    };

    // Create placeholder bot message that we'll update as tokens arrive
    const botId = Date.now() + Math.floor(Math.random() * 1000) + 1;
    const botPlaceholder = {
      id: botId,
      type: "bot",
      message: "",
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, newUserMessage, botPlaceholder]);
    setIsLoading(true);

    try {
      // Stream tokens from the backend /ai-chat endpoint
      const full = await streamMindCareAIResponse(userMessage, sessionId, (token) => {
        // Append token to the bot placeholder message
        setMessages(prev => prev.map(m => m.id === botId ? { ...m, message: m.message + token } : m));
      });
      // After streaming completes, persist to Supabase if user logged in
      if (user?.id) {
        const botMsg = full;
        const { error: insertErr } = await supabase.from('chat_messages').insert({
          user_id: user.id,
          user_name: user.fullName,
          role: user.role === 'admin' ? 'admin' : 'user',
          message: userMessage,
          ai_response: botMsg // Store full Ollama model response
        });
        if (insertErr) console.error(insertErr);
        else {
          // refresh sidebar
          const { data } = await supabase
            .from('chat_messages')
            .select('id, created_at, message, ai_response')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(25);
          setHistory(data ?? []);
        }
      }

    } catch (error) {
      console.error('Streaming error:', error);
      // Replace placeholder with an error message
      setMessages(prev => prev.map(m => m.id === botId ? { ...m, message: "I'm sorry, I'm having trouble connecting right now. Please try again." } : m));
    } finally {
      setIsLoading(false);
    }
    return;
  }, [isLoading, sessionId, user?.id, user?.fullName, user?.role]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;
    const text = inputValue.trim();
    setInputValue('');
    await sendText(text);
  };

  const handleQuickAction = async (action: { text: string; type: string }) => {
    if (isLoading) return;
    await sendText(action.text);
  };

  // Helper to POST to /ai-chat and stream tokens using Fetch + ReadableStream
  const streamMindCareAIResponse = async (message: string, sessionId: string | undefined, onToken: (token: string) => void) => {
    const resp = await fetch(`${API_CONFIG.BASE_URL}/ai-chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, session_id: sessionId })
    });

    if (!resp.ok) throw new Error(`HTTP error! status: ${resp.status}`);

    if (!resp.body) throw new Error('ReadableStream not supported by this browser or server response has no body');

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    let full = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // SSE events are separated by double newline
      const parts = buffer.split('\n\n');
      buffer = parts.pop() || '';

      for (const part of parts) {
        // Each part may contain multiple lines like 'data: <text>' or 'event: done\ndata: [DONE]'
        // Do NOT trim lines; many model tokens intentionally include leading spaces
        const lines = part.split('\n').map(l => l.replace(/\r$/, ''));
        let isDone = false;
        for (const line of lines) {
          if (line.startsWith('data:')) {
            // Remove only the literal 'data: ' prefix (one space), preserving any additional leading spaces
            const token = line.replace(/^data: /, '');
            // Emit token to UI
            if (token && token !== '[DONE]') { onToken(token); full += token; }
          } else if (line.startsWith('event:')) {
            const ev = line.replace(/^event:\s*/, '');
            if (ev === 'done') isDone = true;
          }
        }
        if (isDone) return;
      }
    }
    return full;
  };

  // SPEECH: speaking with chosen voice (prefer Microsoft Zira en-IN)
  const speak = useCallback((text: string) => {
    const synth = window.speechSynthesis;
    if (!synth) return;
    const utter = new SpeechSynthesisUtterance(text);
    if (voiceIndex >= 0 && voices[voiceIndex]) utter.voice = voices[voiceIndex];
    utter.onstart = () => { if (avatarRef.current) avatarRef.current.src = talkingGif; };
    utter.onend = () => { if (avatarRef.current) avatarRef.current.src = stationaryGif; };
    synth.speak(utter);
  }, [voiceIndex, voices]);

  // SPEECH: init recognition and handlers
  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const recognition = new SR();
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => setIsRecognizing(true);
    recognition.onend = () => setIsRecognizing(false);
    recognition.onresult = async (ev: { results: SpeechRecognitionResultList }) => {
      const text = Array.from(ev.results).map(r => r[0].transcript).join(' ').trim();
      if (!text) return;
      setSpeechLog(prev => [...prev, { type: 'user', text }]);
      // Stream bot reply and collect full response
      let botReply = '';
      await streamMindCareAIResponse(text, sessionId, (token) => {
        botReply += token;
      });
      setSpeechLog(prev => [...prev, { type: 'bot', text: botReply }]);
      // Persist like normal chat by reusing sendText (but avoid double-send tokens)
      await sendText(text);
      speak(botReply || '');
    };
    recognitionRef.current = recognition;
  }, [sessionId, sendText, speak]);

  const startRecognition = () => {
    const rec = recognitionRef.current;
    if (!rec) return;
    rec.lang = 'en-US';
    try { rec.start(); } catch { /* ignore */ }
  };
  const stopRecognition = () => {
    const rec = recognitionRef.current; if (rec && isRecognizing) rec.stop();
  };

  return (
    <section id="ai-chat" className="py-20 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <Badge variant="outline" className="mb-4 bg-primary/10 text-primary border-primary/20">
              🤖 AI-Powered Support
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Chat with Your AI Mental Health Companion
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Get immediate support, coping strategies, and guidance. Our AI is trained to provide 
              empathetic responses and knows when to connect you with human counselors.
            </p>
          </div>

          <Card className="shadow-medium border-0 bg-card/80 backdrop-blur-sm">
            <CardHeader className="border-b border-border/50">
              <CardTitle className="flex items-center space-x-2">
                <div className="w-10 h-10 bg-gradient-primary rounded-full flex items-center justify-center">
                  <Bot className="h-5 w-5 text-white" />
                </div>
                <div>
                  <span>AI Mental Health Companion</span>
                  <div className="flex items-center space-x-2 mt-1">
                    <div className="w-2 h-2 bg-success rounded-full"></div>
                    <span className="text-xs text-muted-foreground">Online & Ready to Help</span>
                  </div>
                </div>
              </CardTitle>
            </CardHeader>
            
            <CardContent className="p-0 grid grid-cols-1 md:grid-cols-[260px_1fr]">
              {/* History Sidebar */}
              <div className="hidden md:block border-r border-border/50 p-4 bg-muted/20">
                <div className="flex items-center gap-2 mb-3 text-sm font-medium"><History className="h-4 w-4"/> Recent chats</div>
                <Button variant="outline" size="sm" className="mb-3 w-full" onClick={() => {
                  setMessages([{
                    id: 1,
                    type: "bot",
                    message: "Hi there! I'm your AI mental health companion. I'm here to provide support, coping strategies, and help you connect with resources. How are you feeling today?",
                    timestamp: new Date(),
                  }]);
                  setSessionId(generateUUID());
                }}>
                  + Create New Chat
                </Button>
                <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                  {history.length === 0 && <div className="text-xs text-muted-foreground">No previous chats</div>}
                  {history.map(h => (
                    <div key={h.id} className="text-xs cursor-pointer hover:bg-muted/40 p-2 rounded" onClick={() => {
                      setMessages([
                        { id: 1, type: "user", message: h.message, timestamp: new Date(h.created_at) },
                        { id: 2, type: "bot", message: h.ai_response, timestamp: new Date(h.created_at) }
                      ]);
                    }}>
                      <div className="font-medium line-clamp-2">{h.message}</div>
                      <div className="text-muted-foreground line-clamp-2">{h.ai_response}</div>
                      <div className="text-[10px] text-muted-foreground mt-1">{new Date(h.created_at).toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              </div>
              {/* Messages */}
              <div className="h-96 overflow-y-auto p-6 space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.type === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-xs lg:max-w-md px-4 py-3 rounded-lg ${
                        message.type === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted/50 text-foreground"
                      }`}
                    >
                      <div className="flex items-start space-x-2">
                        {message.type === "bot" && (
                          <Bot className="h-4 w-4 mt-0.5 text-primary" />
                        )}
                        {message.type === "user" && (
                          <User className="h-4 w-4 mt-0.5" />
                        )}
                        <p className="text-sm">{message.message}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Quick Actions (moved above chat) */}
              <div className="mb-6">
                <p className="text-xs text-muted-foreground mb-3">Quick support options:</p>
                <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {quickActions.map((action, index) => (
                    <Button
                      key={index}
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={() => handleQuickAction(action)}
                    >
                      {action.text}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Input */}
              <div className="p-4 border-t border-border/50 sticky bottom-0 bg-card">
                <div className="flex space-x-2">
                  <Button variant={showSpeech ? 'secondary' : 'outline'} onClick={() => setShowSpeech(true)} title="Start speech mode">
                    <Mic className="h-4 w-4 mr-1" /> Voice
                  </Button>
                  <Input
                    placeholder="Type your message here..."
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    className="flex-1"
                    disabled={isLoading}
                    onKeyDown={(e) => e.key === 'Enter' ? handleSendMessage() : undefined}
                  />
                  <Button onClick={handleSendMessage} className="whitespace-nowrap" disabled={isLoading}>
                    {isLoading ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Send className="h-4 w-4 mr-2" />} Send
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
};

export default AIChat;
