import { ClickButtonMessage } from '../../types';

/**
 * 监听来自background.js的消息，处理点击页面元素的指令
 */
export function setupMessageListener(): void {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || typeof message !== 'object') {
      return false;
    }

    // 检查消息类型
    if ('command' in message) {
      // 处理点击按钮的消息
      if (message.command === 'clickButton') {
        const typedMessage = message as ClickButtonMessage;
        // 查找按钮并点击
        const button = document.querySelector(typedMessage.selector) as HTMLElement;
        if (button) {
          button.click();
          sendResponse({ command: 'clickResult', success: true });
        } else {
          sendResponse({ command: 'clickResult', success: false, error: '未找到按钮' });
        }
        return true;
      }
    }
    
    return true; // 保持消息通道开放以进行异步响应
  });
}

/**
 * 从background script获取配置
 * @returns 包含配置信息的Promise
 */
export function getConfigFromBackground(): Promise<{listenUrl?: string, [key: string]: any}> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ command: 'getConfig' }, (response) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else if (response && response.config) {
        resolve(response.config);
      } else {
        reject(new Error('未能获取有效的配置'));
      }
    });
  });
}
