
import React, { useEffect, useState, useRef } from 'react';
import { Gavel, Scale, Shield, User as UserIcon, AlertTriangle, Mic } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from 'recharts';
import { Case, CaseStatus, User, Role, Vote } from '../types';
import { QRCodeSVG } from 'qrcode.react';
import { db } from '../services/firebase';
import { ref, onValue, off, set } from 'firebase/database';

interface BigScreenProps {
  pin: string;
  users: User[];
  activeCase: Case | null;
}

export const BigScreen: React.FC<BigScreenProps> = ({ pin, users, activeCase }) => {
  // Split users
  const jury = users.filter(u => u.role === Role.JURY);
  
  // Protests State
  const [activeProtests, setActiveProtests] = useState<{name: string, uid: string, timestamp: number}[]>([]);

  // Listen for protests explicitly for visual stacking
  useEffect(() => {
    const protestsRef = ref(db, `sessions/${pin}/protests`);
    const listener = onValue(protestsRef, (snapshot) => {
        if (snapshot.exists()) {
            const data = snapshot.val();
            // Map uids to names and sort by timestamp
            const protestList = Object.entries(data).map(([uid, timestamp]) => {
                const user = users.find(u => u.uid === uid);
                return { 
                    name: user ? user.name : 'Ukjent', 
                    uid, 
                    timestamp: timestamp as number 
                };
            }).sort((a, b) => a.timestamp - b.timestamp);
            
            setActiveProtests(protestList);
        } else {
            setActiveProtests([]);
        }
    });
    return () => off(protestsRef, listener);
  }, [pin, users]);


  // Voting data
  const votes: Vote[] = activeCase?.votes ? Object.values(activeCase.votes) : [];
  const yesVotes = votes.filter(v => v.verdict === 'YES').length;
  const noVotes = votes.filter(v => v.verdict === 'NO').length;
  const totalVotes = yesVotes + noVotes;
  
  const chartData = [
    { name: 'SKYLDIG', count: yesVotes, color: '#A01400' }, // Red
    { name: 'FRIKJENT', count: noVotes, color: '#22c55e' }, // Green
  ];

  // Verdict Animation State
  const [showVerdict, setShowVerdict] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const prevStatusRef = useRef<CaseStatus>(CaseStatus.IDLE);

  useEffect(() => {
    // Detect transition to Verdict (From Voting -> Guilty/NotGuilty)
    if (
      (activeCase?.status === CaseStatus.GUILTY || activeCase?.status === CaseStatus.NOT_GUILTY) &&
      prevStatusRef.current === CaseStatus.VOTING
    ) {
      setCountdown(5);
      setShowVerdict(false);
    } 
    // If we load the page and it is already finished (no transition), show immediately
    else if (activeCase?.status === CaseStatus.GUILTY || activeCase?.status === CaseStatus.NOT_GUILTY) {
      if (countdown === null) setShowVerdict(true);
    } 
    // Reset if we go back to IDLE or VOTING
    else {
      setShowVerdict(false);
      setCountdown(null);
    }
    
    if (activeCase) {
        prevStatusRef.current = activeCase.status;
    }
  }, [activeCase?.status]);

  // Countdown Timer Logic
  useEffect(() => {
    if (countdown === null) return;
    
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      // Countdown finished
      setShowVerdict(true);
    }
  }, [countdown]);

  // --- LOBBY VIEW ---
  if (!activeCase) {
    return (
      <div className="flex flex-col h-full bg-[#05080a] relative overflow-hidden font-sans">
        
        <header className="p-10 flex justify-between items-center z-10">
            <div className="flex items-center gap-6">
                 <img src="https://asker-gui.vercel.app/images/standard_832px-Asker_SK_logo.svg.png" alt="Asker Logo" className="h-20" />
                 <div className="h-12 w-px bg-white/10"></div>
                 <h1 className="text-3xl font-serif font-bold tracking-wider text-white uppercase">Asker Rettsråd</h1>
            </div>
            <div className="bg-asker-blue/10 px-6 py-2 rounded border border-asker-blue/20">
                 <span className="text-asker-blue font-mono font-bold tracking-widest uppercase">Lobby Status: Åpen</span>
            </div>
        </header>

        <div className="flex-1 flex flex-col items-center justify-center p-8 z-10">
            <div className="flex items-center gap-20 mb-20">
                 <div className="bg-white p-6 rounded-xl shadow-2xl">
                     <QRCodeSVG value={`${window.location.origin}/#/?pin=${pin}`} size={280} />
                 </div>
                 <div className="flex flex-col space-y-8">
                     <div>
                         <p className="text-slate-400 text-sm font-bold uppercase tracking-[0.2em] mb-2">Bli med på mobil</p>
                         <p className="text-5xl text-white font-serif">{window.location.host}</p>
                     </div>
                     <div>
                         <p className="text-asker-blue text-sm font-bold uppercase tracking-[0.2em] mb-2">Session PIN</p>
                         <p className="text-9xl font-bold text-white tracking-tighter font-mono tabular-nums">{pin}</p>
                     </div>
                 </div>
            </div>

            <div className="w-full max-w-7xl">
                 <div className="flex justify-between items-end mb-6 border-b border-white/5 pb-4">
                     <h2 className="text-xl font-medium text-slate-300 flex items-center gap-3">
                         <UserIcon size={20} />
                         Deltakere ({users.length})
                     </h2>
                 </div>
                 <div className="flex flex-wrap gap-3">
                     {users.map((u, i) => (
                         <div 
                            key={u.uid} 
                            className="bg-[#0f151a] text-slate-200 px-5 py-2 rounded border border-white/5 font-medium text-lg animate-in fade-in slide-in-from-bottom duration-300"
                            style={{ animationDelay: `${i * 50}ms` }}
                         >
                             {u.name}
                         </div>
                     ))}
                 </div>
            </div>
        </div>
      </div>
    );
  }

  // --- COURTROOM LAYOUT ---
  const speaker = activeCase.speaker || 'JUDGE'; // JUDGE, DEFENSE, WITNESS
  const isVoting = activeCase.status === CaseStatus.VOTING;
  const isFinished = activeCase.status === CaseStatus.GUILTY || activeCase.status === CaseStatus.NOT_GUILTY;
  const isCountingDown = countdown !== null && countdown > 0;

  return (
    <div className="flex flex-col h-full p-6 relative overflow-hidden bg-[#05080a]">
        
        {/* PROTEST OVERLAY (Visual Stack) */}
        <div className="absolute top-24 right-12 z-40 w-96 pointer-events-none perspective-[1000px]">
            {activeProtests.map((p, i) => (
                <div 
                    key={p.uid} 
                    className="absolute top-0 right-0 w-full transition-all duration-500 ease-out flex items-center gap-4 bg-asker-red text-white pl-5 pr-6 py-5 rounded-lg shadow-2xl border-l-4 border-white animate-in slide-in-from-right fade-in"
                    style={{
                        transform: `translate3d(0, ${i * 70}px, ${-i * 50}px) scale(${1 - i * 0.05})`,
                        zIndex: 50 - i,
                        opacity: i > 3 ? 0 : Math.max(0, 1 - i * 0.15) // Hide after 4th item to reduce clutter
                    }}
                >
                     <div className="bg-white/20 p-3 rounded-full animate-pulse shadow-inner">
                        <AlertTriangle size={28} />
                     </div>
                     <div>
                        <h2 className="text-xs font-bold uppercase tracking-widest opacity-80 mb-0.5">Protest!</h2>
                        <p className="text-2xl font-serif font-bold italic leading-none">{p.name}</p>
                     </div>
                </div>
            ))}
        </div>

        {/* --- ZONE 1: JUDGE (Top Center) --- */}
        <div className={`flex justify-center mb-8 transition-opacity duration-500 ${speaker === 'JUDGE' ? 'opacity-100' : 'opacity-50'}`}>
             <div className="text-center">
                 <div className="inline-block bg-[#0a0e12] px-12 py-4 rounded-b-xl border border-t-0 border-white/10 shadow-xl">
                     <div className="text-asker-gold font-bold uppercase tracking-[0.3em] text-xs mb-1">Dommerens Podium</div>
                     <div className="text-3xl font-serif text-white font-medium">Sak #{activeCase.id.substring(activeCase.id.length - 4)}</div>
                 </div>
             </div>
        </div>

        {/* --- MAIN STAGE --- */}
        <div className="flex-1 grid grid-cols-2 gap-12 relative z-10 px-12 pb-12">
            
            {/* --- ZONE 2: DEFENSE (Left) --- */}
            <div className={`relative transition-all duration-500 rounded-2xl overflow-hidden border ${speaker === 'DEFENSE' ? 'bg-[#0a0e12] border-asker-blue shadow-[0_0_50px_rgba(0,110,182,0.1)]' : 'bg-[#0a0e12]/50 border-white/5 opacity-60'}`}>
                <div className="h-full p-10 flex flex-col">
                    <div className="flex justify-between items-start mb-8">
                        <div>
                             <h2 className="text-slate-500 uppercase tracking-widest text-xs font-bold mb-2">Tiltalte</h2>
                             <div className="text-5xl font-bold text-white">{activeCase.defendantName}</div>
                        </div>
                        {speaker === 'DEFENSE' && <Mic size={32} className="text-asker-blue animate-pulse" />}
                    </div>
                    
                    <div className="space-y-10 mt-auto">
                        <div className="border-l-2 border-asker-blue pl-6">
                            <h3 className="text-asker-blue uppercase tracking-wider text-xs font-bold mb-2">Anklage</h3>
                            <p className="font-serif text-3xl text-slate-200 leading-snug">
                                {activeCase.title}
                            </p>
                        </div>
                        <div className="pl-6 border-l-2 border-white/10">
                            <h3 className="text-slate-500 uppercase tracking-wider text-xs font-bold mb-2">Detaljer</h3>
                            <p className="text-slate-300 text-xl leading-relaxed">
                                {activeCase.description}
                            </p>
                        </div>
                        <div className="pl-6">
                            <h3 className="text-asker-red uppercase tracking-wider text-xs font-bold mb-1">Strafferamme</h3>
                            <p className="text-5xl font-mono text-asker-red font-medium tracking-tight">{activeCase.amount},-</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* --- ZONE 3: WITNESS / VOTING / RESULTS (Right) --- */}
            <div className={`relative transition-all duration-500 rounded-2xl overflow-hidden border ${speaker === 'WITNESS' || isVoting || isFinished ? 'bg-[#0a0e12] border-asker-gold shadow-[0_0_50px_rgba(255,230,110,0.1)]' : 'bg-[#0a0e12]/50 border-white/5 opacity-60'}`}>
                <div className="h-full p-10 flex flex-col items-center justify-center text-center">
                    
                    {/* Mode: WITNESS SPEAKING */}
                    {!isVoting && !isFinished && !isCountingDown && (
                         <div className="flex flex-col items-center">
                            {speaker === 'WITNESS' ? (
                                <>
                                    <div className="w-24 h-24 bg-asker-gold/10 rounded-full flex items-center justify-center mb-8 border border-asker-gold/20 animate-[pulse_3s_infinite]">
                                        <Mic size={40} className="text-asker-gold" />
                                    </div>
                                    <h2 className="text-4xl font-serif text-white mb-4">Vitneboks</h2>
                                    <p className="text-xl text-slate-400">Ordet er fritt (Salen)</p>
                                    <div className="mt-8 px-4 py-1.5 bg-asker-gold/10 text-asker-gold border border-asker-gold/30 rounded uppercase tracking-widest text-xs font-bold">
                                        Mikrofon Åpen
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="opacity-30 grayscale">
                                        <Scale size={64} className="mx-auto text-slate-500 mb-6" />
                                        <h2 className="text-3xl font-serif text-slate-500 mb-4">Juryen Lytter</h2>
                                        <p className="text-lg text-slate-600">Avventer dommer...</p>
                                    </div>
                                </>
                            )}
                         </div>
                    )}

                    {/* Mode: VOTING */}
                    {isVoting && !isCountingDown && (
                        <div className="w-full h-full flex flex-col items-center justify-center animate-in fade-in zoom-in duration-300">
                            <h2 className="text-2xl font-bold text-center mb-12 text-asker-gold uppercase tracking-[0.2em] animate-pulse">Domstolens Avstemning</h2>
                            
                            <div className="relative mb-8">
                                    <div className="text-9xl font-bold text-white leading-none font-mono tabular-nums">
                                        {totalVotes}
                                    </div>
                                    <div className="text-xl text-slate-500 font-medium mt-4">
                                        Stemmer Avgitt
                                    </div>
                            </div>
                        </div>
                    )}

                    {/* Mode: COUNTDOWN (Overlay) */}
                    {isCountingDown && (
                        <div className="absolute inset-0 z-50 bg-[#05080a] flex flex-col items-center justify-center animate-in fade-in duration-200">
                             <div className="text-asker-blue text-2xl font-bold uppercase tracking-[0.5em] mb-12 animate-pulse">
                                Dommen faller om
                            </div>
                            <div 
                                key={countdown} 
                                className="text-[12rem] font-bold text-asker-gold font-mono tabular-nums animate-[ping_1s_cubic-bezier(0,0,0.2,1)_1]"
                            >
                                {countdown}
                            </div>
                             <div className="mt-12 text-slate-600 font-mono text-sm uppercase tracking-widest">
                                Avstemning Stengt
                            </div>
                        </div>
                    )}

                    {/* Mode: VERDICT REVEAL */}
                    {isFinished && showVerdict && !isCountingDown && (
                        <div className="w-full h-full flex flex-col justify-center animate-in zoom-in duration-500">
                            <div className="mb-12">
                                {activeCase.status === CaseStatus.GUILTY ? (
                                    <div className="inline-block border-8 border-asker-red px-12 py-8 rounded bg-asker-red text-white shadow-[0_0_100px_rgba(160,20,0,0.5)]">
                                            <h1 className="text-7xl font-bold uppercase tracking-tight">SKYLDIG</h1>
                                    </div>
                                ) : (
                                    <div className="inline-block border-8 border-green-500 px-12 py-8 rounded bg-green-500 text-white shadow-[0_0_100px_rgba(34,197,94,0.5)]">
                                            <h1 className="text-7xl font-bold uppercase tracking-tight">FRIKJENT</h1>
                                    </div>
                                )}
                            </div>
                            <div className="w-full h-48 px-12">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={chartData}>
                                        <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                                        <Bar dataKey="count" radius={[4, 4, 0, 0]} animationDuration={1500}>
                                            {chartData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    </div>
  );
};
