// Validation utilities tests
import { PublicKey } from '@solana/web3.js';

/**
 * Validation utilities for the airdrop platform
 */

// Validate Solana wallet address
export const isValidSolanaAddress = (address: string): boolean => {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
};

// Validate token amount
export const isValidTokenAmount = (amount: number): boolean => {
  return amount > 0 && Number.isFinite(amount) && amount <= Number.MAX_SAFE_INTEGER;
};

// Validate email format
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Sanitize user input
export const sanitizeInput = (input: string): string => {
  return input.trim().replace(/[<>]/g, '');
};

// Validate claim status
export const isValidClaimStatus = (status: string): boolean => {
  const validStatuses = ['pending', 'processing', 'completed', 'failed'];
  return validStatuses.includes(status);
};

describe('Validation Utils', () => {
  describe('isValidSolanaAddress', () => {
    it('should return true for valid Solana address', () => {
      const validAddress = '11111111111111111111111111111111';
      expect(isValidSolanaAddress(validAddress)).toBe(true);
    });

    it('should return false for invalid Solana address', () => {
      const invalidAddress = 'invalid-address';
      expect(isValidSolanaAddress(invalidAddress)).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isValidSolanaAddress('')).toBe(false);
    });

    it('should return false for special characters', () => {
      expect(isValidSolanaAddress('!!!@@@###')).toBe(false);
    });

    it('should validate real Solana public key', () => {
      const realAddress = 'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK';
      expect(isValidSolanaAddress(realAddress)).toBe(true);
    });
  });

  describe('isValidTokenAmount', () => {
    it('should return true for positive numbers', () => {
      expect(isValidTokenAmount(100)).toBe(true);
      expect(isValidTokenAmount(1)).toBe(true);
      expect(isValidTokenAmount(1000000)).toBe(true);
    });

    it('should return false for zero', () => {
      expect(isValidTokenAmount(0)).toBe(false);
    });

    it('should return false for negative numbers', () => {
      expect(isValidTokenAmount(-1)).toBe(false);
      expect(isValidTokenAmount(-100)).toBe(false);
    });

    it('should return false for infinity', () => {
      expect(isValidTokenAmount(Infinity)).toBe(false);
      expect(isValidTokenAmount(-Infinity)).toBe(false);
    });

    it('should return false for NaN', () => {
      expect(isValidTokenAmount(NaN)).toBe(false);
    });

    it('should return false for numbers exceeding MAX_SAFE_INTEGER', () => {
      expect(isValidTokenAmount(Number.MAX_SAFE_INTEGER + 1)).toBe(false);
    });

    it('should return true for decimal numbers', () => {
      expect(isValidTokenAmount(10.5)).toBe(true);
      expect(isValidTokenAmount(0.001)).toBe(true);
    });
  });

  describe('isValidEmail', () => {
    it('should return true for valid email addresses', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name@domain.co')).toBe(true);
      expect(isValidEmail('user+tag@example.com')).toBe(true);
    });

    it('should return false for invalid email addresses', () => {
      expect(isValidEmail('invalid')).toBe(false);
      expect(isValidEmail('invalid@')).toBe(false);
      expect(isValidEmail('@example.com')).toBe(false);
      expect(isValidEmail('invalid@.com')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isValidEmail('')).toBe(false);
    });

    it('should return false for email without domain', () => {
      expect(isValidEmail('user@')).toBe(false);
    });

    it('should return false for email with spaces', () => {
      expect(isValidEmail('user @example.com')).toBe(false);
      expect(isValidEmail('user@exam ple.com')).toBe(false);
    });
  });

  describe('sanitizeInput', () => {
    it('should trim whitespace', () => {
      expect(sanitizeInput('  hello  ')).toBe('hello');
      expect(sanitizeInput('\n\tworld\t\n')).toBe('world');
    });

    it('should remove dangerous characters', () => {
      expect(sanitizeInput('<script>alert("xss")</script>')).toBe('scriptalert("xss")/script');
      expect(sanitizeInput('Hello<>World')).toBe('HelloWorld');
    });

    it('should handle empty strings', () => {
      expect(sanitizeInput('')).toBe('');
      expect(sanitizeInput('   ')).toBe('');
    });

    it('should preserve normal text', () => {
      expect(sanitizeInput('Normal text 123')).toBe('Normal text 123');
      expect(sanitizeInput('user@example.com')).toBe('user@example.com');
    });

    it('should handle special characters except angle brackets', () => {
      expect(sanitizeInput('Hello!@#$%^&*()')).toBe('Hello!@#$%^&*()');
      expect(sanitizeInput('Price: $100')).toBe('Price: $100');
    });
  });

  describe('isValidClaimStatus', () => {
    it('should return true for valid claim statuses', () => {
      expect(isValidClaimStatus('pending')).toBe(true);
      expect(isValidClaimStatus('processing')).toBe(true);
      expect(isValidClaimStatus('completed')).toBe(true);
      expect(isValidClaimStatus('failed')).toBe(true);
    });

    it('should return false for invalid claim statuses', () => {
      expect(isValidClaimStatus('invalid')).toBe(false);
      expect(isValidClaimStatus('PENDING')).toBe(false);
      expect(isValidClaimStatus('')).toBe(false);
    });

    it('should be case sensitive', () => {
      expect(isValidClaimStatus('Pending')).toBe(false);
      expect(isValidClaimStatus('COMPLETED')).toBe(false);
    });

    it('should not accept partial matches', () => {
      expect(isValidClaimStatus('pend')).toBe(false);
      expect(isValidClaimStatus('complete')).toBe(false);
    });
  });
});
