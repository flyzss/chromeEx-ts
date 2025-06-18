/**
 * xhrHook.js - 注入到页面环境的XHR钩子脚本
 * 此脚本会重写XMLHttpRequest以捕获网络请求和响应
 */
(function() {
  // 保存原始XMLHttpRequest的引用
  const OriginalXMLHttpRequest = window.XMLHttpRequest;
  
  // 自定义事件名称（需要和Content Script中的匹配）
  const XHR_RESPONSE_EVENT = 'st_extension_xhr_response';
  
  // 创建一个函数用于派发事件到Content Script
  function sendToContentScript(data) {
    try {
      const event = new CustomEvent(XHR_RESPONSE_EVENT, {
        detail: JSON.stringify(data)
      });
      document.dispatchEvent(event);
      console.log('[Page Script] 已发送XHR响应到Content Script:', data.url);
    } catch (error) {
      console.error('[Page Script] 发送数据到Content Script时出错:', error);
    }
  }
  
  // 重写XMLHttpRequest构造函数
  window.XMLHttpRequest = function() {
    const xhr = new OriginalXMLHttpRequest();
    
    // 存储请求信息
    const xhrInfo = {
      url: '',
      method: '',
      requestBody: '',
      requestHeaders: {}
    };
    
    // 存储原始方法
    const originalOpen = xhr.open;
    const originalSend = xhr.send;
    const originalSetRequestHeader = xhr.setRequestHeader;
    
    // 钩住open方法
    xhr.open = function(method, url, ...rest) {
      const urlString = typeof url === 'string' ? url : url.toString();
      xhrInfo.url = urlString;
      xhrInfo.method = method;
      console.log('[Page Script] XHR open:', method, urlString);
      return originalOpen.apply(xhr, [method, url, ...rest]);
    };
    
    // 钩住setRequestHeader方法
    xhr.setRequestHeader = function(name, value) {
      xhrInfo.requestHeaders[name] = value;
      return originalSetRequestHeader.apply(xhr, [name, value]);
    };
    
    // 钩住send方法
    xhr.send = function(body) {
      // 处理请求体
      if (body) {
        try {
          if (typeof body === 'string') {
            xhrInfo.requestBody = body;
          } else if (body instanceof FormData || body instanceof URLSearchParams) {
            xhrInfo.requestBody = '[FormData或URLSearchParams对象]';
          } else if (body instanceof Blob || body instanceof ArrayBuffer) {
            xhrInfo.requestBody = '[二进制数据]';
          } else {
            // 尝试JSON序列化
            xhrInfo.requestBody = JSON.stringify(body);
          }
        } catch (e) {
          console.error('[Page Script] 无法序列化请求体:', e);
          xhrInfo.requestBody = '[无法序列化的数据]';
        }
      }
      
      // 添加load事件监听器，在响应完成时获取数据
      xhr.addEventListener('load', function() {
        try {
          // 获取响应状态
          const status = this.status;
          
          // 解析响应头
          const responseHeaders = {};
          const headersString = this.getAllResponseHeaders();
          const headerLines = headersString.split(/\r?\n/);
          
          for (const line of headerLines) {
            if (line) {
              const parts = line.split(': ');
              if (parts.length === 2) {
                responseHeaders[parts[0]] = parts[1];
              }
            }
          }
          
          // 准备响应数据
          let responseBody = '';
          
          try {
            // 尝试读取响应文本
            responseBody = this.responseText || '';
          } catch (textError) {
            console.warn('[Page Script] 无法读取XHR响应文本:', textError);
            responseBody = '[无法读取的响应文本]';
          }
          
          // 创建要发送的数据对象
          const data = {
            url: xhrInfo.url,
            method: xhrInfo.method,
            requestBody: xhrInfo.requestBody,
            responseBody: responseBody,
            responseStatus: status,
            responseHeaders: responseHeaders,
            contentType: responseHeaders['content-type'] || '',
            timestamp: new Date().toISOString()
          };
          
          // 发送数据到Content Script
          sendToContentScript(data);
        } catch (error) {
          console.error('[Page Script] 处理XHR响应时出错:', error);
        }
      });
      
      // 添加错误处理
      xhr.addEventListener('error', function() {
        console.error('[Page Script] XHR请求错误:', xhrInfo.url);
      });
      
      // 调用原始send方法
      return originalSend.apply(xhr, arguments);
    };
    
    return xhr;
  };
  
  console.log('[Page Script] XHR钩子已安装');
})();
