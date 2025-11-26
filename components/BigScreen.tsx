import React, { useEffect, useState, useRef } from 'react';
import { Gavel, Scale, Shield, User as UserIcon, CheckCircle, XCircle, Clock } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from 'recharts';
import { Case, CaseStatus, User, Role, Vote } from '../types';
import { QRCodeSVG } from 'qrcode.react';

interface BigScreenProps {
  pin: string;
  users: User[];
  activeCase: Case | null;
}

export const BigScreen: React.FC<BigScreenProps> = ({ pin, users, activeCase }) => {
  // Split users
  const officials = users.filter(u => u.role === Role.JUDGE || u.role === Role.LAWYER);
  const jury = users.filter(u => u.role === Role.JURY);

  // Voting data
  const votes: Vote[] = activeCase?.votes ? Object.values(activeCase.votes) : [];
  const yesVotes = votes.filter(v => v.verdict === 'YES').length;
  const noVotes = votes.filter(v => v.verdict === 'NO').length;
  const totalVotes = yesVotes + noVotes;
  const totalJury = jury.length;

  const chartData = [
    { name: 'SKYLDIG', count: yesVotes, color: '#A01400' }, // Red
    { name: 'FRIKJENT', count: noVotes, color: '#22c55e' }, // Green
  ];

  // Verdict Animation State
  const [showVerdict, setShowVerdict] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const prevStatusRef = useRef<CaseStatus>(CaseStatus.IDLE);

  useEffect(() => {
    // Detect transition to Verdict
    if (
      (activeCase?.status === CaseStatus.GUILTY || activeCase?.status === CaseStatus.NOT_GUILTY) &&
      prevStatusRef.current === CaseStatus.VOTING
    ) {
      // Start Countdown
      setCountdown(5);
      setShowVerdict(false);
    } else if (activeCase?.status === CaseStatus.GUILTY || activeCase?.status === CaseStatus.NOT_GUILTY) {
      // If we load directly into a verdict (refresh), show immediately
      if (countdown === null) setShowVerdict(true);
    } else {
      setShowVerdict(false);
      setCountdown(null);
    }
    
    if (activeCase) {
        prevStatusRef.current = activeCase.status;
    }
  }, [activeCase?.status]);

  // Countdown Timer
  useEffect(() => {
    if (countdown === null) return;
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setShowVerdict(true);
    }
  }, [countdown]);

  // --- LOBBY VIEW (No Active Case) ---
  if (!activeCase) {
    return (
      <div className="flex flex-col h-full bg-gradient-to-br from-asker-navy via-slate-900 to-asker-navy relative overflow-hidden">
        {/* Background Anim */}
        <div className="absolute inset-0 z-0 opacity-20">
             <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-20 animate-pulse"></div>
        </div>

        {/* Header */}
        <header className="p-8 flex justify-between items-center relative z-10">
            <img src="https://asker-gui.vercel.app/images/standard_832px-Asker_SK_logo.svg.png" alt="Asker Logo" className="h-24 drop-shadow-2xl" />
            <div className="bg-black/40 px-6 py-2 rounded-full border border-white/10 backdrop-blur-md">
                 <h1 className="text-2xl font-serif font-bold tracking-wider text-asker-gold uppercase">Asker Rettsråd</h1>
            </div>
        </header>

        {/* Lobby Content */}
        <div className="flex-1 flex flex-col items-center justify-center p-8 relative z-10">
            
            <div className="flex items-start gap-16 mb-16 animate-in zoom-in duration-500">
                 {/* QR Card */}
                 <div className="bg-white p-4 rounded-3xl shadow-[0_0_50px_rgba(0,110,182,0.3)] transform -rotate-2">
                     <QRCodeSVG value={`${window.location.origin}/#/?pin=${pin}`} size={300} />
                     <div className="text-center mt-4">
                         <p className="text-slate-900 font-bold text-lg">Scan for å delta</p>
                     </div>
                 </div>

                 {/* PIN Card */}
                 <div className="flex flex-col items-start space-y-6">
                     <div>
                         <p className="text-asker-blue text-2xl font-bold uppercase tracking-widest mb-2">Gå til</p>
                         <p className="text-4xl text-white font-mono">{window.location.host}</p>
                     </div>
                     <div>
                         <p className="text-asker-blue text-2xl font-bold uppercase tracking-widest mb-2">Game PIN</p>
                         <p className="text-9xl font-black text-white tracking-tighter drop-shadow-lg font-mono">{pin}</p>
                     </div>
                 </div>
            </div>

            {/* Players Grid (Kahoot style) */}
            <div className="w-full max-w-6xl">
                 <div className="flex justify-between items-end mb-4 border-b border-white/10 pb-2">
                     <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                         <UserIcon className="text-asker-gold" />
                         Deltakere ({users.length})
                     </h2>
                     <p className="text-slate-400 animate-pulse">Venter på spillere...</p>
                 </div>
                 
                 <div className="flex flex-wrap gap-4 justify-center">
                     {users.map((u, i) => (
                         <div 
                            key={u.uid} 
                            className="bg-asker-blue text-white px-6 py-3 rounded-full font-bold shadow-lg animate-in zoom-in spring-duration-300 border-2 border-white/20"
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

  // --- ACTIVE CASE VIEW ---
  const isDefendantFocus = activeCase.focusMode === 'DEFENDANT';

  return (
    <div className="flex flex-col h-full p-6 relative overflow-hidden transition-all duration-700 ease-in-out">
        {/* Top Podium */}
        <div className={`flex justify-center mb-8 relative z-20 transition-all duration-700 ${isDefendantFocus ? 'opacity-20 translate-y-[-50px]' : 'opacity-100'}`}>
             <div className="glass-panel px-12 py-4 rounded-b-2xl border-t-0 text-center shadow-[0_10px_40px_rgba(0,0,0,0.5)] transform translate-y-[-24px]">
                 <div className="text-asker-gold font-bold uppercase tracking-widest text-sm mb-1">Dommerens Podium</div>
                 <div className="text-2xl font-serif text-white">Sak #{activeCase.id.substring(activeCase.id.length - 4)}</div>
             </div>
        </div>

        <div className="grid grid-cols-12 gap-8 flex-1 relative z-10">
            {/* Left: Defendant Details */}
            <div 
                className={`
                    glass-panel rounded-2xl p-8 flex flex-col border-l-4 border-l-asker-blue relative overflow-hidden transition-all duration-700 ease-in-out
                    ${isDefendantFocus ? 'col-span-12 scale-105 shadow-[0_0_100px_rgba(0,110,182,0.4)] z-50' : 'col-span-4'}
                `}
            >
                <div className="absolute top-0 right-0 p-4 opacity-10">
                    <Scale size={120} />
                </div>
                <h2 className="text-slate-400 uppercase tracking-wider text-sm font-bold mb-2">Tiltalte</h2>
                <div className={`${isDefendantFocus ? 'text-8xl' : 'text-5xl'} font-bold text-white mb-6 leading-tight break-words transition-all duration-700`}>
                    {activeCase.defendantName}
                </div>
                
                <div className="space-y-6 mt-4">
                    <div>
                        <h3 className="text-asker-blue uppercase tracking-wider text-xs font-bold mb-1">Anklage</h3>
                        <p className={`font-serif text-slate-200 transition-all duration-700 ${isDefendantFocus ? 'text-5xl leading-tight' : 'text-2xl'}`}>
                            {activeCase.title}
                        </p>
                    </div>
                    <div>
                        <h3 className="text-asker-blue uppercase tracking-wider text-xs font-bold mb-1">Beskrivelse</h3>
                        <p className={`text-slate-400 leading-relaxed transition-all duration-700 ${isDefendantFocus ? 'text-2xl' : 'text-lg'}`}>
                            {activeCase.description}
                        </p>
                    </div>
                    <div className="mt-auto pt-8 border-t border-white/10">
                        <h3 className="text-asker-red uppercase tracking-wider text-xs font-bold mb-1">Bot</h3>
                        <p className="text-4xl font-mono text-asker-red">{activeCase.amount},- NOK</p>
                    </div>
                </div>
            </div>

            {/* Center: Live Action / Voting */}
            <div className={`col-span-8 glass-panel rounded-2xl p-8 flex flex-col justify-center items-center relative overflow-hidden transition-all duration-500 ${isDefendantFocus ? 'opacity-0 scale-90 translate-x-20' : 'opacity-100'}`}>
                
                {/* IDLE: Presentation */}
                {activeCase.status === CaseStatus.IDLE && (
                    <div className="text-center animate-in fade-in zoom-in duration-500">
                        <Scale size={80} className="mx-auto text-asker-blue mb-6 opacity-80" />
                        <h2 className="text-5xl font-bold text-white mb-4">Retten er satt</h2>
                        <p className="text-2xl text-slate-300">Anklager leser opp tiltalen...</p>
                    </div>
                )}

                {/* VOTING: Secret Count */}
                {activeCase.status === CaseStatus.VOTING && (
                    <div className="w-full h-full flex flex-col items-center justify-center animate-in fade-in">
                        <h2 className="text-4xl font-bold text-center mb-12 text-asker-gold animate-pulse uppercase tracking-widest">Juryen stemmer</h2>
                        
                        {/* Big Counter */}
                        <div className="relative mb-8">
                             <div className="text-[10rem] font-black text-white leading-none font-mono drop-shadow-[0_0_30px_rgba(0,110,182,0.5)]">
                                 {totalVotes}
                             </div>
                             <div className="absolute top-0 right-[-40px] text-4xl text-slate-500 font-bold">
                                 / {totalJury > 0 ? totalJury : '?'}
                             </div>
                        </div>
                        <p className="text-xl text-slate-400">Stemmer avgitt</p>

                        <div className="mt-12 flex gap-4">
                             <div className="w-3 h-3 rounded-full bg-white animate-bounce" style={{ animationDelay: '0ms'}}></div>
                             <div className="w-3 h-3 rounded-full bg-white animate-bounce" style={{ animationDelay: '150ms'}}></div>
                             <div className="w-3 h-3 rounded-full bg-white animate-bounce" style={{ animationDelay: '300ms'}}></div>
                        </div>
                    </div>
                )}

                {/* COUNTDOWN: Dramatic 5s */}
                {countdown !== null && countdown > 0 && (
                    <div className="absolute inset-0 z-50 bg-black/80 flex items-center justify-center backdrop-blur-sm">
                        <div className="text-[15rem] font-black text-asker-gold animate-ping opacity-90 font-mono">
                            {countdown}
                        </div>
                    </div>
                )}

                {/* VERDICT: Reveal */}
                {(activeCase.status === CaseStatus.GUILTY || activeCase.status === CaseStatus.NOT_GUILTY) && showVerdict && (
                    <div className="w-full h-full flex flex-col animate-in zoom-in duration-300">
                        {/* Result Header */}
                        <div className="text-center mb-8">
                            {activeCase.status === CaseStatus.GUILTY ? (
                                <div className="inline-block border-8 border-asker-red px-12 py-4 rounded-2xl bg-asker-red/10 rotate-[-2deg] shadow-[0_0_50px_rgba(160,20,0,0.5)]">
                                     <h1 className="text-8xl font-black text-asker-red uppercase tracking-tighter">SKYLDIG</h1>
                                </div>
                            ) : (
                                <div className="inline-block border-8 border-green-500 px-12 py-4 rounded-2xl bg-green-500/10 rotate-[-2deg] shadow-[0_0_50px_rgba(34,197,94,0.5)]">
                                     <h1 className="text-8xl font-black text-green-500 uppercase tracking-tighter">FRIKJENT</h1>
                                </div>
                            )}
                        </div>

                        {/* Chart Reveal */}
                        <div className="flex-1 w-full px-12">
                             <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData}>
                                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={24} fontWeight="bold" tickLine={false} axisLine={false} />
                                    <YAxis hide />
                                    <Bar dataKey="count" radius={[10, 10, 0, 0]} animationDuration={1500}>
                                        {chartData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}
                
                {/* Background effect for verdict */}
                {showVerdict && (
                    <div className={`absolute inset-0 z-0 opacity-10 ${activeCase.status === CaseStatus.GUILTY ? 'bg-asker-red' : 'bg-green-600'} mix-blend-overlay`} />
                )}
            </div>
        </div>
    </div>
  );
};