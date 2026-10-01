const fs = require("fs");
const protobuf = require("protobufjs");

const updateFeed = async (feed) => {
  try {
    const gtfsRealtimeRoot = await protobuf.load("gtfs-rt.proto");
    const FeedMessage = gtfsRealtimeRoot.lookupType("transit_realtime.FeedMessage");

    const [tripUpdatesData, positionsData, alertsData] = await Promise.all(
      [
        `https://${feed.id}.tripshot.com/v1/gtfs/realtime/tripUpdate/CA558DDC-D7F2-4B48-9CAC-DEEA1134F820`,
        `https://${feed.id}.tripshot.com/v1/gtfs/realtime/vehiclePosition/CA558DDC-D7F2-4B48-9CAC-DEEA1134F820`,
        `https://${feed.id}.tripshot.com/v1/gtfs/realtime/serviceAlert/CA558DDC-D7F2-4B48-9CAC-DEEA1134F820`
      ].map((url) =>
        fetch(url)
          .then((res) => res.arrayBuffer())
          .then((arrayBuffer) => FeedMessage.decode(new Uint8Array(arrayBuffer)))
          .then((data) => data.toJSON())
          .catch((e) => {
            console.log(feed);
            console.log(e);
          })
      )
    );

    let vehiclePositionsDict = {};
    (positionsData.entity ?? []).forEach((position) => {
      if (position.vehicle) {
        if (position.vehicle.vehicle && position.vehicle.position) {
          vehiclePositionsDict[position.vehicle.vehicle.id] = position.vehicle.position;
        }
      }
    });

    const [staticStopsData, staticRoutesData] = await Promise.all(
      [
        `https://gtfs.piemadd.com/data/${feed.id}/stops.json`,
        `https://gtfs.piemadd.com/data/${feed.id}/routes.json`
      ].map((url) => fetch(url).then((res) => res.json()))
    );

    let tripToRouteDict = {};
    Object.values(staticRoutesData).forEach((route) => {
      const routeID = route.routeID;
      Object.keys(route.routeTrips).forEach((trip) => {
        tripToRouteDict[trip] = routeID;
        tripToRouteDict[trip.split(":")[0]] = routeID;
      });
    });

    let transitStatus = { trains: {}, stations: {}, lines: {}, alerts: [] };

    //adding trains to transitStatus object
    (tripUpdatesData.entity ?? []).forEach((train, i) => {
      const runNumber =
        train.tripUpdate?.vehicle?.label ?? train.tripUpdate?.vehicle?.id ?? `X${(i + 1).toString().padStart(3, "0")}`;

      const position = vehiclePositionsDict[train.tripUpdate?.vehicle?.id] ?? { latitude: 0, longitude: 0, bearing: 0 };

      let routeId =
        tripToRouteDict[train.tripUpdate?.trip?.tripId] ??
        train.tripUpdate?.trip?.routeId ??
        tripToRouteDict[train.tripUpdate?.trip?.tripId.split(":")[0]] ??
        "d66c529d-e078-4516-8629-8a433015d236";

      if (!transitStatus.trains[runNumber]) {
        transitStatus.trains[runNumber] = {
          lat: position.latitude,
          lon: position.longitude,
          heading: position.bearing,
          realTime: true,
          deadMileage: false,
          line: staticRoutesData[routeId].routeLongName,
          lineCode: routeId,
          lineColor: staticRoutesData[routeId].routeColor,
          lineTextColor: staticRoutesData[routeId].routeTextColor,
          dest: staticRoutesData[routeId].routeLongName,
          predictions: [],
          type: "bus",
          extra: {
            load: null,
            cap: null,
            info: null //extraBusInfo[feed.id] && extraBusInfo[feed.id][runNumber] ? extraBusInfo[feed.id][runNumber] : null
          }
        };
      }

      //adding predictions to transitStatus object
      train.tripUpdate?.stopTimeUpdate?.forEach((stop, i, array) => {
        const arr = stop.arrival ? parseInt(stop.arrival.time) : 0;
        const dep = stop.departure ? parseInt(stop.departure.time) : 0;
        const time = Math.max(arr, dep) * 1000;

        //if (runNumber == "2745") console.log(stop.stopId, time, new Date(time).toLocaleTimeString(), transitStatus.trains[runNumber].predictions.length);

        const thisStopData = staticStopsData[stop.stopId] ?? {
          stopID: stop.stopId,
          stopName: "Unknown Stop",
          stopLat: 0,
          stoPLon: 0,
          stopTZ: ""
        };

        if (time) {
          transitStatus.trains[runNumber].predictions.push({
            stationID: stop.stopId,
            stationName: thisStopData.stopName,
            actualETA: time,
            noETA: !time,
            realTime: true
          });
        }

        //adding stations to transitStatus object
        if (!transitStatus.stations[stop.stopId]) {
          transitStatus.stations[stop.stopId] = {
            stationID: stop.stopId,
            stationName: thisStopData.stopName,
            lat: thisStopData.stopLat,
            lon: thisStopData.stopLon,
            destinations: {}
          };
        }

        if (!transitStatus.stations[stop.stopId].destinations[transitStatus.trains[runNumber].dest]) {
          transitStatus.stations[stop.stopId].destinations[transitStatus.trains[runNumber].dest] = { trains: [] };
        }

        if (time) {
          transitStatus.stations[stop.stopId].destinations[transitStatus.trains[runNumber].dest].trains.push({
            runNumber: runNumber,
            actualETA: time,
            noETA: !time,
            realTime: true,
            line: transitStatus.trains[runNumber].line,
            lineCode: transitStatus.trains[runNumber].lineCode,
            lineColor: transitStatus.trains[runNumber].lineColor,
            lineTextColor: transitStatus.trains[runNumber].lineTextColor,
            destination: transitStatus.trains[runNumber].dest,
            extra: {}
          });
        }
      });
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
            destinations: {}
          };
        }
      });
    });

    Object.keys(transitStatus.trains).forEach((train) => {
      const trainData = transitStatus.trains[train];

      transitStatus.lines[trainData.lineCode].hasActiveTrains = true;
    });

    // alerts
    transitStatus.alerts = (alertsData.entity ?? []).map((alert) => {
      const lineCode = alert.alert.informedEntity.length > 0 ? (alert.alert.informedEntity[0].routeId ?? null) : null;
      const runNumber =
        alert.alert.informedEntity.length > 0 ? (alert.alert.informedEntity[0].trip?.tripId ?? null) : null;
      const stationID = alert.alert.informedEntity.length > 0 ? (alert.alert.informedEntity[0].stopId ?? null) : null;

      const additionalRunNumbers = Object.keys(transitStatus.trains).filter((trainID) => {
        const train = transitStatus.trains[trainID];
        const stopIDs = train.predictions.map((prediction) => prediction.stationID);
        if (lineCode == train.lineCode) return true;
        if (stopIDs.includes(stationID)) return true;
        return false;
      });

      const additionalStationIDs = Object.values(transitStatus.stations)
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
        message: alert.alert.descriptionText.translation[0].text
          .replaceAll(/<[^>]*>/g, " ")
          .replaceAll("&nbsp;", " ")
          .replaceAll(/\s+/g, " ")
          .trim()
      };
    });

    // sorting ETAs for each train
    Object.keys(transitStatus.trains).forEach((trainID) => {
      transitStatus.trains[trainID].predictions = transitStatus.trains[trainID].predictions.sort((a, b) => a.actualETA - b.actualETA)
    })

    const lastUpdated = new Date().toISOString();

    transitStatus.lastUpdated = lastUpdated;

    return { ...transitStatus, shitsFucked: { shitIsFucked: false, message: "." } };
  } catch (e) {
    console.log(e);
    return {
      trains: {},
      stations: {},
      lines: {},
      lastUpdated: new Date().toISOString(),
      shitsFucked: {
        shitIsFucked: true,
        message: `There was an error fetching data for ${feed.id} from Tripshot. Please try again in a few minutes. If this error persists please email me at piero@piemadd.com.`
      }
    };
  }
};

const updateFeedInd = async (feedKey) => {
  let feed = { id: feedKey };

  //if (feedKey !=)

  const feedData = await updateFeed(feed);

  console.log(`Finished updating ${feedKey}`);

  return feedData;
};

exports.update = updateFeedInd;
