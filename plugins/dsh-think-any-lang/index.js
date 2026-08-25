/**
 * Think Any Lang - DeepSeek Harness 官方标准化插件
 */

module.exports = {
  name: 'dsh-think-any-lang',
  version: '1.0.0',
  activate(context) {
    console.log('[Think Any Lang] 插件已激活并在 DeepSeek Harness 中运行');
  },
  deactivate() {
    console.log('[Think Any Lang] 插件已卸载');
  }
};
