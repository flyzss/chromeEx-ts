/**
 * 按钮操作辅助模块
 * 提供按钮查找和点击功能
 */

/**
 * 查找并点击页面上的元素
 * @param selector CSS选择器或XPath表达式
 * @returns 操作结果对象
 */
export function findAndClickButton(selector: string): {success: boolean, error?: string} {
  // 检查选择器是否为空
  if (!selector) {
    return { success: false, error: '选择器为空' };
  }

  try {
    // 尝试使用 querySelector 查找按钮
    let button: Element | null = document.querySelector(selector);
    
    // 如果 querySelector 未找到，并且选择器可能为 XPath，则尝试使用 XPath
    if (!button && (selector.startsWith('/') || selector.startsWith('./') || selector.startsWith('('))) {
      const xpathResult = document.evaluate(selector, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
      button = xpathResult.singleNodeValue as Element;
    }

    // 检查按钮是否存在且可见
    if (button && (button instanceof HTMLElement)) {
      const buttonElement = button as HTMLElement;
      // 检查按钮是否可见且可点击
      const style = window.getComputedStyle(buttonElement);
      if (style.display === 'none' || style.visibility === 'hidden') {
        return { success: false, error: '按钮已找到但不可见' };
      } else {
        // 检查按钮是否被禁用 - 需要进行类型检查
        const isDisabled = buttonElement.hasAttribute('disabled') || 
                          (buttonElement instanceof HTMLButtonElement && buttonElement.disabled) || 
                          (buttonElement instanceof HTMLInputElement && buttonElement.disabled);
        
        if (!isDisabled) {
          try {
            // 执行点击操作
            buttonElement.click();
            return { success: true };
          } catch (error: any) {
            return { success: false, error: `点击失败: ${error.message}` };
          }
        } else {
          return { success: false, error: '按钮被禁用' };
        }
      }
    } else {
      return { success: false, error: '未找到匹配选择器的按钮' };
    }
  } catch (e) {
    const error = e as Error;
    return { success: false, error: error.message };
  }
}
