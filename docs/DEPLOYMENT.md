# Deployment Guide

Complete deployment guide for the Solana Token Airdrop Platform.

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Devnet Deployment](#devnet-deployment)
3. [Mainnet Deployment](#mainnet-deployment)
4. [Database Setup](#database-setup)
5. [Backend Deployment](#backend-deployment)
6. [Frontend Deployment](#frontend-deployment)
7. [Monitoring Setup](#monitoring-setup)

## Prerequisites

### Required Tools
- Node.js 18+
- Rust 1.70+
- Solana CLI v1.17+
- Anchor CLI v0.29+
- PostgreSQL 14+
- Redis 6+
- Git

### Accounts Needed
- Solana wallet with SOL (devnet or mainnet)
- GitHub account
- Vercel account (for frontend)
- Railway/Render account (for backend)
- Database hosting account

## Devnet Deployment

### 1. Setup Solana CLI

```bash
# Install Solana CLI
sh -c "$(curl -sSfL https://release.solana.com/stable/install)"

# Set to devnet
solana config set --url devnet

# Create or use existing keypair
solana-keygen new --outfile ~/.config/solana/devnet-keypair.json

# Set as default
solana config set --keypair ~/.config/solana/devnet-keypair.json

# Airdrop SOL for testing
solana airdrop 2
```

### 2. Build and Deploy Smart Contract

```bash
cd /path/to/08-solana-token-airdrop

# Build program
anchor build

# Deploy to devnet
anchor deploy --provider.cluster devnet

# Save the Program ID from output
# Example: Program Id: Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS
```

### 3. Update Configuration

Update `Anchor.toml`:
```toml
[programs.devnet]
airdrop = "YOUR_PROGRAM_ID_HERE"
```

### 4. Initialize Test Token (if needed)

```bash
# Create token mint
spl-token create-token --decimals 9

# Create token account
spl-token create-account TOKEN_MINT_ADDRESS

# Mint tokens for testing
spl-token mint TOKEN_MINT_ADDRESS 1000000 --owner ~/.config/solana/devnet-keypair.json
```

### 5. Test the Program

```bash
# Run tests
anchor test --skip-local-validator

# Manual testing with CLI
anchor run test-claim
```

## Mainnet Deployment

### Pre-Deployment Checklist

- [ ] Smart contract audited
- [ ] All devnet tests passed (100+ claims)
- [ ] Code reviewed
- [ ] Environment variables configured
- [ ] Database backup plan ready
- [ ] Monitoring configured
- [ ] Rollback plan documented
- [ ] Team notified
- [ ] Mainnet wallet funded (at least 2 SOL)

### 1. Configure Mainnet

```bash
# Set to mainnet-beta
solana config set --url mainnet-beta

# Create mainnet keypair (SECURE THIS!)
solana-keygen new --outfile ~/.config/solana/mainnet-keypair.json

# Set as default
solana config set --keypair ~/.config/solana/mainnet-keypair.json

# Check balance
solana balance
```

### 2. Deploy to Mainnet

```bash
# Build with verification
anchor build --verifiable

# Deploy
anchor deploy --provider.cluster mainnet

# Verify on Solana Explorer
# Visit: https://explorer.solana.com/address/YOUR_PROGRAM_ID
```

### 3. Update Production Config

Update `Anchor.toml`:
```toml
[programs.mainnet]
airdrop = "YOUR_MAINNET_PROGRAM_ID"
```

### 4. Verify Deployment

```bash
# Check program exists
solana program show YOUR_PROGRAM_ID

# Check program data
solana account YOUR_PROGRAM_ID
```

## Database Setup

### Option A: Managed Service (Recommended)

#### Railway
1. Go to railway.app
2. Create new project
3. Add PostgreSQL database
4. Copy connection string
5. Update backend `.env`:
```env
DATABASE_URL=postgresql://user:password@host:port/database
```

#### Render
1. Go to render.com
2. Create PostgreSQL database
3. Copy internal connection string
4. Update backend `.env`

### Option B: Self-Hosted

```bash
# Install PostgreSQL
sudo apt-get install postgresql-14

# Create database
sudo -u postgres createdb airdrop_db

# Create user
sudo -u postgres createuser airdrop_user -P

# Grant privileges
sudo -u postgres psql
GRANT ALL PRIVILEGES ON DATABASE airdrop_db TO airdrop_user;
```

### Run Migrations

```bash
cd backend

# Install dependencies
npm install

# Generate Prisma Client
npx prisma generate

# Run migrations
npx prisma migrate deploy

# Verify
npx prisma db push
```

## Backend Deployment

### Option A: Railway (Recommended)

1. **Connect GitHub Repository**
```bash
# Push code to GitHub
git init
git add .
git commit -m "Initial commit"
git remote add origin YOUR_REPO_URL
git push -u origin main
```

2. **Deploy on Railway**
- Go to railway.app
- Click "New Project"
- Select "Deploy from GitHub repo"
- Choose your repository
- Railway will auto-detect Node.js

3. **Configure Environment Variables**

In Railway dashboard, add:
```env
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
JWT_SECRET=your_secure_secret
SOLANA_NETWORK=mainnet-beta
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
PROGRAM_ID=YOUR_PROGRAM_ID
AUTHORITY_WALLET_PRIVATE_KEY=base58_encoded_key
ADMIN_WALLETS=wallet1,wallet2
CORS_ORIGIN=https://yourdomain.com
```

4. **Deploy**
- Railway automatically deploys on push
- Get deployment URL from dashboard

### Option B: Render

1. Create new Web Service
2. Connect GitHub repository
3. Configure:
   - Build Command: `npm install && npm run build`
   - Start Command: `npm start`
4. Add environment variables
5. Deploy

### Option C: Docker + AWS ECS

1. **Create Dockerfile**
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

2. **Build and Push**
```bash
# Build image
docker build -t airdrop-backend .

# Tag for ECR
docker tag airdrop-backend:latest AWS_ACCOUNT.dkr.ecr.REGION.amazonaws.com/airdrop-backend:latest

# Push to ECR
docker push AWS_ACCOUNT.dkr.ecr.REGION.amazonaws.com/airdrop-backend:latest
```

3. **Deploy to ECS**
- Create ECS cluster
- Create task definition
- Create service
- Configure load balancer

## Frontend Deployment

### Vercel (Recommended)

1. **Install Vercel CLI**
```bash
npm install -g vercel
```

2. **Configure Project**

Create `vercel.json`:
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "devCommand": "npm run dev",
  "framework": "nextjs"
}
```

3. **Set Environment Variables**

Create `.env.production`:
```env
NEXT_PUBLIC_SOLANA_NETWORK=mainnet-beta
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
NEXT_PUBLIC_PROGRAM_ID=YOUR_PROGRAM_ID
NEXT_PUBLIC_API_URL=https://your-backend-url.com/api/v1
NEXT_PUBLIC_EXPLORER_URL=https://explorer.solana.com
```

4. **Deploy**
```bash
cd app

# Deploy to production
vercel --prod

# Or connect GitHub for auto-deploy
vercel link
```

5. **Configure Custom Domain**
- Go to Vercel dashboard
- Add domain
- Update DNS records
- SSL automatically configured

### Alternative: Netlify

1. Connect GitHub repository
2. Configure build settings:
   - Build command: `npm run build`
   - Publish directory: `.next`
3. Add environment variables
4. Deploy

## Redis Setup

### Option A: Railway/Render

1. Add Redis service in Railway/Render
2. Copy connection URL
3. Update backend `.env`:
```env
REDIS_URL=redis://user:password@host:port
```

### Option B: AWS ElastiCache

1. Create Redis cluster
2. Configure security groups
3. Get endpoint
4. Update configuration

## Queue Workers

### Deploy Separate Worker Instance

```bash
# Create worker.ts
import { claimWorker } from './queue/claimQueue';

// Worker starts automatically on import
console.log('Worker started');
```

Deploy as separate service on Railway/Render:
- Same codebase
- Different start command: `node dist/worker.js`
- Same environment variables

## Monitoring Setup

### 1. Error Tracking (Sentry)

```bash
npm install @sentry/node @sentry/tracing
```

Add to backend `index.ts`:
```typescript
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 1.0,
});
```

### 2. Logging (Winston)

Already configured in `utils/logger.ts`

### 3. Uptime Monitoring (UptimeRobot)

1. Go to uptimerobot.com
2. Add monitor for API endpoint
3. Add monitor for frontend
4. Configure alerts

### 4. APM (New Relic - Optional)

```bash
npm install newrelic
```

Create `newrelic.js`:
```javascript
exports.config = {
  app_name: ['Airdrop Backend'],
  license_key: process.env.NEW_RELIC_LICENSE_KEY,
  logging: { level: 'info' },
};
```

## Post-Deployment Verification

### 1. Health Checks

```bash
# Backend health
curl https://your-api.com/health

# Check database connection
curl https://your-api.com/api/v1/dashboard/metrics

# Frontend
curl https://your-frontend.com
```

### 2. Test Claim Flow

1. Connect wallet
2. Sign message
3. Submit claim
4. Verify transaction on Explorer
5. Check database record

### 3. Monitor Logs

```bash
# Backend logs
railway logs

# Check for errors
railway logs --filter error
```

### 4. Load Testing

```bash
# Install k6
brew install k6

# Run load test
k6 run tests/load-test.js
```

## Rollback Procedure

If issues occur:

1. **Pause Airdrop**
```bash
curl -X PUT https://your-api.com/api/v1/admin/airdrop/:id/pause \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

2. **Rollback Backend**
- Railway: Click "Rollback" in dashboard
- Manual: `git revert` and redeploy

3. **Rollback Frontend**
- Vercel: Click "Rollback" in deployments

4. **Database Restore (if needed)**
```bash
# Restore from backup
pg_restore -d airdrop_db backup.dump
```

## Security Checklist

- [ ] All secrets in environment variables
- [ ] HTTPS enabled
- [ ] CORS properly configured
- [ ] Rate limiting active
- [ ] Database backups automated
- [ ] Admin wallets whitelisted
- [ ] Monitoring alerts configured
- [ ] SSL certificates valid
- [ ] Firewall rules configured
- [ ] Private keys secured (hardware wallet/secrets manager)

## Troubleshooting

### Common Issues

**1. Program Deploy Failed**
- Check SOL balance: `solana balance`
- Verify network: `solana config get`
- Check program size: `ls -lh target/deploy/`

**2. Database Connection Error**
- Verify DATABASE_URL
- Check firewall rules
- Test connection: `psql $DATABASE_URL`

**3. Redis Connection Failed**
- Verify REDIS_URL
- Check Redis is running
- Test: `redis-cli -u $REDIS_URL ping`

**4. Frontend Build Failed**
- Check environment variables
- Verify Node version
- Clear cache: `rm -rf .next node_modules && npm install`

**5. Transactions Failing**
- Check RPC endpoint health
- Verify wallet balance
- Check program is not paused
- Review transaction logs

## Maintenance

### Daily
- Monitor error logs
- Check transaction success rate
- Review queue metrics
- Verify database backups

### Weekly
- Review analytics
- Update dependencies
- Check disk space
- Review access logs

### Monthly
- Security audit
- Performance review
- Cost analysis
- Update documentation

## Support

For deployment issues:
- Check logs first
- Review error messages
- Consult documentation
- Contact DevOps team

## Additional Resources

- [Solana Cookbook](https://solanacookbook.com/)
- [Anchor Book](https://book.anchor-lang.com/)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [Railway Docs](https://docs.railway.app/)
- [Vercel Docs](https://vercel.com/docs)
