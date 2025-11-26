/**
 * MFA API Service Tests
 * 
 * Tests for Multi-Factor Authentication functionality:
 * - Setup MFA flow
 * - TOTP verification
 * - Backup codes handling
 * - Login with MFA
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import axios from 'axios';
import { mfaApi } from '../src/services/mfa.service';

// Mock axios
vi.mock('axios');
const mockedAxios = vi.mocked(axios);

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn()
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

describe('MFA API Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue('mock-token');
  });

  describe('setupMFA', () => {
    it('should successfully setup MFA and return QR code and backup codes', async () => {
      const mockResponse = {
        data: {
          success: true,
          secret: 'JBSWY3DPEHPK3PXP',
          qr_code: 'base64-encoded-qr-code',
          backup_codes: ['1234-5678', '8765-4321'],
          message: 'MFA setup successful'
        }
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      const result = await mfaApi.setupMFA();

      expect(result).toEqual(mockResponse.data);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'http://localhost:5000/api/mfa/setup',
        {},
        {
          headers: {
            'Authorization': 'Bearer mock-token',
            'Content-Type': 'application/json',
          }
        }
      );
    });

    it('should throw error if setup fails', async () => {
      const errorResponse = {
        response: {
          data: {
            error: 'MFA setup failed'
          }
        }
      };

      mockedAxios.post.mockRejectedValue(errorResponse);

      await expect(mfaApi.setupMFA()).rejects.toThrow('MFA setup failed');
    });
  });

  describe('verifySetup', () => {
    it('should successfully verify setup with correct token', async () => {
      const mockResponse = {
        data: {
          success: true,
          message: 'MFA enabled successfully'
        }
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      const result = await mfaApi.verifySetup(
        'JBSWY3DPEHPK3PXP',
        '123456',
        ['1234-5678', '8765-4321']
      );

      expect(result).toEqual(mockResponse.data);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'http://localhost:5000/api/mfa/verify-setup',
        {
          secret: 'JBSWY3DPEHPK3PXP',
          token: '123456',
          backup_codes: ['1234-5678', '8765-4321']
        },
        {
          headers: {
            'Authorization': 'Bearer mock-token',
            'Content-Type': 'application/json',
          }
        }
      );
    });

    it('should throw error for invalid token', async () => {
      const errorResponse = {
        response: {
          data: {
            error: 'Invalid verification code'
          }
        }
      };

      mockedAxios.post.mockRejectedValue(errorResponse);

      await expect(mfaApi.verifySetup(
        'JBSWY3DPEHPK3PXP',
        '000000',
        ['1234-5678']
      )).rejects.toThrow('Invalid verification code');
    });
  });

  describe('verifyMFA', () => {
    it('should successfully verify TOTP token', async () => {
      const mockResponse = {
        data: {
          success: true,
          method: 'totp',
          message: 'MFA verification successful'
        }
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      const result = await mfaApi.verifyMFA('123456');

      expect(result).toEqual(mockResponse.data);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'http://localhost:5000/api/mfa/verify',
        { token: '123456' },
        {
          headers: {
            'Authorization': 'Bearer mock-token',
            'Content-Type': 'application/json',
          }
        }
      );
    });

    it('should successfully verify backup code', async () => {
      const mockResponse = {
        data: {
          success: true,
          method: 'backup_code',
          message: 'MFA verification successful'
        }
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      const result = await mfaApi.verifyMFA('1234-5678');

      expect(result.method).toBe('backup_code');
    });
  });

  describe('loginWithMFA', () => {
    it('should login successfully without MFA required', async () => {
      const mockResponse = {
        data: {
          message: 'Login successful',
          token: 'jwt-token',
          user: {
            id: 1,
            email: 'test@example.com',
            role: 'user'
          }
        }
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      const result = await mfaApi.loginWithMFA(
        'test@example.com',
        'password123'
      );

      expect(result).toEqual(mockResponse.data);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'http://localhost:5000/api/auth/login',
        {
          email: 'test@example.com',
          password: 'password123',
          mfa_token: undefined
        }
      );
    });

    it('should return mfa_required for users with MFA enabled', async () => {
      const mockResponse = {
        data: {
          mfa_required: true,
          message: 'MFA verification required',
          partial_token: 'partial-jwt-token'
        }
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      const result = await mfaApi.loginWithMFA(
        'test@example.com',
        'password123'
      );

      expect(result.mfa_required).toBe(true);
    });

    it('should complete login with MFA token', async () => {
      const mockResponse = {
        data: {
          message: 'Login successful',
          token: 'full-jwt-token',
          user: {
            id: 1,
            email: 'test@example.com',
            role: 'user'
          },
          mfa_method: 'totp'
        }
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      const result = await mfaApi.loginWithMFA(
        'test@example.com',
        'password123',
        '123456'
      );

      expect(result.mfa_method).toBe('totp');
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'http://localhost:5000/api/auth/login',
        {
          email: 'test@example.com',
          password: 'password123',
          mfa_token: '123456'
        }
      );
    });
  });

  describe('getMFAStatus', () => {
    it('should return MFA status for user', async () => {
      const mockResponse = {
        data: {
          success: true,
          mfa_enabled: true,
          backup_codes_count: 8
        }
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      const result = await mfaApi.getMFAStatus();

      expect(result).toEqual(mockResponse.data);
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'http://localhost:5000/api/mfa/status',
        {
          headers: {
            'Authorization': 'Bearer mock-token',
            'Content-Type': 'application/json',
          }
        }
      );
    });
  });

  describe('disableMFA', () => {
    it('should disable MFA successfully', async () => {
      const mockResponse = {
        data: {
          success: true,
          message: 'MFA disabled successfully'
        }
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      const result = await mfaApi.disableMFA('123456', 'password123');

      expect(result).toEqual(mockResponse.data);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'http://localhost:5000/api/mfa/disable',
        {
          token: '123456',
          password: 'password123'
        },
        {
          headers: {
            'Authorization': 'Bearer mock-token',
            'Content-Type': 'application/json',
          }
        }
      );
    });
  });

  describe('regenerateBackupCodes', () => {
    it('should regenerate backup codes successfully', async () => {
      const mockResponse = {
        data: {
          success: true,
          backup_codes: ['9876-5432', '5678-1234'],
          message: 'New backup codes generated'
        }
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      const result = await mfaApi.regenerateBackupCodes('123456');

      expect(result).toEqual(mockResponse.data);
      expect(result.backup_codes).toHaveLength(2);
    });
  });

  describe('utility methods', () => {
    it('should format secret for manual entry', () => {
      const secret = 'JBSWY3DPEHPK3PXP';
      const formatted = mfaApi.formatSecret(secret);
      expect(formatted).toBe('JBSW Y3DP EHPK 3PXP');
    });

    it('should create download link for backup codes', () => {
      // Mock DOM methods
      const mockElement = {
        click: vi.fn(),
        style: {},
        href: '',
        download: ''
      };
      
      document.createElement = vi.fn().mockReturnValue(mockElement);
      document.body.appendChild = vi.fn();
      document.body.removeChild = vi.fn();
      
      global.URL.createObjectURL = vi.fn().mockReturnValue('blob:url');
      global.URL.revokeObjectURL = vi.fn();

      const codes = ['1234-5678', '8765-4321'];
      mfaApi.downloadBackupCodes(codes, 'test@example.com');

      expect(document.createElement).toHaveBeenCalledWith('a');
      expect(mockElement.click).toHaveBeenCalled();
    });
  });
});

describe('MFA Integration Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue('mock-token');
  });

  it('should complete full MFA setup flow', async () => {
    // Step 1: Setup MFA
    const setupResponse = {
      data: {
        success: true,
        secret: 'JBSWY3DPEHPK3PXP',
        qr_code: 'base64-qr-code',
        backup_codes: ['1234-5678', '8765-4321'],
        message: 'MFA setup successful'
      }
    };

    // Step 2: Verify setup
    const verifyResponse = {
      data: {
        success: true,
        message: 'MFA enabled successfully'
      }
    };

    // Step 3: Check status
    const statusResponse = {
      data: {
        success: true,
        mfa_enabled: true,
        backup_codes_count: 2
      }
    };

    mockedAxios.post
      .mockResolvedValueOnce(setupResponse)  // setup
      .mockResolvedValueOnce(verifyResponse); // verify

    mockedAxios.get.mockResolvedValue(statusResponse); // status

    // Execute flow
    const setupResult = await mfaApi.setupMFA();
    expect(setupResult.success).toBe(true);

    const verifyResult = await mfaApi.verifySetup(
      setupResult.secret,
      '123456',
      setupResult.backup_codes
    );
    expect(verifyResult.success).toBe(true);

    const statusResult = await mfaApi.getMFAStatus();
    expect(statusResult.mfa_enabled).toBe(true);
  });

  it('should handle login flow with MFA', async () => {
    // Step 1: Login with password (MFA required)
    const loginResponse1 = {
      data: {
        mfa_required: true,
        message: 'MFA verification required',
        partial_token: 'partial-token'
      }
    };

    // Step 2: Login with MFA code
    const loginResponse2 = {
      data: {
        message: 'Login successful',
        token: 'full-token',
        user: { id: 1, email: 'test@example.com' },
        mfa_method: 'totp'
      }
    };

    mockedAxios.post
      .mockResolvedValueOnce(loginResponse1)
      .mockResolvedValueOnce(loginResponse2);

    // Execute flow
    const result1 = await mfaApi.loginWithMFA('test@example.com', 'password123');
    expect(result1.mfa_required).toBe(true);

    const result2 = await mfaApi.loginWithMFA(
      'test@example.com',
      'password123',
      '123456'
    );
    expect(result2.mfa_method).toBe('totp');
  });
});
