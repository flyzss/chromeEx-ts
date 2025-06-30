// debuggerManager.ts
// 管理Chrome调试器的附加、分离和基本状态

import { DebuggeeTab } from '../types/debugger';
import { logToPopup } from './statusManager';

// 当前已附加调试器的标签页
export const debuggeeTabs: Record<number, DebuggeeTab> = {};

/**
 * 使用debugger API连接到标签页并开始监控网络请求
 * @param tabId 目标标签页ID
 * @param url 标签页URL
 */
export async function attachDebugger(tabId: number, url: string): Promise<boolean> {
  // 如果已经附加调试器，则直接返回
  if (debuggeeTabs[tabId] && debuggeeTabs[tabId].attached) {
    return true;
  }

  try {
    // 初始化标签页调试器信息
    debuggeeTabs[tabId] = {
      tabId,
      attached: false,
      url,
      networkRequestIds: new Set<string>()
    };

    // 附加调试器
    await new Promise<void>((resolve, reject) => {
      chrome.debugger.attach({ tabId }, "1.3", () => {
        if (chrome.runtime.lastError) {
          logToPopup(`无法附加调试器: ${chrome.runtime.lastError.message}`);
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });

    // 让标签页启用网络跟踪
    await new Promise<void>((resolve, reject) => {
      chrome.debugger.sendCommand({ tabId }, "Network.enable", {}, () => {
        if (chrome.runtime.lastError) {
          logToPopup(`无法启用网络跟踪: ${chrome.runtime.lastError.message}`);
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });

    // 更新标签页状态
    debuggeeTabs[tabId].attached = true;
    logToPopup(`已附加调试器到标签页 ${tabId}`);
    return true;
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : '未知错误';
    logToPopup(`附加调试器失败: ${errorMsg}`);
    // 清理标签页信息
    delete debuggeeTabs[tabId];
    return false;
  }
}

/**
 * 从标签页卸载调试器
 * @param tabId 标签页ID
 */
export async function detachDebugger(tabId: number): Promise<boolean> {
  if (!debuggeeTabs[tabId] || !debuggeeTabs[tabId].attached) {
    return false;
  }

  try {
    await new Promise<void>((resolve, reject) => {
      chrome.debugger.detach({ tabId }, () => {
        if (chrome.runtime.lastError) {
          logToPopup(`卸载调试器失败: ${chrome.runtime.lastError.message}`);
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });

    // 删除标签页信息
    delete debuggeeTabs[tabId];
    logToPopup(`已卸载标签页 ${tabId} 的调试器`);
    return true;
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : '未知错误';
    logToPopup(`卸载调试器失败: ${errorMsg}`);
    // 标记为已卸载，即使出错
    if (tabId !== undefined) {
      delete debuggeeTabs[tabId];
    }
    return false;
  }
}

/**
 * 获取指定标签页的调试器信息
 * @param tabId 标签页ID
 * @returns 调试器状态信息
 */
export function getDebuggerInfo(tabId: number): DebuggeeTab | null {
  return debuggeeTabs[tabId] || null;
}

/**
 * 检查调试器是否已附加到标签页
 * @param tabId 标签页ID
 * @returns 是否已附加
 */
export function isDebuggerAttached(tabId: number): boolean {
  return !!(debuggeeTabs[tabId] && debuggeeTabs[tabId].attached);
}

/**
 * 获取所有已附加调试器的标签页ID
 * @returns 标签页ID数组
 */
export function getAllAttachedTabIds(): number[] {
  return Object.keys(debuggeeTabs)
    .map(Number)
    .filter(tabId => debuggeeTabs[tabId].attached);
}

/**
 * 移除标签页的网络请求ID
 * @param tabId 标签页ID
 * @param requestId 请求ID
 */
export function removeNetworkRequestId(tabId: number, requestId: string): void {
  if (debuggeeTabs[tabId] && debuggeeTabs[tabId].networkRequestIds) {
    debuggeeTabs[tabId].networkRequestIds.delete(requestId);
  }
}

/**
 * 添加网络请求ID到标签页
 * @param tabId 标签页ID
 * @param requestId 请求ID
 */
export function addNetworkRequestId(tabId: number, requestId: string): void {
  if (debuggeeTabs[tabId]) {
    debuggeeTabs[tabId].networkRequestIds.add(requestId);
  }
}

/**
 * 从所有标签页移除特定请求ID
 * @param requestId 请求ID
 */
export function removeRequestIdFromAllTabs(requestId: string): void {
  Object.keys(debuggeeTabs).forEach(tabIdStr => {
    const tabId = Number(tabIdStr);
    if (debuggeeTabs[tabId]) {
      debuggeeTabs[tabId].networkRequestIds.delete(requestId);
    }
  });
}

/**
 * 处理标签页关闭事件
 * @param tabId 关闭的标签页ID
 */
export function handleTabClose(tabId: number): void {
  if (debuggeeTabs[tabId]) {
    // 尝试卸载调试器
    if (debuggeeTabs[tabId].attached) {
      chrome.debugger.detach({ tabId }, () => {
        // 忽略可能的错误
      });
    }
    // 删除标签页信息
    delete debuggeeTabs[tabId];
  }
}
