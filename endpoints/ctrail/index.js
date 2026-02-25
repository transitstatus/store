require("dotenv").config();

const trainNumberRegex = new RegExp(/\d+/);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
  let cancelledTrains = {};

  const totallyRealUserFetch = (url) =>
    fetch(url, {
      credentials: "omit",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:147.0) Gecko/20100101 Firefox/147.0",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Upgrade-Insecure-Requests": "1",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "cross-site",
        "If-Modified-Since": "Wed, 25 Feb 2026 01:30:43 GMT",
        "If-None-Match": '"b718b95bf6a5dc1:0"',
        Priority: "u=0, i",
      },
    });

  try {
    const tripUpdatesDataRaw = await totallyRealUserFetch(
      "https://cttprdtmgtfs.ctttrpcloud.com/TMGTFSRealTimeWebService/TripUpdate/TripUpdates.json",
    ).then((res) => res.text());
    await sleep(100);
    const positionsDataRaw = await totallyRealUserFetch(
      "https://cttprdtmgtfs.ctttrpcloud.com/TMGTFSRealTimeWebService/Vehicle/VehiclePositions.json",
    ).then((res) => res.text());
    await sleep(100);
    const alertsDataRaw = await totallyRealUserFetch(
      "https://cttprdtmgtfs.ctttrpcloud.com/TMGTFSRealTimeWebService/Alert/Alerts.json",
    ).then((res) => res.text());

    console.log(`tripUpdatesDataRaw: "${tripUpdatesDataRaw}"`);
    console.log(`positionsDataRaw: "${positionsDataRaw}"`);
    console.log(`alertsDataRaw: "${alertsDataRaw}"`);

    const [tripUpdatesData, positionsData] = [
      tripUpdatesDataRaw,
      positionsDataRaw,
    ].map((raw) => JSON.parse(raw));

    let vehiclePositionsDict = {};
    positionsData.entity.forEach((position) => {
      if (position.vehicle) {
        if (position.vehicle.vehicle && position.vehicle.position) {
          vehiclePositionsDict[position.vehicle.vehicle.id] =
            position.vehicle.position;
        }
      }
    });

    const [
      staticStopsData,
      staticRoutesData,
      scheduledVehicles,
      //holidayVehicles,
    ] = await Promise.all(
      [
        "https://gtfs.piemadd.com/data/ctrail_hartford/stops.json",
        "https://gtfs.piemadd.com/data/ctrail_hartford/routes.json",
        "http://localhost:3000/gtfs_sch_acc/ctrail_hartford/scheduledVehicles",
        //`https://gks.pgm.sh/api/v1/metra_christmas_sets?t=${Date.now()}`
      ].map((url) => fetch(url).then((res) => res.json())),
    );

    const holidayVehiclesArray = []; //holidayVehicles.error ? [] : holidayVehicles.response.object;

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
          Inbound: { trains: [] },
          Outbound: { trains: [] },
        },
      };
    });

    //adding trains to transitStatus object
    tripUpdatesData.entity.forEach((train, i) => {
      const trainNumber =
        train.tripUpdate?.trip?.tripId.match(trainNumberRegex);
      if (!trainNumber) return; //no train ig

      const runNumber = `${train.tripUpdate?.trip?.routeId.replaceAll("-", "")}-${trainNumber[0]}`;
      const isInbound = parseInt(trainNumber[0]) % 2 == 0;
      const trainDirection = isInbound ? "Inbound" : "Outbound";

      if (train.tripUpdate?.trip?.scheduleRelationship == 3) {
        cancelledTrains[trainNumber] = true;
        return;
      }

      const position = vehiclePositionsDict[train.tripUpdate?.vehicle?.id] ?? {
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
          holidayChristmas: holidayVehiclesArray.includes(
            train.tripUpdate?.vehicle?.id,
          ),
          cabCar: train.tripUpdate?.vehicle?.id,
          scheduleRelationship: train.tripUpdate?.trip?.scheduleRelationship,
          scheduleRelationshipEnum:
            scheduleRelationshipEnums[
              train.tripUpdate?.trip?.scheduleRelationship
            ],
        },
      };

      //adding predictions to transitStatus object
      train.tripUpdate?.stopTimeUpdate?.reverse().forEach((stop, i) => {
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

        transitStatus.stations[stop.stopId].destinations[
          trainDirection
        ].trains.push({
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
            holidayChristmas: holidayVehiclesArray.includes(
              train.tripUpdate?.vehicle?.id,
            ),
          },
        });
      });

      finalTrain.predictions = finalTrain.predictions.reverse();
      transitStatus.trains[runNumber] = finalTrain;
    });

    Object.keys(vehiclePositionsDict).forEach((vehicleID) => {
      const position = vehiclePositionsDict[vehicleID] ?? {
        latitude: 0,
        longitude: 0,
        bearing: 0,
      };
      delete vehiclePositionsDict[vehicleID];

      transitStatus.trains["DM-" + vehicleID] = {
        lat: position.latitude,
        lon: position.longitude,
        heading: position.bearing,
        realTime: false,
        deadMileage: true,
        line: "METX",
        lineCode: "METX",
        lineColor: "111111",
        lineTextColor: "FFFFFF",
        dest: "Nowhere",
        predictions: [],
        type: "train",
        extra: {
          holidayChristmas: holidayVehiclesArray.includes(vehicleID),
          cabCar: vehicleID,
          //scheduleRelationship: train.tripUpdate?.trip?.scheduleRelationship,
          //scheduleRelationshipEnum: scheduleRelationshipEnums[train.tripUpdate?.trip?.scheduleRelationship],
        },
      };
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
        hasActiveTrains: false,
      };

      route.routeStations.forEach((stationID) => {
        if (!transitStatus.stations[stationID]) {
          transitStatus.stations[stationID] = {
            stationID: stationID,
            stationName: staticStopsData[stationID].stopName,
            lat: staticStopsData[stationID].stopLat,
            lon: staticStopsData[stationID].stopLon,
            destinations: {
              Inbound: { trains: [] },
              Outbound: { trains: [] },
            },
          };
        }
      });
    });

    Object.keys(transitStatus.trains).forEach((train) => {
      const trainData = transitStatus.trains[train];

      if (transitStatus.lines[trainData.lineCode])
        transitStatus.lines[trainData.lineCode].hasActiveTrains = true;
    });

    /*
    // alerts
    transitStatus.alerts = alertsData.entity.map((alert) => {
      const lineCode =
        alert.alert.informedEntity.length > 0
          ? (alert.alert.informedEntity[0].routeId ?? null)
          : null;
      const runNumber =
        alert.alert.informedEntity.length > 0
          ? (alert.alert.informedEntity[0].trip?.tripId ?? null)
          : null;
      const stationID =
        alert.alert.informedEntity.length > 0
          ? (alert.alert.informedEntity[0].stopId ?? null)
          : null;

      const additionalRunNumbers = Object.keys(transitStatus.trains).filter(
        (trainID) => {
          const train = transitStatus.trains[trainID];
          const stopIDs = train.predictions.map(
            (prediction) => prediction.stationID,
          );
          if (lineCode == train.lineCode) return true;
          if (stopIDs.includes(stationID)) return true;
          return false;
        },
      );

      const additionalStationIDs = Object.values(transitStatus.stations)
        .filter((station) => {
          const stationLines = Object.values(staticRoutesData)
            .filter((line) => line.routeStations.includes(station.stationID))
            .map((line) => line.routeID);
          const stationTrains = Object.values(station.destinations).flatMap(
            (direction) => direction.trains,
          );

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
        message: alert.alert.descriptionText.translation[0].text
          .replaceAll(/<[^>]*>/g, " ")
          .replaceAll("&nbsp;", " ")
          .replaceAll(/\s+/g, " ")
          .trim(),
      };
    });
    */

    const lastUpdated = new Date().toISOString();

    transitStatus.lastUpdated = lastUpdated;

    Object.keys(scheduledVehicles)
      .sort((aTrip, bTrip) => {
        return (
          scheduledVehicles[aTrip].predictions[0].actualETA -
          scheduledVehicles[bTrip].predictions[0].actualETA
        );
      })
      .forEach((runNumber) => {
        const scheduledVehicle = scheduledVehicles[runNumber];

        const trainNumber = runNumber.match(trainNumberRegex);
        if (!trainNumber) return; //no train ig
        const actualRunNumber = `${scheduledVehicle.lineCode.replaceAll("-", "")}-${trainNumber[0]}`;

        if (transitStatus.trains[actualRunNumber]) return; // train exists
        if (cancelledTrains[actualRunNumber]) return; // cancelled - TODO handle this better
        transitStatus.trains[actualRunNumber] = scheduledVehicle;

        const trainDirection =
          parseInt(actualRunNumber.split("-")[1]) % 2 == 0
            ? "Inbound"
            : "Outbound";

        scheduledVehicle.predictions.forEach((stop) => {
          //adding stations to transitStatus object
          if (!transitStatus.stations[stop.stationID]) {
            transitStatus.stations[stop.stationID] = {
              stationID: stop.stationID,
              stationName: staticStopsData[stop.stationID].stopName,
              lat: staticStopsData[stop.stationID].stopLat,
              lon: staticStopsData[stop.stationID].stopLon,
              destinations: {
                Inbound: { trains: [] },
                Outbound: { trains: [] },
              },
            };
          }

          if (
            transitStatus.stations[stop.stationID].destinations[trainDirection]
              .trains.length > 12
          )
            return; // too much!

          transitStatus.stations[stop.stationID].destinations[
            trainDirection
          ].trains.push({
            runNumber: actualRunNumber,
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
      });

    return {
      transitStatus,
      lastUpdated: lastUpdated,
    };
  } catch (e) {
    console.log(e);
    return false;
  }
};

exports.update = update;
