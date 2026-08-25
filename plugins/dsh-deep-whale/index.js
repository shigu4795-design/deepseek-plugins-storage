/**
 * Deep Whale 鲸鱼娘主题皮肤插件
 */

const fs = require('fs');
const path = require('path');

module.exports = {
  name: 'dsh-deep-whale',
  version: '1.0.0',
  type: 'theme',
  activate(context) {
    console.log('[Deep Whale Theme] 鲸鱼娘极光蓝主题已激活');
    if (context && context.theme) {
      context.theme.apply({
        name: 'Deep Whale',
        stylePath: path.join(__dirname, 'styles', 'theme.css'),
        tokenPath: path.join(__dirname, 'styles', 'tokens.css'),
        icon: path.join(__dirname, 'assets', 'whale-girl-icon.svg'),
        primaryColor: '#0284c7',
        accentColor: '#38bdf8'
      });
    }
  },
  deactivate(context) {
    console.log('[Deep Whale Theme] 鲸鱼娘主题已还原');
  }
};
