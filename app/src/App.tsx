import { useEffect } from 'react';
import { useStore } from './store/useStore';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { useTranslation } from './hooks/useTranslation';
import { useIsMobile } from './hooks/useMediaQuery';
import WorkbenchView from './views/WorkbenchView';
import MenuView from './views/MenuView';
import FreezerView from './views/FreezerView';
import HistoryView from './views/HistoryView';
import SettingsView from './views/SettingsView';
import LoginPage from './views/LoginPage';
import UserAvatarMenu from './components/UserAvatarMenu';

function AppContent() {
  const { currentView, checkExpired, setCurrentView, initializeForUser } = useStore();
  const { user, loading } = useAuth();
  const isMobile = useIsMobile();
  const { t } = useTranslation();

  // Cleanup legacy local storage
  useEffect(() => {
    localStorage.removeItem('llmApiKey');
  }, []);

  // Initialize store when user logs in
  useEffect(() => {
    if (user) {
      initializeForUser(user.uid);
    }
  }, [user, initializeForUser]);

  // Check expired items periodically
  useEffect(() => {
    const interval = setInterval(checkExpired, 60000);
    return () => clearInterval(interval);
  }, [checkExpired]);

  useEffect(() => { checkExpired(); }, [checkExpired]);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-bg-app)] flex items-center justify-center">
        <div className="text-[var(--color-ink-secondary)] text-[15px]">Loading...</div>
      </div>
    );
  }

  // Not logged in
  if (!user) {
    return <LoginPage />;
  }

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
    { id: 'workbench', label: t.nav.zapIn, icon: 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14z' },
    { id: 'menu', label: t.nav.todo, icon: 'M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z' },
    { id: 'freezer', label: t.nav.stash, icon: 'M13 13v8h8v-8h-8zM3 21h8v-8H3v8zM3 3v8h8V3H3zm13.66-1.31L11 7.34 16.66 13l5.66-5.66-5.66-5.65z' },
    { id: 'history', label: t.nav.traces, icon: 'M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z' },
  ] as const;

  return (
    <div className="min-h-screen bg-[var(--color-bg-app)] text-[var(--color-ink)] flex">
      {/* Desktop Sidebar */}
      {!isMobile && (
        <aside className="glass-sidebar w-[260px] flex-shrink-0 h-screen sticky top-0 flex flex-col pt-8 pb-4 px-3 z-50">
          <div className="px-3 mb-6">
            <h1 className="text-[15px] font-semibold text-[var(--color-ink)] tracking-tight flex items-center gap-2">
              <img src="/favicon-32x32.png" alt="The Pass" className="w-5 h-5 rounded" />
              {t.appName}
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

          <div className="mt-auto px-3 py-3 border-t border-[rgba(0,0,0,0.06)] flex items-center">
            <UserAvatarMenu />
            <span className="ml-2 text-[12px] text-[var(--color-ink-secondary)] truncate flex-1">
              {user.displayName || user.email}
            </span>
          </div>
        </aside>
      )}

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 flex flex-col h-screen overflow-hidden">
        {/* Mobile Header */}
        {isMobile && (
          <header className="glass-header sticky top-0 z-40 px-4 h-12 flex items-center justify-between flex-shrink-0">
            <div className="text-[17px] font-semibold text-[var(--color-ink)]">{t.appName}</div>
            <UserAvatarMenu size="sm" />
          </header>
        )}

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 md:pt-12 scroll-smooth">
          <div className="max-w-5xl mx-auto w-full">
            {renderView()}
          </div>
        </div>

        {/* Mobile Right Side Floating Dock */}
        {isMobile && (
          <nav className="fixed right-0 top-1/2 -translate-y-1/2 z-50 flex flex-col gap-0 bg-white/90 backdrop-blur-xl border-l border-t border-b border-black/5 rounded-l-2xl shadow-lg py-3 px-2">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setCurrentView(item.id)}
                className={`flex flex-col items-center justify-center gap-1 w-12 h-14 relative transition-all duration-200 ${currentView === item.id ? 'bg-[rgba(0,0,0,0.04)]' : ''}`}
              >
                <svg className={`w-6 h-6 transition-all duration-200 ${currentView === item.id ? 'text-[var(--color-accent)]' : 'text-[#999]'}`} viewBox="0 0 24 24" fill="currentColor">
                  <path d={item.icon} />
                </svg>
                <span className={`text-[10px] font-medium whitespace-nowrap ${currentView === item.id ? 'text-[var(--color-ink)]' : 'text-[var(--color-ink-secondary)]'}`}>
                  {item.label}
                </span>
              </button>
            ))}
          </nav>
        )}
      </main>
    </div>
  );
}

function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </LanguageProvider>
  );
}

export default App;
