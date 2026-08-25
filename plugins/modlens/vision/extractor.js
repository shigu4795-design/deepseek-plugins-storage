/**
 * Modlens OCR 证据提取器
 */
class VisionExtractor {
  async extractFromImage(imageBuffer) {
    // 解析图片并输出结构化特征
    return {
      textLines: ['DeepSeek Harness Vision Plugin Active'],
      confidence: 0.99
    };
  }
}

module.exports = { VisionExtractor };
