(function() {
  // 保存原始fetch函数
  const originalFetch = window.fetch;
  
  // 自定义事件名称（需要和Content Script中的匹配）
  const FETCH_RESPONSE_EVENT = 'st_extension_fetch_response';

  // 重写fetch函数
  window.fetch = async function(...args) {
    // 获取URL和请求选项
    let url;
    let options = {};
    
    if (typeof args[0] === 'string') {
      url = args[0];
      options = args[1] || {};
    } else if (args[0] instanceof URL) {
      url = args[0].href;
      options = args[1] || {};
    } else if (args[0] instanceof Request) {
      url = args[0].url;
      // 对于Request对象，可能需要更多处理
    } else {
      // 无法确定URL，跳过监控
      return originalFetch.apply(this, args);
    }
    
    const method = options.method || 'GET';
    console.log('[Page Script] 拦截到fetch请求:', url);
    
    // 请求体处理
    let requestBody = '';
    if (options.body) {
      if (typeof options.body === 'string') {
        requestBody = options.body;
      } else {
        try {
          requestBody = JSON.stringify(options.body);
        } catch (e) {
          console.debug('[Page Script] 无法序列化请求体:', e);
        }
      }
    }

    // 调用原始fetch
    try {
      const response = await originalFetch.apply(this, args);
      
      // 克隆响应以便我们可以读取正文
      response.clone().text().then(responseText => {
        // 准备响应头信息
        const responseHeaders = {};
        response.headers.forEach((value, key) => {
          responseHeaders[key] = value;
        });
        
        // 创建要发送的数据对象
        const data = {
          url,
          method,
          requestBody,
          responseBody: responseText,
          responseStatus: response.status,
          responseHeaders
        };
        
        // 创建并触发自定义事件
        const customEvent = new CustomEvent(FETCH_RESPONSE_EVENT, {
          detail: JSON.stringify(data)
        });
        document.dispatchEvent(customEvent);
        console.log('[Page Script] 已发送fetch响应到Content Script:', url);
      }).catch(error => {
        console.error('[Page Script] 读取响应正文失败:', error);
      });
      
      return response;
    } catch (error) {
      console.error('[Page Script] Fetch执行错误:', error);
      throw error;
    }
  };
})();
