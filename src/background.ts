// background.ts (Service Worker)
// 该文件作为扩展的后台服务工作线程，整合各个功能模块

import { setupNetworkListeners, setupCleanupTask } from './modules/networkCapture';
import { setupMessageListeners } from './modules/messageHandler';
import { loadSavedStatus, logToPopup, updatePopupStatus } from './modules/statusManager';
import { handleTabClose } from './modules/debuggerManager';

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
