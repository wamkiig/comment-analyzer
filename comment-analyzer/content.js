chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extractComments') {
    const result = extractComments();
    console.log('Extracted comments:', result);
    sendResponse({ comments: result });
  }
  return true;
});

function extractComments() {
  const url = location.href;
  let selectors = [];

  if (url.includes('xiaohongshu.com')) {
    selectors = [
      '.comment-item .content',
      '.comment-content .text',
      '.note-comment .comment-text',
      '[class*="comment"] [class*="text"]'
    ];
  } else if (url.includes('douyin.com')) {
    selectors = [
      '.comment-content .text',
      '.comment-item .comment-text',
      '[class*="Comment"] [class*="content"]'
    ];
  }

  let allComments = [];
  for (const selector of selectors) {
    const elements = document.querySelectorAll(selector);
    if (elements.length > 0) {
      elements.forEach(el => {
        const text = el.textContent.trim();
        if (text && !allComments.includes(text)) {
          allComments.push(text);
        }
      });
      break;
    }
  }

  // 降级方案
  if (allComments.length === 0) {
    const bodyText = document.body.innerText;
    const lines = bodyText.split('\n').filter(t => t.trim().length > 10);
    allComments = lines.slice(0, 30);
  }

  return allComments.slice(0, 30).join('\n');
}