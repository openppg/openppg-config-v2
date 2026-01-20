// ESP32 Firmware Manager for Dynamic Manifest Generation
class ESP32FirmwareManager {
  constructor() {
    this.versions = [];
    this.selectedVersion = null;
    this.installButton = null;
    this.advancedInstallButton = null;
    this.versionSelector = null;
    this.actionsContainer = null;
    this.releaseElements = {};
    this.currentManifestUrl = null;
    this.advancedManifestUrl = null;
  }

  async init() {
    try {
      this.cacheDomElements();
      await this.loadVersions();
      this.createVersionSelector();
      this.setupEventListeners();
      this.selectDefaultVersion();
    } catch (error) {
      console.error('Failed to initialize ESP32 firmware manager:', error);
    }
  }

  cacheDomElements() {
    this.actionsContainer = document.getElementById('firmware-actions');
    if (this.actionsContainer) {
      this.installButton = this.actionsContainer.querySelector('esp-web-install-button');
    }

    // Cache the advanced installer button
    this.advancedInstallButton = document.getElementById('advanced-install-button');

    this.releaseElements = {
      badge: document.getElementById('release-badge'),
      description: document.getElementById('release-description'),
      changelog: document.getElementById('release-changelog'),
      link: document.getElementById('release-link'),
      date: document.getElementById('release-date'),
    };
  }

  async loadVersions() {
    try {
      const response = await fetch(new URL('data/firmware-versions.json', window.location.origin).href);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      this.versions = data.versions;
    } catch (error) {
      console.error('Failed to load firmware versions:', error);
      // Fallback to static manifest if data loading fails
      this.fallbackToStatic();
    }
  }

  createVersionSelector() {
    // Find the advanced section container
    const advancedContainer = document.getElementById('advanced-version-selector');
    if (!advancedContainer) {
      console.warn('Advanced version selector container not found');
      return;
    }

    // Create version selector
    const selectorContainer = document.createElement('div');
    selectorContainer.className = 'version-selector mb-3';

    const label = document.createElement('label');
    label.className = 'form-label fw-semibold';
    label.textContent = 'Select Firmware Version:';
    label.setAttribute('for', 'firmware-version-select');

    const select = document.createElement('select');
    select.className = 'form-select';
    select.id = 'firmware-version-select';

    // Add options
    this.versions.forEach(version => {
      const option = document.createElement('option');
      option.value = version.version;
      option.textContent = `${version.version}${version.is_latest ? ' (Latest)' : ''}`;
      select.appendChild(option);
    });

    selectorContainer.appendChild(label);
    selectorContainer.appendChild(select);

    // Insert into advanced section instead of main actions
    advancedContainer.appendChild(selectorContainer);

    this.versionSelector = select;
  }

  setupEventListeners() {
    if (this.versionSelector) {
      this.versionSelector.addEventListener('change', (e) => {
        // Only update the advanced installer button when version changes
        this.selectVersionForAdvanced(e.target.value);
      });
    }
  }

  selectDefaultVersion() {
    // Select the latest version by default
    const latestVersion = this.versions.find(v => v.is_latest);
    if (latestVersion) {
      // Set main button to always use latest
      this.setMainButtonToLatest(latestVersion);
      // Set advanced button to latest initially
      this.selectVersionForAdvanced(latestVersion.version);
      if (this.versionSelector) {
        this.versionSelector.value = latestVersion.version;
      }
    }
  }

  async setMainButtonToLatest(version) {
    // Main button always installs the latest version
    this.setInstallButtonDisabled(true);

    try {
      const manifestResponse = await fetch(new URL(`firmware/${version.folder}/manifest.json`, window.location.origin).href);
      const manifest = await manifestResponse.json();

      manifest.builds.forEach(build => {
        build.parts.forEach(part => {
          part.path = new URL(`firmware/${version.folder}/${part.path}`, window.location.origin).href;
        });
      });

      const manifestJson = JSON.stringify(manifest);
      const blob = new Blob([manifestJson], { type: 'application/json' });
      const manifestUrl = URL.createObjectURL(blob);

      if (this.installButton) {
        if (this.currentManifestUrl) {
          URL.revokeObjectURL(this.currentManifestUrl);
        }
        this.currentManifestUrl = manifestUrl;
        this.installButton.setAttribute('manifest', manifestUrl);
      }

      // Update the UI with latest version info
      this.updateVersionInfo(version);

    } catch (error) {
      console.error('Failed to load manifest for latest version:', error);
      this.fallbackToStatic();
    } finally {
      this.setInstallButtonDisabled(false);
    }
  }

  async selectVersionForAdvanced(versionString) {
    // Advanced button installs the selected version
    const version = this.versions.find(v => v.version === versionString);
    if (!version) return;

    this.selectedVersion = version;
    this.setAdvancedInstallButtonDisabled(true);

    try {
      const manifestResponse = await fetch(new URL(`firmware/${version.folder}/manifest.json`, window.location.origin).href);
      const manifest = await manifestResponse.json();

      manifest.builds.forEach(build => {
        build.parts.forEach(part => {
          part.path = new URL(`firmware/${version.folder}/${part.path}`, window.location.origin).href;
        });
      });

      const manifestJson = JSON.stringify(manifest);
      const blob = new Blob([manifestJson], { type: 'application/json' });
      const manifestUrl = URL.createObjectURL(blob);

      if (this.advancedInstallButton) {
        if (this.advancedManifestUrl) {
          URL.revokeObjectURL(this.advancedManifestUrl);
        }
        this.advancedManifestUrl = manifestUrl;
        this.advancedInstallButton.setAttribute('manifest', manifestUrl);
      }

    } catch (error) {
      console.error('Failed to load manifest for version:', versionString, error);
    } finally {
      this.setAdvancedInstallButtonDisabled(false);
    }
  }

  updateVersionInfo(version) {
    // Update the release card with selected version info
    const { badge, description, changelog, link, date } = this.releaseElements;

    if (badge) {
      badge.textContent = version.is_latest ? `Latest • ${version.version}` : version.version;
      badge.className = `badge ${version.is_latest ? 'bg-primary-subtle text-primary' : 'bg-secondary-subtle text-secondary'} fw-semibold`;
    }

    if (description && version.description) {
      description.textContent = version.description;
    }

    if (changelog && Array.isArray(version.changelog)) {
      changelog.innerHTML = '';
      version.changelog.forEach(item => {
        const li = document.createElement('li');
        li.className = 'd-flex align-items-start gap-3';
        li.innerHTML = `
          <i class="fas fa-check text-primary"></i>
          <span>${item}</span>
        `;
        changelog.appendChild(li);
      });
    }

    if (link) {
      link.href = `https://github.com/openppg/eppg-controller/releases/tag/v${version.version}`;
    }

    if (date && version.release_date) {
      const parsedDate = new Date(version.release_date);
      date.textContent = `Released ${parsedDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })}`;
    }

    // Update the latest version in the comparison
    if (version.is_latest) {
      const latestFwEl = document.getElementById('latest-fw-version');
      if (latestFwEl) {
        latestFwEl.textContent = `v${version.version}`;
      }
    }
  }

  fallbackToStatic() {
    // Fallback to the original static manifest
    if (this.installButton) {
      this.installButton.setAttribute('manifest', new URL('firmware/esp32-manifest.json', window.location.origin).href);
    }
    if (this.currentManifestUrl) {
      URL.revokeObjectURL(this.currentManifestUrl);
      this.currentManifestUrl = null;
    }
  }

  setInstallButtonDisabled(disabled) {
    if (!this.installButton) return;
    const activateButton = this.installButton.querySelector('[slot="activate"]');
    if (activateButton) {
      activateButton.disabled = disabled;
    }
  }

  setAdvancedInstallButtonDisabled(disabled) {
    if (!this.advancedInstallButton) return;
    const activateButton = this.advancedInstallButton.querySelector('[slot="activate"]');
    if (activateButton) {
      activateButton.disabled = disabled;
    }
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const firmwareManager = new ESP32FirmwareManager();
  firmwareManager.init();

  const settingsManager = new ESP32SettingsManager();
  settingsManager.init();
});

class ESP32SettingsManager {
  constructor() {
    this.port = null;
    this.reader = null;
    this.encoder = new TextEncoder();
    this.decoder = new TextDecoder();
    this.keepReading = false;
    this.buffer = '';
    this.isConnecting = false;
    this.isSyncing = false;
    this.syncTimeout = null;

    this.elements = {};
    this.statusMessages = {
      connected: 'Device must be DISARMED to change settings.',
      connecting: 'Opening connection...',
      disconnected: 'Disconnected.',
    };

    // Connection state enum
    this.ConnectionState = {
      UNSUPPORTED: 'unsupported',
      DISCONNECTED: 'disconnected',
      CONNECTING: 'connecting',
      CONNECTED: 'connected',
      ERROR: 'error',
    };
    this.connectionState = this.ConnectionState.DISCONNECTED;

    /**
     * Settings configuration - DRY principle for device<->UI mapping
     * 
     * Each entry defines:
     * - settingKey: The key used when sending updates to device
     * - group: The radio button group name in HTML
     * - deviceField: The field name in device data (abbreviated)
     * - toDevice: Optional transform when sending to device
     * - fromDevice: Optional transform when receiving from device
     * - requiresReboot: Whether changing this setting needs a reboot
     * 
     * To add a new setting: add an entry here and create the HTML button group
     */
    this.settingsConfig = {
      screen_rot: {
        group: 'screen_rot',
        deviceField: 'scr_rt',
        requiresReboot: true,
      },
      theme: {
        group: 'theme',
        deviceField: 'thm',
        requiresReboot: true,
      },
      metric_alt: {
        group: 'units',
        deviceField: 'm_alt',
        toDevice: (value) => value === 1, // convert radio value (0/1) to boolean
        fromDevice: (value) => value ? 1 : 0, // convert bool to radio value
      },
      performance_mode: {
        group: 'performance_mode',
        deviceField: 'prf',
      },
    };
  }

  init() {
    this.cacheElements();

    // Check for Web Serial support
    if (!('serial' in navigator)) {
      this.setConnectionState(this.ConnectionState.UNSUPPORTED);
      return;
    }

    this.setupListeners();
    this.setupSerialEvents();
    window.addEventListener('beforeunload', () => this.forceClosePort());
    this.setConnectionState(this.ConnectionState.DISCONNECTED);
  }

  setupSerialEvents() {
    // Listen for device connect/disconnect events (when device is plugged/unplugged)
    navigator.serial.addEventListener('connect', (e) => {
      console.log('Serial device connected:', e);
      this.updateStatusMessage('Device detected. Click Connect to begin.', 'info');
    });

    navigator.serial.addEventListener('disconnect', (e) => {
      console.log('Serial device disconnected:', e);
      // If this was our active port, handle disconnection
      if (this.port && e.target === this.port) {
        this.handleUnexpectedDisconnect();
      }
    });
  }

  handleUnexpectedDisconnect() {
    this.keepReading = false;
    this.port = null;
    this.reader = null;
    this.stopSyncLoading();
    this.setConnectionState(this.ConnectionState.DISCONNECTED);
    this.updateStatusMessage('Device was disconnected.', 'warning');
  }

  cacheElements() {
    this.elements = {
      connectBtn: document.getElementById('connect-settings'),
      syncBtn: document.getElementById('sync-settings'),
      status: document.getElementById('connection-status'),
      statusIcon: document.getElementById('connection-status-icon'),
      form: document.getElementById('settings-form'),
      fieldset: document.getElementById('settings-form')?.querySelector('fieldset'),
      saveStatus: document.getElementById('save-status'),
      rebootBtn: document.getElementById('btn-reboot'),

      // Info fields
      infoPanel: document.getElementById('device-info'),
      infoFw: document.getElementById('info-fw-version'),
      infoArch: document.getElementById('info-arch'),
      infoArmedTime: document.getElementById('info-armed-time'),
      versionWarning: document.getElementById('version-warning'),
      versionWarningValue: document.getElementById('version-warning-value'),

      // Settings inputs - organized by type
      settings: {
        screen_rot: document.getElementsByName('screen_rot'),
        theme: document.getElementsByName('theme'),
        units: document.getElementsByName('units'),
        performance_mode: document.getElementsByName('performance_mode'),
      },
      seaPressure: document.getElementById('sea-pressure'),
    };
  }

  setConnectionState(state) {
    this.connectionState = state;
    const { connectBtn, fieldset, syncBtn, infoPanel } = this.elements;
    const settingsOverlay = document.getElementById('settings-overlay');

    switch (state) {
      case this.ConnectionState.UNSUPPORTED:
        if (connectBtn) {
          connectBtn.disabled = true;
          connectBtn.innerHTML = '<i class="fas fa-exclamation-triangle me-2"></i>Not Supported';
          connectBtn.classList.remove('btn-primary', 'btn-outline-danger');
          connectBtn.classList.add('btn-secondary');
        }
        this.updateStatusMessage('Web Serial is not supported in this browser. Please use Chrome or Edge on desktop.', 'error');
        this.hideVersionWarning();
        // Show overlay when unsupported
        if (settingsOverlay) settingsOverlay.classList.remove('d-none');
        break;

      case this.ConnectionState.DISCONNECTED:
        this.stopSyncLoading();
        if (connectBtn) {
          connectBtn.disabled = false;
          connectBtn.innerHTML = '<i class="fas fa-plug me-2"></i>Connect';
          connectBtn.classList.remove('btn-outline-danger', 'btn-secondary');
          connectBtn.classList.add('btn-primary');
        }
        if (fieldset) fieldset.disabled = true;
        if (syncBtn) syncBtn.disabled = true;
        if (infoPanel) infoPanel.classList.add('d-none');
        this.hideVersionWarning();
        // Show overlay when disconnected
        if (settingsOverlay) settingsOverlay.classList.remove('d-none');
        break;

      case this.ConnectionState.CONNECTING:
        if (connectBtn) {
          connectBtn.disabled = true;
          connectBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Connecting...';
        }
        this.updateStatusMessage(this.statusMessages.connecting, 'info');
        // Keep overlay visible while connecting
        if (settingsOverlay) settingsOverlay.classList.remove('d-none');
        break;

      case this.ConnectionState.CONNECTED:
        if (connectBtn) {
          connectBtn.disabled = false;
          connectBtn.innerHTML = '<i class="fas fa-unlink me-2"></i>Disconnect';
          connectBtn.classList.remove('btn-primary', 'btn-secondary');
          connectBtn.classList.add('btn-outline-danger');
        }
        if (fieldset) fieldset.disabled = false;
        if (syncBtn) syncBtn.disabled = false;
        this.updateStatusMessage(this.statusMessages.connected, 'plain');
        // Hide overlay when connected
        if (settingsOverlay) settingsOverlay.classList.add('d-none');
        break;

      case this.ConnectionState.ERROR:
        this.stopSyncLoading();
        if (connectBtn) {
          connectBtn.disabled = false;
          connectBtn.innerHTML = '<i class="fas fa-plug me-2"></i>Retry';
          connectBtn.classList.remove('btn-outline-danger', 'btn-secondary');
          connectBtn.classList.add('btn-primary');
        }
        if (fieldset) fieldset.disabled = true;
        if (syncBtn) syncBtn.disabled = true;
        // Show overlay on error
        if (settingsOverlay) settingsOverlay.classList.remove('d-none');
        break;
    }
  }

  updateStatusMessage(message, type = 'info') {
    const { status, statusIcon } = this.elements;
    if (!status) return;

    // Icon and color mapping - using custom class for warning to ensure contrast
    const config = {
      info: { icon: 'fa-info-circle', colorClass: 'text-muted' },
      success: { icon: 'fa-check-circle', colorClass: 'text-success' },
      warning: { icon: 'fa-exclamation-triangle', colorClass: 'status-warning' },
      error: { icon: 'fa-times-circle', colorClass: 'text-danger' },
      plain: { icon: null, colorClass: 'text-muted' },
    };

    const { icon, colorClass } = config[type] || config.info;

    // Update icon if element exists
    if (statusIcon) {
      statusIcon.className = icon ? `fas ${icon} me-2` : '';
    }

    // Update status text and color
    status.className = `mt-3 small ${colorClass}`;
    status.innerHTML = icon ? `<i class="fas ${icon} me-2"></i>${message}` : message;
  }

  setupListeners() {
    if (!this.elements.connectBtn) return;

    this.elements.connectBtn.addEventListener('click', () => {
      if (this.port) {
        this.disconnect();
      } else {
        this.connect();
      }
    });

    this.elements.syncBtn?.addEventListener('click', () => this.requestSync());
    this.elements.rebootBtn?.addEventListener('click', () => this.sendJson({ command: 'reboot' }));

    // Wire up alert reboot button to trigger actual reboot
    const alertRebootBtn = document.getElementById('alert-reboot-btn');
    if (alertRebootBtn) {
      alertRebootBtn.addEventListener('click', () => {
        if (this.elements.rebootBtn) {
          this.elements.rebootBtn.click();
        }
      });
    }

    // Setup radio button group listeners from configuration
    Object.entries(this.settingsConfig).forEach(([settingKey, config]) => {
      const radios = this.elements.settings[config.group];
      if (!radios) return;

      Array.from(radios).forEach(radio => {
        radio.addEventListener('change', (e) => {
          if (e.target.checked) {
            let value = parseInt(e.target.value);
            // Apply transformation if defined
            if (config.toDevice) {
              value = config.toDevice(value);
            }
            this.updateSetting(settingKey, value);
          }
        });
      });
    });

    // Sea pressure with validation
    this.elements.seaPressure?.addEventListener('change', (e) => {
      let val = parseFloat(e.target.value);
      if (!isNaN(val)) {
        val = Math.max(300, Math.min(1200, val));
        this.updateSetting('sea_pressure', val);
      }
    });
  }

  /**
   * Set radio button value for a group
   * @param {string} groupName - Name attribute of radio group
   * @param {*} value - Value to set (will be converted to string for comparison)
   */
  setRadioValue(groupName, value) {
    if (value === undefined) return;
    
    const radios = this.elements.settings[groupName];
    if (!radios) return;

    Array.from(radios).forEach(radio => {
      radio.checked = radio.value === String(value);
    });
  }

  async connect() {
    if (this.isConnecting) return;
    this.isConnecting = true;

    try {
      this.setConnectionState(this.ConnectionState.CONNECTING);

      // Request port from user
      this.port = await navigator.serial.requestPort({
        // Filter for Espressif devices (ESP32-S3)
        filters: [
          { usbVendorId: 0x303A }, // Espressif
        ],
      }).catch(() => {
        // If filtered request fails or is cancelled, try without filters
        return navigator.serial.requestPort();
      });

      if (!this.port) {
        throw new Error('No port selected');
      }

      // Open the port
      await this.port.open({ baudRate: 115200 });

      // NOTE: DTR/RTS toggling can reset ESP32-class devices. We avoid RTS,
      // but pulse DTR to enable RX on some ESP32-S3 native USB CDC stacks.
      await this.port.setSignals({ dataTerminalReady: false, requestToSend: false });
      await new Promise(resolve => setTimeout(resolve, 50));
      await this.port.setSignals({ dataTerminalReady: true, requestToSend: false });

      this.keepReading = true;
      this.readLoop();

      this.setConnectionState(this.ConnectionState.CONNECTED);

      // Wait a bit more for the device to be ready after the signal toggle
      await new Promise(resolve => setTimeout(resolve, 500));

      // Send a newline to clear any input buffer on the device side
      if (this.port && this.port.writable) {
        const writer = this.port.writable.getWriter();
        try {
          await writer.write(this.encoder.encode('\n'));
        } catch (e) {
          console.error('Error clearing buffer:', e);
        } finally {
          writer.releaseLock();
        }
      }

      await this.requestSync();

    } catch (error) {
      console.error('Connection failed:', error);
      this.port = null;
      this.setConnectionState(this.ConnectionState.ERROR);

      // Provide user-friendly error messages
      if (error.name === 'NotFoundError' || error.message.includes('No port selected')) {
        this.updateStatusMessage('No device selected. Please try again and select your SP140 controller.', 'warning');
      } else if (error.name === 'SecurityError') {
        this.updateStatusMessage('Permission denied. Please allow access to the serial port.', 'error');
      } else if (error.name === 'NetworkError' || error.message.includes('already open')) {
        this.updateStatusMessage('Port is already in use. Close other applications using this device.', 'error');
      } else if (error.name === 'InvalidStateError') {
        this.updateStatusMessage('Port is already open. Try disconnecting first.', 'warning');
      } else {
        this.updateStatusMessage(`Connection failed: ${error.message}`, 'error');
      }
    } finally {
      this.isConnecting = false;
    }
  }

  async disconnect() {
    this.keepReading = false;
    this.stopSyncLoading();

    if (this.reader) {
      try {
        await this.reader.cancel();
      } catch (e) {
        console.log('Reader cancel error:', e);
      }
      this.reader = null;
    }

    if (this.port) {
      try {
        await this.port.close();
      } catch (e) {
        console.log('Port close error:', e);
      }
      this.port = null;
    }

    this.setConnectionState(this.ConnectionState.DISCONNECTED);
    this.updateStatusMessage(this.statusMessages.disconnected, 'info');
  }

  forceClosePort() {
    // Best-effort close for page unload to prevent ports getting stuck open
    try {
      this.keepReading = false;
      if (this.reader) {
        this.reader.cancel().catch(() => { });
        this.reader.releaseLock?.();
      }
      if (this.port) {
        this.port.close().catch(() => { });
      }
    } catch (e) {
      // ignore
    }
  }

  async readLoop() {
    while (this.port && this.port.readable && this.keepReading) {
      try {
        this.reader = this.port.readable.getReader();
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { value, done } = await this.reader.read();
          if (done) break;
          if (value) {
            const text = this.decoder.decode(value);
            this.buffer += text;
            this.processBuffer();
          }
        }
      } catch (error) {
        // Don't log cancellation errors (expected during disconnect)
        if (error.name !== 'TypeError' && !error.message?.includes('cancel')) {
          console.error('Read error:', error);
          // If we get a fatal read error while connected, handle it
          if (this.connectionState === this.ConnectionState.CONNECTED) {
            this.updateStatusMessage('Communication error. Try reconnecting.', 'warning');
          }
        }
      } finally {
        if (this.reader) {
          try {
            this.reader.releaseLock();
          } catch (e) {
            // Ignore release errors
          }
          this.reader = null;
        }
      }
    }
  }

  processBuffer() {
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop(); // Keep incomplete line

    for (const line of lines) {
      if (line.trim()) {
        this.handleMessage(line.trim());
      }
    }
  }

  startSyncLoading() {
    if (this.isSyncing) return;
    if (!this.elements.syncBtn) return;

    this.isSyncing = true;
    this.elements.syncBtn.disabled = true;
    this.elements.syncBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Loading...';

    if (this.syncTimeout) clearTimeout(this.syncTimeout);
    this.syncTimeout = setTimeout(() => {
      this.stopSyncLoading();
    }, 4000);
  }

  stopSyncLoading() {
    if (!this.isSyncing && !this.syncTimeout) return;

    this.isSyncing = false;
    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout);
      this.syncTimeout = null;
    }

    if (this.elements.syncBtn) {
      const shouldEnable = this.connectionState === this.ConnectionState.CONNECTED;
      this.elements.syncBtn.disabled = !shouldEnable;
      this.elements.syncBtn.innerHTML = '<i class="fas fa-sync me-2"></i>Refresh';
    }
  }

  async requestSync() {
    if (this.connectionState !== this.ConnectionState.CONNECTED) return;
    this.startSyncLoading();
    await this.sendJson({ command: 'sync' });
  }

  handleMessage(jsonStr) {
    try {
      const data = JSON.parse(jsonStr);
      console.log('Received:', data);
      this.updateUI(data);
    } catch (e) {
      // Ignore non-JSON lines (debug msgs etc)
      // console.log('Ignored serial output:', jsonStr);
    }
  }

  async sendJson(data) {
    if (!this.port || !this.port.writable) return;

    const writer = this.port.writable.getWriter();
    try {
      const jsonStr = JSON.stringify(data) + '\n';
      await writer.write(this.encoder.encode(jsonStr));
      console.log('Sent:', data);
    } catch (e) {
      console.error('Send error:', e);
    } finally {
      writer.releaseLock();
    }
  }

  updateSetting(key, value) {
    const cmd = { settings: { [key]: value } };
    this.sendJson(cmd);
    this.showSaved();

    // Show reboot alert if this setting requires reboot
    const config = this.settingsConfig[key];
    if (config?.requiresReboot) {
      this.showRebootAlert();
    }
  }

  showRebootAlert() {
    const alert = document.getElementById('reboot-alert');
    if (alert) {
      alert.classList.remove('d-none');
    }
  }

  showSaved() {
    if (this.elements.saveStatus) {
      // Remove any existing timer
      if (this.saveStatusTimer) {
        clearTimeout(this.saveStatusTimer);
      }
      
      // Show the badge
      this.elements.saveStatus.classList.add('show');
      
      // Hide after 2 seconds
      this.saveStatusTimer = setTimeout(() => {
        this.elements.saveStatus.classList.remove('show');
      }, 2000);
    }
  }

  isSupportedVersion(data) {
    if (data.mj_v === undefined || data.mi_v === undefined) return true;

    const major = Number(data.mj_v);
    const minor = Number(data.mi_v);
    if (Number.isNaN(major) || Number.isNaN(minor)) return true;

    if (major > 7) return true;
    if (major < 7) return false;
    return minor >= 3;
  }

  showUnsupportedVersion(major, minor) {
    if (this.elements.fieldset) this.elements.fieldset.disabled = true;

    const versionLabel = (major !== undefined && minor !== undefined)
      ? `v${major}.${minor}`
      : 'this firmware';

    if (this.elements.versionWarning) {
      this.elements.versionWarning.classList.remove('d-none');
    }
    if (this.elements.versionWarningValue) {
      this.elements.versionWarningValue.textContent = versionLabel;
    }
  }

  clearVersionWarning() {
    if (this.elements.versionWarning) this.elements.versionWarning.classList.add('d-none');
    if (this.elements.versionWarningValue) this.elements.versionWarningValue.textContent = '-';
    if (this.connectionState === this.ConnectionState.CONNECTED && this.elements.fieldset) {
      this.elements.fieldset.disabled = false;
    }
    if (this.connectionState === this.ConnectionState.CONNECTED) {
      this.updateStatusMessage(this.statusMessages.connected, 'plain');
    }
  }

  hideVersionWarning() {
    if (this.elements.versionWarning) this.elements.versionWarning.classList.add('d-none');
    if (this.elements.versionWarningValue) this.elements.versionWarningValue.textContent = '-';
  }

  updateUI(data) {
    this.stopSyncLoading();
    // Fields: mj_v, mi_v, arch, scr_rt, ar_tme, m_tmp, m_alt, prf, sea_p, thm

    // Info
    if (data.mj_v !== undefined && data.mi_v !== undefined) {
      if (this.elements.infoFw) this.elements.infoFw.textContent = `v${data.mj_v}.${data.mi_v}`;
      if (this.elements.infoPanel) this.elements.infoPanel.classList.remove('d-none');

      // Update version comparison
      const currentVersion = `${data.mj_v}.${data.mi_v}`;
      const comparisonEl = document.getElementById('version-comparison');
      const currentFwEl = document.getElementById('current-fw-version');

      if (comparisonEl && currentFwEl) {
        currentFwEl.textContent = `v${currentVersion}`;
        comparisonEl.classList.remove('d-none');
      }

      if (this.isSupportedVersion(data)) {
        this.clearVersionWarning();
      } else {
        this.showUnsupportedVersion(data.mj_v, data.mi_v);
      }
    }
    if (data.arch && this.elements.infoArch) this.elements.infoArch.textContent = data.arch;
    if (data.ar_tme !== undefined && this.elements.infoArmedTime) {
      const hrs = Math.floor(data.ar_tme / 60);
      const mins = data.ar_tme % 60;
      this.elements.infoArmedTime.textContent = `${hrs}h ${mins}m`;
    }

    // Settings - automatically apply all configured settings
    Object.entries(this.settingsConfig).forEach(([, config]) => {
      const deviceValue = data[config.deviceField];
      if (deviceValue !== undefined) {
        const uiValue = config.fromDevice ? config.fromDevice(deviceValue) : deviceValue;
        this.setRadioValue(config.group, uiValue);
      }
    });

    if (data.sea_p !== undefined && this.elements.seaPressure) {
      this.elements.seaPressure.value = data.sea_p;
    }
  }
}
