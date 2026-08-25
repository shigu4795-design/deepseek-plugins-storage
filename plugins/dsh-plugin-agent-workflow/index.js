/**
 * Plugin Agent Workflow 入口
 */

const { WorkflowExecutor } = require('./engine/executor');
const refactorWorkflow = require('./workflows/code-refactor.json');

module.exports = {
  name: 'dsh-plugin-agent-workflow',
  version: '1.0.0',
  activate(context) {
    console.log('[Agent Workflow Engine] 工作流编排引擎已就绪');
    this.executor = new WorkflowExecutor(context);
    if (context && context.workflows) {
      context.workflows.register(refactorWorkflow);
    }
  },
  deactivate() {
    console.log('[Agent Workflow Engine] 已停止');
  }
};
