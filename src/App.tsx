import React, { useState } from 'react';
import { AuthProvider, useAuth } from './lib/auth';
import { ToastProvider } from './components/ui/Toast';
import { AppLayout, ActiveTab } from './components/layout/AppLayout';
import { LoginPage } from './pages/LoginPage';
import { OverviewPage } from './pages/OverviewPage';
import { LicensesPage } from './pages/LicensesPage';
import { LicenseDetailPage } from './pages/LicenseDetailPage';
import { DevicesPage } from './pages/DevicesPage';
import { AuditLogsPage } from './pages/AuditLogsPage';
import { AdminsPage } from './pages/AdminsPage';
import { SettingsPage } from './pages/SettingsPage';
import { ProfilePage } from './pages/ProfilePage';
import { CreateLicenseModal } from './components/CreateLicenseModal';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { Loader2 } from 'lucide-react';

const MainApp: React.FC = () => {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [selectedLicenseId, setSelectedLicenseId] = useState<string | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  // If Firebase auth is initializing
  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7F7F7] dark:bg-[#050505] text-[#111111] dark:text-[#FFFFFF] flex flex-col items-center justify-center p-4">
        <div className="w-10 h-10 rounded-xl bg-black dark:bg-white text-white dark:text-neutral-950 flex items-center justify-center font-bold text-sm tracking-widest mb-4 shadow-sm">
          AZOD
        </div>
        <div className="flex items-center gap-2 text-xs font-mono text-[#666666] dark:text-[#A1A1A1]">
          <Loader2 className="w-4 h-4 animate-spin text-black dark:text-white" />
          <span>Autenticando sessão administrativa...</span>
        </div>
      </div>
    );
  }

  // If not authenticated, show login page
  if (!user) {
    return <LoginPage />;
  }

  const handleNavigate = (tab: ActiveTab, detailId?: string) => {
    setActiveTab(tab);
    if (detailId) {
      setSelectedLicenseId(detailId);
    } else {
      setSelectedLicenseId(null);
    }
  };

  const handleSelectLicense = (id: string) => {
    setSelectedLicenseId(id);
    setActiveTab('licenses');
  };

  return (
    <AppLayout
      activeTab={activeTab}
      onNavigate={handleNavigate}
      onOpenCreateLicense={() => setCreateModalOpen(true)}
    >
      <ErrorBoundary key={activeTab} fallbackTitle={`Failed to load ${activeTab} view`}>
        {activeTab === 'overview' && (
          <OverviewPage
            onNavigate={(tab, detailId) => handleNavigate(tab, detailId)}
            onOpenCreateLicense={() => setCreateModalOpen(true)}
          />
        )}

        {activeTab === 'licenses' && (
          <>
            {selectedLicenseId ? (
              <LicenseDetailPage
                licenseId={selectedLicenseId}
                onBack={() => setSelectedLicenseId(null)}
              />
            ) : (
              <LicensesPage
                onSelectLicense={handleSelectLicense}
                onOpenCreateModal={() => setCreateModalOpen(true)}
              />
            )}
          </>
        )}

        {activeTab === 'devices' && (
          <DevicesPage
            onNavigateToLicense={(licId) => {
              setSelectedLicenseId(licId);
              setActiveTab('licenses');
            }}
          />
        )}

        {activeTab === 'audit' && <AuditLogsPage />}

        {activeTab === 'admins' && <AdminsPage />}

        {activeTab === 'settings' && <SettingsPage />}

        {activeTab === 'profile' && <ProfilePage />}
      </ErrorBoundary>

      {/* Global License Creation Modal */}
      <CreateLicenseModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSuccess={(created) => {
          setSelectedLicenseId(created.id);
          setActiveTab('licenses');
        }}
      />
    </AppLayout>
  );
};

import { ThemeProvider } from './lib/theme';

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <MainApp />
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
