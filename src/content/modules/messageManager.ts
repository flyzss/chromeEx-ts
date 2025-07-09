import { ClickButtonMessage } from '../../types';

/**
 * 使用XPath查询DOM元素
 * @param xpath XPath表达式
 * @param context 查询上下文，默认为document
 * @returns 查找到的元素或null
 */
function getElementByXPath(xpath: string, context: Document | HTMLIFrameElement = document): HTMLElement | null {
  try {
    // 对于iframe元素，需要获取其contentDocument
    const doc = context instanceof HTMLIFrameElement ? context.contentDocument : context;
    
    // 如果无法访问iframe内容（跨域限制），则返回null
    if (!doc) {
      console.warn('[ST Extension] 无法访问iframe内容，可能是跨域限制');
      return null;
    }
    
    const result = doc.evaluate(
      xpath,
      doc,
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
 * 根据选择器查找iframe
 * @param iframeSelector iframe的CSS选择器
 * @returns iframe元素或null
 */
function findIframe(iframeSelector: string): HTMLIFrameElement | null {
  try {
    // 尝试使用CSS选择器查找iframe
    return document.querySelector(iframeSelector) as HTMLIFrameElement;
  } catch (error) {
    console.error('[ST Extension] iframe选择器语法错误:', error);
    return null;
  }
}

/**
 * 监听来致background.js的消息，处理点击页面元素的指令
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
        let targetDocument: Document | HTMLIFrameElement = document;
        let docForLogging = '主页面';
        
        // 如果指定了iframe选择器，则先查找iframe
        if (typedMessage.iframeSelector) {
          const iframe = findIframe(typedMessage.iframeSelector);
          if (iframe) {
            targetDocument = iframe;
            docForLogging = `iframe(${typedMessage.iframeSelector})`;
            console.log(`[ST Extension] 已找到iframe: ${typedMessage.iframeSelector}`);
            
            // 检查iframe是否可访问
            if (iframe.contentDocument) {
              console.log('[ST Extension] iframe内容可访问');
            } else {
              console.error('[ST Extension] iframe内容不可访问，可能由于跨域限制');
              sendResponse({ 
                command: 'clickResult', 
                success: false, 
                error: `无法访问iframe内容，可能由于跨域限制` 
              });
              return true;
            }
          } else {
            console.error(`[ST Extension] 未找到指定的iframe: ${typedMessage.iframeSelector}`);
            sendResponse({ 
              command: 'clickResult', 
              success: false, 
              error: `未找到指定的iframe: ${typedMessage.iframeSelector}` 
            });
            return true;
          }
        }
        
        // 根据选择器类型使用不同的查询方式
        if (typedMessage.isXPath) {
          // 使用XPath选择器
          button = getElementByXPath(typedMessage.selector, targetDocument);
          console.log(`[ST Extension] 在${docForLogging}中使用XPath选择器: ${typedMessage.selector}, 结果: ${button ? '成功' : '未找到'}`);
        } else {
          // 使用CSS选择器
          try {
            if (targetDocument instanceof HTMLIFrameElement && targetDocument.contentDocument) {
              // 在iframe中查找元素
              button = targetDocument.contentDocument.querySelector(typedMessage.selector) as HTMLElement;
            } else {
              // 在主文档中查找元素
              button = document.querySelector(typedMessage.selector) as HTMLElement;
            }
            console.log(`[ST Extension] 在${docForLogging}中使用CSS选择器: ${typedMessage.selector}, 结果: ${button ? '成功' : '未找到'}`);
          } catch (error) {
            console.error(`[ST Extension] CSS选择器语法错误: ${error}`);
          }
        }
        
        if (button) {
          // 标记元素，帮助调试
          const originalBackgroundColor = button.style.backgroundColor;
          const originalBorder = button.style.border;
          
          try {
            // 高亮显示找到的元素
            button.style.backgroundColor = 'rgba(255, 165, 0, 0.3)';
            button.style.border = '2px solid orange';
            
            // 记录查找位置信息，便于调试
            const locationInfo = typedMessage.iframeSelector ? 
              `iframe(${typedMessage.iframeSelector})` : '主页面';
            
            console.log(`[ST Extension] 在${locationInfo}中找到并准备点击元素:`, 
                        typedMessage.selector);
            
            // 短暂停后点击，让用户能够看到选中了哪个元素
            setTimeout(() => {
              try {
                // 执行点击
                button?.click();
                console.log(`[ST Extension] 成功点击了${locationInfo}中的元素`);
              } catch (innerError) {
                console.error(`[ST Extension] 点击操作失败:`, innerError);
              } finally {
                // 恢复原来的样式
                if (button) {
                  button.style.backgroundColor = originalBackgroundColor;
                  button.style.border = originalBorder;
                }
              }
            }, 300);
            
            sendResponse({ 
              command: 'clickResult', 
              success: true,
              locationInfo: locationInfo // 返回元素位置信息
            });
          } catch (clickError) {
            console.error('[ST Extension] 点击按钮时出错:', clickError);
            sendResponse({ 
              command: 'clickResult', 
              success: false, 
              error: `点击按钮时出错: ${clickError instanceof Error ? clickError.message : '未知错误'}` 
            });
          }
        } else {
          // 记录查找位置信息，便于调试
          const locationInfo = typedMessage.iframeSelector ? 
            `iframe(${typedMessage.iframeSelector})` : '主页面';
          
          sendResponse({ 
            command: 'clickResult', 
            success: false, 
            error: `在${locationInfo}中未找到按钮: ${typedMessage.isXPath ? 'XPath' : 'CSS'} 选择器 "${typedMessage.selector}" 未匹配到元素` 
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
