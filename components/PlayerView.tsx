
import React, { useState, useEffect } from 'react';
import { User, Case, CaseStatus, Vote, Role } from '../types';
import { db } from '../services/firebase';
import { ref, update, set } from 'firebase/database';
import { Gavel, AlertTriangle, Check, X, Hand, Mic, Lock, User as UserIcon, Scale, Clock } from 'lucide-react';

interface PlayerViewProps {
  user: User;
  activeCase: Case | null;
  pin: string;
}

export const PlayerView: React.FC<PlayerViewProps> = ({ user, activeCase, pin }) => {
  
  const isDefendant = activeCase?.defendantUid === user.uid || activeCase?.defendantName.toLowerCase() === user.name.toLowerCase();
  const userVote = activeCase?.votes?.[user.uid];

  // Cooldown State
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
      // Check storage for existing cooldown
      const lastProtest = localStorage.getItem(`protest_${pin}_${user.uid}`);
      if (lastProtest) {
          const elapsed = Math.floor((Date.now() - parseInt(lastProtest)) / 1000);
          if (elapsed < 300) {
              setCooldown(300 - elapsed);
          }
      }
  }, [pin, user.uid]);

  useEffect(() => {
      if (cooldown > 0) {
          const timer = setInterval(() => {
              setCooldown(c => Math.max(0, c - 1));
          }, 1000);
          return () => clearInterval(timer);
      }
  }, [cooldown]);

  const formatTime = (totalSeconds: number) => {
      const m = Math.floor(totalSeconds / 60);
      const s = totalSeconds % 60;
      return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const castVote = async (verdict: 'YES' | 'NO') => {
      if (!activeCase || isDefendant) return;
      if (navigator.vibrate) navigator.vibrate(50);

      const voteRef = ref(db, `sessions/${pin}/cases/${activeCase.id}/votes/${user.uid}`);
      const vote: Vote = {
          uid: user.uid,
          verdict,
          timestamp: Date.now()
      };
      await set(voteRef, vote);
  };

  const objection = async () => {
      if (cooldown > 0) return;

      if (navigator.vibrate) navigator.vibrate([50]);
      
      // Update cooldown
      localStorage.setItem(`protest_${pin}_${user.uid}`, Date.now().toString());
      setCooldown(300); // 5 minutes

      // Write protest to DB
      await update(ref(db, `sessions/${pin}/protests`), {
          [user.uid]: Date.now()
      });
  };

  // --- LOBBY / WAITING VIEW ---
  if (!activeCase) {
      return (
          <div className="h-[100dvh] flex flex-col relative overflow-hidden bg-[#05080a]">
              {/* Background Accents */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-asker-blue/5 rounded-full blur-[80px]" />
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-asker-gold/5 rounded-full blur-[80px]" />

              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center relative z-10">
                  <div className="w-20 h-20 bg-[#0f151a] rounded-2xl flex items-center justify-center mb-8 border border-white/10 shadow-xl rotate-3">
                      <Scale size={32} className="text-asker-gold" />
                  </div>
                  
                  <h2 className="text-2xl font-serif text-white mb-2 font-bold tracking-wide">Rettslokalet</h2>
                  <p className="text-slate-500 text-sm mb-12 max-w-[200px] leading-relaxed">
                      Avventer at dommeren skal åpne en ny sak.
                  </p>
                  
                  <div className="bg-[#0f151a]/80 backdrop-blur-md rounded-xl p-4 border border-white/5 w-full max-w-xs flex items-center gap-4">
                      <div className="bg-asker-blue/10 p-2 rounded-lg text-asker-blue">
                        <UserIcon size={20} />
                      </div>
                      <div className="text-left">
                          <p className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">Logget inn som</p>
                          <p className="text-white font-medium">{user.name}</p>
                      </div>
                  </div>
              </div>
          </div>
      );
  }

  // --- ACTIVE CASE VIEW ---
  const isVoting = activeCase.status === CaseStatus.VOTING;
  const isFinished = activeCase.status === CaseStatus.GUILTY || activeCase.status === CaseStatus.NOT_GUILTY;

  return (
    <div className="h-[100dvh] flex flex-col bg-[#05080a] relative overflow-hidden">
        
        {/* Top Bar */}
        <div className="px-6 py-4 flex justify-between items-end border-b border-white/5 bg-[#05080a]/90 backdrop-blur-sm z-20">
            <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-asker-red animate-pulse"></span>
                <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Direkte</span>
            </div>
            <div className="text-xs font-mono text-slate-500">Sak #{activeCase.id.substring(activeCase.id.length - 3)}</div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 pb-32 z-10">
            
            {/* 1. CASE CARD (The "Ticket") */}
            <div className="bg-[#0f151a] rounded-2xl border border-white/10 overflow-hidden shadow-2xl relative mb-6">
                {/* Visual Header */}
                <div className="h-2 bg-gradient-to-r from-asker-blue via-white to-asker-blue opacity-50" />
                
                <div className="p-6">
                    {/* Defendant Badge */}
                    {isDefendant ? (
                        <div className="inline-flex items-center gap-2 bg-asker-red/10 text-asker-red px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest mb-4 border border-asker-red/20">
                            <AlertTriangle size={12} />
                            Du er tiltalt
                        </div>
                    ) : (
                        <div className="inline-flex items-center gap-2 bg-asker-blue/10 text-asker-blue px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest mb-4 border border-asker-blue/20">
                            <Scale size={12} />
                            Tiltalebeslutning
                        </div>
                    )}

                    <h2 className="text-3xl font-serif text-white mb-1">{activeCase.defendantName}</h2>
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-6">Tiltalt for brudd på lagets vedtekter</p>

                    <div className="bg-black/20 rounded-xl p-4 border border-white/5 mb-6">
                        <p className="text-asker-gold text-xs font-bold uppercase tracking-wider mb-1">Anklage</p>
                        <p className="text-lg font-medium text-white leading-snug mb-2">{activeCase.title}</p>
                        <p className="text-sm text-slate-400 leading-relaxed">{activeCase.description}</p>
                    </div>

                    <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Strafferamme</span>
                        <span className="text-2xl font-mono text-asker-red font-medium">{activeCase.amount},-</span>
                    </div>
                </div>
            </div>

            {/* 2. DEFENDANT SPECIFIC UI */}
            {isDefendant && !isFinished && (
                <div className="text-center p-6 animate-in fade-in slide-in-from-bottom duration-500">
                    <div className="w-16 h-16 bg-[#1a2026] rounded-full flex items-center justify-center mx-auto mb-4 border border-white/10">
                        <Lock size={24} className="text-slate-500" />
                    </div>
                    <h3 className="text-white font-bold text-lg mb-1">Du har ikke stemmerett</h3>
                    <p className="text-slate-400 text-sm max-w-[250px] mx-auto">
                        Forbered ditt forsvar. Advokaten din vil føre ordet for deg.
                    </p>
                </div>
            )}

            {/* 3. RESULT VIEW (When finished) */}
            {isFinished && (
                <div className="text-center animate-in zoom-in duration-300 py-4">
                     {activeCase.status === CaseStatus.GUILTY ? (
                          <div className="bg-asker-red text-white p-8 rounded-2xl shadow-[0_10px_40px_rgba(160,20,0,0.3)]">
                            <Gavel size={48} className="mx-auto mb-4" />
                            <div className="text-4xl font-bold uppercase tracking-tight mb-2">SKYLDIG</div>
                            <p className="opacity-80 text-sm">Boten er vedtatt.</p>
                          </div>
                      ) : (
                          <div className="bg-green-600 text-white p-8 rounded-2xl shadow-[0_10px_40px_rgba(34,197,94,0.3)]">
                            <Check size={48} className="mx-auto mb-4" />
                            <div className="text-4xl font-bold uppercase tracking-tight mb-2">FRIKJENT</div>
                            <p className="opacity-80 text-sm">Tiltalte går fri.</p>
                          </div>
                      )}
                </div>
            )}
        </div>

        {/* Bottom Interaction Bar (Fixed) */}
        {!isFinished && !isDefendant && (
            <div className="bg-[#05080a] border-t border-white/10 p-4 pb-6 z-30 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
                
                {isVoting ? (
                    <div className="grid grid-cols-2 gap-3">
                         <button 
                            onClick={() => castVote('YES')}
                            className={`py-6 rounded-xl font-bold text-sm uppercase tracking-wider flex flex-col items-center gap-2 transition-all active:scale-95
                                ${userVote?.verdict === 'YES' 
                                    ? 'bg-asker-red text-white ring-2 ring-white shadow-[0_0_20px_rgba(160,20,0,0.4)]' 
                                    : 'bg-[#1a2026] text-slate-300 border border-white/10'}`}
                         >
                            <Gavel size={24} className={userVote?.verdict === 'YES' ? 'text-white' : 'text-asker-red'} />
                            Skyldig
                         </button>
                         <button 
                            onClick={() => castVote('NO')}
                            className={`py-6 rounded-xl font-bold text-sm uppercase tracking-wider flex flex-col items-center gap-2 transition-all active:scale-95
                                ${userVote?.verdict === 'NO' 
                                    ? 'bg-green-600 text-white ring-2 ring-white shadow-[0_0_20px_rgba(34,197,94,0.4)]' 
                                    : 'bg-[#1a2026] text-slate-300 border border-white/10'}`}
                         >
                            <span className="text-2xl">😇</span>
                            Frikjent
                         </button>
                    </div>
                ) : (
                    <button 
                        disabled={cooldown > 0}
                        onClick={objection}
                        className="w-full bg-[#1a2026] active:bg-[#252b33] border border-white/10 text-white font-bold py-4 rounded-xl flex items-center justify-between px-6 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed group"
                    >
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${cooldown > 0 ? 'bg-slate-800 text-slate-500' : 'bg-asker-gold/10 text-asker-gold'}`}>
                                <AlertTriangle size={20} />
                            </div>
                            <div className="text-left">
                                <span className="block text-sm uppercase tracking-wider">Protester</span>
                                <span className="block text-[10px] text-slate-500 font-normal">Be om ordet fra salen</span>
                            </div>
                        </div>
                        
                        {cooldown > 0 && (
                            <div className="text-slate-500 font-mono text-sm font-medium flex items-center gap-2">
                                <Clock size={14} />
                                {formatTime(cooldown)}
                            </div>
                        )}
                    </button>
                )}
            </div>
        )}
    </div>
  );
};
