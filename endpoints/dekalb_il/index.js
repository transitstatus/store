const fetch = require('node-fetch');
const protobuf = require('protobufjs');

const update = async () => {
  try {
    const lastUpdated = new Date().toISOString();

    const nowDate = new Date(lastUpdated);
    const todaysDate = new Date(new Date(lastUpdated).toISOString().split('T')[0] + 'T00:00:00.000Z')
    const yesterdaysDate = new Date(todaysDate.valueOf() - (1000 * 60 * 60 * 24));
    const tomorrowsDate = new Date(todaysDate.valueOf() + (1000 * 60 * 60 * 24));

    const root = await protobuf.load('schedules.proto');
    const MultipleVehiclesScheduleMessage = root.lookupType('gobbler.MultipleVehiclesScheduleMessage');

    const [
      vehiclesData,
      routesData,
      stationsData,
      staticStopsData,
      staticRoutesData,
      staticMetaData,
    ] = await Promise.all([
      'https://dekalbpublic.etaspot.net/service.php?service=get_vehicles&includeETAData=1&inService=1&orderedETAArray=1&token=TESTING',
      'https://dekalbpublic.etaspot.net/service.php?service=get_routes&token=TESTING',
      'https://dekalbpublic.etaspot.net/service.php?service=get_stops&token=TESTING',
      'https://gtfs.piemadd.com/data/dekalb_il/stops.json',
      'https://gtfs.piemadd.com/data/dekalb_il/routes.json',
      'https://gobblerstatic.transitstat.us/schedules/dekalb_il/metadata.json',
    ].map((url) =>
      fetch(url).then(res => res.json())
    ));

    const vehicleSchedule = await fetch('https://gobblerstatic.transitstat.us/schedules/dekalb_il/vehicles.pbf')
      .then(res => res.arrayBuffer())
      .then(arrayBuffer => MultipleVehiclesScheduleMessage.decode(new Uint8Array(arrayBuffer)));

    let stoppingPatternTimes = {};
    staticMetaData.stoppingPatterns.forEach((pattern, patternIndex) => {
      let totalTime = 0;
      for (let i = 1; i < pattern.length; i++) totalTime += staticMetaData.stopTimes[`${pattern[i - 1]}_${pattern[i]}`];
      stoppingPatternTimes[patternIndex] = totalTime;
    });

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
    });

    let scheduledVehicles = {};
    const fillInVehicleData = (vehicleSchedule, now, todayStart) => {
      const secondsSinceTodayStart = Math.floor((new Date(now).valueOf() - todayStart.valueOf()) / 1000);
      const todayStartCode = todayStart.toISOString().split('T')[0];
      const todayValidServices = staticMetaData.services[todayStartCode];

      const upcomingVehiclesWithinTimeFrame = vehicleSchedule
        .toJSON()
        .vehicleScheduleMessage
        .filter((vehicle) =>
          vehicle.startTime + stoppingPatternTimes[vehicle.vehicleStop] > secondsSinceTodayStart &&
          vehicle.startTime < secondsSinceTodayStart + (60 * 60 * 8) &&
          todayValidServices.includes(vehicle.serviceId)
        );

      upcomingVehiclesWithinTimeFrame.forEach((vehicle) => {
        const runNumber = `sched_${vehicle.runNumber}`

        let finalScheduledVehicle = {
          lat: 0,
          lon: 0,
          heading: 0,
          line: vehicle.routeId,
          lineCode: vehicle.routeId,
          lineColor: staticRoutesData[vehicle.routeId].routeColor,
          lineTextColor: staticRoutesData[vehicle.routeId].routeTextColor,
          dest: "Unknown Dest",
          predictions: [],
          type: 'train',
          extra: {}
        };

        let currentStationTime = todayStart.valueOf() + (vehicle.startTime * 1000);
        staticMetaData.stoppingPatterns[vehicle.vehicleStop].forEach((stop, i, arr) => {
          finalScheduledVehicle.predictions.push({ //adding prediction
            stationID: stop,
            stationName: staticStopsData[stop].stopName,
            actualETA: currentStationTime,
            noETA: false,
            realTime: false,
          });

          if (i == arr.length - 1) { //dont have to do the next step if this is the last station
            finalScheduledVehicle.dest = staticStopsData[stop].stopName;
          } else { //moving time to next station
            currentStationTime += staticMetaData.stopTimes[`${stop}_${arr[i + 1]}`] * 1000;
          }
        })

        if (!scheduledVehicles[runNumber]) scheduledVehicles[runNumber] = finalScheduledVehicle;
      });


    };

    fillInVehicleData(vehicleSchedule, nowDate, todaysDate); //today
    fillInVehicleData(vehicleSchedule, nowDate, yesterdaysDate); //yesterday
    fillInVehicleData(vehicleSchedule, nowDate, tomorrowsDate); //tomorrow

    Object.keys(scheduledVehicles)
      .sort((aTrip, bTrip) => {
        return scheduledVehicles[aTrip].predictions[0].actualETA - scheduledVehicles[bTrip].predictions[0].actualETA
      })
      .forEach((runNumber) => {
        const scheduledVehicle = scheduledVehicles[runNumber];

        if (transitStatusResponse.trains[runNumber]) return; // train exists
        transitStatusResponse.trains[runNumber] = scheduledVehicle;

        const trainDirection = 'Inbound'; //const trainDirection = parseInt(runNumber.split('-')[1]) % 2 == 0 ? 'Inbound' : 'Outbound';

        scheduledVehicle.predictions.forEach((stop) => {
          //adding stations to transitStatus object
          if (!transitStatusResponse.stations[stop.stationID]) {
            transitStatusResponse.stations[stop.stationID] = {
              stationID: stop.stationID,
              stationName: staticStopsData[stop.stationID].stopName,
              lat: staticStopsData[stop.stationID].stopLat,
              lon: staticStopsData[stop.stationID].stopLon,
              destinations: {
                'Inbound': { trains: [] },
                'Outbound': { trains: [] },
              },
            };
          };

          if (transitStatusResponse.stations[stop.stationID].destinations[trainDirection].trains.length > 12) return; // too much!

          transitStatusResponse.stations[stop.stationID].destinations[trainDirection].trains.push({
            runNumber: runNumber,
            actualETA: stop.actualETA,
            noETA: false,
            realTime: false,
            line: scheduledVehicle.line,
            lineCode: scheduledVehicle.lineCode,
            lineColor: scheduledVehicle.lineColor,
            lineTextColor: scheduledVehicle.lineTextColor,
            destination: scheduledVehicle.dest,
            extra: {},
          });
        });
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