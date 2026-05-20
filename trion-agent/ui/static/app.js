/* Trion Agent dashboard — Alpine.js component definitions */

function dashboard() {
  return {
    running: false,
    confirmReset: false,
    hasBaseline: true,
    toast: '',
    toastType: 'info',
    _toastTimer: null,
    showLogs: false,
    logLines: [],
    chartEmpty: true,
    _es: null,
    _chart: null,

    init() {
      this._refreshStatus();
      this._loadChart();
      setInterval(() => this._refreshStatus(), 30000);
    },

    async _loadChart() {
      try {
        const res = await fetch('/api/history/chart');
        if (!res.ok) return;
        const rows = await res.json();
        if (!rows.length) { this.chartEmpty = true; return; }
        this.chartEmpty = false;
        const labels = rows.map(r => r.date);
        const colorMap = { BENIGN: '#22c55e', SUSPECT: '#f59e0b', CRITICAL: '#ef4444' };
        const verdicts = ['BENIGN', 'SUSPECT', 'CRITICAL'];
        const datasets = verdicts.map(v => ({
          label: v,
          data: rows.map(r => r.verdict === v ? 1 : 0),
          backgroundColor: colorMap[v],
          borderWidth: 0,
          borderRadius: 3,
        }));
        const ctx = document.getElementById('verdictChart');
        if (!ctx) return;
        if (this._chart) this._chart.destroy();
        this._chart = new Chart(ctx, {
          type: 'bar',
          data: { labels, datasets },
          options: {
            plugins: { legend: { labels: { color: '#64748b', font: { family: 'JetBrains Mono, monospace', size: 11 } } } },
            scales: {
              x: { stacked: true, ticks: { color: '#64748b', font: { size: 10 } }, grid: { color: '#2d3447' } },
              y: { stacked: true, ticks: { color: '#64748b', stepSize: 1, font: { size: 10 } }, grid: { color: '#2d3447' }, max: 1 },
            },
            responsive: true,
            maintainAspectRatio: true,
          },
        });
      } catch (_) {}
    },

    closeStream() {
      if (this._es) { this._es.close(); this._es = null; }
    },

    async _refreshStatus() {
      try {
        const res = await fetch('/api/status');
        if (!res.ok) return;
        const data = await res.json();
        this.hasBaseline = data.baseline_exists;
      } catch (_) {}
    },

    async runNow() {
      if (this.running) return;
      this.running = true;
      this.showLogs = true;
      this.logLines = [];
      this.closeStream();
      this._es = new EventSource('/api/logs/stream');
      this._es.onmessage = (e) => {
        this.logLines.push(e.data);
        if (this.logLines.length > 200) this.logLines.shift();
        const el = document.getElementById('log-stream');
        if (el) el.scrollTop = el.scrollHeight;
      };
      this._showToast('Agent run started…', 'info');
      const prevTs = await this._lastRunTimestamp();
      try {
        const res = await fetch('/api/run', { method: 'POST' });
        if (!res.ok) throw new Error('request failed');
        let waited = 0;
        const poll = setInterval(async () => {
          waited += 3;
          const ts = await this._lastRunTimestamp();
          if (ts !== prevTs || waited >= 300) {
            clearInterval(poll);
            this.running = false;
            this._showToast('Run complete — refresh to see updated status.', 'success');
            await this._refreshStatus();
            await this._loadChart();
          }
        }, 3000);
      } catch (e) {
        this.running = false;
        this._showToast('Failed to start agent run.', 'error');
      }
    },

    async _lastRunTimestamp() {
      try {
        const res = await fetch('/api/status');
        if (!res.ok) return null;
        const data = await res.json();
        return data.last_run?.timestamp ?? null;
      } catch (_) { return null; }
    },

    async resetBaseline() {
      this.confirmReset = false;
      try {
        const res = await fetch('/api/reset-baseline', { method: 'POST' });
        const data = await res.json();
        if (data.status === 'reset') {
          this.hasBaseline = false;
          this._showToast('Baseline reset. Next run will build a fresh snapshot.', 'success');
        } else {
          this._showToast('No baseline file found.', 'info');
        }
      } catch (_) {
        this._showToast('Failed to reset baseline.', 'error');
      }
    },

    _showToast(msg, type = 'info') {
      this.toast = msg;
      this.toastType = type;
      clearTimeout(this._toastTimer);
      this._toastTimer = setTimeout(() => { this.toast = ''; }, 5000);
    },
  };
}

function moduleToggle(name, initialEnabled) {
  return {
    enabled: initialEnabled,

    async toggle() {
      try {
        const res = await fetch(`/api/modules/${name}/toggle`, { method: 'POST' });
        if (!res.ok) throw new Error();
        const data = await res.json();
        this.enabled = data.enabled;
      } catch (_) {
        alert('Failed to toggle module. Check agent logs.');
      }
    },
  };
}
