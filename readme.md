# BTS Blocktrust

Self-custodial identity system using biometric authentication and deterministic wallet generation with soulbound NFTs on Polygon blockchain. Now featuring **Account Abstraction (ERC-4337)** with gasless transactions powered by Biconomy.

## Features

### Core Identity System
- **Self-custodial wallet generation** from biometric data using deterministic algorithms
- **No private key storage** - wallets recreated from bioHash using PBKDF2 key derivation
- **Soulbound Identity NFTs** - Non-transferable tokens linked to biometric identity
- **Biometric verification** with Sumsub SDK integration for secure identity capture
- **Emergency recovery system** for wallet regeneration while maintaining identity continuity

### Document Signature Platform
- **Decentralized document signatures** on Polygon blockchain with IPFS storage
- **Document creation and management** with cryptographic integrity verification
- **Multi-signature support** with identity validation through IdentityNFT
- **Document versioning** and update tracking with complete audit trail
- **Signature verification** with cryptographic proofs and timestamp validation

### Account Abstraction & Gasless Transactions ⚡
- **ERC-4337 Account Abstraction** implementation using Biconomy infrastructure
- **Gasless transactions** - Users don't need MATIC to interact with the platform
- **Smart contract sponsorship** - Platform sponsors transactions for document operations
- **Batch transactions** - Multiple operations in a single gasless transaction
- **Automatic fallback** to regular transactions when sponsorship unavailable
- **Gas usage analytics** and sponsorship monitoring

### Multi-Factor Authentication (MFA/2FA) 🔐
- **TOTP-based 2FA** compatible with Google Authenticator, Authy, and Microsoft Authenticator
- **QR Code setup** with manual entry fallback for easy configuration
- **Backup codes** for account recovery when authenticator is unavailable
- **Two-step login** process with enhanced security for account access
- **Secure secret storage** with encrypted TOTP keys and hashed backup codes
- **Admin controls** for MFA management and emergency account recovery

### Security & Performance
- **Real blockchain interaction** with comprehensive smart contract integration
- **Automated testing suite** with 70%+ coverage for all critical components
- **Enhanced security validation** including entropy checking and input sanitization
- **Rate limiting system** protecting against brute force attacks
- **Complete audit trail** with suspicious activity detection
- **Advanced storage security** with encrypted local storage

## Technologies

### Frontend
- React 18 + TypeScript with modern Vite build system
- Tailwind CSS for responsive design
- Ethers.js v6 for blockchain interaction
- Sumsub WebSDK for biometric capture
- CryptoJS for deterministic wallet generation
- Jest testing framework with comprehensive mocks

### Backend
- Flask (Python) REST API with JWT authentication
- PostgreSQL database with SQLAlchemy ORM
- Web3.py for real blockchain contract interaction
- Sumsub SDK integration for KYC processing
- Automated testing with pytest

### Smart Contracts
- **IdentityNFT**: Soulbound tokens with biometric linking
- **ProofRegistry**: Document verification system
- **FailSafe**: Emergency recovery mechanisms
- Access control with role-based permissions
- OpenZeppelin v5 security standards
- Comprehensive Hardhat testing suite

## Architecture

### Self-Custodial Identity System

The core innovation combines biometric authentication with deterministic cryptography:

1. **Biometric Capture**: Secure capture using Sumsub's verified SDK
2. **BioHash Generation**: Unique hash derived from biometric data
3. **Deterministic Wallet**: PBKDF2-based key derivation from bioHash
4. **Soulbound NFT**: Non-transferable identity token minted to wallet
5. **Recovery System**: Emergency wallet regeneration with identity continuity

### Security Architecture

- **No Key Storage**: Private keys exist only in memory during operations
- **Biometric Privacy**: Biometric data processed locally, never transmitted
- **Entropy Validation**: BioHash quality verification before wallet generation
- **Soulbound Design**: NFTs cannot be transferred, ensuring identity integrity
- **Role-based Access**: Smart contract permissions for minting and administration

## Installation

### Prerequisites

- Node.js 18+
- Python 3.11+
- PostgreSQL database

### 1. Clone the repository

```bash
git clone https://github.com/BTS-Global/bts-blocktrust.git
cd bts-blocktrust
```

### 2. Environment Setup

Copy the environment templates and configure with your credentials:

```bash
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Required environment variables:

**Frontend (.env):**
```bash
VITE_SUMSUB_APP_TOKEN=your-sumsub-app-token
VITE_IDENTITY_NFT_ADDRESS=0x...
VITE_RPC_URL=https://polygon-amoy.g.alchemy.com/v2/your-api-key
```

**Backend (.env):**
```bash
DATABASE_URL=postgresql://user:password@host:port/database
JWT_SECRET=your-jwt-secret-key
SUMSUB_APP_TOKEN=your-sumsub-app-token
SUMSUB_SECRET_KEY=your-sumsub-secret-key
WEB3_PROVIDER_URL=https://polygon-amoy.g.alchemy.com/v2/your-api-key
IDENTITY_NFT_ADDRESS=0x...
MINTER_PRIVATE_KEY=0x...
```

### 3. Install Dependencies

**Backend:**
```bash
cd backend
pip install -r requirements.txt
```

**Frontend:**
```bash
cd frontend
npm install
```

### 4. Database Setup

Run database migrations:

```bash
cd backend
python apply_migrations.py
```

### 5. Smart Contracts Deployment

Deploy the smart contracts:

```bash
cd contracts
python deploy.py
```

### 6. Configure Minter Account

Generate and configure a minter account:

```bash
python scripts/generate_minter_account.py
python scripts/grant_minter_role.py
```

### 7. Development Server

**Backend:**
```bash
cd backend
python app.py
```

**Frontend:**
```bash
cd frontend
npm run dev
```

Access the application at <http://localhost:5173>

### 8. Configure Multi-Factor Authentication (Optional but Recommended)

MFA provides an additional security layer for user accounts:

```bash
# Backend MFA configuration
MFA_ENCRYPTION_KEY=your-32-character-encryption-key-here
MFA_APP_NAME=Blocktrust

# Enable MFA in production
ENABLE_MFA=true
```

**MFA Features:**
- Compatible with Google Authenticator, Authy, Microsoft Authenticator
- QR Code setup with manual entry fallback
- 8 backup codes for emergency access
- Secure TOTP secret encryption

## Quick Start with Gasless Transactions

### 1. Environment Setup

Copy the environment configuration:

```bash
cp .env.polygon .env
```

Configure Biconomy for gasless transactions:

```bash
# Required for Account Abstraction
REACT_APP_BICONOMY_API_KEY=your_biconomy_api_key
REACT_APP_BICONOMY_PAYMASTER_API_KEY=your_paymaster_api_key
REACT_APP_ENABLE_GASLESS_TRANSACTIONS=true
```

### 2. Test Gasless Functionality

```bash
# Test gasless transactions
npm run test:gasless

# Validate Biconomy configuration
npm run validate:gasless
```

### 3. Deploy with Gasless Support

```bash
# Deploy to Amoy testnet
npm run deploy:testnet

# Deploy to Polygon mainnet
npm run deploy:mainnet
```

## Architecture

### Account Abstraction (ERC-4337) Flow

```
User Request → React App → Biconomy SDK → Smart Account → Bundler → Polygon Network
     ↓              ↓            ↓             ↓          ↓            ↓
 No MATIC     Gas Estimate   UserOperation   Paymaster   Gas Free   Transaction
```

1. **User Interaction**: User performs action (sign document, create document)
2. **Gasless Detection**: System checks if action qualifies for sponsorship
3. **Smart Account**: Creates UserOperation instead of regular transaction
4. **Paymaster**: Biconomy paymaster sponsors the gas fees
5. **Bundler**: Submits transaction to Polygon network
6. **Result**: User gets confirmation without paying gas

### Self-Custodial Wallet System

The core innovation of Blocktrust is the deterministic wallet generation system:

1. **Biometric Capture**: User's biometric data is captured using Sumsub SDK
2. **BioHash Generation**: Biometric data is converted to a unique hash
3. **Deterministic Wallet**: Wallet is generated from bioHash using PBKDF2
4. **Identity NFT**: NFT is minted to the deterministic wallet address
5. **Recovery**: Wallet can be recreated anytime using the same biometric data

### Security Features

- **No Private Key Storage**: Private keys are never stored, only regenerated
- **Biometric Authentication**: Uses unique biometric patterns for wallet access
- **Entropy Validation**: BioHash quality is validated for security
- **PBKDF2 Key Derivation**: Additional computational security layer
- **Deterministic Generation**: Same bioHash always produces same wallet

## Project Structure

```text
bts-blocktrust/
├── frontend/              # React TypeScript frontend
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── services/      # Wallet generation, storage
│   │   └── types/         # TypeScript definitions
│   ├── public/           # Static assets
│   └── package.json      # Frontend dependencies
├── backend/              # Flask Python backend
│   ├── api/
│   │   ├── routes/       # API endpoints
│   │   ├── utils/        # Database, blockchain utilities
│   │   └── middleware/   # Authentication middleware
│   ├── migrations/       # Database migrations
│   └── requirements.txt  # Python dependencies
├── contracts/            # Smart contracts
│   ├── IdentityNFT.sol  # Main identity contract
│   ├── ProofRegistry.sol # Document registry
│   └── deploy.py         # Deployment scripts
├── scripts/              # Utility scripts
│   ├── generate_minter_account.py
│   └── grant_minter_role.py
├── tests/                # Integration tests
├── docs/                 # Documentation
└── qa/                   # Quality assurance scripts
```

## Smart Contract Functions

### IdentityNFT Core Functions

**Identity Management:**
- `mintIdentity(address, string, string, bytes32, string)` - Mint soulbound identity NFT
- `getActiveTokenByBioHash(bytes32)` - Retrieve active token by biometric hash
- `validateWalletForBioHash(address, bytes32)` - Validate wallet ownership
- `emergencyRecovery(bytes32, address)` - Emergency wallet recovery with identity continuity

**Identity History & Auditing:**
- `getTokenHistory(bytes32)` - Retrieve complete history of tokens for bioHash
- `getFullHistory(bytes32)` - Get detailed identity data for all tokens in history
- `getRevocationCount(bytes32)` - Count number of revocations for identity
- `isSuspiciousActivity(bytes32)` - Detect suspicious patterns in identity history

**Security Features:**
- Soulbound token design (non-transferable)
- Role-based access control (MINTER_ROLE, KYC_PROVIDER_ROLE)
- Biometric hash uniqueness enforcement
- Emergency recovery for lost wallets

### API Endpoints

**Authentication:**
- `POST /auth/login` - JWT-based user authentication
- `POST /auth/register` - New user registration

**Biometric & KYC:**
- `GET /get-sumsub-token` - Secure Sumsub access token generation
- `POST /get-biohash` - Extract bioHash from verified biometric data
- `POST /validate-biometric` - Verify biometric data integrity

**Blockchain Integration:**
- `POST /validate-wallet` - Validate deterministic wallet for bioHash
- `POST /mint-identity-nft` - Mint soulbound identity NFT
- `POST /emergency-recovery` - Initiate emergency wallet recovery
- `GET /identity-status/:tokenId` - Check identity NFT status

## Deployment

### Environment Configuration

Ensure all environment variables are properly configured for production:

```bash
# Database
DATABASE_URL=postgresql://...

# JWT Security
JWT_SECRET=strong-secret-key

# Sumsub KYC
SUMSUB_APP_TOKEN=prod-token
SUMSUB_SECRET_KEY=prod-secret

# Blockchain
WEB3_PROVIDER_URL=https://polygon-mainnet.g.alchemy.com/v2/...
IDENTITY_NFT_ADDRESS=0x...
MINTER_PRIVATE_KEY=0x...
```
- **Entropy Validation**: BioHash quality is verified before wallet generation
- **No Key Storage**: Private keys exist only in memory during operations
- **Input Validation**: All inputs are validated for format and security
- **Error Handling**: Secure error messages that don't leak sensitive information

## Testing & Quality Assurance

### Comprehensive Test Suite

The project includes a complete testing framework with 70%+ coverage:

**Frontend Unit Tests:**
- SecureStorage functionality (encryption, storage, validation)
- Wallet generation and recovery mechanisms  
- BioHash validation and entropy checking
- Input sanitization and error handling
- Web API mocking (IndexedDB, Crypto, localStorage)

**Smart Contract Integration Tests:**
- Complete NFT minting and recovery flows
- Soulbound token behavior validation
- Access control and role management
- Emergency recovery scenarios
- Event emission verification

**Backend API Tests:**
- JWT authentication and authorization
- KYC endpoint functionality
- Blockchain integration validation
- Database operations and migrations

### Running Tests

```bash
# Frontend tests with Jest
cd frontend && npm test

# Smart contract tests with Hardhat
npm run test:contracts

# Backend tests with pytest  
cd backend && python -m pytest

# All tests with coverage
npm run test:all
npm run test:contracts:coverage
```

### Test Coverage Requirements

All test suites maintain minimum coverage thresholds:
- Branches: 70%
- Functions: 70%
- Lines: 70%
- Statements: 70%

## Security Considerations

- **Soulbound Identity**: NFTs are non-transferable, ensuring identity integrity
- **Biometric Privacy**: Biometric data processed locally and never transmitted
- **Deterministic Security**: PBKDF2 with high iteration counts for key derivation
- **Entropy Validation**: BioHash quality verification before wallet generation
- **No Private Key Storage**: Keys exist only in memory during operations
- **Role-based Access Control**: Smart contract permissions for critical functions
- **Emergency Recovery**: Secure wallet regeneration while maintaining identity continuity
- **Input Validation**: Comprehensive validation for all user inputs and blockchain data
- **Rate Limiting**: Protection against brute force attacks on wallet generation (5 attempts/minute)
- **Identity History Tracking**: Complete audit trail with suspicious activity detection
- **Salt Security**: Enhanced storage security with salt migration to IndexedDB

## Production Deployment

### Smart Contract Deployment

```bash
# Compile contracts
npm run compile:contracts

# Deploy to testnet
npm run deploy:testnet

# Deploy to mainnet (requires production configuration)
npm run deploy:mainnet
```

### Environment Setup

1. Deploy smart contracts to target network
2. Configure environment variables for all services
3. Set up database with proper migrations
4. Configure monitoring and alerting systems
5. Implement backup and disaster recovery procedures

## Contributing

1. Fork the repository
2. Create a feature branch
3. Implement your changes
4. Add tests for new functionality
5. Submit a pull request

## License

Copyright 2024 BTS Blocktrust. All rights reserved.

## Support

For technical support and inquiries:
- Email: help@btsglobalcorp.com
- Documentation: See `/docs` directory
- Issues: GitHub Issues section

