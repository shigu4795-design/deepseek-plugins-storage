/**
 * Custom First Control Prompt - DeepSeek Harness 官方标准化插件
 */

module.exports = {
  name: 'custom-first-control-prompt',
  version: '1.0.0',
  activate(context) {
    console.log('[Custom First Control Prompt] 插件已激活并在 DeepSeek Harness 中运行');
  },
  deactivate() {
    console.log('[Custom First Control Prompt] 插件已卸载');
  }
};
