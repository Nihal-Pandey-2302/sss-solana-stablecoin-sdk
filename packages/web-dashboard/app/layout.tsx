import type { Metadata } from "next";
import "./globals.css";
import WalletContextProvider from "../components/WalletProvider";

export const metadata: Metadata = {
  title: "SSS Dashboard — Solana Stablecoin Standard",
  description: "Admin dashboard for the Solana Stablecoin Standard. Mint, blacklist, and seize tokens on Devnet.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body>
        <WalletContextProvider>
          {children}
        </WalletContextProvider>
      </body>
    </html>
  );
}
