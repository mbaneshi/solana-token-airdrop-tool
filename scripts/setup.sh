#!/bin/bash

# Solana Token Airdrop Platform - Setup Script
# This script automates the initial setup process

set -e  # Exit on error

echo "🚀 Solana Token Airdrop Platform - Setup Script"
echo "================================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Print colored message
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

# Check prerequisites
echo "Checking prerequisites..."
echo ""

MISSING_DEPS=0

if command_exists node; then
    NODE_VERSION=$(node --version)
    print_success "Node.js installed: $NODE_VERSION"
else
    print_error "Node.js not found. Please install Node.js 18+"
    MISSING_DEPS=1
fi

if command_exists rust; then
    RUST_VERSION=$(rustc --version)
    print_success "Rust installed: $RUST_VERSION"
else
    print_error "Rust not found. Please install from https://rustup.rs/"
    MISSING_DEPS=1
fi

if command_exists solana; then
    SOLANA_VERSION=$(solana --version)
    print_success "Solana CLI installed: $SOLANA_VERSION"
else
    print_error "Solana CLI not found. Please install from https://docs.solana.com/cli/install-solana-cli-tools"
    MISSING_DEPS=1
fi

if command_exists anchor; then
    ANCHOR_VERSION=$(anchor --version)
    print_success "Anchor CLI installed: $ANCHOR_VERSION"
else
    print_error "Anchor CLI not found. Please install from https://www.anchor-lang.com/docs/installation"
    MISSING_DEPS=1
fi

if command_exists psql; then
    PSQL_VERSION=$(psql --version)
    print_success "PostgreSQL installed: $PSQL_VERSION"
else
    print_warning "PostgreSQL not found. Please install PostgreSQL 14+"
    MISSING_DEPS=1
fi

if command_exists redis-cli; then
    REDIS_VERSION=$(redis-cli --version)
    print_success "Redis installed: $REDIS_VERSION"
else
    print_warning "Redis not found. Please install Redis 6+"
    MISSING_DEPS=1
fi

echo ""

if [ $MISSING_DEPS -eq 1 ]; then
    print_error "Some prerequisites are missing. Please install them and run this script again."
    exit 1
fi

print_success "All prerequisites are installed!"
echo ""

# Configure Solana CLI
echo "Configuring Solana CLI for devnet..."
solana config set --url devnet
print_success "Solana CLI configured for devnet"
echo ""

# Check if keypair exists
if [ ! -f ~/.config/solana/id.json ]; then
    echo "Creating new Solana keypair..."
    solana-keygen new --no-bip39-passphrase
    print_success "Keypair created at ~/.config/solana/id.json"
else
    print_success "Solana keypair already exists"
fi

# Airdrop SOL
echo ""
echo "Requesting devnet SOL airdrop..."
if solana airdrop 2 2>/dev/null; then
    print_success "Airdrop successful"
else
    print_warning "Airdrop failed (rate limited). Try again later or use a faucet."
fi

BALANCE=$(solana balance)
echo "Current balance: $BALANCE"
echo ""

# Install dependencies
echo "Installing dependencies..."
echo ""

echo "Installing backend dependencies..."
cd backend
npm install
print_success "Backend dependencies installed"
echo ""

echo "Installing frontend dependencies..."
cd ../app
npm install
print_success "Frontend dependencies installed"
cd ..
echo ""

# Setup environment files
echo "Setting up environment files..."

if [ ! -f backend/.env ]; then
    cp backend/.env.example backend/.env
    print_success "Created backend/.env from template"
    print_warning "Please edit backend/.env with your configuration"
else
    print_warning "backend/.env already exists, skipping"
fi

if [ ! -f app/.env ]; then
    cp app/.env.example app/.env
    print_success "Created app/.env from template"
    print_warning "Please edit app/.env with your configuration"
else
    print_warning "app/.env already exists, skipping"
fi

echo ""

# Setup database
echo "Setting up database..."
read -p "Do you want to setup the database now? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    read -p "Enter database name (default: airdrop_dev): " DB_NAME
    DB_NAME=${DB_NAME:-airdrop_dev}

    if command_exists createdb; then
        createdb $DB_NAME 2>/dev/null && print_success "Database $DB_NAME created" || print_warning "Database might already exist"
    else
        print_warning "createdb command not found. Please create database manually: CREATE DATABASE $DB_NAME;"
    fi

    echo "Running database migrations..."
    cd backend
    npx prisma generate
    npx prisma migrate dev
    print_success "Database migrations completed"
    cd ..
else
    print_warning "Skipping database setup. Run 'cd backend && npx prisma migrate dev' later"
fi

echo ""

# Build and deploy program
echo "Building Anchor program..."
if anchor build; then
    print_success "Anchor program built successfully"
else
    print_error "Failed to build Anchor program"
    exit 1
fi

echo ""
echo "Deploying program to devnet..."
read -p "Do you want to deploy the program now? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    DEPLOY_OUTPUT=$(anchor deploy --provider.cluster devnet 2>&1)

    if echo "$DEPLOY_OUTPUT" | grep -q "Program Id:"; then
        PROGRAM_ID=$(echo "$DEPLOY_OUTPUT" | grep "Program Id:" | awk '{print $3}')
        print_success "Program deployed successfully!"
        echo "Program ID: $PROGRAM_ID"

        # Update configuration files
        echo ""
        echo "Updating configuration with Program ID..."

        # Update backend .env
        if [[ "$OSTYPE" == "darwin"* ]]; then
            sed -i '' "s/PROGRAM_ID=.*/PROGRAM_ID=$PROGRAM_ID/" backend/.env
            sed -i '' "s/NEXT_PUBLIC_PROGRAM_ID=.*/NEXT_PUBLIC_PROGRAM_ID=$PROGRAM_ID/" app/.env
        else
            sed -i "s/PROGRAM_ID=.*/PROGRAM_ID=$PROGRAM_ID/" backend/.env
            sed -i "s/NEXT_PUBLIC_PROGRAM_ID=.*/NEXT_PUBLIC_PROGRAM_ID=$PROGRAM_ID/" app/.env
        fi

        print_success "Configuration files updated with Program ID"
    else
        print_error "Failed to deploy program"
        echo "$DEPLOY_OUTPUT"
    fi
else
    print_warning "Skipping program deployment. Run 'anchor deploy --provider.cluster devnet' later"
fi

echo ""
echo "================================================"
print_success "Setup completed!"
echo ""
echo "Next steps:"
echo "1. Edit backend/.env with your configuration"
echo "2. Edit app/.env with your configuration"
echo "3. Start Redis: redis-server"
echo "4. Start backend: cd backend && npm run dev"
echo "5. Start frontend: cd app && npm run dev"
echo ""
echo "Access the application:"
echo "- Frontend: http://localhost:3001"
echo "- Backend API: http://localhost:3000"
echo "- API Health: http://localhost:3000/health"
echo ""
echo "For detailed instructions, see docs/SETUP.md"
echo "================================================"
