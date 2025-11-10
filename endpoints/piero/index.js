const update = (async () => {
  try {

    const [
      staticStopsData,
      staticRoutesData,
      metraTrainData,
      pieroTrainsList,
    ] = await Promise.all([
      'https://gtfs.piemadd.com/data/metra/stops.json',
      'https://gtfs.piemadd.com/data/metra/routes.json',
      'http://localhost:3000/metra/transitStatus',
      `https://gks.pgm.sh/api/v1/piero_trains?t=${Date.now()}`
    ].map((url) =>
      fetch(url).then(res => res.json())
    ));

    const lastUpdated = new Date().toISOString();

    let transitStatus = {
      trains: {},
      stations: {},
      lines: {},
      alerts: [],
      lastUpdated,
    };

    if (pieroTrainsList.error) return { v1: transitStatus };

    Object.values(staticStopsData).forEach((stop) => {
      //adding stations to transitStatus object
      transitStatus.stations[stop.stopID] = {
        stationID: stop.stopID,
        stationName: stop.stopName,
        lat: stop.stopLat,
        lon: stop.stopLon,
        destinations: {
          'Inbound': { trains: [] },
          'Outbound': { trains: [] },
        },
      };
    });

    //adding trains to transitStatus object
    Object.keys(metraTrainData.trains).forEach((runNumber) => {
      const finalTrain = metraTrainData.trains[runNumber];

      if (!pieroTrainsList.response.object.includes(runNumber)) return;

      const trainNumber = runNumber.split('-')[1];
      const isInbound = parseInt(trainNumber[0]) % 2 == 0;
      const trainDirection = isInbound ? 'Inbound' : 'Outbound';

      finalTrain.predictions.forEach((prediciton) => {
        transitStatus.stations[prediciton.stationID].destinations[trainDirection].trains.push({
          runNumber: runNumber,
          actualETA: prediciton.actualETA,
          noETA: prediciton.noETA,
          realTime: prediciton.realTime,
          line: finalTrain.line,
          lineCode: finalTrain.lineCode,
          lineColor: finalTrain.lineColor,
          lineTextColor: finalTrain.lineTextColor,
          destination: finalTrain.dest,
          extra: {}
        });
      });

      finalTrain.deadMileage = false;

      transitStatus.trains[runNumber] = finalTrain;
    });

    //adding any stations without trains to transitStatus object
    Object.keys(staticRoutesData).forEach((routeID) => {
      const route = staticRoutesData[routeID];

      transitStatus.lines[routeID] = {
        lineCode: routeID,
        lineNameShort: route.routeShortName,
        lineNameLong: route.routeLongName,
        routeColor: route.routeColor,
        routeTextColor: route.routeTextColor,
        stations: route.routeStations,
        hasActiveTrains: false
      };

      route.routeStations.forEach((stationID) => {
        if (!transitStatus.stations[stationID]) {
          transitStatus.stations[stationID] = {
            stationID: stationID,
            stationName: staticStopsData[stationID].stopName,
            lat: staticStopsData[stationID].stopLat,
            lon: staticStopsData[stationID].stopLon,
            destinations: {
              'Inbound': { trains: [] },
              'Outbound': { trains: [] },
            },
          };
        }
      });
    });

    transitStatus.lines['DEADMILEAGE'] = {
      lineCode: 'DEADMILEAGE',
      lineNameShort: 'Dead Mileage',
      lineNameLong: 'Dead Mileage',
      routeColor: '111111',
      routeTextColor: 'ffffff',
      stations: [],
      hasActiveTrains: false
    };

    Object.keys(transitStatus.trains).forEach((train) => {
      const trainData = transitStatus.trains[train];

      if (transitStatus.lines[trainData.lineCode]) transitStatus.lines[trainData.lineCode].hasActiveTrains = true;
    });

    return { v1: transitStatus }
  } catch (e) {
    console.log(e)
    return false;
  }
})

exports.update = update;