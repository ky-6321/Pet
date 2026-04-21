import React, { useEffect, useState, useMemo } from 'react';
import { socket } from '../socket';
import { QRCodeSVG } from 'qrcode.react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import ReactWordcloud from 'react-wordcloud';
import { motion } from 'motion/react';
import { Edit2 } from 'lucide-react';

type Step = 'waiting' | 'name' | 'q1' | 'q2' | 'photo' | 'results';

export default function HostPage() {
  const [step, setStep] = useState<Step>('waiting');
  const [names, setNames] = useState<Record<string, string>>({});
  const [q1, setQ1] = useState<Record<string, 'yes'|'no'>>({});
  const [q2, setQ2] = useState<Record<string, string>>({});
  const [photos, setPhotos] = useState<{id: string, url: string}[]>([]);
  const [q1Text, setQ1Text] = useState('Do you have pets?');
  const [q2Text, setQ2Text] = useState('What pets do you have?');

  // Resolve the proper URL. If the presenter is sharing their screen from inside the AI Studio editor (which wraps the app in a private sandbox iframe), 
  // we must automatically route the QR code to the public Development URL. If they are on the "Share" link (ais-pre) or a custom domain, use that.
  let appUrl = window.location.origin.replace(/\/$/, "");
  if (appUrl.includes('googleusercontent.com') || appUrl.includes('localhost') || appUrl.includes('127.0.0.1')) {
    appUrl = "https://ais-dev-33b33v65edqwzzcl3vzhmj-732310854724.asia-east1.run.app";
  }

  useEffect(() => {
    socket.on('state:sync', (state) => {
      setStep(state.step);
      setNames(state.names || {});
      setQ1(state.q1 || {});
      setQ2(state.q2 || {});
      setPhotos(state.photos || []);
      if (state.q1Text) setQ1Text(state.q1Text);
      if (state.q2Text) setQ2Text(state.q2Text);
    });

    socket.on('state:step-update', setStep);
    
    socket.on('state:names-update', setNames);
    socket.on('state:q1-update', setQ1);
    socket.on('state:q2-update', setQ2);
    
    socket.on('state:q1-text-update', setQ1Text);
    socket.on('state:q2-text-update', setQ2Text);

    socket.on('photo:new', (newPhoto) => {
      setPhotos(prev => [...prev, newPhoto]);
    });

    return () => {
      socket.off('state:sync');
      socket.off('state:step-update');
      socket.off('state:names-update');
      socket.off('state:q1-update');
      socket.off('state:q2-update');
      socket.off('state:q1-text-update');
      socket.off('state:q2-text-update');
      socket.off('photo:new');
    };
  }, []);

  const handleSetStep = (newStep: Step) => {
    socket.emit('host:set-step', newStep);
  };

  const handleReset = () => {
    if(window.confirm('Clear all poll data and start over?')) {
      socket.emit('host:reset');
    }
  };

  const handleExportCSV = () => {
    const uniqueIds = new Set([...Object.keys(names || {}), ...Object.keys(q1 || {}), ...Object.keys(q2 || {})]);
    
    let csv = `Participant ID,Name,"${q1Text.replace(/"/g, '""')}","${q2Text.replace(/"/g, '""')}"\n`;
    
    uniqueIds.forEach(id => {
      const userName = names[id] || 'Anonymous';
      const answer1 = q1[id] || '';
      const answer2 = q2[id] || '';
      
      const cleanName = userName.replace(/"/g, '""');
      const cleanAns2 = answer2.replace(/"/g, '""');
      
      csv += `"${id}","${cleanName}","${answer1}","${cleanAns2}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `acd_poll_results.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const q1Data = useMemo(() => {
    const yesCount = Object.values(q1 || {}).filter(v => v === 'yes').length;
    const noCount = Object.values(q1 || {}).filter(v => v === 'no').length;
    return [
      { name: 'Yes, I have pets', value: yesCount, fill: '#FF6B35' },
      { name: 'No pets yet', value: noCount, fill: '#64748B' }
    ];
  }, [q1]);

  const q2Words = useMemo(() => {
    const counts: Record<string, number> = {};
    Object.values(q2 || {}).forEach((answer: any) => {
      if (typeof answer !== 'string') return;
      const normalized = answer.trim().toLowerCase();
      if (!normalized) return;
      counts[normalized] = (counts[normalized] || 0) + 1;
    });
    return Object.entries(counts).map(([text, value]) => ({ text, value }));
  }, [q2]);

  const totalParticipants = useMemo(() => {
    const uniqueIds = new Set([...Object.keys(names || {}), ...Object.keys(q1 || {}), ...Object.keys(q2 || {})]);
    return uniqueIds.size;
  }, [names, q1, q2]);

  return (
    <div className="min-h-screen flex bg-brand-bg text-brand-ink font-brand-sans overflow-hidden">
      {/* Sidebar Controls */}
      <aside className="w-72 bg-brand-card p-6 flex flex-col z-20 border-r border-brand-border shadow-[0_4px_12px_rgba(0,0,0,0.03)] selection:bg-brand-accent/20">
        <h1 className="text-xl font-extrabold tracking-tight text-brand-ink mb-8">
          ADC Presenter
        </h1>

        <div className="space-y-3 flex-grow">
          <ControlButton active={step === 'waiting'} onClick={() => handleSetStep('waiting')} label="0. Lobby (QR)" />
          <ControlButton active={step === 'name'} onClick={() => handleSetStep('name')} label="1. Name / Roll Call" />
          <ControlButton active={step === 'q1'} onClick={() => handleSetStep('q1')} label="2. Do you have pets?" />
          <ControlButton active={step === 'q2'} onClick={() => handleSetStep('q2')} label="3. What pets?" />
          <ControlButton active={step === 'photo'} onClick={() => handleSetStep('photo')} label="4. Photo Upload" />
          <ControlButton active={step === 'results'} onClick={() => handleSetStep('results')} label="5. Photo Wall" />
        </div>

        <div className="pt-6 border-t border-brand-border space-y-4">
          <button 
            onClick={handleExportCSV}
            className="w-full py-3 px-4 bg-brand-accent/10 text-brand-accent hover:bg-brand-accent/20 border border-brand-accent/20 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
            Export to CSV
          </button>
          <button 
            onClick={handleReset}
            className="w-full py-3 px-4 bg-red-50 text-red-600 hover:bg-red-100 border border-red-100 rounded-xl text-sm font-semibold transition-colors"
          >
            Reset Session Data
          </button>
        </div>
      </aside>

      {/* Main Presentation Area (Bento Grid Dashboard) */}
      <main className="flex-1 flex flex-col p-6 gap-6 overflow-hidden">
        
        <header className="flex justify-between items-center pb-2">
          <div className="session-info">
            <h1 className="text-[32px] font-extrabold tracking-[-0.03em] leading-tight text-brand-ink">ADC PET CONNECTION 2026</h1>
            <p className="text-brand-text-sec text-sm mt-1">Taipei • Shanghai • Singapore — {totalParticipants} ADC-ers participating</p>
          </div>
          <div className="bg-[#E11D48] text-white px-3.5 py-1.5 rounded-full text-xs font-bold uppercase flex items-center gap-1.5 shadow-sm">
            <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
            Live Session
          </div>
        </header>

        <div className="grid grid-cols-12 grid-rows-8 gap-5 flex-1 min-h-0">
          
          {/* JOIN BOX */}
          <section className={`col-span-3 row-span-4 bg-brand-ink text-white border border-brand-ink rounded-[20px] p-6 flex flex-col items-center justify-center text-center shadow-[0_4px_12px_rgba(0,0,0,0.03)] transition-all ${step === 'waiting' ? 'ring-4 ring-brand-accent/50' : ''}`}>
            <div className="w-40 h-40 bg-white p-3 rounded-xl mb-5 flex items-center justify-center">
              <QRCodeSVG value={appUrl} size={136} level="H" />
            </div>
            <h2 className="text-xl font-bold mb-2">Scan to Join</h2>
            <p className="opacity-70 text-[13px] font-mono break-all">{appUrl.replace(/^https?:\/\//, '')}</p>
          </section>

          {/* POLL RESULTS */}
          <section className={`col-span-4 row-span-4 bg-brand-card border border-brand-border rounded-[20px] p-6 shadow-[0_4px_12px_rgba(0,0,0,0.03)] flex flex-col transition-all overflow-hidden ${step === 'q1' ? 'ring-4 ring-brand-accent/50' : ''}`}>
            <div className="text-xs uppercase font-bold text-brand-text-sec mb-4 tracking-[0.05em] flex items-center gap-2">
              <span>📊</span> Live Poll
            </div>
            <div className="relative group mb-4">
              <textarea
                className="text-2xl font-bold leading-[1.2] text-brand-ink w-full bg-transparent border-b-2 border-transparent focus:border-brand-accent hover:border-brand-border outline-none resize-none overflow-hidden transition-colors"
                value={q1Text}
                rows={2}
                onChange={(e) => {
                  setQ1Text(e.target.value);
                  socket.emit('host:update-q1-text', e.target.value);
                }}
              />
              <Edit2 className="w-4 h-4 text-brand-text-sec absolute right-2 top-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
            </div>
            <div className="flex-1 min-h-0 relative -mx-4">
               <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie isAnimationActive={false} data={q1Data} cx="50%" cy="50%" innerRadius={80} outerRadius={120} paddingAngle={2} dataKey="value" label={({ name, percent }: any) => `${name} ${((percent || 0) * 100).toFixed(0)}%`} labelLine={false}>
                      {q1Data.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} stroke="rgba(0,0,0,0)" />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #E0E4E8', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }} />
                  </PieChart>
               </ResponsiveContainer>
            </div>
          </section>

          {/* WORD CLOUD */}
          <section className={`col-span-5 row-span-4 bg-brand-card border border-brand-border rounded-[20px] p-6 shadow-[0_4px_12px_rgba(0,0,0,0.03)] flex flex-col transition-all overflow-hidden ${step === 'q2' ? 'ring-4 ring-brand-accent/50' : ''}`}>
            <div className="text-xs uppercase font-bold text-brand-text-sec mb-4 tracking-[0.05em] flex items-center gap-2">
              <span>☁️</span> Word Cloud
            </div>
            <div className="relative group mb-2">
              <input
                className="text-xl font-bold leading-[1.2] text-brand-ink w-full bg-transparent border-b-2 border-transparent focus:border-brand-accent hover:border-brand-border outline-none transition-colors"
                value={q2Text}
                onChange={(e) => {
                  setQ2Text(e.target.value);
                  socket.emit('host:update-q2-text', e.target.value);
                }}
              />
              <Edit2 className="w-4 h-4 text-brand-text-sec absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
            </div>
            <div className="flex-1 min-h-0 w-full flex items-center justify-center p-4">
              {q2Words.length > 0 ? (
                <div className="w-full h-full flex flex-wrap items-center justify-center content-center gap-3 overflow-y-auto">
                  {q2Words.map((word, i) => {
                    const maxVal = Math.max(...q2Words.map(w => w.value));
                    const scale = 0.8 + (word.value / maxVal) * 1.5;
                    const colors = ['#FF6B35', '#1A1C1E', '#64748B'];
                    return (
                      <motion.div 
                        initial={{ scale: 0, opacity: 0 }} 
                        animate={{ scale: 1, opacity: 1 }} 
                        key={word.text} 
                        className="font-bold leading-none text-center"
                        style={{ 
                          fontSize: `${scale}rem`,
                          color: colors[i % colors.length],
                          textTransform: 'capitalize' 
                        }}
                      >
                        {word.text}
                        {word.value > 1 && <span className="text-xs ml-1 opacity-50 relative -top-2">x{word.value}</span>}
                      </motion.div>
                    )
                  })}
                </div>
              ) : (
                <div className="text-brand-text-sec text-lg font-medium opacity-50">Waiting for responses...</div>
              )}
            </div>
          </section>

          {/* ROLL CALL (NAMES) */}
          <section className={`col-span-4 row-span-4 bg-brand-card border border-brand-border rounded-[20px] p-6 shadow-[0_4px_12px_rgba(0,0,0,0.03)] flex flex-col transition-all overflow-hidden ${step === 'name' ? 'ring-4 ring-brand-accent/50' : ''}`}>
             <div className="text-xs uppercase font-bold text-brand-text-sec mb-4 tracking-[0.05em] flex items-center gap-2">
              <span>👋</span> Roll Call
            </div>
            <div className="flex-1 overflow-y-auto flex flex-wrap gap-2 content-start pr-2">
              {Object.values(names || {}).length === 0 ? (
                <div className="text-sm opacity-50 italic text-brand-text-sec">Awaiting participants...</div>
              ) : (
                Object.values(names || {}).map((name, i) => (
                  <motion.div initial={{scale:0}} animate={{scale:1}} key={i} className="bg-brand-bg px-3 py-1.5 rounded-lg text-sm font-semibold border border-brand-border text-brand-ink">
                    {name}
                  </motion.div>
                ))
              )}
            </div>
          </section>

          {/* PHOTO WALL */}
          <section className={`col-span-8 row-span-4 bg-brand-card border border-brand-border rounded-[20px] p-6 shadow-[0_4px_12px_rgba(0,0,0,0.03)] flex flex-col overflow-hidden transition-all ${(step === 'photo' || step === 'results') ? 'ring-4 ring-brand-accent/50' : ''}`}>
             <div className="text-xs uppercase font-bold text-brand-text-sec mb-4 tracking-[0.05em] flex justify-between items-center">
              <div className="flex items-center gap-2"><span>📸</span> Live Photo Wall</div>
              <span>{photos.length} Photos Shared</span>
            </div>
            <div className="flex gap-4 overflow-x-auto overflow-y-hidden pb-3 h-full items-center scroll-smooth">
              {photos.length === 0 ? (
                <div className="text-sm text-brand-text-sec italic opacity-70">Photos will appear here as participants share them...</div>
              ) : (
                photos.slice().reverse().map(p => (
                  <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} key={p.id} className="shrink-0 h-[110px] w-[160px] bg-brand-border rounded-xl relative overflow-hidden shadow-sm flex items-end p-2.5">
                    <img src={p.url} className="absolute inset-0 w-full h-full object-cover" alt="Pet Profile" referrerPolicy="no-referrer" />
                    <span className="relative z-10 bg-black/60 text-white text-[11px] px-2 py-1 rounded backdrop-blur-[4px] shadow-sm truncate max-w-[130px]">Just Now</span>
                  </motion.div>
                ))
              )}
            </div>
          </section>

        </div>
      </main>
    </div>
  );
}

function ControlButton({ active, onClick, label }: { active: boolean, onClick: () => void, label: string }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-5 py-4 rounded-xl transition-all duration-300 font-medium ${
        active 
          ? 'bg-brand-ink text-white shadow-md border-brand-ink' 
          : 'bg-transparent text-brand-text-sec hover:bg-brand-bg hover:text-brand-ink border-transparent'
      } border`}
    >
      {label}
    </button>
  );
}
