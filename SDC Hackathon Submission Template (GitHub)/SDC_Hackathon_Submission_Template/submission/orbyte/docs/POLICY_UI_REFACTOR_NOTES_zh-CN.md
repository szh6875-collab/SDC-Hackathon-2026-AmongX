# Orbyte Policy & Monitoring 前端整理记录

## 本次调整

1. **Policy & Monitoring** 现在只包含三个清晰入口：
   - **Policy Overview**：日常查看政策要求、当前参考规则版本和来源核实状态。
   - **Ask Orbyte**：独立的政策问答入口，保留现有问答和引用逻辑。
   - **Advanced Policy Management**：仅向 SME Owner / Tax Advisor 展示，集中来源注册、抓取、规则包审核、来源快照、SHA-256、手动导入和详细诊断。
2. **Eligibility & Checks** 在导航中更名为 **Eligibility & Benefits**，只呈现两个同属业务资格流程的子页：资格/补贴/税务情境，以及推荐行动/计算器。
3. 原先散落在日常政策页里的详细来源卡、抓取诊断、快照与哈希视图已收进高级管理的可展开区块，默认收起，减少普通用户需要理解的技术信息。
4. 没有删除后端 API、Supabase 相关调用、SHA-256、快照、规则安全校验、手动导入或人工审批逻辑。
5. 旧路由别名仍映射至对应的新分组；无权管理政策来源的 Staff/Clerk 访问旧的来源路由时，会回到普通 Policy Overview。

## 验证范围与限制

- 已使用 TypeScript 的 TSX 转译检查确认本次修改的 `App.tsx`、`Sidebar.tsx` 和 `ComplianceOpportunitiesView.tsx` 没有语法诊断。
- 已检查路由映射和组件分支结构。
- 当前工作环境没有安装项目完整依赖，`tsc --noEmit` 因缺少 `@types/node` 和 `vite/client` 无法完成正式类型检查；因此本次尚未进行完整 Vite 构建或浏览器回归测试。
