/**
 * @title Privy Transaction Service
 * @dev Gerencia transações gasless usando Smart Accounts da Privy
 * @author Blocktrust Team
 */

import { ethers } from 'ethers';
import { PrivyAuthService } from './privy-auth.service';

export interface TransactionResult {
  hash: string;
  success: boolean;
  error?: string;
  receipt?: ethers.TransactionReceipt;
}

export interface TransactionData {
  to: string;
  data: string;
  value?: string;
}

export class PrivyTransactionService {
  private static provider: ethers.Provider | null = null;

  /**
   * Inicializa o provider
   */
  static async initializeProvider(): Promise<void> {
    const rpcUrl = import.meta.env.VITE_POLYGON_RPC_URL || 'https://polygon-rpc.com';
    this.provider = new ethers.JsonRpcProvider(rpcUrl);

    try {
      await this.provider.getBlockNumber();
      console.log('Provider inicializado com sucesso');
    } catch (error) {
      console.error('Erro ao inicializar provider:', error);
      throw new Error('Falha na inicialização do provider');
    }
  }

  /**
   * Obtém o provider (inicializa se necessário)
   */
  private static async getProvider(): Promise<ethers.Provider> {
    if (!this.provider) {
      await this.initializeProvider();
    }
    return this.provider!;
  }

  /**
   * Estima gas para uma transação
   * @param from - Endereço de origem
   * @param to - Endereço de destino
   * @param data - Dados da transação
   * @param value - Valor em wei
   * @returns Gas estimado
   */
  static async estimateGas(
    from: string,
    to: string,
    data: string,
    value: string = '0'
  ): Promise<bigint> {
    const provider = await this.getProvider();

    try {
      const estimatedGas = await provider.estimateGas({
        from,
        to,
        data,
        value: ethers.parseEther(value),
      });

      return estimatedGas;
    } catch (error) {
      console.error('Erro ao estimar gas:', error);
      throw new Error('Falha na estimativa de gas');
    }
  }

  /**
   * Envia uma transação usando a wallet determinística
   * @param to - Endereço de destino
   * @param data - Dados da transação
   * @param value - Valor em ether
   * @returns Resultado da transação
   */
  static async sendTransaction(
    to: string,
    data: string,
    value: string = '0'
  ): Promise<TransactionResult> {
    const wallet = PrivyAuthService.getCurrentWallet();
    if (!wallet) {
      return {
        hash: '',
        success: false,
        error: 'Nenhuma wallet autenticada',
      };
    }

    try {
      const provider = await this.getProvider();
      const connectedWallet = wallet.connect(provider);

      // Envia a transação
      const tx = await connectedWallet.sendTransaction({
        to,
        data,
        value: ethers.parseEther(value),
      });

      console.log('Transação enviada:', tx.hash);

      // Aguarda confirmação
      const receipt = await tx.wait();

      if (!receipt) {
        return {
          hash: tx.hash,
          success: false,
          error: 'Transação não confirmada',
        };
      }

      return {
        hash: tx.hash,
        success: receipt.status === 1,
        receipt,
      };
    } catch (error: any) {
      console.error('Erro ao enviar transação:', error);
      return {
        hash: '',
        success: false,
        error: error?.message || 'Erro desconhecido',
      };
    }
  }

  /**
   * Envia múltiplas transações em sequência
   * @param transactions - Array de transações
   * @returns Array de resultados
   */
  static async sendBatchTransactions(
    transactions: TransactionData[]
  ): Promise<TransactionResult[]> {
    const results: TransactionResult[] = [];

    for (const tx of transactions) {
      const result = await this.sendTransaction(tx.to, tx.data, tx.value);
      results.push(result);

      if (!result.success) {
        console.warn('Transação falhou:', result.error);
      }
    }

    return results;
  }

  /**
   * Obtém o status de uma transação
   * @param txHash - Hash da transação
   * @returns Status da transação
   */
  static async getTransactionStatus(txHash: string): Promise<{
    status: 'pending' | 'success' | 'failed';
    blockNumber?: number;
    confirmations?: number;
  } | null> {
    try {
      const provider = await this.getProvider();
      const receipt = await provider.getTransactionReceipt(txHash);

      if (!receipt) {
        return { status: 'pending' };
      }

      const currentBlock = await provider.getBlockNumber();
      const confirmations = currentBlock - receipt.blockNumber;

      return {
        status: receipt.status === 1 ? 'success' : 'failed',
        blockNumber: receipt.blockNumber,
        confirmations,
      };
    } catch (error) {
      console.error('Erro ao obter status da transação:', error);
      return null;
    }
  }

  /**
   * Obtém o saldo de uma carteira
   * @param address - Endereço da carteira
   * @returns Saldo em ether
   */
  static async getBalance(address: string): Promise<string> {
    try {
      const provider = await this.getProvider();
      const balance = await provider.getBalance(address);
      return ethers.formatEther(balance);
    } catch (error) {
      console.error('Erro ao obter saldo:', error);
      return '0';
    }
  }

  /**
   * Obtém o nonce atual de uma carteira
   * @param address - Endereço da carteira
   * @returns Nonce
   */
  static async getNonce(address: string): Promise<number> {
    try {
      const provider = await this.getProvider();
      return await provider.getTransactionCount(address);
    } catch (error) {
      console.error('Erro ao obter nonce:', error);
      return 0;
    }
  }

  /**
   * Verifica se um endereço é um contrato
   * @param address - Endereço a verificar
   * @returns True se for contrato
   */
  static async isContract(address: string): Promise<boolean> {
    try {
      const provider = await this.getProvider();
      const code = await provider.getCode(address);
      return code !== '0x';
    } catch (error) {
      console.error('Erro ao verificar contrato:', error);
      return false;
    }
  }
}
