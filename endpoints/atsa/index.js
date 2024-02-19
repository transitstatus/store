const fetch = require('node-fetch');

const trainHeadings = {
  N: 0,
  NE: 45,
  E: 90,
  SE: 135,
  S: 180,
  SW: 225,
  W: 270,
  NW: 315,
};

exports.update = async () => {
  console.log('updating amtraker')
  const now = new Date().valueOf();

  const trainsReq = await fetch('https://api-v3.amtraker.com/v3/trains');
  const staleReq = await fetch('https://api-v3.amtraker.com/v3/stale');
  const stationsReq = await fetch('https://gtfs.piemadd.com/data/amtrak/stops.json');

  const trainsData = await trainsReq.json();
  const staleData = await staleReq.json();
  const stationsData = await stationsReq.json();

  let transitStatusObject = {
    "trains": {},
    "stations": {},
    "lines": {},
    "lastUpdated": new Date(now).toISOString(),
    "shitsFucked": {
      "shitIsFucked": false,
      "message": ""
    }
  };

  //iterating through stations
  Object.values(stationsData).forEach((station) => {
    transitStatusObject.stations[station.stopID] = {
      stationID: station.stopID,
      stationName: station.stopName,
      lat: station.stopLat,
      lon: station.stopLon,
      destinations: {}
    }
  })

  //iterating through all trains
  Object.values(trainsData).flat().forEach((train) => {
    //populating trains part
    transitStatusObject.trains[train.trainID] = {
      lat: train.lat,
      lon: train.lon,
      heading: trainHeadings[train.heading],
      line: train.routeName,
      lineCode: train.trainNum,
      lineColor: "5366c9",
      lineTextColor: "F7F7F7",
      dest: train.destName,
      predictions: train.stations.map((station) => {
        return {
          stationID: station.code,
          stationName: station.name,
          actualETA: new Date(station.dep).valueOf(),
          noETA: false
        }
      }).filter((prediction) => {
        if (prediction.actualETA < now + (1000 * 60 * 5)) return false; //if the train was due more than 5 mintues ago
        return true;
      })
    }

    //creating lines
    transitStatusObject.lines[train.routeName] = {
      lineCode: train.trainNum,
      lineNameShort: train.trainNum,
      lineNameLong: train.routeName,
      routeColor: "5366c9",
      routeTextColor: "F7F7F7",
      stations: train.stations.map((station) => station.code),
      hasActiveTrains: true
    }

    //adding predictions to stations
    transitStatusObject.trains[train.trainID].predictions.forEach((prediction) => {
      //making sure our destination is added alreaady
      if (!transitStatusObject.stations[prediction.stationID].destinations[train.destName]) {
        transitStatusObject.stations[prediction.stationID].destinations[train.destName] = {
          trains: [],
        }
      }

      //adding the eta
      transitStatusObject.stations[prediction.stationID].destinations[train.destName].trains.push({
        runNumber: train.trainID,
        actualETA: prediction.actualETA,
        noETA: false,
        line: train.routeName,
        lineCode: train.trainNum,
        lineColor: "5366c9",
        lineTextColor: "F7F7F7"
      })
    })
  })

  return {
    ts: transitStatusObject,
  }
};