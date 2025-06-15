/**
 * Mock Authentication Service
 * 개발 환경을 위한 간단한 인증 서비스
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-change-in-production';

// Mock 사용자 데이터베이스
const users = [
  {
    id: '1',
    username: 'admin',
    password: 'admin123', // 실제 환경에서는 bcrypt 해시 사용
    email: 'admin@mcp.local',
    roles: [
      { id: 'admin', name: 'Administrator' }
    ],
    permissions: ['*'] // 모든 권한
  },
  {
    id: '2', 
    username: 'developer',
    password: 'dev123',
    email: 'dev@mcp.local',
    roles: [
      { id: 'developer', name: 'Developer' }
    ],
    permissions: ['read', 'write', 'execute']
  }
];

export const authRoutes = (app: any) => {
  // 로그인 엔드포인트
  app.post('/api/auth/login', async (req: Request, res: Response) => {
    try {
      const { username, password } = req.body;

      // 사용자 찾기
      const user = users.find(u => u.username === username);
      
      if (!user || user.password !== password) {
        return res.status(401).json({
          success: false,
          error: 'Invalid credentials'
        });
      }

      // JWT 토큰 생성
      const accessToken = jwt.sign(
        {
          sub: user.id,
          username: user.username,
          email: user.email,
          roles: user.roles.map(r => r.id),
          permissions: user.permissions
        },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      const refreshToken = jwt.sign(
        { sub: user.id },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      // 사용자 정보 반환 (비밀번호 제외)
      const { password: _, ...userWithoutPassword } = user;

      res.json({
        success: true,
        data: {
          user: userWithoutPassword,
          accessToken,
          refreshToken,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  });

  // 토큰 갱신 엔드포인트
  app.post('/api/auth/refresh', async (req: Request, res: Response) => {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(401).json({
          success: false,
          error: 'Refresh token required'
        });
      }

      // 토큰 검증
      const decoded = jwt.verify(refreshToken, JWT_SECRET) as any;
      const user = users.find(u => u.id === decoded.sub);

      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'User not found'
        });
      }

      // 새 토큰 생성
      const accessToken = jwt.sign(
        {
          sub: user.id,
          username: user.username,
          email: user.email,
          roles: user.roles.map(r => r.id),
          permissions: user.permissions
        },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      res.json({
        success: true,
        data: {
          accessToken,
          refreshToken,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        }
      });
    } catch (error) {
      res.status(401).json({
        success: false,
        error: 'Invalid refresh token'
      });
    }
  });

  // 로그아웃 엔드포인트
  app.post('/api/auth/logout', (req: Request, res: Response) => {
    // 실제 환경에서는 토큰 블랙리스트 처리
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  });

  // 현재 사용자 정보
  app.get('/api/auth/me', authenticateToken, (req: any, res: Response) => {
    const user = users.find(u => u.id === req.user.sub);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const { password: _, ...userWithoutPassword } = user;
    res.json({
      success: true,
      data: userWithoutPassword
    });
  });
};

// JWT 인증 미들웨어
export function authenticateToken(req: any, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Access token required'
    });
  }

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) {
      return res.status(403).json({
        success: false,
        error: 'Invalid token'
      });
    }
    req.user = user;
    next();
  });
}