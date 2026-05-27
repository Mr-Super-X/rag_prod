<!-- Parent: ../AGENTS.md -->

# scripts

## Purpose

一次性工具脚本。通过 `npx tsx scripts/xxx.ts` 运行。

## Key Files

| File | Description |
|------|-------------|
| `seed.ts` | 调用 `seedAdmin()` 创建初始管理员（admin/admin123），幂等 |

## For AI Agents

- 脚本用 tsx 直接运行，不编译
- 可以在 package.json 的 scripts 中添加快捷命令
