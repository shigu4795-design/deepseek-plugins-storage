/**
 * Modlens 视觉证据格式化器
 */
class EvidenceBridge {
  formatEvidence(rawOcr, layoutData) {
    return {
      timestamp: new Date().toISOString(),
      ocr: rawOcr || [],
      layout: layoutData || { blocks: [] },
      semanticSummary: '视觉证据结构化解析完成'
    };
  }
}

module.exports = { EvidenceBridge };
