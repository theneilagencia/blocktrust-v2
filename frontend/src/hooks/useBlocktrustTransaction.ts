/**
 * @title Blocktrust Transaction Hook
 * @dev Hook customizado para gerenciar transações com Privy
 * @author Blocktrust Team
 */

import { useState, useCallback } from 'react';
import { PrivyTransactionService, TransactionResult } from '../services/privy-transaction.service';

export interface TransactionState {
  isLoading: boolean;
  error: string | null;
  txHash: string | null;
  receipt: any | null;
}

export function useBlocktrustTransaction() {
  const [state, setState] = useState<TransactionState>({
    isLoading: false,
    error: null,
    txHash: null,
    receipt: null,
  });

  /**
   * Envia uma transação
   */
  const sendTransaction = useCallback(async (
    to: string,
    data: string,
    value: string = '0'
  ): Promise<TransactionResult> => {
    setState(prev => ({ ...prev, isLoading: true, error: null, txHash: null, receipt: null }));

    try {
      const result = await PrivyTransactionService.sendTransaction(to, data, value);

      if (result.success) {
        setState({
          isLoading: false,
          error: null,
          txHash: result.hash,
          receipt: result.receipt || null,
        });
      } else {
        setState({
          isLoading: false,
          error: result.error || 'Transação falhou',
          txHash: result.hash || null,
          receipt: null,
        });
      }

      return result;
    } catch (error: any) {
      const errorMessage = error?.message || 'Erro ao enviar transação';
      
      setState({
        isLoading: false,
        error: errorMessage,
        txHash: null,
        receipt: null,
      });

      throw error;
    }
  }, []);

  /**
   * Envia múltiplas transações em sequência
   */
  const sendBatchTransactions = useCallback(async (
    transactions: Array<{ to: string; data: string; value?: string }>
  ): Promise<TransactionResult[]> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const results = await PrivyTransactionService.sendBatchTransactions(transactions);

      const hasError = results.some(r => !r.success);
      const lastResult = results[results.length - 1];

      setState({
        isLoading: false,
        error: hasError ? 'Algumas transações falharam' : null,
        txHash: lastResult?.hash || null,
        receipt: lastResult?.receipt || null,
      });

      return results;
    } catch (error: any) {
      const errorMessage = error?.message || 'Erro ao enviar transações';
      
      setState({
        isLoading: false,
        error: errorMessage,
        txHash: null,
        receipt: null,
      });

      throw error;
    }
  }, []);

  /**
   * Obtém o status de uma transação
   */
  const getTransactionStatus = useCallback(async (txHash: string) => {
    try {
      return await PrivyTransactionService.getTransactionStatus(txHash);
    } catch (error: any) {
      console.error('Erro ao obter status da transação:', error);
      return null;
    }
  }, []);

  /**
   * Obtém o saldo de um endereço
   */
  const getBalance = useCallback(async (address: string): Promise<string> => {
    try {
      return await PrivyTransactionService.getBalance(address);
    } catch (error: any) {
      console.error('Erro ao obter saldo:', error);
      return '0';
    }
  }, []);

  /**
   * Estima gas para uma transação
   */
  const estimateGas = useCallback(async (
    from: string,
    to: string,
    data: string,
    value: string = '0'
  ): Promise<bigint | null> => {
    try {
      return await PrivyTransactionService.estimateGas(from, to, data, value);
    } catch (error: any) {
      console.error('Erro ao estimar gas:', error);
      return null;
    }
  }, []);

  /**
   * Limpa estado da transação
   */
  const clearTransaction = useCallback(() => {
    setState({
      isLoading: false,
      error: null,
      txHash: null,
      receipt: null,
    });
  }, []);

  /**
   * Limpa apenas o erro
   */
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  return {
    ...state,
    sendTransaction,
    sendBatchTransactions,
    getTransactionStatus,
    getBalance,
    estimateGas,
    clearTransaction,
    clearError,
  };
}
