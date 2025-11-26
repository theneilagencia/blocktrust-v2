import { PrivyProvider as BasePrivyProvider } from '@privy-io/react-auth';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { polygon, polygonAmoy } from 'wagmi/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const wagmiConfig = createConfig({
  chains: [polygon, polygonAmoy],
  transports: {
    [polygon.id]: http(import.meta.env.VITE_POLYGON_RPC_URL || 'https://polygon-rpc.com'),
    [polygonAmoy.id]: http(import.meta.env.VITE_POLYGON_AMOY_RPC_URL || 'https://rpc-amoy.polygon.technology'),
  },
});

const queryClient = new QueryClient();

interface PrivyProviderProps {
  children: React.ReactNode;
}

export function PrivyProvider({ children }: PrivyProviderProps) {
  const appId = import.meta.env.VITE_PRIVY_APP_ID;

  if (!appId) {
    console.warn('VITE_PRIVY_APP_ID não configurado. Funcionalidades da Privy estarão desabilitadas.');
    return <>{children}</>;
  }

  return (
    <BasePrivyProvider
      appId={appId}
      config={{
        appearance: {
          theme: 'light',
          accentColor: '#1B5AB4', // Blue Highlight do BTS Design System
          logo: '/logo-bts.svg',
          landingHeader: 'Bem-vindo ao Blocktrust',
          loginMessage: 'Conecte sua identidade verificada',
        },
        embeddedWallets: {
          createOnLogin: 'off',
          showWalletUIs: false,
        },
        smartWallets: {
          enabled: true,
        },
        loginMethods: ['email'],
        supportedChains: [polygon, polygonAmoy],
      }}
    >
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </WagmiProvider>
    </BasePrivyProvider>
  );
}
