
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
                  <div className="flex flex-col items-center justify-center h-full">
                      <h1 className="text-3xl font-serif text-white mb-8 tracking-wider uppercase">Storskjerm</h1>
                      <input 
                         type="text" 
                         placeholder="PIN" 
                         className="text-3xl p-4 bg-[#0a0e12] border border-white/20 rounded text-center text-white tracking-[0.5em] font-mono w-48 uppercase focus:border-asker-blue outline-none"
                         maxLength={4}
                         value={loginPin}
                         onChange={e => setLoginPin(e.target.value)}
                      />
                      <button onClick={handleBigScreenManual} className="mt-8 bg-asker-blue px-8 py-3 rounded text-lg font-bold hover:bg-blue-600 transition-colors text-white">
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
        <div className="flex-1 flex flex-col items-center justify-center p-6">
            
            {/* Header */}
            <div className="mb-12 text-center">
                <img src="https://asker-gui.vercel.app/images/standard_832px-Asker_SK_logo.svg.png" alt="Asker Logo" className="h-20 mx-auto mb-6" />
                <h1 className="text-3xl font-serif font-bold text-white tracking-widest uppercase">Asker Rettsråd</h1>
            </div>

            {/* Step 1: Selection Screen */}
            {loginStep === 'SELECT' && (
                <div className="w-full max-w-sm space-y-4">
                    <button 
                        onClick={() => setLoginStep('FORM_PUBLIC')}
                        className="w-full bg-[#0f151a] hover:bg-[#1a2026] border border-white/5 rounded-lg p-6 text-left transition-colors group"
                    >
                        <div className="flex items-center gap-4">
                            <div className="bg-[#1a2026] p-3 rounded group-hover:bg-asker-blue/10 group-hover:text-asker-blue transition-colors text-slate-400">
                                <Users size={24} />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-white mb-0.5">Jury / Publikum</h2>
                                <p className="text-slate-500 text-xs">Delta i avstemninger</p>
                            </div>
                            <ArrowRight className="ml-auto text-slate-600 group-hover:text-white transition-colors" size={16} />
                        </div>
                    </button>

                    <button 
                        onClick={() => setLoginStep('FORM_OFFICIAL')}
                        className="w-full bg-[#0f151a] hover:bg-[#1a2026] border border-white/5 rounded-lg p-6 text-left transition-colors group"
                    >
                        <div className="flex items-center gap-4">
                            <div className="bg-[#1a2026] p-3 rounded group-hover:bg-asker-gold/10 group-hover:text-asker-gold transition-colors text-slate-400">
                                <Gavel size={24} />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-white mb-0.5">Dommer / Advokat</h2>
                                <p className="text-slate-500 text-xs">Administrasjon</p>
                            </div>
                             <ArrowRight className="ml-auto text-slate-600 group-hover:text-white transition-colors" size={16} />
                        </div>
                    </button>

                    <div className="mt-8 text-center">
                        <a href="/?mode=bigscreen" className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-400 text-xs font-medium uppercase tracking-wider transition-colors">
                            <Monitor size={14} /> Åpne Storskjerm
                        </a>
                    </div>
                </div>
            )}

            {/* Step 2: Public Login */}
            {loginStep === 'FORM_PUBLIC' && (
                <div className="w-full max-w-sm">
                    <button onClick={goBack} className="flex items-center gap-2 text-slate-500 hover:text-white text-xs font-bold uppercase tracking-wider mb-8 transition-colors">
                        <ArrowLeft size={14} /> Tilbake
                    </button>
                    
                    <h2 className="text-xl font-bold text-white mb-6">Jury Login</h2>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs uppercase text-slate-500 font-bold mb-2 tracking-wider">Navn</label>
                            <input 
                                type="text" 
                                value={loginName}
                                onChange={e => setLoginName(e.target.value)}
                                className="w-full bg-[#0f151a] border border-white/10 rounded p-4 text-white focus:border-asker-blue outline-none transition-colors"
                                placeholder="Ditt navn..."
                                autoFocus
                            />
                        </div>
                        <div>
                            <label className="block text-xs uppercase text-slate-500 font-bold mb-2 tracking-wider">PIN</label>
                            <input 
                                type="number" 
                                value={loginPin}
                                onChange={e => setLoginPin(e.target.value)}
                                className="w-full bg-[#0f151a] border border-white/10 rounded p-4 text-white focus:border-asker-blue outline-none tracking-[0.2em] font-mono transition-colors"
                                placeholder="0000"
                                maxLength={4}
                            />
                        </div>
                        
                        {error && (
                            <div className="bg-red-500/10 border border-red-500/20 p-3 rounded text-red-400 text-sm text-center">
                                {error}
                            </div>
                        )}

                        <button 
                            onClick={handlePublicJoin}
                            disabled={isLoading}
                            className="w-full bg-asker-blue text-white font-bold py-4 rounded hover:bg-blue-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 mt-4"
                        >
                            {isLoading ? <Loader2 className="animate-spin" size={20} /> : 'Gå inn i salen'}
                        </button>
                    </div>
                </div>
            )}

            {/* Step 3: Official Login */}
            {loginStep === 'FORM_OFFICIAL' && (
                <div className="w-full max-w-sm">
                     <button onClick={goBack} className="flex items-center gap-2 text-slate-500 hover:text-white text-xs font-bold uppercase tracking-wider mb-8 transition-colors">
                        <ArrowLeft size={14} /> Tilbake
                    </button>

                    <h2 className="text-xl font-bold text-white mb-6">Offisiell Login</h2>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs uppercase text-slate-500 font-bold mb-2 tracking-wider">Brukernavn</label>
                            <input 
                                type="text" 
                                value={loginName}
                                onChange={e => setLoginName(e.target.value.toLowerCase())}
                                className="w-full bg-[#0f151a] border border-white/10 rounded p-4 text-white focus:border-asker-gold outline-none transition-colors"
                                autoFocus
                            />
                        </div>
                        <div>
                            <label className="block text-xs uppercase text-slate-500 font-bold mb-2 tracking-wider">Passord</label>
                            <input 
                                type="password" 
                                value={loginPass}
                                onChange={e => setLoginPass(e.target.value)}
                                className="w-full bg-[#0f151a] border border-white/10 rounded p-4 text-white focus:border-asker-gold outline-none transition-colors"
                            />
                        </div>

                        {error && (
                            <div className="bg-red-500/10 border border-red-500/20 p-3 rounded text-red-400 text-sm text-center">
                                {error}
                            </div>
                        )}

                        <button 
                            onClick={handleJudgeLogin}
                            disabled={isLoading}
                            className="w-full bg-asker-gold text-black font-bold py-4 rounded hover:bg-yellow-400 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 mt-4"
                        >
                            {isLoading ? <Loader2 className="animate-spin" size={20} /> : 'Åpne Retten'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    </Layout>
  );
};

export default App;