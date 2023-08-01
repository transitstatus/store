const fetch = require('node-fetch');

require('dotenv').config();

const actualLines = {
  'BNSF': 'BNSF',
  'HC': 'Heritage Corridor',
  'MD-N': 'Milwaukee District North',
  'MD-W': 'Milwaukee District West',
  'ME': 'Metra Electric',
  'NCS': 'North Central Service',
  'RI': 'Rock Island',
  'SWS': 'Southwest Service',
  'UP-N': 'Union Pacific North',
  'UP-NW': 'Union Pacific Northwest',
  'UP-W': 'Union Pacific West',
}

const recursivelyParseObjectValuesIntoString = (obj) => {
  if (typeof obj === 'string') {
    if (obj === '') {
      return [];
    }

    const tempArr = obj.split('. ');
    if (tempArr.length > 1) {
      return tempArr;
    }

    return [obj];
  }

  const keys = Object.keys(obj);
  const values = Object.values(obj);

  let final = [];

  for (let i = 0; i < keys.length; i++) {
    if (typeof values[i] === 'object') {
      final.push(recursivelyParseObjectValuesIntoString(values[i]));
    } else {
      if (values[i] === '') {
        continue;
      }
      final.push(values[i]);
    }
  }

  return final;
};

const update = (async () => {
  const res = await fetch('https://gtfsapi.metrarail.com/gtfs/tripUpdates', {
    "credentials": "include",
    "headers": {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/115.0",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.5",
      "Authorization": process.env.metra_authorization,
      "Upgrade-Insecure-Requests": "1",
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "cross-site",
      "Pragma": "no-cache",
      "Cache-Control": "no-cache"
    },
    "method": "GET",
    "mode": "cors"
  });

  const staticRes = await fetch('https://gtfs.piemadd.com/data/metra/stops.json');
  const staticData = await staticRes.json();

  try {
    const data = await res.json();

    const processedData = data.map((train) => {
      return {
        trip: train.trip_update?.trip,
        vehicle: train.trip_update?.vehicle,
        position: train.trip_update?.position?.vehicle?.position,
        stops: train.trip_update?.stop_time_update,
      }
    });

    let transitStatus = {
      trains: {},
      stations: {},
    };

    //adding trains to transitStatus object
    data.forEach((train) => {
      const runNumber = train.trip_update?.vehicle?.label;

      let finalTrain = {
        lat: train.trip_update?.position?.vehicle?.position?.latitude,
        lon: train.trip_update?.position?.vehicle?.position?.longitude,
        heading: train.trip_update?.position?.vehicle?.position?.bearing,
        line: actualLines[train.trip_update?.trip?.route_id],
        lineCode: train.trip_update?.trip?.route_id,
        predictions: [],
      }

      //adding predictions to transitStatus object
      train.trip_update?.stop_time_update?.forEach((stop) => {
        const arr = new Date(stop.arrival?.time?.low).valueOf();
        const dep = new Date(stop.departure?.time?.low).valueOf();
        const time = Math.max(arr, dep);
        const now = new Date().valueOf();
        const eta = Math.round((time - now) / 60000);

        finalTrain.predictions.push({
          stationID: stop.stop_id,
          stationName: staticData[stop.stop_id].stopName,
          eta: eta,
          actualETA: time,
        });

        //adding stations to transitStatus object
        if (!transitStatus.stations[stop.stop_id]) {
          transitStatus.stations[stop.stop_id] = {
            stationID: stop.stop_id,
            stationName: staticData[stop.stop_id].stopName,
            destinations: {},
          };
        }

        const finalStation = finalTrain.predictions[finalTrain.predictions.length - 1];

        //adding destinations to transitStatus object
        if (!transitStatus.stations[stop.stop_id].destinations[finalStation.stationName]) {
          transitStatus.stations[stop.stop_id].destinations[finalStation.stationName] = {
            trains: [],
          };
        };

        transitStatus.stations[stop.stop_id].destinations[finalStation.stationName].trains.push({
          runNumber: finalTrain.runNum,
          eta: finalStation.eta,
          actualETA: finalStation.actualETA,
          line: finalTrain.line,
          lineCode: finalTrain.lineCode,
        });
      });

      transitStatus.trains[runNumber] = finalTrain;
    });

    const lastUpdated = new Date().toISOString();

    transitStatus.lastUpdated = lastUpdated;

    return {
      trains: processedData,
      transitStatus,
      lastUpdated: lastUpdated,
    }
  } catch (e) {
    console.log(e)
    return {
      trains: [],
      transitStatus: {
        trains: [],
        stations: [],
      },
      lastUpdated: new Date().toISOString(),
    }
  }
})

exports.update = update;