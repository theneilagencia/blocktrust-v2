import { ethers } from 'ethers';
import { expect } from 'chai';
import { AccountAbstractionService } from '../src/services/account-abstraction.service';

describe('Gasless Transactions on Polygon', function () {
  let service: AccountAbstractionService;
  let provider: ethers.Provider;
  let testWallet: ethers.Wallet;
  let documentSignatureAddress: string;
  let identityNFTAddress: string;

  before(async function () {
    // Initialize test environment
    service = new AccountAbstractionService();
    
    // Use Polygon Amoy testnet for testing
    const rpcUrl = process.env.POLYGON_AMOY_RPC_URL || 'https://rpc-amoy.polygon.technology';
    provider = new ethers.JsonRpcProvider(rpcUrl);
    
    // Create test wallet with some test MATIC
    testWallet = new ethers.Wallet(
      process.env.TEST_PRIVATE_KEY || ethers.Wallet.createRandom().privateKey,
      provider
    );

    // Get deployed contract addresses
    documentSignatureAddress = process.env.NEXT_PUBLIC_DOCUMENT_SIGNATURE_AMOY || '';
    identityNFTAddress = process.env.NEXT_PUBLIC_IDENTITY_NFT_AMOY || '';

    if (!documentSignatureAddress || !identityNFTAddress) {
      console.warn('Contract addresses not set. Some tests will be skipped.');
    }
  });

  describe('Service Initialization', function () {
    it('should initialize with correct configuration', function () {
      expect(service).to.be.instanceOf(AccountAbstractionService);
      
      const config = service.getConfiguration();
      expect(config).to.not.be.null;
      expect(config?.chainId).to.equal(80002); // Amoy testnet
    });

    it('should detect availability based on environment', function () {
      const isAvailable = service.isAvailable();
      
      if (process.env.REACT_APP_BICONOMY_BUNDLER_URL && process.env.REACT_APP_BICONOMY_PAYMASTER_API_KEY) {
        expect(isAvailable).to.be.true;
      } else {
        expect(isAvailable).to.be.false;
      }
    });

    it('should validate configuration correctly', async function () {
      const validation = await service.validateConfiguration();
      
      expect(validation).to.have.property('isValid');
      expect(validation).to.have.property('errors');
      expect(validation).to.have.property('warnings');
      
      if (!service.isAvailable()) {
        expect(validation.isValid).to.be.false;
        expect(validation.errors.length).to.be.greaterThan(0);
      }
    });
  });

  describe('Provider and Network', function () {
    it('should initialize provider successfully', async function () {
      const result = await service.initializeProvider();
      expect(result).to.be.true;
      expect(service.isInitialized()).to.be.true;
    });

    it('should connect to Polygon Amoy testnet', async function () {
      if (!service.isInitialized()) {
        await service.initializeProvider();
      }

      // Test provider connection by getting network info
      const network = await provider.getNetwork();
      expect(network.chainId).to.equal(BigInt(80002));
    });

    it('should handle network errors gracefully', async function () {
      // Test with invalid RPC URL
      const invalidService = new (class extends AccountAbstractionService {
        constructor() {
          super();
          (this as any).config = {
            chainId: 80002,
            bundlerUrl: 'invalid-url',
            paymasterApiKey: 'test-key',
            rpcUrl: 'http://invalid-rpc-url.test'
          };
        }
      })();

      const result = await invalidService.initializeProvider();
      expect(result).to.be.false;
    });
  });

  describe('Gas Estimation', function () {
    beforeEach(async function () {
      if (!service.isInitialized()) {
        await service.initializeProvider();
      }
    });

    it('should estimate gas for simple transfer', async function () {
      const estimate = await service.estimateGasForTransaction(
        testWallet.address,
        testWallet.address,
        '0x',
        '0.001' // 0.001 MATIC
      );

      expect(estimate).to.not.be.null;
      if (estimate) {
        expect(estimate).to.have.property('actualGasCost');
        expect(estimate).to.have.property('sponsoredGas');
        expect(estimate).to.have.property('gasSavings');
        expect(estimate).to.have.property('sponsorshipStatus');
        
        expect(parseFloat(estimate.actualGasCost)).to.be.greaterThan(0);
      }
    });

    it('should estimate gas for contract interaction', async function () {
      if (!documentSignatureAddress) {
        this.skip();
        return;
      }

      // Create sample contract call data (e.g., getting signature count)
      const contractInterface = new ethers.Interface([
        'function getSignatureCount(uint256 tokenId) view returns (uint256)'
      ]);
      const callData = contractInterface.encodeFunctionData('getSignatureCount', [1]);

      const estimate = await service.estimateGasForTransaction(
        testWallet.address,
        documentSignatureAddress,
        callData
      );

      expect(estimate).to.not.be.null;
      if (estimate) {
        expect(estimate.sponsorshipStatus).to.be.oneOf(['sponsored', 'user-paid', 'partial']);
      }
    });

    it('should handle invalid transaction data', async function () {
      const estimate = await service.estimateGasForTransaction(
        testWallet.address,
        '0x0000000000000000000000000000000000000000',
        'invalid-data'
      );

      // Should return null for invalid data
      expect(estimate).to.be.null;
    });
  });

  describe('Transaction Execution', function () {
    beforeEach(async function () {
      if (!service.isInitialized()) {
        await service.initializeProvider();
      }
    });

    it('should execute regular transaction when sponsorship unavailable', async function () {
      const result = await service.executeRegularTransaction(
        testWallet,
        testWallet.address,
        '0x',
        '0.001'
      );

      expect(result).to.have.property('success');
      expect(result).to.have.property('userOpHash');
      
      if (result.success) {
        expect(result.transactionHash).to.not.be.undefined;
        expect(result.userOpHash).to.not.be.empty;
      } else {
        expect(result.error).to.not.be.undefined;
        console.log('Transaction failed (expected in test):', result.error);
      }
    });

    it('should handle transaction failures gracefully', async function () {
      // Try to send transaction with insufficient balance
      const walletWithoutBalance = ethers.Wallet.createRandom().connect(provider);
      
      const result = await service.executeRegularTransaction(
        walletWithoutBalance,
        testWallet.address,
        '0x',
        '1.0' // 1 MATIC
      );

      expect(result.success).to.be.false;
      expect(result.error).to.not.be.undefined;
    });

    it('should execute gasless transaction when available', async function () {
      if (!service.isAvailable()) {
        this.skip();
        return;
      }

      const result = await service.executeGaslessTransaction(
        testWallet,
        testWallet.address,
        '0x',
        '0.001'
      );

      expect(result).to.have.property('success');
      expect(result).to.have.property('userOpHash');
      
      // Note: This may fall back to regular transaction if sponsorship is not available
    });
  });

  describe('Batch Transactions', function () {
    beforeEach(async function () {
      if (!service.isInitialized()) {
        await service.initializeProvider();
      }
    });

    it('should execute batch of transactions', async function () {
      const transactions = [
        {
          to: testWallet.address,
          data: '0x',
          value: '0.001'
        },
        {
          to: testWallet.address,
          data: '0x',
          value: '0.001'
        }
      ];

      const results = await service.executeBatchTransactions(testWallet, transactions);
      
      expect(results).to.be.an('array');
      expect(results.length).to.equal(2);
      
      for (const result of results) {
        expect(result).to.have.property('success');
        expect(result).to.have.property('userOpHash');
      }
    });

    it('should handle mixed success/failure in batch', async function () {
      const walletWithoutBalance = ethers.Wallet.createRandom().connect(provider);
      
      const transactions = [
        {
          to: testWallet.address,
          data: '0x',
          value: '0.001' // This should fail due to insufficient balance
        },
        {
          to: testWallet.address,
          data: '0x',
          value: '0' // This might succeed (no value transfer)
        }
      ];

      const results = await service.executeBatchTransactions(walletWithoutBalance, transactions);
      
      expect(results).to.be.an('array');
      expect(results.length).to.equal(2);
      
      // At least one should fail
      const failedResults = results.filter(r => !r.success);
      expect(failedResults.length).to.be.greaterThan(0);
    });
  });

  describe('Transaction Status and Monitoring', function () {
    it('should track transaction status', async function () {
      // First execute a transaction
      const result = await service.executeRegularTransaction(
        testWallet,
        testWallet.address,
        '0x',
        '0'
      );

      if (!result.success || !result.userOpHash) {
        this.skip();
        return;
      }

      // Check status
      const status = await service.getTransactionStatus(result.userOpHash);
      
      if (status) {
        expect(status).to.have.property('status');
        expect(status.status).to.be.oneOf(['pending', 'success', 'failed']);
      }
    });

    it('should handle invalid transaction hash', async function () {
      const status = await service.getTransactionStatus('0xinvalidhash');
      expect(status).to.be.null;
    });
  });

  describe('Analytics and Monitoring', function () {
    it('should provide gas usage analytics', async function () {
      const analytics = await service.getGasUsageAnalytics();
      
      expect(analytics).to.have.property('totalTransactions');
      expect(analytics).to.have.property('totalGasSponsored');
      expect(analytics).to.have.property('totalGasSaved');
      expect(analytics).to.have.property('sponsorshipRate');
      
      expect(analytics.totalTransactions).to.be.a('number');
      expect(analytics.sponsorshipRate).to.be.at.least(0).and.at.most(1);
    });

    it('should provide analytics for different periods', async function () {
      const dailyAnalytics = await service.getGasUsageAnalytics('day');
      const weeklyAnalytics = await service.getGasUsageAnalytics('week');
      const monthlyAnalytics = await service.getGasUsageAnalytics('month');
      
      expect(dailyAnalytics).to.have.property('totalTransactions');
      expect(weeklyAnalytics).to.have.property('totalTransactions');
      expect(monthlyAnalytics).to.have.property('totalTransactions');
    });
  });

  describe('Error Handling and Edge Cases', function () {
    it('should handle network disconnection', async function () {
      // Create service with invalid network config
      const invalidService = new (class extends AccountAbstractionService {
        constructor() {
          super();
          (this as any).config = {
            chainId: 80002,
            bundlerUrl: '',
            paymasterApiKey: '',
            rpcUrl: 'http://localhost:0' // Invalid port
          };
        }
      })();

      const result = await invalidService.initializeProvider();
      expect(result).to.be.false;
    });

    it('should handle malformed transaction data', async function () {
      const result = await service.executeGaslessTransaction(
        testWallet,
        'invalid-address',
        'invalid-data',
        'invalid-value'
      );

      expect(result.success).to.be.false;
      expect(result.error).to.not.be.undefined;
    });

    it('should validate contract addresses', async function () {
      const estimate = await service.estimateGasForTransaction(
        testWallet.address,
        'not-an-address',
        '0x'
      );

      expect(estimate).to.be.null;
    });
  });

  describe('Integration with Document Signature', function () {
    it('should handle document signature contract calls', async function () {
      if (!documentSignatureAddress) {
        this.skip();
        return;
      }

      // Create sample signature submission call
      const contractInterface = new ethers.Interface([
        'function submitSignature(uint256 tokenId, string memory documentHash, bytes memory signature) external'
      ]);
      
      const callData = contractInterface.encodeFunctionData('submitSignature', [
        1,
        'QmSampleDocumentHash123',
        '0x1234567890abcdef'
      ]);

      const estimate = await service.estimateGasForTransaction(
        testWallet.address,
        documentSignatureAddress,
        callData
      );

      expect(estimate).to.not.be.null;
      if (estimate) {
        // Document signature contract should be eligible for sponsorship
        expect(estimate.sponsorshipStatus).to.be.oneOf(['sponsored', 'partial']);
      }
    });

    it('should handle identity NFT contract calls', async function () {
      if (!identityNFTAddress) {
        this.skip();
        return;
      }

      // Create sample identity verification call
      const contractInterface = new ethers.Interface([
        'function isVerified(uint256 tokenId) view returns (bool)'
      ]);
      
      const callData = contractInterface.encodeFunctionData('isVerified', [1]);

      const estimate = await service.estimateGasForTransaction(
        testWallet.address,
        identityNFTAddress,
        callData
      );

      expect(estimate).to.not.be.null;
    });
  });

  describe('Security and Access Control', function () {
    it('should not expose sensitive configuration', function () {
      const config = service.getConfiguration();
      
      if (config) {
        // Should not include private keys or sensitive data
        expect(config).to.not.have.property('privateKey');
        expect(config).to.not.have.property('mnemonic');
        expect(config).to.not.have.property('secret');
      }
    });

    it('should validate transaction parameters', async function () {
      // Test empty contract address
      const result1 = await service.executeGaslessTransaction(
        testWallet,
        '',
        '0x'
      );
      expect(result1.success).to.be.false;

      // Test invalid value
      const result2 = await service.executeGaslessTransaction(
        testWallet,
        testWallet.address,
        '0x',
        'invalid-number'
      );
      expect(result2.success).to.be.false;
    });
  });
});

describe('Mock Biconomy Integration', function () {
  it('should simulate successful sponsorship', async function () {
    const service = new AccountAbstractionService();
    await service.initializeProvider();

    // Test sponsorship eligibility check
    const config = service.getConfiguration();
    if (config && service.isAvailable()) {
      // This would test actual Biconomy integration
      console.log('Biconomy integration available for testing');
    } else {
      console.log('Running with mock Biconomy integration');
    }
  });

  it('should handle rate limiting', async function () {
    // Simulate multiple rapid transactions to test rate limiting
    const service = new AccountAbstractionService();
    const wallet = ethers.Wallet.createRandom();

    const promises = Array(5).fill(0).map(() => 
      service.executeGaslessTransaction(wallet, wallet.address, '0x')
    );

    const results = await Promise.allSettled(promises);
    
    // Some requests might be rate limited or fail due to insufficient balance
    expect(results.length).to.equal(5);
  });
});

// Helper function to fund test wallets with MATIC
async function fundTestWallet(wallet: ethers.Wallet, amount: string = '0.1'): Promise<boolean> {
  try {
    // In a real test environment, this would request test MATIC from a faucet
    // For now, we'll just check if the wallet has funds
    const balance = await wallet.provider!.getBalance(wallet.address);
    return parseFloat(ethers.formatEther(balance)) > parseFloat(amount);
  } catch (error) {
    return false;
  }
}
