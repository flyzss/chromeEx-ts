// background.ts (Service Worker)
// 该文件作为扩展的后台服务工作线程，整合各个功能模块

import { setupNetworkListeners, setupCleanupTask } from './modules/networkCapture';
import { setupMessageListeners } from './modules/messageHandler';
import { loadSavedStatus, logToPopup, updatePopupStatus } from './modules/statusManager';
import { handleTabClose } from './modules/debuggerManager';
import { QUERY_ALARM_NAME, NEXT_PAGE_ALARM_NAME } from './modules/alarmManager';

// 初始化日志
console.log('Chrome扩展后台服务已启动');
logToPopup('扩展后台服务已启动');

// 加载保存的状态
loadSavedStatus();

// 设置消息监听
setupMessageListeners();

// 设置网络监听
setupNetworkListeners();

// 设置定期清理任务
setupCleanupTask();

// 监听标签页关闭事件
chrome.tabs.onRemoved.addListener((tabId) => {
  handleTabClose(tabId);
});

/**
 * 带重试机制的消息发送函数
 * @param tabId 目标标签页ID
 * @param message 要发送的消息
 * @param maxRetries 最大重试次数
 * @param retryDelay 重试间隔(毫秒)
 * @returns Promise包含响应或错误
 */
function sendMessageWithRetry(tabId: number, message: any, maxRetries: number = 2, retryDelay: number = 500): Promise<any> {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    
    function attemptSend() {
      attempts++;
      chrome.tabs.sendMessage(tabId, message, (response) => {
        if (chrome.runtime.lastError) {
          console.log(`[调试] 发送消息尝试 ${attempts}/${maxRetries} 失败: ${chrome.runtime.lastError.message}`);
          if (attempts < maxRetries) {
            // 延迟后重试
            setTimeout(attemptSend, retryDelay);
          } else {
            reject(new Error(chrome.runtime.lastError.message));
          }
        } else {
          resolve(response);
        }
      });
    }
    
    attemptSend();
  });
}

// 监听定时器触发事件
chrome.alarms.onAlarm.addListener((alarm) => {
  console.log(`[定时器触发] 名称: ${alarm.name}`);
  
  // 从存储中获取配置信息
  chrome.storage.local.get(['config', 'isRunning'], (data) => {
    if (!data.isRunning) {
      console.log('扫描未运行，忽略定时器');
      return;
    }
    
    const config = data.config || {};
    
    // 处理查询按钮定时器
    if (alarm.name === QUERY_ALARM_NAME) {
      logToPopup(`查询按钮定时器触发，尝试点击查询按钮`);
      
      // 兼容多种字段命名
      const querySelector = config.querySelector || config.queryButtonSelector || config.buttonSelector;
      console.log(`[检查配置] 查询按钮选择器:`, querySelector);
      
      // 获取iframe选择器
      const iframeSelector = config.iframeSelector || '';
      console.log(`[检查配置] iframe选择器:`, iframeSelector);
      
      if (!querySelector) {
        logToPopup('未配置查询按钮选择器，无法点击');
        return;
      }
      
      // 定位到当前活动标签页并点击按钮
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs && tabs[0] && tabs[0].id) {
          const tabId = tabs[0].id;
          
          // 创建点击消息
          const clickMessage = {
            command: 'clickButton',
            selector: querySelector,
            buttonType: 'query',
            // 检测是否为XPath选择器（以'/'开头视为XPath）
            isXPath: querySelector && querySelector.trim().startsWith('/'),
            // 添加iframe选择器
            iframeSelector: iframeSelector
          };
          
          // 检查content script是否注入并尝试发送消息，带重试机制
          sendMessageWithRetry(tabId, clickMessage)
            .then(response => {
              if (response && response.success) {
                logToPopup('查询按钮点击成功');
              } else if (response) {
                logToPopup(`查询按钮点击失败: ${response.error || '未知原因'}`);
              } else {
                logToPopup('点击消息已发送，但未收到响应');
              }
            })
            .catch(error => {
              logToPopup(`发送点击消息失败: ${error.message}`);
              
              // 如果是消息通道错误，尝试重新注入content script
              if (error.message.includes('Receiving end does not exist')) {
                logToPopup('尝试重新注入content script...');
                
                // 使用scripting API尝试执行脚本确保content script已加载
                chrome.scripting.executeScript(
                  {
                    target: { tabId },
                    func: () => {
                      // 检测是否已加载content script
                      return typeof window.contentScriptLoaded !== 'undefined';
                    }
                  },
                  (injectionResults) => {
                    if (chrome.runtime.lastError) {
                      logToPopup(`检查content script失败: ${chrome.runtime.lastError.message}`);
                      return;
                    }
                    
                    const isLoaded = injectionResults && injectionResults[0] && injectionResults[0].result;
                    
                    if (!isLoaded) {
                      logToPopup('Content script未加载，尝试打开新标签页并重新执行操作');
                      
                      // 如果需要，可以打开新标签页或刷新当前页面
                      // 这里暂时不自动操作，只提示用户
                      
                      // 当需要时新增重新加载content script的逻辑
                    } else {
                      logToPopup('Content script已加载，重新尝试发送消息');
                      
                      // 尝试再次发送消息
                      setTimeout(() => {
                        sendMessageWithRetry(tabId, clickMessage, 1)
                          .then(retryResponse => {
                            if (retryResponse && retryResponse.success) {
                              logToPopup('重试成功: 查询按钮点击成功');
                            } else {
                              logToPopup('重试失败: 仍然无法点击查询按钮');
                            }
                          })
                          .catch(() => {
                            logToPopup('重试失败: 仍然无法建立消息通道');
                          });
                      }, 500);
                    }
                  }
                );
              }
            });
        } else {
          logToPopup('无法获取当前活动标签页');
        }
      });
    }
    
    // 处理下一页按钮定时器
    else if (alarm.name === NEXT_PAGE_ALARM_NAME) {
      logToPopup(`下一页按钮定时器触发，尝试点击下一页按钮`);
      
      // 兼容多种字段命名
      const nextPageSelector = config.nextPageSelector || config.nextPageButtonSelector;
      console.log(`[检查配置] 下一页按钮选择器:`, nextPageSelector);
      
      // 获取iframe选择器
      const iframeSelector = config.iframeSelector || '';
      console.log(`[检查配置] iframe选择器:`, iframeSelector);
      
      if (!nextPageSelector) {
        logToPopup('未配置下一页按钮选择器，无法点击');
        return;
      }
      
      // 定位到当前活动标签页并点击按钮
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs && tabs[0] && tabs[0].id) {
          const tabId = tabs[0].id;
          
          // 创建点击消息
          const clickMessage = {
            command: 'clickButton',
            selector: nextPageSelector,
            buttonType: 'nextPage',
            // 检测是否为XPath选择器（以'/'开头视为XPath）
            isXPath: nextPageSelector && nextPageSelector.trim().startsWith('/'),
            // 添加iframe选择器
            iframeSelector: iframeSelector
          };
          
          // 向content script发送消息
          chrome.tabs.sendMessage(tabId, clickMessage, (response) => {
            if (chrome.runtime.lastError) {
              logToPopup(`发送点击消息失败: ${chrome.runtime.lastError.message}`);
              return;
            }
            
            if (response && response.success) {
              logToPopup('下一页按钮点击成功');
            } else if (response) {
              logToPopup(`下一页按钮点击失败: ${response.error || '未知原因'}`);
            } else {
              logToPopup('点击消息已发送，但未收到响应');
            }
          });
        } else {
          logToPopup('无法获取当前活动标签页');
        }
      });
    }
  });
});

// 监听扩展安装事件
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    logToPopup('扩展已安装。请在Popup中配置并启动。');
    // 初始化默认配置（如果需要）
    chrome.storage.local.set({
      config: {
        listenUrl: '',
        submitUrl: '',
        querySelector: '',
        nextPageSelector: '',
        queryTimerInterval: 5,  // 默认5分钟
        nextPageTimerInterval: 10  // 默认10秒
      }
    });
  } else if (details.reason === 'update') {
    logToPopup(`扩展已更新到最新版本: ${chrome.runtime.getManifest().version}`);
  }
  
  updatePopupStatus();
});

// 监听扩展启动事件
chrome.runtime.onStartup.addListener(() => {
  logToPopup('浏览器已启动，扩展服务已初始化');
  updatePopupStatus();
  
  // 检查是否需要恢复定时器
  chrome.storage.local.get(['isRunning', 'config'], (data) => {
    if (data.isRunning) {
      logToPopup('检测到上次运行状态为活动，正在恢复...');
      
      // 恢复状态（在statusManager中已处理）
      updatePopupStatus();
    }
  });
});
