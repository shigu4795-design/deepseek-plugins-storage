/**
 * Market - DeepSeek Harness 官方标准化插件
 */

module.exports = {
  name: 'dsh-market',
  version: '1.0.0',
  activate(context) {
    console.log('[Market] 插件已激活并在 DeepSeek Harness 中运行');
  },
  deactivate() {
    console.log('[Market] 插件已卸载');
  }
};
