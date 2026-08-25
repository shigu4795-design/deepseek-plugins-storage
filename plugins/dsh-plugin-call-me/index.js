/**
 * Plugin Call Me - DeepSeek Harness 官方标准化插件
 */

module.exports = {
  name: 'dsh-plugin-call-me',
  version: '1.0.0',
  activate(context) {
    console.log('[Plugin Call Me] 插件已激活并在 DeepSeek Harness 中运行');
  },
  deactivate() {
    console.log('[Plugin Call Me] 插件已卸载');
  }
};
