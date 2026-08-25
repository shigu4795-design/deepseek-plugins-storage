/**
 * Eval Harness - DeepSeek Harness 官方标准化插件
 */

module.exports = {
  name: 'dsh-eval-harness',
  version: '1.0.0',
  activate(context) {
    console.log('[Eval Harness] 插件已激活并在 DeepSeek Harness 中运行');
  },
  deactivate() {
    console.log('[Eval Harness] 插件已卸载');
  }
};
