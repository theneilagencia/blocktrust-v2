/**
 * MFA Setup Component
 * 
 * Multi-step component for setting up Multi-Factor Authentication:
 * 1. Introduction
 * 2. QR Code display and manual entry
 * 3. TOTP verification
 * 4. Backup codes display
 * 5. Completion
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import toast from 'react-hot-toast';
import { useMFA } from '../hooks/useMFA';
import Button from './Button';
import Input from './Input';
import Card from './Card';

// Validation schemas
const verifySchema = z.object({
  code: z.string().length(6).regex(/^\d{6}$/, 'Code must be 6 digits')
});

type VerifyFormData = z.infer<typeof verifySchema>;

interface MFASetupProps {
  userEmail: string;
  onComplete?: () => void;
  onCancel?: () => void;
}

type SetupStep = 'intro' | 'qr' | 'verify' | 'backup' | 'complete';

export const MFASetup: React.FC<MFASetupProps> = ({
  userEmail,
  onComplete,
  onCancel
}) => {
  const [step, setStep] = useState<SetupStep>('intro');
  const {
    isLoading,
    mfaData,
    setupMFA,
    verifySetup,
    downloadBackupCodes,
    copyBackupCodes
  } = useMFA();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset
  } = useForm<VerifyFormData>({
    resolver: zodResolver(verifySchema)
  });

  // Start MFA setup
  const handleStartSetup = async () => {
    const data = await setupMFA();
    if (data) {
      setStep('qr');
    }
  };

  // Verify TOTP code and complete setup
  const onVerifySubmit = async (data: VerifyFormData) => {
    const success = await verifySetup(data.code);
    if (success) {
      setStep('backup');
    }
    reset();
  };

  // Format secret for manual entry
  const formatSecret = (secret: string): string => {
    return secret.match(/.{1,4}/g)?.join(' ') || secret;
  };

  // Copy secret to clipboard
  const copySecret = async () => {
    if (!mfaData?.secret) return;
    
    try {
      await navigator.clipboard.writeText(mfaData.secret);
      toast.success('Secret copied to clipboard!');
    } catch (error) {
      toast.error('Failed to copy secret');
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <AnimatePresence mode="wait">
        {/* Step 1: Introduction */}
        {step === 'intro' && (
          <motion.div
            key="intro"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="text-center"
          >
            <Card className="p-8">
              <div className="flex justify-center mb-6">
                <div className="p-4 bg-blue-100 rounded-full">
                  <svg className="w-12 h-12 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
              </div>
              
              <h2 className="text-3xl font-bold text-gray-900 mb-4">
                Enable Two-Factor Authentication
              </h2>
              
              <p className="text-gray-600 mb-8">
                Add an extra layer of security to your Blocktrust account
              </p>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8 text-left">
                <h3 className="font-semibold text-blue-900 mb-4">
                  Why enable 2FA?
                </h3>
                <ul className="space-y-2 text-sm text-blue-800">
                  <li className="flex items-start">
                    <span className="mr-2">🛡️</span>
                    <span>Protection against phishing and password theft</span>
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2">🔐</span>
                    <span>Extra security for your Polygon transactions</span>
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2">📱</span>
                    <span>Works with Google Authenticator, Authy, and more</span>
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2">🔄</span>
                    <span>Backup codes for account recovery</span>
                  </li>
                </ul>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-8">
                <p className="text-sm text-amber-800">
                  <strong>Note:</strong> 2FA protects access to your Blocktrust account. 
                  Your Polygon blockchain transactions are still signed with your wallet.
                </p>
              </div>

              <div className="flex gap-4">
                <Button
                  variant="secondary"
                  onClick={onCancel}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleStartSetup}
                  disabled={isLoading}
                  className="flex-1"
                >
                  {isLoading ? 'Setting up...' : 'Start Setup'}
                </Button>
              </div>
            </Card>
          </motion.div>
        )}

        {/* Step 2: QR Code and Manual Entry */}
        {step === 'qr' && mfaData && (
          <motion.div
            key="qr"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <Card className="p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
                Configure Your Authenticator
              </h2>

              <div className="grid md:grid-cols-2 gap-8">
                {/* QR Code */}
                <div className="text-center">
                  <h3 className="font-semibold text-lg mb-4">
                    1. Scan QR Code
                  </h3>
                  <div className="flex justify-center mb-4">
                    <div className="p-4 bg-white border-2 border-gray-200 rounded-lg">
                      <QRCodeSVG 
                        value={mfaData.qrCode.replace('data:image/png;base64,', '')}
                        size={200}
                        level="M"
                        includeMargin={true}
                      />
                    </div>
                  </div>
                  <p className="text-sm text-gray-600">
                    Use your authenticator app to scan
                  </p>
                </div>

                {/* Manual Entry */}
                <div>
                  <h3 className="font-semibold text-lg mb-4">
                    Or Enter Manually
                  </h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Account Name:
                      </label>
                      <div className="p-3 bg-gray-100 rounded border text-sm font-mono">
                        Blocktrust ({userEmail})
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Secret Key:
                      </label>
                      <div className="relative">
                        <div className="p-3 bg-gray-100 rounded border text-xs font-mono break-all pr-10">
                          {formatSecret(mfaData.secret)}
                        </div>
                        <button
                          type="button"
                          onClick={copySecret}
                          className="absolute right-2 top-1/2 transform -translate-y-1/2 text-blue-600 hover:text-blue-700"
                          title="Copy to clipboard"
                        >
                          📋
                        </button>
                      </div>
                    </div>
                    
                    <div className="bg-blue-50 p-3 rounded border border-blue-200">
                      <p className="text-xs text-blue-800">
                        <strong>Compatible apps:</strong> Google Authenticator, 
                        Microsoft Authenticator, Authy, 1Password, Bitwarden
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-8 text-center">
                <Button
                  onClick={() => setStep('verify')}
                  className="w-full md:w-auto px-8"
                >
                  Next: Verify Setup
                </Button>
              </div>
            </Card>
          </motion.div>
        )}

        {/* Step 3: Verification */}
        {step === 'verify' && (
          <motion.div
            key="verify"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <Card className="p-8 max-w-md mx-auto">
              <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
                Verify Setup
              </h2>

              <p className="text-gray-600 mb-6 text-center">
                Enter the 6-digit code from your authenticator app to complete setup.
              </p>

              <form onSubmit={handleSubmit(onVerifySubmit)} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Verification Code
                  </label>
                  <Input
                    {...register('code')}
                    type="text"
                    maxLength={6}
                    placeholder="000000"
                    className="text-center text-2xl font-mono tracking-wider"
                    autoComplete="off"
                    inputMode="numeric"
                    pattern="\d{6}"
                    error={errors.code?.message}
                  />
                </div>

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full"
                >
                  {isLoading ? 'Verifying...' : 'Verify and Enable 2FA'}
                </Button>
              </form>

              <button
                type="button"
                onClick={() => setStep('qr')}
                className="w-full mt-4 text-center text-sm text-blue-600 hover:text-blue-700"
              >
                ← Back to QR Code
              </button>
            </Card>
          </motion.div>
        )}

        {/* Step 4: Backup Codes */}
        {step === 'backup' && mfaData && (
          <motion.div
            key="backup"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <Card className="p-8">
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
                  <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-green-600 mb-2">
                  2FA Enabled Successfully!
                </h2>
                <p className="text-gray-600">
                  Your account is now protected with two-factor authentication.
                </p>
              </div>

              <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
                <h3 className="font-semibold text-red-900 mb-3">
                  ⚠️ Important: Save Your Backup Codes
                </h3>
                <p className="text-sm text-red-800 mb-4">
                  Store these codes in a secure location. You can use them to access 
                  your account if you lose your authenticator device.
                </p>
                
                <div className="grid grid-cols-2 gap-2 mb-4 p-4 bg-white rounded border">
                  {mfaData.backupCodes.map((code, index) => (
                    <div key={index} className="flex items-center p-2 bg-gray-50 rounded font-mono text-sm">
                      <span className="text-gray-500 mr-2">
                        {(index + 1).toString().padStart(2, '0')}.
                      </span>
                      <span className="font-semibold">{code}</span>
                    </div>
                  ))}
                </div>
                
                <div className="flex gap-3">
                  <Button
                    variant="secondary"
                    onClick={() => downloadBackupCodes(userEmail)}
                    className="flex-1"
                  >
                    💾 Download Codes
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={copyBackupCodes}
                    className="flex-1"
                  >
                    📋 Copy All
                  </Button>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <h4 className="font-semibold text-blue-900 mb-2">
                  ℹ️ How to use backup codes:
                </h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• Each code can only be used once</li>
                  <li>• Use when you don't have access to your authenticator</li>
                  <li>• You can generate new codes in security settings</li>
                  <li>• Store them securely (password manager, safe)</li>
                </ul>
              </div>

              <Button
                onClick={() => {
                  setStep('complete');
                  setTimeout(() => onComplete?.(), 2000);
                }}
                className="w-full"
              >
                Complete Setup
              </Button>
            </Card>
          </motion.div>
        )}

        {/* Step 5: Complete */}
        {step === 'complete' && (
          <motion.div
            key="complete"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-12"
          >
            <Card className="p-8">
              <div className="inline-flex items-center justify-center w-24 h-24 bg-green-100 rounded-full mb-6">
                <svg className="w-12 h-12 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h2 className="text-3xl font-bold text-green-600 mb-4">
                Account Secured!
              </h2>
              <p className="text-gray-600 text-lg">
                Your Blocktrust account is now protected with two-factor authentication.
              </p>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MFASetup;
