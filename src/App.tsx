import React, { useState } from 'react';
import { AuthProvider, useAuth } from './lib/auth';
import { ToastProvider } from './components/ui/Toast';
import { AppLayout, ActiveTab } from './components/layout/AppLayout';
import { LoginPage } from './pages/LoginPage';
import { OverviewPage } from './pages/OverviewPage';
import { ProductsPage } from './pages/ProductsPage';
import { AppWorkspacePage } from './pages/AppWorkspacePage';
import { SessionsPage } from './pages/SessionsPage';
import { StoreProductsPage } from './pages/StoreProductsPage';
import { CustomersPage } from './pages/CustomersPage';
import { LicensesPage } from './pages/LicensesPage';
import { LicenseDetailPage } from './pages/LicenseDetailPage';
import { DevicesPage } from './pages/DevicesPage';
import { DiscordPage } from './pages/DiscordPage';
import { IntegrationsPage } from './pages/IntegrationsPage';
import { InfraDbPage } from './pages/InfraDbPage';
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
  const [selectedAppWorkspaceId, setSelectedAppWorkspaceId] = useState<string | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  // If Firebase auth is initializing
  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7F7F7] dark:bg-[#050505] text-[#111111] dark:text-[#FFFFFF] flex flex-col items-center justify-center p-4">
        <div className="w-10 h-10 rounded-xl bg-black dark:bg-white text-white dark:text-neutral-950 flex items-center justify-center font-bold text-sm tracking-widest mb-4 shadow-sm">
          ZOD
        </div>
        <div className="flex items-center gap-2 text-xs font-mono text-[#666666] dark:text-[#A1A1A1]">
          <Loader2 className="w-4 h-4 animate-spin text-black dark:text-white" />
          <span>Autenticando sessão ZOD STORE...</span>
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
    if (tab === 'licenses' && detailId) {
      setSelectedLicenseId(detailId);
    } else if ((tab === 'app-workspace' || tab === 'product-workspace') && detailId) {
      setSelectedAppWorkspaceId(detailId);
    } else {
      if (tab !== 'licenses') setSelectedLicenseId(null);
    }
  };

  const handleSelectLicense = (id: string) => {
    setSelectedLicenseId(id);
    setActiveTab('licenses');
  };

  const handleSelectAppWorkspace = (appId: string) => {
    setSelectedAppWorkspaceId(appId);
    setActiveTab('app-workspace');
  };

  return (
    <AppLayout
      activeTab={activeTab}
      onNavigate={handleNavigate}
      onOpenCreateLicense={() => setCreateModalOpen(true)}
    >
      <ErrorBoundary key={`${activeTab}-${selectedLicenseId || selectedAppWorkspaceId || 'main'}`} fallbackTitle={`Erro ao carregar visualização ${activeTab}`}>
        {activeTab === 'overview' && (
          <OverviewPage
            onNavigate={(tab, detailId) => handleNavigate(tab, detailId)}
            onOpenCreateLicense={() => setCreateModalOpen(true)}
          />
        )}

        {(activeTab === 'products' || activeTab === 'apps') && (
          <ProductsPage
            onSelectProduct={handleSelectAppWorkspace}
          />
        )}

        {(activeTab === 'app-workspace' || activeTab === 'product-workspace') && (
          <AppWorkspacePage
            appId={selectedAppWorkspaceId || 'azod'}
            onBack={() => setActiveTab('products')}
            onSelectLicense={handleSelectLicense}
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

        {activeTab === 'customers' && (
          <CustomersPage onNavigateToLicense={handleSelectLicense} />
        )}

        {activeTab === 'devices' && (
          <DevicesPage
            onNavigateToLicense={(licId) => {
              setSelectedLicenseId(licId);
              setActiveTab('licenses');
            }}
          />
        )}

        {activeTab === 'sessions' && (
          <SessionsPage
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

        {activeTab === 'store' && <StoreProductsPage />}

        {activeTab === 'discord' && <DiscordPage />}

        {activeTab === 'integrations' && <IntegrationsPage />}

        {activeTab === 'infra' && <InfraDbPage />}
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
