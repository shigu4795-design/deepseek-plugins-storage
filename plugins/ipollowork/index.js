/**
 * IPolloWork - DeepSeek Harness 官方标准化插件
 */

module.exports = {
  name: 'ipollowork',
  version: '1.0.0',
  activate(context) {
    console.log('[IPolloWork] 插件已激活并在 DeepSeek Harness 中运行');
  },
  deactivate() {
    console.log('[IPolloWork] 插件已卸载');
  }
};
