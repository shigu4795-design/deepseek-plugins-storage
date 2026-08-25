/**
 * Plugin Hub - DeepSeek Harness 官方标准化插件
 */

module.exports = {
  name: 'dsh-plugin-hub',
  version: '1.0.0',
  activate(context) {
    console.log('[Plugin Hub] 插件已激活并在 DeepSeek Harness 中运行');
  },
  deactivate() {
    console.log('[Plugin Hub] 插件已卸载');
  }
};
