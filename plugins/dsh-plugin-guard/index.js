/**
 * Plugin Guard - DeepSeek Harness 官方标准化插件
 */

module.exports = {
  name: 'dsh-plugin-guard',
  version: '1.0.0',
  activate(context) {
    console.log('[Plugin Guard] 插件已激活并在 DeepSeek Harness 中运行');
  },
  deactivate() {
    console.log('[Plugin Guard] 插件已卸载');
  }
};
