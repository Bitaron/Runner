import jwt from 'jsonwebtoken';
import {
  generateAccessToken,
  generateRefreshToken,
  generateTokens,
  verifyAccessToken,
  verifyRefreshToken,
  generateAnonymousId,
  TokenPayload,
} from '../jwt';

describe('JWT Utilities', () => {
  const testPayload: TokenPayload = {
    userId: 'user:123',
    email: 'test@example.com',
    isAnonymous: false,
  };

  describe('generateAccessToken', () => {
    it('should generate a valid access token', () => {
      const token = generateAccessToken(testPayload);
      
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });

    it('should include payload in the token', () => {
      const token = generateAccessToken(testPayload);
      const decoded = jwt.decode(token) as TokenPayload;
      
      expect(decoded.userId).toBe(testPayload.userId);
      expect(decoded.email).toBe(testPayload.email);
      expect(decoded.isAnonymous).toBe(testPayload.isAnonymous);
    });

    it('should set expiration time', () => {
      const token = generateAccessToken(testPayload);
      const decoded = jwt.decode(token) as jwt.JwtPayload;
      
      expect(decoded.exp).toBeDefined();
      expect(decoded.exp!).toBeGreaterThan(Math.floor(Date.now() / 1000));
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate a valid refresh token', () => {
      const token = generateRefreshToken(testPayload);
      
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);
    });

    it('should have longer expiration than access token', () => {
      const accessToken = generateAccessToken(testPayload);
      const refreshToken = generateRefreshToken(testPayload);
      
      const accessDecoded = jwt.decode(accessToken) as jwt.JwtPayload;
      const refreshDecoded = jwt.decode(refreshToken) as jwt.JwtPayload;
      
      const accessExpiry = accessDecoded.exp!;
      const refreshExpiry = refreshDecoded.exp!;
      
      // Refresh token should expire after access token
      expect(refreshExpiry - accessExpiry).toBeGreaterThan(0);
    });
  });

  describe('generateTokens', () => {
    it('should generate both access and refresh tokens', () => {
      const result = generateTokens(testPayload.userId, testPayload.email, testPayload.isAnonymous);
      
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.expiresIn).toBe(15 * 60); // 15 minutes
    });

    it('should create tokens with correct payload', () => {
      const result = generateTokens(testPayload.userId, testPayload.email);
      
      const accessDecoded = verifyAccessToken(result.accessToken);
      expect(accessDecoded.userId).toBe(testPayload.userId);
      expect(accessDecoded.email).toBe(testPayload.email);
      expect(accessDecoded.isAnonymous).toBe(false);
    });

    it('should handle anonymous users', () => {
      const result = generateTokens('anon:123', 'anon@test.com', true);
      
      const accessDecoded = verifyAccessToken(result.accessToken);
      expect(accessDecoded.isAnonymous).toBe(true);
    });
  });

  describe('verifyAccessToken', () => {
    it('should verify a valid access token', () => {
      const token = generateAccessToken(testPayload);
      const payload = verifyAccessToken(token);
      
      expect(payload.userId).toBe(testPayload.userId);
      expect(payload.email).toBe(testPayload.email);
    });

    it('should throw error for invalid token', () => {
      expect(() => verifyAccessToken('invalid-token')).toThrow();
    });

    it('should throw error for expired token', () => {
      const expiredToken = jwt.sign(testPayload, process.env.JWT_SECRET!, { expiresIn: '-1s' });
      
      expect(() => verifyAccessToken(expiredToken)).toThrow();
    });

    it('should throw error for token with wrong secret', () => {
      const tokenWithWrongSecret = jwt.sign(testPayload, 'wrong-secret');
      
      expect(() => verifyAccessToken(tokenWithWrongSecret)).toThrow();
    });
  });

  describe('verifyRefreshToken', () => {
    it('should verify a valid refresh token', () => {
      const token = generateRefreshToken(testPayload);
      const payload = verifyRefreshToken(token);
      
      expect(payload.userId).toBe(testPayload.userId);
      expect(payload.email).toBe(testPayload.email);
    });

    it('should throw error for invalid refresh token', () => {
      expect(() => verifyRefreshToken('invalid-token')).toThrow();
    });
  });

  describe('generateAnonymousId', () => {
    it('should generate a unique anonymous ID', () => {
      const id1 = generateAnonymousId();
      const id2 = generateAnonymousId();
      
      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
      expect(id1).not.toBe(id2);
    });

    it('should start with anon: prefix', () => {
      const id = generateAnonymousId();
      
      expect(id.startsWith('anon:')).toBe(true);
    });

    it('should be a valid UUID format', () => {
      const id = generateAnonymousId();
      const uuid = id.replace('anon:', '');
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      
      expect(uuidRegex.test(uuid)).toBe(true);
    });
  });
});
