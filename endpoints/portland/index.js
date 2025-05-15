const fetch = require('node-fetch');

const routesA = ["BRZ", "HSK", "1", "2", "3", "4", "5", "7", "8", "9A"];
const routesB = ["9B", "21", "24A", "24B"];

const update = async () => {
  try {
    const gpMetroStationsReq = await fetch('https://gtfs.piemadd.com/data/gp_metro/stops.json');
    const gpMetroRoutesReq = await fetch('https://gtfs.piemadd.com/data/gp_metro/routes.json');

    const southPortlandStationsReq = await fetch('https://gtfs.piemadd.com/data/south_portland/stops.json');
    const southPortlandRoutesReq = await fetch('https://gtfs.piemadd.com/data/south_portland/routes.json');

    const gpMetroStations = await gpMetroStationsReq.json();
    const gpMetroRoutes = await gpMetroRoutesReq.json();

    const southPortlandStations = await southPortlandStationsReq.json();
    const southPortlandRoutes = await southPortlandRoutesReq.json();

    const lastUpdated = new Date().toISOString();

    let transitStatusResponse = {
      trains: {},
      stations: {},
      lines: {},
      lastUpdated,
    };

    //gp metro stations
    Object.keys(gpMetroStations).forEach((stationKey) => {
      const station = gpMetroStations[stationKey];

      transitStatusResponse.stations[stationKey] = {
        stationID: stationKey,
        stationName: station.stopName,
        destinations: {},
        lat: station.stopLat,
        lon: station.stopLon,
      }
    });

    //south portland stations
    Object.keys(southPortlandStations).forEach((stationKey) => {
      const station = southPortlandStations[stationKey];

      transitStatusResponse.stations[stationKey] = {
        stationID: stationKey,
        stationName: station.stopName,
        destinations: {},
        lat: station.stopLat,
        lon: station.stopLon,
      }
    });

    //gp metro routes
    Object.keys(gpMetroRoutes).forEach((routeKey) => {
      const route = gpMetroRoutes[routeKey];

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

    //south portland routes
    Object.keys(southPortlandRoutes).forEach((routeKey) => {
      const route = southPortlandRoutes[routeKey];

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

    /*
    trackingData.get_vehicles.forEach((train) => {
      transitStatusResponse.trains[train.tripID] = {
        lat: train.lat,
        lon: train.lng,
        heading: train.h,
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
          line: train.line,
          lineCode: train.lineCode,
          lineColor: train.lineColor,
          lineTextColor: train.lineTextColor,
        })
      })

      transitStatusResponse.lines[train.lineCode].hasActiveTrains = true;
    })
    */

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