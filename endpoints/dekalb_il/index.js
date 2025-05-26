const fetch = require('node-fetch');
const otherStopData = require('./stops').otherStopData;

const update = async () => {
  try {
    const [
      vehiclesData,
      routesData,
      stationsData,
      //patternsData,
    ] = await Promise.all([
      'https://dekalbpublic.etaspot.net/service.php?service=get_vehicles&includeETAData=1&inService=1&orderedETAArray=1&token=TESTING',
      'https://dekalbpublic.etaspot.net/service.php?service=get_routes&token=TESTING',
      'https://dekalbpublic.etaspot.net/service.php?service=get_stops&token=TESTING',
      //'https://dekalbpublic.etaspot.net/service.php?service=get_patterns&token=TESTING',
    ].map((url) =>
      fetch(url).then(res => res.json())
    ));

    const lastUpdated = new Date().toISOString();

    let vehicleDirections = {};

    let transitStatusResponse = {
      trains: {},
      stations: {},
      lines: {},
      lastUpdated,
    };

    stationsData.get_stops.forEach((station) => {
      transitStatusResponse.stations[station.id] = {
        stationID: station.id,
        stationName: station.name,
        destinations: {
          'Inbound': { trains: [] },
          'Outbound': { trains: [] }
        },
        lat: station.lat,
        lon: station.lng,
      }
    })

    routesData.get_routes.forEach((route) => {
      transitStatusResponse.lines[route.id] = {
        lineCode: route.id,
        lineNameShort: route.abbr,
        lineNameLong: route.name,
        routeColor: route.color.replace('#', ''),
        routeTextColor: 'ffffff',
        stations: route.stops,
        hasActiveTrains: false
      }
    });

    vehiclesData.get_vehicles.forEach((train) => {
      const trainRoute = transitStatusResponse.lines[train.routeID];

      vehicleDirections[train.equipmentID] = train.direction;

      transitStatusResponse.trains[train.equipmentID] = {
        lat: train.lat,
        lon: train.lng,
        heading: train.h,
        line: trainRoute.lineNameShort,
        lineCode: trainRoute.lineCode,
        lineColor: trainRoute.routeColor,
        lineTextColor: trainRoute.routeTextColor,
        dest: 'Unknown Destination',
        predictions: train.minutesToNextStops.map((stop, i) => {
          const stationMeta = transitStatusResponse.stations[stop.stopID];

          return {
            stationID: stationMeta.stationID,
            stationName: stationMeta.stationName,
            actualETA: new Date(lastUpdated).getTime() + (stop.minutes * 60 * 1000),
            noETA: false,
            realTime: true,
          }
        }),
        type: 'bus',
      }

      if (transitStatusResponse.trains[train.equipmentID].dest === 'Unknown Destination') {
        const predictions = transitStatusResponse.trains[train.equipmentID].predictions;
        transitStatusResponse.trains[train.equipmentID].dest = predictions[predictions.length - 1].stationName;
      }
    })

    Object.keys(transitStatusResponse.trains).forEach((trainID) => {
      const train = transitStatusResponse.trains[trainID];

      train.predictions.forEach((prediction) => {
        transitStatusResponse.stations[prediction.stationID].destinations[vehicleDirections[trainID]].trains.push({
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