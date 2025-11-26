import React, { useState, useEffect, useRef } from 'react';
import { User, Case, CaseStatus, Role } from '../types';
import { db } from '../services/firebase';
import { ref, push, set, update, serverTimestamp, remove, onValue, off } from 'firebase/database';
import { Gavel, Users, FileText, Check, X, Clock, Trash2, Mic, ArrowRight, Eye, Monitor, AlertTriangle } from 'lucide-react';

interface JudgeControlsProps {
  pin: string;
  users: User[];
  activeCase: Case | null;
  history: Case[];
}

export const JudgeControls: React.FC<JudgeControlsProps> = ({ pin, users, activeCase, history }) => {
  const [tab, setTab] = useState<'LOBBY' | 'CASE' | 'HISTORY'>('LOBBY');
  const [protests, setProtests] = useState<string[]>([]);
  
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
             // Just show a count or recent notifications
             const data = snapshot.val();
             // Find users who protested
             const names = Object.keys(data).map(uid => users.find(u => u.uid === uid)?.name || 'Ukjent');
             setProtests(names);
             
             // Auto clear after 3s
             setTimeout(() => {
                 set(ref(db, `sessions/${pin}/protests`), null);
             }, 4000);
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
        focusMode: 'OVERVIEW'
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

  const updateFocus = async (focusMode: 'OVERVIEW' | 'DEFENDANT') => {
      if (!activeCase) return;
      await update(ref(db, `sessions/${pin}/cases/${activeCase.id}`), { focusMode });
  }

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
    <div className="flex flex-col h-full bg-asker-navy text-white pb-20">
        {/* Mobile Header */}
        <div className="bg-slate-900 px-4 py-3 border-b border-slate-800 flex justify-between items-center sticky top-0 z-30 shadow-md">
            <h1 className="text-asker-gold font-serif font-bold text-lg flex items-center gap-2">Dommerpanel</h1>
            <div className="text-xs font-mono bg-asker-blue/20 text-asker-blue border border-asker-blue/50 px-2 py-1 rounded font-bold">PIN: {pin}</div>
        </div>

        {/* Protest Notification Overlay */}
        {protests.length > 0 && (
            <div className="fixed top-16 left-4 right-4 z-50 animate-in slide-in-from-top duration-300">
                <div className="bg-asker-red text-white p-4 rounded-xl shadow-2xl border border-white/20 flex items-center gap-4">
                    <AlertTriangle className="animate-pulse shrink-0" size={24} />
                    <div>
                        <p className="font-bold uppercase text-sm">Protest!</p>
                        <p className="text-xs opacity-90">{protests.join(', ')} protesterer!</p>
                    </div>
                </div>
            </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
            
            {/* --- LOBBY VIEW (INDICTMENT LIST) --- */}
            {tab === 'LOBBY' && (
                <div className="space-y-4 animate-in fade-in">
                    <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-6 rounded-xl border border-slate-700 text-center mb-6 shadow-lg">
                        <p className="text-asker-gold text-xs uppercase font-bold tracking-widest mb-2">Rettslokalet er åpent</p>
                        <p className="text-4xl font-mono text-white tracking-[0.2em] font-bold">{pin}</p>
                        <p className="text-xs text-slate-500 mt-3 bg-black/30 inline-block px-3 py-1 rounded-full">
                            <span className="w-2 h-2 bg-green-500 rounded-full inline-block mr-2"></span>
                            {users.length} deltakere tilkoblet
                        </p>
                    </div>

                    <h3 className="text-xs uppercase text-slate-500 font-bold ml-1 mb-2">Jury & Publikum</h3>
                    <div className="grid grid-cols-1 gap-3">
                        {users.filter(u => u.role === Role.JURY).map(u => (
                            <button 
                                key={u.uid}
                                onClick={() => handleIndict(u)}
                                className="bg-slate-800 hover:bg-slate-750 active:scale-98 transition-transform p-4 rounded-xl flex justify-between items-center border border-slate-700 shadow-sm text-left group"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-asker-blue to-blue-700 flex items-center justify-center font-bold text-sm shadow-inner text-white">
                                        {u.name.substring(0,1)}
                                    </div>
                                    <span className="font-semibold text-lg">{u.name}</span>
                                </div>
                                <div className="bg-asker-red/10 text-asker-red p-2 rounded-full group-hover:bg-asker-red group-hover:text-white transition-colors">
                                    <Gavel size={20}/>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* --- ACTIVE CASE CONTROL --- */}
            {tab === 'CASE' && (
                <div className="space-y-6 animate-in fade-in">
                    {activeCase ? (
                        <div className="space-y-6">
                            {/* Status Card */}
                            <div className="bg-slate-800 rounded-xl p-4 border border-asker-blue/30 relative">
                                <div className="absolute top-0 right-0 bg-asker-blue px-3 py-1 rounded-bl-lg rounded-tr-lg text-xs font-bold uppercase tracking-widest">
                                    Sak #{activeCase.id.substring(activeCase.id.length - 3)}
                                </div>
                                <h2 className="text-2xl font-bold text-white mb-1">{activeCase.defendantName}</h2>
                                <p className="text-asker-blue font-serif italic mb-2">{activeCase.title}</p>
                                <p className="text-2xl font-mono text-asker-red font-bold">{activeCase.amount},-</p>
                            </div>
                            
                            {/* Remote Control Panel */}
                            <div className="space-y-2">
                                <h3 className="text-xs uppercase text-slate-500 font-bold ml-1 flex items-center gap-1"><Monitor size={12}/> TV Fjernkontroll</h3>
                                <div className="grid grid-cols-2 gap-3">
                                    <button 
                                        onClick={() => updateFocus('OVERVIEW')}
                                        className={`p-3 rounded-lg border text-sm font-bold flex items-center justify-center gap-2 transition-all ${activeCase.focusMode === 'OVERVIEW' ? 'bg-asker-blue border-asker-blue text-white' : 'bg-slate-800 border-slate-700 text-slate-400'}`}
                                    >
                                        <Users size={16}/> Oversikt
                                    </button>
                                    <button 
                                        onClick={() => updateFocus('DEFENDANT')}
                                        className={`p-3 rounded-lg border text-sm font-bold flex items-center justify-center gap-2 transition-all ${activeCase.focusMode === 'DEFENDANT' ? 'bg-asker-blue border-asker-blue text-white' : 'bg-slate-800 border-slate-700 text-slate-400'}`}
                                    >
                                        <Eye size={16}/> Fokus Tiltalte
                                    </button>
                                </div>
                            </div>

                            {/* Phase Controls */}
                            <div className="space-y-2">
                                <h3 className="text-xs uppercase text-slate-500 font-bold ml-1 flex items-center gap-1"><Gavel size={12}/> Rettsprosess</h3>
                                
                                {activeCase.status === CaseStatus.IDLE && (
                                    <button 
                                        onClick={() => updateStatus(CaseStatus.VOTING)}
                                        className="w-full bg-asker-blue text-white py-5 rounded-xl font-bold text-xl animate-pulse hover:bg-blue-600 transition-colors shadow-lg flex items-center justify-center gap-3 active:scale-98"
                                    >
                                        <Gavel /> START AVSTEMNING
                                    </button>
                                )}

                                {activeCase.status === CaseStatus.VOTING && (
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-center p-4 bg-slate-900 rounded-xl border border-asker-blue/30">
                                            <p className="animate-pulse text-asker-gold font-bold uppercase tracking-widest text-sm">Avstemning pågår...</p>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <button 
                                                onClick={() => updateStatus(CaseStatus.GUILTY)}
                                                className="bg-asker-red text-white py-6 rounded-xl font-bold text-lg hover:bg-red-700 shadow-lg flex flex-col items-center gap-1 active:scale-95"
                                            >
                                                <X size={24} /> SKYLDIG
                                            </button>
                                            <button 
                                                onClick={() => updateStatus(CaseStatus.NOT_GUILTY)}
                                                className="bg-green-600 text-white py-6 rounded-xl font-bold text-lg hover:bg-green-700 shadow-lg flex flex-col items-center gap-1 active:scale-95"
                                            >
                                                <Check size={24} /> FRIKJENT
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {(activeCase.status === CaseStatus.GUILTY || activeCase.status === CaseStatus.NOT_GUILTY) && (
                                     <button 
                                        onClick={archiveCase}
                                        className="w-full bg-slate-700 text-white py-5 rounded-xl font-bold text-sm hover:bg-slate-600 border border-slate-500 flex items-center justify-center gap-2 active:scale-98"
                                    >
                                        <Clock size={16}/> ARKIVER OG NY SAK
                                    </button>
                                )}
                            </div>
                            
                            {activeCase.status === CaseStatus.IDLE && (
                                <button onClick={dismissCase} className="w-full py-4 text-xs text-slate-500 font-bold uppercase tracking-wider bg-black/20 rounded-lg">
                                    Avlys sak / Slett
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="animate-in slide-in-from-bottom duration-500 pb-10">
                             <div className="flex justify-between items-center mb-6">
                                 <h2 className="text-xl font-bold flex items-center gap-2 text-white"><FileText className="text-asker-gold"/> Ny Tiltale</h2>
                                 <button onClick={() => setTab('LOBBY')} className="text-xs text-asker-blue font-bold px-3 py-2 bg-asker-blue/10 rounded-lg">Velg fra lobby</button>
                             </div>
                             
                             <div className="space-y-5 bg-slate-800/50 p-5 rounded-2xl border border-slate-700">
                                <div className="relative">
                                    <label className="text-xs uppercase text-slate-500 font-bold ml-1 mb-1 block">Tiltalt Navn</label>
                                    <input 
                                        type="text" 
                                        value={defendantName}
                                        onChange={(e) => setDefendantName(e.target.value)}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-4 text-white focus:ring-2 focus:ring-asker-blue outline-none text-lg font-bold"
                                        placeholder="Skriv navn..."
                                    />
                                </div>

                                <div>
                                    <label className="text-xs uppercase text-slate-500 font-bold ml-1 mb-2 block">Velg Lovbrudd</label>
                                    <div className="flex flex-wrap gap-2 mb-3">
                                        {quickFines.map(q => (
                                            <button key={q.t} onClick={() => { setTitle(q.t); setAmount(q.a); }} className="bg-slate-700 hover:bg-asker-blue px-3 py-2 rounded-lg text-xs font-bold transition-all border border-slate-600 hover:border-asker-blue">
                                                {q.t}
                                            </button>
                                        ))}
                                    </div>
                                    <input 
                                        type="text" 
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-asker-blue outline-none"
                                        placeholder="Eller skriv eget..."
                                    />
                                </div>

                                <div>
                                    <label className="text-xs uppercase text-slate-500 font-bold ml-1 mb-1 block">Bot (NOK)</label>
                                    <input 
                                        type="number" 
                                        value={amount}
                                        onChange={(e) => setAmount(parseInt(e.target.value))}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-asker-red font-mono text-asker-red font-bold outline-none text-2xl"
                                    />
                                </div>

                                <button 
                                    onClick={createCase}
                                    disabled={!defendantName || !title}
                                    className="w-full bg-gradient-to-r from-asker-blue to-blue-600 text-white font-bold py-4 rounded-xl shadow-lg disabled:opacity-50 disabled:cursor-not-allowed mt-2 hover:brightness-110 transition-all text-lg active:scale-98"
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
                <div className="space-y-3 animate-in fade-in">
                    {history.map(c => (
                        <div key={c.id} className="bg-slate-800 p-4 rounded-lg border-l-4 border-slate-600 relative overflow-hidden flex justify-between items-center shadow">
                            <div>
                                <h3 className="font-bold text-white">{c.defendantName}</h3>
                                <p className="text-sm text-slate-400">{c.title}</p>
                            </div>
                            <div className="text-right">
                                <span className={`inline-block px-2 py-1 text-[10px] font-bold uppercase rounded mb-1
                                    ${c.status === CaseStatus.GUILTY ? 'bg-asker-red/20 text-asker-red' : 
                                      c.status === CaseStatus.NOT_GUILTY ? 'bg-green-500/20 text-green-500' : 'bg-slate-700 text-slate-400'}`}>
                                    {c.status === CaseStatus.DISMISSED ? 'HENLAGT' : c.status === CaseStatus.GUILTY ? 'SKYLDIG' : 'FRIKJENT'}
                                </span>
                                <p className="font-mono text-asker-gold font-bold">{c.amount} NOK</p>
                            </div>
                        </div>
                    ))}
                    {history.length === 0 && (
                         <div className="text-center py-12">
                            <Clock className="mx-auto text-slate-600 mb-2" size={32}/>
                            <p className="text-slate-500 italic">Ingen historikk enda.</p>
                         </div>
                    )}
                </div>
            )}
        </div>

        {/* --- BOTTOM NAVIGATION (MOBILE FIRST) --- */}
        <div className="fixed bottom-0 left-0 w-full bg-slate-900 border-t border-slate-800 flex justify-around p-2 pb-6 z-40 shadow-[0_-5px_20px_rgba(0,0,0,0.5)]">
            <button 
                onClick={() => setTab('LOBBY')}
                className={`flex flex-col items-center gap-1 p-3 rounded-xl transition-all ${tab === 'LOBBY' ? 'text-asker-blue bg-asker-blue/10' : 'text-slate-500'}`}
            >
                <Users size={24} />
                <span className="text-[10px] font-bold uppercase">Lobby</span>
            </button>
            <button 
                onClick={() => setTab('CASE')}
                className={`flex flex-col items-center gap-1 p-3 rounded-xl transition-all ${tab === 'CASE' ? 'text-asker-gold bg-asker-gold/10' : 'text-slate-500'}`}
            >
                <div className={`relative ${activeCase ? 'animate-bounce' : ''}`}>
                    <Gavel size={24} />
                    {activeCase && <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"></span>}
                </div>
                <span className="text-[10px] font-bold uppercase">Dommer</span>
            </button>
            <button 
                onClick={() => setTab('HISTORY')}
                className={`flex flex-col items-center gap-1 p-3 rounded-xl transition-all ${tab === 'HISTORY' ? 'text-asker-blue bg-asker-blue/10' : 'text-slate-500'}`}
            >
                <Clock size={24} />
                <span className="text-[10px] font-bold uppercase">Arkiv</span>
            </button>
        </div>
    </div>
  );
};