// ESP32 Firmware Manager for Dynamic Manifest Generation
class ESP32FirmwareManager {
  constructor() {
    this.versions = [];
    this.selectedVersion = null;
    this.installButton = null;
    this.versionSelector = null;
  }

  async init() {
    try {
      await this.loadVersions();
      this.createVersionSelector();
      this.setupEventListeners();
      this.selectDefaultVersion();
    } catch (error) {
      console.error('Failed to initialize ESP32 firmware manager:', error);
    }
  }

  async loadVersions() {
    try {
      const response = await fetch('/data/firmware-versions.json');
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
    const buttonContainer = document.querySelector('.hero-card__actions');
    if (!buttonContainer) return;

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
    const installButton = buttonContainer.querySelector('esp-web-install-button');
    buttonContainer.insertBefore(selectorContainer, installButton);

    this.versionSelector = select;
    this.installButton = installButton;
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

    try {
      // Load the manifest for this version
      const manifestResponse = await fetch(`/firmware/${version.folder}/manifest.json`);
      const manifest = await manifestResponse.json();

      // Update paths to be absolute
      manifest.builds.forEach(build => {
        build.parts.forEach(part => {
          part.path = `/firmware/${version.folder}/${part.path}`;
        });
      });

      // Create dynamic manifest using Blob URL
      const manifestJson = JSON.stringify(manifest);
      const blob = new Blob([manifestJson], { type: 'application/json' });
      const manifestUrl = URL.createObjectURL(blob);

      // Update the install button
      if (this.installButton) {
        this.installButton.setAttribute('manifest', manifestUrl);
      }

      // Update the UI with version info
      this.updateVersionInfo(version);

    } catch (error) {
      console.error('Failed to load manifest for version:', versionString, error);
      this.fallbackToStatic();
    }
  }

  updateVersionInfo(version) {
    // Update the release card with selected version info
    const releaseCard = document.querySelector('.release-card');
    if (!releaseCard) return;

    // Update badge
    const badge = releaseCard.querySelector('.badge');
    if (badge) {
      badge.textContent = version.is_latest ? `Latest • ${version.version}` : version.version;
      badge.className = `badge ${version.is_latest ? 'bg-primary-subtle text-primary' : 'bg-secondary-subtle text-secondary'} fw-semibold`;
    }

    // Update description
    const description = releaseCard.querySelector('.text-muted.small');
    if (description && version.description) {
      description.textContent = version.description;
    }

    // Update changelog
    const changelogList = releaseCard.querySelector('.release-card__list');
    if (changelogList && version.changelog) {
      changelogList.innerHTML = '';
      version.changelog.forEach(item => {
        const li = document.createElement('li');
        li.className = 'd-flex align-items-start gap-3';
        li.innerHTML = `
          <i class="fas fa-check text-primary"></i>
          <span>${item}</span>
        `;
        changelogList.appendChild(li);
      });
    }

    // Update GitHub release link
    const releaseLink = releaseCard.querySelector('.release-card__link');
    if (releaseLink) {
      releaseLink.href = `https://github.com/openppg/eppg-controller/releases/tag/v${version.version}`;
    }

    // Update release date
    const meta = releaseCard.querySelector('.release-card__meta');
    if (meta) {
      const dateSpan = meta.querySelector('.text-muted');
      if (dateSpan) {
        const date = new Date(version.release_date);
        dateSpan.textContent = `Released ${date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })}`;
      }
    }
  }

  fallbackToStatic() {
    // Fallback to the original static manifest
    if (this.installButton) {
      this.installButton.setAttribute('manifest', '/firmware/esp32-manifest.json');
    }
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const firmwareManager = new ESP32FirmwareManager();
  firmwareManager.init();
});
