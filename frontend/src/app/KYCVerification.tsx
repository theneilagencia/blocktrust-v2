import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/Button';
import api from '../lib/api';

declare global {
  interface Window {
    snsWebSdk: any;
  }
}

interface KYCStatus {
  status: string;
  reviewStatus?: string;
  reviewAnswer?: string;
  rejectLabels?: string[];
  moderationComment?: string;
  mock_mode?: boolean;
}

export function KYCVerification() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [kycStatus, setKycStatus] = useState<KYCStatus | null>(null);
  const [error, setError] = useState('');
  const [sdkLoaded, setSdkLoaded] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  useEffect(() => {
    // Carrega SDK do Sumsub
    const script = document.createElement('script');
    script.src = 'https://static.sumsub.com/idensic/static/sns-websdk-builder.js';
    script.async = true;
    script.onload = () => setSdkLoaded(true);
    script.onerror = () => setError('Erro ao carregar SDK de verificação');
    document.body.appendChild(script);

    // Busca status atual do KYC
    fetchKYCStatus();

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const fetchKYCStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }

      const response = await api.get('/kyc/status');

      setKycStatus(response.data);
    } catch (err: any) {
      console.error('Erro ao buscar status do KYC:', err);
    }
  };

  const startKYC = async () => {
    try {
      setLoading(true);
      setError('');

      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }

      // Inicializa KYC e obtém access token
      const response = await api.post('/kyc/init', {});

      const { accessToken, applicantId, mock_mode } = response.data;

      // Verificar se a API retornou erro
      if (!accessToken || !applicantId) {
        throw new Error('Falha ao inicializar verificação. Dados inválidos retornados.');
      }

      // Verificar se modo mock está ativo (não deveria estar em produção)
      if (mock_mode) {
        setError('⚠️ Sistema em modo de teste. Entre em contato com o suporte.');
        setLoading(false);
        return;
      }

      // Inicializa SDK do Sumsub
      if (window.snsWebSdk && sdkLoaded) {
        const snsWebSdkInstance = window.snsWebSdk
          .init(accessToken, () => accessToken)
          .withConf({
            lang: 'pt-BR',
            email: localStorage.getItem('userEmail') || '',
            phone: '',
            i18n: {
              document: {
                subTitles: {
                  IDENTITY: 'Documento de Identidade',
                  SELFIE: 'Selfie com Liveness Check'
                }
              }
            },
            uiConf: {
              customCss: `
                .step-title { color: #1e40af; }
                .button { background-color: #3b82f6; }
              `
            }
          })
          .withOptions({ addViewportTag: false, adaptIframeHeight: true })
          .on('idCheck.stepCompleted', (payload: any) => {
            console.log('Step completed:', payload);
            setUploadProgress(prev => Math.min(prev + 25, 100));
          })
          .on('idCheck.onError', (error: any) => {
            console.error('Verification error:', error);
            setError('Erro durante a verificação. Por favor, tente novamente.');
          })
          .on('idCheck.applicantStatus', (payload: any) => {
            console.log('Applicant status:', payload);
            fetchKYCStatus();
          })
          .on('idCheck.onReady', () => {
            console.log('SDK ready');
          })
          .build();

        // Monta SDK no container
        snsWebSdkInstance.launch('#sumsub-websdk-container');
      } else {
        setError('SDK de verificação não está disponível');
      }

    } catch (err: any) {
      console.error('Erro ao iniciar KYC:', err);
      
      // Extrair mensagem de erro detalhada
      let errorMessage = 'Erro ao iniciar verificação';
      
      if (err.response?.data?.error) {
        errorMessage = err.response.data.error;
      } else if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      // Mensagens amigáveis para erros comuns
      if (errorMessage.includes('HMAC') || errorMessage.includes('signature')) {
        errorMessage = 'Erro de autenticação. Verifique suas credenciais.';
      } else if (errorMessage.includes('Unauthorized') || errorMessage.includes('401')) {
        errorMessage = 'Credenciais inválidas. Entre em contato com o suporte.';
      } else if (errorMessage.includes('levelName')) {
        errorMessage = 'Configuração de verificação inválida. Entre em contato com o suporte.';
      } else if (errorMessage.includes('network') || errorMessage.includes('timeout')) {
        errorMessage = 'Falha na conexão. Verifique sua internet e tente novamente.';
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { text: string; color: string }> = {
      not_started: { text: 'Não Iniciado', color: 'bg-gray-500' },
      pending: { text: 'Em Análise', color: 'bg-yellow-500' },
      approved: { text: 'Aprovado', color: 'bg-green-500' },
      rejected: { text: 'Rejeitado', color: 'bg-red-500' },
      on_hold: { text: 'Em Espera', color: 'bg-orange-500' }
    };

    const badge = badges[status] || badges.not_started;

    return (
      <span className={`px-3 py-1 rounded-full text-white text-sm ${badge.color}`}>
        {badge.text}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        <div className="bg-white rounded-lg shadow-xl p-8">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold text-gray-900">
              Verificação de Identidade (KYC)
            </h1>
            {kycStatus && getStatusBadge(kycStatus.status)}
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800">{error}</p>
            </div>
          )}

          {kycStatus?.status === 'approved' ? (
            <div className="text-center py-12">
              <div className="mb-6">
                <svg
                  className="w-24 h-24 mx-auto text-green-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Verificação Aprovada!
              </h2>
              <p className="text-gray-600 mb-6">
                Sua identidade foi verificada com sucesso. Você pode acessar todos os recursos da plataforma.
              </p>
              <Button onClick={() => navigate('/dashboard')}>
                Ir para o Dashboard
              </Button>
            </div>
          ) : kycStatus?.status === 'rejected' ? (
            <div className="text-center py-12">
              <div className="mb-6">
                <svg
                  className="w-24 h-24 mx-auto text-red-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Verificação Rejeitada
              </h2>
              <p className="text-gray-600 mb-4">
                Infelizmente, sua verificação não foi aprovada.
              </p>
              {kycStatus.moderationComment && (
                <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-700">
                    <strong>Motivo:</strong> {kycStatus.moderationComment}
                  </p>
                </div>
              )}
              <Button onClick={startKYC} disabled={loading}>
                Tentar Novamente
              </Button>
            </div>
          ) : kycStatus?.status === 'pending' ? (
            <div className="text-center py-12">
              <div className="mb-6">
                <svg
                  className="w-24 h-24 mx-auto text-yellow-500 animate-spin"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Verificação em Análise
              </h2>
              <p className="text-gray-600 mb-6">
                Seus documentos estão sendo analisados. Isso pode levar alguns minutos.
              </p>
              <Button onClick={fetchKYCStatus} variant="outline">
                Atualizar Status
              </Button>
            </div>
          ) : (
            <div>
              <div className="mb-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                  Por que precisamos verificar sua identidade?
                </h2>
                <ul className="space-y-3 text-gray-700">
                  <li className="flex items-start">
                    <svg className="w-6 h-6 text-blue-500 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Conformidade com regulamentações LGPD e KYC</span>
                  </li>
                  <li className="flex items-start">
                    <svg className="w-6 h-6 text-blue-500 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Prevenção de fraudes e lavagem de dinheiro</span>
                  </li>
                  <li className="flex items-start">
                    <svg className="w-6 h-6 text-blue-500 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Garantia de segurança para todos os usuários</span>
                  </li>
                  <li className="flex items-start">
                    <svg className="w-6 h-6 text-blue-500 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Verificação de liveness (prova de vida) para evitar deepfakes</span>
                  </li>
                </ul>
              </div>

              <div className="mb-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h3 className="font-semibold text-blue-900 mb-2">
                  O que você vai precisar:
                </h3>
                <ul className="space-y-1 text-blue-800 text-sm">
                  <li>• Documento de identidade com foto (RG, CNH ou Passaporte)</li>
                  <li>• Câmera do dispositivo para selfie e liveness check</li>
                  <li>• Aproximadamente 5 minutos</li>
                </ul>
              </div>

              {/* Container para o SDK do Sumsub */}
              <div id="sumsub-websdk-container" className="mb-6"></div>

              {loading && uploadProgress > 0 && (
                <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-blue-800 text-sm font-semibold">
                      Enviando documentos...
                    </p>
                    <span className="text-blue-600 text-sm">{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-blue-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    ></div>
                  </div>
                </div>
              )}

              <div className="flex gap-4">
                <Button
                  onClick={startKYC}
                  disabled={loading}
                  className="flex-1"
                >
                  {loading ? 'Iniciando...' : 'Iniciar Verificação'}
                </Button>
                <Button
                  onClick={() => navigate('/dashboard')}
                  variant="outline"
                  className="flex-1"
                >
                  Fazer Depois
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

