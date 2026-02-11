import { useEffect, useState } from 'react';
import { useStore } from './store/useStore';
import WorkbenchView from './views/WorkbenchView';
import MenuView from './views/MenuView';
import FreezerView from './views/FreezerView';
import HistoryView from './views/HistoryView';
import SettingsView from './views/SettingsView';

function App() {
  const { currentView, checkExpired, setCurrentView } = useStore();
  const [isMobile, setIsMobile] = useState(false);

  // Check mobile state
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const interval = setInterval(checkExpired, 60000);
    return () => clearInterval(interval);
  }, [checkExpired]);

  useEffect(() => { checkExpired(); }, [checkExpired]);

  const renderView = () => {
    switch (currentView) {
      case 'workbench': return <WorkbenchView />;
      case 'menu': return <MenuView />;
      case 'freezer': return <FreezerView />;
      case 'history': return <HistoryView />;
      case 'settings': return <SettingsView />;
      default: return <WorkbenchView />;
    }
  };

  const navItems = [
    { id: 'workbench', label: 'The Pass', icon: 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14z' },
    { id: 'menu', label: 'Mise en Place', icon: 'M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z' },
    { id: 'freezer', label: 'Réserve', icon: 'M13 13v8h8v-8h-8zM3 21h8v-8H3v8zM3 3v8h8V3H3zm13.66-1.31L11 7.34 16.66 13l5.66-5.66-5.66-5.65z' },
    { id: 'history', label: 'Le Journal', icon: 'M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z' },
  ] as const;

  return (
    <div className="min-h-screen bg-[var(--color-bg-app)] text-[var(--color-ink)] flex">
      {/* Desktop Sidebar */}
      {!isMobile && (
        <aside className="glass-sidebar w-[260px] flex-shrink-0 h-screen sticky top-0 flex flex-col pt-8 pb-4 px-3 z-50">
          <div className="px-3 mb-6">
            <h1 className="text-[15px] font-semibold text-[var(--color-ink)] tracking-tight flex items-center gap-2">
              <span className="w-5 h-5 bg-[#333] rounded-md text-white flex items-center justify-center text-xs">W</span>
              The Pass
            </h1>
          </div>

          <nav className="space-y-0.5 flex-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setCurrentView(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors ${currentView === item.id
                  ? 'bg-[rgba(0,0,0,0.06)] text-[var(--color-ink)]'
                  : 'text-[var(--color-ink-secondary)] hover:bg-[rgba(0,0,0,0.03)] hover:text-[var(--color-ink)]'
                  }`}
              >
                <svg className="w-4 h-4 opacity-70" viewBox="0 0 24 24" fill="currentColor">
                  <path d={item.icon} />
                </svg>
                {item.label}
              </button>
            ))}
          </nav>

          <div className="mt-auto px-3 py-2 border-t border-[rgba(0,0,0,0.06)]">
            <button
              onClick={() => setCurrentView('settings')}
              className={`w-full flex items-center gap-3 px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors ${currentView === 'settings' ? 'text-[var(--color-ink)]' : 'text-[var(--color-ink-secondary)] hover:text-[var(--color-ink)]'
                }`}
            >
              <svg className="w-4 h-4 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 15a3 3 0 100-6 3 3 0 000 6z" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" /></svg>
              Settings
            </button>
          </div>
        </aside>
      )}

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 flex flex-col h-screen overflow-hidden">
        {/* Mobile Header */}
        {isMobile && (
          <header className="glass-header sticky top-0 z-40 px-4 h-12 flex items-center justify-between flex-shrink-0">
            <div className="text-[17px] font-semibold text-[var(--color-ink)]">The Pass</div>
            <button onClick={() => setCurrentView('settings')} className="text-[var(--color-accent)] text-[15px]">Settings</button>
          </header>
        )}

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 md:pt-12 scroll-smooth">
          <div className="max-w-5xl mx-auto w-full">
            {renderView()}
          </div>
        </div>

        {/* Mobile Bottom Nav */}
        {isMobile && (
          <nav className="glass-header sticky bottom-0 z-50 pb-[env(safe-area-inset-bottom)] flex-shrink-0 border-t border-[rgba(0,0,0,0.08)]">
            <div className="flex justify-around items-center h-[50px]">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setCurrentView(item.id)}
                  className="flex-1 flex flex-col items-center justify-center"
                >
                  <svg className={`w-6 h-6 mb-0.5 ${currentView === item.id ? 'text-[var(--color-accent)]' : 'text-[#999]'}`} viewBox="0 0 24 24" fill="currentColor"><path d={item.icon} /></svg>
                  <span className={`text-[10px] font-medium ${currentView === item.id ? 'text-[var(--color-accent)]' : 'text-[#999]'}`}>{item.label}</span>
                </button>
              ))}
            </div>
          </nav>
        )}
      </main>
    </div>
  );
}

export default App;
