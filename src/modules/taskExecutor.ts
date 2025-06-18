// taskExecutor.ts
// 处理核心的定时任务执行

import { isRunning, currentConfig, logToPopup } from './statusManager';
import { Config, ClickButtonMessage } from '../types';

/**
 * 执行预定任务的函数，主要负责点击按钮和处理网络请求
 * @returns Promise对象
 */
export async function performScheduledTask(): Promise<void> {
  // 检查任务是否仍在运行且配置有效
  if (!isRunning || !currentConfig || !currentConfig.buttonSelector) {
    logToPopup(`任务未运行或配置不完整，跳过执行。isRunning: ${isRunning}, buttonSelector: ${currentConfig.buttonSelector}`);
    return; // 如果任务已停止或配置不完整，则不执行
  }

  // 1. 指令内容脚本点击按钮
  // 获取当前活动的标签页
  try {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (activeTab && activeTab.id) {
      // 检查目标URL配置，如果配置了，则先尝试导航
      if (currentConfig.targetUrl) {
        // 检查当前tab的URL是否与目标URL匹配 (简单匹配，可改进)
        if (!activeTab.url || 
            !activeTab.url.startsWith(
              currentConfig.targetUrl.split('//')[0] + '//' + 
              currentConfig.targetUrl.split('//')[1].split('/')[0]
            )) {
          logToPopup(`当前标签页 (${activeTab.url}) 与目标URL (${currentConfig.targetUrl}) 不符，尝试导航...`);
          try {
            await chrome.tabs.update(activeTab.id, { url: currentConfig.targetUrl });
            // 等待页面加载完成，这里用一个简单的延时，实际应用可能需要更复杂的判断
            await new Promise(resolve => setTimeout(resolve, 5000)); // 等待5秒
            logToPopup(`已导航到 ${currentConfig.targetUrl}`);
          } catch (navError: any) {
            logToPopup(`导航到 ${currentConfig.targetUrl} 失败: ${navError.message}`);
            return; // 导航失败则不继续
          }
        }
      }
      
      // 重新获取一次 activeTab，因为导航后 tab 对象可能变化
      const [currentActiveTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (currentActiveTab && currentActiveTab.id) {
        logToPopup(`向内容脚本发送点击指令: ${currentConfig.buttonSelector}`);
        // 向内容脚本发送消息，要求点击按钮
        const message: ClickButtonMessage = {
          command: 'clickButton',
          selector: currentConfig.buttonSelector
        };
        
        chrome.tabs.sendMessage(
          currentActiveTab.id, 
          message, 
          (response: { success: boolean; error?: string }) => {
            if (chrome.runtime.lastError) {
              logToPopup(`发送点击指令失败: ${chrome.runtime.lastError.message}. 确保内容脚本已注入且页面匹配。`);
            } else if (response) {
              if (response.success) {
                logToPopup(`按钮 '${currentConfig.buttonSelector}' 点击成功 (来自内容脚本)。`);
              } else {
                logToPopup(`错误: 点击按钮 '${currentConfig.buttonSelector}' 失败: ${response.error} (来自内容脚本)。`);
              }
            }
          }
        );
      } else {
        logToPopup('无法获取活动标签页ID来发送点击指令。');
      }
    } else {
      logToPopup('没有活动的标签页来执行点击操作。');
    }
  } catch (error: any) {
    logToPopup(`执行预定任务时出错: ${error.message}`);
  }
  // 网络请求监听是持续的，不需要在这里特别触发
}
