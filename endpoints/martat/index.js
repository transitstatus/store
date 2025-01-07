const fetch = require('node-fetch');
const nearestPointOnLine = require('@turf/nearest-point-on-line');
const rhumbBearing = require('@turf/rhumb-bearing');

const additionalConfig = require('./additionalConfig.json');

require('dotenv').config();

const titleCase = (str) => {
  return str.toLowerCase().split(/-| /).map(function (word) {
    return (word.charAt(0).toUpperCase() + word.slice(1));
  }).join(' ');
};

const getAngleFromFeatureAndPoint = (point, line) => {
  const snappedPoint = nearestPointOnLine(line, point);

  return snappedPoint;
};

const routeKeys = ['BLUE', 'GREEN', 'GOLD', 'RED']
const routeCodes = {
  '1': "BLUE",
  '2': "GREEN",
  '3': "GOLD",
  '4': "RED",
}
const hardCoded = {
  BLUE: {
    routeColor: '0075B2',
    routeTextColor: '000000',
    destinations: [
      "FIVE POINTS",
      "HE HOLMES",
      "INDIAN CREEK"
    ]
  },
  GOLD: {
    routeColor: 'D4A723',
    routeTextColor: '000000',
    destinations: [
      "AIRPORT",
      "DORAVILLE"
    ]
  },
  GREEN: {
    routeColor: '009D4B',
    routeTextColor: '000000',
    destinations: [
      "BANKHEAD",
      "CANDLER PARK",
      "KING MEMORIAL",
      "VINE CITY"
    ]
  },
  RED: {
    routeColor: 'CE242B',
    routeTextColor: '000000',
    destinations: [
      "AIRPORT",
      "LINDBERGH CENTER",
      "NORTH SPRINGS"
    ]
  }
}

const update = async () => {
  try {
    //const trackingRes = await fetch(`https://developerservices.itsmarta.com:18096/railrealtimearrivals?apiKey=${process.env.marta}`);
    const trackingRes = await fetch(`https://developer.itsmarta.com/RealtimeTrain/RestServiceNextTrain/GetRealtimeArrivals?apikey=${process.env.marta}`);
    const trackingData = await trackingRes.json();

    const trainsRes = await fetch('http://labs.itsmarta.com/signpost/trains');
    const trainsData = await trainsRes.json();

    const predictionsRes = await fetch('http://labs.itsmarta.com/signpost/predictions');
    const predictionsData = await predictionsRes.json();

    const shapeRes = await fetch('https://gtfs.piemadd.com/data/marta/shapes/type_1.geojson');
    const shapeData = await shapeRes.json();

    let shapeDataDict = {};
    shapeData.features.forEach((feature) => shapeDataDict[feature.properties.routeShortName]);

    const stationsRes = await fetch('https://gtfs.piemadd.com/data/marta/stops.json');
    const routesRes = await fetch('https://gtfs.piemadd.com/data/marta/routes.json');

    const stations = await stationsRes.json();
    const routes = await routesRes.json();

    const lastUpdated = new Date().toISOString();

    let transitStatusResponse = {
      trains: {},
      stations: {},
      lines: {},
      lastUpdated,
    };

    Object.keys(additionalConfig.stationKeys).forEach((key) => {
      const station = stations[additionalConfig.stationKeys[key]['gtfs_code']];

      transitStatusResponse.stations[key] = {
        stationID: key,
        stationName: titleCase(station.stopName),
        destinations: {},
        lat: station.stopLat,
        lon: station.stopLon,
      }
    })

    Object.keys(routes).forEach((routeKey) => {
      const route = routes[routeKey];
      const actualRouteKey = route.routeShortName;

      //probably a bus route
      if (!routeKeys.includes(actualRouteKey)) return;

      additionalConfig.routeStations[actualRouteKey].forEach((routeStation) => {
        route.destinations.forEach((destination) => {
          if (destination.includes(' TO ')) return; //we dont want these destinations
          transitStatusResponse.stations[routeStation].destinations[titleCase(destination)] = {
            trains: [],
          }
        })
      })

      transitStatusResponse.lines[actualRouteKey] = {
        lineCode: actualRouteKey,
        lineNameShort: titleCase(route.routeShortName),
        lineNameLong: titleCase(route.routeLongName),
        routeColor: route.routeColor,
        routeTextColor: route.routeTextColor,
        stations: additionalConfig.routeStations[actualRouteKey],
        hasActiveTrains: false
      }
    });

    trainsData.forEach((train) => {
      const destination = stations[additionalConfig.stationKeys[train.destination]['gtfs_code']];

      transitStatusResponse.trains[train.trainId] = {
        lat: train.lastPosition[0],
        lon: train.lastPosition[1],
        heading: 0,
        line: titleCase(routeCodes[train.lineCode]),
        lineCode: routeCodes[train.lineCode],
        lineColor: transitStatusResponse.lines[routeCodes[train.lineCode]].routeColor,
        lineTextColor: transitStatusResponse.lines[routeCodes[train.lineCode]].routeTextColor,
        dest: titleCase(destination.stopName),
        predictions: [],
        type: 'train',
      }
    })

    predictionsData.forEach((prediction) => {
      const station = stations[additionalConfig.stationKeys[prediction.station]['gtfs_code']];

      transitStatusResponse.trains[prediction.internalId].predictions.push({
        stationID: prediction.station,
        stationName: titleCase(station.stopName),
        actualETA: new Date(prediction.nextArr).valueOf(),
        noETA: false,
      })
    })

    Object.keys(transitStatusResponse.trains).forEach((trainID) => {
      const train = transitStatusResponse.trains[trainID];

      train.predictions.forEach((prediction) => {
        if (!transitStatusResponse.stations[prediction.stationID].destinations[train.dest]) {
          transitStatusResponse.stations[prediction.stationID].destinations[train.dest] = {
            trains: []
          }
        }

        transitStatusResponse.stations[prediction.stationID].destinations[train.dest].trains.push({
          runNumber: trainID,
          actualETA: prediction.actualETA,
          noETA: prediction.noETA,
          realTime: true,
          line: train.line,
          lineCode: train.lineCode,
          lineColor: train.lineColor,
          lineTextColor: train.lineTextColor,
        })
      })

      transitStatusResponse.lines[train.lineCode].hasActiveTrains = true;
    })

    return {
      v1: transitStatusResponse,
    };
  } catch (e) {
    console.log(e);
    return false;
    return {
      v1: {
        trains: {},
        stations: {},
        lines: {},
        lastUpdated: new Date().toISOString(),
      },
    };
  }
};

exports.update = update;