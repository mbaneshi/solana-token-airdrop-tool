# Setup Guide

Complete setup guide for local development and testing.

## Prerequisites

Ensure you have the following installed:

- **Node.js** 18+ ([Download](https://nodejs.org/))
- **Rust** 1.70+ ([Install](https://rustup.rs/))
- **Solana CLI** v1.17+ ([Install](https://docs.solana.com/cli/install-solana-cli-tools))
- **Anchor CLI** v0.29+ ([Install](https://www.anchor-lang.com/docs/installation))
- **PostgreSQL** 14+ ([Download](https://www.postgresql.org/download/))
- **Redis** 6+ ([Download](https://redis.io/download/))
- **Git** ([Download](https://git-scm.com/downloads))

### Verify Installations

```bash
node --version   # Should be v18+
rust --version   # Should be 1.70+
solana --version # Should be 1.17+
anchor --version # Should be 0.29+
psql --version   # Should be 14+
redis-cli --version # Should be 6+
```

## Quick Start (5 minutes)

```bash
# 1. Clone repository
git clone <repository-url>
cd 08-solana-token-airdrop

# 2. Run setup script
./scripts/setup.sh

# 3. Start all services
./scripts/dev.sh
```

That's it! The platform will be running at:
- Frontend: http://localhost:3001
- Backend: http://localhost:3000
- Program deployed to devnet

## Detailed Setup

### Step 1: Clone Repository

```bash
git clone <repository-url>
cd 08-solana-token-airdrop
```

### Step 2: Configure Solana CLI

```bash
# Set to devnet for testing
solana config set --url devnet

# Create a new keypair (or use existing)
solana-keygen new --outfile ~/.config/solana/devnet-keypair.json

# Set as default keypair
solana config set --keypair ~/.config/solana/devnet-keypair.json

# Verify configuration
solana config get

# Airdrop some SOL for testing
solana airdrop 2
solana balance
```

### Step 3: Install Dependencies

#### Install All Dependencies
```bash
# From project root
npm install

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../app
npm install

# Return to root
cd ..
```

### Step 4: Setup Database

#### Create Database
```bash
# Using PostgreSQL CLI
createdb airdrop_dev

# Or using psql
psql -U postgres
CREATE DATABASE airdrop_dev;
\q
```

#### Configure Database URL
```bash
cd backend
cp .env.example .env
```

Edit `backend/.env`:
```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/airdrop_dev
```

#### Run Migrations
```bash
cd backend
npx prisma migrate dev
npx prisma generate
```

### Step 5: Setup Redis

#### Start Redis Server
```bash
# macOS (using Homebrew)
brew services start redis

# Linux
sudo systemctl start redis

# Or manually
redis-server
```

#### Verify Redis
```bash
redis-cli ping
# Should return: PONG
```

### Step 6: Configure Environment Variables

#### Backend Configuration

Edit `backend/.env`:
```env
# Application
NODE_ENV=development
PORT=3000
API_URL=http://localhost:3000

# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/airdrop_dev

# Redis
REDIS_URL=redis://localhost:6379

# Solana
SOLANA_NETWORK=devnet
SOLANA_RPC_URL=https://api.devnet.solana.com
PROGRAM_ID=YOUR_PROGRAM_ID_AFTER_DEPLOYMENT
AUTHORITY_WALLET_PRIVATE_KEY=YOUR_BASE58_PRIVATE_KEY

# Authentication
JWT_SECRET=your_secure_random_string_minimum_32_characters
JWT_EXPIRATION=24h

# Admin Wallets (comma-separated)
ADMIN_WALLETS=YOUR_WALLET_ADDRESS

# Rate Limiting
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW_MS=900000
IP_CLAIM_LIMIT=5
IP_CLAIM_WINDOW_HOURS=1

# CORS
CORS_ORIGIN=http://localhost:3001

# Queue
QUEUE_BATCH_SIZE=25
MAX_RETRY_ATTEMPTS=3

# Logging
LOG_LEVEL=debug
```

#### Frontend Configuration

Edit `app/.env`:
```env
NEXT_PUBLIC_SOLANA_NETWORK=devnet
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
NEXT_PUBLIC_PROGRAM_ID=YOUR_PROGRAM_ID_AFTER_DEPLOYMENT
NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1
NEXT_PUBLIC_WS_URL=ws://localhost:3000
NEXT_PUBLIC_EXPLORER_URL=https://explorer.solana.com
```

### Step 7: Build and Deploy Smart Contract

```bash
# From project root
anchor build

# Deploy to devnet
anchor deploy --provider.cluster devnet

# Copy the Program ID from the output
# Example: Program Id: Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS
```

#### Update Configuration with Program ID

1. Update `Anchor.toml`:
```toml
[programs.devnet]
airdrop = "YOUR_PROGRAM_ID"
```

2. Update `backend/.env`:
```env
PROGRAM_ID=YOUR_PROGRAM_ID
```

3. Update `app/.env`:
```env
NEXT_PUBLIC_PROGRAM_ID=YOUR_PROGRAM_ID
```

### Step 8: Setup Test Token (Optional)

If you need to create a test token:

```bash
# Create token mint
spl-token create-token --decimals 9

# Note the Token Mint Address
# Example: TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA

# Create token account for your wallet
spl-token create-account YOUR_TOKEN_MINT

# Mint some tokens
spl-token mint YOUR_TOKEN_MINT 1000000 --owner ~/.config/solana/devnet-keypair.json

# Create authority token account (for airdrop)
spl-token create-account YOUR_TOKEN_MINT ~/.config/solana/devnet-keypair.json

# Mint tokens to authority account
spl-token mint YOUR_TOKEN_MINT 10000000
```

Add token mint to `backend/.env`:
```env
TOKEN_MINT=YOUR_TOKEN_MINT_ADDRESS
```

### Step 9: Start Development Servers

#### Option A: Start All Services Together

```bash
# From project root, open 3 terminal windows

# Terminal 1: Backend
cd backend
npm run dev

# Terminal 2: Frontend
cd app
npm run dev

# Terminal 3: Queue Worker (optional)
cd backend
npm run worker
```

#### Option B: Use tmux/screen

```bash
# Install tmux
brew install tmux  # macOS
sudo apt install tmux  # Linux

# Start session
tmux new -s airdrop

# Split panes
Ctrl+B then %  # Split horizontally
Ctrl+B then "  # Split vertically

# Navigate panes
Ctrl+B then arrow keys

# In each pane:
cd backend && npm run dev
cd app && npm run dev
```

### Step 10: Verify Setup

#### Backend Health Check
```bash
curl http://localhost:3000/health
# Should return: {"status":"ok","timestamp":"..."}
```

#### Database Connection
```bash
cd backend
npx prisma studio
# Opens Prisma Studio at http://localhost:5555
```

#### Redis Connection
```bash
redis-cli
> ping
# Should return: PONG
```

#### Frontend
Open browser to http://localhost:3001

## Testing

### Run All Tests

```bash
# Smart Contract Tests
anchor test

# Backend Tests
cd backend
npm test

# Frontend Tests (if configured)
cd app
npm test
```

### Manual Testing Checklist

- [ ] Frontend loads successfully
- [ ] Can connect wallet (Phantom, Solflare)
- [ ] Can sign authentication message
- [ ] Can submit claim
- [ ] Transaction appears in queue
- [ ] Transaction confirms on Solana
- [ ] Tokens appear in wallet
- [ ] Dashboard shows updated metrics
- [ ] Admin panel accessible (if configured)

## Common Issues and Solutions

### Issue 1: "Command not found: anchor"

**Solution:**
```bash
# Install Anchor CLI
cargo install --git https://github.com/coral-xyz/anchor avm --locked --force
avm install latest
avm use latest
```

### Issue 2: "Insufficient SOL for transaction"

**Solution:**
```bash
# Airdrop more SOL on devnet
solana airdrop 2
```

### Issue 3: "Database connection failed"

**Solution:**
```bash
# Check PostgreSQL is running
pg_isadmin

# Check connection string in .env
# Verify database exists
psql -l
```

### Issue 4: "Redis connection error"

**Solution:**
```bash
# Start Redis
redis-server

# Check it's running
redis-cli ping
```

### Issue 5: "Port already in use"

**Solution:**
```bash
# Find process using port
lsof -ti:3000  # Backend
lsof -ti:3001  # Frontend

# Kill process
kill -9 $(lsof -ti:3000)

# Or change port in .env
PORT=3002
```

### Issue 6: "Wallet adapter connection error"

**Solution:**
- Install browser wallet extension
- Refresh page
- Try different wallet
- Check console for errors
- Verify network setting (devnet)

### Issue 7: "Transaction simulation failed"

**Solution:**
```bash
# Check program is deployed
solana program show PROGRAM_ID

# Check wallet has SOL
solana balance

# Verify token account exists
spl-token accounts
```

## Development Workflow

### Daily Development

```bash
# 1. Pull latest changes
git pull origin main

# 2. Update dependencies (if needed)
cd backend && npm install
cd ../app && npm install

# 3. Run migrations (if new ones)
cd backend && npx prisma migrate dev

# 4. Start servers
cd backend && npm run dev
cd app && npm run dev
```

### Making Changes

```bash
# 1. Create feature branch
git checkout -b feature/your-feature

# 2. Make changes

# 3. Test changes
npm test

# 4. Lint code
npm run lint

# 5. Format code
npm run format

# 6. Commit
git add .
git commit -m "feat: your feature description"

# 7. Push
git push origin feature/your-feature
```

### Hot Reload

Both backend and frontend support hot reload:
- Backend: Uses `nodemon` - saves automatically restart
- Frontend: Uses Next.js Fast Refresh - changes reflect immediately

## IDE Setup

### VS Code

Recommended extensions:
```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "bradlc.vscode-tailwindcss",
    "prisma.prisma",
    "rust-lang.rust-analyzer"
  ]
}
```

Settings (`.vscode/settings.json`):
```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "eslint.validate": ["javascript", "typescript", "typescriptreact"]
}
```

## Database Management

### Prisma Studio

```bash
cd backend
npx prisma studio
```

Opens GUI at http://localhost:5555 for:
- Viewing data
- Editing records
- Testing queries

### Reset Database

```bash
cd backend

# Reset database (WARNING: Deletes all data)
npx prisma migrate reset

# Or manually
dropdb airdrop_dev
createdb airdrop_dev
npx prisma migrate deploy
```

### Backup Database

```bash
# Export database
pg_dump airdrop_dev > backup.sql

# Restore database
psql airdrop_dev < backup.sql
```

## Monitoring

### View Logs

```bash
# Backend logs
cd backend
npm run dev

# Frontend logs
cd app
npm run dev

# Queue logs
cd backend
npm run worker
```

### Monitor Queue

Access BullMQ dashboard (if configured):
```bash
cd backend
npx bull-board
```

## Next Steps

After setup:

1. **Read Documentation**
   - `/docs/API.md` - API endpoints
   - `/docs/DEPLOYMENT.md` - Deployment guide
   - `/docs/ARCHITECTURE.md` - System architecture

2. **Test on Devnet**
   - Complete 100+ test claims
   - Monitor success rate
   - Check performance

3. **Prepare for Mainnet**
   - Security audit
   - Load testing
   - Monitor setup
   - Backup plan

## Getting Help

If you encounter issues:

1. Check this guide
2. Review error messages
3. Check logs
4. Search documentation
5. Open GitHub issue

## Resources

- [Solana Documentation](https://docs.solana.com/)
- [Anchor Documentation](https://www.anchor-lang.com/)
- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)

---

Happy coding! 🚀
