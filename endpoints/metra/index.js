const fetch = require('node-fetch');
const protobuf = require('protobufjs');

require('dotenv').config();

const trainNumberRegex = new RegExp(/\d+/)

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
};

const holidayTrains = [
  'ME-BX02',
  'ME-BX03',
  'ME-BX04',
  'ME-BX05',
  'BNSF-9513',
  'BNSF-9516',
  'RI-MX01',
  'RI-MX02',
  'MDN-NX02',
  'MDN-NX03',
  'UPN-8911',
  'UPN-8914',
  'UPNW-7902',
  'UPNW-7903',
]

const downtownStations = [
  'Chicago OTC',
  'Chicago Union Station',
  'LaSalle Street',
  'Millennium Station',
]

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
  if (!process.env.metra_authorization) return false;

  try {
    const res = await fetch('https://gtfsapi.metrarail.com/gtfs/tripUpdates', { "headers": { "Authorization": process.env.metra_authorization } });
    const data = await res.json();

    const nowDate = new Date();
    const todaysDate = new Date(new Date(nowDate).toISOString().split('T')[0] + 'T00:00:00.000Z')
    const yesterdaysDate = new Date(todaysDate.valueOf() - (1000 * 60 * 60 * 24));
    const tomorrowsDate = new Date(todaysDate.valueOf() + (1000 * 60 * 60 * 24));

    const root = await protobuf.load('schedules.proto');
    const MultipleVehiclesScheduleMessage = root.lookupType('gobbler.MultipleVehiclesScheduleMessage');

    const [
      staticStopsData,
      staticRoutesData,
      staticMetaData,
    ] = await Promise.all([
      'https://gtfs.piemadd.com/data/metra/stops.json',
      'https://gtfs.piemadd.com/data/metra/routes.json',
      'https://gobblerstatic.transitstat.us/schedules/metra/metadata.json',
    ].map((url) =>
      fetch(url).then(res => res.json())
    ));

    const vehicleSchedule = await fetch('https://gobblerstatic.transitstat.us/schedules/metra/vehicles.pbf')
      .then(res => res.arrayBuffer())
      .then(arrayBuffer => MultipleVehiclesScheduleMessage.decode(new Uint8Array(arrayBuffer)));


    let stoppingPatternTimes = {};
    staticMetaData.stoppingPatterns.forEach((pattern, patternIndex) => {
      let totalTime = 0;
      for (let i = 1; i < pattern.length; i++) totalTime += staticMetaData.stopTimes[`${pattern[i - 1]}_${pattern[i]}`];
      stoppingPatternTimes[patternIndex] = totalTime;
    });

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
      lines: {},
    };

    //adding trains to transitStatus object
    data.forEach((train, i) => {
      const trainNumber = train.trip_update?.trip?.trip_id.match(trainNumberRegex);
      if (!trainNumber) return; //no train ig

      const runNumber = `${train.trip_update?.trip?.route_id.replaceAll('-', '')}-${trainNumber[0]}`;
      const isInbound = parseInt(trainNumber[0]) % 2 == 0;
      const trainDirection = isInbound ? 'Inbound' : 'Outbound';

      let finalTrain = {
        lat: train.trip_update?.position?.vehicle?.position?.latitude,
        lon: train.trip_update?.position?.vehicle?.position?.longitude,
        heading: train.trip_update?.position?.vehicle?.position?.bearing,
        realTime: true,
        line: actualLines[train.trip_update?.trip?.route_id],
        lineCode: train.trip_update?.trip?.route_id,
        lineColor: staticRoutesData[train.trip_update?.trip?.route_id].routeColor,
        lineTextColor: staticRoutesData[train.trip_update?.trip?.route_id].routeTextColor,
        dest: "Unknown Dest",
        predictions: [],
        type: 'train',
        extra: {
          holidayChristmas: holidayTrains.includes(runNumber),
        }
      };

      //adding predictions to transitStatus object
      train.trip_update?.stop_time_update?.reverse().forEach((stop, i) => {

        if (i == 0) finalTrain.dest = staticStopsData[stop.stop_id].stopName;

        const arr = new Date(stop.arrival?.time?.low).valueOf();
        const dep = new Date(stop.departure?.time?.low).valueOf();
        const time = Math.max(arr, dep);

        finalTrain.predictions.push({
          stationID: stop.stop_id,
          stationName: staticStopsData[stop.stop_id].stopName,
          actualETA: time,
          noETA: !time,
          realTime: true,
        });

        //adding stations to transitStatus object
        if (!transitStatus.stations[stop.stop_id]) {
          transitStatus.stations[stop.stop_id] = {
            stationID: stop.stop_id,
            stationName: staticStopsData[stop.stop_id].stopName,
            lat: staticStopsData[stop.stop_id].stopLat,
            lon: staticStopsData[stop.stop_id].stopLon,
            destinations: {
              'Inbound': { trains: [] },
              'Outbound': { trains: [] },
            },
          };
        }

        transitStatus.stations[stop.stop_id].destinations[trainDirection].trains.push({
          runNumber: runNumber,
          actualETA: time,
          noETA: !time,
          realTime: true,
          line: finalTrain.line,
          lineCode: finalTrain.lineCode,
          lineColor: finalTrain.lineColor,
          lineTextColor: finalTrain.lineTextColor,
          destination: finalTrain.dest,
          extra: {
            holidayChristmas: holidayTrains.includes(runNumber),
          }
        });
      });

      finalTrain.predictions = finalTrain.predictions.reverse();
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

    Object.keys(transitStatus.trains).forEach((train) => {
      const trainData = transitStatus.trains[train];

      transitStatus.lines[trainData.lineCode].hasActiveTrains = true;
    });

    const lastUpdated = new Date().toISOString();
    const lastUpdatedNum = new Date(lastUpdated).valueOf();

    transitStatus.lastUpdated = lastUpdated;

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
        const trainNumber = vehicle.runNumber.match(trainNumberRegex);
        if (!trainNumber) return; //no train ig
        const runNumber = `${vehicle.routeId.replaceAll('-', '')}-${trainNumber[0]}`;

        let finalScheduledVehicle = {
          lat: 0,
          lon: 0,
          heading: 0,
          realTime: false,
          line: actualLines[vehicle.routeId],
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

        if (transitStatus.trains[runNumber]) return; // train exists
        transitStatus.trains[runNumber] = scheduledVehicle;

        const trainDirection = parseInt(runNumber.split('-')[1]) % 2 == 0 ? 'Inbound' : 'Outbound';

        scheduledVehicle.predictions.forEach((stop) => {
          //adding stations to transitStatus object
          if (!transitStatus.stations[stop.stationID]) {
            transitStatus.stations[stop.stationID] = {
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

          if (transitStatus.stations[stop.stationID].destinations[trainDirection].trains.length > 12) return; // too much!

          transitStatus.stations[stop.stationID].destinations[trainDirection].trains.push({
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
      trains: processedData,
      transitStatus,
      lastUpdated: lastUpdated,
    }
  } catch (e) {
    console.log(e)
    return false;
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