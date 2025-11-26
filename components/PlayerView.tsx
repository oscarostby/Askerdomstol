import React from 'react';
import { User, Case, CaseStatus, Vote, Role } from '../types';
import { db } from '../services/firebase';
import { ref, update, set } from 'firebase/database';
import { Gavel, AlertTriangle, Check, X, Hand } from 'lucide-react';

interface PlayerViewProps {
  user: User;
  activeCase: Case | null;
  pin: string;
}

export const PlayerView: React.FC<PlayerViewProps> = ({ user, activeCase, pin }) => {
  
  const isDefendant = activeCase?.defendantUid === user.uid || activeCase?.defendantName.toLowerCase() === user.name.toLowerCase();
  
  const userVote = activeCase?.votes?.[user.uid];

  const castVote = async (verdict: 'YES' | 'NO') => {
      if (!activeCase || isDefendant) return;
      
      // Haptic Feedback
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
      // Haptic Feedback
      if (navigator.vibrate) navigator.vibrate([50, 50, 50]);
      
      // Write protest to DB so Judge sees it
      await update(ref(db, `sessions/${pin}/protests`), {
          [user.uid]: Date.now()
      });
  };

  if (!activeCase || activeCase.status === CaseStatus.IDLE) {
      return (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center animate-in fade-in">
              <div className="w-32 h-32 bg-asker-blue/10 rounded-full flex items-center justify-center mb-6 animate-pulse">
                  <Gavel size={48} className="text-asker-blue" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Du er i Rettslokalet</h2>
              <p className="text-slate-400 mb-8">Venter på at dommeren skal starte en sak...</p>
              
              <div className="p-4 bg-slate-800/50 rounded-lg w-full border border-slate-700">
                  <p className="text-xs uppercase text-slate-500 font-bold mb-1">Logget inn som</p>
                  <p className="text-xl font-bold text-asker-gold">{user.name}</p>
                  <p className="text-xs text-slate-400 uppercase tracking-widest mt-1">Jury Medlem</p>
              </div>
          </div>
      );
  }

  // Active Case UI
  return (
    <div className="h-full flex flex-col p-4 pb-8">
        {/* Case Info Card */}
        <div className="glass-panel rounded-xl p-5 mb-6 border border-white/10 shadow-lg relative overflow-hidden">
            {isDefendant && (
                <div className="absolute top-0 right-0 bg-asker-red text-white text-xs font-bold px-2 py-1 rounded-bl-lg animate-pulse">
                    DU ER TILTALT
                </div>
            )}
            <h2 className="text-slate-400 uppercase text-xs font-bold mb-1">Tiltalte</h2>
            <div className="text-3xl font-bold text-white mb-4">{activeCase.defendantName}</div>
            
            <div className="bg-black/20 rounded p-3 mb-4">
                <h3 className="text-asker-blue font-bold text-sm mb-1">{activeCase.title}</h3>
                <p className="text-sm text-slate-300 leading-snug">{activeCase.description}</p>
            </div>
            
            <div className="flex justify-between items-end">
                <div>
                     <span className="text-xs uppercase text-slate-500">Straff</span>
                </div>
                <div className="text-2xl font-mono text-asker-red font-bold">{activeCase.amount},-</div>
            </div>
        </div>

        {/* Voting Interface */}
        <div className="flex-1 flex flex-col justify-center gap-4">
            {activeCase.status === CaseStatus.VOTING ? (
                isDefendant ? (
                    <div className="text-center p-6 bg-slate-800 rounded-xl border border-asker-red/50">
                        <Hand className="mx-auto text-asker-red mb-4" size={40} />
                        <h3 className="text-xl font-bold text-white mb-2">Du har ikke stemmerett</h3>
                        <p className="text-slate-400 text-sm">Som tiltalt må du vente på juryens dom.</p>
                    </div>
                ) : (
                    <>
                         <button 
                            onClick={() => castVote('YES')}
                            className={`flex-1 py-4 rounded-xl font-bold text-2xl flex flex-col items-center justify-center gap-2 transition-all transform active:scale-95
                                ${userVote?.verdict === 'YES' ? 'bg-asker-red ring-4 ring-white scale-105' : 'bg-asker-red opacity-90 hover:opacity-100 shadow-[0_10px_0_rgb(100,20,0)] active:shadow-none active:translate-y-[10px]'}`}
                         >
                            <Gavel size={32} />
                            ENIG
                            <span className="text-sm font-normal opacity-70">(Skyldig)</span>
                         </button>
                         <button 
                            onClick={() => castVote('NO')}
                            className={`flex-1 py-4 rounded-xl font-bold text-2xl flex flex-col items-center justify-center gap-2 transition-all transform active:scale-95
                                ${userVote?.verdict === 'NO' ? 'bg-green-600 ring-4 ring-white scale-105' : 'bg-green-600 opacity-90 hover:opacity-100 shadow-[0_10px_0_rgb(20,100,50)] active:shadow-none active:translate-y-[10px]'}`}
                         >
                            <span className="text-3xl">😇</span>
                            UENIG
                            <span className="text-sm font-normal opacity-70">(Frikjent)</span>
                         </button>
                    </>
                )
            ) : (activeCase.status === CaseStatus.GUILTY || activeCase.status === CaseStatus.NOT_GUILTY) ? (
                 <div className="text-center flex-1 flex flex-col items-center justify-center animate-in zoom-in">
                      {activeCase.status === CaseStatus.GUILTY ? (
                          <>
                            <div className="text-6xl font-black text-asker-red mb-4">SKYLDIG</div>
                            <p className="text-white">Boten er vedtatt.</p>
                          </>
                      ) : (
                          <>
                            <div className="text-6xl font-black text-green-500 mb-4">FRIKJENT</div>
                            <p className="text-white">Tiltalte går fri.</p>
                          </>
                      )}
                 </div>
            ) : (
                <div className="flex-1 flex items-center justify-center">
                    <button 
                        disabled={isDefendant}
                        onClick={objection}
                        className="w-full h-32 bg-slate-800/50 border-2 border-slate-600 text-slate-400 font-bold rounded-xl uppercase tracking-widest hover:border-asker-gold hover:text-asker-gold hover:bg-asker-gold/10 disabled:opacity-20 disabled:cursor-not-allowed transition-all active:scale-95 active:bg-asker-gold/20 flex flex-col items-center justify-center gap-2"
                    >
                        <AlertTriangle size={32}/>
                        Protest!
                    </button>
                </div>
            )}
        </div>
    </div>
  );
};