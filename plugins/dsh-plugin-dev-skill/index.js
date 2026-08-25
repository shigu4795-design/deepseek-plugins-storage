/**
 * Plugin Dev Skill - DeepSeek Harness 官方标准化插件
 */

module.exports = {
  name: 'dsh-plugin-dev-skill',
  version: '1.0.0',
  activate(context) {
    console.log('[Plugin Dev Skill] 插件已激活并在 DeepSeek Harness 中运行');
  },
  deactivate() {
    console.log('[Plugin Dev Skill] 插件已卸载');
  }
};
