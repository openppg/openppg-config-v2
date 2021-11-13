/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */
// check for Geolocation support

function geoSupported() {
  if (navigator.geolocation) {
    console.log('Geolocation is supported!');
    return true;
  } else {
    console.log('Geolocation is not supported for this Browser/OS.');
    return false;
  }
}

function weatherBalloon(lat, lng) {
  let base = 'https://api.openweathermap.org/data/2.5/weather?appid=1478a376e70adac5a76dc4821ce27469';
  fetch(base + '&lat=' + lat + '&lon=' + lng + '&units=metric')
    .then(function (resp) {
      return resp.json()
    }) // Convert data to json
    .then(function (data) {
      var baro = data.main.pressure;
      $('#autoSeaPressureInput').val(baro);
    })
    .catch(function () {
      console.log('error fetching weather data');
    });
}

function updateLocalPressure() {
  var geoOptions = {
    enableHighAccuracy: false,
    timeout: 5000,
  };

  var geoSuccess = function (position) {
    console.log(position.coords);
    weatherBalloon(position.coords.latitude, position.coords.longitude);
  };

  var geoError = function (error) {
    console.log('Error occurred. Error code: ' + error.code);
    // error.code can be:
    //   0: unknown error
    //   1: permission denied
    //   2: position unavailable (error response from location provider)
    //   3: timed out
  };

  navigator.geolocation.getCurrentPosition(geoSuccess, geoError, geoOptions);
}
