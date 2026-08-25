/**
 * Web - DeepSeek Harness 官方标准化插件
 */

module.exports = {
  name: 'dsh-web',
  version: '1.0.0',
  activate(context) {
    console.log('[Web] 插件已激活并在 DeepSeek Harness 中运行');
  },
  deactivate() {
    console.log('[Web] 插件已卸载');
  }
};
