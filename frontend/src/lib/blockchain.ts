/**
 * Utilitários para interação com blockchain
 */
import { ethers } from 'ethers'

export type HashMode = 'sha256' | 'keccak256'

/**
 * Normaliza um hash hexadecimal para bytes32 (0x + 64 caracteres hex)
 * @param input - Hash hexadecimal (com ou sem prefixo 0x)
 * @returns Hash normalizado no formato bytes32
 * @throws Error se o input não for um hash válido
 */
export function normalizeBytes32FromHexNoPrefix(input: string): string {
  // Remover prefixo 0x se existir
  let cleanHex = input.trim().toLowerCase()
  if (cleanHex.startsWith('0x')) {
    cleanHex = cleanHex.slice(2)
  }

  // Validar que contém apenas caracteres hexadecimais
  if (!/^[0-9a-f]{64}$/.test(cleanHex)) {
    throw new Error(
      `Hash inválido: esperado 64 caracteres hexadecimais, recebido ${cleanHex.length} caracteres. ` +
      `Certifique-se de que o hash está no formato correto (SHA-256 ou Keccak-256).`
    )
  }

  // Retornar com prefixo 0x
  return `0x${cleanHex}`
}

/**
 * Calcula o hash Keccak-256 de um arquivo
 * @param file - Arquivo para calcular o hash
 * @returns Hash Keccak-256 no formato bytes32 (0x + 64 hex)
 */
export async function computeKeccakFromFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (event) => {
      try {
        const arrayBuffer = event.target?.result as ArrayBuffer
        const uint8Array = new Uint8Array(arrayBuffer)
        const hash = ethers.keccak256(uint8Array)
        resolve(hash)
      } catch (error) {
        reject(new Error(`Erro ao calcular Keccak-256: ${error}`))
      }
    }

    reader.onerror = () => {
      reject(new Error('Erro ao ler o arquivo'))
    }

    reader.readAsArrayBuffer(file)
  })
}

/**
 * Garante que a carteira está conectada à rede Polygon (chainId 137)
 * @throws Error se não for possível trocar de rede
 */
export async function ensurePolygonNetwork(): Promise<void> {
  if (!window.ethereum) {
    throw new Error('MetaMask não detectado. Por favor, instale a extensão MetaMask.')
  }

  const provider = new ethers.BrowserProvider(window.ethereum)
  const network = await provider.getNetwork()
  const currentChainId = Number(network.chainId)

  // Polygon Mainnet chainId = 137
  const POLYGON_CHAIN_ID = 137
  const POLYGON_CHAIN_ID_HEX = '0x89'

  if (currentChainId === POLYGON_CHAIN_ID) {
    console.log('✅ Já conectado à rede Polygon')
    return
  }

  console.log(`⚠️ Rede atual: ${currentChainId}, trocando para Polygon (${POLYGON_CHAIN_ID})...`)

  try {
    // Tentar trocar para Polygon
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: POLYGON_CHAIN_ID_HEX }],
    })

    console.log('✅ Rede trocada para Polygon com sucesso')
  } catch (switchError: any) {
    // Se a rede não estiver adicionada, tentar adicionar
    if (switchError.code === 4902) {
      try {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [
            {
              chainId: POLYGON_CHAIN_ID_HEX,
              chainName: 'Polygon Mainnet',
              nativeCurrency: {
                name: 'MATIC',
                symbol: 'MATIC',
                decimals: 18,
              },
              rpcUrls: ['https://polygon-rpc.com/'],
              blockExplorerUrls: ['https://polygonscan.com/'],
            },
          ],
        })

        console.log('✅ Rede Polygon adicionada e selecionada com sucesso')
      } catch (addError) {
        throw new Error(
          'Não foi possível adicionar a rede Polygon. Por favor, adicione manualmente no MetaMask.'
        )
      }
    } else {
      throw new Error(
        `Erro ao trocar para a rede Polygon: ${switchError.message || switchError}. ` +
        `Por favor, troque manualmente para Polygon (chainId 137) no MetaMask e tente novamente.`
      )
    }
  }
}

/**
 * Executa uma função com retry e backoff exponencial
 * @param fn - Função a ser executada
 * @param maxRetries - Número máximo de tentativas (padrão: 3)
 * @param initialDelay - Delay inicial em ms (padrão: 2000)
 * @returns Resultado da função
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 2000
): Promise<T> {
  let lastError: any

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔄 Tentativa ${attempt}/${maxRetries}`)
      return await fn()
    } catch (error: any) {
      lastError = error
      
      if (attempt < maxRetries) {
        const delay = initialDelay * Math.pow(2, attempt - 1)
        console.log(`⚠️ Tentativa ${attempt} falhou, aguardando ${delay}ms antes de tentar novamente...`)
        console.error('Erro:', error)
        
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }

  throw lastError
}

/**
 * Extrai mensagem de erro detalhada de um erro de transação
 * @param error - Erro capturado
 * @returns Mensagem de erro formatada
 */
export function extractErrorMessage(error: any): string {
  // Tentar extrair a mensagem mais específica possível
  if (error.reason) {
    return `Erro: ${error.reason}`
  }

  if (error.shortMessage) {
    return `Erro: ${error.shortMessage}`
  }

  if (error.data) {
    // Tentar decodificar error.data se for um objeto
    if (typeof error.data === 'object' && error.data.message) {
      return `Erro: ${error.data.message}`
    }
    return `Erro: ${JSON.stringify(error.data)}`
  }

  if (error.code) {
    const codeMessages: Record<string, string> = {
      'ACTION_REJECTED': 'Transação rejeitada pelo usuário',
      'INSUFFICIENT_FUNDS': 'Saldo insuficiente para pagar a taxa de gas',
      'UNPREDICTABLE_GAS_LIMIT': 'Não foi possível estimar o gas. Verifique os parâmetros da transação.',
      'NETWORK_ERROR': 'Erro de rede. Verifique sua conexão.',
      'TIMEOUT': 'Timeout na transação. Tente novamente.',
    }

    const message = codeMessages[error.code] || `Código de erro: ${error.code}`
    return `${message}${error.message ? ` - ${error.message}` : ''}`
  }

  if (error.message) {
    return `Erro: ${error.message}`
  }

  return 'Erro desconhecido ao processar a transação'
}

/**
 * Registra log estruturado de transação
 * @param data - Dados do log
 */
export function logTransaction(data: {
  timestamp: string
  chainId: number
  contractAddress?: string
  method: string
  hashMode: HashMode
  docHash: string
  txHash?: string
  status: 'pending' | 'success' | 'error'
  error?: string
}) {
  const logEntry = {
    ...data,
    timestamp: new Date().toISOString(),
  }

  console.log('📝 Transaction Log:', JSON.stringify(logEntry, null, 2))

  // Aqui você pode adicionar integração com serviços de logging externos
  // como Sentry, LogRocket, etc.
}

// Declaração de tipos para window.ethereum
declare global {
  interface Window {
    ethereum?: any
  }
}

