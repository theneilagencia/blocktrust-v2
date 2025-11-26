/**
 * Security Settings Page
 * 
 * Comprehensive security settings for user accounts:
 * - MFA/2FA setup and management
 * - Backup codes regeneration
 * - Security status overview
 * - Polygon wallet information
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { useMFA } from '../hooks/useMFA';
import { MFASetup } from './MFASetup';
import Button from './Button';
import Card from './Card';
import Input from './Input';

interface SecuritySettingsProps {
  userEmail: string;
  walletAddress?: string;
  smartAccountAddress?: string;
}

export const SecuritySettings: React.FC<SecuritySettingsProps> = ({
  userEmail,
  walletAddress,
  smartAccountAddress
}) => {
  const [showMFASetup, setShowMFASetup] = useState(false);
  const [showDisableForm, setShowDisableForm] = useState(false);
  const [showRegenForm, setShowRegenForm] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');
  const [disableMFACode, setDisableMFACode] = useState('');
  const [regenMFACode, setRegenMFACode] = useState('');
  const [newBackupCodes, setNewBackupCodes] = useState<string[] | null>(null);

  const {
    isLoading,
    mfaStatus,
    disableMFA,
    regenerateBackupCodes,
    getMFAStatus
  } = useMFA();

  // Load MFA status on component mount
  useEffect(() => {
    getMFAStatus();
  }, [getMFAStatus]);

  // Handle MFA setup completion
  const handleMFASetupComplete = () => {
    setShowMFASetup(false);
    getMFAStatus(); // Refresh status
    toast.success('Two-factor authentication has been enabled!');
  };

  // Handle disable MFA
  const handleDisableMFA = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!disablePassword || !disableMFACode) {
      toast.error('Please fill all fields');
      return;
    }

    const success = await disableMFA(disableMFACode, disablePassword);
    if (success) {
      setShowDisableForm(false);
      setDisablePassword('');
      setDisableMFACode('');
    }
  };

  // Handle regenerate backup codes
  const handleRegenerateBackupCodes = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!regenMFACode) {
      toast.error('Please enter your authenticator code');
      return;
    }

    const codes = await regenerateBackupCodes(regenMFACode);
    if (codes) {
      setNewBackupCodes(codes);
      setRegenMFACode('');
    }
  };

  // Download backup codes
  const downloadBackupCodes = () => {
    if (!newBackupCodes) return;
    
    const content = `BLOCKTRUST - NEW BACKUP CODES
=====================================
⚠️ IMPORTANT: Store these codes securely!
Each code can only be used ONCE.

User: ${userEmail}
Generated: ${new Date().toLocaleString('en-US')}
Network: Polygon Amoy Testnet

CODES:
${newBackupCodes.map((code, i) => `${(i + 1).toString().padStart(2, '0')}. ${code}`).join('\n')}

=====================================
INSTRUCTIONS:
- Use these codes if you lose access to your authenticator
- Each code works only once
- Store in a secure location (vault, password manager)
- DO NOT share with anyone
=====================================`;

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `blocktrust-backup-codes-${Date.now()}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast.success('Backup codes downloaded!');
    setNewBackupCodes(null);
    setShowRegenForm(false);
  };

  if (showMFASetup) {
    return (
      <MFASetup
        userEmail={userEmail}
        onComplete={handleMFASetupComplete}
        onCancel={() => setShowMFASetup(false)}
      />
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Security Settings
        </h1>
        <p className="text-gray-600">
          Manage your account security and two-factor authentication
        </p>
      </div>

      {/* Two-Factor Authentication Section */}
      <Card className="p-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Two-Factor Authentication (2FA)
            </h2>
            <p className="text-gray-600">
              Add an extra layer of security to your account with TOTP-based authentication.
            </p>
          </div>
          
          <div className="flex items-center">
            {mfaStatus?.enabled ? (
              <div className="flex items-center text-green-600">
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="font-medium">Enabled</span>
              </div>
            ) : (
              <div className="flex items-center text-amber-600">
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <span className="font-medium">Disabled</span>
              </div>
            )}
          </div>
        </div>

        {!mfaStatus?.enabled ? (
          /* MFA Not Enabled */
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
            <div className="flex">
              <svg className="w-5 h-5 text-amber-400 mt-0.5 mr-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <div>
                <h3 className="text-amber-800 font-medium mb-1">
                  Two-factor authentication is not enabled
                </h3>
                <p className="text-amber-700 text-sm mb-4">
                  Your account is protected only by your password. Enable 2FA for additional security.
                </p>
                <Button
                  onClick={() => setShowMFASetup(true)}
                  size="sm"
                >
                  Enable Two-Factor Authentication
                </Button>
              </div>
            </div>
          </div>
        ) : (
          /* MFA Enabled */
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-start">
                <svg className="w-5 h-5 text-green-400 mt-0.5 mr-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <div>
                  <h3 className="text-green-800 font-medium mb-1">
                    Two-factor authentication is active
                  </h3>
                  <p className="text-green-700 text-sm">
                    Your account is protected with TOTP-based 2FA. 
                    You have {mfaStatus.backupCodesCount} backup codes remaining.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              {/* Regenerate Backup Codes */}
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowRegenForm(true)}
              >
                🔄 Regenerate Backup Codes
              </Button>

              {/* Disable MFA */}
              <Button
                variant="danger"
                size="sm"
                onClick={() => setShowDisableForm(true)}
              >
                🚫 Disable 2FA
              </Button>
            </div>
          </div>
        )}

        {/* Disable MFA Form */}
        {showDisableForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg"
          >
            <h3 className="font-semibold text-red-900 mb-3">
              Disable Two-Factor Authentication
            </h3>
            <p className="text-red-800 text-sm mb-4">
              ⚠️ This will remove the extra layer of security from your account.
            </p>
            
            <form onSubmit={handleDisableMFA} className="space-y-4">
              <Input
                type="password"
                placeholder="Current password"
                value={disablePassword}
                onChange={(e) => setDisablePassword(e.target.value)}
                required
              />
              <Input
                type="text"
                placeholder="2FA code from authenticator"
                value={disableMFACode}
                onChange={(e) => setDisableMFACode(e.target.value)}
                maxLength={8}
                required
              />
              
              <div className="flex gap-3">
                <Button
                  type="submit"
                  variant="danger"
                  size="sm"
                  disabled={isLoading}
                >
                  {isLoading ? 'Disabling...' : 'Disable 2FA'}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowDisableForm(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </motion.div>
        )}

        {/* Regenerate Backup Codes Form */}
        {showRegenForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg"
          >
            <h3 className="font-semibold text-blue-900 mb-3">
              Generate New Backup Codes
            </h3>
            <p className="text-blue-800 text-sm mb-4">
              This will invalidate your current backup codes and generate new ones.
            </p>
            
            <form onSubmit={handleRegenerateBackupCodes} className="space-y-4">
              <Input
                type="text"
                placeholder="2FA code from authenticator"
                value={regenMFACode}
                onChange={(e) => setRegenMFACode(e.target.value)}
                maxLength={6}
                required
              />
              
              <div className="flex gap-3">
                <Button
                  type="submit"
                  size="sm"
                  disabled={isLoading}
                >
                  {isLoading ? 'Generating...' : 'Generate New Codes'}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowRegenForm(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </motion.div>
        )}

        {/* New Backup Codes Display */}
        {newBackupCodes && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg"
          >
            <h3 className="font-semibold text-green-900 mb-3">
              🎉 New Backup Codes Generated
            </h3>
            
            <div className="grid grid-cols-2 gap-2 mb-4 p-3 bg-white rounded border">
              {newBackupCodes.map((code, index) => (
                <div key={index} className="font-mono text-sm p-2 bg-gray-50 rounded">
                  {(index + 1).toString().padStart(2, '0')}. {code}
                </div>
              ))}
            </div>
            
            <div className="flex gap-3">
              <Button
                size="sm"
                onClick={downloadBackupCodes}
              >
                💾 Download Codes
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setNewBackupCodes(null)}
              >
                I've Saved Them
              </Button>
            </div>
          </motion.div>
        )}
      </Card>

      {/* Blockchain Information */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Blockchain Information
        </h2>
        
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 mb-3">
            Polygon Network Details
          </h3>
          
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-blue-800">Network:</span>
              <span className="font-mono text-blue-900">Polygon Amoy Testnet</span>
            </div>
            
            {walletAddress && (
              <div className="flex justify-between">
                <span className="text-blue-800">Wallet Address:</span>
                <span className="font-mono text-blue-900 truncate ml-4">
                  {walletAddress}
                </span>
              </div>
            )}
            
            {smartAccountAddress && (
              <div className="flex justify-between">
                <span className="text-blue-800">Smart Account:</span>
                <span className="font-mono text-blue-900 truncate ml-4">
                  {smartAccountAddress}
                </span>
              </div>
            )}
          </div>
          
          <p className="text-xs text-blue-700 mt-3">
            ℹ️ 2FA protects your account access. Blockchain transactions are secured 
            by your biometric-derived wallet and deterministic key generation.
          </p>
        </div>
      </Card>
    </div>
  );
};

export default SecuritySettings;
