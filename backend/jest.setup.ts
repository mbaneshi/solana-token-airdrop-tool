// Mock Prisma Client
jest.mock('./src/config/database', () => ({
  __esModule: true,
  default: {
    usersClaim: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    airdrop: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    whitelist: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      createMany: jest.fn(),
    },
    blacklist: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    transaction: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

// Mock Redis
jest.mock('./src/config/redis', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    set: jest.fn(),
    setex: jest.fn(),
    del: jest.fn(),
    incr: jest.fn(),
    expire: jest.fn(),
  },
}));

// Mock logger
jest.mock('./src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Set test environment variables
process.env.JWT_SECRET = 'test-secret';
process.env.TOKEN_MINT = '11111111111111111111111111111111';
process.env.SOLANA_RPC_URL = 'https://api.devnet.solana.com';
