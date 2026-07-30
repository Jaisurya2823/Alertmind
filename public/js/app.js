/**
 * AlertMind — Frontend Application (Alpine.js)
 * All UI state, API calls, and DOM interactions
 */

function alertMind() {
  return {
    // ─── Auth state ──────────────────────────────────────────────────────
    user: null,
    showLogin: false,
    showRegister: false,

    // ─── Alert input ─────────────────────────────────────────────────────
    inputMode: 'paste',
    alertInput: '',
    uploadedFile: null,
    uploadedFileName: '',

    // ─── Processing ──────────────────────────────────────────────────────
    isProcessing: false,
    processingStage: 'Submitting alert...',
    errorMessage: '',

    // ─── Results ─────────────────────────────────────────────────────────
    analysisResult: null,
    reportExpanded: false,

    // ─── Current investigation IDs (for polling) ─────────────────────────
    currentAlertId: null,
    currentInvestigationId: null,
    pollInterval: null,

    // ─── Init ────────────────────────────────────────────────────────────
    init() {
      // Load auth from localStorage
      const token = localStorage.getItem('am_access_token');
      const storedUser = localStorage.getItem('am_user');
      if (token && storedUser) {
        try {
          this.user = JSON.parse(storedUser);
          AlertMindAPI.setToken(token);
        } catch {
          localStorage.removeItem('am_access_token');
          localStorage.removeItem('am_user');
        }
      }

      // Init Dropzone
      this.$nextTick(() => this.initDropzone());

      // Render icons
      if (typeof lucide !== 'undefined') lucide.createIcons();
    },

    initDropzone() {
      if (typeof Dropzone === 'undefined') return;
      Dropzone.autoDiscover = false;

      const dz = document.getElementById('dropzone');
      if (!dz || dz._dropzone) return;

      const dropzone = new Dropzone(dz, {
        url: '/api/v1/alerts/upload',
        autoProcessQueue: false,
        maxFiles: 1,
        maxFilesize: 10,
        acceptedFiles: '.json,.txt,.log,.xml,.csv',
        previewsContainer: false,
        clickable: true,
      });

      dropzone.on('addedfile', (file) => {
        this.uploadedFile = file;
        this.uploadedFileName = file.name;
      });

      dropzone.on('removedfile', () => {
        this.uploadedFile = null;
        this.uploadedFileName = '';
      });
    },

    // ─── Main analysis flow ───────────────────────────────────────────────
    async analyzeAlert() {
      this.errorMessage = '';
      this.isProcessing = true;
      this.processingStage = 'Submitting alert for analysis...';

      try {
        let result;

        if (this.inputMode === 'paste') {
          if (!this.alertInput.trim()) {
            throw new Error('Please paste an alert before analyzing');
          }
          result = await AlertMindAPI.submitAlert({
            rawInput: this.alertInput,
            workspaceId: this.getDefaultWorkspaceId(),
          });
        } else {
          if (!this.uploadedFile) {
            throw new Error('Please upload a file before analyzing');
          }
          result = await AlertMindAPI.uploadAlert(this.uploadedFile, {
            workspaceId: this.getDefaultWorkspaceId(),
          });
        }

        this.currentAlertId = result.alertId;
        this.currentInvestigationId = result.investigationId;

        // Start polling for results
        this.processingStage = 'AI is analyzing the alert...';
        await this.pollForResults(result.investigationId);

      } catch (err) {
        this.errorMessage = err.message || 'Analysis failed. Please try again.';
        this.isProcessing = false;
      }
    },

    async pollForResults(investigationId) {
      const POLL_INTERVAL = 3000; // 3 seconds
      const MAX_POLLS = 40; // 2 minutes max
      let polls = 0;

      const stages = [
        'Parsing alert format and structure...',
        'Extracting entities and IOCs...',
        'Classifying threat category...',
        'Mapping to MITRE ATT&CK...',
        'Generating investigation hypotheses...',
        'Building investigation plan...',
        'Assessing business risk...',
        'Generating incident report...',
        'Running QA validation...',
      ];

      return new Promise((resolve, reject) => {
        this.pollInterval = setInterval(async () => {
          polls++;

          // Update processing stage message
          const stageIdx = Math.min(Math.floor(polls / 2), stages.length - 1);
          this.processingStage = stages[stageIdx];

          if (polls > MAX_POLLS) {
            clearInterval(this.pollInterval);
            reject(new Error('Analysis timed out. Please try again.'));
            return;
          }

          try {
            const status = await AlertMindAPI.getInvestigationStatus(investigationId);

            if (status.status === 'COMPLETED') {
              clearInterval(this.pollInterval);
              this.processingStage = 'Fetching results...';

              const workspaceId = this.getDefaultWorkspaceId();
              const full = await AlertMindAPI.getInvestigation(investigationId, workspaceId);
              this.displayResults(full);
              resolve(full);

            } else if (status.status === 'FAILED') {
              clearInterval(this.pollInterval);
              reject(new Error(status.errorMessage || 'Investigation failed'));
            }
          } catch (err) {
            // Network errors during polling — keep retrying
            console.warn('Poll error:', err.message);
          }
        }, POLL_INTERVAL);
      });
    },

    displayResults(investigation) {
      this.analysisResult = investigation;
      this.isProcessing = false;

      // Render markdown report
      this.$nextTick(() => {
        const reportEl = document.getElementById('report-content');
        if (reportEl && investigation.report?.markdownContent) {
          reportEl.innerHTML = marked.parse(investigation.report.markdownContent);
          if (typeof Prism !== 'undefined') Prism.highlightAll();
        }
      });
    },

    resetAnalysis() {
      if (this.pollInterval) clearInterval(this.pollInterval);
      this.analysisResult = null;
      this.alertInput = '';
      this.uploadedFile = null;
      this.uploadedFileName = '';
      this.isProcessing = false;
      this.errorMessage = '';
      this.currentAlertId = null;
      this.currentInvestigationId = null;
      this.reportExpanded = false;
    },

    // ─── Export ───────────────────────────────────────────────────────────
    async downloadMarkdown() {
      if (!this.currentInvestigationId) return;
      try {
        await AlertMindAPI.downloadMarkdown(this.currentInvestigationId);
      } catch (err) {
        this.errorMessage = 'Failed to download Markdown: ' + err.message;
      }
    },

    async generatePdf() {
      if (!this.currentInvestigationId) return;
      try {
        this.isProcessing = true;
        this.processingStage = 'Generating PDF...';
        const result = await AlertMindAPI.generatePdf(
          this.currentInvestigationId,
          { workspaceId: this.getDefaultWorkspaceId() }
        );
        window.open(result.downloadUrl, '_blank');
      } catch (err) {
        this.errorMessage = 'PDF generation failed: ' + err.message;
      } finally {
        this.isProcessing = false;
      }
    },

    // ─── Auth ─────────────────────────────────────────────────────────────
    async logout() {
      try {
        await AlertMindAPI.logout();
      } catch {}
      localStorage.removeItem('am_access_token');
      localStorage.removeItem('am_user');
      this.user = null;
      AlertMindAPI.setToken(null);
    },

    // ─── Helpers ──────────────────────────────────────────────────────────
    getDefaultWorkspaceId() {
      // Get from user's workspace list or from stored preference
      const workspaces = this.user?.workspaceUsers;
      if (workspaces?.length) {
        const defaultWs = workspaces.find((w) => w.workspace?.isDefault);
        return defaultWs?.workspace?.id || workspaces[0].workspace?.id;
      }
      return localStorage.getItem('am_workspace_id') || '';
    },
  };
}
