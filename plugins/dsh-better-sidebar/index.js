/**
 * DSH Better 侧边栏插件主入口
 */

const { SidebarManager } = require('./src/sidebar/manager');
const { registerBuiltinViews } = require('./src/views/builtin');

module.exports = {
  name: 'dsh-better-sidebar',
  version: '1.0.0',
  activate(context) {
    console.log('[DSH Better Sidebar] 初始化侧边栏底座...');
    const manager = new SidebarManager(context);
    registerBuiltinViews(manager);
    console.log('[DSH Better Sidebar] 侧边栏底座与内置视图注册完成');
  },
  deactivate() {
    console.log('[DSH Better Sidebar] 插件已卸载');
  }
};
