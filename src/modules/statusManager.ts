// statusManager.ts
// 处理状态更新和日志记录

import { nextScheduledRunTime } from './alarmManager';

// 外部导出的变量
export let isRunning: boolean = false;
export let currentConfig: Record<string, any> = {};

/**
 * 更新 Popup 显示的状态信息
 * @param callback - 可选的回调函数
 * @returns 无返回值
 */
export function updatePopupStatus(callback?: (response: any) => void): void {
  // 构造状态信息对象
  const statusInfo = {
    command: 'updateStatus',
    isRunning: isRunning,
    status: isRunning ? (nextScheduledRunTime ? '运行中' : '启动中...') : '未运行',
    nextRunTime: nextScheduledRunTime
  };
  
  // 向 popup 发送消息
  chrome.runtime.sendMessage(statusInfo).catch(error => {
    // 如果popup未打开，sendMessage会失败，这是正常的，可以忽略这个错误
    // console.log('Popup未打开，无法更新状态:', error.message);
  });
  
  // 如果提供了回调函数 (例如来自 getStatus 请求)，则调用它
  if (typeof callback === 'function') {
    callback(statusInfo);
  }
}

/**
 * 向Popup发送日志消息
 * @param messageContent - 日志消息内容
 * @returns 无返回值
 */
export function logToPopup(messageContent: string): void {
  // 构造日志消息对象
  const logMessage = {
    command: 'log',
    message: messageContent
  };
  
  // 向 popup 发送消息
  chrome.runtime.sendMessage(logMessage).catch(error => {
    // console.log('Popup未打开，无法发送日志:', error.message);
  });
  
  // 同时也在后台控制台打印一份日志，方便调试
  console.log(`[Background Log] ${new Date().toLocaleTimeString()}: ${messageContent}`);
}

/**
 * 设置运行状态
 * @param running - 是否运行
 * @param config - 配置对象
 */
export function setRunningStatus(running: boolean, config?: Record<string, any>): void {
  isRunning = running;
  
  if (config) {
    currentConfig = config;
  }
  
  // 将运行状态保存到 storage
  if (running) {
    chrome.storage.local.set({ isRunning: true, currentConfig: currentConfig });
  } else {
    chrome.storage.local.set({ isRunning: false });
  }
  
  updatePopupStatus();
}

/**
 * 加载保存的状态
 * @param callback - 回调函数
 */
export function loadSavedStatus(callback?: () => void): void {
  chrome.storage.local.get(['isRunning', 'currentConfig'], (result) => {
    if (result.isRunning && result.currentConfig) {
      currentConfig = result.currentConfig;
      isRunning = true;
      
      if (callback) {
        callback();
      }
    } else {
      isRunning = false;
      chrome.storage.local.set({ isRunning: false });
    }
  });
}
