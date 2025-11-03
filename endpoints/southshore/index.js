const fetch = require('node-fetch');
const otherStopData = require('./stops').otherStopData;

const update = async () => {
  //cheeky cheeky, kinda dangerous tho
  process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';

  try {
    const trackingRes = await fetch('https://southshore.etaspot.net/service.php?service=get_vehicles&includeETAData=1&inService=1&orderedETAArray=1&token=TESTING');
    const trackingData = await trackingRes.json();

    const stationsReq = await fetch('https://gtfs.piemadd.com/data/southshore/stops.json');
    const routesReq = await fetch('https://gtfs.piemadd.com/data/southshore/routes.json');

    const stations = await stationsReq.json();
    const routes = await routesReq.json();

    const lastUpdated = new Date().toISOString();

    let transitStatusResponse = {
      trains: {},
      stations: {},
      lines: {},
      lastUpdated,
    };

    Object.keys(stations).forEach((stationKey) => {
      const station = stations[stationKey];

      transitStatusResponse.stations[stationKey] = {
        stationID: stationKey,
        stationName: station.stopName,
        destinations: {},
        lat: station.stopLat,
        lon: station.stopLon,
      }
    })

    Object.keys(routes).forEach((routeKey) => {
      const route = routes[routeKey];

      route.routeStations.forEach((routeStation) => {
        route.destinations.forEach((destination) => {
          transitStatusResponse.stations[routeStation].destinations[destination] = {
            trains: [],
          }
        })
      })

      transitStatusResponse.lines[route.routeID] = {
        lineCode: route.routeID,
        lineNameShort: route.routeShortName,
        lineNameLong: route.routeLongName,
        routeColor: route.routeColor,
        routeTextColor: route.routeTextColor,
        stations: route.routeStations,
        hasActiveTrains: false
      }
    });

    trackingData.get_vehicles.forEach((train) => {

      transitStatusResponse.trains[train.tripID] = {
        lat: train.lat,
        lon: train.lng,
        heading: train.h,
        realTime: true,
        deadMileage: false,
        line: 'South Shore Line',
        lineCode: 'so_shore',
        lineColor: transitStatusResponse.lines['so_shore'].routeColor,
        lineTextColor: transitStatusResponse.lines['so_shore'].routeTextColor,
        dest: routes['so_shore'].routeTrips[train.tripID] ? routes['so_shore'].routeTrips[train.tripID].headsign : 'Unknown Destination',
        predictions: train.minutesToNextStops.map((stop, i) => {
          const stationMeta = transitStatusResponse.stations[`s${stop.stopID}`];

          return {
            stationID: stationMeta.stationID,
            stationName: stationMeta.stationName,
            //eta: stop.minutes,
            actualETA: new Date(lastUpdated).getTime() + (stop.minutes * 60 * 1000),
            noETA: false,
            realTime: true,
          }
        }),
        type: 'train',
      }

      if (transitStatusResponse.trains[train.tripID].dest === 'Unknown Destination') {
        const predictions = transitStatusResponse.trains[train.tripID].predictions;
        transitStatusResponse.trains[train.tripID].dest = predictions[predictions.length - 1].stationName;
      }
    })

    Object.keys(transitStatusResponse.trains).forEach((trainID) => {
      const train = transitStatusResponse.trains[trainID];

      train.predictions.forEach((prediction) => {
        transitStatusResponse.stations[prediction.stationID].destinations[train.dest].trains.push({
          runNumber: trainID,
          //eta: prediction.eta,
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
      transitStatus: transitStatusResponse,
    };
  } catch (e) {
    console.log(e);
    return false;
    return {
      transitStatus: {
        trains: {},
        stations: {},
        lines: {},
        lastUpdated: new Date().toISOString(),
      },
    };
  }
};

exports.update = update;