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

      // Update the UI to show which version is selected in advanced
      this.updateVersionInfo(version);

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
});
