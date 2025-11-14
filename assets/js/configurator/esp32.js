// ESP32 Firmware Manager for Dynamic Manifest Generation
class ESP32FirmwareManager {
  constructor() {
    this.versions = [];
    this.selectedVersion = null;
    this.installButton = null;
    this.versionSelector = null;
    this.actionsContainer = null;
    this.releaseElements = {};
    this.currentManifestUrl = null;
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
    // Find the install button container
    if (!this.actionsContainer || !this.installButton) return;

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

    // Insert before the install button
    this.actionsContainer.insertBefore(selectorContainer, this.installButton);

    this.versionSelector = select;
  }

  setupEventListeners() {
    if (this.versionSelector) {
      this.versionSelector.addEventListener('change', (e) => {
        this.selectVersion(e.target.value);
      });
    }
  }

  selectDefaultVersion() {
    // Select the latest version by default
    const latestVersion = this.versions.find(v => v.is_latest);
    if (latestVersion) {
      this.selectVersion(latestVersion.version);
      if (this.versionSelector) {
        this.versionSelector.value = latestVersion.version;
      }
    }
  }

  async selectVersion(versionString) {
    const version = this.versions.find(v => v.version === versionString);
    if (!version) return;

    this.selectedVersion = version;
    this.setInstallButtonDisabled(true);

    try {
      // Load the manifest for this version
      const manifestResponse = await fetch(new URL(`firmware/${version.folder}/manifest.json`, window.location.origin).href);
      const manifest = await manifestResponse.json();

      // Update paths to be absolute
      manifest.builds.forEach(build => {
        build.parts.forEach(part => {
          part.path = new URL(`firmware/${version.folder}/${part.path}`, window.location.origin).href;
        });
      });

      // Create dynamic manifest using Blob URL
      const manifestJson = JSON.stringify(manifest);
      const blob = new Blob([manifestJson], { type: 'application/json' });
      const manifestUrl = URL.createObjectURL(blob);

      // Update the install button
      if (this.installButton) {
        if (this.currentManifestUrl) {
          URL.revokeObjectURL(this.currentManifestUrl);
        }
        this.currentManifestUrl = manifestUrl;
        this.installButton.setAttribute('manifest', manifestUrl);
      }

      // Update the UI with version info
      this.updateVersionInfo(version);

    } catch (error) {
      console.error('Failed to load manifest for version:', versionString, error);
      this.fallbackToStatic();
    } finally {
      this.setInstallButtonDisabled(false);
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
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const firmwareManager = new ESP32FirmwareManager();
  firmwareManager.init();
});
