/**
 * Antigravity Oauth - DeepSeek Harness 官方标准化插件
 */

module.exports = {
  name: 'deepseek-harness-antigravity-oauth',
  version: '1.0.0',
  activate(context) {
    console.log('[Antigravity Oauth] 插件已激活并在 DeepSeek Harness 中运行');
  },
  deactivate() {
    console.log('[Antigravity Oauth] 插件已卸载');
  }
};
