/* eslint-disable no-undef */

(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', () => {
    let connectButton = document.querySelector('#connect');
    let syncButton = document.querySelector('#sync');
    let statusDisplay = document.querySelector('#status');
    let port;

    $('#frm-config :input').prop('disabled', true);

    // check if WebUSB is supported
    if ('usb' in navigator) {
      console.log('has WebUSB support');
    } else {
      alert('WebUSB not supported: Please use Chrome on desktop or Android');
      $('#connect').prop('disabled', true);
      $('#connect').html('Not Supported');
      return;
    }

    document.getElementById('btn-pressure').addEventListener('click', function () {
      updateLocalPressure();
    });

    // listen for form input changes and save them to the device
    $('#frm-config input').on('change', function () {
      var orientation = $('input[name=orientation]:checked', '#frm-config').val();
      var baro_calibration = $('input#seaPressureInput').val();
      var min_batt_v = $('input#minBattInput').val();
      var max_batt_v = $('input#maxBattInput').val();
      var metric_alt = $('#units-alt').prop('checked');
      var performance_mode = $('#performance-sport').prop('checked') ? 1 : 0;
      var theme = $('#theme-dark').prop('checked') ? 1 : 0;

      var usb_json = {
        'screen_rot': orientation,
        'sea_pressure': parseFloat(baro_calibration),
        'metric_alt': metric_alt,
        'min_batt_v': min_batt_v,
        'max_batt_v': max_batt_v,
        'performance_mode': performance_mode,
        'theme': theme,
      }
      console.log('sending', usb_json);
      sendJSON(usb_json);
      $('#saved-status').removeClass('blink');
      $('#saved-status').width(); // trigger a DOM reflow
      $('#saved-status').addClass('blink');
    });

    document.querySelector('button#bl').addEventListener('click', function(){
      let bl_command_json = { 'command': 'rbl' };
      console.log('sending', bl_command_json);
      sendJSON(bl_command_json);
      disconnect();
    });

    // called when button is clicked
    function connect() {
      port.connect().then(() => {
        didConnect();

        port.onReceive = data => {
          let textDecoder = new TextDecoder();
          var usb_input = textDecoder.decode(data);
          if (usb_input.length < 5) { return }

          // Split the input on newlines and process each valid JSON object
          usb_input.split('\n').forEach(jsonStr => {
            try {
              if (jsonStr.trim().length > 0) {
                var usb_parsed = JSON.parse(jsonStr);

                // Update the form with the received data
                updateFormFromSync(usb_parsed);

                // Request the next chunk of data if available
                requestNextChunk();

                Rollbar.info('Synced-SP140', usb_parsed);
              }
            } catch (e) {
              console.warn('Failed to parse JSON:', e, jsonStr);
            }
          });
        };

        port.onReceiveError = error => {
          Rollbar.warn(error);
          console.error(error);
        };
      }, error => {
        Rollbar.warn(error);
        displayError(error);
      });
    }

    // Update the page from received data
    function updateFormFromSync(usb_parsed){
      console.log('raw', usb_parsed);
      if (usesNewMapping(usb_parsed)) {
        usb_parsed = migrateUsbData(usb_parsed);
        console.log('parsed', usb_parsed);
      } else if (usb_parsed.major_v !== undefined && !usb_parsed.arch) {
        // Only set SAMD21 as default during initial sync AND when no arch is specified
        usb_parsed.arch = 'SAMD21';
      }
      usb_parsed = sanitizeUsbData(usb_parsed);
      console.log('sanitized', usb_parsed);

      // Version and architecture info (from initial sync)
      if (usb_parsed.major_v !== undefined) $('#versionMajor').text(usb_parsed.major_v);
      if (usb_parsed.minor_v !== undefined) $('#versionMinor').text(usb_parsed.minor_v);
      if (usb_parsed.device_id !== undefined) $('#deviceId').text(usb_parsed.device_id);
      if (usb_parsed.id !== undefined) $('#deviceId').text(usb_parsed.id);
      if (usb_parsed.arch !== undefined) $('#deviceArch').text(usb_parsed.arch);

      // Units settings
      if (usb_parsed.metric_alt !== undefined) $('#units-alt').prop('checked', usb_parsed.metric_alt);
      if (usb_parsed.sea_pressure !== undefined) $('#seaPressureInput').val(usb_parsed.sea_pressure);
      if (usb_parsed.armed_time !== undefined) $('#armedTime').text(displayTime(usb_parsed.armed_time));

      // Display settings
      if (usb_parsed.screen_rot !== undefined) {
        $('#orientation-lh').prop('checked', usb_parsed.screen_rot == 3);
        $('#orientation-rh').prop('checked', usb_parsed.screen_rot == 1);
      }
      if (usb_parsed.theme !== undefined) {
        $('#theme-light').prop('checked', usb_parsed.theme == 0);
        $('#theme-dark').prop('checked', usb_parsed.theme == 1);
      }

      // Performance settings
      if (usb_parsed.performance_mode !== undefined) {
        $('#performance-chill').prop('checked', usb_parsed.performance_mode == 0);
        $('#performance-sport').prop('checked', usb_parsed.performance_mode == 1);
      }
    }

    // migrate new data to old mappings
    function migrateUsbData(usb_parsed){
      const key_map = {
        'mj_v': 'major_v',
        'mi_v': 'minor_v',
        'arch': 'arch',
        'scr_rt': 'screen_rot',
        'ar_tme': 'armed_time',
        'm_tmp': 'metric_temp',
        'm_alt': 'metric_alt',
        'prf': 'performance_mode',
        'sea_p': 'sea_pressure',
        'id': 'device_id',
        'thm': 'theme',
        'rev': 'revision',
      };
      const migratedUsbData = {};
      for (const [key, value] of Object.entries(usb_parsed)) {
        const newKey = key_map[key] ?? key;
        migratedUsbData[newKey] = value;
      }
      return migratedUsbData;
    }

    // clean up string numbers to be numbers
    function sanitizeUsbData(usb_parsed){
      // Only sanitize values that exist
      if (usb_parsed.screen_rot !== undefined) {
        usb_parsed.screen_rot = parseInt(usb_parsed.screen_rot);
      }
      if (usb_parsed.performance_mode !== undefined) {
        usb_parsed.performance_mode = parseInt(usb_parsed.performance_mode);
      }
      if (usb_parsed.theme !== undefined) {
        usb_parsed.theme = parseInt(usb_parsed.theme);
      }
      return usb_parsed;
    }

    // check if version is at least 5.5
    function usesNewMapping(usb_parsed){
      if (usb_parsed?.mj_v >= 6) {
        return true; // Automatically true for 6.x and above
      }
      return (usb_parsed?.mj_v === 5 && usb_parsed?.mi_v >= 5);
    }

    function displayError(error) {
      console.log(error);
      statusDisplay.textContent = error.message;
    }

    // format minutes to HH:MM
    function displayTime(minutes) {
      const format = val => `0${Math.floor(val)}`.slice(-2)
      const hours = minutes / 60

      return [hours, minutes % 60].map(format).join(':')
    }

    connectButton.addEventListener('click', function () {
      if (port) {
        disconnect();
      } else {
        serial.requestPort().then(selectedPort => {
          port = selectedPort;
          connect();
        }).catch(error => {
          displayError(error);
        });
      }
    });

    serial.getPorts().then(ports => {
      if (ports.length === 0) {
        statusDisplay.textContent = 'No device found.';
      } else {
        statusDisplay.textContent = 'Connecting...';
        port = ports[0];
        connect();
      }
    });

    function disconnect() {
      port.disconnect();
      $('#frm-config :input').prop('disabled', true);
      $('button#bl').prop('disabled', true);
      syncButton.disabled = true;
      connectButton.textContent = 'Connect';
      statusDisplay.textContent = '';
      port = null;
    }

    function sendJSON(usb_json) {
      port.send(new TextEncoder('utf-8').encode(JSON.stringify(usb_json)));
    }

    let lastSyncTime = 0;
    const SYNC_COOLDOWN = 2000; // 2 seconds in milliseconds

    const DATA_CHUNKS = ['get_units', 'get_disp', 'get_perf', 'get_id'];
    let currentChunkIndex = 0;

    function sendSyncCommand() {
      const now = Date.now();
      if (now - lastSyncTime < SYNC_COOLDOWN) {
        console.log('Sync cooldown active, please wait');
        return;
      }

      // Reset the chunk index when starting a new sync
      currentChunkIndex = 0;

      // Start with basic sync command (gets version and arch)
      let sync_command_json = { 'command': 'sync' };
      console.log('sending', sync_command_json);
      sendJSON(sync_command_json);
      lastSyncTime = now;

      // Visually disable the button
      syncButton.disabled = true;
      setTimeout(() => {
        syncButton.disabled = false;
      }, SYNC_COOLDOWN);
    }

    function requestNextChunk() {
      if (currentChunkIndex < DATA_CHUNKS.length) {
        let command_json = { 'command': DATA_CHUNKS[currentChunkIndex] };
        console.log('sending chunk request', command_json);
        sendJSON(command_json);
        currentChunkIndex++;
      }
    }

    function didConnect() {
      statusDisplay.textContent = '';
      connectButton.textContent = 'Disconnect';
      $('#frm-config :input').prop('disabled', false);
      $('button#bl').prop('disabled', false);
      syncButton.disabled = false;

      sendSyncCommand();
    }

    // Add sync button click handler
    syncButton.addEventListener('click', function() {
      sendSyncCommand();
    });
  });
})();
