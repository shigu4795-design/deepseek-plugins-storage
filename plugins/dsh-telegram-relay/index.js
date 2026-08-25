/**
 * DSH Telegram Relay - DeepSeek Harness 官方标准化插件
 */

module.exports = {
  name: 'dsh-telegram-relay',
  version: '1.0.0',
  activate(context) {
    console.log('[DSH Telegram Relay] 插件已激活并在 DeepSeek Harness 中运行');
  },
  deactivate() {
    console.log('[DSH Telegram Relay] 插件已卸载');
  }
};
