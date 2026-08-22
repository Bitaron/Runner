import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { randomBytes, createHash } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { createDocument, getDocument, updateDocument, findUserByEmail, getDb } from '../config/database';
import {
  generateTokens,
  generateAnonymousId,
  verifyRefreshToken,
  decodeAccessToken,
  TokenPayload,
} from '../utils/jwt';
import { blacklistToken } from '../utils/tokenBlacklist';
import { authMiddleware, optionalAuth, refreshTokenMiddleware, AuthenticatedRequest } from '../middleware/auth';
import { sendPasswordReset } from '../services/emailService';
import type { User, UserSettings } from '@apiforge/shared';

const router = Router();

const defaultUserSettings: UserSettings = {
  theme: 'dark',
  requestTimeout: 30000,
  sslVerification: true,
};

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Za-z]/, 'Password must contain at least one letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

const registerSchema = z.object({
  email: z.string().email('Please provide a valid email address'),
  password: passwordSchema,
  name: z.string().trim().min(1, 'Name is required'),
});

const loginSchema = z.object({
  email: z.string().email('Please provide a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

const forgotPasswordSchema = z.object({
  email: z.string().email('Please provide a valid email address'),
});

const resetPasswordSchema = z.object({
  token: z.string().min(32, 'Invalid reset token'),
  password: passwordSchema,
});

const getFieldErrors = (error: z.ZodError): Record<string, string> => {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? '');
    if (field && !errors[field]) {
      errors[field] = issue.message;
    }
  }
  return errors;
};

router.post('/register', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        errors: getFieldErrors(parsed.error),
      });
      return;
    }

    const { email, password, name } = parsed.data;

    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      res.status(409).json({ success: false, error: 'Email already registered' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const userId = `user:${uuidv4()}`;

    const user: User = {
      _id: userId,
      type: 'user',
      email: email.toLowerCase(),
      passwordHash,
      name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      settings: defaultUserSettings,
      teams: [],
    };

    await createDocument(user);

    const tokens = generateTokens(userId, email);

    res.cookie('accessToken', tokens.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000,
    });

    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    const { passwordHash: _, ...userWithoutPassword } = user;
    res.status(201).json({
      success: true,
      data: { user: userWithoutPassword, ...tokens },
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ success: false, error: 'Registration failed' });
  }
});

router.post('/login', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        errors: getFieldErrors(parsed.error),
      });
      return;
    }

    const { email, password } = parsed.data;

    const user = await findUserByEmail(email);
    if (!user || !user.passwordHash) {
      res.status(401).json({ success: false, error: 'Invalid credentials' });
      return;
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      res.status(401).json({ success: false, error: 'Invalid credentials' });
      return;
    }

    const tokens = generateTokens(user._id, user.email);

    res.cookie('accessToken', tokens.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000,
    });

    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    const { passwordHash: _, ...userWithoutPassword } = user;
    res.json({
      success: true,
      data: { user: userWithoutPassword, ...tokens },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, error: 'Login failed' });
  }
});

router.post('/anonymous', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = generateAnonymousId();
    const tokens = generateTokens(userId, `${userId}@anonymous.local`, true);

    res.cookie('anonymousToken', tokens.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      success: true,
      data: {
        user: {
          _id: userId,
          type: 'user',
          email: `${userId}@anonymous.local`,
          name: 'Anonymous User',
          isAnonymous: true,
        },
        ...tokens,
      },
    });
  } catch (error) {
    console.error('Anonymous login error:', error);
    res.status(500).json({ success: false, error: 'Anonymous login failed' });
  }
});

router.post('/guest', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const guestId = uuidv4();
    const email = `guest-${guestId}@guest.local`;
    const password = randomBytes(32).toString('hex');
    const passwordHash = await bcrypt.hash(password, 12);
    const userId = `user:${guestId}`;

    const user: User = {
      _id: userId,
      type: 'user',
      email,
      passwordHash,
      name: 'Guest',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      settings: defaultUserSettings,
      teams: [],
    };

    await createDocument(user);

    const tokens = generateTokens(userId, email);

    res.cookie('accessToken', tokens.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000,
    });

    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    const { passwordHash: _, ...userWithoutPassword } = user;
    res.status(201).json({
      success: true,
      data: { user: userWithoutPassword, ...tokens },
    });
  } catch (error) {
    console.error('Guest login error:', error);
    res.status(500).json({ success: false, error: 'Guest login failed' });
  }
});

router.post('/refresh', refreshTokenMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    // Rotate: revoke the used refresh token so it cannot be replayed
    const previous = req.user as typeof req.user & { jti?: string; exp?: number };
    if (previous.jti && typeof previous.exp === 'number') {
      await blacklistToken(previous.jti, previous.exp);
    }

    const tokens = generateTokens(req.user.userId, req.user.email, req.user.isAnonymous);

    res.cookie('accessToken', tokens.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000,
    });

    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      success: true,
      data: tokens,
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json({ success: false, error: 'Token refresh failed' });
  }
});

router.post('/logout', optionalAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const blacklistFromHeader = async (): Promise<void> => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const decoded = decodeAccessToken(authHeader.substring(7));
      if (decoded?.jti && typeof decoded.exp === 'number') {
        await blacklistToken(decoded.jti, decoded.exp);
      }
    }
  };

  const revokeRefreshToken = async (): Promise<void> => {
    const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
    if (!refreshToken) return;
    try {
      const decoded = verifyRefreshToken(refreshToken);
      if (decoded.jti && typeof decoded.exp === 'number') {
        await blacklistToken(decoded.jti, decoded.exp);
      }
    } catch {
      // Invalid/expired refresh token; nothing to revoke
    }
  };

  await Promise.all([blacklistFromHeader(), revokeRefreshToken()]);

  res.clearCookie('accessToken');
  res.clearCookie('refreshToken');
  res.clearCookie('anonymousToken');
  res.json({ success: true, message: 'Logged out successfully' });
});

router.post('/forgot-password', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const parsed = forgotPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        errors: getFieldErrors(parsed.error),
      });
      return;
    }

    const { email } = parsed.data;
    const user = await findUserByEmail(email);

    if (user && !user.isAnonymous) {
      const token = randomBytes(32).toString('hex');
      const tokenHash = createHash('sha256').update(token).digest('hex');

      await updateDocument(user._id, {
        resetPasswordToken: tokenHash,
        resetPasswordExpires: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      });

      const webUrl = process.env.WEB_URL || 'http://localhost:3000';
      await sendPasswordReset({
        to: user.email,
        resetUrl: `${webUrl}/reset-password?token=${token}`,
        expiresInMinutes: 60,
      });
    }

    // Same response regardless of account existence to prevent enumeration
    res.json({
      success: true,
      message: 'If an account exists for that email, a password reset link has been sent.',
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ success: false, error: 'Failed to process password reset request' });
  }
});

router.post('/reset-password', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const parsed = resetPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        errors: getFieldErrors(parsed.error),
      });
      return;
    }

    const { token, password } = parsed.data;
    const tokenHash = createHash('sha256').update(token).digest('hex');

    const result = await getDb().find({ selector: { type: 'user', resetPasswordToken: tokenHash }, limit: 1 });
    const user = result.docs[0] as User | undefined;

    if (
      !user ||
      !user.resetPasswordExpires ||
      new Date(user.resetPasswordExpires).getTime() <= Date.now()
    ) {
      res.status(400).json({ success: false, error: 'Invalid or expired reset token' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await updateDocument(user._id, {
      passwordHash,
      resetPasswordToken: null,
      resetPasswordExpires: null,
    });

    res.json({ success: true, message: 'Password has been reset. You can now sign in.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ success: false, error: 'Failed to reset password' });
  }
});

router.get('/me', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    if (req.user.isAnonymous) {
      res.json({
        success: true,
        data: {
          _id: req.user.userId,
          type: 'user',
          email: req.user.email,
          name: 'Anonymous User',
          isAnonymous: true,
        },
      });
      return;
    }

    const user = await getDocument<User>(req.user.userId);
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    const { passwordHash: _, ...userWithoutPassword } = user;
    res.json({ success: true, data: userWithoutPassword });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ success: false, error: 'Failed to get user' });
  }
});

export default router;
