import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { useGaslessTransactions, useTransactionMonitor, useGasAnalytics } from '../hooks/useGasless';
import { TransactionData } from '../services/account-abstraction.service';

interface GaslessTransactionProps {
  signer?: ethers.Signer;
  onTransactionComplete?: (result: { success: boolean; transactionHash?: string; error?: string }) => void;
  showAnalytics?: boolean;
  className?: string;
}

export function GaslessTransaction({ 
  signer, 
  onTransactionComplete,
  showAnalytics = true,
  className = '' 
}: GaslessTransactionProps) {
  const {
    isInitialized,
    isAvailable,
    isLoading,
    error,
    lastTransaction,
    executeGaslessTransaction,
    executeBatchTransactions,
    estimateGas,
    validateConfiguration,
    clearError,
    canExecuteTransactions,
    configuration
  } = useGaslessTransactions(signer);

  const [configStatus, setConfigStatus] = useState<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } | null>(null);

  const [gasEstimate, setGasEstimate] = useState<{
    sponsoredGas: string;
    actualGasCost: string;
    gasSavings: string;
    sponsorshipStatus: 'sponsored' | 'partial' | 'user-paid';
  } | null>(null);

  const [formData, setFormData] = useState({
    to: '',
    data: '0x',
    value: '0'
  });

  const [batchTransactions, setBatchTransactions] = useState<TransactionData[]>([
    { to: '', data: '0x', value: '0' }
  ]);

  const transactionStatus = useTransactionMonitor(lastTransaction?.userOpHash || null);
  const analytics = useGasAnalytics();

  // Validate configuration on mount
  useEffect(() => {
    if (isInitialized) {
      validateConfiguration().then(setConfigStatus);
    }
  }, [isInitialized, validateConfiguration]);

  // Notify parent component when transaction completes
  useEffect(() => {
    if (lastTransaction && onTransactionComplete) {
      onTransactionComplete({
        success: lastTransaction.success,
        transactionHash: lastTransaction.transactionHash,
        error: lastTransaction.error
      });
    }
  }, [lastTransaction, onTransactionComplete]);

  const handleEstimateGas = async () => {
    if (!signer || !formData.to || !formData.data) return;

    try {
      const signerAddress = await signer.getAddress();
      const estimate = await estimateGas(signerAddress, formData.to, formData.data, formData.value);
      setGasEstimate(estimate);
    } catch (error) {
      console.error('Failed to estimate gas:', error);
    }
  };

  const handleExecuteTransaction = async () => {
    if (!canExecuteTransactions) return;

    try {
      clearError();
      await executeGaslessTransaction(formData.to, formData.data, formData.value);
    } catch (error) {
      console.error('Transaction failed:', error);
    }
  };

  const handleExecuteBatch = async () => {
    if (!canExecuteTransactions) return;

    try {
      clearError();
      const validTransactions = batchTransactions.filter(tx => tx.to && tx.data);
      if (validTransactions.length === 0) return;

      await executeBatchTransactions(validTransactions);
    } catch (error) {
      console.error('Batch transaction failed:', error);
    }
  };

  const addBatchTransaction = () => {
    setBatchTransactions([...batchTransactions, { to: '', data: '0x', value: '0' }]);
  };

  const removeBatchTransaction = (index: number) => {
    setBatchTransactions(batchTransactions.filter((_, i) => i !== index));
  };

  const updateBatchTransaction = (index: number, field: keyof TransactionData, value: string) => {
    const updated = [...batchTransactions];
    updated[index] = { ...updated[index], [field]: value };
    setBatchTransactions(updated);
  };

  if (!isInitialized) {
    return (
      <div className={`p-6 border border-gray-300 rounded-lg ${className}`}>
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Initializing gasless transactions...</span>
        </div>
      </div>
    );
  }

  if (!isAvailable) {
    return (
      <div className={`p-6 border border-orange-300 rounded-lg bg-orange-50 ${className}`}>
        <div className="flex items-start space-x-3">
          <svg className="w-5 h-5 text-orange-600 mt-1" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <div>
            <h3 className="text-lg font-semibold text-orange-800">Gasless Transactions Not Available</h3>
            <p className="text-orange-700 mt-2">
              Biconomy configuration is missing. Please configure the following environment variables:
            </p>
            <ul className="mt-2 text-sm text-orange-600 space-y-1">
              <li>• REACT_APP_BICONOMY_BUNDLER_URL</li>
              <li>• REACT_APP_BICONOMY_PAYMASTER_API_KEY</li>
              <li>• REACT_APP_BICONOMY_API_KEY (optional)</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Configuration Status */}
      {configStatus && (
        <div className={`p-4 rounded-lg border ${
          configStatus.isValid 
            ? 'border-green-300 bg-green-50' 
            : 'border-red-300 bg-red-50'
        }`}>
          <div className="flex items-start space-x-3">
            <svg 
              className={`w-5 h-5 mt-1 ${
                configStatus.isValid ? 'text-green-600' : 'text-red-600'
              }`} 
              fill="currentColor" 
              viewBox="0 0 20 20"
            >
              {configStatus.isValid ? (
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              ) : (
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              )}
            </svg>
            <div>
              <h4 className={`font-semibold ${
                configStatus.isValid ? 'text-green-800' : 'text-red-800'
              }`}>
                Configuration {configStatus.isValid ? 'Valid' : 'Invalid'}
              </h4>
              {configStatus.errors.length > 0 && (
                <ul className="mt-1 text-sm text-red-700 space-y-1">
                  {configStatus.errors.map((error, index) => (
                    <li key={index}>• {error}</li>
                  ))}
                </ul>
              )}
              {configStatus.warnings.length > 0 && (
                <ul className="mt-1 text-sm text-orange-700 space-y-1">
                  {configStatus.warnings.map((warning, index) => (
                    <li key={index}>⚠ {warning}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Current Configuration */}
      <div className="p-4 border border-gray-300 rounded-lg bg-gray-50">
        <h4 className="font-semibold text-gray-800 mb-2">Current Configuration</h4>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-gray-600">Chain ID:</span>
            <span className="ml-2 font-mono">{configuration?.chainId}</span>
          </div>
          <div>
            <span className="text-gray-600">Network:</span>
            <span className="ml-2">{configuration?.chainId === 137 ? 'Polygon Mainnet' : 'Amoy Testnet'}</span>
          </div>
          <div>
            <span className="text-gray-600">Bundler:</span>
            <span className="ml-2">{configuration?.bundlerUrl ? '✓ Configured' : '✗ Missing'}</span>
          </div>
          <div>
            <span className="text-gray-600">Paymaster:</span>
            <span className="ml-2">{configuration?.paymasterApiKey ? '✓ Configured' : '✗ Missing'}</span>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="p-4 border border-red-300 rounded-lg bg-red-50">
          <div className="flex items-start space-x-3">
            <svg className="w-5 h-5 text-red-600 mt-1" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <div>
              <h4 className="font-semibold text-red-800">Transaction Error</h4>
              <p className="text-red-700 mt-1">{error}</p>
              <button
                onClick={clearError}
                className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
              >
                Clear Error
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Single Transaction Form */}
      <div className="p-6 border border-gray-300 rounded-lg">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Single Gasless Transaction</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Contract Address
            </label>
            <input
              type="text"
              value={formData.to}
              onChange={(e) => setFormData({ ...formData, to: e.target.value })}
              placeholder="0x..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Transaction Data
            </label>
            <textarea
              value={formData.data}
              onChange={(e) => setFormData({ ...formData, data: e.target.value })}
              placeholder="0x..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Value (ETH)
            </label>
            <input
              type="text"
              value={formData.value}
              onChange={(e) => setFormData({ ...formData, value: e.target.value })}
              placeholder="0"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex space-x-3">
            <button
              onClick={handleEstimateGas}
              disabled={!canExecuteTransactions || !formData.to || !formData.data}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Estimate Gas
            </button>
            
            <button
              onClick={handleExecuteTransaction}
              disabled={!canExecuteTransactions || isLoading || !formData.to || !formData.data}
              className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Executing...' : 'Execute Gasless Transaction'}
            </button>
          </div>

          {/* Gas Estimate Display */}
          {gasEstimate && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
              <h5 className="font-medium text-blue-800 mb-2">Gas Estimate</h5>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-blue-600">Status:</span>
                  <span className={`ml-2 font-semibold ${
                    gasEstimate.sponsorshipStatus === 'sponsored' ? 'text-green-600' : 'text-orange-600'
                  }`}>
                    {gasEstimate.sponsorshipStatus}
                  </span>
                </div>
                <div>
                  <span className="text-blue-600">Your Cost:</span>
                  <span className="ml-2 font-mono">{gasEstimate.sponsoredGas} MATIC</span>
                </div>
                <div>
                  <span className="text-blue-600">Actual Cost:</span>
                  <span className="ml-2 font-mono">{gasEstimate.actualGasCost} MATIC</span>
                </div>
                <div>
                  <span className="text-blue-600">Savings:</span>
                  <span className="ml-2 font-mono text-green-600">{gasEstimate.gasSavings} MATIC</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Transaction Status */}
      {lastTransaction && (
        <div className="p-4 border border-gray-300 rounded-lg">
          <h4 className="font-semibold text-gray-800 mb-2">Last Transaction</h4>
          <div className="space-y-2 text-sm">
            <div>
              <span className="text-gray-600">User Op Hash:</span>
              <span className="ml-2 font-mono text-xs break-all">{lastTransaction.userOpHash}</span>
            </div>
            {lastTransaction.transactionHash && (
              <div>
                <span className="text-gray-600">Transaction Hash:</span>
                <span className="ml-2 font-mono text-xs break-all">{lastTransaction.transactionHash}</span>
              </div>
            )}
            <div>
              <span className="text-gray-600">Status:</span>
              <span className={`ml-2 font-semibold ${
                transactionStatus.status === 'success' ? 'text-green-600' :
                transactionStatus.status === 'failed' ? 'text-red-600' :
                transactionStatus.status === 'pending' ? 'text-yellow-600' :
                'text-gray-600'
              }`}>
                {transactionStatus.isLoading ? 'Checking...' : transactionStatus.status}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Batch Transactions */}
      <div className="p-6 border border-gray-300 rounded-lg">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Batch Gasless Transactions</h3>
        
        <div className="space-y-4">
          {batchTransactions.map((tx, index) => (
            <div key={index} className="p-3 border border-gray-200 rounded-md">
              <div className="flex justify-between items-center mb-2">
                <h5 className="font-medium text-gray-700">Transaction {index + 1}</h5>
                {batchTransactions.length > 1 && (
                  <button
                    onClick={() => removeBatchTransaction(index)}
                    className="text-red-600 hover:text-red-800"
                  >
                    Remove
                  </button>
                )}
              </div>
              
              <div className="grid grid-cols-3 gap-3">
                <input
                  type="text"
                  value={tx.to}
                  onChange={(e) => updateBatchTransaction(index, 'to', e.target.value)}
                  placeholder="Contract Address"
                  className="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <input
                  type="text"
                  value={tx.data}
                  onChange={(e) => updateBatchTransaction(index, 'data', e.target.value)}
                  placeholder="Transaction Data"
                  className="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <input
                  type="text"
                  value={tx.value}
                  onChange={(e) => updateBatchTransaction(index, 'value', e.target.value)}
                  placeholder="Value (ETH)"
                  className="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
          ))}
          
          <div className="flex space-x-3">
            <button
              onClick={addBatchTransaction}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
            >
              Add Transaction
            </button>
            
            <button
              onClick={handleExecuteBatch}
              disabled={!canExecuteTransactions || isLoading}
              className="px-6 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Executing...' : 'Execute Batch'}
            </button>
          </div>
        </div>
      </div>

      {/* Analytics */}
      {showAnalytics && (
        <div className="p-6 border border-gray-300 rounded-lg">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Gas Usage Analytics</h3>
          
          {analytics.isLoading ? (
            <div className="flex items-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              <span className="ml-2 text-gray-600">Loading analytics...</span>
            </div>
          ) : analytics.error ? (
            <p className="text-red-600">{analytics.error}</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{analytics.totalTransactions}</div>
                <div className="text-sm text-gray-600">Total Transactions</div>
              </div>
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{analytics.totalGasSponsored}</div>
                <div className="text-sm text-gray-600">MATIC Sponsored</div>
              </div>
              <div className="text-center p-3 bg-purple-50 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">{analytics.totalGasSaved}</div>
                <div className="text-sm text-gray-600">MATIC Saved</div>
              </div>
              <div className="text-center p-3 bg-orange-50 rounded-lg">
                <div className="text-2xl font-bold text-orange-600">{(analytics.sponsorshipRate * 100).toFixed(1)}%</div>
                <div className="text-sm text-gray-600">Sponsorship Rate</div>
              </div>
            </div>
          )}
          
          <button
            onClick={() => analytics.refetch()}
            className="mt-4 text-sm text-blue-600 hover:text-blue-800 underline"
          >
            Refresh Analytics
          </button>
        </div>
      )}
    </div>
  );
}
