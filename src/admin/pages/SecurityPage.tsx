/**
 * ============================================================================
 * SECURITY PAGE - Admin 2FA Configuration
 * ============================================================================
 * 
 * Página de configuración de seguridad para administradores.
 * Permite gestionar Two-Factor Authentication (TOTP).
 */

import { useState, useEffect } from 'react';
import { 
  Shield, 
  ShieldCheck, 
  ShieldAlert, 
  QrCode, 
  KeyRound,
  Copy,
  Check,
  AlertTriangle,
  Trash2,
  Download
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast/useToast';

interface TwoFAStatus {
  enabled: boolean;
  verifiedAt: string | null;
}

interface SetupData {
  secret: string;
  qrUrl: string;
  backupCodes: string[];
}

export default function SecurityPage() {
  const [status, setStatus] = useState<TwoFAStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [setupData, setSetupData] = useState<SetupData | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [setupStep, setSetupStep] = useState<'intro' | 'qr' | 'backup' | 'verify'>('intro');
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [copiedCodes, setCopiedCodes] = useState(false);
  const [disabling, setDisabling] = useState(false);
  const [disableCode, setDisableCode] = useState('');
  
  const { success: showSuccess, error: showError } = useToast();

  const token = localStorage.getItem('safespot_admin_token');

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/auth/2fa/status`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (res.ok) {
        const data = await res.json();
        setStatus(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch 2FA status:', err);
    } finally {
      setLoading(false);
    }
  };

  const startSetup = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/auth/2fa/setup`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (res.ok) {
        const data = await res.json();
        setSetupData(data.data);
        setSetupStep('qr');
      } else {
        showError('Error al iniciar configuración 2FA');
      }
    } catch (err) {
      showError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const verifyAndEnable = async () => {
    if (!verificationCode || verificationCode.length < 6) {
      showError('Ingresa un código válido');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/auth/2fa/verify-setup`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ code: verificationCode.replace(/\s/g, '') })
      });

      if (res.ok) {
        showSuccess('2FA activado exitosamente');
        setSetupData(null);
        setSetupStep('intro');
        setVerificationCode('');
        fetchStatus();
      } else {
        const data = await res.json();
        showError(data.error || 'Código inválido');
      }
    } catch (err) {
      showError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const disable2FA = async () => {
    if (!disableCode) {
      showError('Ingresa un código para confirmar');
      return;
    }

    setDisabling(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/auth/2fa/disable`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ code: disableCode.replace(/\s/g, '') })
      });

      if (res.ok) {
        showSuccess('2FA desactivado');
        setDisableCode('');
        fetchStatus();
      } else {
        const data = await res.json();
        showError(data.error || 'Código inválido');
      }
    } catch (err) {
      showError('Error de conexión');
    } finally {
      setDisabling(false);
    }
  };

  const copyToClipboard = (text: string, type: 'secret' | 'codes') => {
    navigator.clipboard.writeText(text);
    if (type === 'secret') {
      setCopiedSecret(true);
      setTimeout(() => setCopiedSecret(false), 2000);
    } else {
      setCopiedCodes(true);
      setTimeout(() => setCopiedCodes(false), 2000);
    }
  };

  const downloadBackupCodes = () => {
    if (!setupData?.backupCodes) return;
    
    const content = `SafeSpot Admin - Códigos de Respaldo 2FA
Generado: ${new Date().toLocaleString()}

${setupData.backupCodes.join('\n')}

IMPORTANTE: Guarda estos códigos en un lugar seguro. 
Cada código solo puede usarse una vez.
`;
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `safespot-2fa-backup-codes-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading && !status) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  // Setup Flow
  if (setupStep === 'qr' && setupData) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center space-x-3">
          <QrCode className="w-6 h-6 text-emerald-400" />
          <h1 className="text-2xl font-bold text-white">Configurar 2FA</h1>
        </div>

        <div className="bg-gray-800/50 rounded-lg p-6 space-y-6">
          {/* Instructions */}
          <div className="text-gray-300 space-y-2">
            <p>1. Escanea el código QR con tu aplicación de autenticación:</p>
            <p className="text-sm text-gray-400">
              (Google Authenticator, Authy, Microsoft Authenticator, etc.)
            </p>
          </div>

          {/* QR Code */}
          <div className="flex justify-center">
            <div className="bg-white p-4 rounded-lg">
              <img src={setupData.qrUrl} alt="2FA QR Code" className="w-48 h-48" />
            </div>
          </div>

          {/* Manual Entry */}
          <div className="space-y-2">
            <p className="text-gray-300">2. O ingresa manualmente este código:</p>
            <div className="flex items-center space-x-2">
              <code className="flex-1 bg-gray-900 p-3 rounded text-emerald-400 font-mono text-center tracking-wider">
                {setupData.secret}
              </code>
              <Button
                variant="outline"
                size="icon"
                onClick={() => copyToClipboard(setupData.secret, 'secret')}
              >
                {copiedSecret ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex space-x-3">
            <Button
              variant="outline"
              onClick={() => setSetupStep('intro')}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => setSetupStep('backup')}
              className="bg-emerald-600 hover:bg-emerald-500"
            >
              Continuar
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (setupStep === 'backup' && setupData) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center space-x-3">
          <KeyRound className="w-6 h-6 text-emerald-400" />
          <h1 className="text-2xl font-bold text-white">Códigos de Respaldo</h1>
        </div>

        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 flex items-start space-x-3">
          <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-yellow-400 font-medium">¡Importante!</h3>
            <p className="text-gray-300 text-sm mt-1">
              Guarda estos códigos en un lugar seguro. Son la única forma de acceder 
              si pierdes tu dispositivo de autenticación. Cada código solo puede usarse una vez.
            </p>
          </div>
        </div>

        <div className="bg-gray-800/50 rounded-lg p-6 space-y-4">
          {/* Backup Codes */}
          <div className="grid grid-cols-2 gap-3">
            {setupData.backupCodes.map((code, idx) => (
              <code 
                key={idx} 
                className="bg-gray-900 p-3 rounded text-center font-mono text-emerald-400"
              >
                {code}
              </code>
            ))}
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={() => copyToClipboard(setupData.backupCodes.join('\n'), 'codes')}
            >
              {copiedCodes ? <Check className="w-4 h-4 mr-2 text-green-400" /> : <Copy className="w-4 h-4 mr-2" />}
              Copiar
            </Button>
            <Button
              variant="outline"
              onClick={downloadBackupCodes}
            >
              <Download className="w-4 h-4 mr-2" />
              Descargar
            </Button>
            <Button
              onClick={() => setSetupStep('verify')}
              className="bg-emerald-600 hover:bg-emerald-500"
            >
              Continuar
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (setupStep === 'verify') {
    return (
      <div className="max-w-md mx-auto space-y-6">
        <div className="flex items-center space-x-3">
          <ShieldCheck className="w-6 h-6 text-emerald-400" />
          <h1 className="text-2xl font-bold text-white">Verificar 2FA</h1>
        </div>

        <div className="bg-gray-800/50 rounded-lg p-6 space-y-6">
          <p className="text-gray-300">
            Ingresa el código de 6 dígitos de tu aplicación de autenticación 
            para completar la configuración:
          </p>

          <Input
            type="text"
            placeholder="000000"
            value={verificationCode}
            onChange={(e) => setVerificationCode(e.target.value)}
            maxLength={6}
            className="text-center text-2xl tracking-widest bg-gray-900 border-gray-700"
          />

          <div className="flex space-x-3">
            <Button
              variant="outline"
              onClick={() => setSetupStep('intro')}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              onClick={verifyAndEnable}
              disabled={loading || verificationCode.length < 6}
              className="bg-emerald-600 hover:bg-emerald-500 flex-1"
            >
              {loading ? 'Activando...' : 'Activar 2FA'}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Main View
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Shield className="w-6 h-6 text-emerald-400" />
          <h1 className="text-2xl font-bold text-white">Seguridad</h1>
        </div>
      </div>

      {/* 2FA Status Card */}
      <div className="bg-gray-800/50 rounded-lg p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-4">
            <div className={`p-3 rounded-lg ${status?.enabled ? 'bg-emerald-500/20' : 'bg-gray-700'}`}>
              {status?.enabled ? (
                <ShieldCheck className="w-6 h-6 text-emerald-400" />
              ) : (
                <ShieldAlert className="w-6 h-6 text-gray-400" />
              )}
            </div>
            <div>
              <h2 className="text-lg font-medium text-white">
                Autenticación de Dos Factores (2FA)
              </h2>
              <p className="text-gray-400 text-sm mt-1">
                {status?.enabled 
                  ? '2FA está activado. Se requiere un código adicional al iniciar sesión.'
                  : 'Agrega una capa extra de seguridad a tu cuenta.'
                }
              </p>
              {status?.enabled && status.verifiedAt && (
                <p className="text-xs text-gray-500 mt-2">
                  Activado el {new Date(status.verifiedAt).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>
          
          {!status?.enabled ? (
            <Button
              onClick={startSetup}
              disabled={loading}
              className="bg-emerald-600 hover:bg-emerald-500"
            >
              <Shield className="w-4 h-4 mr-2" />
              Activar 2FA
            </Button>
          ) : (
            <div className="flex flex-col items-end space-y-2">
              <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-full text-sm">
                Activo
              </span>
            </div>
          )}
        </div>

        {/* Disable Section */}
        {status?.enabled && (
          <div className="mt-6 pt-6 border-t border-gray-700">
            <h3 className="text-red-400 font-medium flex items-center">
              <Trash2 className="w-4 h-4 mr-2" />
              Desactivar 2FA
            </h3>
            <p className="text-gray-400 text-sm mt-2">
              Esto reduce la seguridad de tu cuenta. Requiere un código de verificación.
            </p>
            <div className="flex items-center space-x-3 mt-3">
              <Input
                type="text"
                placeholder="Código 2FA"
                value={disableCode}
                onChange={(e) => setDisableCode(e.target.value)}
                className="w-48 bg-gray-900 border-gray-700"
              />
              <Button
                variant="destructive"
                onClick={disable2FA}
                disabled={disabling || !disableCode}
              >
                {disabling ? 'Desactivando...' : 'Desactivar'}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Security Tips */}
      <div className="bg-gray-800/30 rounded-lg p-6">
        <h3 className="text-white font-medium mb-4">Recomendaciones de Seguridad</h3>
        <ul className="space-y-3 text-gray-400 text-sm">
          <li className="flex items-start space-x-2">
            <Check className="w-4 h-4 text-emerald-400 mt-0.5" />
            <span>Usa una contraseña fuerte y única para tu cuenta de admin</span>
          </li>
          <li className="flex items-start space-x-2">
            <Check className="w-4 h-4 text-emerald-400 mt-0.5" />
            <span>Activa 2FA para proteger contra accesos no autorizados</span>
          </li>
          <li className="flex items-start space-x-2">
            <Check className="w-4 h-4 text-emerald-400 mt-0.5" />
            <span>Guarda los códigos de respaldo en un lugar seguro (fuera de línea)</span>
          </li>
          <li className="flex items-start space-x-2">
            <Check className="w-4 h-4 text-emerald-400 mt-0.5" />
            <span>Cierra sesión cuando termines de usar el panel de admin</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
