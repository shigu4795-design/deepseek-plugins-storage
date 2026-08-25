/**
 * Mobile Gui Agent - DeepSeek Harness 官方标准化插件
 */

module.exports = {
  name: 'dsh-mobile-gui-agent',
  version: '1.0.0',
  activate(context) {
    console.log('[Mobile Gui Agent] 插件已激活并在 DeepSeek Harness 中运行');
  },
  deactivate() {
    console.log('[Mobile Gui Agent] 插件已卸载');
  }
};
