import { ClickButtonMessage } from '../../types';

/**
 * 使用XPath查询DOM元素
 * @param xpath XPath表达式
 * @returns 查找到的元素或null
 */
function getElementByXPath(xpath: string): HTMLElement | null {
  try {
    const result = document.evaluate(
      xpath,
      document,
      null,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null
    );
    return result.singleNodeValue as HTMLElement | null;
  } catch (error) {
    console.error('[ST Extension] XPath选择器语法错误:', error);
    return null;
  }
}

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
        let button: HTMLElement | null = null;
        
        // 根据选择器类型使用不同的查询方式
        if (typedMessage.isXPath) {
          // 使用XPath选择器
          button = getElementByXPath(typedMessage.selector);
          console.log(`[ST Extension] 使用XPath选择器: ${typedMessage.selector}, 结果: ${button ? '成功' : '未找到'}`);
        } else {
          // 使用CSS选择器
          try {
            button = document.querySelector(typedMessage.selector) as HTMLElement;
            console.log(`[ST Extension] 使用CSS选择器: ${typedMessage.selector}, 结果: ${button ? '成功' : '未找到'}`);
          } catch (error) {
            console.error(`[ST Extension] CSS选择器语法错误: ${error}`);
          }
        }
        
        if (button) {
          // 标记元素，帮助调试
          const originalBackgroundColor = button.style.backgroundColor;
          const originalBorder = button.style.border;
          
          try {
            button.style.backgroundColor = 'rgba(255, 165, 0, 0.3)';
            button.style.border = '2px solid orange';
            
            // 短暂停后点击，让用户能够看到选中了哪个元素
            setTimeout(() => {
              button?.click();
              // 恢复原来的样式
              if (button) {
                button.style.backgroundColor = originalBackgroundColor;
                button.style.border = originalBorder;
              }
            }, 300);
            
            sendResponse({ command: 'clickResult', success: true });
          } catch (clickError) {
            console.error('[ST Extension] 点击按钮时出错:', clickError);
            sendResponse({ 
              command: 'clickResult', 
              success: false, 
              error: `点击按钮时出错: ${clickError instanceof Error ? clickError.message : '未知错误'}` 
            });
          }
        } else {
          sendResponse({ 
            command: 'clickResult', 
            success: false, 
            error: `未找到按钮: ${typedMessage.isXPath ? 'XPath' : 'CSS'} 选择器 "${typedMessage.selector}" 未匹配到元素` 
          });
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
