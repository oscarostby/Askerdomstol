import React, { useEffect, useState } from 'react';
import { Layout } from './components/Layout';
import { BigScreen } from './components/BigScreen';
import { JudgeControls } from './components/JudgeControls';
import { PlayerView } from './components/PlayerView';
import { db, ensureAuth } from './services/firebase';
import { ref, onValue, set, get, push, update, serverTimestamp, DataSnapshot } from 'firebase/database';
import { User, Role, Case, Session, CaseStatus } from './types';
import { User as UserIcon, Lock, ArrowRight, Monitor, ArrowLeft, Gavel, Users, Loader2 } from 'lucide-react';

const App: React.FC = () => {
  // Global State
  const [viewMode, setViewMode] = useState<'LOGIN' | 'JUDGE' | 'PLAYER' | 'BIGSCREEN'>('LOGIN');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [pin, setPin] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Login Sub-state
  const [loginStep, setLoginStep] = useState<'SELECT' | 'FORM_PUBLIC' | 'FORM_OFFICIAL'>('SELECT');
  
  // Session State
  const [sessionUsers, setSessionUsers] = useState<User[]>([]);
  const [activeCase, setActiveCase] = useState<Case | null>(null);
  const [caseHistory, setCaseHistory] = useState<Case[]>([]);

  // Login Form Data
  const [loginName, setLoginName] = useState('');
  const [loginPass, setLoginPass] = useState(''); 
  const [loginPin, setLoginPin] = useState(''); 
  const [error, setError] = useState('');

  // Setup Big Screen from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode');
    const urlPin = params.get('pin');
    
    if (mode === 'bigscreen') {
      setViewMode('BIGSCREEN');
      if (urlPin) {
        setPin(urlPin);
        connectToSession(urlPin);
      }
    } else if (urlPin) {
        // Auto-fill pin for public
        setLoginPin(urlPin);
        setLoginStep('FORM_PUBLIC');
    }
    ensureAuth();
  }, []);

  // Listeners
  const connectToSession = (sessionPin: string) => {
    // Listen for Users
    const usersRef = ref(db, `sessions/${sessionPin}/users`);
    onValue(usersRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
            setSessionUsers(Object.values(data));
        } else {
            setSessionUsers([]);
        }
    });

    // Listen for Session Metadata (Active Case ID)
    const sessionRef = ref(db, `sessions/${sessionPin}`);
    onValue(sessionRef, (snapshot) => {
        const data = snapshot.val();
        if (data && data.activeCaseId) {
             // Fetch the case details
             const caseRef = ref(db, `sessions/${sessionPin}/cases/${data.activeCaseId}`);
             onValue(caseRef, (caseSnap) => {
                 if (caseSnap.exists()) {
                     setActiveCase(caseSnap.val());
                 } else {
                     setActiveCase(null);
                 }
             });
        } else {
            setActiveCase(null);
        }
    });

    // Listen for History
    const historyRef = ref(db, `sessions/${sessionPin}/cases`);
    onValue(historyRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
            const list: Case[] = Object.values(data);
            // Check for stale cases (Auto-Archive Rule: 2 hours)
            const twoHoursAgo = Date.now() - (2 * 60 * 60 * 1000);
            list.forEach(c => {
                 if (c.status === CaseStatus.IDLE && c.createdAt < twoHoursAgo) {
                      // Auto dismiss locally then update db
                      update(ref(db, `sessions/${sessionPin}/cases/${c.id}`), { status: CaseStatus.DISMISSED });
                 }
            });
            setCaseHistory(list.sort((a,b) => b.createdAt - a.createdAt));
        }
    });
  };

  // Handlers
  const handleJudgeLogin = async () => {
      setIsLoading(true);
      setError('');
      
      // Hardcoded check
      let role = Role.JUDGE;
      if (loginName === 'dommer' && loginPass === 'dommer123') role = Role.JUDGE;
      else if (loginName === 'advokat' && loginPass === 'advokat123') role = Role.LAWYER;
      else {
          setError("Feil brukernavn eller passord");
          setIsLoading(false);
          return;
      }

      const authUser = await ensureAuth();
      if (!authUser) {
          setError("Kunne ikke koble til server.");
          setIsLoading(false);
          return;
      }

      // Generate Session
      let sessionPin = Math.floor(1000 + Math.random() * 9000).toString();
      
      const userPayload: User = {
          uid: authUser.uid,
          name: role === Role.JUDGE ? 'Dommer' : 'Advokat',
          role: role,
          joinedAt: Date.now()
      };

      // Write Session
      await set(ref(db, `sessions/${sessionPin}`), {
          pin: sessionPin,
          createdAt: serverTimestamp(),
          isActive: true
      });
      await set(ref(db, `sessions/${sessionPin}/users/${authUser.uid}`), userPayload);

      setPin(sessionPin);
      setCurrentUser(userPayload);
      connectToSession(sessionPin);
      setViewMode('JUDGE');
      setIsLoading(false);
  };

  const handlePublicJoin = async () => {
      setIsLoading(true);
      setError('');

      if (!loginName || loginPin.length !== 4) {
          setError("Fyll inn navn og 4-sifret PIN");
          setIsLoading(false);
          return;
      }

      // Check if session exists
      const sessionSnap = await get(ref(db, `sessions/${loginPin}`));
      if (!sessionSnap.exists()) {
          setError("Fant ikke rettssalen (feil PIN)");
          setIsLoading(false);
          return;
      }

      const authUser = await ensureAuth();
      if (!authUser) {
          setIsLoading(false);
          return;
      }

      const userPayload: User = {
          uid: authUser.uid,
          name: loginName,
          role: Role.JURY,
          joinedAt: Date.now()
      };

      // Join
      await set(ref(db, `sessions/${loginPin}/users/${authUser.uid}`), userPayload);
      
      setPin(loginPin);
      setCurrentUser(userPayload);
      connectToSession(loginPin);
      setViewMode('PLAYER');
      setIsLoading(false);
  };

  const handleBigScreenManual = () => {
      if (loginPin.length !== 4) return;
      setPin(loginPin);
      connectToSession(loginPin);
      setViewMode('BIGSCREEN');
  };

  // Reset helper
  const goBack = () => {
      setLoginStep('SELECT');
      setError('');
      setLoginPass('');
      // Keep Name/PIN if user wants to edit
  };

  // Render Views
  if (viewMode === 'BIGSCREEN') {
      return (
          <Layout fullScreen>
              {pin ? (
                  <BigScreen pin={pin} users={sessionUsers} activeCase={activeCase} />
              ) : (
                  <div className="flex flex-col items-center justify-center h-full animate-in fade-in">
                      <h1 className="text-4xl font-serif text-asker-gold mb-8">Storskjerm Modus</h1>
                      <input 
                         type="text" 
                         placeholder="Skriv inn PIN" 
                         className="text-4xl p-4 rounded text-center text-black tracking-[0.5em] font-mono w-64 uppercase focus:ring-4 focus:ring-asker-blue outline-none"
                         maxLength={4}
                         value={loginPin}
                         onChange={e => setLoginPin(e.target.value)}
                      />
                      <button onClick={handleBigScreenManual} className="mt-8 bg-asker-blue px-8 py-3 rounded text-xl font-bold hover:bg-blue-600 transition-colors">
                          Koble til
                      </button>
                  </div>
              )}
          </Layout>
      );
  }

  if (viewMode === 'JUDGE' && currentUser) {
      return <JudgeControls pin={pin} users={sessionUsers} activeCase={activeCase} history={caseHistory} />;
  }

  if (viewMode === 'PLAYER' && currentUser) {
      return (
        <Layout>
            <PlayerView user={currentUser} activeCase={activeCase} pin={pin} />
        </Layout>
      );
  }

  // --- LOGIN FLOW ---
  return (
    <Layout>
        <div className="flex-1 flex flex-col items-center justify-center p-6 animate-in fade-in duration-700">
            
            {/* Header */}
            <div className="mb-10 text-center">
                <div className="relative inline-block">
                    <div className="absolute inset-0 bg-asker-gold blur-2xl opacity-20 rounded-full"></div>
                    <img src="https://asker-gui.vercel.app/images/standard_832px-Asker_SK_logo.svg.png" alt="Asker Logo" className="h-28 mx-auto mb-6 drop-shadow-2xl relative z-10" />
                </div>
                <h1 className="text-4xl font-serif font-bold text-asker-gold tracking-wider drop-shadow-md">ASKER RETTSRÅD</h1>
                <p className="text-slate-400 font-medium mt-2 uppercase tracking-widest text-xs">Offisiell Bot- og Straffedomstol</p>
            </div>

            {/* Step 1: Selection Screen */}
            {loginStep === 'SELECT' && (
                <div className="w-full max-w-md space-y-4 animate-in slide-in-from-right duration-300">
                    <button 
                        onClick={() => setLoginStep('FORM_PUBLIC')}
                        className="w-full bg-slate-800/80 hover:bg-asker-blue group border border-slate-700 hover:border-asker-blue transition-all duration-300 rounded-2xl p-6 text-left shadow-lg hover:shadow-[0_0_30px_rgba(0,110,182,0.3)] relative overflow-hidden"
                    >
                        <div className="flex items-center gap-6 relative z-10">
                            <div className="bg-slate-900 p-4 rounded-full group-hover:bg-white/20 transition-colors">
                                <Users size={32} className="text-asker-gold" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-white mb-1">Jury / Publikum</h2>
                                <p className="text-slate-400 text-sm group-hover:text-white/80">Delta i avstemninger og se saker</p>
                            </div>
                            <ArrowRight className="ml-auto opacity-0 group-hover:opacity-100 transform translate-x-[-10px] group-hover:translate-x-0 transition-all" />
                        </div>
                    </button>

                    <button 
                        onClick={() => setLoginStep('FORM_OFFICIAL')}
                        className="w-full bg-slate-800/80 hover:bg-slate-700 group border border-slate-700 hover:border-asker-gold transition-all duration-300 rounded-2xl p-6 text-left shadow-lg relative overflow-hidden"
                    >
                        <div className="flex items-center gap-6 relative z-10">
                            <div className="bg-slate-900 p-4 rounded-full group-hover:bg-asker-gold/20 transition-colors">
                                <Gavel size={32} className="text-slate-300 group-hover:text-asker-gold" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-white mb-1">Dommer / Advokat</h2>
                                <p className="text-slate-400 text-sm group-hover:text-white/80">Administrer saker og start retten</p>
                            </div>
                             <ArrowRight className="ml-auto opacity-0 group-hover:opacity-100 transform translate-x-[-10px] group-hover:translate-x-0 transition-all" />
                        </div>
                    </button>

                    <div className="mt-8 text-center">
                        <a href="/?mode=bigscreen" className="inline-flex items-center gap-2 text-slate-500 hover:text-white text-sm transition-colors py-2 px-4 rounded hover:bg-white/5">
                            <Monitor size={14} /> Åpne Storskjerm
                        </a>
                    </div>
                </div>
            )}

            {/* Step 2: Public Login */}
            {loginStep === 'FORM_PUBLIC' && (
                <div className="w-full max-w-sm glass-panel p-8 rounded-2xl shadow-2xl border border-white/10 animate-in slide-in-from-right duration-300">
                    <button onClick={goBack} className="flex items-center gap-1 text-slate-400 hover:text-white text-sm font-bold mb-6 transition-colors">
                        <ArrowLeft size={16} /> Tilbake
                    </button>
                    
                    <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                        <Users className="text-asker-blue" /> Jury Login
                    </h2>

                    <div className="space-y-5">
                        <div>
                            <label className="block text-xs uppercase text-slate-500 font-bold mb-1">Ditt Navn</label>
                            <input 
                                type="text" 
                                value={loginName}
                                onChange={e => setLoginName(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-4 text-white focus:ring-2 focus:ring-asker-blue outline-none transition-all placeholder:text-slate-600"
                                placeholder="Ola Nordmann"
                                autoFocus
                            />
                        </div>
                        <div>
                            <label className="block text-xs uppercase text-slate-500 font-bold mb-1">PIN Kode (Fra Storskjerm)</label>
                            <input 
                                type="number" 
                                value={loginPin}
                                onChange={e => setLoginPin(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-4 text-white focus:ring-2 focus:ring-asker-blue outline-none text-center tracking-[0.5em] font-mono text-xl transition-all placeholder:tracking-normal placeholder:text-slate-600"
                                placeholder="0000"
                                maxLength={4}
                            />
                        </div>
                        
                        {error && (
                            <div className="bg-red-500/20 border border-red-500/50 p-3 rounded text-red-200 text-sm text-center">
                                {error}
                            </div>
                        )}

                        <button 
                            onClick={handlePublicJoin}
                            disabled={isLoading}
                            className="w-full bg-asker-blue text-white font-bold py-4 rounded-lg shadow-lg hover:bg-blue-600 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-wait"
                        >
                            {isLoading ? <Loader2 className="animate-spin"/> : <><ArrowRight size={18} /> GÅ INN I SALEN</>}
                        </button>
                    </div>
                </div>
            )}

            {/* Step 3: Official Login */}
            {loginStep === 'FORM_OFFICIAL' && (
                <div className="w-full max-w-sm glass-panel p-8 rounded-2xl shadow-2xl border border-white/10 animate-in slide-in-from-right duration-300">
                    <button onClick={goBack} className="flex items-center gap-1 text-slate-400 hover:text-white text-sm font-bold mb-6 transition-colors">
                        <ArrowLeft size={16} /> Tilbake
                    </button>

                    <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                        <Gavel className="text-asker-gold" /> Offisiell Login
                    </h2>

                    <div className="space-y-5">
                        <div>
                            <label className="block text-xs uppercase text-slate-500 font-bold mb-1">Brukernavn</label>
                            <div className="relative">
                                <UserIcon className="absolute left-4 top-4 text-slate-500" size={18} />
                                <input 
                                    type="text" 
                                    value={loginName}
                                    onChange={e => setLoginName(e.target.value.toLowerCase())}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-4 pl-12 text-white focus:ring-2 focus:ring-asker-gold outline-none transition-all placeholder:text-slate-600"
                                    placeholder="dommer / advokat"
                                    autoFocus
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs uppercase text-slate-500 font-bold mb-1">Passord</label>
                            <div className="relative">
                                <Lock className="absolute left-4 top-4 text-slate-500" size={18} />
                                <input 
                                    type="password" 
                                    value={loginPass}
                                    onChange={e => setLoginPass(e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-4 pl-12 text-white focus:ring-2 focus:ring-asker-gold outline-none transition-all placeholder:text-slate-600"
                                    placeholder="••••••••"
                                />
                            </div>
                        </div>

                        {error && (
                            <div className="bg-red-500/20 border border-red-500/50 p-3 rounded text-red-200 text-sm text-center">
                                {error}
                            </div>
                        )}

                        <button 
                            onClick={handleJudgeLogin}
                            disabled={isLoading}
                            className="w-full bg-gradient-to-r from-asker-gold to-yellow-600 text-black font-bold py-4 rounded-lg shadow-lg hover:brightness-110 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-wait"
                        >
                            {isLoading ? <Loader2 className="animate-spin"/> : <><ArrowRight size={18} /> ÅPNE RETTEN</>}
                        </button>
                    </div>
                </div>
            )}
        </div>
    </Layout>
  );
};

export default App;