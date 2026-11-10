import React, { useState } from 'react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Input, Select, Textarea } from './ui/Input';
import { api, ApiError } from '../lib/api';
import { enterpriseStore } from '../lib/enterpriseStore';
import { useToast } from './ui/Toast';
import type { CreateLicensePayload, LicenseKey } from '../types';
import { Copy, Check, ShieldAlert } from 'lucide-react';

interface CreateLicenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (license: LicenseKey, rawKey?: string) => void;
  defaultAppId?: string;
}

export const CreateLicenseModal: React.FC<CreateLicenseModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  defaultAppId = 'azod',
}) => {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form fields
  const [clientName, setClientName] = useState('');
  const [orderReference, setOrderReference] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedAppId, setSelectedAppId] = useState(defaultAppId);
  const [durationPreset, setDurationPreset] = useState<'1d' | '7d' | '15d' | '30d' | 'lifetime' | 'custom'>('30d');
  const [customDurationValue, setCustomDurationValue] = useState<number>(30);
  const [customDurationUnit, setCustomDurationUnit] = useState<'seconds' | 'minutes' | 'hours' | 'days'>('days');
  const [deviceLimitPreset, setDeviceLimitPreset] = useState<'1' | '2' | '3' | 'unlimited' | 'custom'>('1');
  const [customDeviceLimit, setCustomDeviceLimit] = useState<number>(5);
  const [activationMode, setActivationMode] = useState<'immediate' | 'first_use'>('first_use');

  // Generated Key Result Dialog state
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const resetForm = () => {
    setClientName('');
    setOrderReference('');
    setNotes('');
    setSelectedAppId('proxy-menu');
    setDurationPreset('30d');
    setCustomDurationValue(30);
    setCustomDurationUnit('days');
    setDeviceLimitPreset('1');
    setCustomDeviceLimit(5);
    setActivationMode('first_use');
    setError(null);
    setGeneratedKey(null);
    setCopied(false);
  };

  const handleModalClose = () => {
    resetForm();
    onClose();
  };

  const getComputedDuration = (): { duration: number; durationUnit: 'seconds' | 'minutes' | 'hours' | 'days' | 'lifetime' } => {
    switch (durationPreset) {
      case '1d':
        return { duration: 1, durationUnit: 'days' };
      case '7d':
        return { duration: 7, durationUnit: 'days' };
      case '15d':
        return { duration: 15, durationUnit: 'days' };
      case '30d':
        return { duration: 30, durationUnit: 'days' };
      case 'lifetime':
        return { duration: -1, durationUnit: 'lifetime' };
      case 'custom':
        return { duration: Number(customDurationValue) || 1, durationUnit: customDurationUnit };
    }
  };

  const getComputedDeviceLimit = (): number => {
    switch (deviceLimitPreset) {
      case '1':
        return 1;
      case '2':
        return 2;
      case '3':
        return 3;
      case 'unlimited':
        return -1;
      case 'custom':
        return Number(customDeviceLimit) || 1;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim()) {
      setError('O nome do cliente é obrigatório.');
      return;
    }

    setLoading(true);
    setError(null);

    const { duration, durationUnit } = getComputedDuration();
    const deviceLimit = getComputedDeviceLimit();

    const payload: CreateLicensePayload = {
      clientName: clientName.trim(),
      orderReference: orderReference.trim() || undefined,
      notes: notes.trim() || undefined,
      duration,
      durationUnit,
      deviceLimit,
      activationMode,
      appId: selectedAppId,
      isLifetime: duration === -1 || durationUnit === 'lifetime',
    };

    try {
      const response = await api.createKey(payload);

      let keyString = '';
      let createdLicense: LicenseKey;

      if (response && typeof response === 'object') {
        if ('key' in response && typeof (response as any).key === 'string') {
          keyString = (response as any).key;
        }
        if ('license' in response && typeof (response as any).license === 'object') {
          createdLicense = (response as any).license;
        } else {
          createdLicense = response as LicenseKey;
        }
      } else {
        throw new Error('Formato inesperado retornado pelo servidor');
      }

      toast.success('Chave de licença emitida com sucesso');

      if (keyString) {
        setGeneratedKey(keyString);
      } else {
        onSuccess(createdLicense, undefined);
        handleModalClose();
      }
    } catch (err: unknown) {
      console.error('License creation error:', err);
      if (err instanceof ApiError) {
        setError(err.message || 'Worker API rejeitou a criação da licença.');
      } else {
        setError('Falha ao alcançar a API Cloudflare Worker para emitir a chave.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCopyKey = () => {
    if (generatedKey) {
      navigator.clipboard.writeText(generatedKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
      toast.info('Chave copiada para a área de transferência');
    }
  };

  const handleFinishWithKey = () => {
    if (generatedKey) {
      onSuccess({
        id: generatedKey,
        clientName,
        status: 'pending',
        duration: 30,
        deviceLimit: 1,
        activationMode: 'first_use',
        createdAt: new Date().toISOString(),
      });
    }
    handleModalClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleModalClose}
      title={generatedKey ? 'Chave de Licença Gerada' : 'Emitir Nova Chave de Licença'}
      description={
        generatedKey
          ? 'Atenção: Por razões de segurança, a chave em texto plano não será exibida novamente.'
          : 'Gere uma chave assinada criptograficamente via Cloudflare Worker v4.0.'
      }
      maxWidth="lg"
    >
      {generatedKey ? (
        <div className="space-y-5">
          <div className="p-4 bg-neutral-50 dark:bg-[#161616] border border-[#E8E8E8] dark:border-[#252525] rounded-xl space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#111111] dark:text-white">
              <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0" />
              <span>Exibição Única da Chave</span>
            </div>
            <p className="text-xs text-[#666666] dark:text-[#A1A1A1] leading-relaxed">
              Copie esta chave agora e entregue-a com segurança ao seu cliente. O servidor armazena apenas hashes criptográficos ou identificadores mascarados.
            </p>

            <div className="flex items-center gap-2 p-3 bg-white dark:bg-[#050505] border border-[#E8E8E8] dark:border-[#252525] rounded-lg">
              <code className="flex-1 font-mono text-sm text-[#111111] dark:text-white select-all break-all tracking-wider font-semibold">
                {generatedKey}
              </code>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyKey}
                icon={copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              >
                {copied ? 'Copiado' : 'Copiar'}
              </Button>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button variant="primary" size="sm" onClick={handleFinishWithKey}>
              Concluir & Ver Licença
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/60 rounded-lg text-xs text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-[#111111] dark:text-neutral-200">
              Produto Destino
            </label>
            <select
              value={selectedAppId}
              onChange={(e) => setSelectedAppId(e.target.value)}
              className="w-full text-xs bg-white dark:bg-[#111111] border border-[#E8E8E8] dark:border-[#252525] rounded-lg px-3 py-2 font-medium text-[#111111] dark:text-white"
            >
              {enterpriseStore.getApplications().map((app) => (
                <option key={app.id} value={app.id}>
                  {app.name} ({app.category} · v{app.version})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Nome do Cliente"
              placeholder="Empresa / Cliente VIP"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              required
            />
            <Input
              label="Referência do Pedido / Fatura"
              placeholder="PED-2026-904"
              value={orderReference}
              onChange={(e) => setOrderReference(e.target.value)}
            />
          </div>

          {/* Duration Options */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-[#111111] dark:text-neutral-200">
              Período de Validade
            </label>
            <div className="grid grid-cols-6 gap-1 p-1 bg-neutral-100 dark:bg-[#161616] rounded-lg border border-[#E8E8E8] dark:border-[#252525]">
              {(['1d', '7d', '15d', '30d', 'lifetime', 'custom'] as const).map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setDurationPreset(preset)}
                  className={`py-1.5 text-xs font-mono font-medium rounded transition-colors ${
                    durationPreset === preset
                      ? 'bg-white dark:bg-[#252525] text-[#111111] dark:text-white shadow-2xs font-semibold'
                      : 'text-[#666666] dark:text-[#A1A1A1] hover:text-[#111111] dark:hover:text-white'
                  }`}
                >
                  {preset === '1d' && '1 Dia'}
                  {preset === '7d' && '7 Dias'}
                  {preset === '15d' && '15 Dias'}
                  {preset === '30d' && '30 Dias'}
                  {preset === 'lifetime' && 'Vitalícia'}
                  {preset === 'custom' && 'Outro'}
                </button>
              ))}
            </div>

            {durationPreset === 'custom' && (
              <div className="grid grid-cols-2 gap-3 pt-1">
                <Input
                  type="number"
                  min="1"
                  label="Valor da Duração"
                  value={customDurationValue}
                  onChange={(e) => setCustomDurationValue(Math.max(1, parseInt(e.target.value) || 1))}
                  required
                />
                <Select
                  label="Unidade"
                  value={customDurationUnit}
                  onChange={(e) =>
                    setCustomDurationUnit(e.target.value as 'seconds' | 'minutes' | 'hours' | 'days')
                  }
                  options={[
                    { label: 'Dias', value: 'days' },
                    { label: 'Horas', value: 'hours' },
                    { label: 'Minutos', value: 'minutes' },
                    { label: 'Segundos', value: 'seconds' },
                  ]}
                />
              </div>
            )}
          </div>

          {/* Device Limit */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-[#111111] dark:text-neutral-200">
              Limite de Hardware Conectado
            </label>
            <div className="grid grid-cols-5 gap-1.5 p-1 bg-neutral-100 dark:bg-[#161616] rounded-lg border border-[#E8E8E8] dark:border-[#252525]">
              {(['1', '2', '3', 'unlimited', 'custom'] as const).map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setDeviceLimitPreset(preset)}
                  className={`py-1.5 text-xs font-mono font-medium rounded transition-colors ${
                    deviceLimitPreset === preset
                      ? 'bg-white dark:bg-[#252525] text-[#111111] dark:text-white shadow-2xs font-semibold'
                      : 'text-[#666666] dark:text-[#A1A1A1] hover:text-[#111111] dark:hover:text-white'
                  }`}
                >
                  {preset === 'unlimited' ? 'Ilimitado' : preset === 'custom' ? 'Outro' : `${preset} Disp`}
                </button>
              ))}
            </div>

            {deviceLimitPreset === 'custom' && (
              <div className="pt-1">
                <Input
                  type="number"
                  min="1"
                  label="Quantidade Máxima de Dispositivos"
                  value={customDeviceLimit}
                  onChange={(e) => setCustomDeviceLimit(Math.max(1, parseInt(e.target.value) || 1))}
                  required
                />
              </div>
            )}
          </div>

          {/* Activation Mode */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-[#111111] dark:text-neutral-200">
              Início da Contagem
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label
                className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-colors ${
                  activationMode === 'first_use'
                    ? 'border-black dark:border-white bg-neutral-50 dark:bg-[#161616] text-[#111111] dark:text-white'
                    : 'border-[#E8E8E8] dark:border-[#252525] bg-white dark:bg-[#090909] text-[#666666] dark:text-[#A1A1A1]'
                }`}
              >
                <input
                  type="radio"
                  name="activationMode"
                  value="first_use"
                  checked={activationMode === 'first_use'}
                  onChange={() => setActivationMode('first_use')}
                  className="mt-0.5 accent-black dark:accent-white"
                />
                <div>
                  <div className="text-xs font-semibold text-[#111111] dark:text-white">No Primeiro Uso</div>
                  <div className="text-[11px] text-[#666666] dark:text-[#A1A1A1] mt-0.5">
                    O tempo de validade só inicia quando o cliente fizer o primeiro handshake.
                  </div>
                </div>
              </label>

              <label
                className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-colors ${
                  activationMode === 'immediate'
                    ? 'border-black dark:border-white bg-neutral-50 dark:bg-[#161616] text-[#111111] dark:text-white'
                    : 'border-[#E8E8E8] dark:border-[#252525] bg-white dark:bg-[#090909] text-[#666666] dark:text-[#A1A1A1]'
                }`}
              >
                <input
                  type="radio"
                  name="activationMode"
                  value="immediate"
                  checked={activationMode === 'immediate'}
                  onChange={() => setActivationMode('immediate')}
                  className="mt-0.5 accent-black dark:accent-white"
                />
                <div>
                  <div className="text-xs font-semibold text-[#111111] dark:text-white">Ativação Imediata</div>
                  <div className="text-[11px] text-[#666666] dark:text-[#A1A1A1] mt-0.5">
                    O relógio de validade inicia no exato momento da emissão.
                  </div>
                </div>
              </label>
            </div>
          </div>

          <Textarea
            label="Notas Administrativas (Opcional)"
            placeholder="Informações adicionais de contato, suporte ou condições contratuais..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
          />

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E8E8E8] dark:border-[#252525]">
            <Button variant="ghost" size="sm" type="button" onClick={handleModalClose} disabled={loading}>
              Cancelar
            </Button>
            <Button variant="primary" size="sm" type="submit" loading={loading}>
              Gerar & Emitir Chave
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
};
