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
    { id: 'workbench', label: t.nav.zapIn, icon: 'M5 3a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H5z' }, // Rounded Square
    { id: 'menu', label: t.nav.todo, icon: 'M3 21h18L12 3 3 21z' }, // Triangle
    { id: 'freezer', label: t.nav.stash, icon: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z' }, // Star
    { id: 'history', label: t.nav.traces, icon: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z' }, // Circle/Traces
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
                <svg className="w-4 h-4 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
          <header className="glass-header sticky top-0 z-40 px-3 h-12 flex items-center justify-between flex-shrink-0 gap-2">
            <div className="text-[17px] font-semibold text-[var(--color-ink)] truncate">{t.appName}</div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <nav className="flex items-center gap-0.5">
                {navItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setCurrentView(item.id)}
                    className={`p-2 rounded-lg transition-all ${currentView === item.id
                      ? 'text-[var(--color-accent)] bg-[var(--color-surface-hover)]'
                      : 'text-[var(--color-ink-tertiary)] active:text-[var(--color-ink)]'
                      }`}
                    title={item.label}
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d={item.icon} />
                    </svg>
                  </button>
                ))}
              </nav>
              <div className="w-[1px] h-3 bg-[var(--color-border)] opacity-50" />
              <UserAvatarMenu size="sm" />
            </div>
          </header>
        )}

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 md:pt-12 scroll-smooth">
          <div className="max-w-5xl mx-auto w-full">
            {renderView()}
          </div>
        </div>


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
