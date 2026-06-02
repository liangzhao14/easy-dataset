// 前端项目角色权限判断
// 角色等级与后端 lib/auth/middleware.js 保持一致；admin 视为最高
const LEVEL = { admin: 5, owner: 4, editor: 3, annotator: 2, viewer: 1 };

export const roleLevel = role => LEVEL[role] || 0;

// 写操作（生成、新增、编辑、删除、上传、分割等）：editor 及以上
export const canWrite = role => roleLevel(role) >= LEVEL.editor;

// 标注 / 确认操作（确认数据集、图片标注等）：annotator 及以上
export const canAnnotate = role => roleLevel(role) >= LEVEL.annotator;

// 成员管理：owner / admin
export const canManageMembers = role => roleLevel(role) >= LEVEL.owner;
