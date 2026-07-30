/**
 * AlertMind — UI Utility Functions
 * DOM helpers, notification toasts, clipboard, and UI state management.
 */

// ─── Toast Notifications ────────────────────────────────────────────────────
const UI = {
  /**
   * Shows a temporary toast notification.
   * @param {string} message
   * @param {'success'|'error'|'info'|'warning'} type
   * @param {number} duration
   */
  toast(message, type = 'info', duration = 4000) {
    const colors = {
      success: 'bg-green-900/90 border-green-500/40 text-green-100',
      error: 'bg-red-900/90 border-red-500/40 text-red-100',
      warning: 'bg-yellow-900/90 border-yellow-500/40 text-yellow-100',
      info: 'bg-blue-900/90 border-blue-500/40 text-blue-100',
    };

    const icons = {
      success: '✓',
      error: '✗',
      warning: '⚠',
      info: 'ℹ',
    };

    const container = document.getElementById('toast-container') || this._createToastContainer();

    const toast = document.createElement('div');
    toast.className = `flex items-center gap-3 px-4 py-3 rounded-lg border text-sm font-medium shadow-lg transition-all duration-300 ${colors[type]}`;
    toast.innerHTML = `<span class="text-base">${icons[type]}</span><span>${this._escapeHtml(message)}</span>`;

    container.appendChild(toast);

    // Animate in
    requestAnimationFrame(() => {
      toast.style.transform = 'translateX(0)';
      toast.style.opacity = '1';
    });

    // Remove after duration
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  },

  _createToastContainer() {
    const container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'fixed top-20 right-4 z-50 flex flex-col gap-2 w-80';
    document.body.appendChild(container);
    return container;
  },

  /**
   * Copies text to the clipboard and shows a toast.
   * @param {string} text
   * @param {string} label
   */
  async copyToClipboard(text, label = 'Value') {
    try {
      await navigator.clipboard.writeText(text);
      this.toast(`${label} copied to clipboard`, 'success', 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      this.toast(`${label} copied to clipboard`, 'success', 2000);
    }
  },

  /**
   * Formats a severity level with color class.
   * @param {'CRITICAL'|'HIGH'|'MEDIUM'|'LOW'|'INFORMATIONAL'} severity
   * @returns {{ text: string, class: string }}
   */
  formatSeverity(severity) {
    const map = {
      CRITICAL: { text: 'Critical', class: 'text-red-400 bg-red-950/40 border-red-700/40' },
      HIGH: { text: 'High', class: 'text-orange-400 bg-orange-950/40 border-orange-700/40' },
      MEDIUM: { text: 'Medium', class: 'text-yellow-400 bg-yellow-950/40 border-yellow-700/40' },
      LOW: { text: 'Low', class: 'text-green-400 bg-green-950/40 border-green-700/40' },
      INFORMATIONAL: { text: 'Info', class: 'text-blue-400 bg-blue-950/40 border-blue-700/40' },
    };
    return map[severity] || { text: severity || 'Unknown', class: 'text-gray-400' };
  },

  /**
   * Formats confidence as percentage string.
   * @param {number} confidence
   * @returns {string}
   */
  formatConfidence(confidence) {
    return `${Math.round((confidence || 0) * 100)}%`;
  },

  /**
   * Formats processing duration.
   * @param {number} ms
   * @returns {string}
   */
  formatDuration(ms) {
    if (!ms) return 'N/A';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  },

  /**
   * Formats ISO date string to local readable form.
   * @param {string} isoString
   * @returns {string}
   */
  formatDate(isoString) {
    if (!isoString) return 'N/A';
    try {
      return new Intl.DateTimeFormat(navigator.language, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(isoString));
    } catch {
      return isoString;
    }
  },

  /**
   * Truncates a string with ellipsis.
   * @param {string} str
   * @param {number} maxLength
   * @returns {string}
   */
  truncate(str, maxLength = 100) {
    if (!str) return '';
    if (str.length <= maxLength) return str;
    return str.slice(0, maxLength - 3) + '...';
  },

  /**
   * Escapes HTML to prevent XSS when inserting into innerHTML.
   * @param {string} str
   * @returns {string}
   */
  _escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  /**
   * Downloads a string as a file.
   * @param {string} content
   * @param {string} filename
   * @param {string} mimeType
   */
  downloadAsFile(content, filename, mimeType = 'text/plain') {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  },

  /**
   * Scrolls an element into view smoothly.
   * @param {string} elementId
   */
  scrollTo(elementId) {
    const el = document.getElementById(elementId);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  },
};

// Make globally available
window.UI = UI;
