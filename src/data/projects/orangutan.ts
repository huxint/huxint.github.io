// Facts verified against ~/Projects/orangutan at fc351f0 (2026-09-04).
// See public/images/projects/orangutan/SOURCES.md for the correction log.
export const orangutan = {
  name: 'Orangutan',
  tagline: '用 C++23 构建的本地 AI Agent 运行时',
  description:
    'Orangutan 是一个用 C++23 写的本地 AI Agent 运行时：ReAct 循环、工具调用、权限控制、多模型适配、长期记忆、多 Agent 协作与定时自动化装在同一个二进制里，命令行、HTTP 与 QQ 三类入口共享同一个 Agent。',
  repo: 'https://github.com/huxint/orangutan',
  docs: {
    readme: 'https://github.com/huxint/orangutan#readme',
    architecture:
      'https://github.com/huxint/orangutan/blob/main/docs/architecture.md',
  },
  license: 'Proprietary，保留所有权利',
  verifiedAt: '2026-09-04 · fc351f0',
  facts: [
    { label: '语言', value: 'C++23' },
    { label: '构建', value: 'xmake · Catch2' },
    { label: '存储', value: 'SQLite' },
    { label: '入口', value: '命令行 · HTTP · QQ' },
  ],
  capabilities: [
    {
      title: 'ReAct 循环与工具调用',
      body: '每次提问最多跑 20 轮「想一步、用工具、再想一步」，直到模型不再请求工具。回答撞到长度上限自动续写，同一工具重复调用先警告再中止，避免原地打转。',
    },
    {
      title: '权限规则',
      body: '文件、命令、脚本和 MCP 工具在执行前经过 allow / deny / ask 规则与命令安全检查，高风险操作停下来等人确认。',
    },
    {
      title: '多模型适配',
      body: 'Anthropic Messages、OpenAI Chat Completions 与 Responses 三套协议收进适配层。一条路由等于主模型加一串兜底模型，重试与切换在执行层完成，Agent 侧无感。',
    },
    {
      title: '会话与长期记忆',
      body: '会话历史逐条写入 SQLite，可保存、可恢复。跨会话事实沉淀为长期记忆，按运行时作用域隔离；召回只在进入循环前做一次，之后每轮复用。',
    },
    {
      title: 'Agent 协作',
      body: '主 Agent 可派出 planner、coder、tester 等队友。上下级沿编排通道直连，平级在中心信箱里横向对话。队友干完转入待命而不销毁，同进程内下一条消息可原地唤醒。',
    },
    {
      title: '定时自动化',
      body: '支持 cron、interval、once 三类触发器。任务定义与调度状态落 SQLite，每次触发都组装一个全新的 Agent 运行时。',
    },
  ],
  entries: [
    {
      name: '命令行',
      body: '交互式 REPL、单次提问与斜杠命令。',
      command: 'xmake run orangutan -- --cli',
    },
    {
      name: 'HTTP 后端',
      body: '提供 chat 接口与 SSE 事件流，可挂载外部静态目录。仓库内的 web 目录目前是设计稿与提示词，不是成品界面。',
      command: 'xmake run orangutan -- --web',
    },
    {
      name: 'QQ',
      body: '通过 channel adapter 接入 QQ 会话，是目前接入的外部聊天入口。',
      command: 'xmake run orangutan -- --channel',
    },
  ],
  figures: {
    architecture: {
      src: '/images/projects/orangutan/architecture-overview.svg',
      width: 1220,
      height: 760,
      alt: 'Orangutan 系统架构：四类入口汇入装配层，核心 AgentLoop 连接模型接入与工具系统，状态统一落在 SQLite',
      caption:
        '四类入口、一条装配路径、一个 Agent 循环。图为静态示意，文案按 fc351f0 源码校正。',
    },
    multiAgent: {
      src: '/images/projects/orangutan/multi-agent.svg',
      width: 1280,
      height: 752,
      alt: 'Orangutan 多 Agent 编排：上下级沿外圈编排通道直连主 Agent，平级在中心信箱里横向对话',
      caption: '一个信箱，两种关系。图中队友数量只是示意，不代表并发上限。',
    },
    qq: {
      src: '/images/projects/orangutan/qq-capabilities.jpg',
      width: 800,
      height: 1759,
      alt: 'QQ 聊天截图：机器人回复测试员 tester 已就位，表格列出 planner、coder、tester 三个成员均已就绪',
      caption: 'QQ 会话中展示三个队友就绪状态的示例',
    },
  },
  share: {
    src: '/images/projects/orangutan/share.png',
    width: 1200,
    height: 630,
    alt: 'Orangutan：用 C++23 构建的本地 AI Agent 运行时',
  },
};
