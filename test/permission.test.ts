import { describe, it, expect, beforeEach } from 'vitest'
import {
  hasPermission,
  hasModulePermission,
  getRolePermissions,
  loadPermissionConfig,
  savePermissionConfig,
  migratePermissionList,
  invalidatePermissionConfigCache,
  DEFAULT_ROLE_CONFIG,
  type AppUser,
  type PermissionConfig,
} from '../src/services/appDataService'

function makeUser(role: string, perms?: string[]): AppUser {
  return {
    id: 'u1',
    email: 'a@b.c',
    username: 'u',
    nickname: 'U',
    role: role as AppUser['role'],
    disabled: false,
    permissions: perms,
  }
}

describe('权限: getRolePermissions', () => {
  it('superadmin 返回全部权限 key', () => {
    const perms = getRolePermissions('superadmin')
    expect(perms.length).toBeGreaterThan(0)
    expect(perms.every((k) => k.endsWith('.pc') || k.endsWith('.mobile'))).toBe(true)
  })

  it('普通用户默认拥有 USER_ALLOWED_BASES 内的权限', () => {
    const perms = getRolePermissions('user')
    expect(perms).toContain('dashboard.pc')
    expect(perms).toContain('news.mobile')
  })

  it('未知角色返回空数组（避免越权/神秘崩溃）', () => {
    expect(getRolePermissions('ghost-role')).toEqual([])
  })

  it('传入 config 优先于默认配置', () => {
    const cfg: PermissionConfig = {
      version: 2,
      roles: [{ key: 'custom', name: 'C', permissions: ['only.pc'] }],
    }
    expect(getRolePermissions('custom', cfg)).toEqual(['only.pc'])
  })
})

describe('权限: hasPermission', () => {
  it('null 用户始终 false（未登录禁访）', () => {
    expect(hasPermission(null, 'dashboard', 'pc')).toBe(false)
  })

  it('未知模块默认放行（防配置漂移导致菜单锁死）', () => {
    expect(hasPermission(makeUser('user'), 'future-module-xyz', 'pc')).toBe(true)
  })

  it('显式授权的精确 key 返回 true', () => {
    const u = makeUser('user', ['dashboard.pc'])
    expect(hasPermission(u, 'dashboard', 'pc')).toBe(true)
  })

  it('平台不匹配返回 false（PC 授权不扩展移动端）', () => {
    const u = makeUser('user', ['dashboard.pc'])
    expect(hasPermission(u, 'dashboard', 'mobile')).toBe(false)
  })

  it('父模块兜底：拥有子权限即视为拥有父模块', () => {
    const u = makeUser('user', ['system.accounts.pc'])
    expect(hasPermission(u, 'system', 'pc')).toBe(true)
  })

  it('用户 permissions 优先于角色默认权限', () => {
    // user 角色默认无 system.*，但显式赋予了
    const u = makeUser('user', ['system.pc'])
    expect(hasPermission(u, 'system', 'pc')).toBe(true)
  })

  it('无任何权限的普通用户访问 system 模块被拒', () => {
    const u = makeUser('user', [])
    expect(hasPermission(u, 'system', 'pc')).toBe(false)
  })
})

describe('权限: hasModulePermission', () => {
  it('任一平台有权即放行', () => {
    const u = makeUser('user', ['dashboard.mobile'])
    expect(hasModulePermission(u, 'dashboard')).toBe(true)
  })

  it('两平台都无权限则返回 false', () => {
    const u = makeUser('user', ['dashboard.pc'])
    expect(hasModulePermission(u, 'system')).toBe(false)
  })

  it('null 用户返回 false', () => {
    expect(hasModulePermission(null, 'dashboard')).toBe(false)
  })
})

describe('权限: migratePermissionList (v1→v2 迁移)', () => {
  it('v1 粗粒度 dashboard 展开为 v2 细粒度集合', () => {
    const out = migratePermissionList(['dashboard.pc'])
    expect(out).toContain('dashboard.pc')
    expect(out).toContain('news.pc')
    expect(out).toContain('weather.pc')
    expect(out).toContain('map.pc')
  })

  it('v1 粗粒度 ai 展开含 ai/models/aimodels', () => {
    const out = migratePermissionList(['ai.mobile'])
    expect(out).toContain('ai.mobile')
    expect(out).toContain('models.mobile')
    expect(out).toContain('aimodels.mobile')
  })

  it('已细粒度 key 幂等（不重复、不丢失）', () => {
    const once = migratePermissionList(['news.pc'])
    const twice = migratePermissionList(once)
    expect(twice.sort()).toEqual([...once].sort())
  })

  it('未知 legacy key 不会抛错', () => {
    expect(() => migratePermissionList(['zzz-unknown.pc'])).not.toThrow()
  })

  it('混合新旧 key 合并且去重', () => {
    const out = migratePermissionList(['dashboard.pc', 'news.pc'])
    expect(out).toContain('dashboard.pc')
    expect(out).toContain('news.pc')
    expect(out).toContain('weather.pc') // dashboard 展开项
    // 不出现重复
    expect(out.filter((k) => k === 'news.pc').length).toBe(1)
  })
})

describe('权限: loadPermissionConfig / savePermissionConfig（离线降级）', () => {
  beforeEach(() => invalidatePermissionConfigCache())

  it('load 返回含 superadmin 全权限的可用配置（Supabase 不可用时降级到默认）', async () => {
    const cfg = await loadPermissionConfig()
    expect(cfg.roles.some((r) => r.key === 'superadmin')).toBe(true)
    const sa = cfg.roles.find((r) => r.key === 'superadmin')!
    // 归一化后 superadmin 拥有全部权限 key
    expect(sa.permissions.length).toBeGreaterThan(0)
  })

  it('load 后 superadmin 权限 = 全部已知 key（防越权漏配）', async () => {
    const cfg = await loadPermissionConfig()
    const sa = cfg.roles.find((r) => r.key === 'superadmin')!
    const user = makeUser('superadmin', sa.permissions)
    // 随机抽一个已知 menu key 验证 superadmin 必有权
    expect(hasPermission(user, 'dashboard', 'pc')).toBe(true)
    expect(hasPermission(user, 'system', 'mobile')).toBe(true)
  })

  it('save 在 Supabase 不可用时返回 boolean 且不抛出', async () => {
    const ok = await savePermissionConfig(DEFAULT_ROLE_CONFIG)
    expect(typeof ok).toBe('boolean')
  })

  it('连续 load 命中 30s 缓存而非重复读取', async () => {
    const a = await loadPermissionConfig()
    const b = await loadPermissionConfig()
    expect(a).toBe(b) // 同一缓存对象引用
  })
})
