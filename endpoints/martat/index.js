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
  //cheeky cheeky, kinda dangerous tho
  process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';

  try {
    const trackingRes = await fetch(`https://developerservices.itsmarta.com:18096/railrealtimearrivals?apiKey=${process.env.marta}`);
    const trackingData = await trackingRes.json();

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

    Object.keys(stations).forEach((stationKey) => {
      //if (stationKey.length > 3) return; //bus stop
      const station = stations[stationKey];
      const actualStationID = (additionalConfig.stopNameReplacements[station.stopName] ?? station.stopName).replace(' STATION', '');

      transitStatusResponse.stations[actualStationID] = {
        stationID: actualStationID,
        stationName: titleCase(actualStationID),
        destinations: {},
        lat: station.stopLat,
        lon: station.stopLon,
      }
    })

    Object.keys(routes).forEach((routeKey) => {
      const route = routes[routeKey];
      const actualRouteKey = route.routeShortName;

      //probably a bus route
      if (!hardCoded[actualRouteKey]) return;

      // stop replacements and removing STATION
      const fixedRouteStations = route.routeStations.map((stationID) => {
        return (additionalConfig.stopNameReplacements[stations[stationID].stopName] ?? stations[stationID].stopName).replace(' STATION', '')
      })

      fixedRouteStations.forEach((routeStation) => {
        hardCoded[actualRouteKey].destinations.forEach((destination) => {
          if (!transitStatusResponse.stations[routeStation]) {
            console.log(transitStatusResponse.stations)
            console.log(routeStation)
            require('fs').writeFileSync('./stations.json', JSON.stringify(transitStatusResponse.stations));
          }

          transitStatusResponse.stations[routeStation].destinations[destination] = {
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
        stations: route.routeStations.map((stationID) => stations[stationID].stopName.replace(' STATION', '')),
        hasActiveTrains: false
      }
    });

    //since the API response is just an array of ETAs (multiple for each time a train is stopping at a station) we need to deduplicate
    let trainETAs = {};
    trackingData.RailArrivals.forEach((arrival) => {
      const trainStopID = `${arrival.TRAIN_ID}_${arrival.STATION}`;
      const modArrival = {
        ...arrival,
        EVENT_TIME: new Date(arrival.EVENT_TIME).valueOf(),
        NEXT_ARR: new Date(arrival.NEXT_ARR).valueOf(),
        RESPONSETIMESTAMP: new Date(arrival.RESPONSETIMESTAMP).valueOf(),
      }

      //initializing the train if we dont have anythign to compare to
      if (!trainETAs[trainStopID]) trainETAs[trainStopID] = modArrival;

      //if the stop update we have is more recent, replace it
      if (modArrival.EVENT_TIME > trainETAs[trainStopID]) trainETAs[trainStopID] = modArrival;
    })

    Object.values(trainETAs)
      .forEach((arrival) => {
        //initializing the train if it doesn't exist
        if (!transitStatusResponse.trains[arrival.TRAIN_ID]) {
          transitStatusResponse.trains[arrival.TRAIN_ID] = {
            lat: arrival.VEHICLELATITUDE,
            lon: arrival.VEHICLELONGITUDE,
            heading: 0,
            line: titleCase(arrival.LINE),
            lineCode: arrival.LINE,
            lineColor: hardCoded[arrival.LINE].routeColor,
            lineTextColor: hardCoded[arrival.LINE].routeTextColor,
            dest: titleCase(arrival.HEAD_SIGN),
            predictions: [],
            type: 'train',
          }
        }

        transitStatusResponse.trains[arrival.TRAIN_ID].predictions.push({
          stationID: arrival.STATION.replace(' STATION', ''),
          stationName: titleCase(arrival.STATION.replace(' STATION', '')),
          actualETA: arrival.NEXT_ARR,
          noETA: false,
        })
      })

    Object.keys(transitStatusResponse.trains).forEach((trainID) => {
      const train = transitStatusResponse.trains[trainID];

      train.predictions.forEach((prediction) => {
        if (!transitStatusResponse.stations[prediction.stationID]) {
          console.log(transitStatusResponse.stations)
          console.log(prediction)
        }


        if (!transitStatusResponse.stations[prediction.stationID].destinations[train.dest]) {
          transitStatusResponse.stations[prediction.stationID].destinations[train.dest] = {
            trains: []
          }
        }

        transitStatusResponse.stations[prediction.stationID].destinations[train.dest].trains.push({
          runNumber: trainID,
          actualETA: prediction.actualETA,
          noETA: prediction.noETA,
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