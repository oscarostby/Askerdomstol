
import React, { useState, useEffect } from 'react';
import { User, Case, CaseStatus, Vote, Role } from '../types';
import { db } from '../services/firebase';
import { ref, update, set } from 'firebase/database';
import { Gavel, AlertTriangle, Check, X, Hand, Mic } from 'lucide-react';

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
          const elapsed = (Date.now() - parseInt(lastProtest)) / 1000;
          if (elapsed < 300) {
              setCooldown(300 - Math.floor(elapsed));
          }
      }
  }, [pin, user.uid]);

  useEffect(() => {
      if (cooldown > 0) {
          const timer = setInterval(() => {
              setCooldown(c => c - 1);
          }, 1000);
          return () => clearInterval(timer);
      }
  }, [cooldown]);

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

  if (!activeCase || activeCase.status === CaseStatus.IDLE) {
      return (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center">
              <div className="w-24 h-24 bg-[#0f151a] rounded-full flex items-center justify-center mb-6 border border-white/5">
                  <Gavel size={32} className="text-slate-500" />
              </div>
              <h2 className="text-xl font-medium text-white mb-2">Du er i Rettslokalet</h2>
              <p className="text-slate-500 text-sm mb-12">Venter på at dommeren starter saken...</p>
              
              <div className="p-4 bg-[#0f151a] rounded border border-white/5 w-full max-w-xs">
                  <p className="text-xs uppercase text-slate-500 font-bold mb-1 tracking-wider">Din Profil</p>
                  <p className="text-lg font-medium text-white">{user.name}</p>
                  <p className="text-[10px] text-asker-blue uppercase tracking-widest mt-1 font-bold">Jury Medlem</p>
              </div>
          </div>
      );
  }

  // Active Case UI
  return (
    <div className="h-full flex flex-col p-6">
        {/* Case Info Card */}
        <div className="bg-[#0f151a] rounded-lg p-6 mb-8 border border-white/5 relative shadow-sm">
            {isDefendant && (
                <div className="absolute top-0 right-0 bg-asker-red text-white text-[10px] font-bold px-2 py-1 rounded-bl uppercase tracking-wider">
                    Tiltalt
                </div>
            )}
            <h2 className="text-slate-500 uppercase text-xs font-bold mb-2 tracking-wider">Nåværende Sak</h2>
            <div className="text-2xl font-bold text-white mb-4">{activeCase.defendantName}</div>
            
            <div className="mb-4">
                <h3 className="text-asker-blue font-bold text-sm mb-1">{activeCase.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{activeCase.description}</p>
            </div>
            
            <div className="flex justify-between items-end border-t border-white/5 pt-3">
                <span className="text-xs uppercase text-slate-500 font-bold">Straff</span>
                <div className="text-xl font-mono text-white font-medium">{activeCase.amount},-</div>
            </div>
        </div>

        {/* Interaction Area */}
        <div className="flex-1 flex flex-col justify-end gap-4 pb-8">
            
            {/* VOTING PHASE */}
            {activeCase.status === CaseStatus.VOTING ? (
                isDefendant ? (
                    <div className="text-center p-6 bg-[#0f151a] rounded border border-white/5">
                        <Hand className="mx-auto text-slate-600 mb-3" size={32} />
                        <h3 className="text-lg font-bold text-white mb-1">Ingen stemmerett</h3>
                        <p className="text-slate-500 text-sm">Du må vente på dommen.</p>
                    </div>
                ) : (
                    <>
                         <button 
                            onClick={() => castVote('YES')}
                            className={`w-full py-5 rounded font-bold text-lg flex items-center justify-center gap-3 transition-colors
                                ${userVote?.verdict === 'YES' ? 'bg-asker-red text-white' : 'bg-[#0f151a] border border-white/10 text-slate-300 hover:bg-[#1a2026]'}`}
                         >
                            <Gavel size={20} />
                            SKYLDIG (Enig)
                         </button>
                         <button 
                            onClick={() => castVote('NO')}
                            className={`w-full py-5 rounded font-bold text-lg flex items-center justify-center gap-3 transition-colors
                                ${userVote?.verdict === 'NO' ? 'bg-green-600 text-white' : 'bg-[#0f151a] border border-white/10 text-slate-300 hover:bg-[#1a2026]'}`}
                         >
                            <span className="text-xl">😇</span>
                            FRIKJENT (Uenig)
                         </button>
                    </>
                )
            ) : (activeCase.status === CaseStatus.GUILTY || activeCase.status === CaseStatus.NOT_GUILTY) ? (
                 <div className="text-center flex-1 flex flex-col items-center justify-center">
                      {activeCase.status === CaseStatus.GUILTY ? (
                          <>
                            <div className="text-4xl font-bold text-asker-red mb-2 uppercase tracking-tight">SKYLDIG</div>
                            <p className="text-slate-400 text-sm">Boten er vedtatt.</p>
                          </>
                      ) : (
                          <>
                            <div className="text-4xl font-bold text-green-500 mb-2 uppercase tracking-tight">FRIKJENT</div>
                            <p className="text-slate-400 text-sm">Tiltalte går fri.</p>
                          </>
                      )}
                 </div>
            ) : (
                // LISTENING PHASE
                <div className="w-full">
                    {isDefendant ? (
                        <div className="text-center text-slate-500 text-sm italic py-8">
                             Følg med på dommeren.
                        </div>
                    ) : (
                        <>
                            <button 
                                disabled={cooldown > 0}
                                onClick={objection}
                                className="w-full bg-[#0f151a] border border-white/10 text-white font-bold py-6 rounded uppercase tracking-widest text-sm hover:bg-[#1a2026] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex flex-col items-center gap-2"
                            >
                                <AlertTriangle size={24} className={cooldown > 0 ? "text-slate-500" : "text-asker-gold"}/>
                                {cooldown > 0 ? `Vent ${cooldown}s` : 'Protest / Be om ordet'}
                            </button>
                        </>
                    )}
                </div>
            )}
        </div>
    </div>
  );
};