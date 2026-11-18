const protobuf = require("protobufjs");

require("dotenv").config();

// checks to see if there is a shared element in either of the arrays
const crossCheckTwoArrays = (array1, array2) => {
  return array1.some((element) => array2.includes(element));
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
  return new Date(
    `${startDate.substring(0, 4)}-${startDate.substring(4, 6)}-${startDate.substring(6, 8)}T${startTime}${timeZone}`
  );
};

const update = async () => {
  const gtfsRealtimeRoot = await protobuf.load("gtfs-realtime-MTARR.proto");
  const FeedMessage = gtfsRealtimeRoot.lookupType("transit_realtime.FeedMessage");

  const lastUpdatedDate = new Date();
  const lastUpdatedUnix = lastUpdatedDate.valueOf();
  const lastUpdated = lastUpdatedDate.toISOString();

  let cancelledTrains = {};

  try {
    const [tripUpdatesData, vehiclePositionsData, alertsData] = await Promise.all(
      [
        `https://cdn.mbta.com/realtime/TripUpdates.pb`,
        `https://cdn.mbta.com/realtime/VehiclePositions.pb`,
        `https://cdn.mbta.com/realtime/Alerts.pb`
      ].map((url) =>
        fetch(url)
          .then((res) => res.arrayBuffer())
          .then((arrayBuffer) => FeedMessage.decode(new Uint8Array(arrayBuffer)))
      )
    );

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

    const [staticStopsData, staticRoutesData, busSchData, subwaySchData, crSchData, ferrySchData] = await Promise.all(
      [
        "https://gtfs.piemadd.com/data/mbta/stops.json",
        "https://gtfs.piemadd.com/data/mbta/routes.json",
        "http://localhost:3000/gtfs_sch_acc/mbta_bus/scheduledVehicles",
        "http://localhost:3000/gtfs_sch_acc/mbta_subway/scheduledVehicles",
        "http://localhost:3000/gtfs_sch_acc/mbta_cr/scheduledVehicles",
        "http://localhost:3000/gtfs_sch_acc/mbta_ferry/scheduledVehicles"
      ].map((url) => fetch(url).then((res) => res.json()))
    );

    const feeds = [
      { name: "buses", types: ["3"], scheduled: busSchData },
      { name: "trains", types: ["0", "1", "2"], scheduled: { ...subwaySchData, ...crSchData } },
      { name: "ferries", types: ["4"], scheduled: ferrySchData }
    ];

    const shouldUseTrainNumber = { 2: true };
    const shouldUseDirections = { 2: true };
    const shouldUseSchedules = { 2: true };

    const processFeed = (routeTypes, scheduledVehicles, disabled) => {
      let transitStatusV1 = { trains: {}, stations: {}, lines: {}, alerts: [] };

      if (disabled) return transitStatusV1;

      // adding routes and stations
      Object.values(staticRoutesData)
        .filter((route) => routeTypes.includes(route.routeType))
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
            //adding stations to transitStatusV1 object
            if (!transitStatusV1.stations[stopID]) {
              const stop = staticStopsData[stopID];
              transitStatusV1.stations[stopID] = {
                stationID: stopID,
                stationName: stop.stopName,
                lat: stop.stopLat,
                lon: stop.stopLon,
                destinations: {}
              };
            }

            //adding destinatons
            if (shouldUseDirections[route.routeType]) {
              transitStatusV1.stations[stopID].destinations["Inbound"] = { trains: [] };
              transitStatusV1.stations[stopID].destinations["Outbound"] = { trains: [] };
            } else {
              route.destinations.forEach((destination) => {
                transitStatusV1.stations[stopID].destinations[destination] = { trains: [] };
              });
            }
          });
        });

      //adding trains to transitStatusV1 object
      tripUpdatesData.entity.forEach((train, i) => {
        if (train.vehicle) return; // position

        const trainRoute = staticRoutesData[train.tripUpdate?.trip?.routeId];

        if (!transitStatusV1.lines[trainRoute.routeID]) return; // route doesn't exist, likely wrong type

        const runNumber = shouldUseTrainNumber[trainRoute.routeType]
          ? train.tripUpdate?.trip?.tripId.split("_")[2]
          : (vehicleTripToLabel[train.tripUpdate?.trip?.tripId] ?? train.tripUpdate?.trip?.tripId);
        if (!runNumber) return;

        const trainDestination =
          trainRoute.routeTrips[train.tripUpdate?.trip?.tripId]?.headsign ??
          (train.tripUpdate?.stopTimeUpdate?.at(-1)?.stopId
            ? staticStopsData[train.tripUpdate?.stopTimeUpdate?.at(-1)?.stopId].stopName
            : "Unknown");
        const trainDirection = shouldUseDirections[trainRoute.routeType]
          ? parseInt(runNumber) % 2 == 0
            ? "Inbound"
            : "Outbound"
          : trainDestination;

        if (train.tripUpdate?.trip?.scheduleRelationship == 3) {
          cancelledTrains[runNumber] = true;
          return;
        }

        const position = vehiclePositionsDict[vehicleTripToLabel[train.tripUpdate?.trip?.tripId]] ?? {
          latitude: 0,
          longitude: 0,
          bearing: 0,
          fake: true,
        };

        if (!position.fake) {
          //console.log(trainRoute.routeType, vehicleTripToLabel[train.tripUpdate?.trip?.tripId])
        } else {
          //console.log('FAKE', trainRoute.routeType, vehicleTripToLabel[train.tripUpdate?.trip?.tripId])
        }

        delete vehiclePositionsDict[vehicleTripToLabel[train.tripUpdate?.trip?.tripId]];

        const isScheduled = position.latitude == 0 && position.longitude == 0 && position.bearing == 0;

        let finalTrain = {
          lat: position.latitude,
          lon: position.longitude,
          heading: position.bearing,
          realTime: !isScheduled,
          deadMileage: isScheduled,
          line: trainRoute.routeLongName,
          lineCode: train.tripUpdate?.trip?.routeId,
          lineColor: trainRoute.routeColor,
          lineTextColor: trainRoute.routeTextColor,
          dest: trainDestination,
          predictions: [],
          type: "train",
          extra: { holidayChristmas: false, cabCar: null, engine: null }
        };

        let trainHasValidStops = false; // gauging whether we can remove noeta stops

        //adding predictions to transitStatusV1 object
        train.tripUpdate?.stopTimeUpdate?.reverse().forEach((stop, i) => {
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
            realTime: !isScheduled
          });

          if (transitStatusV1.stations[stop.stopId]) {
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
              extra: {}
            });
          }
        });

        finalTrain.predictions = finalTrain.predictions.reverse();
        transitStatusV1.trains[runNumber] = finalTrain;
      });

      Object.keys(vehiclePositionsDict).forEach((vehicleID) => {
        //console.log(vehicleID)
        return; // need to look into ids first

        const position = vehiclePositionsDict[vehicleID] ?? { latitude: 0, longitude: 0, bearing: 0 };
        delete vehiclePositionsDict[vehicleID];

        let finalTrain = {
          lat: position.latitude,
          lon: position.longitude,
          heading: position.bearing,
          realTime: false,
          deadMileage: true,
          line: "Dead Mileage",
          lineCode: "DEADMILEAGE",
          lineColor: "111111",
          lineTextColor: "FFFFFF",
          dest: "Nowhere",
          predictions: [],
          type: "train",
          extra: { holidayChristmas: false, cabCar: vehicleID }
        };

        transitStatusV1.trains["DM-" + vehicleID] = finalTrain;
      });

      Object.keys(transitStatusV1.trains).forEach((train) => {
        const trainData = transitStatusV1.trains[train];

        if (transitStatusV1.lines[trainData.lineCode]) transitStatusV1.lines[trainData.lineCode].hasActiveTrains = true;
      });

      // alerts
      transitStatusV1.alerts = alertsData.entity.map((alert) => {
        const lineCode = alert.alert.informedEntity.length > 0 ? (alert.alert.informedEntity[0].routeId ?? null) : null;
        const runNumber =
          alert.alert.informedEntity.length > 0 ? (alert.alert.informedEntity[0].trip?.tripId ?? null) : null;
        const stationID = alert.alert.informedEntity.length > 0 ? (alert.alert.informedEntity[0].stopId ?? null) : null;

        const additionalRunNumbers = Object.keys(transitStatusV1.trains).filter((trainID) => {
          const train = transitStatusV1.trains[trainID];
          const stopIDs = train.predictions.map((prediction) => prediction.stationID);
          if (lineCode == train.lineCode) return true;
          if (stopIDs.includes(stationID)) return true;
          return false;
        });

        const additionalStationIDs = Object.values(transitStatusV1.stations)
          .filter((station) => {
            const stationLines = Object.values(staticRoutesData)
              .filter((line) => line.routeStations.includes(station.stationID))
              .map((line) => line.routeID);
            const stationTrains = Object.values(station.destinations).flatMap((direction) => direction.trains);

            if (stationLines.includes(lineCode)) return true;
            if (stationTrains.includes(runNumber)) return true;
            return false;
          })
          .map((station) => station.stationID);

        return {
          id: alert.id,
          lineCode,
          runNumber,
          stationID,
          additionalRunNumbers,
          additionalStationIDs,
          title: alert.alert.headerText.translation[0].text,
          message: (alert.alert.descriptionText ?? { translation: [{ text: "" }] }).translation[0].text
            .replaceAll(/<[^>]*>/g, " ")
            .replaceAll("&nbsp;", " ")
            .replaceAll(/\s+/g, " ")
            .trim()
        };
      });

      transitStatusV1.lastUpdated = lastUpdated;

      Object.keys(scheduledVehicles)
        .sort((aTrip, bTrip) => {
          return scheduledVehicles[aTrip].predictions[0].actualETA - scheduledVehicles[bTrip].predictions[0].actualETA;
        })
        .forEach((runNumber) => {
          const scheduledVehicle = scheduledVehicles[runNumber];

          if (transitStatusV1.trains[runNumber]) return; // train exists
          if (cancelledTrains[runNumber]) return; // cancelled - TODO handle this better
          transitStatusV1.trains[runNumber] = scheduledVehicle;

          const routeType = staticRoutesData[scheduledVehicle.lineCode].routeType;

          if (!shouldUseSchedules[routeType]) return;

          const trainDirection = shouldUseDirections[routeType]
            ? parseInt(runNumber) % 2 == 0
              ? "Inbound"
              : "Outbound"
            : scheduledVehicle.dest;

          scheduledVehicle.predictions.forEach((stop) => {
            //adding stations to transitStatusV1 object
            if (!transitStatusV1.stations[stop.stationID]) return; // this is probably a bus or something
            if (!transitStatusV1.stations[stop.stationID].destinations[trainDirection]) return; // edge case with stations?

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
              extra: {}
            });
          });
        });

      return transitStatusV1;
    };

    const [busFeed, trainFeed, ferryFeed] = feeds.map((feed) => {
      return processFeed(feed.types, feed.scheduled, feed.name == "buses");
    });

    return { tsBusV1: busFeed, tsV1: trainFeed, tsFerryV1: ferryFeed, lastUpdated: lastUpdated };
  } catch (e) {
    console.log(e);
    return false;
  }
};

exports.update = update;
