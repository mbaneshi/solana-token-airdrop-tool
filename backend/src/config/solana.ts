import { Connection, Keypair, PublicKey, clusterApiUrl } from '@solana/web3.js';
import { logger } from '../utils/logger';
import bs58 from 'bs58';

// Determine network
const network = process.env.SOLANA_NETWORK || 'devnet';
const rpcUrl = process.env.SOLANA_RPC_URL || clusterApiUrl(network as any);

// Create connection
export const connection = new Connection(rpcUrl, {
  commitment: 'confirmed',
  confirmTransactionInitialTimeout: 60000,
});

// Load authority wallet
let authorityWallet: Keypair | null = null;

try {
  const privateKeyString = process.env.AUTHORITY_WALLET_PRIVATE_KEY;

  if (!privateKeyString) {
    throw new Error('AUTHORITY_WALLET_PRIVATE_KEY not set in environment');
  }

  const privateKeyBytes = bs58.decode(privateKeyString);
  authorityWallet = Keypair.fromSecretKey(privateKeyBytes);

  logger.info(`✅ Authority wallet loaded: ${authorityWallet.publicKey.toString()}`);
} catch (error) {
  logger.error('❌ Failed to load authority wallet:', error);
  process.exit(1);
}

export const getAuthorityWallet = (): Keypair => {
  if (!authorityWallet) {
    throw new Error('Authority wallet not initialized');
  }
  return authorityWallet;
};

// Program ID
export const PROGRAM_ID = new PublicKey(
  process.env.PROGRAM_ID || 'Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS'
);

// Test connection
connection
  .getVersion()
  .then((version) => {
    logger.info(`✅ Connected to Solana ${network}`);
    logger.info(`📊 Solana version: ${JSON.stringify(version)}`);
  })
  .catch((error) => {
    logger.error('❌ Failed to connect to Solana:', error);
  });

export default connection;
