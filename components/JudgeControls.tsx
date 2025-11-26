
import React, { useState, useEffect, useRef } from 'react';
import { User, Case, CaseStatus, Role } from '../types';
import { db } from '../services/firebase';
import { ref, push, set, update, serverTimestamp, remove, onValue, off } from 'firebase/database';
import { Gavel, Users, FileText, Check, X, Clock, Trash2, Mic, ArrowRight, Eye, Monitor, AlertTriangle, Shield, Mic2 } from 'lucide-react';

interface JudgeControlsProps {
  pin: string;
  users: User[];
  activeCase: Case | null;
  history: Case[];
}

export const JudgeControls: React.FC<JudgeControlsProps> = ({ pin, users, activeCase, history }) => {
  const [tab, setTab] = useState<'LOBBY' | 'CASE' | 'HISTORY'>('LOBBY');
  const [protests, setProtests] = useState<{uid: string, name: string}[]>([]);
  
  // New Case Form State
  const [defendantName, setDefendantName] = useState('');
  const [defendantUid, setDefendantUid] = useState<string | undefined>(undefined);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState<number>(50);
  const [description, setDescription] = useState('');

  // Switch to case tab automatically when active case exists
  useEffect(() => {
    if (activeCase) {
        setTab('CASE');
    }
  }, [activeCase?.id]);

  // Protest Listener
  useEffect(() => {
      const protestsRef = ref(db, `sessions/${pin}/protests`);
      const listener = onValue(protestsRef, (snapshot) => {
          if (snapshot.exists()) {
             const data = snapshot.val();
             // Map uids to names
             const list = Object.keys(data).map(uid => {
                 const u = users.find(usr => usr.uid === uid);
                 return { uid, name: u ? u.name : 'Ukjent' };
             });
             setProtests(list);
          } else {
              setProtests([]);
          }
      });
      return () => off(protestsRef, listener);
  }, [pin, users]);

  // Actions
  const handleIndict = (u: User) => {
      setDefendantName(u.name);
      setDefendantUid(u.uid);
      setTab('CASE'); // Switch to creation view
  };

  const createCase = async () => {
    if (!defendantName || !title) return;
    
    const newCaseRef = push(ref(db, `sessions/${pin}/cases`));
    const newCase: Case = {
        id: newCaseRef.key as string,
        defendantName,
        defendantUid: defendantUid, // Linked from lobby
        title,
        description,
        amount,
        status: CaseStatus.IDLE,
        createdAt: Date.now(),
        focusMode: 'OVERVIEW',
        speaker: 'JUDGE' // Default speaker
    };

    await set(newCaseRef, newCase);
    await update(ref(db, `sessions/${pin}`), { activeCaseId: newCaseRef.key });
    
    // Reset Form
    setDefendantName('');
    setDefendantUid(undefined);
    setTitle('');
    setDescription('');
    setAmount(50);
  };

  const updateStatus = async (status: CaseStatus) => {
     if (!activeCase) return;
     await update(ref(db, `sessions/${pin}/cases/${activeCase.id}`), { status });
  };

  const updateSpeaker = async (speaker: 'JUDGE' | 'DEFENSE' | 'WITNESS') => {
      if (!activeCase) return;
      await update(ref(db, `sessions/${pin}/cases/${activeCase.id}`), { speaker });
  };

  // Protest Handling
  const dismissProtest = async (uid: string) => {
      await remove(ref(db, `sessions/${pin}/protests/${uid}`));
  };

  const allowProtest = async (uid: string) => {
      // 1. Set speaker to WITNESS
      if (activeCase) {
          await update(ref(db, `sessions/${pin}/cases/${activeCase.id}`), { speaker: 'WITNESS' });
      }
      // 2. Clear this protest (handled)
      await remove(ref(db, `sessions/${pin}/protests/${uid}`));
  };

  const dismissCase = async () => {
      if (!activeCase) return;
      await update(ref(db, `sessions/${pin}/cases/${activeCase.id}`), { status: CaseStatus.DISMISSED });
      await update(ref(db, `sessions/${pin}`), { activeCaseId: null });
  }

  const archiveCase = async () => {
      await update(ref(db, `sessions/${pin}`), { activeCaseId: null });
  }

  // Quick inputs
  const quickFines = [
      { t: 'Glemt drakt', a: 100 },
      { t: 'Kom for sent', a: 50 },
      { t: 'Mobilbruk', a: 75 },
      { t: 'Dårlig stemning', a: 200 },
      { t: 'Upassende oppførsel', a: 150 }
  ];

  return (
    <div className="flex flex-col h-full bg-[#05080a] text-white pb-20">
        {/* Mobile Header */}
        <div className="bg-[#0a0e12] px-4 py-4 border-b border-white/5 flex justify-between items-center sticky top-0 z-30">
            <h1 className="text-white font-serif font-bold text-lg">Dommerpanel</h1>
            <div className="text-xs font-mono text-slate-400 bg-white/5 px-2 py-1 rounded">PIN: <span className="text-white">{pin}</span></div>
        </div>

        {/* Protest Notification Overlay (Interactive) */}
        <div className="fixed top-20 left-4 right-4 z-50 flex flex-col gap-2">
            {protests.map(p => (
                <div key={p.uid} className="bg-asker-red text-white p-4 rounded shadow-xl border-l-4 border-white animate-in slide-in-from-top duration-200">
                    <div className="flex items-center gap-3 mb-3">
                        <AlertTriangle className="shrink-0" size={20} />
                        <div>
                            <p className="font-bold uppercase text-xs tracking-wider">PROTEST</p>
                            <p className="text-sm font-medium">{p.name} vil ha ordet.</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <button onClick={() => dismissProtest(p.uid)} className="bg-black/20 py-2 rounded text-xs font-bold uppercase hover:bg-black/30">Avvis</button>
                        <button onClick={() => allowProtest(p.uid)} className="bg-white text-asker-red py-2 rounded text-xs font-bold uppercase hover:bg-white/90">Gi Ordet</button>
                    </div>
                </div>
            ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
            
            {/* --- LOBBY VIEW (INDICTMENT LIST) --- */}
            {tab === 'LOBBY' && (
                <div className="space-y-4">
                    <div className="bg-[#0f151a] p-6 rounded border border-white/5 text-center mb-6">
                        <p className="text-slate-500 text-xs uppercase font-bold tracking-widest mb-1">Room PIN</p>
                        <p className="text-3xl font-mono text-white tracking-[0.2em] font-medium">{pin}</p>
                        <p className="text-xs text-asker-blue mt-2 font-medium">
                            {users.length} deltakere tilkoblet
                        </p>
                    </div>

                    <h3 className="text-xs uppercase text-slate-500 font-bold ml-1 mb-2 tracking-wider">Deltakere (Klikk for å tiltale)</h3>
                    <div className="grid grid-cols-1 gap-2">
                        {users.filter(u => u.role === Role.JURY).map(u => (
                            <button 
                                key={u.uid}
                                onClick={() => handleIndict(u)}
                                className="bg-[#0f151a] hover:bg-[#1a2026] p-4 rounded flex justify-between items-center border border-white/5 text-left group transition-colors"
                            >
                                <span className="font-medium text-slate-200">{u.name}</span>
                                <div className="text-slate-600 group-hover:text-asker-red transition-colors">
                                    <Gavel size={18}/>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* --- ACTIVE CASE CONTROL --- */}
            {tab === 'CASE' && (
                <div className="space-y-8">
                    {activeCase ? (
                        <div className="space-y-8">
                            {/* Status Card */}
                            <div className="bg-[#0f151a] rounded p-5 border border-white/5 relative">
                                <div className="absolute top-4 right-4">
                                     <span className="text-xs font-mono text-slate-500">#{activeCase.id.substring(activeCase.id.length - 3)}</span>
                                </div>
                                <h2 className="text-xl font-bold text-white mb-1">{activeCase.defendantName}</h2>
                                <p className="text-slate-400 text-sm mb-3">{activeCase.title}</p>
                                <p className="text-2xl font-mono text-asker-red font-medium">{activeCase.amount},-</p>
                            </div>
                            
                            {/* SPEAKER CONTROL (New) */}
                            <div className="space-y-3">
                                <h3 className="text-xs uppercase text-slate-500 font-bold ml-1 tracking-wider">Hvem har ordet?</h3>
                                <div className="grid grid-cols-3 gap-2">
                                    <button 
                                        onClick={() => updateSpeaker('JUDGE')}
                                        className={`p-3 rounded border text-xs font-bold flex flex-col items-center justify-center gap-2 transition-all ${activeCase.speaker === 'JUDGE' ? 'bg-white text-black border-white' : 'bg-[#0f151a] border-white/5 text-slate-400'}`}
                                    >
                                        <Gavel size={18}/> Dommer
                                    </button>
                                    <button 
                                        onClick={() => updateSpeaker('DEFENSE')}
                                        className={`p-3 rounded border text-xs font-bold flex flex-col items-center justify-center gap-2 transition-all ${activeCase.speaker === 'DEFENSE' ? 'bg-asker-blue border-asker-blue text-white' : 'bg-[#0f151a] border-white/5 text-slate-400'}`}
                                    >
                                        <Shield size={18}/> Forsvar
                                    </button>
                                    <button 
                                        onClick={() => updateSpeaker('WITNESS')}
                                        className={`p-3 rounded border text-xs font-bold flex flex-col items-center justify-center gap-2 transition-all ${activeCase.speaker === 'WITNESS' ? 'bg-asker-gold text-black border-asker-gold' : 'bg-[#0f151a] border-white/5 text-slate-400'}`}
                                    >
                                        <Mic2 size={18}/> Vitne
                                    </button>
                                </div>
                            </div>

                            {/* Phase Controls */}
                            <div className="space-y-4 pt-6 border-t border-white/5">
                                <h3 className="text-xs uppercase text-slate-500 font-bold ml-1 tracking-wider">Handling</h3>
                                
                                {activeCase.status === CaseStatus.IDLE && (
                                    <button 
                                        onClick={() => updateStatus(CaseStatus.VOTING)}
                                        className="w-full bg-asker-blue text-white py-4 rounded font-bold text-lg hover:bg-blue-600 transition-colors flex items-center justify-center gap-3"
                                    >
                                        Start Avstemning
                                    </button>
                                )}

                                {activeCase.status === CaseStatus.VOTING && (
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-center p-3 bg-asker-gold/10 rounded border border-asker-gold/20">
                                            <p className="text-asker-gold font-bold uppercase tracking-widest text-xs">Avstemning pågår...</p>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <button 
                                                onClick={() => updateStatus(CaseStatus.GUILTY)}
                                                className="bg-asker-red text-white py-4 rounded font-bold text-lg hover:bg-red-700"
                                            >
                                                SKYLDIG
                                            </button>
                                            <button 
                                                onClick={() => updateStatus(CaseStatus.NOT_GUILTY)}
                                                className="bg-green-600 text-white py-4 rounded font-bold text-lg hover:bg-green-700"
                                            >
                                                FRIKJENT
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {(activeCase.status === CaseStatus.GUILTY || activeCase.status === CaseStatus.NOT_GUILTY) && (
                                     <button 
                                        onClick={archiveCase}
                                        className="w-full bg-[#1a2026] text-white py-4 rounded font-bold text-sm hover:bg-[#252b33] border border-white/10 flex items-center justify-center gap-2"
                                    >
                                        Arkiver & Ny Sak
                                    </button>
                                )}
                            </div>
                            
                            {activeCase.status === CaseStatus.IDLE && (
                                <button onClick={dismissCase} className="w-full py-4 text-xs text-slate-500 font-bold uppercase tracking-wider hover:text-red-500">
                                    Slett Sak
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="pb-10">
                             <div className="flex justify-between items-center mb-6">
                                 <h2 className="text-lg font-bold flex items-center gap-2 text-white"><FileText size={20} className="text-asker-gold"/> Ny Tiltale</h2>
                                 <button onClick={() => setTab('LOBBY')} className="text-xs text-asker-blue font-bold uppercase tracking-wider">Velg fra lobby</button>
                             </div>
                             
                             <div className="space-y-6">
                                <div>
                                    <label className="text-xs uppercase text-slate-500 font-bold mb-2 block tracking-wider">Navn</label>
                                    <input 
                                        type="text" 
                                        value={defendantName}
                                        onChange={(e) => setDefendantName(e.target.value)}
                                        className="w-full bg-[#0f151a] border border-white/10 rounded p-3 text-white focus:border-asker-blue outline-none font-medium"
                                        placeholder="Navn på tiltalte"
                                    />
                                </div>

                                <div>
                                    <label className="text-xs uppercase text-slate-500 font-bold mb-2 block tracking-wider">Lovbrudd</label>
                                    <div className="flex flex-wrap gap-2 mb-3">
                                        {quickFines.map(q => (
                                            <button key={q.t} onClick={() => { setTitle(q.t); setAmount(q.a); }} className="bg-[#0f151a] hover:bg-[#1a2026] px-3 py-2 rounded text-xs font-medium border border-white/5 transition-colors">
                                                {q.t}
                                            </button>
                                        ))}
                                    </div>
                                    <input 
                                        type="text" 
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        className="w-full bg-[#0f151a] border border-white/10 rounded p-3 text-white focus:border-asker-blue outline-none"
                                        placeholder="Beskrivelse..."
                                    />
                                </div>

                                <div>
                                    <label className="text-xs uppercase text-slate-500 font-bold mb-2 block tracking-wider">Bot (NOK)</label>
                                    <input 
                                        type="number" 
                                        value={amount}
                                        onChange={(e) => setAmount(parseInt(e.target.value))}
                                        className="w-full bg-[#0f151a] border border-white/10 rounded p-3 text-white focus:border-asker-red font-mono font-medium outline-none"
                                    />
                                </div>

                                <button 
                                    onClick={createCase}
                                    disabled={!defendantName || !title}
                                    className="w-full bg-asker-blue text-white font-bold py-4 rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed mt-4 transition-colors"
                                >
                                    OPPRETT SAK
                                </button>
                             </div>
                        </div>
                    )}
                </div>
            )}

            {/* --- HISTORY --- */}
            {tab === 'HISTORY' && (
                <div className="space-y-3">
                    {history.map(c => (
                        <div key={c.id} className="bg-[#0f151a] p-4 rounded border border-white/5 flex justify-between items-center">
                            <div>
                                <h3 className="font-bold text-slate-200 text-sm">{c.defendantName}</h3>
                                <p className="text-xs text-slate-500">{c.title}</p>
                            </div>
                            <div className="text-right">
                                <span className={`inline-block text-[10px] font-bold uppercase mb-1
                                    ${c.status === CaseStatus.GUILTY ? 'text-asker-red' : 
                                      c.status === CaseStatus.NOT_GUILTY ? 'text-green-500' : 'text-slate-500'}`}>
                                    {c.status === CaseStatus.DISMISSED ? 'HENLAGT' : c.status === CaseStatus.GUILTY ? 'SKYLDIG' : 'FRIKJENT'}
                                </span>
                                <p className="font-mono text-asker-gold text-sm">{c.amount} NOK</p>
                            </div>
                        </div>
                    ))}
                    {history.length === 0 && (
                         <div className="text-center py-12">
                            <Clock className="mx-auto text-slate-700 mb-3" size={24}/>
                            <p className="text-slate-600 text-sm">Ingen historikk.</p>
                         </div>
                    )}
                </div>
            )}
        </div>

        {/* --- BOTTOM NAVIGATION --- */}
        <div className="fixed bottom-0 left-0 w-full bg-[#05080a] border-t border-white/10 flex justify-around p-3 pb-6 z-40">
            <button 
                onClick={() => setTab('LOBBY')}
                className={`flex flex-col items-center gap-1.5 p-2 rounded transition-colors ${tab === 'LOBBY' ? 'text-white' : 'text-slate-600 hover:text-slate-400'}`}
            >
                <Users size={20} />
                <span className="text-[10px] font-bold uppercase tracking-wider">Lobby</span>
            </button>
            <button 
                onClick={() => setTab('CASE')}
                className={`flex flex-col items-center gap-1.5 p-2 rounded transition-colors ${tab === 'CASE' ? 'text-asker-gold' : 'text-slate-600 hover:text-slate-400'}`}
            >
                <Gavel size={20} />
                <span className="text-[10px] font-bold uppercase tracking-wider">Dommer</span>
            </button>
            <button 
                onClick={() => setTab('HISTORY')}
                className={`flex flex-col items-center gap-1.5 p-2 rounded transition-colors ${tab === 'HISTORY' ? 'text-white' : 'text-slate-600 hover:text-slate-400'}`}
            >
                <Clock size={20} />
                <span className="text-[10px] font-bold uppercase tracking-wider">Arkiv</span>
            </button>
        </div>
    </div>
  );
};