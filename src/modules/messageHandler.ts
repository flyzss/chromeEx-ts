// messageHandler.ts
// 处理来自popup和content script的消息

import { CommandMessage, ClickResultMessage, NetworkRequestMessage } from '../types';

// 扩展ClickResultMessage接口
interface EnhancedClickResultMessage extends ClickResultMessage {
  buttonType?: string;
  cssSelector?: string;
}

// 扩展NetworkRequestMessage接口
interface EnhancedNetworkRequestMessage extends NetworkRequestMessage {
  url?: string;
  method?: string;
}
import { setRunningStatus, logToPopup, updatePopupStatus } from './statusManager';
import { createQueryAlarm, createNextPageAlarm, stopAllAlarms } from './alarmManager';
import { attachDebugger, detachDebugger } from './debuggerManager';
import { requestDataMap } from './networkCapture';

/**
 * 初始化消息监听
 */
export function setupMessageListeners(): void {
  chrome.runtime.onMessage.addListener((message: CommandMessage | ClickResultMessage | NetworkRequestMessage, sender, sendResponse) => {
    if (!message.command) {
      return;
    }

    switch (message.command) {
      case 'start':
        handleStartCommand(message as CommandMessage);
        break;
      case 'stop':
        handleStopCommand();
        break;
      case 'getStatus':
        handleGetStatusCommand(sendResponse);
        return true; // 保持消息通道开放以便异步响应
      case 'clickResult':
        handleClickResultCommand(message as ClickResultMessage);
        break;
      case 'networkRequest':
        handleNetworkRequestCommand(message as NetworkRequestMessage);
        break;
      case 'extractedResponseBody':
        handleExtractedResponseBodyCommand(message as any, sender);
        break;
    }
  });
}

/**
 * 处理开始命令
 * @param message 命令消息
 */
function handleStartCommand(message: CommandMessage): void {
  if (message.config) {
    // 设置运行状态为true并保存配置
    setRunningStatus(true, message.config);
    
    // 创建查询按钮定时器（分钟为单位）
    if (message.config.queryTimerInterval) {
      createQueryAlarm(message.config.queryTimerInterval);
      logToPopup(`已设置查询按钮定时器：每${message.config.queryTimerInterval}分钟`);
    }
    
    // 创建下一页定时器（秒为单位）
    if (message.config.nextPageTimerInterval) {
      createNextPageAlarm(message.config.nextPageTimerInterval);
      logToPopup(`已设置下一页按钮定时器：每${message.config.nextPageTimerInterval}秒`);
    }
    
    // 获取当前活动标签页并附加调试器
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs && tabs[0] && tabs[0].id) {
        const tabId = tabs[0].id;
        const url = tabs[0].url || '';
        
        // 附加调试器到当前标签页
        attachDebugger(tabId, url)
          .then(success => {
            if (success) {
              logToPopup(`已开始监控网络请求：${message.config?.listenUrl || '所有URL'}`);
            }
          })
          .catch(error => {
            logToPopup(`附加调试器失败: ${error instanceof Error ? error.message : '未知错误'}`);
          });
      } else {
        logToPopup('无法获取当前活动标签页');
      }
    });
    
    // 更新popup状态
    updatePopupStatus();
  }
}

/**
 * 处理停止命令
 */
function handleStopCommand(): void {
  // 设置运行状态为false
  setRunningStatus(false, undefined);
  
  // 停止所有定时器
  stopAllAlarms();
  
  // 卸载所有标签页的调试器
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach(tab => {
      if (tab.id) {
        detachDebugger(tab.id)
          .catch(() => {/* 忽略错误 */});
      }
    });
  });
  
  logToPopup('已停止所有监控和定时任务');
  updatePopupStatus();
}

/**
 * 处理获取状态命令
 * @param sendResponse 响应回调
 */
function handleGetStatusCommand(sendResponse: (response?: any) => void): void {
  // 发送当前状态回给popup
  updatePopupStatus();
  sendResponse({ status: 'ok' });
}

/**
 * 处理点击结果命令
 * @param message 点击结果消息
 */
function handleClickResultCommand(message: ClickResultMessage): void {
  const enhancedMessage = message as EnhancedClickResultMessage;
  if (message.success) {
    logToPopup(`按钮点击成功: ${enhancedMessage.buttonType || '未知'}, CSS选择器: ${enhancedMessage.cssSelector || '未知'}`);
  } else {
    logToPopup(`按钮点击失败: ${enhancedMessage.buttonType || '未知'}, CSS选择器: ${enhancedMessage.cssSelector || '未知'}, 错误: ${message.error || '未知错误'}`);
  }
}

/**
 * 处理网络请求命令
 * @param message 网络请求消息
 */
function handleNetworkRequestCommand(message: NetworkRequestMessage): void {
  // 处理捕获的网络请求
  const enhancedMessage = message as EnhancedNetworkRequestMessage;
  logToPopup(`收到网络请求: ${enhancedMessage.url || '未知URL'}, 方法: ${enhancedMessage.method || '未知方法'}`);
}

/**
 * 处理从content script提取的响应体
 * @param message 响应体消息
 * @param sender 消息发送者
 */
function handleExtractedResponseBodyCommand(message: any, sender: chrome.runtime.MessageSender): void {
  const { requestId, responseBody, url } = message;
  
  // 如果请求存在于映射中
  if (requestId && requestDataMap[requestId]) {
    // 更新请求数据
    requestDataMap[requestId].responseBody = responseBody;
    logToPopup(`已从Content Script获取响应体: ${url}`);
  }
}
