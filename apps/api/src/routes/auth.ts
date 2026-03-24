import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { createDocument, getDocument, findUserByEmail } from '../config/database';
import { generateTokens, generateAnonymousId, verifyRefreshToken, TokenPayload } from '../utils/jwt';
import { authMiddleware, refreshTokenMiddleware, AuthenticatedRequest } from '../middleware/auth';
import type { User, UserSettings } from '@apiforge/shared';

const router = Router();

const defaultUserSettings: UserSettings = {
  theme: 'dark',
  requestTimeout: 30000,
  sslVerification: true,
};

router.post('/register', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      res.status(400).json({ success: false, error: 'Email, password, and name are required' });
      return;
    }

    if (password.length < 8) {
      res.status(400).json({ success: false, error: 'Password must be at least 8 characters' });
      return;
    }

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
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ success: false, error: 'Email and password are required' });
      return;
    }

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

router.post('/refresh', refreshTokenMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
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

router.post('/logout', authMiddleware, (req: AuthenticatedRequest, res: Response): void => {
  res.clearCookie('accessToken');
  res.clearCookie('refreshToken');
  res.clearCookie('anonymousToken');
  res.json({ success: true, message: 'Logged out successfully' });
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
