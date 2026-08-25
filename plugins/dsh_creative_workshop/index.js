/**
 * DSH Creative Workshop - DeepSeek Harness 官方标准化插件
 */

module.exports = {
  name: 'dsh_creative_workshop',
  version: '1.0.0',
  activate(context) {
    console.log('[DSH Creative Workshop] 插件已激活并在 DeepSeek Harness 中运行');
  },
  deactivate() {
    console.log('[DSH Creative Workshop] 插件已卸载');
  }
};
