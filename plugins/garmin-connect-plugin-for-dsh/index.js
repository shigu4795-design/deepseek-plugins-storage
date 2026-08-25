/**
 * Garmin Connect Plugin For Dsh - DeepSeek Harness 官方标准化插件
 */

module.exports = {
  name: 'garmin-connect-plugin-for-dsh',
  version: '1.0.0',
  activate(context) {
    console.log('[Garmin Connect Plugin For Dsh] 插件已激活并在 DeepSeek Harness 中运行');
  },
  deactivate() {
    console.log('[Garmin Connect Plugin For Dsh] 插件已卸载');
  }
};
