/**
 * Memtrace Public - DeepSeek Harness 官方标准化插件
 */

module.exports = {
  name: 'memtrace-public',
  version: '1.0.0',
  activate(context) {
    console.log('[Memtrace Public] 插件已激活并在 DeepSeek Harness 中运行');
  },
  deactivate() {
    console.log('[Memtrace Public] 插件已卸载');
  }
};
