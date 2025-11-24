const protobuf = require('protobufjs');

require('dotenv').config();

const scheduleRelationshipEnums = {
  0: 'SCHEDULED',
  2: 'UNSCHEDULED',
  3: 'CANCELED',
  4: 'REPLACEMENT',
  5: 'DUPLICATED',
  6: 'NEW',
  7: 'DELETED',
}

// checks to see if there is a shared element in either of the arrays
const crossCheckTwoArrays = (array1, array2) => {
  return array1.some(element => array2.includes(element));
};

const getTzOffset = () => {
  const tzOffsets = ["-05:00", "-04:00"];
  const now = new Date();
  const nowYear = now.getFullYear();
  let dst_start = new Date(nowYear, 2, 14);
  let dst_end = new Date(nowYear, 10, 7);
  dst_start.setDate(14 - dst_start.getDay()); // adjust date to 2nd Sunday
  dst_end.setDate(7 - dst_end.getDay()); // adjust date to the 1st Sunday
  const isDST = Number(now >= dst_start && now < dst_end);
  return tzOffsets[isDST];
};

const startTimeAndDateToDate = (startDate, startTime, timeZone) => {
  return new Date(`${startDate.substring(0, 4)}-${startDate.substring(4, 6)}-${startDate.substring(6, 8)}T${startTime}${timeZone}`)
};

const update = (async () => {
  const gtfsRealtimeRoot = await protobuf.load('gtfs-realtime-MTARR.proto');
  const FeedMessage = gtfsRealtimeRoot.lookupType('transit_realtime.FeedMessage');

  const lastUpdatedDate = new Date();
  const lastUpdatedUnix = lastUpdatedDate.valueOf();
  const lastUpdated = lastUpdatedDate.toISOString();

  let cancelledTrains = {};

  try {
    const [
      tripUpdatesData,
      vehiclePositionsData,
      alertsData,
    ] = await Promise.all([
      `https://cdn.mbta.com/realtime/TripUpdates.pb`,
      `https://cdn.mbta.com/realtime/VehiclePositions.pb`,
      `https://cdn.mbta.com/realtime/Alerts.pb`,
    ].map((url) =>
      fetch(url).then(res => res.arrayBuffer()).then(arrayBuffer => FeedMessage.decode(new Uint8Array(arrayBuffer)))
    ));

    let vehiclePositionsDict = {};
    let vehicleTripToLabel = {};
    vehiclePositionsData.entity.forEach((position) => {
      if (position.vehicle) {
        if (position.vehicle.trip) {
          vehicleTripToLabel[position.vehicle.trip.tripId] = position.vehicle.vehicle.label;
        }

        if (position.vehicle.vehicle && position.vehicle.position) {
          vehiclePositionsDict[position.vehicle.vehicle.label] = position.vehicle.position;
        }
      }
    });

    const [
      staticStopsData,
      staticRoutesData,
      scheduledVehicles,
    ] = await Promise.all([
      'https://gtfs.piemadd.com/data/mbta/stops.json',
      'https://gtfs.piemadd.com/data/mbta/routes.json',
      'http://localhost:3000/gtfs_sch/mbta/scheduledVehicles',
    ].map((url) =>
      fetch(url).then(res => res.json())
    ));

    let transitStatusV1 = {
      trains: {},
      stations: {},
      lines: {},
      alerts: [],
    };

    // adding routes and stations
    Object.values(staticRoutesData)
    .filter((route) => route.routeType != '3')
    .forEach((route) => {

      transitStatusV1.lines[route.routeID] = {
        lineCode: route.routeID,
        lineNameShort: route.routeLongName,
        lineNameLong: route.routeLongName,
        routeColor: route.routeColor,
        routeTextColor: route.routeTextColor,
        stations: route.routeStations,
        hasActiveTrains: false
      };

      route.routeStations.forEach((stopID) => {
        if (transitStatusV1.stations[stopID]) return;
        const stop = staticStopsData[stopID];
        //adding stations to transitStatusV1 object
        transitStatusV1.stations[stopID] = {
          stationID: stopID,
          stationName: stop.stopName,
          lat: stop.stopLat,
          lon: stop.stopLon,
          destinations: {
            'Eastbound': { trains: [] },
            'Westbound': { trains: [] },
          },
        };
      });
    });

    //adding trains to transitStatusV1 object
    tripUpdatesData.entity.forEach((train, i) => {
      if (train.vehicle) return; // position

      const trainNumber = train.tripUpdate?.trip?.tripId.split('_')[2];
      if (!trainNumber) return; //no train ig

      const runNumber = trainNumber;
      const isEastbound = parseInt(trainNumber) % 2 == 0;
      const trainDirection = isEastbound ? 'Eastbound' : 'Westbound';

      if (train.tripUpdate?.trip?.scheduleRelationship == 3) {
        cancelledTrains[trainNumber] = true;
        return;
      }

      const position = vehiclePositionsDict[train?.tripUpdate?.trip?.tripId] ?? {
        latitude: 0,
        longitude: 0,
        bearing: 0,
      };
      delete vehiclePositionsDict[train?.tripUpdate?.trip?.tripId];

      const isScheduled = (position.latitude == 0 && position.longitude == 0 && position.bearing == 0);

      const isHolidayChristmas = false; //holidayVehiclesArray.includes(position.label) || crossCheckTwoArrays(holidayVehiclesArray, consistBasic);

      let finalTrain = {
        lat: position.latitude,
        lon: position.longitude,
        heading: position.bearing,
        realTime: !isScheduled,
        deadMileage: isScheduled,
        line: staticRoutesData[train.tripUpdate?.trip?.routeId].routeLongName,
        lineCode: train.tripUpdate?.trip?.routeId,
        lineColor: staticRoutesData[train.tripUpdate?.trip?.routeId].routeColor,
        lineTextColor: staticRoutesData[train.tripUpdate?.trip?.routeId].routeTextColor,
        dest: "Unknown Dest",
        predictions: [],
        type: 'train',
        extra: {
          holidayChristmas: false,
          cabCar: null,
          engine: null,
          scheduleRelationship: train.tripUpdate?.trip?.scheduleRelationship,
          scheduleRelationshipEnum: scheduleRelationshipEnums[train.tripUpdate?.trip?.scheduleRelationship],
        }
      };

      let trainHasValidStops = false; // gauging whether we can remove noeta stops

      //adding predictions to transitStatusV1 object
      train.tripUpdate?.stopTimeUpdate?.reverse().forEach((stop, i) => {
        if (i == 0) finalTrain.dest = staticStopsData[stop.stopId].stopName;

        const arr = stop.arrival ? new Date(stop.arrival.time?.low).valueOf() : 0;
        const dep = stop.departure ? new Date(stop.departure.time?.low).valueOf() : 0;
        const time = Math.max(arr, dep) * 1000;

        // stops are done in reverse order, which is why we can filter as we go instead of 
        // checking and then filtering later
        if (time) trainHasValidStops = true;
        else if (trainHasValidStops) return;

        finalTrain.predictions.push({
          stationID: stop.stopId,
          stationName: staticStopsData[stop.stopId].stopName,
          actualETA: time,
          noETA: !time,
          realTime: !isScheduled,
        });

        transitStatusV1.stations[stop.stopId].destinations[trainDirection].trains.push({
          runNumber: runNumber,
          actualETA: time,
          noETA: !time,
          realTime: !isScheduled,
          line: finalTrain.line,
          lineCode: finalTrain.lineCode,
          lineColor: finalTrain.lineColor,
          lineTextColor: finalTrain.lineTextColor,
          destination: finalTrain.dest,
          extra: {
            holidayChristmas: isHolidayChristmas,
          }
        });
      });

      finalTrain.predictions = finalTrain.predictions.reverse();
      transitStatusV1.trains[runNumber] = finalTrain;
    });

    Object.keys(vehiclePositionsDict).forEach((vehicleID) => {
      const position = vehiclePositionsDict[vehicleID] ?? {
        latitude: 0,
        longitude: 0,
        bearing: 0,
      };
      delete vehiclePositionsDict[vehicleID];

      let finalTrain = {
        lat: position.latitude,
        lon: position.longitude,
        heading: position.bearing,
        realTime: false,
        deadMileage: true,
        line: 'Dead Mileage',
        lineCode: 'DEADMILEAGE',
        lineColor: '111111',
        lineTextColor: 'FFFFFF',
        dest: "Nowhere",
        predictions: [],
        type: 'train',
        extra: {
          holidayChristmas: false,
          cabCar: vehicleID,
          //scheduleRelationship: train.tripUpdate?.trip?.scheduleRelationship,
          //scheduleRelationshipEnum: scheduleRelationshipEnums[train.tripUpdate?.trip?.scheduleRelationship],
        }
      };

      transitStatusV1.trains['DM-' + vehicleID] = finalTrain;
    });

    Object.keys(transitStatusV1.trains).forEach((train) => {
      const trainData = transitStatusV1.trains[train];

      if (transitStatusV1.lines[trainData.lineCode]) transitStatusV1.lines[trainData.lineCode].hasActiveTrains = true;
    });

    // alerts
    transitStatusV1.alerts = alertsData.entity.map((alert) => {
      const lineCode = alert.alert.informedEntity.length > 0 ? (alert.alert.informedEntity[0].routeId ?? null) : null;
      const runNumber = alert.alert.informedEntity.length > 0 ? (alert.alert.informedEntity[0].trip?.tripId ?? null) : null;
      const stationID = alert.alert.informedEntity.length > 0 ? (alert.alert.informedEntity[0].stopId ?? null) : null;

      const additionalRunNumbers = Object.keys(transitStatusV1.trains).filter((trainID) => {
        const train = transitStatusV1.trains[trainID];
        const stopIDs = train.predictions.map((prediction) => prediction.stationID);
        if (lineCode == train.lineCode) return true;
        if (stopIDs.includes(stationID)) return true;
        return false;
      });

      const additionalStationIDs = Object.values(transitStatusV1.stations).filter((station) => {
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
        message: (alert.alert.descriptionText ?? { translation: [{ text: '' }] }).translation[0].text.replaceAll(/<[^>]*>/g, ' ').replaceAll('&nbsp;', ' ').replaceAll(/\s+/g, ' ').trim(),
      }
    });

    transitStatusV1.lastUpdated = lastUpdated;

    Object.keys(scheduledVehicles)
      .sort((aTrip, bTrip) => {
        return scheduledVehicles[aTrip].predictions[0].actualETA - scheduledVehicles[bTrip].predictions[0].actualETA
      })
      .forEach((runNumber) => {
        const scheduledVehicle = scheduledVehicles[runNumber];

        if (transitStatusV1.trains[runNumber]) return; // train exists
        if (cancelledTrains[runNumber]) return; // cancelled - TODO handle this better
        transitStatusV1.trains[runNumber] = scheduledVehicle;

        const trainDirection = parseInt(runNumber) % 2 == 0 ? 'Eastbound' : 'Westbound';

        scheduledVehicle.predictions.forEach((stop) => {
          //adding stations to transitStatusV1 object
          if (!transitStatusV1.stations[stop.stationID]) {
            transitStatusV1.stations[stop.stationID] = {
              stationID: stop.stationID,
              stationName: staticStopsData[stop.stationID].stopName,
              lat: staticStopsData[stop.stationID].stopLat,
              lon: staticStopsData[stop.stationID].stopLon,
              destinations: {
                'Eastbound': { trains: [] },
                'Westbound': { trains: [] },
              },
            };
          };

          if (transitStatusV1.stations[stop.stationID].destinations[trainDirection].trains.length > 12) return; // too much!

          transitStatusV1.stations[stop.stationID].destinations[trainDirection].trains.push({
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
      v1: transitStatusV1,
      lastUpdated: lastUpdated,
    }
  } catch (e) {
    console.log(e)
    return false;
  }
})

exports.update = update;