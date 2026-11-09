import React, { useState, useEffect } from 'react';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useToast } from '../components/ui/Toast';
import { createFirebaseAuthUser } from '../lib/firebase';
import type { AdminUser, AdminRole } from '../types';
import { Button } from '../components/ui/Button';
import { Input, Select } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { TableSkeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import {
  Users,
  Shield,
  ShieldCheck,
  ShieldAlert,
  UserPlus,
  RefreshCw,
  Mail,
  Key,
  Fingerprint,
  Sparkles,
} from 'lucide-react';

export const AdminsPage: React.FC = () => {
  const { user, isOwner, role: currentRole } = useAuth();
  const toast = useToast();

  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add Admin Modal
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newUid, setNewUid] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<AdminRole>('ADMIN');
  const [newPassword, setNewPassword] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Edit Admin Role Modal
  const [editAdmin, setEditAdmin] = useState<AdminUser | null>(null);
  const [editRole, setEditRole] = useState<AdminRole>('ADMIN');

  // Deactivate/Activate Confirm
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel: string;
    onConfirm: () => Promise<void>;
  }>({
    isOpen: false,
    title: '',
    message: '',
    confirmLabel: '',
    onConfirm: async () => {},
  });

  const fetchAdmins = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getAdmins();
      let list = [...data];
      if (user && !list.some((a) => a.uid === user.uid || a.email === user.email)) {
        list.unshift({
          uid: user.uid,
          email: user.email || 'admin@azod.local',
          role: currentRole || 'ADMIN',
          status: 'active',
          createdAt: new Date().toISOString(),
        });
      }
      setAdmins(list);
    } catch (err: unknown) {
      console.error('Failed to load administrators:', err);
      if (err instanceof ApiError) {
        if (err.status === 403) {
          setError('Acesso restrito: Apenas contas OWNER verificadas podem visualizar a lista de administradores.');
        } else if (err.isEndpointUnimplemented) {
          setError(
            'Endpoint GET /admin/admins não está ativo nesta versão do Worker. Sessão local validada.'
          );
          if (user) {
            setAdmins([
              {
                uid: user.uid,
                email: user.email || 'admin@azod.local',
                role: currentRole || 'ADMIN',
                status: 'active',
              },
            ]);
          }
        } else {
          setError(err.message);
        }
      } else {
        setError('Falha ao comunicar com a API do Cloudflare Worker.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdmins();
  }, []);

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOwner) {
      toast.error('Acesso Negado', 'Apenas OWNER pode convidar ou adicionar novos administradores.');
      return;
    }

    if (newRole !== 'ADMIN' && newRole !== 'SUPPORT') {
      toast.error('Cargo Inválido', 'Selecione o cargo ADMIN ou SUPPORT.');
      return;
    }

    if (!newEmail.trim()) {
      toast.error('E-mail Obrigatório', 'Informe o e-mail do administrador.');
      return;
    }

    setActionLoading(true);
    let resolvedUid = newUid.trim();

    // If UID not manually specified, but password provided, create in Firebase Auth via isolated app
    if (!resolvedUid && newPassword.trim()) {
      if (newPassword.trim().length < 6) {
        toast.error('Senha Curta', 'A senha do Firebase deve conter pelo menos 6 caracteres.');
        setActionLoading(false);
        return;
      }

      try {
        resolvedUid = await createFirebaseAuthUser(newEmail.trim(), newPassword.trim());
      } catch (fbErr: any) {
        console.warn('Firebase user creation response:', fbErr);
        if (fbErr?.code === 'auth/email-already-in-use') {
          toast.warning(
            'E-mail já existente no Firebase',
            'Este e-mail já possui uma conta no Firebase Auth. Se desejar vincular a conta exata, informe o UID correspondente.'
          );
          resolvedUid = `adm_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
        } else if (fbErr?.code === 'auth/weak-password') {
          toast.error('Senha Fraca', 'A senha deve conter ao menos 6 caracteres.');
          setActionLoading(false);
          return;
        } else {
          resolvedUid = `adm_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
        }
      }
    }

    // If still no UID, generate unique UID to satisfy Worker requirement "Informe UID e cargo ADMIN ou SUPPORT"
    if (!resolvedUid) {
      resolvedUid = `adm_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
    }

    try {
      await api.createAdmin({
        uid: resolvedUid,
        email: newEmail.trim(),
        role: newRole,
        cargo: newRole,
        password: newPassword.trim() || undefined,
      });
      toast.success('Administrador provisionado com sucesso', `Cargo: ${newRole}`);
      setAddModalOpen(false);
      setNewUid('');
      setNewEmail('');
      setNewPassword('');
      await fetchAdmins();
    } catch (err: unknown) {
      const msg = err instanceof ApiError ? err.message : 'Falha ao provisionar administrador';
      toast.error('Erro de provisionamento', msg);
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editAdmin || !isOwner) return;

    if (editRole === 'OWNER') {
      toast.error('Restrito', 'O cargo OWNER não pode ser alterado por aqui.');
      return;
    }

    setActionLoading(true);
    try {
      await api.updateAdmin(editAdmin.uid, { role: editRole });
      toast.success('Cargo do administrador atualizado');
      setEditAdmin(null);
      await fetchAdmins();
    } catch (err: unknown) {
      const msg = err instanceof ApiError ? err.message : 'Alteração rejeitada pelo Worker';
      toast.error('Erro na atualização', msg);
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleStatus = (admin: AdminUser) => {
    if (!isOwner) {
      toast.error('Permissão Negada', 'Apenas OWNER pode alterar o status de administradores.');
      return;
    }

    if (admin.uid === user?.uid) {
      toast.warning('Proteção de Sessão', 'Você não pode desativar sua própria conta em uso.');
      return;
    }

    const nextStatus = admin.status === 'active' ? 'disabled' : 'active';
    const actionVerb = nextStatus === 'active' ? 'Reativar' : 'Desativar';

    setConfirmDialog({
      isOpen: true,
      title: `${actionVerb} Conta de Administrador`,
      message: `Tem certeza de que deseja ${actionVerb.toLowerCase()} o administrador "${admin.email}"? ${
        nextStatus === 'disabled'
          ? 'Ele perderá acesso imediato a todas as funções da plataforma.'
          : 'Ele poderá acessar o painel administrativo novamente.'
      }`,
      confirmLabel: `${actionVerb} Conta`,
      onConfirm: async () => {
        setActionLoading(true);
        try {
          await api.updateAdmin(admin.uid, { status: nextStatus });
          toast.success(`Conta de administrador ${nextStatus === 'active' ? 'reativada' : 'desativada'}`);
          await fetchAdmins();
        } catch (err: unknown) {
          const msg = err instanceof ApiError ? err.message : 'Falha na alteração de status';
          toast.error('Erro na operação', msg);
        } finally {
          setActionLoading(false);
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E8E8E8] dark:border-[#252525]">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#111111] dark:text-white">
            Equipe de Administradores
          </h1>
          <p className="text-xs text-[#666666] dark:text-[#A1A1A1] mt-1">
            Governança de controle de acesso baseado em funções (RBAC).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchAdmins}
            loading={loading}
            icon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Atualizar
          </Button>
          {isOwner && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setAddModalOpen(true)}
              icon={<UserPlus className="w-3.5 h-3.5" />}
            >
              Novo Administrador
            </Button>
          )}
        </div>
      </div>

      {/* Role Notice Banner */}
      {!isOwner && (
        <div className="p-3.5 bg-neutral-50 dark:bg-[#161616]/60 border border-[#E8E8E8] dark:border-[#252525] rounded-xl flex items-center gap-2.5 text-xs text-[#666666] dark:text-[#A1A1A1]">
          <Shield className="w-4 h-4 text-[#888888] dark:text-[#707070] shrink-0" />
          <span>
            Sessão autenticada como <span className="font-mono text-[#111111] dark:text-white font-semibold">{currentRole || 'ADMIN'}</span>.
            Mutações de equipe e elevações de privilégio exigem permissão <span className="text-[#111111] dark:text-white font-semibold">OWNER</span>.
          </span>
        </div>
      )}

      {/* Error alert */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/60 rounded-xl flex items-center justify-between">
          <span className="text-xs text-red-600 dark:text-red-400">{error}</span>
          <Button variant="outline" size="sm" onClick={fetchAdmins}>
            Tentar Novamente
          </Button>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <TableSkeleton rows={4} columns={5} />
      ) : admins.length === 0 ? (
        <EmptyState
          icon={<Users className="w-6 h-6 text-[#888888] dark:text-[#707070]" />}
          title="Nenhum administrador encontrado"
          description="Provisione membros da equipe para gerenciar licenças e acompanhar eventos de segurança."
          actionLabel={isOwner ? 'Novo Administrador' : undefined}
          onAction={() => setAddModalOpen(true)}
        />
      ) : (
        <div className="border border-[#E8E8E8] dark:border-[#252525] rounded-xl overflow-hidden bg-white dark:bg-[#111111] shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#E8E8E8] dark:border-[#252525] bg-neutral-50/70 dark:bg-[#161616]/40 text-[#666666] dark:text-[#A1A1A1]">
                  <th className="py-3 px-4 font-medium">E-mail do Administrador</th>
                  <th className="py-3 px-4 font-medium">Cargo (RBAC)</th>
                  <th className="py-3 px-4 font-medium">Status da Conta</th>
                  <th className="py-3 px-4 font-medium">Firebase UID</th>
                  <th className="py-3 px-4 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E8E8] dark:divide-[#1C1C1C]">
                {admins.map((admin) => {
                  const isCurrentSession = admin.uid === user?.uid || admin.email === user?.email;
                  return (
                    <tr key={admin.uid} className="hover:bg-neutral-50 dark:hover:bg-[#161616]/40">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-[#111111] dark:text-white flex items-center gap-2">
                          <span>{admin.email}</span>
                          {isCurrentSession && (
                            <span className="text-[10px] font-mono border border-[#E8E8E8] dark:border-[#252525] px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-[#161616] text-[#666666] dark:text-[#A1A1A1]">
                              Você
                            </span>
                          )}
                        </div>
                        {admin.createdAt && (
                          <div className="text-[10px] text-[#888888] dark:text-[#707070] font-mono mt-0.5">
                            Criado: {new Date(admin.createdAt).toLocaleDateString()}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-neutral-100 dark:bg-[#161616] border border-[#E8E8E8] dark:border-[#252525] text-[#111111] dark:text-neutral-200">
                          {admin.role}
                        </span>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 text-xs font-mono">
                          {admin.status === 'active' ? (
                            <>
                              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                              <span className="text-emerald-700 dark:text-emerald-400 font-medium">Ativo</span>
                            </>
                          ) : (
                            <>
                              <ShieldAlert className="w-3.5 h-3.5 text-neutral-400" />
                              <span className="text-[#888888] dark:text-[#707070]">Desativado</span>
                            </>
                          )}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-[#666666] dark:text-neutral-400 text-[11px] select-all truncate max-w-[140px]">
                        {admin.uid}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        {isOwner ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              variant="outline"
                              size="xs"
                              onClick={() => {
                                setEditAdmin(admin);
                                setEditRole(admin.role);
                              }}
                              disabled={admin.role === 'OWNER'}
                            >
                              Editar Cargo
                            </Button>
                            {!isCurrentSession && (
                              <Button
                                variant="outline"
                                size="xs"
                                className="text-[#666666] dark:text-[#A1A1A1]"
                                onClick={() => handleToggleStatus(admin)}
                              >
                                {admin.status === 'active' ? 'Desativar' : 'Reativar'}
                              </Button>
                            )}
                          </div>
                        ) : (
                          <span className="text-[11px] text-[#888888] dark:text-[#707070] font-mono">Apenas Leitura</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Admin Modal */}
      <Modal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        title="Novo Administrador"
        description="Provisione credenciais de equipe para acesso ao painel do Worker."
      >
        <form onSubmit={handleCreateAdmin} className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-[#111111] dark:text-neutral-200 flex items-center gap-1.5">
                <Fingerprint className="w-3.5 h-3.5 text-[#888888] dark:text-[#707070]" />
                <span>UID do Firebase Auth (Opcional)</span>
              </label>
              <button
                type="button"
                onClick={() =>
                  setNewUid(`adm_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`)
                }
                className="text-[11px] text-[#0066CC] dark:text-[#58A6FF] hover:underline font-mono flex items-center gap-1"
              >
                <Sparkles className="w-3 h-3" />
                <span>Gerar UID</span>
              </button>
            </div>
            <Input
              placeholder="Ex: uX7kP9... (ou deixe vazio para gerar/criar com senha)"
              value={newUid}
              onChange={(e) => setNewUid(e.target.value)}
              helperText="Identificador exigido pelo Worker. Se o usuário já possuir conta no Firebase, cole o UID aqui."
            />
          </div>

          <Input
            label="Endereço de E-mail"
            type="email"
            placeholder="colaborador@dominio.com"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            required
            leftIcon={<Mail className="w-4 h-4" />}
          />

          <Select
            label="Cargo Administrativo"
            value={newRole}
            onChange={(e) => setNewRole(e.target.value as AdminRole)}
            options={[
              { label: 'ADMIN — Gestão completa de chaves e dispositivos', value: 'ADMIN' },
              { label: 'SUPPORT — Visualização de auditoria e leitura', value: 'SUPPORT' },
            ]}
            helperText="O Worker exige cargo ADMIN ou SUPPORT. Permissões OWNER são reservadas à conta proprietária."
          />

          <Input
            label="Senha Provisória (Opcional se já tiver UID)"
            type="password"
            placeholder="Mínimo 6 caracteres para registro no Firebase"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            helperText="Se preenchida e o UID estiver em branco, o usuário será criado no Firebase Auth automaticamente."
            leftIcon={<Key className="w-4 h-4" />}
          />

          <div className="flex justify-end gap-2 pt-2 border-t border-[#E8E8E8] dark:border-[#252525]">
            <Button
              variant="ghost"
              size="sm"
              type="button"
              onClick={() => setAddModalOpen(false)}
              disabled={actionLoading}
            >
              Cancelar
            </Button>
            <Button variant="primary" size="sm" type="submit" loading={actionLoading}>
              Provisionar Administrador
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Role Modal */}
      {editAdmin && (
        <Modal
          isOpen={Boolean(editAdmin)}
          onClose={() => setEditAdmin(null)}
          title="Atualizar Cargo"
          description={`Modificando permissões para ${editAdmin.email}`}
        >
          <form onSubmit={handleUpdateRole} className="space-y-4">
            <Select
              label="Cargo Atribuído"
              value={editRole}
              onChange={(e) => setEditRole(e.target.value as AdminRole)}
              options={[
                { label: 'ADMIN — Pode emitir chaves, renovar e desvincular hardware', value: 'ADMIN' },
                { label: 'SUPPORT — Acesso restrito para auditoria e suporte', value: 'SUPPORT' },
              ]}
            />

            <div className="flex justify-end gap-2 pt-2 border-t border-[#E8E8E8] dark:border-[#252525]">
              <Button
                variant="ghost"
                size="sm"
                type="button"
                onClick={() => setEditAdmin(null)}
                disabled={actionLoading}
              >
                Cancelar
              </Button>
              <Button variant="primary" size="sm" type="submit" loading={actionLoading}>
                Salvar Cargo
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Confirm Status Modal */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmLabel={confirmDialog.confirmLabel}
        loading={actionLoading}
        isDestructive={true}
      />
    </div>
  );
};
