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

// 正在处理中的响应体请求ID集合，防止在获取响应体后、处理前被清理
const processingRequestIds: Set<string> = new Set();

/**
 * 获取响应体，带重试机制
 * @param tabId 标签页ID
 * @param requestId 请求ID
 * @param retryCount 重试次数，默认3次
 * @param retryDelay 初始重试延迟，毫秒
 */
export async function getResponseBody(
  tabId: number, 
  requestId: string, 
  retryCount: number = 100, 
  retryDelay: number = 1000
): Promise<DebuggerResponseBody> {
  // 将请求ID添加到正在处理集合中，防止被提前清理
  processingRequestIds.add(requestId);
  
  // 增加调试信息：记录开始获取响应体的尝试
  console.log(`[调试] 开始获取响应体: 标签页=${tabId}, 请求ID=${requestId}, 剩余重试=${retryCount}, 正在处理集合大小=${processingRequestIds.size}`);
  
  // 检查调试器状态
  const isAttached = debuggeeTabs[tabId]?.attached;
  const isRequestRegistered = debuggeeTabs[tabId]?.networkRequestIds.has(requestId);
  
  console.log(`[调试] 调试器状态检查: 标签页=${tabId}, 已附加=${isAttached}, 请求已注册=${isRequestRegistered}`);
  
  // 更加严格的前置条件检查
  if (!isAttached) {
    console.log(`[警告] 调试器没有附加到标签页 ${tabId}，尝试重新附加`);
    try {
      // 尝试重新附加调试器
      await new Promise<void>((resolve, reject) => {
        chrome.debugger.attach({ tabId }, "1.3", () => {
          if (chrome.runtime.lastError) {
            reject(new Error(`无法附加调试器: ${chrome.runtime.lastError.message}`));
          } else {
            // 更新状态
            if (!debuggeeTabs[tabId]) {
              debuggeeTabs[tabId] = { 
                tabId: tabId,
                attached: true,
                url: '', // 此时可能还不知道URL，使用空字符串作为默认值
                networkRequestIds: new Set()
              };
            } else {
              debuggeeTabs[tabId].attached = true;
            }
            resolve();
          }
        });
      });
      
      // 激活 Network 域
      await new Promise<void>((resolve, reject) => {
        chrome.debugger.sendCommand({ tabId }, "Network.enable", {}, () => {
          if (chrome.runtime.lastError) {
            reject(new Error(`无法启用Network域: ${chrome.runtime.lastError.message}`));
          } else {
            resolve();
          }
        });
      });
      
      console.log(`[成功] 重新附加调试器到标签页 ${tabId}`);
      
      // 由于请求ID可能已过期，我们需要等待新请求
      // 返回错误以触发重试
      throw new Error('调试器已重新附加，需要重新获取响应体');
    } catch (attachError) {
      console.error(`[错误] 重新附加调试器失败: ${attachError instanceof Error ? attachError.message : '未知错误'}`);
      // 如果还有重试次数，继续重试
      if (retryCount > 0) {
        console.log(`[调试] 由于调试器问题将重试: 标签页=${tabId}, 请求ID=${requestId}`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        return getResponseBody(tabId, requestId, retryCount - 1, retryDelay * 1.5);
      } else {
        throw new Error(`调试器附加失败，无法获取响应体`);
      }
    }
  }
  
  try {
    // 记录请求开始时间，用于计算耗时
    const startTime = Date.now();
    
    const responseBody = await new Promise<DebuggerResponseBody>((resolve, reject) => {
      chrome.debugger.sendCommand(
        { tabId },
        "Network.getResponseBody",
        { requestId },
        (response: any) => {
          const endTime = Date.now();
          const duration = endTime - startTime;
          
          if (chrome.runtime.lastError) {
            const errorMessage = chrome.runtime.lastError.message||'';
            const errorDetails = {
              tabId,
              requestId,
              error: errorMessage,
              debuggerAttached: isAttached,
              requestRegistered: isRequestRegistered,
              requestInfo: requestDataMap[requestId] ? '存在' : '不存在',
              duration: `${duration}ms`,
              timestamp: new Date().toISOString()
            };
            
            console.log(`[调试错误详情]`, JSON.stringify(errorDetails, null, 2));
            logToPopup(`获取响应体详细错误: ${errorMessage}, 请求ID=${requestId}`);
            
            // 特别处理 "No data found for resource with given identifier" 错误
            if (errorMessage.includes('No data found for resource')) {
              // 这种情况可能是因为浏览器缓存或调试器API限制
              // 给它一个更短的重试延迟，因为这种情况通常在短时间内重试就能成功
              reject(new Error('RESOURCE_NOT_FOUND:' + errorMessage));
            } else {
              // 其他类型的错误
              reject(new Error(errorMessage));
            }
          } else if (!response || typeof response !== 'object' || !('body' in response)) {
            const errorDetails = {
              tabId,
              requestId,
              error: '响应对象无效或缺少body属性',
              response: response ? typeof response : 'null',
              debuggerAttached: isAttached,
              requestRegistered: isRequestRegistered,
              requestInfo: requestDataMap[requestId] ? '存在' : '不存在',
              duration: `${duration}ms`,
              timestamp: new Date().toISOString()
            };
            
            console.log(`[调试错误详情]`, JSON.stringify(errorDetails, null, 2));
            logToPopup(`获取响应体失败: 无效响应对象, 请求ID=${requestId}`);
            reject(new Error('未能获取响应体'));
          } else {
            // 成功获取响应体
            console.log(`[调试] 成功获取响应体: 标签页=${tabId}, 请求ID=${requestId}, 耗时=${duration}ms, 响应大小=${response.body.length}字节`);
            
            // 将响应转换为DebuggerResponseBody类型
            const responseBody: DebuggerResponseBody = {
              body: response.body,
              base64Encoded: !!response.base64Encoded
            };
            // 成功获取响应体后将requestId标记为已完成
            if (!requestDataMap[requestId]) {
              console.log(`[警告] 获取响应体成功但requestDataMap中无此requestId: ${requestId}`);
            } else {
              requestDataMap[requestId].responseBodyReady = true;
              console.log(`[调试] 标记requestId=${requestId}响应体已就绪，等待后续处理`);
            }
            resolve(responseBody);
          }
        }
      );
    });
    
    return responseBody;
    
  } catch (error) {
    // 当还有重试次数时，等待一段时间后重试
    if (retryCount > 0) {
      // 记录重试信息
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      const isResourceNotFound = errorMessage.startsWith('RESOURCE_NOT_FOUND:');
      
      // 对于资源未找到错误，使用更短的重试延迟
      let nextRetryDelay = isResourceNotFound ? Math.min(retryDelay, 500) : retryDelay * 1.5;
      
      console.log(`[调试] 将重试获取响应体(${5-retryCount+1}/5): 标签页=${tabId}, 请求ID=${requestId}, 延迟=${nextRetryDelay}ms`);
      logToPopup(`响应体获取失败，准备重试(${5-retryCount+1}/5), 请求ID=${requestId}`);
      
      // 等待一段时间后重试
      await new Promise(resolve => setTimeout(resolve, nextRetryDelay));
      
      // 重试，并使用动态退避策略
      return getResponseBody(tabId, requestId, retryCount - 1, nextRetryDelay);
    }
    
    // 重试耗尽后抛出原始异常
    processingRequestIds.delete(requestId); // 清理处理标记
    throw error;
  } finally {
    // 如果是最后一次重试或者成功获取响应体，则不在这里移除标记
    // 因为我们需要保持请求ID在处理集合中直到完全处理结束
    // 在超时处理后或getResponseBody抛出异常时再移除
  }
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
    
    // 检查是否应该处理此请求（是否开启扩展功能并且有监听URL配置）
    if (isRunning && currentConfig?.listenUrl) {
      try {
        // 使用正则表达式匹配URL
        const pattern = new RegExp(currentConfig.listenUrl.replace(/\*/g, '.*'));
        
        // 调试信息：记录URL匹配检查
        console.log(`[调试] 响应处理URL匹配检查: ${requestInfo.url} 与模式 ${currentConfig.listenUrl} 比较`);
        
        if (pattern.test(requestInfo.url)) {
          console.log(`[调试] URL匹配成功: ${requestInfo.url}`);
          
          // 只处理文本类型的响应
          const contentType = requestInfo.contentType || '';
          const isTextResponse = contentType.includes('text') || 
                               contentType.includes('json') || 
                               contentType.includes('xml') ||
                               contentType.includes('javascript');
          
          console.log(`[调试] 内容类型检查: ${contentType}, 是文本响应=${isTextResponse}`);
          
          // 在获取响应体前检查调试器状态
          const debuggerInfo = debuggeeTabs[tabId];
          console.log(`[调试] 获取响应体前检查: 标签页=${tabId}, 调试器已附加=${debuggerInfo?.attached}, 请求已注册=${debuggerInfo?.networkRequestIds.has(requestId)}`);
          
          if (isTextResponse) {
            // 尝试获取响应体
            getResponseBody(tabId, requestId)
              .then(response => {
                requestInfo.responseBody = response.base64Encoded ? 
                  atob(response.body) : response.body;
                
                // 查询当前标签，发送消息给content script尝试获取响应体
                // 首先尝试向原始请求的标签页发送消息
                if (tabId) {
                  try {
                    chrome.tabs.sendMessage(tabId, {
                      command: 'extractResponseBody',
                      url: requestInfo.url,
                      requestId: requestId,
                      timestamp: requestInfo.timestamp
                    }, (response) => {
                      // 错误处理
                      if (chrome.runtime.lastError) {
                        console.log(`[调试] 向原始标签页发送消息失败: ${chrome.runtime.lastError.message}, 尝试查找活动标签页`);
                        // 如果向原始标签页发送失败，则尝试查询活动标签页
                        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                          if (tabs && tabs[0] && tabs[0].id) {
                            // 确保我们不会重复发送到相同的标签页
                            if (tabs[0].id !== tabId) {
                              chrome.tabs.sendMessage(tabs[0].id, {
                                command: 'extractResponseBody',
                                url: requestInfo.url,
                                requestId: requestId,
                                timestamp: requestInfo.timestamp
                              }, (innerResponse) => {
                                if (chrome.runtime.lastError) {
                                  console.log(`[调试] 向活动标签页发送消息也失败: ${chrome.runtime.lastError.message}, 继续处理响应体`);
                                }
                              });
                            }
                          }
                        });
                      }
                    });
                  } catch (msgError) {
                    console.error(`[错误] 发送消息时出现异常: ${msgError instanceof Error ? msgError.message : '未知错误'}`);
                  }
                } else {
                  // 如果没有原始标签页信息，则查询活动标签页
                  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                    if (tabs && tabs[0] && tabs[0].id) {
                      try {
                        chrome.tabs.sendMessage(tabs[0].id, {
                          command: 'extractResponseBody',
                          url: requestInfo.url,
                          requestId: requestId,
                          timestamp: requestInfo.timestamp
                        }, (response) => {
                          if (chrome.runtime.lastError) {
                            console.log(`[调试] 向活动标签页发送消息失败: ${chrome.runtime.lastError.message}, 继续处理响应体`);
                          }
                        });
                      } catch (msgError) {
                        console.error(`[错误] 发送消息时出现异常: ${msgError instanceof Error ? msgError.message : '未知错误'}`);
                      }
                    }
                  });
                }
                
                // 标记该请求正在处理中
                console.log(`[调试] 响应体获取成功，准备后续处理: ${requestId}`);
                
                // 改为较短的超时，大多数情况下可以直接处理
                setTimeout(() => {
                  try {
                    console.log(`[调试] 超时处理响应体: ${requestId}, 请求仍在Map中=${!!requestDataMap[requestId]}`);
                    
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
                      
                      // 处理数据前记录日志
                      console.log(`[调试] 开始处理数据: ${requestId}, URL=${responseData.url}, 响应大小=${responseData.responseBody?.length || 0}字节`);
                      
                      try {
                        // 处理数据
                        handleCapturedData(responseData);
                        console.log(`[调试] 数据处理成功: ${requestId}`);
                      } catch (processError) {
                        console.error(`[错误] 数据处理异常: ${processError instanceof Error ? processError.message : '未知错误'}`);
                        logToPopup(`数据处理错误: ${processError instanceof Error ? processError.message : '未知错误'}`);
                      } finally {
                        // 清理requestDataMap和处理中标记
                        console.log(`[调试] 清理requestDataMap和处理标记: ${requestId}`);
                        delete requestDataMap[requestId];
                        processingRequestIds.delete(requestId);
                        console.log(`[调试] 处理中集合大小: ${processingRequestIds.size}`);
                      }
                    } else {
                      console.log(`[警告] 超时处理时requestDataMap中没有此ID: ${requestId}`);
                    }
                  } catch (timeoutError) {
                    console.error(`[错误] 超时处理出现异常: ${timeoutError instanceof Error ? timeoutError.message : '未知错误'}`);
                    logToPopup(`超时处理错误: ${timeoutError instanceof Error ? timeoutError.message : '未知错误'}`);
                    // 确保即使出错也清理requestDataMap
                    if (requestDataMap[requestId]) {
                      delete requestDataMap[requestId];
                    }
                  }
                }, 1000); // 缩短为5秒超时，更快地处理数据
              })
              .catch(err => {
                // 详细的错误诊断信息
                const diagnosticInfo = {
                  error: err.message,
                  requestId,
                  tabId,
                  url: requestInfo.url,
                  debuggerAttached: debuggeeTabs[tabId]?.attached || false,
                  requestRegistered: debuggeeTabs[tabId]?.networkRequestIds.has(requestId) || false,
                  requestDataExists: !!requestDataMap[requestId],
                  contentType: requestInfo.contentType,
                  timestamp: new Date().toISOString(),
                  // 收集所有已注册的请求ID用于调试（限制数量）
                  registeredRequestIds: debuggeeTabs[tabId]?.networkRequestIds ? 
                    Array.from(debuggeeTabs[tabId].networkRequestIds).slice(0, 5) : [],
                  // 检查请求与错误之间的时间差
                  timeSinceRequest: requestInfo.timestamp ? 
                    `${Date.now() - new Date(requestInfo.timestamp).getTime()}ms` : '未知'
                };
                
                console.log(`[详细错误诊断] 获取响应体失败:`, JSON.stringify(diagnosticInfo, null, 2));
                logToPopup(`获取响应体失败: ${err.message} | 请求ID=${requestId} | URL=${requestInfo.url}`);
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
  const cleanedRequestIds: string[] = [];
  const skippedRequestIds: string[] = [];
  
  Object.keys(requestDataMap).forEach(requestId => {
    const requestInfo = requestDataMap[requestId];
    const timestamp = new Date(requestInfo.timestamp).getTime();
    
    // 如果请求数据超过指定时间
    if (now - timestamp > maxAgeMs) {
      // 判断是否正在处理中
      if (processingRequestIds.has(requestId)) {
        // 跳过正在处理中的请求
        skippedRequestIds.push(requestId);
      } else {
        // 删除该请求数据
        delete requestDataMap[requestId];
        cleanedRequestIds.push(requestId);
      }
    }
  });
  
  // 记录清理情况
  if (cleanedRequestIds.length > 0 || skippedRequestIds.length > 0) {
    console.log(`[清理] 已清理 ${cleanedRequestIds.length} 个过期请求，跳过 ${skippedRequestIds.length} 个正在处理中的请求，处理中集合大小=${processingRequestIds.size}`);
  }
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
