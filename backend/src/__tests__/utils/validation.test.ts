import { PublicKey } from '@solana/web3.js';

/**
 * Backend validation utilities
 */

// Validate Solana address
export const validateSolanaAddress = (address: string): boolean => {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
};

// Validate token amount
export const validateTokenAmount = (amount: string | number): boolean => {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return !isNaN(num) && num > 0 && isFinite(num);
};

// Validate airdrop data
export const validateAirdropData = (data: any): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!data.name || typeof data.name !== 'string' || data.name.length < 3) {
    errors.push('Name must be at least 3 characters');
  }

  if (!validateSolanaAddress(data.tokenMint)) {
    errors.push('Invalid token mint address');
  }

  if (!validateTokenAmount(data.totalSupply)) {
    errors.push('Invalid total supply');
  }

  if (!validateTokenAmount(data.tokensPerClaim)) {
    errors.push('Invalid tokens per claim');
  }

  return { valid: errors.length === 0, errors };
};

// Sanitize string input
export const sanitizeString = (input: string): string => {
  return input.trim().replace(/[<>]/g, '');
};

// Validate pagination parameters
export const validatePagination = (limit?: number, offset?: number): { limit: number; offset: number } => {
  const validLimit = Math.min(Math.max(limit || 10, 1), 100);
  const validOffset = Math.max(offset || 0, 0);
  return { limit: validLimit, offset: validOffset };
};

// Validate date range
export const validateDateRange = (startDate?: Date, endDate?: Date): boolean => {
  if (!startDate) return true;
  if (!endDate) return true;
  return startDate < endDate;
};

describe('Backend Validation Utils', () => {
  describe('validateSolanaAddress', () => {
    it('should validate correct Solana addresses', () => {
      expect(validateSolanaAddress('11111111111111111111111111111111')).toBe(true);
      expect(validateSolanaAddress('DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK')).toBe(true);
    });

    it('should reject invalid addresses', () => {
      expect(validateSolanaAddress('invalid')).toBe(false);
      expect(validateSolanaAddress('')).toBe(false);
      expect(validateSolanaAddress('too-short')).toBe(false);
    });
  });

  describe('validateTokenAmount', () => {
    it('should validate positive numbers', () => {
      expect(validateTokenAmount(100)).toBe(true);
      expect(validateTokenAmount('100')).toBe(true);
      expect(validateTokenAmount('100.5')).toBe(true);
    });

    it('should reject invalid amounts', () => {
      expect(validateTokenAmount(0)).toBe(false);
      expect(validateTokenAmount(-10)).toBe(false);
      expect(validateTokenAmount('invalid')).toBe(false);
      expect(validateTokenAmount(Infinity)).toBe(false);
      expect(validateTokenAmount(NaN)).toBe(false);
    });
  });

  describe('validateAirdropData', () => {
    const validData = {
      name: 'Test Airdrop',
      tokenMint: '11111111111111111111111111111111',
      totalSupply: '1000000',
      tokensPerClaim: '100',
    };

    it('should validate correct airdrop data', () => {
      const result = validateAirdropData(validData);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid name', () => {
      const result = validateAirdropData({ ...validData, name: 'ab' });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Name must be at least 3 characters');
    });

    it('should reject invalid token mint', () => {
      const result = validateAirdropData({ ...validData, tokenMint: 'invalid' });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid token mint address');
    });

    it('should reject invalid total supply', () => {
      const result = validateAirdropData({ ...validData, totalSupply: '0' });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid total supply');
    });

    it('should reject invalid tokens per claim', () => {
      const result = validateAirdropData({ ...validData, tokensPerClaim: '-10' });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid tokens per claim');
    });

    it('should return multiple errors for multiple issues', () => {
      const result = validateAirdropData({
        name: 'ab',
        tokenMint: 'invalid',
        totalSupply: '0',
        tokensPerClaim: '-10',
      });
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });
  });

  describe('sanitizeString', () => {
    it('should trim whitespace', () => {
      expect(sanitizeString('  hello  ')).toBe('hello');
      expect(sanitizeString('\n\tworld\n\t')).toBe('world');
    });

    it('should remove angle brackets', () => {
      expect(sanitizeString('<script>alert("xss")</script>')).toBe('scriptalert("xss")/script');
      expect(sanitizeString('Hello<>World')).toBe('HelloWorld');
    });

    it('should preserve normal text', () => {
      expect(sanitizeString('Normal text 123')).toBe('Normal text 123');
    });
  });

  describe('validatePagination', () => {
    it('should use default values', () => {
      const result = validatePagination();
      expect(result.limit).toBe(10);
      expect(result.offset).toBe(0);
    });

    it('should enforce minimum limit', () => {
      const result = validatePagination(0, 0);
      expect(result.limit).toBe(1);
    });

    it('should enforce maximum limit', () => {
      const result = validatePagination(200, 0);
      expect(result.limit).toBe(100);
    });

    it('should not allow negative offset', () => {
      const result = validatePagination(10, -5);
      expect(result.offset).toBe(0);
    });

    it('should accept valid values', () => {
      const result = validatePagination(50, 100);
      expect(result.limit).toBe(50);
      expect(result.offset).toBe(100);
    });
  });

  describe('validateDateRange', () => {
    it('should return true when no dates provided', () => {
      expect(validateDateRange()).toBe(true);
    });

    it('should return true when only start date provided', () => {
      expect(validateDateRange(new Date())).toBe(true);
    });

    it('should return true when only end date provided', () => {
      expect(validateDateRange(undefined, new Date())).toBe(true);
    });

    it('should validate correct date range', () => {
      const start = new Date('2024-01-01');
      const end = new Date('2024-12-31');
      expect(validateDateRange(start, end)).toBe(true);
    });

    it('should reject inverted date range', () => {
      const start = new Date('2024-12-31');
      const end = new Date('2024-01-01');
      expect(validateDateRange(start, end)).toBe(false);
    });

    it('should reject same dates', () => {
      const date = new Date('2024-01-01');
      expect(validateDateRange(date, date)).toBe(false);
    });
  });
});
