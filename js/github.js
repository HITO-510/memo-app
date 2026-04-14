/**
 * GitHub API Client for HITO Memo
 * Simplified version: only creates new files in the Inbox.
 */
class GitHubClient {
  constructor(token, repo, basePath) {
    this.token = token;
    this.repo = repo;
    this.basePath = basePath.replace(/^\/|\/$/g, '');
    this.apiBase = 'https://api.github.com';
  }

  get headers() {
    return {
      'Authorization': `Bearer ${this.token}`,
      'Accept': 'application/vnd.github.v3+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };
  }

  async testConnection() {
    const res = await fetch(`${this.apiBase}/repos/${this.repo}`, {
      headers: this.headers,
    });
    if (!res.ok) {
      if (res.status === 401) throw new Error('トークンが無効です');
      if (res.status === 404) throw new Error('リポジトリが見つかりません');
      throw new Error(`接続エラー: ${res.status}`);
    }
    return await res.json();
  }

  /**
   * Create a new file in the Inbox.
   */
  async createFile(fileName, content, commitMessage) {
    const filePath = `${this.basePath}/${fileName}`;
    const body = {
      message: commitMessage || `memo: ${fileName}`,
      content: this.encodeContent(content),
    };

    const res = await fetch(
      `${this.apiBase}/repos/${this.repo}/contents/${encodeURIComponent(filePath)}`,
      {
        method: 'PUT',
        headers: { ...this.headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      if (res.status === 422) {
        throw new Error('同名のファイルが既に存在します。少し待ってから再送してください。');
      }
      throw new Error(`保存エラー: ${res.status} ${err.message || ''}`);
    }

    return await res.json();
  }

  /**
   * Create a file from raw base64 content (for images).
   */
  async createFileRaw(fileName, base64Content, commitMessage) {
    const filePath = `${this.basePath}/${fileName}`;
    const body = {
      message: commitMessage || `image: ${fileName}`,
      content: base64Content,
    };

    const res = await fetch(
      `${this.apiBase}/repos/${this.repo}/contents/${encodeURIComponent(filePath)}`,
      {
        method: 'PUT',
        headers: { ...this.headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`画像保存エラー: ${res.status} ${err.message || ''}`);
    }

    return await res.json();
  }

  encodeContent(text) {
    const bytes = new TextEncoder().encode(text);
    let binary = '';
    for (const b of bytes) binary += String.fromCharCode(b);
    return btoa(binary);
  }
}
