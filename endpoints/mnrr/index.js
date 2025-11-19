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
  const tzOffset = getTzOffset();

  let cancelledTrains = {};

  try {
    const [
      tripUpdatesData,
      alertsData,
    ] = await Promise.all([
      `https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/mnr%2Fgtfs-mnr`,
      `https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/camsys%2Fmnr-alerts`,
    ].map((url) =>
      fetch(url).then(res => res.arrayBuffer()).then(arrayBuffer => FeedMessage.decode(new Uint8Array(arrayBuffer)))
    ));

    const [
      staticStopsData,
      staticRoutesData,
      scheduledVehicles,
      holidayVehicles,
    ] = await Promise.all([
      'https://gtfs.piemadd.com/data/mnrr/stops.json',
      'https://gtfs.piemadd.com/data/mnrr/routes.json',
      'http://localhost:3000/gtfs_sch/mnrr/scheduledVehicles',
      `https://gks.pgm.sh/api/v1/mnrr_christmas_sets?t=${Date.now()}`
    ].map((url) =>
      fetch(url).then(res => res.json())
    ));

    let trainConsists = {};

    const secretRadarData = await fetch("https://backend-unified.mylirr.org/locations?geometry=TRACK_TURF&railroad=MNR", {
      "credentials": "omit",
      "headers": {
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.5",
        "Accept-Version": "3.0",
      }
    }).then((res) => res.json());

    secretRadarData.forEach((train) => {
      trainConsists[train.train_num] = train.consist.cars;
    })

    const holidayVehiclesArray = holidayVehicles.error ? [] : holidayVehicles.response.object;

    let transitStatus = {
      trains: {},
      stations: {},
      lines: {},
      alerts: [],
    };

    Object.values(staticStopsData).forEach((stop) => {
      //adding stations to transitStatus object
      transitStatus.stations[stop.stopID] = {
        stationID: stop.stopID,
        stationName: stop.stopName,
        lat: stop.stopLat,
        lon: stop.stopLon,
        destinations: {
          'Outbound': { trains: [] },
          'Inbound': { trains: [] },
        },
      };
    })

    //adding trains to transitStatus object
    tripUpdatesData.entity.forEach((train, i) => {

      const trainNumber = train.vehicle?.vehicle?.id;
      if (!trainNumber) return; //no train ig

      const tripStartTime = startTimeAndDateToDate(train.tripUpdate.trip.startDate, train.tripUpdate.trip.startTime, tzOffset);

      const isScheduled = lastUpdatedUnix + (1000 * 60 * 2) < tripStartTime.valueOf();

      const runNumber = trainNumber;
      const isOutbound = parseInt(trainNumber) % 2 == 0;
      const trainDirection = isOutbound ? 'Outbound' : 'Inbound';

      if (train.tripUpdate?.trip?.scheduleRelationship == 3) {
        cancelledTrains[trainNumber] = true;
        return;
      }

      const position = train.vehicle.position ?? {
        latitude: 0,
        longitude: 0,
      };

      const consist = trainConsists[trainNumber] ?? [];
      const consistBasic = consist.map((car) => (car.number ?? 0).toString());
      const isHolidayChristmas = crossCheckTwoArrays(holidayVehiclesArray, consistBasic);

      const leadingCar = consist.length > 0 ? consist[0] : null;

      let finalTrain = {
        lat: position.latitude,
        lon: position.longitude,
        heading: 0, // MNRR doesnt have heading data
        realTime: !isScheduled,
        deadMileage: false,
        line: staticRoutesData[train.tripUpdate?.trip?.routeId].routeLongName,
        lineCode: train.tripUpdate?.trip?.routeId,
        lineColor: staticRoutesData[train.tripUpdate?.trip?.routeId].routeColor,
        lineTextColor: staticRoutesData[train.tripUpdate?.trip?.routeId].routeTextColor,
        dest: "Unknown Dest",
        predictions: [],
        type: 'train',
        extra: {
          holidayChristmas: isHolidayChristmas,
          cabCar: leadingCar && !leadingCar.locomotive ? leadingCar.number : null,
          engine: leadingCar && leadingCar.locomotive ? leadingCar.number : null,
          consist,
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
          realTime: !isScheduled,
        });

        transitStatus.stations[stop.stopId].destinations[trainDirection].trains.push({
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
      transitStatus.trains[runNumber] = finalTrain;
    });

    //adding any stations without trains to transitStatus object
    Object.keys(staticRoutesData).forEach((routeID) => {
      const route = staticRoutesData[routeID];

      transitStatus.lines[routeID] = {
        lineCode: routeID,
        lineNameShort: route.routeLongName,
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
              'Outbound': { trains: [] },
              'Inbound': { trains: [] },
            },
          };
        }
      });
    });

    Object.keys(transitStatus.trains).forEach((train) => {
      const trainData = transitStatus.trains[train];

      if (!trainData.realTime) return;

      if (transitStatus.lines[trainData.lineCode]) transitStatus.lines[trainData.lineCode].hasActiveTrains = true;
    });

    // removing scheduled trains from stations if theres too many
    Object.keys(transitStatus.stations).forEach((stationKey) => {
      Object.keys(transitStatus.stations[stationKey].destinations).forEach((destination) => {
        transitStatus.stations[stationKey].destinations[destination].trains = transitStatus.stations[stationKey].destinations[destination].trains
          .sort((a, b) => a.actualETA - b.actualETA)
          .filter((train, i) => i <= 12 || train.realTime)
      })
    })

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

    transitStatus.lastUpdated = lastUpdated;

    Object.keys(scheduledVehicles)
      .sort((aTrip, bTrip) => {
        return scheduledVehicles[aTrip].predictions[0].actualETA - scheduledVehicles[bTrip].predictions[0].actualETA
      })
      .forEach((runNumber) => {
        const scheduledVehicle = scheduledVehicles[runNumber];

        if (transitStatus.trains[runNumber]) return; // train exists
        console.log('train')
        if (cancelledTrains[runNumber]) return; // cancelled - TODO handle this better
        transitStatus.trains[runNumber] = scheduledVehicle;

        const trainDirection = parseInt(runNumber) % 2 == 0 ? 'Outbound' : 'Inbound';

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