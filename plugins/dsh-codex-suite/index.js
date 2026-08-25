/**
 * Codex Suite - DeepSeek Harness 官方标准化插件
 */

module.exports = {
  name: 'dsh-codex-suite',
  version: '1.0.0',
  activate(context) {
    console.log('[Codex Suite] 插件已激活并在 DeepSeek Harness 中运行');
  },
  deactivate() {
    console.log('[Codex Suite] 插件已卸载');
  }
};
