/**
 * MFA API Service
 * 
 * Handles Multi-Factor Authentication operations:
 * - Setup MFA (generate secret, QR code)
 * - Verify MFA tokens
 * - Disable MFA
 * - Regenerate backup codes
 */

import axios, { AxiosResponse } from 'axios';

// Get API URL from environment or fallback
const getApiUrl = (): string => {
  if (typeof window !== 'undefined') {
    return (window as any).__RUNTIME_CONFIG__?.VITE_API_URL || 
           'http://localhost:5000/api';
  }
  return 'http://localhost:5000/api';
};

const API_BASE_URL = getApiUrl();

// Types
interface MFASetupResponse {
  success: boolean;
  secret: string;
  qr_code: string;
  backup_codes: string[];
  message: string;
}

interface MFAVerifyResponse {
  success: boolean;
  method?: string;
  message: string;
}

interface MFAStatusResponse {
  success: boolean;
  mfa_enabled: boolean;
  backup_codes_count: number;
}

interface BackupCodesResponse {
  success: boolean;
  backup_codes: string[];
  message: string;
}

class MFAApiService {
  private getAuthHeaders() {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Start MFA setup process
   * Generates secret, QR code, and backup codes
   */
  async setupMFA(): Promise<MFASetupResponse> {
    try {
      const response: AxiosResponse<MFASetupResponse> = await axios.post(
        `${API_BASE_URL}/mfa/setup`,
        {},
        { headers: this.getAuthHeaders() }
      );
      
      return response.data;
    } catch (error: any) {
      throw new Error(
        error.response?.data?.error || 'Failed to setup MFA'
      );
    }
  }

  /**
   * Complete MFA setup by verifying TOTP token
   */
  async verifySetup(
    secret: string, 
    token: string, 
    backupCodes: string[]
  ): Promise<MFAVerifyResponse> {
    try {
      const response: AxiosResponse<MFAVerifyResponse> = await axios.post(
        `${API_BASE_URL}/mfa/verify-setup`,
        {
          secret,
          token,
          backup_codes: backupCodes
        },
        { headers: this.getAuthHeaders() }
      );
      
      return response.data;
    } catch (error: any) {
      throw new Error(
        error.response?.data?.error || 'Failed to verify MFA setup'
      );
    }
  }

  /**
   * Verify MFA token (for login or operations)
   */
  async verifyMFA(token: string): Promise<MFAVerifyResponse> {
    try {
      const response: AxiosResponse<MFAVerifyResponse> = await axios.post(
        `${API_BASE_URL}/mfa/verify`,
        { token },
        { headers: this.getAuthHeaders() }
      );
      
      return response.data;
    } catch (error: any) {
      throw new Error(
        error.response?.data?.error || 'Failed to verify MFA token'
      );
    }
  }

  /**
   * Disable MFA for the user
   */
  async disableMFA(token: string, password: string): Promise<MFAVerifyResponse> {
    try {
      const response: AxiosResponse<MFAVerifyResponse> = await axios.post(
        `${API_BASE_URL}/mfa/disable`,
        { token, password },
        { headers: this.getAuthHeaders() }
      );
      
      return response.data;
    } catch (error: any) {
      throw new Error(
        error.response?.data?.error || 'Failed to disable MFA'
      );
    }
  }

  /**
   * Get user's MFA status
   */
  async getMFAStatus(): Promise<MFAStatusResponse> {
    try {
      const response: AxiosResponse<MFAStatusResponse> = await axios.get(
        `${API_BASE_URL}/mfa/status`,
        { headers: this.getAuthHeaders() }
      );
      
      return response.data;
    } catch (error: any) {
      throw new Error(
        error.response?.data?.error || 'Failed to get MFA status'
      );
    }
  }

  /**
   * Regenerate backup codes
   */
  async regenerateBackupCodes(token: string): Promise<BackupCodesResponse> {
    try {
      const response: AxiosResponse<BackupCodesResponse> = await axios.post(
        `${API_BASE_URL}/mfa/backup-codes/regenerate`,
        { token },
        { headers: this.getAuthHeaders() }
      );
      
      return response.data;
    } catch (error: any) {
      throw new Error(
        error.response?.data?.error || 'Failed to regenerate backup codes'
      );
    }
  }

  /**
   * Login with MFA support
   */
  async loginWithMFA(
    email: string, 
    password: string, 
    mfaToken?: string
  ): Promise<any> {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/auth/login`,
        {
          email,
          password,
          mfa_token: mfaToken
        }
      );
      
      return response.data;
    } catch (error: any) {
      throw new Error(
        error.response?.data?.error || 'Login failed'
      );
    }
  }

  /**
   * Download backup codes as text file
   */
  downloadBackupCodes(codes: string[], userEmail: string): void {
    const content = `BLOCKTRUST - CÓDIGOS DE BACKUP MFA
=====================================
⚠️ IMPORTANTE: Guarde estes códigos em local seguro!
Cada código só pode ser usado UMA VEZ.

Usuário: ${userEmail}
Data de geração: ${new Date().toLocaleString('pt-BR')}
Rede: Polygon Amoy Testnet

CÓDIGOS:
${codes.map((code, i) => `${(i + 1).toString().padStart(2, '0')}. ${code}`).join('\n')}

=====================================
INSTRUÇÕES:
- Use estes códigos se perder acesso ao seu autenticador
- Cada código funciona apenas uma vez
- Guarde em local seguro (cofre, gerenciador de senhas)
- NÃO compartilhe com ninguém
=====================================`;

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `blocktrust-mfa-backup-${Date.now()}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Copy backup codes to clipboard
   */
  async copyBackupCodes(codes: string[]): Promise<void> {
    const codesText = codes.join('\n');
    
    try {
      await navigator.clipboard.writeText(codesText);
    } catch (error) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = codesText;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
  }

  /**
   * Format secret for manual entry (groups of 4 characters)
   */
  formatSecret(secret: string): string {
    return secret.match(/.{1,4}/g)?.join(' ') || secret;
  }
}

// Export singleton instance
export const mfaApi = new MFAApiService();
export default mfaApi;
