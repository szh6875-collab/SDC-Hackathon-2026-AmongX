# Policy Alerts 与候选审核卡片调整

## 这次改动

- 日常 Policy Overview 不再显示旧的 Source Review Pending / Manual Import 审核卡。
- Advanced Policy Management 不再显示容易产生误解的 Candidate Rule Package 列表及 Staged Candidates 计数。
- 原本后端来源监测、规则包状态和审核 API 未删除，数据也未从 Supabase 删除；候选规则包列表的前端按钮暂时隐藏，因此这版 UI 不提供候选包批准/拒绝操作。
- 新增 Policy Alerts 子页：根据现有监测状态显示可能的来源内容变化、来源访问失败/无法验证，以及政策数据过期提示；页面每 2 分钟读取一次已保存的监测状态。
- 自动忽略 simulation 和 manual import 候选记录，避免测试数据被呈现成真实业务政策告警。
- “Check Sources”按钮调用现有检查 API；如无法访问网络，会显示失败或无法验证状态，不会假装实时同步成功。

## 重要限制

Policy Alerts 根据当前应用返回的监测数据生成。网页内容变化并不一定代表法律政策发生变化；只有在已配置的来源监测确实运行并返回状态时，页面才能显示对应信号。此改动没有新增后台定时任务，也没有修改 Supabase schema。
