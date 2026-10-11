// src/components/ChatbotWidget.js
import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './ChatbotWidget.css';
import { IconPaintbrush, IconX, IconMic, IconSend, IconSpeakerOn, IconSpeakerOff } from './Icons';

const MAX_MESSAGE_CHARS = 500;
const MAX_HISTORY = 10;
const FALLBACK = "Sorry, I'm having trouble answering right now. Please try again in a moment.";

// Voice: browser Web Speech API (Chrome, Edge, Safari). No server or API key needed.
const SpeechRecognitionAPI =
  typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;
const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window;
const VOICE_LANG = 'en-IN'; // English only for now

// Read a reply aloud in an English (India) voice, falling back to any English voice.
const speak = (text) => {
  if (!canSpeak || !text) return;
  window.speechSynthesis.cancel();
  const clean = text.replace(/[*_#`>]/g, '').replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '');
  const utter = new SpeechSynthesisUtterance(clean);
  utter.lang = VOICE_LANG;
  const voices = window.speechSynthesis.getVoices();
  const voice = voices.find((v) => v.lang === VOICE_LANG) || voices.find((v) => v.lang.startsWith('en'));
  if (voice) utter.voice = voice;
  window.speechSynthesis.speak(utter);
};

const ChatbotWidget = ({ user }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: `Hi${user?.fullName ? ` ${user.fullName.split(' ')[0]}` : ''}! I'm the TheVenkyArt assistant. Ask me about classes, attendance, fees or artworks.`,
      greeting: true,
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceReplies, setVoiceReplies] = useState(false);
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const recognitionRef = useRef(null);
  const voiceRepliesRef = useRef(false);
  const sendTextRef = useRef(null);
  voiceRepliesRef.current = voiceReplies;

  // Load voices early (Chrome fills the list asynchronously) and stop all audio on unmount
  useEffect(() => {
    if (canSpeak) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
    }
    return () => {
      if (recognitionRef.current) recognitionRef.current.abort();
      if (canSpeak) window.speechSynthesis.cancel();
    };
  }, []);

  // Closing the panel stops listening and speaking
  useEffect(() => {
    if (!isOpen) {
      if (recognitionRef.current) recognitionRef.current.abort();
      if (canSpeak) window.speechSynthesis.cancel();
    }
  }, [isOpen]);

  // Auto-scroll to the newest message
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, isTyping, isOpen]);

  useEffect(() => {
    if (isOpen && inputRef.current) inputRef.current.focus();
  }, [isOpen]);

  const addAssistantReply = (content, error = false) => {
    setMessages((prev) => [...prev, { role: 'assistant', content, ...(error ? { error: true } : {}) }]);
    if (voiceRepliesRef.current) speak(content);
  };

  const sendMessage = (e) => {
    e.preventDefault();
    sendText(input);
  };

  const sendText = async (rawText) => {
    const text = rawText.trim().slice(0, MAX_MESSAGE_CHARS);
    if (!text || isTyping) return;
    if (canSpeak) window.speechSynthesis.cancel();

    const history = messages
      .filter((m) => !m.greeting && !m.error)
      .slice(-MAX_HISTORY)
      .map(({ role, content }) => ({ role, content }));

    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    setInput('');

    if (!user?.chatToken) {
      addAssistantReply('Please log out and log in again to use the assistant.', true);
      return;
    }

    setIsTyping(true);
    try {
      const res = await axios.post(
        'https://art-portal-7n6r.onrender.com/api/chatbot',
        { message: text, history },
        { headers: { Authorization: `Bearer ${user.chatToken}` }, timeout: 40000 }
      );
      addAssistantReply(res.data?.reply || FALLBACK);
    } catch (err) {
      addAssistantReply(err.response?.data?.reply || FALLBACK, true);
    } finally {
      setIsTyping(false);
    }
  };

  sendTextRef.current = sendText;

  // Speech-to-text: listen once, then send what was heard
  const toggleListening = () => {
    if (!SpeechRecognitionAPI) return;
    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }
    if (canSpeak) window.speechSynthesis.cancel();

    const recognition = new SpeechRecognitionAPI();
    recognition.lang = VOICE_LANG;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;
    let finalText = '';

    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalText += t;
        else interim += t;
      }
      setInput((finalText + interim).slice(0, MAX_MESSAGE_CHARS));
    };
    recognition.onerror = (event) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        addAssistantReply('Microphone access is blocked. Please allow microphone permission in your browser and try again.', true);
      } else if (event.error === 'no-speech') {
        addAssistantReply("I didn't hear anything. Tap the mic and try again.", true);
      }
    };
    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
      if (finalText.trim()) {
        setVoiceReplies(true); // spoke a question -> hear the answer
        voiceRepliesRef.current = true;
        sendTextRef.current(finalText);
      }
    };

    recognitionRef.current = recognition;
    setIsListening(true);
    recognition.start();
  };

  const toggleVoiceReplies = () => {
    if (voiceReplies && canSpeak) window.speechSynthesis.cancel();
    setVoiceReplies((v) => !v);
  };

  return (
    <div id="chatbot-root" className="chatbot-root">
      {isOpen && (
        <div id="chatbot-panel" className="chatbot-panel" role="dialog" aria-label="TheVenkyArt assistant">
          <div id="chatbot-header" className="chatbot-header">
            <div id="chatbot-header-text">
              <div id="chatbot-title" className="chatbot-title">TheVenkyArt Assistant</div>
              <div id="chatbot-subtitle" className="chatbot-subtitle">Type or speak your question</div>
            </div>
            {canSpeak && (
              <button
                id="chatbot-voice-toggle-btn"
                className={`chatbot-header-btn${voiceReplies ? ' chatbot-header-btn-active' : ''}`}
                type="button"
                aria-label={voiceReplies ? 'Turn off spoken replies' : 'Turn on spoken replies'}
                aria-pressed={voiceReplies}
                title={voiceReplies ? 'Spoken replies: ON' : 'Spoken replies: OFF'}
                onClick={toggleVoiceReplies}
              >
                {voiceReplies ? <IconSpeakerOn size={18} /> : <IconSpeakerOff size={18} />}
              </button>
            )}
            <button
              id="chatbot-close-btn"
              className="chatbot-close-btn"
              type="button"
              aria-label="Close chat"
              onClick={() => setIsOpen(false)}
            >
              <IconX size={18} />
            </button>
          </div>

          <div id="chatbot-message-list" className="chatbot-message-list" ref={listRef} aria-live="polite">
            {messages.map((m, i) => (
              <div
                key={i}
                id={`chatbot-message-${i}`}
                className={`chatbot-message chatbot-message-${m.role}${m.error ? ' chatbot-message-error' : ''}`}
              >
                {m.content}
              </div>
            ))}
            {isTyping && (
              <div id="chatbot-typing-indicator" className="chatbot-message chatbot-message-assistant chatbot-typing">
                <span id="chatbot-typing-dot-1"></span>
                <span id="chatbot-typing-dot-2"></span>
                <span id="chatbot-typing-dot-3"></span>
              </div>
            )}
          </div>

          <form id="chatbot-form" className="chatbot-form" onSubmit={sendMessage}>
            {SpeechRecognitionAPI && (
              <button
                id="chatbot-mic-btn"
                className={`chatbot-mic-btn${isListening ? ' chatbot-mic-listening' : ''}`}
                type="button"
                aria-label={isListening ? 'Stop listening' : 'Speak your question'}
                aria-pressed={isListening}
                onClick={toggleListening}
                disabled={isTyping}
              >
                <IconMic size={18} />
              </button>
            )}
            <input
              id="chatbot-input"
              ref={inputRef}
              className="chatbot-input"
              type="text"
              value={input}
              maxLength={MAX_MESSAGE_CHARS}
              placeholder={isListening ? 'Listening...' : 'Type or tap the mic to speak...'}
              aria-label="Type your question"
              onChange={(e) => setInput(e.target.value)}
              disabled={isTyping || isListening}
            />
            <button
              id="chatbot-send-btn"
              className="chatbot-send-btn"
              type="submit"
              aria-label="Send message"
              disabled={isTyping || !input.trim()}
            >
              <IconSend size={18} />
            </button>
          </form>
        </div>
      )}

      <button
        id="chatbot-toggle-btn"
        className={`chatbot-toggle-btn${isOpen ? ' chatbot-toggle-open' : ''}`}
        type="button"
        aria-label={isOpen ? 'Close chat' : 'Open chat'}
        onClick={() => setIsOpen((o) => !o)}
      >
        {isOpen ? <IconX size={24} /> : <IconPaintbrush size={26} />}
      </button>
    </div>
  );
};

export default ChatbotWidget;
