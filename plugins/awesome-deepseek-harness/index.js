/**
 * Awesome Deepseek Harness - DeepSeek Harness 官方标准化插件
 */

module.exports = {
  name: 'awesome-deepseek-harness',
  version: '1.0.0',
  activate(context) {
    console.log('[Awesome Deepseek Harness] 插件已激活并在 DeepSeek Harness 中运行');
  },
  deactivate() {
    console.log('[Awesome Deepseek Harness] 插件已卸载');
  }
};
