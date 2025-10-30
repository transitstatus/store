const protobuf = require('protobufjs');

require('dotenv').config();

const trainNumberRegex = new RegExp(/\d+/);

const scheduleRelationshipEnums = {
  0: 'SCHEDULED',
  2: 'UNSCHEDULED',
  3: 'CANCELED',
  4: 'REPLACEMENT',
  5: 'DUPLICATED',
  6: 'NEW',
  7: 'DELETED',
}

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
];

const update = (async () => {
  if (!process.env.metra_token) return false;

  const gtfsRealtimeRoot = await protobuf.load('gtfs-rt.proto');
  const FeedMessage = gtfsRealtimeRoot.lookupType('transit_realtime.FeedMessage');

  let cancelledTrains = {};

  try {
    const [
      tripUpdatesData,
      positionsData,
      alertsData,
    ] = await Promise.all([
      `https://gtfspublic.metrarr.com/gtfs/public/tripupdates?api_token=${process.env.metra_token}`,
      `https://gtfspublic.metrarr.com/gtfs/public/positions?api_token=${process.env.metra_token}`,
      `https://gtfspublic.metrarr.com/gtfs/public/alerts?api_token=${process.env.metra_token}`,
    ].map((url) =>
      fetch(url).then(res => res.arrayBuffer()).then(arrayBuffer => FeedMessage.decode(new Uint8Array(arrayBuffer)))
    ));

    let vehiclePositionsDict = {};
    positionsData.entity.forEach((position) => {
      if (position.vehicle) {
        if (position.vehicle.vehicle && position.vehicle.position) {
          vehiclePositionsDict[position.vehicle.vehicle.id] = position.vehicle.position;
        }
      }
    });

    const [
      staticStopsData,
      staticRoutesData,
      staticMetaData,
      scheduledVehicles,
    ] = await Promise.all([
      'https://gtfs.piemadd.com/data/metra/stops.json',
      'https://gtfs.piemadd.com/data/metra/routes.json',
      'https://gobblerstatic.transitstat.us/schedules/metra/metadata.json',
      'http://localhost:3000/gtfs_sch/metra/scheduledVehicles',
    ].map((url) =>
      fetch(url).then(res => res.json())
    ));

    let stoppingPatternTimes = {};
    staticMetaData.stoppingPatterns.forEach((pattern, patternIndex) => {
      let totalTime = 0;
      for (let i = 1; i < pattern.length; i++) totalTime += staticMetaData.stopTimes[`${pattern[i - 1]}_${pattern[i]}`];
      stoppingPatternTimes[patternIndex] = totalTime;
    });

    let transitStatus = {
      trains: {},
      stations: {},
      lines: {},
      alerts: [],
    };

    //adding trains to transitStatus object
    tripUpdatesData.entity.forEach((train, i) => {
      const trainNumber = train.tripUpdate?.trip?.tripId.match(trainNumberRegex);
      if (!trainNumber) return; //no train ig

      const runNumber = `${train.tripUpdate?.trip?.routeId.replaceAll('-', '')}-${trainNumber[0]}`;
      const isInbound = parseInt(trainNumber[0]) % 2 == 0;
      const trainDirection = isInbound ? 'Inbound' : 'Outbound';

      if (train.tripUpdate?.trip?.scheduleRelationship == 3) {
        cancelledTrains[trainNumber] = true;
        return;
      }

      const position = vehiclePositionsDict[train.tripUpdate?.vehicle?.id] ?? {
        latitude: 0,
        longitude: 0,
        bearing: 0,
      }

      let finalTrain = {
        lat: position.latitude,
        lon: position.longitude,
        heading: position.bearing,
        realTime: true,
        line: staticRoutesData[train.tripUpdate?.trip?.routeId].routeLongName,
        lineCode: train.tripUpdate?.trip?.routeId,
        lineColor: staticRoutesData[train.tripUpdate?.trip?.routeId].routeColor,
        lineTextColor: staticRoutesData[train.tripUpdate?.trip?.routeId].routeTextColor,
        dest: "Unknown Dest",
        predictions: [],
        type: 'train',
        extra: {
          holidayChristmas: holidayTrains.includes(runNumber),
          cabCar: train.tripUpdate?.position?.vehicle?.vehicle?.id,
          scheduleRelationship: train.tripUpdate?.trip?.scheduleRelationship,
          scheduleRelationshipEnum: scheduleRelationshipEnums[train.tripUpdate?.trip?.scheduleRelationship],
        }
      };

      //adding predictions to transitStatus object
      train.tripUpdate?.stopTimeUpdate?.reverse().forEach((stop, i) => {
        if (i == 0) finalTrain.dest = staticStopsData[stop.stopId].stopName;

        const arr = stop.arrival ? new Date(stop.arrival.time?.low).valueOf() : 0;
        const dep = stop.departure ? new Date(stop.departure.time?.low).valueOf() : 0;
        const time = Math.max(arr, dep) * 1000;

        finalTrain.predictions.push({
          stationID: stop.stopId,
          stationName: staticStopsData[stop.stopId].stopName,
          actualETA: time,
          noETA: !time,
          realTime: true,
        });

        //adding stations to transitStatus object
        if (!transitStatus.stations[stop.stopId]) {
          transitStatus.stations[stop.stopId] = {
            stationID: stop.stopId,
            stationName: staticStopsData[stop.stopId].stopName,
            lat: staticStopsData[stop.stopId].stopLat,
            lon: staticStopsData[stop.stopId].stopLon,
            destinations: {
              'Inbound': { trains: [] },
              'Outbound': { trains: [] },
            },
          };
        }

        transitStatus.stations[stop.stopId].destinations[trainDirection].trains.push({
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

    // alerts
    transitStatus.alerts = alertsData.entity.map((alert) => {
      const lineCode = alert.alert.informedEntity.length > 0 ? (alert.alert.informedEntity[0].routeId ?? null) : null;
      const runNumber = alert.alert.informedEntity.length > 0 ? (alert.alert.informedEntity[0].trip?.tripId ?? null) : null;
      const stationID = alert.alert.informedEntity.length > 0 ? (alert.alert.informedEntity[0].stopId ?? null) : null;

      const additionalRunNumbers = Object.keys(transitStatus.trains).filter((trainID) => {
        const train = transitStatus.trains[trainID];
        const stopIDs = train.predictions.map((prediction) => prediction.stationID);
        if (lineCode == train.lineCode) return true;
        if (stopIDs.includes(stationID)) return true;
        return false;
      });

      const additionalStationIDs = Object.values(transitStatus.stations).filter((station) => {
        const stationLines = Object.values(staticRoutesData).filter((line) => line.routeStations.includes(station.stationID)).map((line) => line.routeID);
        const stationTrains = Object.values(station.destinations).flatMap((direction) => direction.trains);

        if (stationLines.includes(lineCode)) return true;
        if (stationTrains.includes(runNumber)) return true;
        return false;
      }).map((station) => station.stationID);

      return {
        id: alert.id,
        lineCode,
        runNumber,
        stationID,
        additionalRunNumbers,
        additionalStationIDs,
        title: alert.alert.headerText.translation[0].text,
        message: alert.alert.descriptionText.translation[0].text.replaceAll(/<[^>]*>/g, ' ').replaceAll('&nbsp;', ' ').replaceAll(/\s+/g, ' ').trim(),
      }
    });

    const lastUpdated = new Date().toISOString();

    transitStatus.lastUpdated = lastUpdated;

    Object.keys(scheduledVehicles)
      .sort((aTrip, bTrip) => {
        return scheduledVehicles[aTrip].predictions[0].actualETA - scheduledVehicles[bTrip].predictions[0].actualETA
      })
      .forEach((runNumber) => {
        const scheduledVehicle = scheduledVehicles[runNumber];

        if (transitStatus.trains[runNumber]) return; // train exists
        if (cancelledTrains[runNumber]) return; // cancelled - TODO handle this better
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
      transitStatus,
      lastUpdated: lastUpdated,
    }
  } catch (e) {
    console.log(e)
    return false;
  }
})

exports.update = update;