/**
 * Mem9 - DeepSeek Harness 官方标准化插件
 */

module.exports = {
  name: 'mem9',
  version: '1.0.0',
  activate(context) {
    console.log('[Mem9] 插件已激活并在 DeepSeek Harness 中运行');
  },
  deactivate() {
    console.log('[Mem9] 插件已卸载');
  }
};
