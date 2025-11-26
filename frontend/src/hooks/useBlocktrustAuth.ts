/**
 * @title Blocktrust Authentication Hook
 * @dev Hook customizado para gerenciar autenticação com wallet determinística + Privy
 * @author Blocktrust Team
 */

import { useState, useCallback } from 'react';
import { PrivyAuthService } from '../services/privy-auth.service';
import { ethers } from 'ethers';

export interface BlocktrustAuthState {
  wallet: ethers.Wallet | null;
  address: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export function useBlocktrustAuth() {
  const [state, setState] = useState<BlocktrustAuthState>({
    wallet: null,
    address: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,
  });

  /**
   * Autentica usuário com bioHash da verificação biométrica
   */
  const authenticateWithBioHash = useCallback(async (bioHash: string, userId: string) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const result = await PrivyAuthService.authenticateWithBiometrics(bioHash, userId);

      setState({
        wallet: result.wallet,
        address: result.address,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });

      return result;
    } catch (error: any) {
      const errorMessage = error?.message || 'Falha na autenticação';
      
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));

      throw error;
    }
  }, []);

  /**
   * Desconecta usuário e limpa wallet da memória
   */
  const disconnect = useCallback(() => {
    PrivyAuthService.logout();
    
    setState({
      wallet: null,
      address: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
  }, []);

  /**
   * Assina uma mensagem com a wallet atual
   */
  const signMessage = useCallback(async (message: string): Promise<string> => {
    if (!state.isAuthenticated) {
      throw new Error('Usuário não autenticado');
    }

    try {
      return await PrivyAuthService.signMessage(message);
    } catch (error: any) {
      const errorMessage = error?.message || 'Falha ao assinar mensagem';
      setState(prev => ({ ...prev, error: errorMessage }));
      throw error;
    }
  }, [state.isAuthenticated]);

  /**
   * Conecta a wallet determinística à Privy via SIWE
   */
  const connectToPrivy = useCallback(async (domain: string, chainId: number) => {
    if (!state.isAuthenticated) {
      throw new Error('Usuário não autenticado');
    }

    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      const result = await PrivyAuthService.connectToPrivy(domain, chainId);

      setState(prev => ({ ...prev, isLoading: false }));

      return result;
    } catch (error: any) {
      const errorMessage = error?.message || 'Falha ao conectar à Privy';
      setState(prev => ({ ...prev, isLoading: false, error: errorMessage }));
      throw error;
    }
  }, [state.isAuthenticated]);

  /**
   * Limpa erro
   */
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  return {
    ...state,
    authenticateWithBioHash,
    disconnect,
    signMessage,
    connectToPrivy,
    clearError,
  };
}
