# Paper · 组会文献阅读系统

静态前端部署在 GitHub Pages，邮箱认证、记录及私有图片由 Supabase 提供。未配置后端时，页面明确显示未连接，不会伪造提交成功。

## 权限
- 任何拿到链接的人可先通过邮箱登录，再填写记录。
- 普通成员仅查看自己提交的记录。
- 管理员查看全部记录，并按邮箱授予、撤销全库查看权限。
- 授权查看者可以查看全部记录和图片，不能管理授权。
- 权限由 PostgreSQL RLS 与私有 Storage 策略执行，不依赖前端隐藏。
- 撤销权限阻止后续请求；已经查看或下载的内容无法收回。
- 本版本提交后不可修改或删除记录，避免附件误删；授权范围是全部记录。

## 部署（需要你操作 Supabase 账号）
1. 在 https://supabase.com/dashboard 创建项目，保存数据库密码。
2. 打开 SQL Editor，将 schema.sql 的 REPLACE_WITH_YOUR_ADMIN_EMAIL 替换成你实际使用的管理员邮箱（全部小写），再运行全部 SQL。不要保留占位符。此脚本用于新项目的一次性初始化。
3. 在 Project Settings / API 找到 Project URL 与 publishable key（或 anon key），填写 config.js。它们是可公开的前端配置；绝不能填 service_role 或 secret key。
4. Authentication 启用 Email 登录并允许新用户注册。配置自己的 SMTP 邮件服务；默认测试邮件服务有收件人及频率限制，不能作为正式组会群发邮件服务。
5. 在 Authentication / URL Configuration 将 Site URL 和允许的 Redirect URL 都设置为实际 GitHub Pages 地址，例如 https://brucelu.github.io/paper/ 。保留邮件模板中的登录链接。
6. GitHub 仓库 Settings → Pages → Build and deployment → Deploy from a branch，选择 main 和 /(root)，保存。等待 GitHub 部署成功，页面会显示真实访问地址。不要仅凭猜测地址判定发布成功。
7. 管理员先用步骤 2 的邮箱登录，进入“查看授权”，输入成员邮箱授权。成员先前已登录时，刷新页面即可更新角色。

## 上线前验证
用管理员、被授权成员和普通成员三个不同邮箱验证：普通成员提交后仅能看到自己记录；管理员和授权成员可看到全部；撤销成员授权并刷新后不能读取他人记录或图片。使用开发者工具直接请求数据库，也应受到相同 RLS 限制。配置真实项目后才能运行这些端到端权限测试。

## 图片与数据
支持最多六张 JPG、PNG、WebP，每张 5 MB。图片存储桶为私有，访问时按当前登录权限读取，不生成公开图片 URL。所有文本按纯文本展示。列表最多读取最近 1000 条；记录仍保留在数据库中。
上传图片后若写记录失败会尝试清理；网络异常可能留下孤立附件，可由管理员在 Supabase Storage 手动清理。不要在 GitHub 仓库保存真实阅读数据或密钥。

前端依赖 https://esm.sh/@supabase/supabase-js@2，需可访问该 CDN；正式环境可进一步锁定依赖版本并自行托管。

## 官方文档
- 邮箱登录：https://supabase.com/docs/guides/auth/auth-email-passwordless
- RLS：https://supabase.com/docs/guides/database/postgres/row-level-security
- 私有图片：https://supabase.com/docs/guides/storage/security/access-control
