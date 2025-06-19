// alarmManager.ts
// 处理定时器相关功能

import { logToPopup, updatePopupStatus } from './statusManager';

// 定义常量作为定时器的名称
export const QUERY_ALARM_NAME = 'queryButtonAlarm';
export const NEXT_PAGE_ALARM_NAME = 'nextPageButtonAlarm';

// 定义变量来存储下一个计划运行的时间
export let nextQueryRunTime: number | null = null;
export let nextPageRunTime: number | null = null;

/**
 * 创建查询按钮定时器
 * @param intervalInMinutes - 定时器间隔时间（分钟）
 * @returns 无返回值
 */
export function createQueryAlarm(intervalInMinutes: number): void {
  // 清除可能已存在的同名定时器
  chrome.alarms.clear(QUERY_ALARM_NAME, (wasCleared) => {
    // 确保间隔至少为1分钟
    const periodInMinutes = Math.max(1, intervalInMinutes); 

    // 创建定时器
    chrome.alarms.create(QUERY_ALARM_NAME, {
      delayInMinutes: 0.1, // 为了尽快触发第一次，设置为很小的值
      periodInMinutes: periodInMinutes 
    });
    logToPopup(`查询按钮定时器已设置，每 ${periodInMinutes} 分钟执行一次。`);
    
    // 获取下一次执行时间并更新popup
    updateQueryNextRunTime();
  });
}

/**
 * 创建下一页按钮定时器（带随机性）
 * @param intervalInSeconds - 定时器基础间隔时间（秒）
 * @returns 无返回值
 */
export function createNextPageAlarm(intervalInSeconds: number): void {
  // 清除可能已存在的同名定时器
  chrome.alarms.clear(NEXT_PAGE_ALARM_NAME, (wasCleared) => {
    // 添加随机性：基础间隔的 80% 到 130% 之间
    const randomFactor = 0.8 + Math.random() * 0.5; // 0.8 到 1.3 之间的随机值
    const randomizedInterval = intervalInSeconds * randomFactor;
    const actualSeconds = Math.max(1, Math.round(randomizedInterval)); // 至少保证1秒
    
    // 转换为分钟单位，alarms API要求
    const periodInMinutes = Math.max(0.02, actualSeconds / 60); // 确保至少1秒 (0.02分钟)

    // 创建定时器
    chrome.alarms.create(NEXT_PAGE_ALARM_NAME, {
      delayInMinutes: 0.05, // 第一次触发等待3秒（给查询响应时间）
      periodInMinutes: periodInMinutes 
    });
    
    logToPopup(`下一页按钮定时器已设置，基础间隔 ${intervalInSeconds} 秒，实际间隔约 ${actualSeconds} 秒。`);
    
    // 获取下一次执行时间并更新popup
    updateNextPageNextRunTime();
  });
}

/**
 * 停止所有定时器
 * @returns 无返回值
 */
export function stopAllAlarms(): void {
  // 停止查询按钮定时器
  chrome.alarms.clear(QUERY_ALARM_NAME, (wasCleared) => {
    if (wasCleared) {
      logToPopup('查询按钮定时器已停止。');
    }
    nextQueryRunTime = null;
  });
  
  // 停止下一页按钮定时器
  chrome.alarms.clear(NEXT_PAGE_ALARM_NAME, (wasCleared) => {
    if (wasCleared) {
      logToPopup('下一页按钮定时器已停止。');
    }
    nextPageRunTime = null;
    updatePopupStatus();
  });
}

/**
 * 更新下一次查询定时器执行时间
 * @returns 无返回值
 */
export function updateQueryNextRunTime(): void {
  chrome.alarms.get(QUERY_ALARM_NAME, alarm => {
    if (alarm) {
      nextQueryRunTime = alarm.scheduledTime;
      updatePopupStatus();
    } else {
      nextQueryRunTime = null;
      updatePopupStatus();
    }
  });
}

/**
 * 更新下一次翻页定时器执行时间
 * @returns 无返回值
 */
export function updateNextPageNextRunTime(): void {
  chrome.alarms.get(NEXT_PAGE_ALARM_NAME, alarm => {
    if (alarm) {
      nextPageRunTime = alarm.scheduledTime;
      updatePopupStatus();
    } else {
      nextPageRunTime = null;
      updatePopupStatus();
    }
  });
}

/**
 * 兼容旧版程序的方法
 * @param intervalInSeconds - 定时器间隔时间（秒）
 */
export function createAlarm(intervalInSeconds: number): void {
  // 转换为分钟并调用新方法
  const intervalInMinutes = Math.max(1, Math.round(intervalInSeconds / 60));
  createQueryAlarm(intervalInMinutes);
}

/**
 * 兼容旧版程序的方法
 */
export function stopAlarm(): void {
  stopAllAlarms();
}

// 共享旧版变量名
export const ALARM_NAME = QUERY_ALARM_NAME;
export let nextScheduledRunTime = nextQueryRunTime;
