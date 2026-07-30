/**
 * AlertMind — Frontend API Client
 * All HTTP calls to the AlertMind backend API.
 * Handles auth headers, error parsing, and response normalization.
 */

const AlertMindAPI = (() => {
  let _token = null;
  const BASE = '/api/v1';

  function setToken(token) {
    _token = token;
  }

  async function request(method, path, options = {}) {
    const { body, isFormData, isBlob, params } = options;

    const url = new URL(BASE + path, window.location.origin);
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null) url.searchParams.set(k, v);
      });
    }

    const headers = {};
    if (_token) headers['Authorization'] = `Bearer ${_token}`;
    if (!isFormData && body) headers['Content-Type'] = 'application/json';

    const response = await fetch(url.toString(), {
      method,
      headers,
      body: isFormData ? body : body ? JSON.stringify(body) : undefined,
    });

    if (isBlob) {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.blob();
    }

    const data = await response.json();

    if (!response.ok) {
      const error = new Error(data.error || `HTTP ${response.status}`);
      error.code = data.code;
      error.fieldErrors = data.fieldErrors;
      error.status = response.status;
      throw error;
    }

    return data.data !== undefined ? data.data : data;
  }

  return {
    setToken,

    // ─── Auth ───────────────────────────────────────────────────────────
    register: (body) => request('POST', '/auth/register', { body }),
    login: (body) => request('POST', '/auth/login', { body }),
    logout: () => request('POST', '/auth/logout'),
    getMe: () => request('GET', '/auth/me'),

    // ─── Alerts ─────────────────────────────────────────────────────────
    submitAlert: (body) => request('POST', '/alerts', { body }),
    uploadAlert: (file, fields) => {
      const form = new FormData();
      form.append('alert', file);
      Object.entries(fields).forEach(([k, v]) => { if (v) form.append(k, v); });
      return request('POST', '/alerts/upload', { body: form, isFormData: true });
    },
    getAlert: (id, params) => request('GET', `/alerts/${id}`, { params }),
    listAlerts: (params) => request('GET', '/alerts', { params }),
    archiveAlert: (id) => request('DELETE', `/alerts/${id}`),

    // ─── Investigations ─────────────────────────────────────────────────
    getInvestigation: (id, workspaceId) => request('GET', `/investigations/${id}`, { params: { workspaceId } }),
    getInvestigationStatus: (id) => request('GET', `/investigations/${id}/status`),
    listInvestigations: (params) => request('GET', '/investigations', { params }),
    retryInvestigation: (id) => request('POST', `/investigations/${id}/retry`),

    // ─── Reports ────────────────────────────────────────────────────────
    getReport: (investigationId, workspaceId) => request('GET', `/reports/${investigationId}`, { params: { workspaceId } }),
    generatePdf: (investigationId, body) => request('POST', `/reports/${investigationId}/pdf`, { body }),

    downloadMarkdown: async (investigationId) => {
      const response = await fetch(`${BASE}/reports/${investigationId}/markdown`, {
        headers: _token ? { Authorization: `Bearer ${_token}` } : {},
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `incident-report-${investigationId}.md`;
      a.click();
      URL.revokeObjectURL(url);
    },
  };
})();
