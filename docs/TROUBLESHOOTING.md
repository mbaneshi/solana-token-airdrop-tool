# Troubleshooting Guide

## Overview

This guide helps diagnose and resolve common issues with the Solana Token Airdrop Platform.

## Table of Contents

- [Wallet Connection Issues](#wallet-connection-issues)
- [Claim Issues](#claim-issues)
- [Transaction Failures](#transaction-failures)
- [Backend API Issues](#backend-api-issues)
- [Database Issues](#database-issues)
- [Queue Issues](#queue-issues)
- [Testing Issues](#testing-issues)
- [Deployment Issues](#deployment-issues)

## Wallet Connection Issues

### Issue: Wallet not connecting

**Symptoms:**
- Wallet button not appearing
- Connection dialog doesn't open
- Wallet connects but disconnects immediately

**Solutions:**

1. **Check wallet extension installation**
   ```bash
   # Verify Phantom/Solflare is installed in browser
   ```

2. **Clear browser cache**
   ```bash
   # Chrome/Brave: Settings > Privacy > Clear browsing data
   # Firefox: Options > Privacy > Clear Data
   ```

3. **Check network configuration**
   ```typescript
   // app/src/components/WalletProvider.tsx
   // Verify NEXT_PUBLIC_SOLANA_NETWORK is set correctly
   console.log(process.env.NEXT_PUBLIC_SOLANA_NETWORK); // Should be 'devnet' or 'mainnet-beta'
   ```

4. **Check wallet adapter versions**
   ```bash
   cd app
   npm list @solana/wallet-adapter-react
   # Ensure versions are compatible
   ```

### Issue: Wrong network selected

**Symptoms:**
- Wallet shows different network than expected
- Transactions fail with "incorrect cluster" error

**Solutions:**

1. **Check environment variables**
   ```bash
   # app/.env.local
   NEXT_PUBLIC_SOLANA_NETWORK=devnet
   NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
   ```

2. **Switch network in wallet**
   ```
   1. Open wallet extension
   2. Settings > Network
   3. Select Devnet/Mainnet
   4. Refresh page
   ```

## Claim Issues

### Issue: "Already claimed" error

**Symptoms:**
- User gets error saying they already claimed
- But they don't see tokens in wallet

**Solutions:**

1. **Check claim status**
   ```bash
   curl http://localhost:3000/api/v1/claim/YOUR_WALLET_ADDRESS
   ```

2. **Check database**
   ```sql
   SELECT * FROM users_claims WHERE wallet_address = 'YOUR_WALLET';
   ```

3. **If claim is stuck in "pending"**
   ```bash
   # Check queue status
   curl http://localhost:3000/api/v1/admin/queue/metrics

   # Retry failed claims
   curl -X POST http://localhost:3000/api/v1/admin/retry-failed
   ```

### Issue: "Wallet blacklisted" error

**Symptoms:**
- User cannot claim tokens
- Error message says wallet is blacklisted

**Solutions:**

1. **Check blacklist**
   ```sql
   SELECT * FROM blacklist WHERE wallet_address = 'YOUR_WALLET';
   ```

2. **Remove from blacklist (admin only)**
   ```bash
   curl -X DELETE http://localhost:3000/api/v1/admin/blacklist/YOUR_WALLET \
     -H "Authorization: Bearer ADMIN_TOKEN"
   ```

### Issue: "Not whitelisted" error

**Symptoms:**
- Whitelist-only mode is enabled
- User's wallet not on whitelist

**Solutions:**

1. **Check whitelist**
   ```sql
   SELECT * FROM whitelist
   WHERE wallet_address = 'YOUR_WALLET'
   AND airdrop_id = 'AIRDROP_ID';
   ```

2. **Add to whitelist (admin only)**
   ```bash
   curl -X POST http://localhost:3000/api/v1/admin/whitelist \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer ADMIN_TOKEN" \
     -d '{
       "airdropId": "AIRDROP_ID",
       "wallets": ["WALLET_ADDRESS"]
     }'
   ```

### Issue: "Supply exhausted" error

**Symptoms:**
- No more tokens available for claims

**Solutions:**

1. **Check airdrop supply**
   ```sql
   SELECT
     total_supply,
     tokens_distributed,
     total_supply - tokens_distributed as remaining
   FROM airdrops
   WHERE status = 'active';
   ```

2. **Increase supply (admin only)**
   ```bash
   curl -X PUT http://localhost:3000/api/v1/admin/airdrop/AIRDROP_ID \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer ADMIN_TOKEN" \
     -d '{
       "totalSupply": "2000000"
     }'
   ```

## Transaction Failures

### Issue: Transaction timeout

**Symptoms:**
- Claim stuck in "processing" status
- No transaction signature generated

**Solutions:**

1. **Check Solana network status**
   ```bash
   solana cluster-version
   solana block-height
   ```

2. **Check RPC endpoint**
   ```bash
   # backend/.env
   SOLANA_RPC_URL=https://api.devnet.solana.com

   # Test RPC
   curl -X POST $SOLANA_RPC_URL -H "Content-Type: application/json" -d '
     {"jsonrpc":"2.0","id":1,"method":"getHealth"}
   '
   ```

3. **Use premium RPC provider**
   ```bash
   # Recommended providers:
   # - Helius: https://helius.dev
   # - QuickNode: https://quicknode.com
   # - Alchemy: https://alchemy.com
   ```

4. **Retry failed claims**
   ```bash
   curl -X POST http://localhost:3000/api/v1/admin/retry-failed
   ```

### Issue: Insufficient funds for transaction

**Symptoms:**
- Transaction fails with "insufficient funds" error
- Authority wallet balance too low

**Solutions:**

1. **Check authority wallet balance**
   ```bash
   solana balance AUTHORITY_WALLET_ADDRESS
   ```

2. **Airdrop SOL (devnet only)**
   ```bash
   solana airdrop 2 AUTHORITY_WALLET_ADDRESS
   ```

3. **Transfer SOL (mainnet)**
   ```bash
   solana transfer AUTHORITY_WALLET_ADDRESS 1 --from YOUR_WALLET
   ```

### Issue: Token account doesn't exist

**Symptoms:**
- Transaction fails with "account not found" error

**Solutions:**

1. **Check if associated token account exists**
   ```bash
   spl-token accounts TOKEN_MINT_ADDRESS --owner USER_WALLET
   ```

2. **The system should auto-create ATA**
   - Check `distribution.service.ts`
   - Verify `createAssociatedTokenAccountInstruction` is being added

3. **Manually create ATA (if needed)**
   ```bash
   spl-token create-account TOKEN_MINT_ADDRESS --owner USER_WALLET
   ```

## Backend API Issues

### Issue: 502 Bad Gateway

**Symptoms:**
- API requests return 502 error
- Backend not responding

**Solutions:**

1. **Check backend status**
   ```bash
   pm2 status
   # or
   systemctl status airdrop-backend
   ```

2. **Check logs**
   ```bash
   pm2 logs airdrop-backend
   # or
   tail -f /var/log/airdrop-backend.log
   ```

3. **Restart backend**
   ```bash
   pm2 restart airdrop-backend
   # or
   systemctl restart airdrop-backend
   ```

### Issue: Database connection errors

**Symptoms:**
- "Unable to connect to database" errors
- Prisma client errors

**Solutions:**

1. **Check PostgreSQL status**
   ```bash
   systemctl status postgresql
   ```

2. **Test database connection**
   ```bash
   psql -h localhost -U airdrop_user -d airdrop_db -c "SELECT 1;"
   ```

3. **Check connection string**
   ```bash
   # backend/.env
   DATABASE_URL="postgresql://user:password@localhost:5432/airdrop_db"
   ```

4. **Run migrations**
   ```bash
   cd backend
   npx prisma migrate deploy
   ```

### Issue: Redis connection errors

**Symptoms:**
- Queue operations failing
- Rate limiting not working

**Solutions:**

1. **Check Redis status**
   ```bash
   systemctl status redis
   redis-cli ping
   ```

2. **Test Redis connection**
   ```bash
   redis-cli -h localhost -p 6379 ping
   ```

3. **Check Redis configuration**
   ```bash
   # backend/.env
   REDIS_URL=redis://localhost:6379
   ```

## Queue Issues

### Issue: Claims stuck in queue

**Symptoms:**
- Claims not processing
- Queue "waiting" count increasing

**Solutions:**

1. **Check queue metrics**
   ```bash
   curl http://localhost:3000/api/v1/admin/queue/metrics
   ```

2. **Check worker status**
   ```bash
   pm2 logs airdrop-worker
   ```

3. **Restart queue worker**
   ```bash
   pm2 restart airdrop-worker
   ```

4. **Check queue concurrency**
   ```bash
   # backend/.env
   QUEUE_CONCURRENCY=5  # Increase if needed
   ```

### Issue: Jobs failing repeatedly

**Symptoms:**
- High "failed" count in queue metrics
- Same jobs failing over and over

**Solutions:**

1. **Check error logs**
   ```bash
   pm2 logs airdrop-worker --err
   ```

2. **Check retry configuration**
   ```bash
   # backend/.env
   MAX_RETRY_ATTEMPTS=3
   ```

3. **Manually retry failed jobs**
   ```bash
   curl -X POST http://localhost:3000/api/v1/admin/retry-failed
   ```

## Testing Issues

### Issue: Tests failing

**Symptoms:**
- Jest tests failing unexpectedly
- Coverage not meeting threshold

**Solutions:**

1. **Clear test cache**
   ```bash
   npm test -- --clearCache
   ```

2. **Run tests in verbose mode**
   ```bash
   npm test -- --verbose
   ```

3. **Check for async issues**
   ```typescript
   // Use waitFor for async operations
   await waitFor(() => {
     expect(screen.getByText('Success')).toBeInTheDocument();
   });
   ```

4. **Check mock configuration**
   ```typescript
   // Reset mocks before each test
   beforeEach(() => {
     jest.clearAllMocks();
   });
   ```

### Issue: Coverage below threshold

**Symptoms:**
- Tests pass but coverage check fails

**Solutions:**

1. **Generate coverage report**
   ```bash
   npm test -- --coverage
   ```

2. **View HTML report**
   ```bash
   open coverage/lcov-report/index.html
   ```

3. **Add missing tests**
   - Check uncovered lines in report
   - Write tests for edge cases
   - Test error handling

## Deployment Issues

### Issue: Build failing

**Symptoms:**
- `npm run build` fails
- TypeScript errors

**Solutions:**

1. **Check TypeScript errors**
   ```bash
   npx tsc --noEmit
   ```

2. **Fix type errors**
   ```typescript
   // Add proper types
   const data: AirdropData = await api.getMetrics();
   ```

3. **Check dependencies**
   ```bash
   npm install
   rm -rf node_modules package-lock.json
   npm install
   ```

### Issue: Environment variables not loading

**Symptoms:**
- Features not working in production
- "undefined" errors

**Solutions:**

1. **Check .env file**
   ```bash
   # Verify all required variables are set
   cat .env
   ```

2. **Check environment variable naming**
   ```bash
   # Frontend (Next.js): Must start with NEXT_PUBLIC_
   NEXT_PUBLIC_API_URL=...

   # Backend: No prefix needed
   DATABASE_URL=...
   ```

3. **Restart application after env changes**
   ```bash
   pm2 restart all
   ```

## Performance Issues

### Issue: Slow claim processing

**Symptoms:**
- Claims taking too long to process
- Users waiting minutes for tokens

**Solutions:**

1. **Increase queue concurrency**
   ```bash
   # backend/.env
   QUEUE_CONCURRENCY=10  # Increase from default 5
   ```

2. **Use premium RPC**
   ```bash
   SOLANA_RPC_URL=https://your-premium-rpc-url
   ```

3. **Batch transactions**
   - Implement batching in `distribution.service.ts`
   - Process multiple claims per transaction

### Issue: High memory usage

**Symptoms:**
- Backend consuming too much RAM
- Server running out of memory

**Solutions:**

1. **Check memory usage**
   ```bash
   pm2 monit
   ```

2. **Increase Node.js memory limit**
   ```bash
   NODE_OPTIONS=--max-old-space-size=4096 npm start
   ```

3. **Optimize database queries**
   ```typescript
   // Use pagination
   const claims = await prisma.usersClaim.findMany({
     take: 100,
     skip: offset,
   });
   ```

## Getting Help

If you can't resolve your issue:

1. **Check logs**
   - Backend: `pm2 logs`
   - Frontend: Browser console
   - Database: PostgreSQL logs

2. **Search documentation**
   - README.md
   - TESTING.md
   - API.md

3. **Contact support**
   - GitHub Issues
   - Team chat
   - Email: support@example.com

## Diagnostic Commands

### Quick health check

```bash
# Check all services
./scripts/health-check.sh

# Or manually:
systemctl status postgresql
systemctl status redis
pm2 status
curl http://localhost:3000/health
```

### Collect diagnostic info

```bash
# System info
uname -a
node --version
npm --version

# Service status
pm2 status
systemctl status postgresql redis

# Database check
psql -h localhost -U airdrop_user -d airdrop_db -c "\dt"

# Redis check
redis-cli info

# Disk space
df -h

# Memory usage
free -h
```
