// dataHandler.ts
// 处理捕获的网络请求数据

import { NetworkResponseData } from '../types';
import { currentConfig, isRunning, logToPopup } from './statusManager';
import { processData, submitData } from './dataProcessor';

/**
 * 处理捕获到的网络请求数据
 * @param responseData 响应数据
 */
export function handleCapturedData(responseData: NetworkResponseData): void {
  // 记录请求基本信息
  const contentTypeShort = responseData.contentType ? responseData.contentType.split(';')[0] : '未知类型';
  const responseSize = responseData.responseBody ? (responseData.responseBody.length / 1024).toFixed(2) : '0';
  
  // 向UI发送详细请求日志
  logToPopup(`捕获XHR: ${responseData.method} ${responseData.url} (状态码: ${responseData.status}, 类型: ${contentTypeShort}, 大小: ${responseSize}KB)`);

  // 检查URL是否匹配配置的监听URL模式
  if (isRunning && currentConfig.listenUrl && responseData.url) {
    try {
      const pattern = new RegExp(currentConfig.listenUrl.replace(/\*/g, '.*'));
      if (pattern.test(responseData.url)) {
        logToPopup(`处理匹配的网络请求: ${responseData.url} (状态码: ${responseData.status})`);
        
        // 向popup发送捕获的数据
        chrome.runtime.sendMessage({
          type: 'capturedData',
          data: {
            url: responseData.url,
            method: responseData.method,
            status: responseData.status,
            contentType: contentTypeShort,
            size: responseSize,
            timestamp: new Date().toISOString(),
            responsePreview: responseData.responseBody ? responseData.responseBody.substring(0, 200) + '...' : '无内容'
          }
        });

        // 使用现有的数据处理和提交逻辑
        processData(responseData)
          .then(processedData => {
            // 数据提交
            submitData(processedData);
          })
          .catch(error => {
            // 处理错误
            logToPopup(`处理数据失败: ${error instanceof Error ? error.message : '未知错误'}`);
          });
      }
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : '未知错误';
      logToPopup(`URL匹配错误: ${errorMsg}`);
    }
  }
}

/**
 * 验证捕获的数据是否有效
 * @param data 要验证的数据
 */
export function validateCapturedData(data: NetworkResponseData): boolean {
  // 基本验证
  if (!data || !data.url || !data.method) {
    return false;
  }
  
  // 状态码验证 (可选)
  if (data.status && (data.status < 100 || data.status >= 600)) {
    return false;
  }
  
  return true;
}

/**
 * 格式化响应内容供显示
 * @param body 响应体内容
 * @param contentType 内容类型
 */
export function formatResponseForDisplay(body: string, contentType?: string): string {
  if (!body) return '';
  
  // 尝试美化JSON
  if (contentType && contentType.includes('json')) {
    try {
      const json = JSON.parse(body);
      return JSON.stringify(json, null, 2);
    } catch (e) {
      // 解析失败，返回原始内容
      return body;
    }
  }
  
  return body;
}
