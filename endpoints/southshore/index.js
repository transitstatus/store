const fetch = require('node-fetch');
const otherStopData = require('./stops').otherStopData;

const update = async () => {
  const trackingRes = await fetch('https://southshore.etaspot.net/service.php?service=get_vehicles&includeETAData=1&inService=1&orderedETAArray=1&token=TESTING');
  const trackingData = await trackingRes.json();

  const stationsReq = await fetch('https://gtfs.piemadd.com/data/southshore/stops.json');
  const routesReq = await fetch('https://gtfs.piemadd.com/data/southshore/routes.json');

  const stations = await stationsReq.json();
  const routes = await routesReq.json();

  const sampleData = {
    "get_vehicles": [
      {
        "routeID": 1,
        "patternID": 10,
        "equipmentID": "23",
        "tripID": "22",
        "lat": 41.79477,
        "lng": -87.58713,
        "load": 0,
        "capacity": null,
        "bkSlots": null,
        "wcSlots": null,
        "bkUsed": 0,
        "wcUsed": 0,
        "eLoad": 0,
        "blockID": 0,
        "nextStopID": 3,
        "nextStopETA": 1411,
        "nextPatternStopID": 930,
        "h": 0,
        "lastStopID": 5,
        "lastPatternStopID": 929,
        "seq": 13,
        "lastStopExtID": "s5",
        "nextStopExtID": "s3",
        "nextStopPctProg": 1.824071,
        "scheduleNumber": "22",
        "inService": 1,
        "onSchedule": -121,
        "vehicleType": "Train",
        "trainID": 782,
        "receiveTime": 1692764611000,
        "deadHead": "0",
        "aID": "23",
        "minutesToNextStops": [
          {
            "blockID": 0,
            "stopID": 3,
            "patternStopID": 930,
            "timePoint": 0,
            "minutes": 7,
            "time": "11:31PM",
            "status": "11:31PM",
            "schedule": "09:30PM",
            "scheduleNumber": "22",
            "statuscolor": "#B91D1D",
            "track": 3,
            "direction": "Chicago",
            "directionAbbr": "C",
            "equipmentID": "23",
            "routeID": 1
          },
          {
            "blockID": 0,
            "stopID": 2,
            "patternStopID": 931,
            "timePoint": 0,
            "minutes": 10,
            "time": "11:34PM",
            "status": "11:34PM",
            "schedule": "09:33PM",
            "scheduleNumber": "22",
            "statuscolor": "#B91D1D",
            "track": 3,
            "direction": "Chicago",
            "directionAbbr": "C",
            "equipmentID": "23",
            "routeID": 1
          },
          {
            "blockID": 0,
            "stopID": 1,
            "patternStopID": 932,
            "timePoint": 0,
            "minutes": 13,
            "time": "11:37PM",
            "status": "11:37PM",
            "schedule": "09:36PM",
            "scheduleNumber": "22",
            "statuscolor": "#B91D1D",
            "track": 3,
            "direction": "Chicago",
            "directionAbbr": "C",
            "equipmentID": "23",
            "routeID": 1
          }
        ],
        "direction": "Chicago",
        "directionAbbr": "C"
      }
    ]
  }

  //const trackingData = sampleData;

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
    }
  });

  trackingData.get_vehicles.forEach((train) => {
    console.log(transitStatusResponse.stations)

    transitStatusResponse.trains[train.tripID] = {
      lat: train.lat,
      lon: train.lng,
      heading: train.h,
      line: 'South Shore Line',
      lineCode: 'so_shore',
      lineColor: transitStatusResponse.lines['so_shore'].routeColor,
      lineTextColor: transitStatusResponse.lines['so_shore'].routeTextColor,
      dest: routes['so_shore'].routeTrips[train.tripID].headsign,
      predictions: train.minutesToNextStops.map((stop, i) => {
        const stationMeta = transitStatusResponse.stations[`s${stop.stopID}`];

        return {
          stationID: stationMeta.stationID,
          stationName: stationMeta.stationName,
          eta: stop.minutes,
          actualETA: new Date(lastUpdated).getTime() + (stop.minutes * 60 * 1000),
        }
      }),
    }
  })

  Object.keys(transitStatusResponse.trains).forEach((trainID) => {
    const train = transitStatusResponse.trains[trainID];

    train.predictions.forEach((prediction) => {
      transitStatusResponse.stations[prediction.stationID].destinations[train.dest].trains.push({
        runNumber: trainID,
        eta: prediction.eta,
        actualETA: prediction.actualETA,
        line: train.line,
        lineCode: train.lineCode,
        lineColor: train.lineColor,
        lineTextColor: train.lineTextColor,
      })
    })
  })

  return {
    transitStatus: transitStatusResponse,
  };
};

exports.update = update;