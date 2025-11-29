import { PrivyProvider as BasePrivyProvider } from '@privy-io/react-auth';
import { WagmiConfig, createConfig, configureChains } from 'wagmi';
import { polygon } from 'wagmi/chains';
import { publicProvider } from 'wagmi/providers/public';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const { chains, publicClient } = configureChains(
  [polygon],
  [publicProvider()]
);

const wagmiConfig = createConfig({
  autoConnect: true,
  publicClient,
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
        supportedChains: [polygon],
      }}
    >
      <WagmiConfig config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </WagmiConfig>
    </BasePrivyProvider>
  );
}
