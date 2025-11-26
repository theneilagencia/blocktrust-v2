/**
 * Testes automatizados para utilitários de blockchain
 */
import { describe, it, expect, beforeEach } from 'vitest'
import {
  normalizeBytes32FromHexNoPrefix,
  extractErrorMessage,
} from '../src/lib/blockchain'

describe('normalizeBytes32FromHexNoPrefix', () => {
  it('deve normalizar hash sem prefixo 0x', () => {
    const input = 'a94a8fe5ccb19ba61c4c0873d391e987982fbbd3e4f4b8b5d0a8e1b2c3d4e5f6'
    const expected = '0xa94a8fe5ccb19ba61c4c0873d391e987982fbbd3e4f4b8b5d0a8e1b2c3d4e5f6'
    
    const result = normalizeBytes32FromHexNoPrefix(input)
    expect(result).toBe(expected)
  })

  it('deve manter hash que já tem prefixo 0x', () => {
    const input = '0xa94a8fe5ccb19ba61c4c0873d391e987982fbbd3e4f4b8b5d0a8e1b2c3d4e5f6'
    const expected = '0xa94a8fe5ccb19ba61c4c0873d391e987982fbbd3e4f4b8b5d0a8e1b2c3d4e5f6'
    
    const result = normalizeBytes32FromHexNoPrefix(input)
    expect(result).toBe(expected)
  })

  it('deve converter para lowercase', () => {
    const input = 'A94A8FE5CCB19BA61C4C0873D391E987982FBBD3E4F4B8B5D0A8E1B2C3D4E5F6'
    const expected = '0xa94a8fe5ccb19ba61c4c0873d391e987982fbbd3e4f4b8b5d0a8e1b2c3d4e5f6'
    
    const result = normalizeBytes32FromHexNoPrefix(input)
    expect(result).toBe(expected)
  })

  it('deve remover espaços em branco', () => {
    const input = '  a94a8fe5ccb19ba61c4c0873d391e987982fbbd3e4f4b8b5d0a8e1b2c3d4e5f6  '
    const expected = '0xa94a8fe5ccb19ba61c4c0873d391e987982fbbd3e4f4b8b5d0a8e1b2c3d4e5f6'
    
    const result = normalizeBytes32FromHexNoPrefix(input)
    expect(result).toBe(expected)
  })

  it('deve lançar erro para hash muito curto', () => {
    const input = 'a94a8fe5ccb19ba61c4c0873d391e987982fbbd3e4f4b8b5d0a8e1b2c3d4e5'
    
    expect(() => normalizeBytes32FromHexNoPrefix(input)).toThrow('Hash inválido')
    expect(() => normalizeBytes32FromHexNoPrefix(input)).toThrow('esperado 64 caracteres')
  })

  it('deve lançar erro para hash muito longo', () => {
    const input = 'a94a8fe5ccb19ba61c4c0873d391e987982fbbd3e4f4b8b5d0a8e1b2c3d4e5f6aa'
    
    expect(() => normalizeBytes32FromHexNoPrefix(input)).toThrow('Hash inválido')
  })

  it('deve lançar erro para caracteres não hexadecimais', () => {
    const input = 'g94a8fe5ccb19ba61c4c0873d391e987982fbbd3e4f4b8b5d0a8e1b2c3d4e5f6'
    
    expect(() => normalizeBytes32FromHexNoPrefix(input)).toThrow('Hash inválido')
  })

  it('deve lançar erro para string vazia', () => {
    const input = ''
    
    expect(() => normalizeBytes32FromHexNoPrefix(input)).toThrow('Hash inválido')
  })
})

describe('extractErrorMessage', () => {
  it('deve extrair error.reason', () => {
    const error = {
      reason: 'Transaction reverted: insufficient funds'
    }
    
    const result = extractErrorMessage(error)
    expect(result).toContain('insufficient funds')
  })

  it('deve extrair error.shortMessage', () => {
    const error = {
      shortMessage: 'User rejected the request'
    }
    
    const result = extractErrorMessage(error)
    expect(result).toContain('User rejected')
  })

  it('deve extrair error.data.message', () => {
    const error = {
      data: {
        message: 'Execution reverted'
      }
    }
    
    const result = extractErrorMessage(error)
    expect(result).toContain('Execution reverted')
  })

  it('deve mapear código ACTION_REJECTED', () => {
    const error = {
      code: 'ACTION_REJECTED',
      message: 'User rejected transaction'
    }
    
    const result = extractErrorMessage(error)
    expect(result).toContain('rejeitada pelo usuário')
  })

  it('deve mapear código INSUFFICIENT_FUNDS', () => {
    const error = {
      code: 'INSUFFICIENT_FUNDS'
    }
    
    const result = extractErrorMessage(error)
    expect(result).toContain('Saldo insuficiente')
  })

  it('deve mapear código UNPREDICTABLE_GAS_LIMIT', () => {
    const error = {
      code: 'UNPREDICTABLE_GAS_LIMIT'
    }
    
    const result = extractErrorMessage(error)
    expect(result).toContain('estimar o gas')
  })

  it('deve extrair error.message como fallback', () => {
    const error = {
      message: 'Network error occurred'
    }
    
    const result = extractErrorMessage(error)
    expect(result).toContain('Network error')
  })

  it('deve retornar mensagem padrão para erro desconhecido', () => {
    const error = {}
    
    const result = extractErrorMessage(error)
    expect(result).toContain('Erro desconhecido')
  })

  it('deve lidar com erro de string', () => {
    const error = 'Simple error string'
    
    const result = extractErrorMessage(error)
    expect(result).toBeDefined()
  })
})

describe('Validações de Hash', () => {
  const validHashes = [
    '0x' + '0'.repeat(64),
    '0x' + 'a'.repeat(64),
    '0x' + 'f'.repeat(64),
    '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
  ]

  validHashes.forEach((hash) => {
    it(`deve aceitar hash válido: ${hash.substring(0, 20)}...`, () => {
      expect(() => normalizeBytes32FromHexNoPrefix(hash)).not.toThrow()
    })
  })

  const invalidHashes = [
    '0x' + '0'.repeat(63), // muito curto
    '0x' + '0'.repeat(65), // muito longo
    '0x' + 'g'.repeat(64), // caractere inválido
    'not a hash at all',
    '12345',
    '',
  ]

  invalidHashes.forEach((hash) => {
    it(`deve rejeitar hash inválido: ${hash.substring(0, 20)}...`, () => {
      expect(() => normalizeBytes32FromHexNoPrefix(hash)).toThrow()
    })
  })
})

