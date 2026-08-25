/**
 * Live2d Pets - DeepSeek Harness 官方标准化插件
 */

module.exports = {
  name: 'dsh-live2d-pets',
  version: '1.0.0',
  activate(context) {
    console.log('[Live2d Pets] 插件已激活并在 DeepSeek Harness 中运行');
  },
  deactivate() {
    console.log('[Live2d Pets] 插件已卸载');
  }
};
