/**
 * HITO Memo - Main Application
 * Inbox投げ込み専用メモアプリ
 */
(function () {
  'use strict';

  let github = null;
  let pendingImages = []; // { file, dataUrl, base64 }

  const $ = (sel) => document.querySelector(sel);
  const dom = {
    setupScreen: $('#setup-screen'),
    app: $('#app'),
    setupForm: $('#setup-form'),
    memoInput: $('#memo-input'),
    btnSend: $('#btn-send'),
    charCount: $('#char-count'),
    btnImage: $('#btn-image'),
    imageInput: $('#image-input'),
    imagePreviewArea: $('#image-preview-area'),
    imagePreviewList: $('#image-preview-list'),
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
    const hasImages = pendingImages.length > 0;
    dom.btnSend.disabled = !hasText && !hasImages;
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

  function buildMarkdown(body, captured, imageLinks) {
    let md = `---\ncaptured: ${captured}\nsource: iPhone\n---\n\n`;
    if (body) md += `${body}\n`;
    if (imageLinks.length > 0) {
      md += '\n';
      for (const img of imageLinks) {
        md += `![${img.name}](${img.path})\n`;
      }
    }
    return md;
  }

  // ---- Image Handling ----

  function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result;
        const base64 = dataUrl.split(',')[1];
        resolve({ file, dataUrl, base64 });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function renderImagePreviews() {
    if (pendingImages.length === 0) {
      dom.imagePreviewArea.style.display = 'none';
      dom.imagePreviewList.innerHTML = '';
      return;
    }
    dom.imagePreviewArea.style.display = 'block';
    dom.imagePreviewList.innerHTML = pendingImages.map((img, i) =>
      `<div class="image-preview-item">
        <img src="${img.dataUrl}" alt="">
        <button class="image-remove-btn" data-index="${i}">✕</button>
      </div>`
    ).join('');
  }

  async function sendMemo() {
    const body = dom.memoInput.value.trim();
    if (!body && pendingImages.length === 0) return;

    const now = new Date();
    const { dateTime, captured } = formatDateTime(now);

    showLoading();
    try {
      // Upload images first
      const imageLinks = [];
      for (let i = 0; i < pendingImages.length; i++) {
        const img = pendingImages[i];
        const ext = img.file.name.split('.').pop().toLowerCase() || 'jpg';
        const imgName = `${dateTime}_${i + 1}.${ext}`;
        const imgPath = `images/${imgName}`;
        showLoading(`画像を送信中 (${i + 1}/${pendingImages.length})...`);
        await github.createFileRaw(imgPath, img.base64, `image: ${imgName}`);
        imageLinks.push({ name: imgName, path: imgPath });
      }

      // Create memo file
      const fileName = `${dateTime}_メモ.md`;
      const content = buildMarkdown(body, captured, imageLinks);
      showLoading('メモを送信中...');
      await github.createFile(fileName, content);

      // Reset
      dom.memoInput.value = '';
      pendingImages = [];
      renderImagePreviews();
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

    // Image
    dom.btnImage.addEventListener('click', () => dom.imageInput.click());
    dom.imageInput.addEventListener('change', async (e) => {
      const files = [...e.target.files];
      if (!files.length) return;
      for (const file of files) {
        if (file.size > 10 * 1024 * 1024) {
          showToast('10MBを超える画像は添付できません', 'error');
          continue;
        }
        const img = await readFileAsBase64(file);
        pendingImages.push(img);
      }
      renderImagePreviews();
      updateSendButton();
      dom.imageInput.value = '';
    });
    dom.imagePreviewList.addEventListener('click', (e) => {
      const btn = e.target.closest('.image-remove-btn');
      if (!btn) return;
      const idx = parseInt(btn.dataset.index, 10);
      pendingImages.splice(idx, 1);
      renderImagePreviews();
      updateSendButton();
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
