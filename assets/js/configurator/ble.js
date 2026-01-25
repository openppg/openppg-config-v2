
// BLE UUIDs
const CONFIG_SERVICE_UUID = '1779a55b-deb8-4482-a5d1-a12e62146138';
const DEVICE_INFO_SERVICE_UUID = '0000180a-0000-1000-8000-00805f9b34fb';

const CHAR_UUIDS = {
  // Config
  DEVICE_STATE: '8f80bcf5-b58f-4908-b079-e8ad6f5ee257',
  METRIC_ALT: 'df63f19e-7295-4a44-a0dc-184d1afeddf7',
  PERFORMANCE_MODE: 'd76c2e92-3547-4f5f-afb4-515c5c08b06b',
  SCREEN_ROTATION: '9cbab736-3705-4ecf-8086-fb7c5fb86282',
  THEME: 'ad0e4309-1eb2-461a-b36c-697b2e1604d2',
  FW_VERSION: '00002a26-0000-1000-8000-00805f9b34fb',
  HW_REVISION: '00002a27-0000-1000-8000-00805f9b34fb',
  ARMED_TIME: '58b29259-43ef-4593-b700-250ec839a2b2',
};

let device;
let server;
let configService;

// UI Elements
// Elements are queried in functions/events to ensure DOM is ready
let connectionStatus;
let deviceInfoDiv;
let settingsFieldset;
let settingsOverlay;

document.addEventListener('DOMContentLoaded', () => {
  connectionStatus = document.getElementById('connection-status');
  deviceInfoDiv = document.getElementById('device-info');
  settingsFieldset = document.getElementById('settings-fieldset');
  settingsOverlay = document.getElementById('settings-overlay');
});

async function connect() {
  try {
    device = await navigator.bluetooth.requestDevice({
      filters: [{ name: 'OpenPPG Controller' }],
      optionalServices: [CONFIG_SERVICE_UUID, DEVICE_INFO_SERVICE_UUID],
    });

    device.addEventListener('gattserverdisconnected', onDisconnected);

    updateStatus('Connecting...');
    server = await device.gatt.connect();

    updateStatus('Getting Services...');
    configService = await server.getPrimaryService(CONFIG_SERVICE_UUID);
    // Device Info might be optional or standard
    try {
      await server.getPrimaryService(DEVICE_INFO_SERVICE_UUID);
    } catch (e) {
      console.warn('Device Info Service not found', e);
    }

    updateUIConnected();
    await readAllData();

  } catch (error) {
    console.error('Connection failed', error);
    updateStatus('Connection failed: ' + error.message);
  }
}

function onDisconnected() {
  updateUIDisconnected();
  updateStatus('Disconnected');
}

async function disconnect() {
  if (device && device.gatt.connected) {
    device.gatt.disconnect();
  }
}

function updateStatus(msg) {
  if (connectionStatus) connectionStatus.innerHTML = `<i class="fas fa-info-circle me-1"></i> ${msg}`;
}

function updateUIConnected() {
  document.getElementById('connect-ble').classList.add('d-none');
  document.getElementById('disconnect-ble').classList.remove('d-none');
  deviceInfoDiv.classList.remove('d-none');
  settingsFieldset.disabled = false;
  if (settingsOverlay) settingsOverlay.classList.add('d-none');
  updateStatus('Device must be DISARMED to change settings.');
}

function updateUIDisconnected() {
  document.getElementById('connect-ble').classList.remove('d-none');
  document.getElementById('disconnect-ble').classList.add('d-none');
  deviceInfoDiv.classList.add('d-none');
  settingsFieldset.disabled = true;
  if (settingsOverlay) {
    settingsOverlay.classList.remove('d-none');
  }
}

async function readAllData() {
  try {
    // Device Info - Actually in Config Service per docs
    if (configService) {
      try {
        // FW Version
        const fwChar = await configService.getCharacteristic(CHAR_UUIDS.FW_VERSION);
        const fwVal = await fwChar.readValue();
        const major = fwVal.getUint8(0);
        const minor = fwVal.getUint8(1);
        document.getElementById('info-fw-version').textContent = `v${major}.${minor}`;

        // Armed Time
        const armedChar = await configService.getCharacteristic(CHAR_UUIDS.ARMED_TIME);
        const armedVal = await armedChar.readValue();
        const minutes = armedVal.getUint16(0, true); // Little endian
        const hrs = Math.floor(minutes / 60);
        const mins = minutes % 60;
        const paddedMins = String(mins).padStart(2, '0');
        document.getElementById('info-armed-time').textContent = `${hrs}h ${paddedMins}m`;
      } catch (e) {
        console.warn('Failed to read device info from config service', e);
      }
    }

    // Settings
    // Screen Rotation
    const rotChar = await configService.getCharacteristic(CHAR_UUIDS.SCREEN_ROTATION);
    const rotVal = await rotChar.readValue();
    const rot = rotVal.getUint8(0);
    // 1 = RH, 3 = LH
    if (rot === 1) document.getElementById('rot-rh').checked = true;
    if (rot === 3) document.getElementById('rot-lh').checked = true;

    // Theme (may be unavailable on older firmware)
    try {
      const themeChar = await configService.getCharacteristic(CHAR_UUIDS.THEME);
      const themeVal = await themeChar.readValue();
      const theme = themeVal.getUint8(0);
      if (theme === 1) document.getElementById('theme-dark').checked = true;
      if (theme === 0) document.getElementById('theme-light').checked = true;
      setThemeEnabled(true);
    } catch (e) {
      console.warn('Theme characteristic not available', e);
      setThemeEnabled(false);
    }

    // Metric Alt
    const altChar = await configService.getCharacteristic(CHAR_UUIDS.METRIC_ALT);
    const altVal = await altChar.readValue();
    const isMetric = altVal.getUint8(0) === 1;
    const unitsMetric = document.getElementById('units-metric');
    const unitsImperial = document.getElementById('units-imperial');
    if (unitsMetric) unitsMetric.checked = isMetric;
    if (unitsImperial) unitsImperial.checked = !isMetric;

    // Performance Mode
    const perfChar = await configService.getCharacteristic(CHAR_UUIDS.PERFORMANCE_MODE);
    const perfVal = await perfChar.readValue();
    const perf = perfVal.getUint8(0);
    if (perf === 0) document.getElementById('perf-chill').checked = true;
    if (perf === 1) document.getElementById('perf-sport').checked = true;

    // Note: Metric Temp, Sea Pressure are not in the docs UUID table.
    // document.getElementById('metric-temp').disabled = true; // Removed from HTML

  } catch (e) {
    console.error('Error reading data', e);
  }
}

function setThemeEnabled(enabled) {
  document.querySelectorAll('input[name="theme"]').forEach(el => {
    el.disabled = !enabled;
  });
}

// Write Handlers
async function writeSetting(uuid, val, type) {
  if (!configService) return;
  try {
    const char = await configService.getCharacteristic(uuid);
    const buffer = new ArrayBuffer(type === 'u8' ? 1 : 4);
    const view = new DataView(buffer);
    if (type === 'u8') view.setUint8(0, val);
    // Add other types if needed
    await char.writeValue(buffer);
    console.log('Wrote setting', uuid, val);
  } catch (e) {
    console.error('Write failed', e);
    alert('Failed to save setting');
  }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
  const connectBtn = document.getElementById('connect-ble');
  const disconnectBtn = document.getElementById('disconnect-ble');

  if (connectBtn) connectBtn.addEventListener('click', connect);
  if (disconnectBtn) disconnectBtn.addEventListener('click', disconnect);

  // Settings Change Listeners
  document.querySelectorAll('input[name="screen_rot"]').forEach(el => {
    el.addEventListener('change', (e) => {
      writeSetting(CHAR_UUIDS.SCREEN_ROTATION, parseInt(e.target.value), 'u8');
    });
  });

  document.querySelectorAll('input[name="theme"]').forEach(el => {
    el.addEventListener('change', (e) => {
      writeSetting(CHAR_UUIDS.THEME, parseInt(e.target.value), 'u8');
    });
  });

  document.querySelectorAll('input[name="units"]').forEach(el => {
    el.addEventListener('change', (e) => {
      writeSetting(CHAR_UUIDS.METRIC_ALT, parseInt(e.target.value), 'u8');
    });
  });

  document.querySelectorAll('input[name="performance_mode"]').forEach(el => {
    el.addEventListener('change', (e) => {
      writeSetting(CHAR_UUIDS.PERFORMANCE_MODE, parseInt(e.target.value), 'u8');
    });
  });
});
