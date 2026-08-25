/**
 * Gongwen Skill - DeepSeek Harness 官方标准化插件
 */

module.exports = {
  name: 'gongwen-skill',
  version: '1.0.0',
  activate(context) {
    console.log('[Gongwen Skill] 插件已激活并在 DeepSeek Harness 中运行');
  },
  deactivate() {
    console.log('[Gongwen Skill] 插件已卸载');
  }
};
