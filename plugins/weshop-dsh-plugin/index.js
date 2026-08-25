/**
 * Weshop Dsh Plugin - DeepSeek Harness 官方标准化插件
 */

module.exports = {
  name: 'weshop-dsh-plugin',
  version: '1.0.0',
  activate(context) {
    console.log('[Weshop Dsh Plugin] 插件已激活并在 DeepSeek Harness 中运行');
  },
  deactivate() {
    console.log('[Weshop Dsh Plugin] 插件已卸载');
  }
};
