const protobuf = require("protobufjs");

const scheduleRelationshipEnums = {
  0: "SCHEDULED",
  2: "UNSCHEDULED",
  3: "CANCELED",
  4: "REPLACEMENT",
  5: "DUPLICATED",
  6: "NEW",
  7: "DELETED",
};

const update = async () => {
  const gtfsRealtimeRoot = await protobuf.load("gtfs-realtime-NYCT.proto");
  const FeedMessage = gtfsRealtimeRoot.lookupType(
    "transit_realtime.FeedMessage",
  );

  try {
    const fetchedFeeds = await Promise.all(
      [
        "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-ace",
        "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-g",
        "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-nqrw",
        "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs",
        "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-bdfm",
        "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-jz",
        "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-l",
        "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-si",
      ].map((url) =>
        fetch(url)
          .then((res) => res.arrayBuffer())
          .then((arrayBuffer) =>
            FeedMessage.decode(new Uint8Array(arrayBuffer)),
          ),
      ),
    );

    const mergedFeeds = fetchedFeeds.flatMap((feed) => feed.entity);
    const positionsData = mergedFeeds.filter((entity) => entity.vehicle);
    const tripUpdatesData = mergedFeeds.filter((entity) => entity.tripUpdate);

    let vehiclePositionsDict = {};
    positionsData.forEach((position) => {
      if (position.vehicle) {
        const id = position.vehicle?.trip['.transit_realtime.nyctTripDescriptor']?.trainId;
        console.log(position.vehicle?.trip['.transit_realtime.nyctTripDescriptor'])
        if (!id) {
          console.log(position.vehicle.trip)
          return;
        }
        if (position.vehicle.vehicle && position.vehicle.position) {
          vehiclePositionsDict[id] =
            position.vehicle.position;
        }
      }
    });

    const [staticStopsData, staticRoutesData] = await Promise.all(
      [
        "https://gtfs.piemadd.com/data/nyct_subway/stops.json",
        "https://gtfs.piemadd.com/data/nyct_subway/routes.json",
      ].map((url) => fetch(url).then((res) => res.json())),
    );

    let tsv1 = {
      trains: {},
      stations: {},
      lines: {},
      alerts: [],
    };

    Object.values(staticStopsData).forEach((stop) => {
      //adding stations to tsv1 object
      tsv1.stations[stop.stopID] = {
        stationID: stop.stopID,
        stationName: stop.stopName,
        lat: stop.stopLat,
        lon: stop.stopLon,
        destinations: {
          default: { trains: [] },
        },
      };
    });

    //adding trains to tsv1 object
    tripUpdatesData.forEach((train, i) => {
      const runNumber = train.tripUpdate.trip['.transit_realtime.nyctTripDescriptor'].trainId;
      //const isInbound = parseInt(trainNumber[0]) % 2 == 0;
      //const trainDirection = isInbound ? 'Inbound' : 'Outbound';
      const trainDirection = "default";

      const position = vehiclePositionsDict[runNumber] ?? {
        latitude: 0,
        longitude: 0,
        bearing: 0,
      };
      delete vehiclePositionsDict[train.tripUpdate?.vehicle?.id];

      let finalTrain = {
        lat: position.latitude,
        lon: position.longitude,
        heading: position.bearing,
        realTime: true,
        deadMileage: false,
        line: staticRoutesData[train.tripUpdate?.trip?.routeId].routeLongName,
        lineCode: train.tripUpdate?.trip?.routeId,
        lineColor: staticRoutesData[train.tripUpdate?.trip?.routeId].routeColor,
        lineTextColor:
          staticRoutesData[train.tripUpdate?.trip?.routeId].routeTextColor,
        dest: "Unknown Dest",
        predictions: [],
        type: "train",
        extra: {
          holidayChristmas: false,
          cabCar: null,
        },
      };

      //adding predictions to tsv1 object
      train.tripUpdate?.stopTimeUpdate?.reverse().filter((stop) => staticStopsData[stop.stopId]).forEach((stop, i) => {
        if (i == 0) finalTrain.dest = staticStopsData[stop.stopId].stopName;

        const arr = stop.arrival
          ? new Date(stop.arrival.time?.low).valueOf()
          : 0;
        const dep = stop.departure
          ? new Date(stop.departure.time?.low).valueOf()
          : 0;
        const time = Math.max(arr, dep) * 1000;

        finalTrain.predictions.push({
          stationID: stop.stopId,
          stationName: staticStopsData[stop.stopId].stopName,
          actualETA: time,
          noETA: !time,
          realTime: true,
        });

        tsv1.stations[stop.stopId].destinations[trainDirection].trains.push({
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
            holidayChristmas: false,
          },
        });
      });

      finalTrain.predictions = finalTrain.predictions.reverse();
      tsv1.trains[runNumber] = finalTrain;
    });
    /*
    Object.keys(vehiclePositionsDict).forEach((vehicleID) => {
      const position = vehiclePositionsDict[vehicleID] ?? {
        latitude: 0,
        longitude: 0,
        bearing: 0,
      };
      delete vehiclePositionsDict[vehicleID];

      tsv1.trains['DM-' + vehicleID] = {
        lat: position.latitude,
        lon: position.longitude,
        heading: position.bearing,
        realTime: false,
        deadMileage: true,
        line: 'METX',
        lineCode: 'METX',
        lineColor: '111111',
        lineTextColor: 'FFFFFF',
        dest: "Nowhere",
        predictions: [],
        type: 'train',
        extra: {
          holidayChristmas: holidayVehiclesArray.includes(vehicleID),
          cabCar: vehicleID,
          //scheduleRelationship: train.tripUpdate?.trip?.scheduleRelationship,
          //scheduleRelationshipEnum: scheduleRelationshipEnums[train.tripUpdate?.trip?.scheduleRelationship],
        }
      };
    });
    */

    //adding any stations without trains to tsv1 object
    Object.keys(staticRoutesData).forEach((routeID) => {
      const route = staticRoutesData[routeID];

      tsv1.lines[routeID] = {
        lineCode: routeID,
        lineNameShort: route.routeShortName,
        lineNameLong: route.routeLongName,
        routeColor: route.routeColor,
        routeTextColor: route.routeTextColor,
        stations: route.routeStations,
        hasActiveTrains: false,
      };

      route.routeStations.forEach((stationID) => {
        if (!tsv1.stations[stationID]) {
          tsv1.stations[stationID] = {
            stationID: stationID,
            stationName: staticStopsData[stationID].stopName,
            lat: staticStopsData[stationID].stopLat,
            lon: staticStopsData[stationID].stopLon,
            destinations: {
              default: { trains: [] },
            },
          };
        }
      });
    });

    Object.keys(tsv1.trains).forEach((train) => {
      const trainData = tsv1.trains[train];

      if (tsv1.lines[trainData.lineCode])
        tsv1.lines[trainData.lineCode].hasActiveTrains = true;
    });

    // alerts
    /*
    tsv1.alerts = alertsData.map((alert) => {
      const lineCode = alert.alert.informedEntity.length > 0 ? (alert.alert.informedEntity[0].routeId ?? null) : null;
      const runNumber = alert.alert.informedEntity.length > 0 ? (alert.alert.informedEntity[0].trip?.tripId ?? null) : null;
      const stationID = alert.alert.informedEntity.length > 0 ? (alert.alert.informedEntity[0].stopId ?? null) : null;

      const additionalRunNumbers = Object.keys(tsv1.trains).filter((trainID) => {
        const train = tsv1.trains[trainID];
        const stopIDs = train.predictions.map((prediction) => prediction.stationID);
        if (lineCode == train.lineCode) return true;
        if (stopIDs.includes(stationID)) return true;
        return false;
      });

      const additionalStationIDs = Object.values(tsv1.stations).filter((station) => {
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
    */

    const lastUpdated = new Date().toISOString();

    tsv1.lastUpdated = lastUpdated;

    return {
      tsv1,
      vehiclePositionsDict,
      lastUpdated: lastUpdated,
    };
  } catch (e) {
    console.log(e);
    return false;
  }
};

exports.update = update;
