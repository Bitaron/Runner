import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

const resolveSecret = (envVar: string): string => {
  const value = process.env[envVar];
  if (value) return value;
  if (process.env.NODE_ENV === 'production') {
    throw new Error(`FATAL: ${envVar} environment variable must be set in production`);
  }
  console.warn(
    `[SECURITY WARNING] ${envVar} is not set. Using a random per-process secret; ` +
      'all tokens will be invalidated on every restart. Set it explicitly for stable sessions.'
  );
  return crypto.randomBytes(32).toString('hex');
};

const JWT_SECRET = resolveSecret('JWT_SECRET');
const JWT_REFRESH_SECRET = resolveSecret('JWT_REFRESH_SECRET');
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';

export interface TokenPayload {
  userId: string;
  email: string;
  isAnonymous: boolean;
  teams?: string[];
}

export type DecodedTokenPayload = TokenPayload & jwt.JwtPayload;

export const generateAccessToken = (payload: TokenPayload): string => {
  return jwt.sign({ ...payload, jti: uuidv4() }, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
};

export const generateRefreshToken = (payload: TokenPayload): string => {
  return jwt.sign({ ...payload, jti: uuidv4() }, JWT_REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });
};

export const verifyAccessToken = (token: string): DecodedTokenPayload => {
  return jwt.verify(token, JWT_SECRET) as DecodedTokenPayload;
};

export const verifyRefreshToken = (token: string): DecodedTokenPayload => {
  return jwt.verify(token, JWT_REFRESH_SECRET) as DecodedTokenPayload;
};

export const decodeAccessToken = (token: string): DecodedTokenPayload | null => {
  return jwt.decode(token) as DecodedTokenPayload | null;
};

export const generateTokens = (userId: string, email: string, isAnonymous = false): {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
} => {
  const payload: TokenPayload = { userId, email, isAnonymous };
  return {
    accessToken: generateAccessToken(payload),
    refreshToken: generateRefreshToken(payload),
    expiresIn: 15 * 60,
  };
};

export const generateAnonymousId = (): string => {
  return `anon:${uuidv4()}`;
};
