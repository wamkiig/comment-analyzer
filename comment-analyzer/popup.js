const API_URL = 'https://comment-analyzer-one.vercel.app/api/analyze';
const DAILY_FREE = 3;
const STORAGE_KEY_DATE = 'ct_plugin_date';
const STORAGE_KEY_COUNT = 'ct_plugin_count';
const STORAGE_KEY_ACTIVATED = 'ct_plugin_activated';
const VALID_ACTIVATION_CODES = ['JP2024-FREE', 'PRO-UNLOCK'];
const PAY_QR_URL = 'https://ibb.co/mCSscTrc.png'; // 替换成你的收款码直链

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  updateQuota();
});

// 次数管理
function getToday() { return new Date().toISOString().split('T')[0]; }

function getRemaining() {
  const activated = localStorage.getItem(STORAGE_KEY_ACTIVATED);
  if (activated === 'true') return Infinity;

  const today = getToday();
  const savedDate = localStorage.getItem(STORAGE_KEY_DATE);
  const usedCount = parseInt(localStorage.getItem(STORAGE_KEY_COUNT) || '0');
  if (savedDate !== today) {
    localStorage.setItem(STORAGE_KEY_DATE, today);
    localStorage.setItem(STORAGE_KEY_COUNT, '0');
    return DAILY_FREE;
  }
  return Math.max(0, DAILY_FREE - usedCount);
}

function useOneQuota() {
  const today = getToday();
  const savedDate = localStorage.getItem(STORAGE_KEY_DATE);
  let usedCount = parseInt(localStorage.getItem(STORAGE_KEY_COUNT) || '0');
  if (savedDate !== today) usedCount = 0;
  usedCount++;
  localStorage.setItem(STORAGE_KEY_DATE, today);
  localStorage.setItem(STORAGE_KEY_COUNT, usedCount.toString());
}

function updateQuota() {
  const remain = getRemaining();
  document.getElementById('remainCount').textContent = remain === Infinity ? '无限' : remain;
  const btn = document.getElementById('analyzeBtn');
  btn.disabled = (remain <= 0);
  btn.textContent = remain <= 0 ? '今日次数已用完' : '分析当前笔记评论区';
}

// 激活功能
function activate() {
  const code = document.getElementById('activateCode').value.trim().toUpperCase();
  if (VALID_ACTIVATION_CODES.includes(code)) {
    localStorage.setItem(STORAGE_KEY_ACTIVATED, 'true');
    updateQuota();
    document.getElementById('resultArea').innerHTML = '<div class="card" style="text-align:center;color:green;">激活成功！现在可以无限使用。</div>';
  } else {
    alert('激活码无效，请检查输入或联系作者购买。');
  }
}
window.activate = activate;

// 显示付费界面
function showPayWall() {
  const resultArea = document.getElementById('resultArea');
  resultArea.innerHTML = `
    <div class="card pay-card">
      <h3>今日免费次数已用完</h3>
      <p style="color:var(--text-secondary);">
        API调用成本较高，免费额度仅供试用。<br>
        你可以付费解锁无限使用，支持月费9.9元或永久29.9元。
      </p>
      <div>
        <img src="${PAY_QR_URL}" alt="收款码">
      </div>
      <p style="font-size:11px;color:#999;">微信/支付宝扫码支付<br>支付后请联系作者获取激活码</p>
      <input type="text" id="activateCode" class="activate-input" placeholder="输入激活码">
      <button class="activate-btn" onclick="activate()">激活</button>
    </div>
  `;
}

// 渲染分析结果
function renderResult(data) {
  let html = '';
  if (data.audience) {
    html += `<div class="card"><h3>用户画像</h3><p>${escapeHTML(data.audience)}</p>`;
    if (data.emotions) {
      html += '<div>';
      data.emotions.forEach(e => html += `<span class="tag">${escapeHTML(e)}</span>`);
      html += '</div>';
    }
    html += '</div>';
  }
  if (data.painPoints && data.painPoints.length) {
    html += '<div class="card"><h3>高频痛点</h3><ul style="padding-left:16px;margin:4px 0;">';
    data.painPoints.forEach(p => html += `<li>${escapeHTML(p)}</li>`);
    html += '</ul></div>';
  }
  if (data.gaps && data.gaps.length) {
    html += '<div class="card"><h3>未回答问题</h3><ul style="padding-left:16px;margin:4px 0;">';
    data.gaps.forEach(g => html += `<li>${escapeHTML(g)}</li>`);
    html += '</ul></div>';
  }
  if (data.topicIdeas && data.topicIdeas.length) {
    html += '<div class="card"><h3>选题建议</h3>';
    data.topicIdeas.forEach((t, i) => {
      html += `<div style="margin-bottom:8px;"><strong>${i+1}. ${escapeHTML(t.title)}</strong><br><span style="color:#888;">${escapeHTML(t.reason)}</span></div>`;
    });
    html += '</div>';
  }
  if (data.summary) {
    html += `<div class="card"><h3>总结</h3><p>${escapeHTML(data.summary)}</p></div>`;
  }
  document.getElementById('resultArea').innerHTML = html;
}

function escapeHTML(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

// 主分析流程
document.getElementById('analyzeBtn').addEventListener('click', async () => {
  const btn = document.getElementById('analyzeBtn');
  const resultArea = document.getElementById('resultArea');
  
  const remaining = getRemaining();
  if (remaining <= 0) {
    showPayWall();
    return;
  }

  btn.disabled = true;
  btn.textContent = '分析中...';
  resultArea.innerHTML = '<div class="loading">正在抓取评论区...</div>';

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'extractComments' });
    
    if (!response || !response.comments) {
      throw new Error('未找到评论区内容，请确保在小红书或抖音笔记页面。');
    }

    const comments = response.comments;
    const url = tab.url;
    const platform = url.includes('douyin.com') ? 'douyin' : 'xiaohongshu';

    resultArea.innerHTML = '<div class="loading">正在分析评论...</div>';

    const apiResponse = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, platform, comments })
    });

    if (!apiResponse.ok) {
      const err = await apiResponse.json().catch(() => ({}));
      throw new Error(err.error || '分析失败');
    }

    const data = await apiResponse.json();
    useOneQuota();
    updateQuota();
    renderResult(data);
    btn.textContent = '重新分析';
  } catch (e) {
    resultArea.innerHTML = `<div class="error">${escapeHTML(e.message)}</div>`;
    btn.textContent = '重试';
  } finally {
    btn.disabled = false;
  }
});