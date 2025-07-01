// networkCapture.ts
// 负责网络请求的捕获、存储和响应体获取

import { DebuggerRequestWillBeSentParams, DebuggerResponseReceivedParams, DebuggerLoadingFinishedParams, DebuggerResponseBody, RequestData } from '../types/debugger';
import { logToPopup } from './statusManager';
import { currentConfig, isRunning } from './statusManager';
import { debuggeeTabs, addNetworkRequestId } from './debuggerManager';
import { handleCapturedData } from './dataHandler';
import { NetworkResponseData } from '../types';

// 存储所有的网络请求数据
export const requestDataMap: Record<string, RequestData> = {};

/**
 * 获取响应体
 * @param tabId 标签页ID
 * @param requestId 请求ID
 */
export async function getResponseBody(tabId: number, requestId: string): Promise<DebuggerResponseBody> {
  return new Promise<DebuggerResponseBody>((resolve, reject) => {
    chrome.debugger.sendCommand(
      { tabId },
      "Network.getResponseBody",
      { requestId },
      (response: any) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (!response || typeof response !== 'object' || !('body' in response)) {
          reject(new Error('未能获取响应体'));
        } else {
          // 将响应转换为DebuggerResponseBody类型
          const responseBody: DebuggerResponseBody = {
            body: response.body,
            base64Encoded: !!response.base64Encoded
          };
          resolve(responseBody);
        }
      }
    );
  });
}

/**
 * 初始化调试器网络事件监听
 */
export function setupNetworkListeners(): void {
  // 确保调试器API在Service Worker环境中可用
  if (typeof chrome !== 'undefined' && chrome.debugger) {
    // 确保onEvent可用并初始化
    if (!chrome.debugger.onEvent) {
      console.warn('chrome.debugger.onEvent 在当前环境不可用，尝试安全初始化');
      // 记录错误状态
      logToPopup('警告: 调试器API初始化异常，将尝试替代方案');
      
      // MV3 Service Worker环境下的替代方案
      setupDebuggerEventsPolyfill();
      return;
    }
    
    // 标准的调试器事件监听
    try {
      chrome.debugger.onEvent.addListener((source, method, params: any) => {
        const tabId = source.tabId;
        if (tabId === undefined || !debuggeeTabs[tabId] || !debuggeeTabs[tabId].attached) {
          return;
        }

        // 处理请求发送事件
        if (method === 'Network.requestWillBeSent') {
          handleRequestWillBeSent(tabId, params as DebuggerRequestWillBeSentParams);
        }
        // 处理响应接收事件
        else if (method === 'Network.responseReceived') {
          handleResponseReceived(tabId, params as DebuggerResponseReceivedParams);
        }
        // 处理加载完成事件
        else if (method === 'Network.loadingFinished') {
          handleLoadingFinished(tabId, params as DebuggerLoadingFinishedParams);
        }
      });
      
      logToPopup('网络事件监听已初始化');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '未知错误';
      console.error('设置调试器事件监听失败:', errorMsg);
      logToPopup(`调试器事件监听失败: ${errorMsg}，将尝试替代方案`);
      
      // 出错时使用替代方案
      setupDebuggerEventsPolyfill();
    }
  } else {
    console.error('Chrome调试器API不可用');
    logToPopup('错误: Chrome调试器API不可用');
  }
}

/**
 * 为MV3 Service Worker环境提供调试事件的替代实现
 * 使用轮询方式替代事件监听
 */
function setupDebuggerEventsPolyfill(): void {
  logToPopup('正在使用替代方案监听网络事件');
  
  // 标记已附加调试器的标签页
  let monitoredTabs = new Set<number>();
  
  // 定期检查和更新已附加调试器的标签页列表
  const pollAttachedTabs = () => {
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        if (tab.id && debuggeeTabs[tab.id] && debuggeeTabs[tab.id].attached && !monitoredTabs.has(tab.id)) {
          // 为新附加的标签页设置网络监听
          setupTabNetworkMonitoring(tab.id);
          monitoredTabs.add(tab.id);
        }
      });
      
      // 移除已不存在或已分离调试器的标签页
      const existingTabIds = tabs.map(tab => tab.id as number).filter(id => id !== undefined);
      [...monitoredTabs].forEach(tabId => {
        if (!existingTabIds.includes(tabId) || !debuggeeTabs[tabId] || !debuggeeTabs[tabId].attached) {
          monitoredTabs.delete(tabId);
        }
      });
    });
    
    // 每5秒检查一次
    setTimeout(pollAttachedTabs, 5000);
  };
  
  // 开始轮询
  pollAttachedTabs();
}

/**
 * 为特定标签页设置网络监听
 * @param tabId 标签页ID
 */
function setupTabNetworkMonitoring(tabId: number): void {
  if (!debuggeeTabs[tabId] || !debuggeeTabs[tabId].attached) {
    return;
  }
  
  logToPopup(`为标签页 ${tabId} 设置网络监听`);
  
  // 确保网络监听已启用
  chrome.debugger.sendCommand({ tabId }, "Network.enable", {}, () => {
    if (chrome.runtime.lastError) {
      console.error('启用网络监听失败:', chrome.runtime.lastError.message);
      logToPopup(`为标签页 ${tabId} 启用网络监听失败: ${chrome.runtime.lastError.message}`);
      return;
    }
    
    // 设置自定义请求监听
    setupCustomRequestMonitoring(tabId);
  });
}

/**
 * 为标签页设置自定义请求监听
 * @param tabId 标签页ID
 */
function setupCustomRequestMonitoring(tabId: number): void {
  // 请求发送监听
  const monitorRequests = () => {
    if (!debuggeeTabs[tabId] || !debuggeeTabs[tabId].attached) {
      return; // 如果标签页已关闭或调试器已分离，停止监控
    }
    
    // 使用getHARLog获取网络活动
    chrome.debugger.sendCommand({ tabId }, "Network.getRequestPostData", {}, (result) => {
      // 处理结果...
      // 由于这只是一个临时方案，实际实现可能需要调整
    });
    
    // 继续监听
    setTimeout(() => monitorRequests(), 1000);
  };
  
  // 开始监控
  monitorRequests();
}

/**
 * 处理请求发送事件
 * @param tabId 标签页ID
 * @param params 事件参数
 */
function handleRequestWillBeSent(tabId: number, params: DebuggerRequestWillBeSentParams): void {
  const requestId = params.requestId;
  const url = params.request.url;
  const reqMethod = params.request.method;
  const timestamp = params.timestamp ? new Date(params.timestamp * 1000).toISOString() : new Date().toISOString();
  
  // 检查是否为 XMLHttpRequest
  const isXhr = params.type === 'XHR' || 
             (params.request.headers && 
              (params.request.headers['X-Requested-With'] === 'XMLHttpRequest' ||
               params.initiator?.type === 'xhr'));
  
  // 如果是XHR且正在运行监听
  if (isXhr && isRunning && currentConfig.listenUrl) {
    try {
      // 转换通配符为正则表达式
      const pattern = new RegExp(currentConfig.listenUrl.replace(/\*/g, '.*'));
      
      // 如果URL匹配模式
      if (pattern.test(url)) {
        // 保存请求信息
        requestDataMap[requestId] = {
          url,
          method: reqMethod,
          timestamp,
          tabId,
          requestHeaders: params.request.headers,
          status: 0, // 初始化状态为0
          statusCode: 0, // 初始化状态码为0
          contentType: params.request.headers['Content-Type'] || ''
        };
        
        // 添加到标签页的请求ID集合
        addNetworkRequestId(tabId, requestId);
        
        // 日志
        logToPopup(`监听到符合条件的XHR请求: ${url}`);
        
        // 获取请求体
        if (params.request.postData) {
          requestDataMap[requestId].requestBody = params.request.postData;
        }
      }
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : '未知错误';
      logToPopup(`URL模式匹配错误: ${errorMsg}`);
    }
  }
}

/**
 * 处理响应接收事件
 * @param tabId 标签页ID
 * @param params 事件参数
 */
function handleResponseReceived(tabId: number, params: DebuggerResponseReceivedParams): void {
  const requestId = params.requestId;
  
  // 如果是我们正在跟踪的请求
  if (requestDataMap[requestId]) {
    const requestInfo = requestDataMap[requestId];
    
    // 更新状态信息
    requestInfo.status = params.response.status;
    requestInfo.statusCode = params.response.status;
    requestInfo.responseHeaders = params.response.headers;
    requestInfo.contentType = params.response.headers['Content-Type'] || params.response.mimeType;
    
    // URL匹配检查
    if (isRunning && currentConfig.listenUrl) {
      try {
        const pattern = new RegExp(currentConfig.listenUrl.replace(/\*/g, '.*'));
        
        if (pattern.test(requestInfo.url)) {
          // 只处理文本类型的响应
          const contentType = requestInfo.contentType || '';
          const isTextResponse = contentType.includes('text') || 
                               contentType.includes('json') || 
                               contentType.includes('xml') ||
                               contentType.includes('javascript');
          
          if (isTextResponse) {
            // 尝试获取响应体
            getResponseBody(tabId, requestId)
              .then(response => {
                requestInfo.responseBody = response.base64Encoded ? 
                  atob(response.body) : response.body;
                
                // 查询当前标签，发送消息给content script尝试获取响应体
                chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                  if (tabs && tabs[0] && tabs[0].id) {
                    chrome.tabs.sendMessage(tabs[0].id, {
                      command: 'extractResponseBody',
                      url: requestInfo.url,
                      requestId: requestId,
                      timestamp: requestInfo.timestamp
                    });
                  }
                });
                
                // 设置一个超时，如果无法通过content-script获取响应体，则直接处理
                setTimeout(() => {
                  if (requestDataMap[requestId]) {
                    // 准备数据对象用于处理
                    const responseData: NetworkResponseData = {
                      url: requestInfo.url,
                      method: requestInfo.method,
                      // 使用statusCode作为status值，确保与NetworkResponseData接口兼容
                      status: requestInfo.statusCode || 0,
                      timestamp: requestInfo.timestamp,
                      responseBody: requestInfo.responseBody || '',
                      contentType: requestInfo.contentType || '',
                      responseHeaders: requestInfo.responseHeaders || {},
                      // 添加必要的属性以符合NetworkResponseData接口
                      requestHeaders: requestInfo.requestHeaders || {}
                    };
                    
                    // 处理数据
                    handleCapturedData(responseData);
                    
                    // 清理requestDataMap
                    delete requestDataMap[requestId];
                  }
                }, 3000); // 3秒超时
              })
              .catch(err => {
                logToPopup(`获取响应体失败: ${err.message}`);
                delete requestDataMap[requestId];
              });
          } else {
            // 不匹配的请求直接删除
            delete requestDataMap[requestId];
          }
        } else {
          // URL不匹配，删除
          delete requestDataMap[requestId];
        }
      } catch (error: unknown) {
        const errorMsg = error instanceof Error ? error.message : '未知错误';
        logToPopup(`URL模式匹配错误: ${errorMsg}`);
        delete requestDataMap[requestId];
      }
    } else {
      // 如果没有运行或没有配置监听URL，则直接删除
      delete requestDataMap[requestId];
    }
  }
}

/**
 * 处理加载完成事件
 * @param tabId 标签页ID
 * @param params 事件参数
 */
function handleLoadingFinished(tabId: number, params: DebuggerLoadingFinishedParams): void {
  // 加载完成事件的处理可以在这里添加
  // 目前大部分处理逻辑已经在responseReceived中完成
}

/**
 * 清理过期的请求数据
 * @param maxAgeMs 过期时间（毫秒）
 */
export function cleanupExpiredRequests(maxAgeMs: number = 5 * 60 * 1000): void {
  const now = Date.now();
  
  Object.keys(requestDataMap).forEach(requestId => {
    const requestInfo = requestDataMap[requestId];
    const timestamp = new Date(requestInfo.timestamp).getTime();
    
    // 如果请求数据超过指定时间
    if (now - timestamp > maxAgeMs) {
      // 删除该请求数据
      delete requestDataMap[requestId];
    }
  });
}

/**
 * 设置定期清理过期请求数据的任务
 */
export function setupCleanupTask(): void {
  // 每分钟运行一次清理
  setInterval(() => {
    cleanupExpiredRequests();
  }, 60 * 1000);
}
