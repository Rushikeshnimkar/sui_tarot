"use client"
import './globals.css'
import { Inter } from 'next/font/google'
import { createNetworkConfig, SuiClientProvider, WalletProvider } from '@mysten/dapp-kit';
import { getFullnodeUrl } from '@mysten/sui.js/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AuthProvider from "./hooks/AuthProvider";

// const inter = Inter({ subsets: ['latin'] })

// export const metadata = {
//   title: 'Create Next App',
//   description: 'Generated by create next app',
// }
const { networkConfig } = createNetworkConfig({
	testnet: { url: getFullnodeUrl('testnet') },
	// mainnet: { url: getFullnodeUrl('mainnet') },
});
const queryClient = new QueryClient();

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body >
      <AuthProvider>
      <QueryClientProvider client={queryClient}>
			<SuiClientProvider networks={networkConfig} defaultNetwork="testnet">
				<WalletProvider>
        {children}
        </WalletProvider>
			</SuiClientProvider>
		</QueryClientProvider>
    </AuthProvider>
      </body>
    </html>
  )
}