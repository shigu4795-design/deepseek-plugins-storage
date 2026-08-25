/**
 * Modlens - DeepSeek Harness 视觉桥接与 OCR 解析插件
 */

const { VisionExtractor } = require('./vision/extractor');
const { EvidenceBridge } = require('./bridge/evidence');

module.exports = {
  name: 'modlens',
  version: '1.0.0',
  activate(context) {
    console.log('[Modlens Vision Bridge] 视觉解析引擎已激活');
    this.extractor = new VisionExtractor();
    this.bridge = new EvidenceBridge();
  },
  deactivate() {
    console.log('[Modlens Vision Bridge] 已卸载');
  }
};
