/**
 * @title Privy Authentication Service
 * @dev Integra wallet determinística do Blocktrust com infraestrutura da Privy
 * @author Blocktrust Team
 */

import { ethers } from 'ethers';
import { DeterministicWalletGenerator } from './wallet-generator';

export interface BlocktrustAuthResult {
  wallet: ethers.Wallet;
  address: string;
  bioHash: string;
}

export class PrivyAuthService {
  private static currentWallet: ethers.Wallet | null = null;
  private static currentBioHash: string | null = null;

  /**
   * Autentica usuário gerando wallet determinística a partir do bioHash
   * @param bioHash - Hash biométrico do Sumsub
   * @param identifier - Identificador para rate limiting
   * @returns Wallet e informações de autenticação
   */
  static async authenticateWithBiometrics(
    bioHash: string,
    identifier: string = 'default'
  ): Promise<BlocktrustAuthResult> {
    try {
      // Gera wallet determinística
      const wallet = DeterministicWalletGenerator.generateWallet(
        bioHash,
        {
          salt: import.meta.env.VITE_WALLET_SALT || 'blocktrust-mainnet',
          iterations: parseInt(import.meta.env.VITE_WALLET_ITERATIONS || '250000'),
          keyLength: 32,
        },
        identifier
      );

      // Armazena em memória (nunca em localStorage ou storage persistente)
      this.currentWallet = wallet;
      this.currentBioHash = bioHash;

      return {
        wallet,
        address: wallet.address,
        bioHash,
      };
    } catch (error) {
      console.error('Erro na autenticação biométrica:', error);
      throw new Error(
        'Falha na autenticação: ' + (error instanceof Error ? error.message : 'Erro desconhecido')
      );
    }
  }

  /**
   * Obtém a wallet atual em memória
   * @returns Wallet atual ou null se não autenticado
   */
  static getCurrentWallet(): ethers.Wallet | null {
    return this.currentWallet;
  }

  /**
   * Obtém o bioHash atual
   * @returns BioHash atual ou null
   */
  static getCurrentBioHash(): string | null {
    return this.currentBioHash;
  }

  /**
   * Verifica se há uma wallet autenticada
   * @returns True se autenticado
   */
  static isAuthenticated(): boolean {
    return this.currentWallet !== null;
  }

  /**
   * Limpa a sessão (remove wallet da memória)
   */
  static logout(): void {
    this.currentWallet = null;
    this.currentBioHash = null;
  }

  /**
   * Assina uma mensagem com a wallet determinística
   * @param message - Mensagem a ser assinada
   * @returns Assinatura
   */
  static async signMessage(message: string): Promise<string> {
    if (!this.currentWallet) {
      throw new Error('Nenhuma wallet autenticada');
    }

    try {
      return await this.currentWallet.signMessage(message);
    } catch (error) {
      console.error('Erro ao assinar mensagem:', error);
      throw new Error('Falha na assinatura: ' + (error instanceof Error ? error.message : 'Erro desconhecido'));
    }
  }

  /**
   * Gera mensagem SIWE (Sign-In with Ethereum) para conectar à Privy
   * @param domain - Domínio da aplicação
   * @param chainId - ID da chain
   * @returns Mensagem SIWE formatada
   */
  static generateSiweMessage(domain: string, chainId: number): string {
    if (!this.currentWallet) {
      throw new Error('Nenhuma wallet autenticada');
    }

    const address = this.currentWallet.address;
    const issuedAt = new Date().toISOString();
    const nonce = Math.random().toString(36).substring(2);

    return `${domain} wants you to sign in with your Ethereum account:
${address}

Blocktrust Identity Verification

URI: https://${domain}
Version: 1
Chain ID: ${chainId}
Nonce: ${nonce}
Issued At: ${issuedAt}`;
  }

  /**
   * Conecta a wallet determinística à Privy via SIWE
   * @param domain - Domínio da aplicação
   * @param chainId - ID da chain
   * @returns Mensagem e assinatura SIWE
   */
  static async connectToPrivy(
    domain: string,
    chainId: number
  ): Promise<{ message: string; signature: string; address: string }> {
    if (!this.currentWallet) {
      throw new Error('Nenhuma wallet autenticada');
    }

    try {
      const message = this.generateSiweMessage(domain, chainId);
      const signature = await this.signMessage(message);

      return {
        message,
        signature,
        address: this.currentWallet.address,
      };
    } catch (error) {
      console.error('Erro ao conectar à Privy:', error);
      throw new Error('Falha na conexão: ' + (error instanceof Error ? error.message : 'Erro desconhecido'));
    }
  }

  /**
   * Valida se a wallet atual corresponde ao endereço esperado
   * @param expectedAddress - Endereço esperado
   * @returns True se corresponde
   */
  static validateCurrentWallet(expectedAddress: string): boolean {
    if (!this.currentWallet) {
      return false;
    }

    return this.currentWallet.address.toLowerCase() === expectedAddress.toLowerCase();
  }
}
