/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PRIVY_APP_ID: string;
  readonly VITE_CHAIN_ID: string;
  readonly VITE_POLYGON_RPC_URL: string;
  readonly VITE_POLYGON_AMOY_RPC_URL: string;
  readonly VITE_IDENTITY_NFT_ADDRESS: string;
  readonly VITE_PROOF_REGISTRY_ADDRESS: string;
  readonly VITE_SUMSUB_API_URL: string;
  readonly VITE_SUMSUB_APP_TOKEN: string;
  readonly VITE_WALLET_ITERATIONS: string;
  readonly VITE_WALLET_SALT: string;
  readonly VITE_SECURITY_LEVEL: string;
  readonly VITE_ENVIRONMENT: string;
  readonly VITE_DEBUG_MODE: string;
  readonly VITE_STRICT_VALIDATION: string;
  readonly VITE_API_BASE_URL: string;
  readonly VITE_API_TIMEOUT: string;
  readonly VITE_ASSETS_URL: string;
  readonly VITE_DEFAULT_THEME: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
