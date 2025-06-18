// dataProcessor.ts
// 处理和提交数据

import { currentConfig, logToPopup } from './statusManager';
import { ResponseData, NetworkResponseData } from '../types';

/**
 * 数据整理引擎函数，根据配置的处理方法对数据进行整理
 * @param data - 原始数据（可能是ResponseData或NetworkResponseData）
 * @returns 处理后的数据
 */
export async function processData(data: ResponseData | NetworkResponseData): Promise<any> {
  logToPopup('开始整理数据...');
  // 检查是否有整理方法配置
  if (currentConfig.dataProcessingMethod === 'none' || !currentConfig.dataProcessingMethod) {
    logToPopup('数据整理方法：无。');
    return data; // 如果没有选择整理方法，直接返回原始数据
  }

  if (currentConfig.dataProcessingMethod === 'extractJsonField') {
    // 提取特定JSON字段，针对捕获的网络响应提取data.result字段
    try {
      // 确定如何处理数据
      let jsonData: any;
      let responseBody = '';
      
      // 判断数据类型：NetworkResponseData 或 ResponseData
      if ('responseBody' in data) {
        // NetworkResponseData类型（从content script获取的数据）
        responseBody = data.responseBody as string;
      } else if ('url' in data && typeof data.url === 'string') {
        // 可能是ResponseData类型
        responseBody = data as any;
      }
      
      // 尝试解析响应体
      if (typeof responseBody === 'string') {
        try { 
          jsonData = JSON.parse(responseBody); 
          logToPopup('成功解析响应JSON数据');
        } catch (e) { 
          logToPopup('解析JSON失败，可能不是JSON字符串');
          return data;
        }
      } else if (responseBody && typeof responseBody === 'object') {
        jsonData = responseBody;
      } else {
        return data;
      }
      
      // 特定处理：提取data.result字段
      if (jsonData && typeof jsonData === 'object' && jsonData.data && jsonData.data.result) {
        logToPopup('成功提取data.result字段，准备发送数据');
        return jsonData.data.result;
      } else {
        logToPopup('未找到data.result字段，尝试查找其他数据格式');
        
        // 备用处理：支持自定义字段提取（可通过配置项指定）
        const fieldPath = currentConfig.extractField || 'result.records';
        const fieldParts = fieldPath.split('.');
        
        let result = jsonData;
        for (const part of fieldParts) {
          if (result && typeof result === 'object' && part in result) {
            result = result[part];
          } else {
            logToPopup(`未找到字段路径: ${fieldPath}`);
            return data;
          }
        }
        
        logToPopup(`成功提取字段: ${fieldPath}`);
        return result;
      }
    } catch (e: any) {
      logToPopup(`数据处理失败: ${e.message}`);
      return data;
    }
  }

  if (currentConfig.dataProcessingMethod === 'customScript') {
    // 高级逻辑：执行用户提供的JavaScript代码
    if (currentConfig.customScript) {
      logToPopup('数据整理：执行自定义脚本。');
      try {
        // 注意：直接使用 Function 构造器或 eval 执行用户脚本存在安全风险。
        // Manifest V3 推荐在沙箱环境 (如 iframe) 中执行不受信任的代码。
        // 或者使用更安全的解析和执行机制。
        // 为了演示，这里使用 Function 构造器，但生产环境需要更安全的方案。
        const processFunction = new Function('responseData', currentConfig.customScript);
        const processed = await Promise.resolve(processFunction(data));
        logToPopup('自定义脚本执行完毕。');
        return processed;
      } catch (e: any) {
        logToPopup(`自定义脚本执行错误: ${e.message}`);
        return { originalData: data, error: `Custom script error: ${e.message}` };
      }
    } else {
      logToPopup('数据整理：自定义脚本为空。');
      return data;
    }
  }
  // 如果没有匹配的处理方法
  return data;
}

/**
 * 数据提交模块函数，将处理后的数据提交到指定URL
 * @param dataToSubmit - 要提交的数据
 * @returns Promise对象
 */
export async function submitData(dataToSubmit: any): Promise<void> {
  // 检查是否有提交URL的配置
  if (!currentConfig.submitUrl) {
    logToPopup('数据提交URL未配置，跳过提交。');
    return; // 如果没有提交URL，则不执行
  }
  logToPopup(`准备提交数据到: ${currentConfig.submitUrl}`);
  try {
    // 使用 fetch API 发送 POST 请求
    const response = await fetch(currentConfig.submitUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(dataToSubmit)
    });

    // 检查响应状态
    if (response.ok) {
      const responseData = await response.text(); // 或 response.json() 如果服务器返回JSON
      logToPopup(`数据成功提交到 ${currentConfig.submitUrl}。服务器响应: ${responseData.substring(0,100)}...`);
    } else {
      logToPopup(`数据提交失败。服务器返回状态: ${response.status} ${response.statusText}`);
    }
  } catch (error: any) {
    logToPopup(`数据提交过程中发生网络错误: ${error.message}`);
  }
}
