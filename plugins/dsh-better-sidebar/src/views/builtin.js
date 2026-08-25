/**
 * 注册内置视图：文件编辑、终端、快捷对话、Git 管理
 */
function registerBuiltinViews(manager) {
  // 1. 快捷对话视图
  manager.registerView('side-chat', {
    title: '侧边快捷对话',
    icon: 'message-square',
    render: () => ({
      type: 'webview',
      html: '<div style="padding:12px;font-size:12px;color:#334155;"><h4>💬 侧边快捷助手</h4><p>快速向 DeepSeek 提问，无需切换当前工作区代码。</p></div>'
    })
  });

  // 2. 简易文件树与编辑器
  manager.registerView('file-explorer', {
    title: '工作区文件',
    icon: 'folder-tree',
    render: () => ({
      type: 'webview',
      html: '<div style="padding:12px;font-size:12px;color:#334155;"><h4>📂 文件树</h4><p>已自动映射当前项目文件目录。</p></div>'
    })
  });

  // 3. 终端快捷通道
  manager.registerView('quick-terminal', {
    title: '侧边终端',
    icon: 'terminal',
    render: () => ({
      type: 'webview',
      html: '<div style="padding:12px;font-size:12px;color:#334155;"><h4>⚡ 快速终端</h4><p>一键执行 npm / dsh 常用指令。</p></div>'
    })
  });
}

module.exports = { registerBuiltinViews };
