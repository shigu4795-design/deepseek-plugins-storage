/**
 * 侧边栏视图管理器
 */
class SidebarManager {
  constructor(context) {
    this.context = context;
    this.views = new Map();
  }

  registerView(id, viewConfig) {
    this.views.set(id, viewConfig);
    if (this.context && this.context.sidebar) {
      this.context.sidebar.registerView(id, viewConfig);
    }
  }

  getView(id) {
    return this.views.get(id);
  }
}

module.exports = { SidebarManager };
