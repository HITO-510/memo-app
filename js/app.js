/**
 * HITO Memo - Main Application
 * Inbox投げ込み専用メモアプリ
 */
(function () {
  'use strict';

  let github = null;

  const $ = (sel) => document.querySelector(sel);
  const dom = {
    setupScreen: $('#setup-screen'),
    app: $('#app'),
    setupForm: $('#setup-form'),
    memoInput: $('#memo-input'),
    btnSend: $('#btn-send'),
    charCount: $('#char-count'),
    loading: $('#loading'),
    loadingText: $('#loading-text'),
    toast: $('#toast'),
    settingsModal: $('#settings-modal'),
  };

  // ---- Init ----

  function init() {
    const config = loadConfig();
    if (config) {
      github = new GitHubClient(config.token, config.repo, config.path);
      showApp();
    } else {
      showSetup();
    }
    bindEvents();
  }

  // ---- Config ----

  function loadConfig() {
    const raw = localStorage.getItem('hito-memo-config');
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  }

  function saveConfig(config) {
    localStorage.setItem('hito-memo-config', JSON.stringify(config));
  }

  // ---- UI ----

  function showSetup() {
    dom.setupScreen.style.display = 'flex';
    dom.app.style.display = 'none';
  }

  function showApp() {
    dom.setupScreen.style.display = 'none';
    dom.app.style.display = 'flex';
    dom.memoInput.focus();
  }

  function showLoading(text = '送信中...') {
    dom.loadingText.textContent = text;
    dom.loading.style.display = 'flex';
  }

  function hideLoading() {
    dom.loading.style.display = 'none';
  }

  function showToast(msg, type = '') {
    dom.toast.textContent = msg;
    dom.toast.className = 'toast' + (type ? ` ${type}` : '');
    dom.toast.style.display = 'block';
    clearTimeout(dom.toast._timer);
    dom.toast._timer = setTimeout(() => {
      dom.toast.style.display = 'none';
    }, 3000);
  }

  function updateSendButton() {
    const hasText = dom.memoInput.value.trim().length > 0;
    dom.btnSend.disabled = !hasText;
  }

  function updateCharCount() {
    const len = dom.memoInput.value.length;
    dom.charCount.textContent = `${len}文字`;
  }

  // ---- Send Memo ----

  function formatDateTime(date) {
    const y = date.getFullYear();
    const mo = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const h = String(date.getHours()).padStart(2, '0');
    const mi = String(date.getMinutes()).padStart(2, '0');
    return { dateTime: `${y}-${mo}-${d}_${h}${mi}`, captured: `${y}-${mo}-${d} ${h}:${mi}` };
  }

  function buildMarkdown(body, captured) {
    return `---\ncaptured: ${captured}\nsource: iPhone\n---\n\n${body}\n`;
  }

  async function sendMemo() {
    const body = dom.memoInput.value.trim();
    if (!body) return;

    const now = new Date();
    const { dateTime, captured } = formatDateTime(now);
    const fileName = `${dateTime}_メモ.md`;
    const content = buildMarkdown(body, captured);

    showLoading();
    try {
      await github.createFile(fileName, content);
      dom.memoInput.value = '';
      updateSendButton();
      updateCharCount();
      hideLoading();
      showToast('Inboxに投げました', 'success');
      dom.memoInput.focus();
    } catch (err) {
      hideLoading();
      showToast(`エラー: ${err.message}`, 'error');
    }
  }

  // ---- Settings ----

  function openSettings() {
    const config = loadConfig() || {};
    $('#settings-token').value = config.token || '';
    $('#settings-repo').value = config.repo || '';
    $('#settings-path').value = config.path || '01_INBOX';
    dom.settingsModal.style.display = 'flex';
  }

  function closeSettings() {
    dom.settingsModal.style.display = 'none';
  }

  // ---- Events ----

  function bindEvents() {
    // Setup
    dom.setupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const token = $('#setup-token').value.trim();
      const repo = $('#setup-repo').value.trim();
      const path = $('#setup-path').value.trim() || 'memos';

      showLoading('接続を確認中...');
      try {
        const client = new GitHubClient(token, repo, path);
        await client.testConnection();
        saveConfig({ token, repo, path });
        github = client;
        hideLoading();
        showApp();
      } catch (err) {
        hideLoading();
        showToast(err.message, 'error');
      }
    });

    // Memo input
    dom.memoInput.addEventListener('input', () => {
      updateSendButton();
      updateCharCount();
    });

    // Send
    dom.btnSend.addEventListener('click', sendMemo);

    // Ctrl+Enter / Cmd+Enter to send
    dom.memoInput.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (!dom.btnSend.disabled) sendMemo();
      }
    });

    // Settings
    $('#btn-settings').addEventListener('click', openSettings);
    $('#btn-settings-back').addEventListener('click', closeSettings);
    $('#settings-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const token = $('#settings-token').value.trim();
      const repo = $('#settings-repo').value.trim();
      const path = $('#settings-path').value.trim() || 'memos';

      showLoading('接続を確認中...');
      try {
        const client = new GitHubClient(token, repo, path);
        await client.testConnection();
        saveConfig({ token, repo, path });
        github = client;
        closeSettings();
        hideLoading();
        showToast('設定を保存しました', 'success');
      } catch (err) {
        hideLoading();
        showToast(err.message, 'error');
      }
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
