// background.ts (Service Worker)
// 该文件作为扩展的后台服务工作线程，整合各个功能模块

import { ALARM_NAME, createAlarm, stopAlarm, updateNextRunTime } from './modules/alarmManager';
import { isRunning, currentConfig, logToPopup, updatePopupStatus, setRunningStatus, loadSavedStatus } from './modules/statusManager';
import { performScheduledTask } from './modules/taskExecutor';
import { processData, submitData } from './modules/dataProcessor';
import { CommandMessage, StatusMessage, ClickResultMessage, NetworkRequestMessage, NetworkResponseData } from './types';

// 监听来自 popup.js 或 content.js 的消息
chrome.runtime.onMessage.addListener((message: CommandMessage | ClickResultMessage | NetworkRequestMessage, sender, sendResponse) => {
  // 检查消息命令
  if (message.command === 'start') {
    const startMsg = message as CommandMessage;
    
    if (startMsg.config) {
      // 如果命令是 'start'
      setRunningStatus(true, startMsg.config); // 设置运行状态为true并保存配置
      // 创建定时器
      createAlarm(startMsg.config.timerInterval);
      // 立即尝试执行一次任务（如果需要，或者等待定时器第一次触发）
      // 为了演示，我们让定时器首次触发时执行
      
      sendResponse({ status: 'started' } as StatusMessage); // 向 popup 发送成功启动的响应
      updatePopupStatus(); // 更新 popup 状态
      logToPopup('任务已启动。');
    } else {
      sendResponse({ status: 'error', error: '缺少配置' } as StatusMessage);
      logToPopup('启动失败：缺少配置');
    }
    return true; // 表示异步处理响应
    
  } else if (message.command === 'stop') {
    // 如果命令是 'stop'
    stopAlarm(); // 停止定时器
    setRunningStatus(false); // 设置运行状态为false
    
    sendResponse({ status: 'stopped' } as StatusMessage); // 向 popup 发送成功停止的响应
    logToPopup('任务已停止。');
    return true; // 表示异步处理响应
    
  } else if (message.command === 'getStatus') {
    // 如果命令是 'getStatus'
    updatePopupStatus(sendResponse); // 更新 popup 状态并使用 sendResponse 回调
    return true; // 表示异步处理响应
    
  } else if (message.command === 'clickResult') {
    // 如果是来自 content.js 的点击结果
    const clickResultMsg = message as ClickResultMessage;
    
    if (clickResultMsg.success) {
      logToPopup(`按钮 '${currentConfig.buttonSelector}' 点击成功。`);
    } else {
      logToPopup(`错误: 点击按钮 '${currentConfig.buttonSelector}' 失败: ${clickResultMsg.error}`);
    }
    // 点击后可以继续监听网络请求，无需额外操作
  } else if (message.command === 'networkRequestCaptured') {
    // 处理从content script捕获的网络请求数据
    const networkMsg = message as NetworkRequestMessage;
    const capturedData = networkMsg.data;
    
    // 检查URL是否匹配配置的监听URL模式
    if (isRunning && currentConfig.listenUrl) {
      const pattern = new RegExp(currentConfig.listenUrl.replace(/\*/g, '.*'));
      if (pattern.test(capturedData.url)) {
        logToPopup(`监听到匹配的网络请求: ${capturedData.url} (状态码: ${capturedData.status})`);
        
        // 转换为ResponseData格式并处理
        const responseData = {
          url: capturedData.url,
          method: capturedData.method,
          statusCode: capturedData.status,
          timestamp: capturedData.timestamp,
          responseBody: capturedData.responseBody,
          contentType: capturedData.contentType,
          headers: capturedData.responseHeaders
        };
        
        // 使用现有的数据处理和提交逻辑
        processData(responseData)
          .then(processedData => {
            // 数据提交
            submitData(processedData);
          })
          .catch(error => {
            logToPopup(`数据整理失败: ${error.message}`);
          });
      }
    }
  } else if (message.command === 'getConfig') {
    // 将当前配置发送给content script
    sendResponse({ config: currentConfig });
    return true;
  }
  
  return false; // 默认同步处理
});

// 定时器触发时的监听器
chrome.alarms.onAlarm.addListener((alarm) => {
  // 检查是否是我们设置的定时器
  if (alarm.name === ALARM_NAME) {
    logToPopup('定时任务触发。');
    // 执行核心任务
    performScheduledTask();
    // 更新下一次执行时间
    updateNextRunTime();
  }
});

// 扩展安装或更新时的处理
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    logToPopup('扩展已安装。请在Popup中配置并启动。');
    // 初始化默认配置（如果需要）
    chrome.storage.local.set({
      isRunning: false,
      timerInterval: 60, // 默认60秒
      dataProcessingMethod: 'none'
    });
  } else if (details.reason === 'update') {
    logToPopup('扩展已更新。');
  }
  
  // 检查并恢复运行状态 (例如浏览器重启后)
  loadSavedStatus(() => {
    // 如果之前是运行状态，重新创建定时器
    // 但要注意，如果浏览器关闭时 alarm 还在，重启后 alarm 可能会自动恢复。
    // 这里我们先尝试获取已有的 alarm，如果没有，再创建。
    chrome.alarms.get(ALARM_NAME, (existingAlarm) => {
      if (existingAlarm) {
        logToPopup('检测到已存在的定时器，恢复运行状态。');
      } else {
        logToPopup('恢复运行状态，重新创建定时器。');
        createAlarm(currentConfig.timerInterval);
      }
      updatePopupStatus();
    });
  });
});

// 浏览器启动时，也检查一次状态
chrome.runtime.onStartup.addListener(() => {
  logToPopup('浏览器启动。');
  loadSavedStatus(() => {
    chrome.alarms.get(ALARM_NAME, (existingAlarm) => {
      if (existingAlarm) {
        logToPopup('检测到已存在的定时器，恢复运行状态 (onStartup)。');
      } else {
        logToPopup('恢复运行状态，重新创建定时器 (onStartup)。');
        createAlarm(currentConfig.timerInterval);
      }
      updatePopupStatus();
    });
  });
});

// 不再需要使用webRequest API监听网络请求，改用content script钩子

logToPopup('后台脚本 (Service Worker) 已启动。');
