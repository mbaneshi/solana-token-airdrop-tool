import {
  Connection,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
  SystemProgram,
} from '@solana/web3.js';
import {
  createTransferInstruction,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { connection, getAuthorityWallet, PROGRAM_ID } from '../config/solana';
import prisma from '../config/database';
import { logger } from '../utils/logger';
import { ClaimJob } from '../queue/claimQueue';

interface ProcessResult {
  success: boolean;
  signature?: string;
  error?: string;
}

/**
 * Process a batch of claims
 */
export const processClaimBatch = async (claims: ClaimJob[]): Promise<ProcessResult> => {
  try {
    if (claims.length === 0) {
      return { success: false, error: 'No claims to process' };
    }

    // For simplicity, process one claim at a time
    // In production, you can batch multiple transfers in one transaction
    const claim = claims[0];

    // Update claim status to processing
    await prisma.usersClaim.update({
      where: { id: claim.claimId },
      data: { claimStatus: 'processing' },
    });

    // Get airdrop details from database
    const claimRecord = await prisma.usersClaim.findUnique({
      where: { id: claim.claimId },
    });

    if (!claimRecord) {
      throw new Error('Claim record not found');
    }

    // Get token mint (you'll need to store this in your database or config)
    const tokenMint = new PublicKey(process.env.TOKEN_MINT || '');
    const authority = getAuthorityWallet();

    // Get source token account (authority's token account)
    const sourceTokenAccount = await getAssociatedTokenAddress(
      tokenMint,
      authority.publicKey
    );

    // Get destination token account (user's token account)
    const destinationWallet = new PublicKey(claim.walletAddress);
    const destinationTokenAccount = await getAssociatedTokenAddress(
      tokenMint,
      destinationWallet
    );

    // Create transaction
    const transaction = new Transaction();

    // Check if destination token account exists
    const destinationAccountInfo = await connection.getAccountInfo(destinationTokenAccount);

    if (!destinationAccountInfo) {
      // Create associated token account
      transaction.add(
        createAssociatedTokenAccountInstruction(
          authority.publicKey,
          destinationTokenAccount,
          destinationWallet,
          tokenMint,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        )
      );
    }

    // Add transfer instruction
    transaction.add(
      createTransferInstruction(
        sourceTokenAccount,
        destinationTokenAccount,
        authority.publicKey,
        claim.amount,
        [],
        TOKEN_PROGRAM_ID
      )
    );

    // Send and confirm transaction
    const signature = await sendAndConfirmTransaction(connection, transaction, [authority], {
      commitment: 'confirmed',
    });

    logger.info(`✅ Transaction confirmed: ${signature}`);

    // Update database
    await prisma.$transaction([
      prisma.usersClaim.update({
        where: { id: claim.claimId },
        data: {
          claimStatus: 'completed',
          transactionSignature: signature,
          claimedAt: new Date(),
        },
      }),
      prisma.transaction.create({
        data: {
          claimId: claim.claimId,
          signature,
          status: 'confirmed',
          confirmedAt: new Date(),
        },
      }),
    ]);

    return { success: true, signature };
  } catch (error: any) {
    logger.error('Error processing claim batch:', error);

    // Update claim as failed
    if (claims.length > 0) {
      await prisma.usersClaim.update({
        where: { id: claims[0].claimId },
        data: {
          claimStatus: 'failed',
          retryCount: { increment: 1 },
        },
      });

      // Create failed transaction record
      await prisma.transaction.create({
        data: {
          claimId: claims[0].claimId,
          signature: 'failed',
          status: 'failed',
          errorMessage: error.message,
        },
      });
    }

    return { success: false, error: error.message };
  }
};

/**
 * Confirm transaction on blockchain
 */
export const confirmTransaction = async (signature: string): Promise<boolean> => {
  try {
    const confirmation = await connection.confirmTransaction(signature, 'confirmed');

    if (confirmation.value.err) {
      logger.error(`Transaction ${signature} failed:`, confirmation.value.err);
      return false;
    }

    return true;
  } catch (error) {
    logger.error('Error confirming transaction:', error);
    return false;
  }
};

/**
 * Get transaction details
 */
export const getTransactionDetails = async (signature: string) => {
  try {
    const transaction = await connection.getTransaction(signature, {
      commitment: 'confirmed',
    });

    return transaction;
  } catch (error) {
    logger.error('Error getting transaction details:', error);
    return null;
  }
};
