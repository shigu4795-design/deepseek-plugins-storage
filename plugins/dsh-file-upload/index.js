/**
 * File Upload - DeepSeek Harness 官方标准化插件
 */

module.exports = {
  name: 'dsh-file-upload',
  version: '1.0.0',
  activate(context) {
    console.log('[File Upload] 插件已激活并在 DeepSeek Harness 中运行');
  },
  deactivate() {
    console.log('[File Upload] 插件已卸载');
  }
};
