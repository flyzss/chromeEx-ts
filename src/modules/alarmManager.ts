// alarmManager.ts
// 处理定时器相关功能

import { logToPopup, updatePopupStatus } from './statusManager';

// 定义一个常量作为定时器的名称
export const ALARM_NAME = 'timedClickAndMonitorAlarm';
// 定义一个变量来存储下一个计划运行的时间
export let nextScheduledRunTime: number | null = null;

/**
 * 创建定时器函数
 * @param intervalInSeconds - 定时器间隔时间（秒）
 * @returns 无返回值
 */
export function createAlarm(intervalInSeconds: number): void {
  // 清除可能已存在的同名定时器，以防重复创建
  chrome.alarms.clear(ALARM_NAME, (wasCleared) => {
    // 使用 chrome.alarms.create 创建新的定时器
    // periodInMinutes 需要是分钟单位，我们将秒转换为分钟
    const periodInMinutes = Math.max(1, Math.round(intervalInSeconds / 60)); // 确保至少为1分钟，alarms API 最小单位是分钟
    const delayInMinutes = Math.max(1, Math.round(intervalInSeconds / 60)); // 首次触发延迟

    // 创建定时器
    chrome.alarms.create(ALARM_NAME, {
      delayInMinutes: 0.1, // 为了尽快触发第一次，设置为一个很小的值 (e.g., 6 seconds for 0.1 minutes)
      periodInMinutes: periodInMinutes 
    });
    logToPopup(`定时器已设置，每 ${intervalInSeconds} 秒执行一次 (近似为 ${periodInMinutes} 分钟周期)。`);
    // 获取下一次执行时间并更新popup
    chrome.alarms.get(ALARM_NAME, alarm => {
      if (alarm) {
        nextScheduledRunTime = alarm.scheduledTime;
        updatePopupStatus();
      }
    });
  });
}

/**
 * 停止定时器函数
 * @returns 无返回值
 */
export function stopAlarm(): void {
  // 使用 chrome.alarms.clear 清除定时器
  chrome.alarms.clear(ALARM_NAME, (wasCleared) => {
    if (wasCleared) {
      logToPopup('定时器已停止。');
    } else {
      logToPopup('没有活动的定时器需要停止。');
    }
    nextScheduledRunTime = null; // 清除下次运行时间
    updatePopupStatus(); // 更新popup状态
  });
}

/**
 * 更新下一次定时器执行时间
 */
export function updateNextRunTime(): void {
  chrome.alarms.get(ALARM_NAME, currentAlarm => {
    if (currentAlarm) {
      nextScheduledRunTime = currentAlarm.scheduledTime;
      updatePopupStatus();
    }
  });
}
