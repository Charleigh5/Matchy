import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ImageCollection, GameStatus, ImageRecord } from '../types';
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
        // Clamp the float32 sample to the [-1, 1] range
        const s = Math.max(-1, Math.min(1, data[i]));
        // Convert to 16-bit integer, using the full range for better quality
        int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
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
  selectedVoiceName: string | null;
}

export const GameScreen: React.FC<GameScreenProps> = ({ collection, onEndGame, gameStatus, setGameStatus, selectedVoiceName }) => {
  const [roundOptions, setRoundOptions] = useState<ImageRecord[]>([]);
  const [correctAnswer, setCorrectAnswer] = useState<ImageRecord | null>(null);
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [connectionState, setConnectionState] = useState<'connecting' | 'connected' | 'error' | 'closed' | 'permission_denied'>('connecting');
  const [activeVoice, setActiveVoice] = useState<SpeechSynthesisVoice | null>(null);

  // --- Refs to fix stale closures in callbacks ---
  const correctAnswerRef = useRef(correctAnswer);
  useEffect(() => { correctAnswerRef.current = correctAnswer; }, [correctAnswer]);

  const isProcessingRef = useRef(isProcessing);
  useEffect(() => { isProcessingRef.current = isProcessing; }, [isProcessing]);

  const sessionPromiseRef = useRef<Promise<LiveSession> | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const microphoneStreamRef = useRef<MediaStream | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const currentTranscriptionRef = useRef('');
  const gameLoopTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const setVoice = () => {
        const voices = window.speechSynthesis.getVoices();
        if (voices.length === 0) return; // Voices not loaded yet

        let voiceToSet: SpeechSynthesisVoice | null = null;
        if (selectedVoiceName) {
            voiceToSet = voices.find(v => v.name === selectedVoiceName) || null;
        }

        // Fallback to a high-quality default if the selected voice is not found or none is selected.
        if (!voiceToSet) {
             const preferredVoices = [
                (v: SpeechSynthesisVoice) => v.name === 'Google UK English Female',
                (v: SpeechSynthesisVoice) => v.name === 'Samantha',
                (v: SpeechSynthesisVoice) => v.lang === 'en-US' && v.name.includes('Google'),
                (v: SpeechSynthesisVoice) => v.lang.startsWith('en-') && v.localService,
                (v: SpeechSynthesisVoice) => v.lang.startsWith('en-'),
            ];
            for (const condition of preferredVoices) {
                const foundVoice = voices.find(condition);
                if (foundVoice) {
                    voiceToSet = foundVoice;
                    break;
                }
            }
        }
        setActiveVoice(voiceToSet);
    };

    window.speechSynthesis.onvoiceschanged = setVoice;
    setVoice(); // Initial attempt

    return () => {
        window.speechSynthesis.onvoiceschanged = null;
    };
  }, [selectedVoiceName]);

  const speak = useCallback((text: string) => {
    return new Promise<void>((resolve) => {
      window.speechSynthesis.cancel(); // Stop any previously speaking utterances
      const utterance = new SpeechSynthesisUtterance(text);
      if (activeVoice) {
          utterance.voice = activeVoice;
      }
      // Add a bit of natural variation to the voice to make it more memorable and character-like.
      utterance.pitch = 1.2 + (Math.random() - 0.5) * 0.2; // Varies between 1.1 and 1.3
      utterance.rate = 0.9 + (Math.random() - 0.5) * 0.1;  // Varies between 0.85 and 0.95
      utterance.volume = 1;  // Use maximum volume.
      
      utterance.onend = () => resolve();
      // Ensure the game doesn't hang if there's a speech error.
      utterance.onerror = () => resolve(); 
      window.speechSynthesis.speak(utterance);
    });
  }, [activeVoice]);
  
  const startNewRound = useCallback(() => {
    setFeedback(null);
    setIsProcessing(false);

    if (collection.images.length < 2) {
      // Not enough images to play
      onEndGame();
      return;
    }

    // Pick a random correct answer
    const newCorrectAnswer = collection.images[Math.floor(Math.random() * collection.images.length)];
    setCorrectAnswer(newCorrectAnswer);

    // Get other options, ensuring no duplicates
    const otherOptions = collection.images.filter(img => img.id !== newCorrectAnswer.id);
    
    // Determine number of options based on complexity
    // Complexity 1-2: 2 options. 3-4: 3 options. 5: 4 options.
    const numOptions = Math.min(Math.max(2, Math.ceil(collection.complexity / 1.5)), 4);
    
    const roundImages = [newCorrectAnswer];
    // Shuffle other options and pick the required number
    otherOptions.sort(() => 0.5 - Math.random());
    roundImages.push(...otherOptions.slice(0, numOptions - 1));

    // Shuffle the final round options
    roundImages.sort(() => 0.5 - Math.random());
    setRoundOptions(roundImages);

    // Ask the question
    speak(`Find the ${newCorrectAnswer.names[0]}`);

  }, [collection.images, collection.complexity, onEndGame, speak]);

  const processUserAnswer = useCallback((transcript: string) => {
    if (!correctAnswerRef.current || isProcessingRef.current) return;

    setIsProcessing(true);

    const isCorrect = correctAnswerRef.current.names.some(name =>
      transcript.toLowerCase().includes(name.toLowerCase())
    );

    if (isCorrect) {
      setFeedback('correct');
      speak("That's right!").then(() => {
        gameLoopTimeoutRef.current = setTimeout(() => startNewRound(), 2000); // Increased delay to enjoy animation
      });
    } else {
      setFeedback('incorrect');
      speak("Not quite, try again.").then(() => {
        gameLoopTimeoutRef.current = setTimeout(() => {
          setFeedback(null);
          setIsProcessing(false);
          // Re-ask the question
          if (correctAnswerRef.current) {
            speak(`Can you find the ${correctAnswerRef.current.names[0]}?`);
          }
        }, 1500);
      });
    }
  }, [speak, startNewRound]);


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
              currentTranscriptionRef.current += message.serverContent.inputTranscription.text;
            } else if (message.serverContent?.turnComplete) {
              const finalTranscript = currentTranscriptionRef.current.trim();
              if (finalTranscript) {
                processUserAnswer(finalTranscript);
              }
              currentTranscriptionRef.current = '';
            }
          },
          onerror: (e: ErrorEvent) => {
            console.error('Gemini Live connection error:', e);
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

    } catch (err) {
      console.error("Failed to get microphone permissions or setup Gemini Live:", err);
      if (err instanceof DOMException && err.name === "NotAllowedError") {
        setConnectionState('permission_denied');
      } else {
        setConnectionState('error');
      }
    }
  }, [processUserAnswer, setGameStatus]);
  
  useEffect(() => {
    if (gameStatus === GameStatus.LOADING) {
      setupGeminiLive();
    }

    return () => {
      // Cleanup on unmount
      if (gameLoopTimeoutRef.current) clearTimeout(gameLoopTimeoutRef.current);
      
      sessionPromiseRef.current?.then(session => session.close());
      
      microphoneStreamRef.current?.getTracks().forEach(track => track.stop());
      
      if (scriptProcessorRef.current) {
        scriptProcessorRef.current.disconnect();
      }
      if (inputAudioContextRef.current?.state !== 'closed') {
        inputAudioContextRef.current?.close();
      }
      window.speechSynthesis.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (gameStatus === GameStatus.PLAYING) {
      // Start the first round once connected and playing
      startNewRound();
    }
  }, [gameStatus, startNewRound]);

  if (connectionState === 'connecting' || gameStatus === GameStatus.LOADING) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-blue-50">
        <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-blue-500"></div>
        <p className="mt-4 text-lg text-gray-600">Getting ready to play...</p>
      </div>
    );
  }

  if (connectionState === 'permission_denied') {
     return (
        <div className="flex flex-col items-center justify-center h-screen bg-red-50 text-center p-4">
            <MicrophoneOffIcon className="w-24 h-24 text-red-400 mb-4" />
            <h2 className="text-2xl font-bold text-red-700">Microphone Access Needed</h2>
            <p className="mt-2 text-red-600">This game needs permission to use your microphone to hear the answers.</p>
            <p className="mt-1 text-gray-500">Please allow microphone access in your browser settings and refresh the page.</p>
            <button onClick={onEndGame} className="mt-6 px-6 py-2 bg-red-500 text-white rounded-lg shadow hover:bg-red-600">Go Back</button>
        </div>
     )
  }

  if (connectionState === 'error' || connectionState === 'closed') {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-100 text-center p-4">
          <XCircleIcon className="w-24 h-24 text-gray-400 mb-4" />
          <h2 className="text-2xl font-bold text-gray-700">Connection Issue</h2>
          <p className="mt-2 text-gray-500">
            {connectionState === 'error' ? "Something went wrong while connecting." : "The connection was closed."}
          </p>
          <button onClick={onEndGame} className="mt-6 px-6 py-2 bg-gray-500 text-white rounded-lg shadow hover:bg-gray-600">Back to Dashboard</button>
      </div>
    );
  }
  
  return (
    <div className="flex flex-col h-screen bg-blue-50 font-sans p-4 sm:p-6" role="main" aria-label="Game Screen">
      <header className="flex justify-between items-center mb-4">
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-700 sr-only">
          Current task: Find the {correctAnswer?.names[0]}
        </h2>
        <div className="w-full flex justify-end">
            <button 
              onClick={onEndGame} 
              className="flex items-center px-4 py-2 bg-red-500 text-white rounded-lg shadow-md hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-transform transform hover:scale-105"
              aria-label="End Game"
            >
              <StopIcon className="w-5 h-5 mr-2" />
              End Game
            </button>
        </div>
      </header>

      <main className="flex-grow flex items-center justify-center">
        <div 
            className={`grid gap-4 sm:gap-6 md:gap-8 w-full max-w-4xl ${
                roundOptions.length <= 2 ? 'grid-cols-2' :
                roundOptions.length === 3 ? 'grid-cols-1 sm:grid-cols-3' :
                'grid-cols-2'
            } items-center justify-center`}
            role="grid"
            aria-label="Image choices"
        >
          {roundOptions.map(option => (
            <div key={option.id} role="gridcell">
                <ImageCard
                    imageUrl={option.url}
                    altText={option.names[0]}
                    onClick={() => { /* Voice is the primary input */ }}
                    isWinner={feedback === 'correct' && option.id === correctAnswer?.id}
                    isLoser={feedback === 'correct' && option.id !== correctAnswer?.id}
                    isDisabled={isProcessing || feedback !== null}
                />
            </div>
          ))}
        </div>
      </main>

      <footer className="flex items-center justify-center p-4 mt-4" aria-live="polite">
        <div className="flex items-center space-x-3 bg-white px-6 py-3 rounded-full shadow-md">
          <MicrophoneIcon className={`w-6 h-6 ${isProcessing ? 'text-gray-400' : 'text-blue-500'}`} isOn={!isProcessing && feedback === null} />
          <p className="text-lg text-gray-600 font-medium">
            {isProcessing ? "Thinking..." : feedback === 'correct' ? "Great job!" : feedback === 'incorrect' ? "Oops, try again!" : "Listening..."}
          </p>
        </div>
      </footer>
    </div>
  );
};
