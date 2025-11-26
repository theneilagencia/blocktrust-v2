/**
 * useMFA Hook
 * 
 * React hook for managing Multi-Factor Authentication state and operations
 */

import { useState, useCallback } from 'react';
import { mfaApi } from '../services/mfa.service';
import toast from 'react-hot-toast';

interface MFAData {
  secret: string;
  qrCode: string;
  backupCodes: string[];
}

interface UseMFAReturn {
  // State
  isLoading: boolean;
  mfaData: MFAData | null;
  mfaStatus: {
    enabled: boolean;
    backupCodesCount: number;
  } | null;

  // Actions
  setupMFA: () => Promise<MFAData | null>;
  verifySetup: (token: string) => Promise<boolean>;
  verifyMFA: (token: string) => Promise<boolean>;
  disableMFA: (token: string, password: string) => Promise<boolean>;
  regenerateBackupCodes: (token: string) => Promise<string[] | null>;
  getMFAStatus: () => Promise<void>;
  downloadBackupCodes: (userEmail: string) => void;
  copyBackupCodes: () => Promise<void>;
}

export const useMFA = (): UseMFAReturn => {
  const [isLoading, setIsLoading] = useState(false);
  const [mfaData, setMfaData] = useState<MFAData | null>(null);
  const [mfaStatus, setMfaStatus] = useState<{
    enabled: boolean;
    backupCodesCount: number;
  } | null>(null);

  /**
   * Start MFA setup process
   */
  const setupMFA = useCallback(async (): Promise<MFAData | null> => {
    setIsLoading(true);
    try {
      const response = await mfaApi.setupMFA();
      
      if (response.success) {
        const data: MFAData = {
          secret: response.secret,
          qrCode: `data:image/png;base64,${response.qr_code}`,
          backupCodes: response.backup_codes
        };
        setMfaData(data);
        return data;
      } else {
        toast.error('Failed to setup MFA');
        return null;
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to setup MFA');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Verify setup and enable MFA
   */
  const verifySetup = useCallback(async (token: string): Promise<boolean> => {
    if (!mfaData) {
      toast.error('No MFA setup data found');
      return false;
    }

    setIsLoading(true);
    try {
      const response = await mfaApi.verifySetup(
        mfaData.secret,
        token,
        mfaData.backupCodes
      );
      
      if (response.success) {
        toast.success('MFA enabled successfully!');
        await getMFAStatus(); // Refresh status
        return true;
      } else {
        toast.error(response.message || 'Invalid verification code');
        return false;
      }
    } catch (error: any) {
      toast.error(error.message || 'Verification failed');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [mfaData]);

  /**
   * Verify MFA token
   */
  const verifyMFA = useCallback(async (token: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      const response = await mfaApi.verifyMFA(token);
      
      if (response.success) {
        toast.success(`MFA verified via ${response.method}`);
        return true;
      } else {
        toast.error('Invalid MFA token');
        return false;
      }
    } catch (error: any) {
      toast.error(error.message || 'MFA verification failed');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Disable MFA
   */
  const disableMFA = useCallback(async (
    token: string, 
    password: string
  ): Promise<boolean> => {
    setIsLoading(true);
    try {
      const response = await mfaApi.disableMFA(token, password);
      
      if (response.success) {
        toast.success('MFA disabled successfully');
        setMfaData(null);
        await getMFAStatus(); // Refresh status
        return true;
      } else {
        toast.error(response.message || 'Failed to disable MFA');
        return false;
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to disable MFA');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Regenerate backup codes
   */
  const regenerateBackupCodes = useCallback(async (
    token: string
  ): Promise<string[] | null> => {
    setIsLoading(true);
    try {
      const response = await mfaApi.regenerateBackupCodes(token);
      
      if (response.success) {
        toast.success('New backup codes generated');
        await getMFAStatus(); // Refresh status
        return response.backup_codes;
      } else {
        toast.error('Failed to regenerate backup codes');
        return null;
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to regenerate backup codes');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Get MFA status
   */
  const getMFAStatus = useCallback(async (): Promise<void> => {
    try {
      const response = await mfaApi.getMFAStatus();
      
      if (response.success) {
        setMfaStatus({
          enabled: response.mfa_enabled,
          backupCodesCount: response.backup_codes_count
        });
      }
    } catch (error: any) {
      console.error('Failed to get MFA status:', error.message);
    }
  }, []);

  /**
   * Download backup codes as file
   */
  const downloadBackupCodes = useCallback((userEmail: string) => {
    if (!mfaData?.backupCodes) {
      toast.error('No backup codes available');
      return;
    }

    mfaApi.downloadBackupCodes(mfaData.backupCodes, userEmail);
    toast.success('Backup codes downloaded!');
  }, [mfaData]);

  /**
   * Copy backup codes to clipboard
   */
  const copyBackupCodes = useCallback(async (): Promise<void> => {
    if (!mfaData?.backupCodes) {
      toast.error('No backup codes available');
      return;
    }

    try {
      await mfaApi.copyBackupCodes(mfaData.backupCodes);
      toast.success('Backup codes copied to clipboard!');
    } catch (error) {
      toast.error('Failed to copy backup codes');
    }
  }, [mfaData]);

  return {
    // State
    isLoading,
    mfaData,
    mfaStatus,

    // Actions
    setupMFA,
    verifySetup,
    verifyMFA,
    disableMFA,
    regenerateBackupCodes,
    getMFAStatus,
    downloadBackupCodes,
    copyBackupCodes,
  };
};

export default useMFA;
