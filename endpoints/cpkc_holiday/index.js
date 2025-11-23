const fetch = require('node-fetch');
const moment = require('moment-timezone');
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

const timeZoneNames = {
  'AST': 'America/Halifax',
  'EST': 'America/New_York',
  'CST': 'America/Chicago',
  'CT': 'America/Chicago',
  'MST': 'America/Boise',
  'PST': 'America/Los_Angeles'
};

const timeZoneOffsetsNumerical = {
  'AST': -240,
  'EST': -300,
  'CST': -360,
  'CT': -360,
  'MST': -420,
  'PST': -480
};

const parseStopTimes = (stopProperties) => {
  const arrivalTime = new Date(stopProperties.Arrival_Time_UTC);
  const arrivalTimeDate = moment(arrivalTime).tz(timeZoneNames[stopProperties.TimeZone]).format().split('T')[0];
  const arrivalTimeNumber = arrivalTime.valueOf();

  const eventStartTime = new Date(`${arrivalTimeDate}T${stopProperties.Event_Start}:00${timeZoneOffsets[stopProperties.TimeZone]}`).valueOf();
  const eventEndTime = new Date(`${arrivalTimeDate}T${stopProperties.Event_End}:00${timeZoneOffsets[stopProperties.TimeZone]}`).valueOf();
  const leaveTime = new Date(`${arrivalTimeDate}T${stopProperties.Leave_Time}:00${timeZoneOffsets[stopProperties.TimeZone]}`).valueOf();

  const res = {
    arrivalTime: !isNaN(arrivalTimeNumber) ? arrivalTimeNumber : null,
    eventStartTime: !isNaN(eventStartTime) ? eventStartTime : null,
    eventEndTime: !isNaN(eventEndTime) ? eventEndTime : null,
    leaveTime: !isNaN(leaveTime) ? leaveTime : null,
    hasAnyValidValues: false,
  }

  if (res.arrivalTime || res.eventStartTime || res.eventEndTime || res.leaveTime) res.hasAnyValidValues = true;

  return res;
};

const recursivelyRetryFetch = async (i = 0) => {
  if (i == 0) return false;

  const rawTrains = await fetch('https://gis.cpkcr.com/arcgis/rest/services/HolidayTrain/CPKC_Holiday_Train_Tracker/MapServer/0/query?f=geojson&geometry={%22xmin%22:-180,%22ymin%22:-90,%22xmax%22:180,%22ymax%22:90}&orderByFields=OBJECTID&outFields=OBJECTID,RunToCountry,train_dir,lead_loco&inSR=4326')

  if (!rawTrains.ok) {
    await new Promise(r => setTimeout(r, 1000));
    return recursivelyRetryFetch(i - 1);
  } else {
    const trainData = await rawTrains.json();
    return trainData;
  }

};

const update = async () => {
  try {
    const now = new Date();
    const nowNumber = now.valueOf();
    const twoDaysFromNow = nowNumber + (1000 * 60 * 60 * 24 * 2);

    const trainData = await recursivelyRetryFetch(5);
    //const trainData = { "type": "FeatureCollection", "features": [{ "type": "Feature", "id": 4, "geometry": { "type": "Point", "coordinates": [-70.98922999994089, 45.62174999984324] }, "properties": { "OBJECTID": 4, "RunToCountry": "CA", "last_event_tms": "1:19PM EST", "last_event_trstn_nm": "NANTES", "lat_nbr": 45.62175, "lngtd_nbr": -70.98923, "train_dir": "W", "lead_loco": "CP2249" } }, { "type": "Feature", "id": 14, "geometry": { "type": "Point", "coordinates": [-79.90167999975664, 43.25232300018597] }, "properties": { "OBJECTID": 14, "RunToCountry": "US", "last_event_tms": "1:19PM EST", "last_event_trstn_nm": "", "lat_nbr": 43.252323, "lngtd_nbr": -79.90168, "train_dir": "", "lead_loco": "CP2246" } }] }

    if (!trainData) return false;

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
        headingLetter: feature.properties.train_dir.length > 0 ? feature.properties.train_dir : 'N',
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
        //const showEventStartTime = parsedTimes.eventStartTime && nowNumber < parsedTimes.eventStartTime;
        //const showEventEndTime = parsedTimes.eventEndTime && nowNumber < parsedTimes.eventEndTime;
        const showDepartureTime = parsedTimes.leaveTime && nowNumber < parsedTimes.leaveTime;

        // creating stop
        if ((parsedTimes.arrivalTime || parsedTimes.leaveTime) && !transitStatusObject.stations[stationCodes[feature.properties.OBJECTID]]) {
          transitStatusObject.stations[stationCodes[feature.properties.OBJECTID]] = {
            stationID: stationCodes[feature.properties.OBJECTID],
            stationName: feature.properties.StopName,
            lat: Number(feature.geometry.coordinates[1]),
            lon: Number(feature.geometry.coordinates[0]),
            destinations: {
              'Train': { trains: [] }
            }
          }
        }

        // adding stop to line
        transitStatusObject.lines[feature.properties.TrainRoute].stations.push(stationCodes[feature.properties.OBJECTID]);

        const timeToUse =
          (parsedTimes.arrivalTime && nowNumber < parsedTimes.arrivalTime) ?
            parsedTimes.arrivalTime :
            (
              (parsedTimes.leaveTime && nowNumber < parsedTimes.leaveTime) ?
                parsedTimes.leaveTime :
                0
            )

        if (parsedTimes.arrivalTime || parsedTimes.leaveTime) {
          if (twoDaysFromNow >= timeToUse) {
            transitStatusObject.trains[engineNumbers[feature.properties.TrainRoute]].predictions.push({
              stationID: stationCodes[feature.properties.OBJECTID],
              stationName: feature.properties.StopName,
              actualETA: timeToUse,
              rawETA: parsedTimes.arrivalTime ?? parsedTimes.leaveTime, 
              arr: parsedTimes.arrivalTime,
              dep: parsedTimes.leaveTime,
              evSta: parsedTimes.eventStartTime,
              evEnd: parsedTimes.eventEndTime,
              tz: timeZoneNames[feature.properties.TimeZone],
              noETA: false,
              realTime: true,
            });

            transitStatusObject.stations[stationCodes[feature.properties.OBJECTID]].destinations.Train.trains.push({
              runNumber: engineNumbers[feature.properties.TrainRoute],
              actualETA: timeToUse,
              arr: parsedTimes.arrivalTime,
              dep: parsedTimes.leaveTime,
              evSta: parsedTimes.eventStartTime,
              evEnd: parsedTimes.eventEndTime,
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
            });
          }
        }
      });

    // sorting ETAs
    Object.keys(transitStatusObject.trains).forEach((trainKey) => {
      transitStatusObject.trains[trainKey].predictions = transitStatusObject.trains[trainKey].predictions.sort((a, b) => a.rawETA - b.rawETA);
    })

    return transitStatusObject;
  } catch (e) {
    console.log("Error updating CPKC holiday:", e)
    return false;
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
