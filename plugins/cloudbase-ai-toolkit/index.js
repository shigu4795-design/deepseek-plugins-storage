/**
 * CloudBase AI Toolkit - DeepSeek Harness 官方标准化插件
 */

module.exports = {
  name: 'cloudbase-ai-toolkit',
  version: '1.0.0',
  activate(context) {
    console.log('[CloudBase AI Toolkit] 插件已激活并在 DeepSeek Harness 中运行');
  },
  deactivate() {
    console.log('[CloudBase AI Toolkit] 插件已卸载');
  }
};
