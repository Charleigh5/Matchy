import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ImageCollection, GameStatus, ImageRecord, TranscriptionEntry } from '../types';
import { ImageCard } from './ImageCard';
import { MicrophoneIcon, StopIcon, CheckCircleIcon, XCircleIcon } from './IconComponents';
import { GoogleGenAI, LiveSession, LiveServerMessage, Modality, Blob } from '@google/genai';

// --- Audio Helper Functions for Gemini Live API ---
// These functions are critical for encoding local microphone audio to send to Gemini
// and decoding the base64 audio response from Gemini for playback.

// Encodes a Uint8Array of audio data into a base64 string.
function encode(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Decodes a base64 string into a Uint8Array.
function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Decodes raw PCM audio data from Gemini into an AudioBuffer for playback.
async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

// Creates a Gemini-compatible Blob from raw microphone audio data.
function createBlob(data: Float32Array): Blob {
    const l = data.length;
    const int16 = new Int16Array(l);
    for (let i = 0; i < l; i++) {
        int16[i] = data[i] < 0 ? data[i] * 32768 : data[i] * 32767;
    }
    return {
        data: encode(new Uint8Array(int16.buffer)),
        mimeType: 'audio/pcm;rate=16000',
    };
}


// --- Component ---

interface GameScreenProps {
  collection: ImageCollection;
  onEndGame: () => void;
  gameStatus: GameStatus;
  setGameStatus: (status: GameStatus) => void;
}

export const GameScreen: React.FC<GameScreenProps> = ({ collection, onEndGame, gameStatus, setGameStatus }) => {
  const [roundOptions, setRoundOptions] = useState<ImageRecord[]>([]);
  const [correctAnswer, setCorrectAnswer] = useState<ImageRecord | null>(null);
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcriptions, setTranscriptions] = useState<TranscriptionEntry[]>([]);
  const [connectionState, setConnectionState] = useState<'connecting' | 'connected' | 'error' | 'closed'>('connecting');

  const sessionPromiseRef = useRef<Promise<LiveSession> | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const microphoneStreamRef = useRef<MediaStream | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  
  const currentInputTranscriptionRef = useRef('');
  const currentOutputTranscriptionRef = useRef('');
  const nextStartTimeRef = useRef(0);
  const audioPlaybackSources = useRef(new Set<AudioBufferSourceNode>());

  const addTranscription = (source: 'user' | 'model', text: string) => {
    setTranscriptions(prev => [...prev.slice(-10), { source, text, timestamp: Date.now() }]);
  };

  const setupGeminiLive = useCallback(async () => {
    if (!process.env.API_KEY) {
      console.error("API_KEY environment variable not set.");
      setConnectionState('error');
      return;
    }
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    sessionPromiseRef.current = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
            onopen: async () => {
                setConnectionState('connected');
                try {
                    // FIX: Cast window to `any` to support `webkitAudioContext` for older browsers without TypeScript errors.
                    inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
                    outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
                    
                    microphoneStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
                    const source = inputAudioContextRef.current.createMediaStreamSource(microphoneStreamRef.current);
                    scriptProcessorRef.current = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);
                    
                    scriptProcessorRef.current.onaudioprocess = (audioProcessingEvent) => {
                        const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                        const pcmBlob = createBlob(inputData);
                        if (sessionPromiseRef.current) {
                            sessionPromiseRef.current.then((session) => {
                                session.sendRealtimeInput({ media: pcmBlob });
                            });
                        }
                    };
                    source.connect(scriptProcessorRef.current);
                    scriptProcessorRef.current.connect(inputAudioContextRef.current.destination);
                    setGameStatus(GameStatus.PLAYING);

                } catch (err) {
                    console.error('Error setting up microphone:', err);
                    setConnectionState('error');
                }
            },
            onmessage: async (message: LiveServerMessage) => {
                 if (message.serverContent?.outputTranscription?.text) {
                    currentOutputTranscriptionRef.current += message.serverContent.outputTranscription.text;
                }
                if (message.serverContent?.inputTranscription?.text) {
                    currentInputTranscriptionRef.current += message.serverContent.inputTranscription.text;
                }
                 if (message.serverContent?.turnComplete) {
                    if(currentInputTranscriptionRef.current.trim()) addTranscription('user', currentInputTranscriptionRef.current.trim());
                    if(currentOutputTranscriptionRef.current.trim()) addTranscription('model', currentOutputTranscriptionRef.current.trim());
                    currentInputTranscriptionRef.current = '';
                    currentOutputTranscriptionRef.current = '';
                }

                const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                if (base64Audio && outputAudioContextRef.current) {
                    nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputAudioContextRef.current.currentTime);
                    const audioBuffer = await decodeAudioData(decode(base64Audio), outputAudioContextRef.current, 24000, 1);
                    const source = outputAudioContextRef.current.createBufferSource();
                    source.buffer = audioBuffer;
                    source.connect(outputAudioContextRef.current.destination);
                    source.addEventListener('ended', () => audioPlaybackSources.current.delete(source));
                    source.start(nextStartTimeRef.current);
                    nextStartTimeRef.current += audioBuffer.duration;
                    audioPlaybackSources.current.add(source);
                }
            },
            onerror: (e: ErrorEvent) => {
                console.error('Gemini Live Error:', e);
                setConnectionState('error');
            },
            onclose: (e: CloseEvent) => {
                setConnectionState('closed');
            },
        },
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
            systemInstruction: "You are Zephyr, a cheerful, warm, and very encouraging AI friend for a toddler named Leo. Your voice should be gentle and full of positive energy. You are playing a picture matching game. I will announce the pictures and tell you if Leo's answer is correct or not. Your job is to provide fun, conversational encouragement. When you hear a prompt like 'Find Grandma', repeat it enthusiastically. When you hear a success sound, celebrate loudly! 'Yay! You did it!'. When you hear a gentle 'try again' sound, be very soft and encouraging, 'That's okay! Let's try again!'. Keep your responses very short and simple.",
            outputAudioTranscription: {},
            inputAudioTranscription: {},
        },
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cleanup = useCallback(() => {
    if (sessionPromiseRef.current) {
        sessionPromiseRef.current.then(session => session.close());
        sessionPromiseRef.current = null;
    }
    microphoneStreamRef.current?.getTracks().forEach(track => track.stop());
    scriptProcessorRef.current?.disconnect();
    inputAudioContextRef.current?.close();
    outputAudioContextRef.current?.close();
  }, []);
  
  useEffect(() => {
    setupGeminiLive();
    return () => {
        cleanup();
    };
  }, [setupGeminiLive, cleanup]);
  
  const speak = (text: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      utterance.pitch = 1.2;
      window.speechSynthesis.speak(utterance);
    }
  };

  const nextRound = useCallback(() => {
    setFeedback(null);
    setIsProcessing(false);
    
    let shuffled = [...collection.images].sort(() => 0.5 - Math.random());
    const newCorrectAnswer = shuffled[0];
    let otherOption = shuffled[1];
    
    setCorrectAnswer(newCorrectAnswer);
    setRoundOptions([newCorrectAnswer, otherOption].sort(() => 0.5 - Math.random()));
    
    setTimeout(() => {
        speak(`Find ${newCorrectAnswer.names[0]}`);
    }, 500);
  }, [collection.images]);

  useEffect(() => {
    if (gameStatus === GameStatus.PLAYING) {
      nextRound();
    }
  }, [gameStatus, nextRound]);

  const handleAnswer = (selectedImage: ImageRecord) => {
    if (isProcessing) return;
    setIsProcessing(true);

    if (selectedImage.id === correctAnswer?.id) {
        setFeedback('correct');
        new Audio("data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU2LjQwLjEwMQAAAAAAAAAAAAAA//tAwAAAAAAAAAAAAAAAAAAAAAAAABPSUNoAAAAEgAAASFNTEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV-").play();
        setTimeout(nextRound, 1500);
    } else {
        setFeedback('incorrect');
        new Audio("data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU2LjQwLjEwMQAAAAAAAAAAAAAA//tAwAAAAAAAAAAAAAAAAAAAAAAAABMVEEzAAAAwwAAATEzMykb/gAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA1V4aW5nAAAAAwAAAAoAAABJbmZvAAAACgAAAAMAAAABVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//tAwAAAAAAAAAAAAAAAAAAAAAAAABMVEEzAAAAwwAAATEzMykb/gAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA1V4aW5nAAAAAwAAAAoAAABJbmZvAAAACgAAAAMAAAABVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV-").play();
        setTimeout(() => {
            setFeedback(null);
            setIsProcessing(false);
        }, 1500);
    }
  };
  
  const ConnectionStatusIndicator = () => (
    <div className="flex items-center space-x-2 text-sm text-gray-500">
        <MicrophoneIcon className={`w-5 h-5 ${connectionState === 'connected' ? 'text-red-500 animate-pulse' : 'text-gray-400'}`} isOn={connectionState === 'connected'} />
        <span>
            {connectionState === 'connecting' && 'AI connecting...'}
            {connectionState === 'connected' && 'AI is listening...'}
            {connectionState === 'error' && 'Connection error'}
            {connectionState === 'closed' && 'Connection closed'}
        </span>
    </div>
  );

  return (
    <div className="w-full max-w-4xl mx-auto bg-white p-4 sm:p-8 rounded-2xl shadow-2xl relative">
      <div className="flex justify-between items-start mb-6">
        <div>
            <h2 className="text-3xl font-bold text-gray-800">{collection.name}</h2>
            <p className="text-gray-500">Game in progress...</p>
        </div>
        <button onClick={onEndGame} className="flex items-center px-4 py-2 bg-red-500 text-white rounded-lg shadow hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500">
            <StopIcon className="w-5 h-5 mr-2" />
            End Game
        </button>
      </div>

      <div className="relative min-h-[400px]">
        {gameStatus === GameStatus.LOADING && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-xl text-gray-600 animate-pulse">Loading Game...</p>
          </div>
        )}
        
        {gameStatus === GameStatus.PLAYING && (
          <div className="space-y-6">
            <div className="text-center">
                <p className="text-2xl sm:text-3xl font-semibold text-gray-700">Touch the picture of...</p>
                <p className="text-4xl sm:text-5xl font-bold text-blue-600 mt-2">{correctAnswer?.names[0]}</p>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:gap-8 items-center">
              {roundOptions.map((image) => (
                <ImageCard
                  key={image.id}
                  imageUrl={image.url}
                  altText={image.names[0]}
                  onClick={() => handleAnswer(image)}
                  isDisabled={isProcessing || feedback !== null}
                />
              ))}
            </div>
          </div>
        )}
        
        {feedback && (
          <div className="absolute inset-0 bg-white bg-opacity-80 flex items-center justify-center rounded-2xl z-10">
            {feedback === 'correct' && <CheckCircleIcon className="w-32 h-32 text-green-500" />}
            {feedback === 'incorrect' && <XCircleIcon className="w-32 h-32 text-red-500" />}
          </div>
        )}
      </div>

      <div className="mt-6 border-t pt-4 flex justify-between items-center">
        <ConnectionStatusIndicator />
        <div className="text-right text-xs text-gray-500 max-h-24 overflow-y-auto w-1/2 p-2 bg-gray-50 rounded-lg">
          {transcriptions.length === 0 && <p className="italic">Awaiting conversation...</p>}
          {transcriptions.slice().reverse().map(t => (
            <div key={t.timestamp} className="truncate">
              <span className={`font-semibold ${t.source === 'user' ? 'text-blue-600' : 'text-purple-600'}`}>{t.source === 'user' ? 'Child' : 'AI'}: </span>{t.text}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
