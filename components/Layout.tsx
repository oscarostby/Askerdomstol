import React from 'react';

interface LayoutProps {
  children: React.ReactNode;
  fullScreen?: boolean;
}

export const Layout: React.FC<LayoutProps> = ({ children, fullScreen }) => {
  return (
    <div className={`min-h-[100dvh] flex flex-col relative bg-asker-navy text-white selection:bg-asker-blue selection:text-white ${fullScreen ? 'h-screen overflow-hidden' : ''}`}>
      
      {/* Decorative Asker Stripe Header - Static and clean */}
      <div className="h-1.5 w-full bg-asker-stripe relative z-50 flex-shrink-0" />

      {/* Background - Clean Dark Gradient without movement */}
      <div className="fixed inset-0 z-0 pointer-events-none bg-gradient-to-b from-asker-navy to-[#020304]">
        {/* Subtle noise texture for premium feel */}
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-5"></div>
        {/* Very subtle static gradient spots for depth */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-asker-blue/5 rounded-full blur-[100px]" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-asker-gold/5 rounded-full blur-[100px]" />
      </div>

      {/* Main Content */}
      <main className="flex-1 relative z-10 flex flex-col overflow-y-auto overflow-x-hidden">
        {children}
      </main>

      {/* Footer Branding - Minimal */}
      {!fullScreen && (
        <footer className="py-6 text-center text-[10px] text-slate-600 relative z-10 border-t border-white/5 bg-[#020304] flex-shrink-0">
          <p className="font-medium tracking-widest uppercase text-slate-700">Asker Skiklubb Håndball • Rettsråd</p>
        </footer>
      )}
    </div>
  );
};