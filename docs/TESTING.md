# Testing Guide

## Overview

This document provides comprehensive testing guidelines for the Solana Token Airdrop Platform. Our test suite includes unit tests, integration tests, and end-to-end tests with a minimum coverage threshold of 85%.

## Table of Contents

- [Test Architecture](#test-architecture)
- [Running Tests](#running-tests)
- [Frontend Testing](#frontend-testing)
- [Backend Testing](#backend-testing)
- [Coverage Requirements](#coverage-requirements)
- [Writing Tests](#writing-tests)
- [CI/CD Integration](#cicd-integration)

## Test Architecture

### Testing Stack

**Frontend:**
- Jest - Test runner
- React Testing Library - Component testing
- @testing-library/react-hooks - Hook testing
- Mock Service Worker (MSW) - API mocking

**Backend:**
- Jest - Test runner
- Supertest - HTTP assertion
- ts-jest - TypeScript support

**Smart Contract:**
- Anchor test framework
- Solana test validator

## Running Tests

### All Tests

```bash
# Run all tests (Anchor, Backend, Frontend)
npm test

# Run tests with coverage
npm run test:coverage
```

### Frontend Tests

```bash
# Navigate to frontend
cd app

# Run all frontend tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run specific test file
npm test ClaimButton.test.tsx

# Run tests with coverage
npm test -- --coverage

# Run tests with verbose output
npm test -- --verbose
```

### Backend Tests

```bash
# Navigate to backend
cd backend

# Run all backend tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run specific test file
npm test claim.controller.test.ts

# Run tests with coverage
npm test -- --coverage

# Run tests matching pattern
npm test -- --testNamePattern="should validate"
```

### Smart Contract Tests

```bash
# Run Anchor tests (requires local validator)
anchor test

# Run tests on specific network
anchor test --provider.cluster devnet

# Skip local validator (use existing)
anchor test --skip-local-validator
```

## Frontend Testing

### Unit Tests Location

```
app/src/__tests__/
├── components/
│   ├── ClaimButton.test.tsx
│   ├── Dashboard.test.tsx
│   └── WalletConnect.test.tsx
├── hooks/
│   ├── useClaim.test.ts
│   ├── useAirdrop.test.ts
│   └── useClaimStatus.test.ts
└── utils/
    └── validation.test.ts
```

### Component Testing

Components are tested using React Testing Library with focus on user interactions:

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { ClaimButton } from '@/components/ClaimButton';

test('should call claimTokens when button is clicked', async () => {
  render(<ClaimButton />);
  const button = screen.getByRole('button', { name: 'Claim Tokens' });
  fireEvent.click(button);
  // assertions...
});
```

### Hook Testing

Custom hooks are tested with `@testing-library/react-hooks`:

```typescript
import { renderHook, act } from '@testing-library/react';
import { useClaim } from '@/hooks/useClaim';

test('should successfully complete claim flow', async () => {
  const { result } = renderHook(() => useClaim());
  await act(async () => {
    await result.current.claimTokens();
  });
  // assertions...
});
```

### What We Test

- User interactions (clicks, form submissions)
- Component rendering
- State management
- API calls and responses
- Error handling
- Loading states
- Edge cases

## Backend Testing

### Unit Tests Location

```
backend/src/__tests__/
├── controllers/
│   ├── claim.controller.test.ts
│   └── airdrop.controller.test.ts
├── services/
│   ├── claim.service.test.ts
│   ├── queue.service.test.ts
│   └── retry.service.test.ts
└── utils/
    ├── antisybil.test.ts
    └── validation.test.ts
```

### Controller Testing

Controllers are tested using Supertest for HTTP assertions:

```typescript
import request from 'supertest';
import app from '../app';

describe('POST /api/v1/claim', () => {
  it('should successfully create a claim', async () => {
    const response = await request(app)
      .post('/api/v1/claim')
      .send({})
      .expect(200);

    expect(response.body.success).toBe(true);
  });
});
```

### Service Testing

Services are tested with mocked dependencies:

```typescript
import { processClaimBatch } from '../services/distribution.service';

describe('processClaimBatch', () => {
  it('should process a claim successfully', async () => {
    const result = await processClaimBatch([mockClaimJob]);
    expect(result.success).toBe(true);
  });
});
```

### What We Test

- API endpoints and responses
- Business logic
- Database operations
- Queue operations
- Error handling
- Validation
- Anti-sybil mechanisms

## Coverage Requirements

### Minimum Thresholds

```json
{
  "branches": 85,
  "functions": 85,
  "lines": 85,
  "statements": 85
}
```

### Checking Coverage

```bash
# Frontend coverage
cd app && npm test -- --coverage

# Backend coverage
cd backend && npm test -- --coverage

# View HTML report
open coverage/lcov-report/index.html
```

### Coverage Reports

Coverage reports are generated in the `coverage/` directory:
- `coverage/lcov-report/index.html` - HTML report
- `coverage/lcov.info` - LCOV format
- `coverage/coverage-final.json` - JSON format

## Writing Tests

### Best Practices

1. **Test Behavior, Not Implementation**
   ```typescript
   // Good
   expect(screen.getByText('Claim successful')).toBeInTheDocument();

   // Avoid
   expect(component.state.isSuccess).toBe(true);
   ```

2. **Use Descriptive Test Names**
   ```typescript
   // Good
   test('should show error message when claim fails', () => {});

   // Avoid
   test('claim error', () => {});
   ```

3. **Arrange-Act-Assert Pattern**
   ```typescript
   test('should calculate risk score correctly', async () => {
     // Arrange
     const wallet = 'wallet123';
     const ip = '192.168.1.1';

     // Act
     const score = await calculateRiskScore(wallet, ip);

     // Assert
     expect(score).toBeGreaterThan(0);
   });
   ```

4. **Mock External Dependencies**
   ```typescript
   jest.mock('@/lib/api', () => ({
     api: {
       submitClaim: jest.fn().mockResolvedValue({ success: true }),
     },
   }));
   ```

5. **Test Edge Cases**
   ```typescript
   test('should handle empty wallet address', () => {
     expect(validateWallet('')).toBe(false);
   });

   test('should handle null values', () => {
     expect(validateWallet(null)).toBe(false);
   });
   ```

### Test Structure

```typescript
describe('ComponentName or FunctionName', () => {
  // Setup
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Cleanup
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('specific functionality', () => {
    it('should do something specific', () => {
      // test implementation
    });

    it('should handle errors', () => {
      // test implementation
    });
  });
});
```

## CI/CD Integration

### GitHub Actions Workflow

Tests run automatically on:
- Pull requests
- Pushes to main branch
- Manual workflow dispatch

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: npm install
      - run: npm test -- --coverage
      - run: npm run test:integration
```

### Pre-commit Hooks

Tests run locally before commits:

```bash
# Install husky
npm install --save-dev husky

# Add pre-commit hook
npx husky add .husky/pre-commit "npm test"
```

## Integration Tests

Integration tests verify the interaction between components:

```bash
# Run integration tests
npm run test:integration

# Integration test location
tests/integration/
├── claim-flow.test.ts
├── airdrop-management.test.ts
└── queue-processing.test.ts
```

## E2E Tests (Optional)

End-to-end tests using Playwright or Cypress:

```bash
# Run E2E tests
npm run test:e2e

# E2E test location
e2e/
├── claim-tokens.spec.ts
├── wallet-connection.spec.ts
└── admin-dashboard.spec.ts
```

## Debugging Tests

### VS Code Configuration

Add to `.vscode/launch.json`:

```json
{
  "type": "node",
  "request": "launch",
  "name": "Jest Debug",
  "program": "${workspaceFolder}/node_modules/.bin/jest",
  "args": ["--runInBand", "--no-cache"],
  "console": "integratedTerminal",
  "internalConsoleOptions": "neverOpen"
}
```

### Debug Specific Test

```bash
# Run single test with debugging
node --inspect-brk node_modules/.bin/jest --runInBand path/to/test.ts
```

## Common Issues

### Issue: Tests timeout
**Solution:** Increase timeout in jest.config.js
```javascript
testTimeout: 10000
```

### Issue: Mock not working
**Solution:** Clear mocks in beforeEach
```typescript
beforeEach(() => {
  jest.clearAllMocks();
});
```

### Issue: Async tests failing
**Solution:** Use async/await properly
```typescript
test('async test', async () => {
  await waitFor(() => {
    expect(screen.getByText('Success')).toBeInTheDocument();
  });
});
```

## Performance

### Running Tests Faster

```bash
# Run tests in parallel
npm test -- --maxWorkers=4

# Run only changed files
npm test -- --onlyChanged

# Run tests without coverage
npm test -- --no-coverage
```

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
- [Anchor Testing Guide](https://book.anchor-lang.com/anchor_in_depth/testing.html)

## Support

For testing help:
1. Check this documentation
2. Review existing test examples
3. Ask in team chat
4. Open an issue on GitHub
