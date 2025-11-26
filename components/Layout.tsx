import React from 'react';

interface LayoutProps {
  children: React.ReactNode;
  fullScreen?: boolean;
}

export const Layout: React.FC<LayoutProps> = ({ children, fullScreen }) => {
  return (
    <div className={`min-h-[100dvh] flex flex-col relative overflow-hidden bg-asker-navy text-white selection:bg-asker-blue selection:text-white ${fullScreen ? 'h-screen' : ''}`}>
      
      {/* Decorative Asker Stripe Header */}
      <div className="h-2 w-full bg-asker-stripe relative z-50 shadow-[0_0_20px_rgba(0,110,182,0.6)] flex-shrink-0" />

      {/* Background Ambience - Made brighter and animated */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-asker-blue/20 blur-[120px] rounded-full animate-pulse" style={{ animationDuration: '8s' }} />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-asker-gold/10 blur-[120px] rounded-full animate-pulse" style={{ animationDuration: '10s', animationDelay: '1s' }} />
        <div className="absolute top-[40%] left-[40%] w-[20%] h-[20%] bg-asker-red/10 blur-[100px] rounded-full mix-blend-screen" />
        
        {/* Subtle Grid Pattern */}
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5"></div>
      </div>

      {/* Main Content */}
      <main className="flex-1 relative z-10 flex flex-col overflow-y-auto overflow-x-hidden">
        {children}
      </main>

      {/* Footer Branding - Hidden on mobile if needed, or small */}
      {!fullScreen && (
        <footer className="py-4 text-center text-[10px] text-slate-600 relative z-10 border-t border-white/5 bg-black/20 flex-shrink-0">
          <p className="font-semibold tracking-widest uppercase">Asker Skiklubb Håndball • Rettsråd</p>
        </footer>
      )}
    </div>
  );
};