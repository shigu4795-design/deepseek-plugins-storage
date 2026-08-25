/**
 * Session Link - DeepSeek Harness 官方标准化插件
 */

module.exports = {
  name: 'dsh-session-link',
  version: '1.0.0',
  activate(context) {
    console.log('[Session Link] 插件已激活并在 DeepSeek Harness 中运行');
  },
  deactivate() {
    console.log('[Session Link] 插件已卸载');
  }
};
