import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, verifyRefreshToken, TokenPayload } from '../utils/jwt';
import { isTokenBlacklisted } from '../utils/tokenBlacklist';

export interface AuthenticatedRequest extends Request {
  user?: TokenPayload;
}

export const authMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'No token provided' });
    return;
  }

  const token = authHeader.substring(7);

  try {
    const payload = verifyAccessToken(token);
    if (await isTokenBlacklisted(payload.jti)) {
      res.status(401).json({ success: false, error: 'Token revoked' });
      return;
    }
    req.user = payload;
    next();
  } catch (error) {
    if (error instanceof Error && error.name === 'TokenExpiredError') {
      res.status(401).json({ success: false, error: 'Token expired' });
      return;
    }
    res.status(401).json({ success: false, error: 'Invalid token' });
  }
};

export const optionalAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      const payload = verifyAccessToken(token);
      if (await isTokenBlacklisted(payload.jti)) {
        next();
        return;
      }
      req.user = payload;
    } catch {
      // Token invalid, but continue without user
    }
  }

  next();
};

export const refreshTokenMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;

  if (!refreshToken) {
    res.status(401).json({ success: false, error: 'No refresh token provided' });
    return;
  }

  try {
    const payload = verifyRefreshToken(refreshToken);
    if (await isTokenBlacklisted(payload.jti)) {
      res.status(401).json({ success: false, error: 'Refresh token revoked' });
      return;
    }
    (req as AuthenticatedRequest).user = payload;
    next();
  } catch (error) {
    res.status(401).json({ success: false, error: 'Invalid refresh token' });
  }
};
