import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { 
  accountAbstractionService, 
  UserOperationResult, 
  GasEstimate,
  TransactionData
} from '../services/account-abstraction.service';

export interface GaslessTransactionState {
  isInitialized: boolean;
  isAvailable: boolean;
  isLoading: boolean;
  error: string | null;
  lastTransaction: UserOperationResult | null;
}

export interface GaslessTransactionActions {
  executeGaslessTransaction: (to: string, data: string, value?: string) => Promise<UserOperationResult>;
  executeBatchTransactions: (transactions: TransactionData[]) => Promise<UserOperationResult[]>;
  estimateGas: (from: string, to: string, data: string, value?: string) => Promise<GasEstimate | null>;
  getTransactionStatus: (userOpHash: string) => Promise<{ status: 'pending' | 'success' | 'failed'; transactionHash?: string; blockNumber?: number; } | null>;
  validateConfiguration: () => Promise<{ isValid: boolean; errors: string[]; warnings: string[]; }>;
  getAnalytics: (period?: 'day' | 'week' | 'month') => Promise<{ totalTransactions: number; totalGasSponsored: string; totalGasSaved: string; sponsorshipRate: number; }>;
}

export function useGaslessTransactions(signer?: ethers.Signer) {
  const [state, setState] = useState<GaslessTransactionState>({
    isInitialized: false,
    isAvailable: false,
    isLoading: false,
    error: null,
    lastTransaction: null
  });

  // Initialize the service
  useEffect(() => {
    const initializeService = async () => {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      try {
        const isAvailable = accountAbstractionService.isAvailable();
        
        if (isAvailable) {
          await accountAbstractionService.initializeProvider();
        }

        setState(prev => ({
          ...prev,
          isInitialized: true,
          isAvailable,
          isLoading: false
        }));
      } catch (error: any) {
        setState(prev => ({
          ...prev,
          isInitialized: false,
          isAvailable: false,
          isLoading: false,
          error: error?.message || 'Failed to initialize gasless transactions'
        }));
      }
    };

    initializeService();
  }, []);

  const executeGaslessTransaction = useCallback(async (
    to: string, 
    data: string, 
    value: string = '0'
  ): Promise<UserOperationResult> => {
    if (!signer) {
      throw new Error('Signer is required for transactions');
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const result = await accountAbstractionService.executeGaslessTransaction(
        signer,
        to,
        data,
        value
      );

      setState(prev => ({ 
        ...prev, 
        isLoading: false, 
        lastTransaction: result,
        error: result.success ? null : result.error || 'Transaction failed'
      }));

      return result;
    } catch (error: any) {
      const errorMsg = error?.message || 'Failed to execute transaction';
      setState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: errorMsg 
      }));
      
      return {
        userOpHash: '',
        success: false,
        error: errorMsg
      };
    }
  }, [signer]);

  const executeBatchTransactions = useCallback(async (
    transactions: TransactionData[]
  ): Promise<UserOperationResult[]> => {
    if (!signer) {
      throw new Error('Signer is required for transactions');
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const results = await accountAbstractionService.executeBatchTransactions(
        signer,
        transactions
      );

      const hasFailures = results.some(result => !result.success);
      const lastResult = results[results.length - 1];

      setState(prev => ({ 
        ...prev, 
        isLoading: false,
        lastTransaction: lastResult,
        error: hasFailures ? 'Some transactions in batch failed' : null
      }));

      return results;
    } catch (error: any) {
      const errorMsg = error?.message || 'Failed to execute batch transactions';
      setState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: errorMsg 
      }));
      
      return [];
    }
  }, [signer]);

  const estimateGas = useCallback(async (
    from: string,
    to: string,
    data: string,
    value: string = '0'
  ): Promise<GasEstimate | null> => {
    try {
      return await accountAbstractionService.estimateGasForTransaction(
        from,
        to,
        data,
        value
      );
    } catch (error: any) {
      console.error('Failed to estimate gas:', error);
      return null;
    }
  }, []);

  const getTransactionStatus = useCallback(async (userOpHash: string) => {
    try {
      return await accountAbstractionService.getTransactionStatus(userOpHash);
    } catch (error: any) {
      console.error('Failed to get transaction status:', error);
      return null;
    }
  }, []);

  const validateConfiguration = useCallback(async () => {
    try {
      return await accountAbstractionService.validateConfiguration();
    } catch (error: any) {
      return {
        isValid: false,
        errors: [error?.message || 'Configuration validation failed'],
        warnings: []
      };
    }
  }, []);

  const getAnalytics = useCallback(async (period: 'day' | 'week' | 'month' = 'week') => {
    try {
      return await accountAbstractionService.getGasUsageAnalytics(period);
    } catch (error: any) {
      console.error('Failed to get analytics:', error);
      return {
        totalTransactions: 0,
        totalGasSponsored: '0',
        totalGasSaved: '0',
        sponsorshipRate: 0
      };
    }
  }, []);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  const actions: GaslessTransactionActions = {
    executeGaslessTransaction,
    executeBatchTransactions,
    estimateGas,
    getTransactionStatus,
    validateConfiguration,
    getAnalytics
  };

  return {
    ...state,
    ...actions,
    clearError,
    // Helper computed properties
    canExecuteTransactions: state.isInitialized && state.isAvailable && !!signer,
    configuration: accountAbstractionService.getConfiguration()
  };
}

// Hook for transaction monitoring
export function useTransactionMonitor(userOpHash: string | null) {
  const [status, setStatus] = useState<{
    status: 'pending' | 'success' | 'failed' | 'unknown';
    transactionHash?: string;
    blockNumber?: number;
    isLoading: boolean;
  }>({
    status: 'unknown',
    isLoading: false
  });

  useEffect(() => {
    if (!userOpHash) {
      setStatus({ status: 'unknown', isLoading: false });
      return;
    }

    const checkStatus = async () => {
      setStatus(prev => ({ ...prev, isLoading: true }));

      try {
        const result = await accountAbstractionService.getTransactionStatus(userOpHash);
        
        if (result) {
          setStatus({
            ...result,
            isLoading: false
          });
        } else {
          setStatus({
            status: 'unknown',
            isLoading: false
          });
        }
      } catch (error) {
        setStatus({
          status: 'unknown',
          isLoading: false
        });
      }
    };

    // Check immediately
    checkStatus();

    // Set up polling for pending transactions
    const intervalId = setInterval(() => {
      if (status.status === 'pending') {
        checkStatus();
      }
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(intervalId);
  }, [userOpHash, status.status]);

  return status;
}

// Hook for gas usage analytics
export function useGasAnalytics() {
  const [analytics, setAnalytics] = useState<{
    totalTransactions: number;
    totalGasSponsored: string;
    totalGasSaved: string;
    sponsorshipRate: number;
    isLoading: boolean;
    error: string | null;
  }>({
    totalTransactions: 0,
    totalGasSponsored: '0',
    totalGasSaved: '0',
    sponsorshipRate: 0,
    isLoading: false,
    error: null
  });

  const fetchAnalytics = useCallback(async (period: 'day' | 'week' | 'month' = 'week') => {
    setAnalytics(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const data = await accountAbstractionService.getGasUsageAnalytics(period);
      setAnalytics(prev => ({
        ...prev,
        ...data,
        isLoading: false
      }));
    } catch (error: any) {
      setAnalytics(prev => ({
        ...prev,
        isLoading: false,
        error: error?.message || 'Failed to fetch analytics'
      }));
    }
  }, []);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  return {
    ...analytics,
    refetch: fetchAnalytics
  };
}
