import React, { useEffect, useState, useRef } from 'react';
import { socket } from '../socket';
import { Camera, Send, Heart, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';

export default function ClientPage() {
  const [hostStep, setHostStep] = useState<'waiting' | 'name' | 'q1' | 'q2' | 'photo' | 'results'>('waiting');
  const [localStep, setLocalStep] = useState<'name' | 'q1' | 'q2' | 'photo' | 'results'>('name');
  
  // Local state for answers
  const [userName, setUserName] = useState('');
  const [hasEnteredName, setHasEnteredName] = useState(false);
  const [q1Answer, setQ1Answer] = useState<'yes' | 'no' | null>(null);
  const [hasAnsweredQ1, setHasAnsweredQ1] = useState(false);
  const [q2Answer, setQ2Answer] = useState<string>('');
  const [hasAnsweredQ2, setHasAnsweredQ2] = useState(false);
  const [hasFinishedPhotos, setHasFinishedPhotos] = useState(false);
  const [hasUploadedPhoto, setHasUploadedPhoto] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  // Dynamic question text from host
  const [q1Text, setQ1Text] = useState('Do you have pets?');
  const [q2Text, setQ2Text] = useState('What pets do you have?');

  const userId = useRef(
    localStorage.getItem('userId') || 
    (() => {
      const id = Math.random().toString(36).substring(7);
      localStorage.setItem('userId', id);
      return id;
    })()
  ).current;

  useEffect(() => {
    socket.on('state:sync', (state) => {
      setHostStep(state.step);
      
      const hasName = !!state.names?.[userId];
      const hasQ1Obj = !!state.q1?.[userId];
      const hasQ2Obj = !!state.q2?.[userId];

      if (hasName) {
        setUserName(state.names[userId]);
        setHasEnteredName(true);
      } else {
        setUserName('');
        setHasEnteredName(false);
      }

      if (hasQ1Obj) {
        setQ1Answer(state.q1[userId]);
        setHasAnsweredQ1(true);
      } else {
        setQ1Answer(null);
        setHasAnsweredQ1(false);
      }

      if (hasQ2Obj) {
        setQ2Answer(state.q2[userId]);
        setHasAnsweredQ2(true);
      } else {
        setQ2Answer('');
        setHasAnsweredQ2(false);
      }
      
      // Determine local progression step
      if (!hasName) {
        setLocalStep('name');
        setHasFinishedPhotos(false);
      } else if (!hasQ1Obj) {
        setLocalStep('q1');
      } else if (!hasQ2Obj) {
        setLocalStep('q2');
      } else if (!hasFinishedPhotos) {
        setLocalStep('photo');
      } else {
        setLocalStep('results');
      }

      if (state.q1Text) setQ1Text(state.q1Text);
      if (state.q2Text) setQ2Text(state.q2Text);
    });

    socket.on('state:step-update', (newStep) => {
      setHostStep(newStep);
    });

    socket.on('state:q1-text-update', setQ1Text);
    socket.on('state:q2-text-update', setQ2Text);

    return () => {
      socket.off('state:sync');
      socket.off('state:step-update');
      socket.off('state:q1-text-update');
      socket.off('state:q2-text-update');
    };
  }, [userId]);

  const handleNameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userName.trim()) return;
    socket.emit('client:set-name', { userId, name: userName.trim() });
    setHasEnteredName(true);
    setLocalStep('q1');
  };

  const handleQ1 = (val: 'yes' | 'no') => {
    setQ1Answer(val);
    setHasAnsweredQ1(true);
    socket.emit('client:answer-q1', { userId, answer: val });
    setTimeout(() => {
      setLocalStep('q2');
    }, 400);
  };

  const handleQ2 = (e: React.FormEvent) => {
    e.preventDefault();
    if (!q2Answer.trim()) return;
    socket.emit('client:answer-q2', { userId, answer: q2Answer.trim() });
    setHasAnsweredQ2(true);
    setLocalStep('photo');
  };

  const compressAndUploadImage = (file: File) => {
    if (!file) return;
    setUploading(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 800;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        socket.emit('client:upload-photo', { userId, photoBase64: dataUrl });
        setHasUploadedPhoto(true);
        setUploading(false);
      };
      if (event.target?.result && typeof event.target.result === 'string') {
        img.src = event.target.result;
      }
    };
    reader.readAsDataURL(file);
  };

  // The view is blocked on waiting if the host dictates it, otherwise self-paced
  const currentView = hostStep === 'waiting' ? 'waiting' : localStep;

  return (
    <div className="min-h-screen bg-brand-bg flex flex-col font-brand-sans text-brand-ink">
      <header className="bg-brand-card shadow-sm p-4 text-center border-b border-brand-border">
        <h1 className="text-xl font-extrabold tracking-tight text-brand-ink">
          ADC Pet Poll
        </h1>
      </header>

      <main className="flex-grow flex flex-col items-center justify-center p-6 text-center">
        {currentView === 'waiting' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <Heart className="w-16 h-16 text-brand-accent mx-auto animate-pulse" />
            <h2 className="text-2xl font-bold text-brand-ink">Welcome!</h2>
            <p className="text-brand-text-sec max-w-sm">
              Please wait for the presenter to start the roll call...
            </p>
          </motion.div>
        )}

        {currentView === 'name' && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md space-y-6">
            <h2 className="text-3xl font-bold text-brand-ink tracking-tight leading-tight">
              Before we start...
            </h2>
            <p className="text-brand-text-sec">What's your name?</p>
            
            {hasEnteredName ? (
              <div className="bg-green-50 rounded-2xl p-6 text-green-800 border border-green-200">
                <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-green-600" />
                <h3 className="text-xl font-bold">Welcome, {userName}!</h3>
                <p className="mt-2 text-green-700">Moving to the next question...</p>
              </div>
            ) : (
              <form onSubmit={handleNameSubmit} className="space-y-4">
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="Your Name (e.g. Jane D.)"
                  className="w-full p-4 rounded-xl border border-brand-border shadow-sm focus:ring-2 focus:ring-brand-accent outline-none text-lg bg-brand-card text-brand-ink"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                />
                <button
                  type="submit"
                  className="w-full bg-brand-accent hover:opacity-90 text-white rounded-xl p-4 font-semibold text-lg flex items-center justify-center gap-2 shadow-md transition-opacity"
                >
                  <Send className="w-5 h-5" /> Join Session
                </button>
              </form>
            )}
          </motion.div>
        )}

        {currentView === 'q1' && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md space-y-8">
            <h2 className="text-3xl font-bold text-brand-ink tracking-tight">{q1Text}</h2>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => handleQ1('yes')}
                className={`py-8 rounded-2xl text-2xl font-semibold transition-all ${
                  q1Answer === 'yes'
                    ? 'bg-brand-accent text-white shadow-lg scale-105 ring-4 ring-brand-accent/30'
                    : 'bg-brand-card text-brand-text-sec shadow hover:bg-brand-bg border border-brand-border'
                }`}
              >
                Yes 🐶
              </button>
              <button
                onClick={() => handleQ1('no')}
                className={`py-8 rounded-2xl text-2xl font-semibold transition-all ${
                  q1Answer === 'no'
                    ? 'bg-brand-ink text-white shadow-lg scale-105 ring-4 ring-brand-ink/30'
                    : 'bg-brand-card text-brand-text-sec shadow hover:bg-brand-bg border border-brand-border'
                }`}
              >
                No ❌
              </button>
            </div>
            {hasAnsweredQ1 && (
              <p className="text-brand-text-sec flex justify-center items-center gap-2 mt-4 text-sm font-medium">
                <CheckCircle2 className="w-4 h-4 text-green-500" /> Moving to next question...
              </p>
            )}
          </motion.div>
        )}

        {currentView === 'q2' && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md space-y-6">
            <h2 className="text-3xl font-bold text-brand-ink tracking-tight leading-tight">
              {q2Text}
            </h2>
            <p className="text-brand-text-sec">Enter your pet type (Dog, Cat, Fish, etc.)</p>
            
            {hasAnsweredQ2 ? (
              <div className="bg-green-50 rounded-2xl p-6 text-green-800 border border-green-200">
                <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-green-600" />
                <h3 className="text-xl font-bold">Got it!</h3>
                <p className="mt-2 text-green-700">Moving to the photo upload step...</p>
              </div>
            ) : (
              <form onSubmit={handleQ2} className="space-y-4">
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="e.g. Golden Retriever"
                  className="w-full p-4 rounded-xl border border-brand-border shadow-sm focus:ring-2 focus:ring-brand-accent outline-none text-lg bg-brand-card text-brand-ink"
                  value={q2Answer}
                  onChange={(e) => setQ2Answer(e.target.value)}
                />
                <button
                  type="submit"
                  className="w-full bg-brand-accent hover:opacity-90 text-white rounded-xl p-4 font-semibold text-lg flex items-center justify-center gap-2 shadow-md transition-opacity"
                >
                  <Send className="w-5 h-5" /> Submit Response
                </button>
              </form>
            )}
          </motion.div>
        )}

        {currentView === 'photo' && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md space-y-6">
            <h2 className="text-3xl font-bold text-brand-ink tracking-tight">
              Share your pet photos! 📸
            </h2>
            <p className="text-brand-text-sec">Let's see those adorable faces.</p>
            
            {hasUploadedPhoto ? (
              <div className="bg-brand-accent/10 rounded-2xl p-6 text-brand-ink border border-brand-accent/20">
                <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-brand-accent" />
                <h3 className="text-xl font-bold">Amazing!</h3>
                <p className="mt-2 opacity-80">Your photo is heading to the main photo wall.</p>
                <div className="mt-6 flex flex-col gap-3">
                  <button 
                    onClick={() => setHasUploadedPhoto(false)}
                    className="font-medium text-brand-accent hover:opacity-80 transition-opacity"
                  >
                    Upload another photo
                  </button>
                  <button 
                    onClick={() => {
                      setHasFinishedPhotos(true);
                      setLocalStep('results');
                    }}
                    className="font-medium w-full py-3 bg-brand-accent text-white rounded-xl shadow-sm hover:opacity-90 transition-opacity"
                  >
                    I'm done sharing
                  </button>
                </div>
              </div>
            ) : (
              <label className={`block w-full border-2 border-dashed rounded-2xl p-10 cursor-pointer transition-colors ${uploading ? 'bg-brand-bg border-brand-border' : 'bg-brand-card border-brand-accent hover:bg-brand-accent/5'}`}>
                {uploading ? (
                  <div className="animate-pulse flex flex-col items-center">
                    <div className="w-12 h-12 border-4 border-brand-accent/30 border-t-brand-accent rounded-full animate-spin mb-4"></div>
                    <span className="text-brand-accent font-semibold text-lg">Compressing & Uploading...</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center text-brand-accent">
                    <Camera className="w-16 h-16 mb-4 opacity-80 text-brand-ink" />
                    <span className="font-semibold text-xl mb-1 text-brand-ink">Tap to select photo</span>
                    <span className="text-sm opacity-80 text-brand-text-sec">or take one right now</span>
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) compressAndUploadImage(file);
                  }}
                  disabled={uploading}
                />
              </label>
            )}
            
            {!hasUploadedPhoto && (
              <button 
                className="mt-6 font-medium text-brand-text-sec hover:text-brand-ink transition-colors"
                onClick={() => {
                  setHasFinishedPhotos(true);
                  setLocalStep('results');
                }}
              >
                Skip uploading photos
              </button>
            )}
          </motion.div>
        )}

        {currentView === 'results' && (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md space-y-6">
            <h2 className="text-3xl font-bold text-brand-ink">Check the main screen!</h2>
            <p className="text-brand-text-sec">We're reviewing all the awesome pets of ACD together.</p>
            <div className="py-8">
              <Heart className="w-24 h-24 text-brand-accent mx-auto animate-bounce" />
            </div>
            <p className="text-lg font-medium text-brand-ink">Thank you for participating!</p>
          </motion.div>
        )}
      </main>
    </div>
  );
}
