const fetch = require('node-fetch');
const stationsData = require('./stops.json');
const stationCodes = require('./stationCodes.json');

const timeZoneOffsets = {
  'AST': '-04:00',
  'EST': '-05:00',
  'CST': '-06:00',
  'CT': '-06:00',
  'MST': '-07:00',
  'PST': '-08:00'
};

const timeZoneOffsetsNumerical = {
  'AST': -240,
  'EST': -300,
  'CST': -360,
  'CT': -360,
  'MST': -420,
  'PST': -480
};

// https://stackoverflow.com/questions/17415579/how-to-iso-8601-format-a-date-with-timezone-offset-in-javascript
const toIsoStringWithOffset = (date, offset) => {
  var tzo = offset,
    dif = tzo >= 0 ? '+' : '-',
    pad = function (num) {
      return (num < 10 ? '0' : '') + num;
    };

  return date.getFullYear() +
    '-' + pad(date.getMonth() + 1) +
    '-' + pad(date.getDate()) +
    'T' + pad(date.getHours()) +
    ':' + pad(date.getMinutes()) +
    ':' + pad(date.getSeconds()) +
    dif + pad(Math.floor(Math.abs(tzo) / 60)) +
    ':' + pad(Math.abs(tzo) % 60);
}

const parseStopTimes = (stopProperties) => {
  const arrivalTime = new Date(stopProperties.Arrival_Time_UTC);
  const arrivalTimeDate = toIsoStringWithOffset(arrivalTime, timeZoneOffsetsNumerical[stopProperties.TimeZone]).split('T')[0];
  const arrivalTimeNumber = arrivalTime.valueOf();

  const eventStartTime = new Date(`${arrivalTimeDate}T${stopProperties.Event_Start}:00${timeZoneOffsets[stopProperties.TimeZone]}`).valueOf();
  const eventEndTime = new Date(`${arrivalTimeDate}T${stopProperties.Event_End}:00${timeZoneOffsets[stopProperties.TimeZone]}`).valueOf();
  const leaveTime = new Date(`${arrivalTimeDate}T${stopProperties.Leave_Time}:00${timeZoneOffsets[stopProperties.TimeZone]}`).valueOf();

  return {
    arrivalTime: !isNaN(arrivalTimeNumber) ? arrivalTimeNumber : null,
    eventStartTime: !isNaN(eventStartTime) ? eventStartTime : null,
    eventEndTime: !isNaN(eventEndTime) ? eventEndTime : null,
    leaveTime: !isNaN(leaveTime) ? leaveTime : null,
  }
};

const update = async () => {
  try {
    const now = new Date();
    const nowNumber = now.valueOf();

    const trainData = await fetch('https://gis.cpkcr.com/arcgis/rest/services/HolidayTrain/CPKC_Holiday_Train_Tracker/MapServer/0/query?f=geojson&geometry={%22xmin%22:-180,%22ymin%22:-90,%22xmax%22:180,%22ymax%22:90}&orderByFields=OBJECTID&outFields=OBJECTID,RunToCountry,last_event_tms,last_event_trstn_nm,lat_nbr,lngtd_nbr,train_dir,lead_loco&inSR=4326').then((res) => res.json());

    //const trainData = { "type": "FeatureCollection", "features": [{ "type": "Feature", "id": 4, "geometry": { "type": "Point", "coordinates": [-70.98922999994089, 45.62174999984324] }, "properties": { "OBJECTID": 4, "RunToCountry": "CA", "last_event_tms": "1:19PM EST", "last_event_trstn_nm": "NANTES", "lat_nbr": 45.62175, "lngtd_nbr": -70.98923, "train_dir": "W", "lead_loco": "CP2249" } }, { "type": "Feature", "id": 14, "geometry": { "type": "Point", "coordinates": [-79.90167999975664, 43.25232300018597] }, "properties": { "OBJECTID": 14, "RunToCountry": "US", "last_event_tms": "1:19PM EST", "last_event_trstn_nm": "", "lat_nbr": 43.252323, "lngtd_nbr": -79.90168, "train_dir": "", "lead_loco": "CP2246" } }] }

    let engineNumbers = {};

    let transitStatusObject = {
      lastUpdated: now.toISOString(),
      trains: {},
      stations: {},
      lines: {
        US: {
          lineCode: 'US',
          lineNameShort: 'US',
          lineNameLong: 'US',
          routeColor: '267300',
          routeTextColor: 'ffffff',
          stations: [],
          hasActiveTrains: true,
        },
        CA: {
          lineCode: 'CA',
          lineNameShort: 'CA',
          lineNameLong: 'Canada',
          routeColor: 'a80000',
          routeTextColor: 'ffffff',
          stations: [],
          hasActiveTrains: true,
        },
      },
      shitsFucked: {
        shitIsFucked: false,
        message: ""
      },
      amtrakerStops: {}
    };

    trainData.features.forEach((feature) => {
      engineNumbers[feature.properties.RunToCountry] = feature.properties.lead_loco.replace('CP', '');

      transitStatusObject.trains[feature.properties.lead_loco.replace('CP', '')] = {
        lat: Number(feature.geometry.coordinates[1]),
        lon: Number(feature.geometry.coordinates[0]),
        heading: 0,
        realTime: true,
        deadMileage: false,
        line: transitStatusObject.lines[feature.properties.RunToCountry].lineNameLong,
        lineCode: feature.properties.RunToCountry,
        lineColor: transitStatusObject.lines[feature.properties.RunToCountry].routeColor,
        lineTextColor: transitStatusObject.lines[feature.properties.RunToCountry].routeTextColor,
        dest: 'Christmas',
        predictions: [],
        type: 'train',
        extra: {
          holidayChristmas: true,
          //engine: feature.properties.lead_loco.replace('CP', 'CP '),
        }
      }
    });

    stationsData.features
      .sort((a, b) => {
        if (a.properties.PubliclyVisible != 'Y' && b.properties.PubliclyVisible != 'Y') return 0;
        if (a.properties.PubliclyVisible == 'Y' && b.properties.PubliclyVisible != 'Y') return 1;
        if (a.properties.PubliclyVisible != 'Y' && b.properties.PubliclyVisible == 'Y') return -1;
        if (a.properties.PubliclyVisible == 'Y' && b.properties.PubliclyVisible == 'Y') return 0;
      })
      .forEach((feature) => {
        if (!feature.properties.Arrival_Time_UTC) return; // stop is not real
        //if (feature.properties.PubliclyVisible != 'Y') return; // stop shouldnt be shown

        const parsedTimes = parseStopTimes(feature.properties);

        const showArrivalTime = parsedTimes.arrivalTime && nowNumber < parsedTimes.arrivalTime;
        const showEventStartTime = parsedTimes.eventStartTime && nowNumber < parsedTimes.eventStartTime;
        const showEventEndTime = parsedTimes.eventEndTime && nowNumber < parsedTimes.eventEndTime;
        const showDepartureTime = parsedTimes.leaveTime && nowNumber < parsedTimes.leaveTime;

        // creating stop
        if (showArrivalTime || showEventStartTime || showEventEndTime || showDepartureTime) {
          transitStatusObject.stations[feature.properties.OBJECTID] = {
            stationID: feature.properties.OBJECTID,
            stationName: feature.properties.StopName,
            lat: Number(feature.geometry.coordinates[1]),
            lon: Number(feature.geometry.coordinates[0]),
            destinations: {}
          }
        }

        // adding stop to line
        transitStatusObject.lines[feature.properties.TrainRoute].stations.push(feature.properties.OBJECTID.toString());

        if (showArrivalTime) { // if we should show the arrival time
          transitStatusObject.trains[engineNumbers[feature.properties.TrainRoute]].predictions.push({
            stationID: feature.properties.OBJECTID,
            stationName: `${feature.properties.StopName} (Arr)`,
            actualETA: parsedTimes.arrivalTime,
            noETA: false,
            realTime: true,
          });

          transitStatusObject.stations[feature.properties.OBJECTID].destinations['Arrival'] = {
            trains: [{
              runNumber: engineNumbers[feature.properties.TrainRoute],
              actualETA: parsedTimes.arrivalTime,
              noETA: false,
              realTime: true,
              line: transitStatusObject.lines[feature.properties.TrainRoute].lineNameLong,
              lineCode: feature.properties.TrainRoute,
              lineColor: transitStatusObject.lines[feature.properties.TrainRoute].routeColor,
              lineTextColor: transitStatusObject.lines[feature.properties.TrainRoute].routeTextColor,
              destination: 'Christmas',
              extra: {
                holidayChristmas: true,
              }
            }],
          }
        }
        if (showEventStartTime) {
          transitStatusObject.trains[engineNumbers[feature.properties.TrainRoute]].predictions.push({
            stationID: feature.properties.OBJECTID,
            stationName: `${feature.properties.StopName} (Ev-S)`,
            actualETA: parsedTimes.eventStartTime,
            noETA: false,
            realTime: true,
          });

          transitStatusObject.stations[feature.properties.OBJECTID].destinations['Event Start'] = {
            trains: [{
              runNumber: engineNumbers[feature.properties.TrainRoute],
              actualETA: parsedTimes.eventStartTime,
              noETA: false,
              realTime: true,
              line: transitStatusObject.lines[feature.properties.TrainRoute].lineNameLong,
              lineCode: feature.properties.TrainRoute,
              lineColor: transitStatusObject.lines[feature.properties.TrainRoute].routeColor,
              lineTextColor: transitStatusObject.lines[feature.properties.TrainRoute].routeTextColor,
              destination: 'Christmas',
              extra: {
                holidayChristmas: true,
              }
            }],
          };
        }
        if (showEventEndTime) {
          transitStatusObject.trains[engineNumbers[feature.properties.TrainRoute]].predictions.push({
            stationID: feature.properties.OBJECTID,
            stationName: `${feature.properties.StopName} (Ev-E)`,
            actualETA: parsedTimes.eventEndTime,
            noETA: false,
            realTime: true,
          });

          transitStatusObject.stations[feature.properties.OBJECTID].destinations['Event End'] = {
            trains: [{
              runNumber: engineNumbers[feature.properties.TrainRoute],
              actualETA: parsedTimes.eventEndTime,
              noETA: false,
              realTime: true,
              line: transitStatusObject.lines[feature.properties.TrainRoute].lineNameLong,
              lineCode: feature.properties.TrainRoute,
              lineColor: transitStatusObject.lines[feature.properties.TrainRoute].routeColor,
              lineTextColor: transitStatusObject.lines[feature.properties.TrainRoute].routeTextColor,
              destination: 'Christmas',
              extra: {
                holidayChristmas: true,
              }
            }],
          };
        }
        if (showDepartureTime) {
          transitStatusObject.trains[engineNumbers[feature.properties.TrainRoute]].predictions.push({
            stationID: feature.properties.OBJECTID,
            stationName: `${feature.properties.StopName} (Dep)`,
            actualETA: parsedTimes.leaveTime,
            noETA: false,
            realTime: true,
          });

          transitStatusObject.stations[feature.properties.OBJECTID].destinations['Departure'] = {
            trains: [{
              runNumber: engineNumbers[feature.properties.TrainRoute],
              actualETA: parsedTimes.leaveTime,
              noETA: false,
              realTime: true,
              line: transitStatusObject.lines[feature.properties.TrainRoute].lineNameLong,
              lineCode: feature.properties.TrainRoute,
              lineColor: transitStatusObject.lines[feature.properties.TrainRoute].routeColor,
              lineTextColor: transitStatusObject.lines[feature.properties.TrainRoute].routeTextColor,
              destination: 'Christmas',
              extra: {
                holidayChristmas: true,
              }
            }],
          };
        }
      });

    // sorting ETAs
    Object.keys(transitStatusObject.trains).forEach((trainKey) => {
      transitStatusObject.trains[trainKey].predictions = transitStatusObject.trains[trainKey].predictions.sort((a, b) => a.actualETA - b.actualETA);
    })

    return transitStatusObject;
  } catch (e) {
    console.log("Error updating CPKC holiday:", e)
    return {
      lastUpdated: 0,
      trains: {},
      stations: {},
      lines: {},
      shitsFucked: {
        shitIsFucked: true,
        message: "There was an error fetching data from CPKC. This is us, not you."
      }
    };
  }

};

exports.update = update;
