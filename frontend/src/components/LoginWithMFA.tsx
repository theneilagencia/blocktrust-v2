/**
 * LoginWithMFA Component
 * 
 * Enhanced login component that supports Multi-Factor Authentication
 * Two-step process:
 * 1. Email/password authentication
 * 2. MFA token verification (if enabled)
 */

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { mfaApi } from '../services/mfa.service';
import Button from './Button';
import Input from './Input';
import Card from './Card';

// Validation schemas
const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const mfaSchema = z.object({
  mfaCode: z.string().min(6, 'Code must be at least 6 characters'),
});

type LoginFormData = z.infer<typeof loginSchema>;
type MFAFormData = z.infer<typeof mfaSchema>;

interface LoginWithMFAProps {
  onLoginSuccess?: (userData: any) => void;
  redirectTo?: string;
}

export const LoginWithMFA: React.FC<LoginWithMFAProps> = ({
  onLoginSuccess,
  redirectTo = '/dashboard'
}) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [requiresMFA, setRequiresMFA] = useState(false);
  const [tempCredentials, setTempCredentials] = useState<{
    email: string;
    password: string;
  } | null>(null);

  // Forms
  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema)
  });

  const mfaForm = useForm<MFAFormData>({
    resolver: zodResolver(mfaSchema)
  });

  // Handle initial login
  const onLoginSubmit = async (data: LoginFormData) => {
    setLoading(true);
    
    try {
      const response = await mfaApi.loginWithMFA(data.email, data.password);
      
      if (response.mfa_required) {
        // MFA is required, show MFA form
        setRequiresMFA(true);
        setTempCredentials({
          email: data.email,
          password: data.password
        });
        toast('Please enter your authenticator code', { 
          icon: 'ℹ️' 
        });
      } else {
        // Login successful without MFA
        handleLoginSuccess(response);
      }
    } catch (error: any) {
      toast.error(error.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  // Handle MFA verification
  const onMFASubmit = async (data: MFAFormData) => {
    if (!tempCredentials) {
      toast.error('Session expired. Please start over.');
      setRequiresMFA(false);
      return;
    }

    setLoading(true);

    try {
      const response = await mfaApi.loginWithMFA(
        tempCredentials.email,
        tempCredentials.password,
        data.mfaCode
      );
      
      handleLoginSuccess(response);
    } catch (error: any) {
      toast.error(error.message || 'Invalid MFA code');
    } finally {
      setLoading(false);
    }
  };

  // Handle successful login
  const handleLoginSuccess = (data: any) => {
    // Store authentication data
    localStorage.setItem('token', data.token);
    
    const userData = {
      ...data.user,
      mfa_method: data.mfa_method
    };
    
    // Call parent callback if provided
    onLoginSuccess?.(userData);
    
    toast.success('Login successful!');
    
    // Navigate to dashboard or specified route
    navigate(redirectTo);
  };

  // Reset to initial state
  const resetToLogin = () => {
    setRequiresMFA(false);
    setTempCredentials(null);
    mfaForm.reset();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <div className="max-w-md w-full">
        <Card className="p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center">
                <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
            </div>
            <h2 className="text-3xl font-bold text-gray-900">
              Sign In to Blocktrust
            </h2>
            <p className="mt-2 text-gray-600">
              Digital identity platform on Polygon
            </p>
          </div>

          <AnimatePresence mode="wait">
            {/* Step 1: Email/Password */}
            {!requiresMFA && (
              <motion.div
                key="login"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
              >
                <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-6">
                  <Input
                    {...loginForm.register('email')}
                    type="email"
                    placeholder="Email address"
                    autoComplete="email"
                    error={loginForm.formState.errors.email?.message}
                  />

                  <Input
                    {...loginForm.register('password')}
                    type="password"
                    placeholder="Password"
                    autoComplete="current-password"
                    error={loginForm.formState.errors.password?.message}
                  />

                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full"
                  >
                    {loading ? 'Signing in...' : 'Sign In'}
                  </Button>
                </form>

                <div className="mt-6 text-center">
                  <a
                    href="/register"
                    className="text-blue-600 hover:text-blue-500 text-sm"
                  >
                    Don't have an account? Sign up
                  </a>
                </div>
              </motion.div>
            )}

            {/* Step 2: MFA Verification */}
            {requiresMFA && (
              <motion.div
                key="mfa"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <div className="text-center mb-6">
                  <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 rounded-full mb-4">
                    <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Two-Factor Authentication
                  </h3>
                  <p className="text-sm text-gray-600">
                    Enter the code from your authenticator app
                  </p>
                </div>

                <form onSubmit={mfaForm.handleSubmit(onMFASubmit)} className="space-y-6">
                  <Input
                    {...mfaForm.register('mfaCode')}
                    type="text"
                    placeholder="000000"
                    maxLength={8}
                    className="text-center text-2xl font-mono tracking-wider"
                    autoComplete="off"
                    autoFocus
                    error={mfaForm.formState.errors.mfaCode?.message}
                  />

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-xs text-blue-800 text-center">
                      Enter the 6-digit code from your authenticator app,
                      or use a backup code if you don't have access.
                    </p>
                  </div>

                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full"
                  >
                    {loading ? 'Verifying...' : 'Verify Code'}
                  </Button>
                </form>

                <div className="mt-6 text-center">
                  <button
                    type="button"
                    onClick={resetToLogin}
                    className="text-sm text-blue-600 hover:text-blue-500"
                  >
                    ← Back to login
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Security Notice */}
          <div className="mt-8 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-gray-400 mt-0.5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-1">
                  Secure Authentication
                </h4>
                <p className="text-xs text-gray-600">
                  Your Polygon wallet operations are secured with biometric authentication 
                  and deterministic key generation.
                </p>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default LoginWithMFA;
