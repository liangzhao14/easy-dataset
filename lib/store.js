import { atom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';

// 模型配置列表
export const modelConfigListAtom = atomWithStorage('modelConfigList', []);
export const selectedModelInfoAtom = atomWithStorage('selectedModelInfo', null);

// 当前用户对当前项目的角色：admin/owner/editor/annotator/viewer（随项目切换，不持久化）
export const projectRoleAtom = atom(null);
