// JWT 相关常量
export const JWT_SECRET = process.env.JWT_SECRET || 'easy-dataset-dev-secret-change-in-production';
export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

if (!process.env.JWT_SECRET) {
  console.warn('⚠️  JWT_SECRET 未配置，使用默认值。生产环境请务必设置环境变量 JWT_SECRET。');
}

export const ROLES = {
  ADMIN: 'admin',
  USER: 'user'
};

export const PROJECT_ROLES = {
  OWNER: 'owner',
  EDITOR: 'editor',
  ANNOTATOR: 'annotator',
  VIEWER: 'viewer'
};

export const PROJECT_TYPES = {
  PERSONAL: 'personal',
  TEAM: 'team',
  DEMO: 'demo'
};
