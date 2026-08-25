/**
 * Web Plugin Manager - DeepSeek Harness 官方标准化插件
 */

module.exports = {
  name: 'dsh-web-plugin-manager',
  version: '1.0.0',
  activate(context) {
    console.log('[Web Plugin Manager] 插件已激活并在 DeepSeek Harness 中运行');
  },
  deactivate() {
    console.log('[Web Plugin Manager] 插件已卸载');
  }
};
