import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ImageCollection, GameStatus, ImageRecord, TranscriptionEntry } from '../types';
import { ImageCard } from './ImageCard';
import { MicrophoneIcon, StopIcon, CheckCircleIcon, XCircleIcon, MicrophoneOffIcon } from './IconComponents';
import { GoogleGenAI, LiveSession, LiveServerMessage, Blob, Modality } from '@google/genai';

// --- Audio Helper Functions for Gemini Live API ---

// Encodes a Uint8Array of audio data into a base64 string.
function encode(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
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
  const [connectionState, setConnectionState] = useState<'connecting' | 'connected' | 'error' | 'closed' | 'permission_denied'>('connecting');

  const sessionPromiseRef = useRef<Promise<LiveSession> | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const microphoneStreamRef = useRef<MediaStream | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const currentTranscriptionRef = useRef('');
  const gameLoopTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const speak = useCallback((text: string) => {
    return new Promise<void>((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.onend = () => resolve();
      window.speechSynthesis.speak(utterance);
    });
  }, []);

  const processUserAnswer = useCallback((transcript: string) => {
    if (!correctAnswer || isProcessing) return;

    setIsProcessing(true);
    setTranscriptions(prev => [...prev, { source: 'user', text: transcript, timestamp: Date.now() }]);

    const isCorrect = correctAnswer.names.some(name =>
      transcript.toLowerCase().includes(name.toLowerCase())
    );

    if (isCorrect) {
      setFeedback('correct');
      speak("That's right!").then(() => {
        gameLoopTimeoutRef.current = setTimeout(() => startNewRound(), 1500);
      });
    } else {
      setFeedback('incorrect');
      speak("Not quite, try again.").then(() => {
        gameLoopTimeoutRef.current = setTimeout(() => {
          setFeedback(null);
          setIsProcessing(false);
          // Re-ask the question
          if (correctAnswer) {
            speak(`Can you find the ${correctAnswer.names[0]}?`);
          }
        }, 1500);
      });
    }
  }, [correctAnswer, isProcessing, speak]);


  const setupGeminiLive = useCallback(async () => {
    if (!process.env.API_KEY) {
      console.error("API_KEY is not set.");
      setConnectionState('error');
      return;
    }
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      microphoneStreamRef.current = stream;

      const inputAudioContext = new ((window as any).AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      inputAudioContextRef.current = inputAudioContext;
      
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
          onopen: () => {
            setConnectionState('connected');
            setGameStatus(GameStatus.PLAYING);
            const source = inputAudioContext.createMediaStreamSource(stream);
            const scriptProcessor = inputAudioContext.createScriptProcessor(4096, 1, 1);
            scriptProcessorRef.current = scriptProcessor;

            scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
              const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
              const pcmBlob = createBlob(inputData);
              sessionPromise.then((session) => {
                session.sendRealtimeInput({ media: pcmBlob });
              });
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputAudioContext.destination);
          },
          onmessage: (message: LiveServerMessage) => {
            if (message.serverContent?.inputTranscription) {
              const text = message.serverContent.inputTranscription.text;
              currentTranscriptionRef.current += text;
            }
            if(message.serverContent?.turnComplete) {
              const finalTranscript = currentTranscriptionRef.current.trim();
              if (finalTranscript) {
                processUserAnswer(finalTranscript);
              }
              currentTranscriptionRef.current = '';
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
          inputAudioTranscription: {},
        },
      });
      sessionPromiseRef.current = sessionPromise;
    } catch (error) {
        if (error instanceof DOMException && (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError')) {
            console.error('Microphone permission denied by user.');
            setConnectionState('permission_denied');
        } else {
            console.error('Failed to get microphone access:', error);
            setConnectionState('error');
        }
    }
  }, [processUserAnswer, setGameStatus]);

  const cleanup = useCallback(() => {
    if (gameLoopTimeoutRef.current) clearTimeout(gameLoopTimeoutRef.current);
    window.speechSynthesis.cancel();
    
    microphoneStreamRef.current?.getTracks().forEach(track => track.stop());

    if (scriptProcessorRef.current) {
        scriptProcessorRef.current.disconnect();
        scriptProcessorRef.current = null;
    }
    
    inputAudioContextRef.current?.close().catch(console.error);
    
    sessionPromiseRef.current?.then(session => session.close()).catch(console.error);
    sessionPromiseRef.current = null;

  }, []);

  const startNewRound = useCallback(() => {
    setFeedback(null);
    setIsProcessing(false);

    let options = [...collection.images].sort(() => 0.5 - Math.random());
    const numOptions = Math.min(collection.images.length, Math.max(2, collection.complexity + 1));
    options = options.slice(0, numOptions);
    
    const newCorrectAnswer = options[Math.floor(Math.random() * options.length)];
    
    setCorrectAnswer(newCorrectAnswer);
    setRoundOptions(options);

    speak(`Can you find the ${newCorrectAnswer.names[0]}?`);
  }, [collection, speak]);


  useEffect(() => {
    setupGeminiLive();
    return () => cleanup();
  }, [setupGeminiLive, cleanup]);
  
  useEffect(() => {
    if(gameStatus === GameStatus.PLAYING) {
       startNewRound();
    }
  }, [gameStatus, startNewRound]);

  const renderStatus = () => {
    switch (gameStatus) {
      case GameStatus.LOADING:
        return <div className="text-center text-gray-500">Connecting to AI...</div>;
      case GameStatus.PLAYING:
        return (
          <div className="grid grid-cols-2 gap-4 md:gap-8 max-w-3xl mx-auto relative">
            {roundOptions.map(image => (
              <ImageCard
                key={image.id}
                imageUrl={image.url}
                altText={image.names[0]}
                onClick={() => {}} // Click is disabled, interaction is via voice
                isDisabled={isProcessing}
              />
            ))}
            {feedback === 'correct' && (
              <div className="absolute inset-0 bg-green-500 bg-opacity-70 rounded-3xl flex items-center justify-center">
                <CheckCircleIcon className="w-32 h-32 text-white" />
              </div>
            )}
            {feedback === 'incorrect' && (
              <div className="absolute inset-0 bg-red-500 bg-opacity-70 rounded-3xl flex items-center justify-center">
                <XCircleIcon className="w-32 h-32 text-white" />
              </div>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  if (connectionState === 'permission_denied') {
    return (
        <div className="flex flex-col items-center justify-center p-4 min-h-[80vh] text-center">
            <MicrophoneOffIcon className="w-24 h-24 text-red-400 mb-6" />
            <h2 className="text-3xl font-bold text-gray-700 mb-2">Microphone Access Needed</h2>
            <p className="text-lg text-gray-500 max-w-md mx-auto mb-6">
                This game needs your permission to use the microphone to hear answers.
            </p>
            <div className="bg-gray-100 p-4 rounded-lg text-left max-w-md w-full mb-6 shadow-sm">
                <p className="font-semibold text-gray-800">How to fix:</p>
                <ol className="list-decimal list-inside text-gray-600 mt-2 space-y-1">
                    <li>Click the <strong>lock icon (🔒)</strong> in the address bar.</li>
                    <li>Find the "Microphone" permission.</li>
                    <li>Change the setting to <strong>"Allow"</strong>.</li>
                    <li>Click the button below to try again.</li>
                </ol>
            </div>
            <button
                onClick={() => {
                    setConnectionState('connecting');
                    setupGeminiLive();
                }}
                className="px-6 py-3 bg-blue-500 text-white font-bold rounded-lg shadow-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-transform transform hover:scale-105"
            >
                Try Again
            </button>
             <button
                onClick={onEndGame}
                className="mt-4 px-6 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md"
            >
                Back to Dashboard
            </button>
        </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-between p-4 min-h-[80vh]">
      <div className="w-full text-center">
        <h2 className="text-3xl font-bold text-gray-700 mb-2">{collection.name}</h2>
        {gameStatus === GameStatus.PLAYING && !isProcessing && (
          <p className="text-xl text-gray-500">Listen carefully and say what you see!</p>
        )}
      </div>
      
      <div className="flex-grow flex items-center justify-center w-full my-6">
        {renderStatus()}
      </div>

      <div className="flex flex-col items-center space-y-4">
        <div className="flex items-center space-x-3 text-gray-600">
            <MicrophoneIcon className="w-8 h-8" isOn={!isProcessing && gameStatus === GameStatus.PLAYING && connectionState === 'connected'} />
            <span className="text-lg">
                {connectionState === 'connected' ? (isProcessing ? "Thinking..." : "Listening...") : "Connecting..."}
            </span>
        </div>
        <button
          onClick={() => {
            cleanup();
            onEndGame();
          }}
          className="flex items-center justify-center px-6 py-3 bg-red-500 text-white font-bold rounded-lg shadow-md hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-transform transform hover:scale-105"
        >
          <StopIcon className="w-6 h-6 mr-2" />
          End Game
        </button>
      </div>
    </div>
  );
};