const fs = require('fs');
const protobuf = require('protobufjs');
const headsignReplacements = require('./headsignReplacements');
const stopReplacements = require('./stopReplacements');
const extraBusInfo = require('./extraBusInfo');

const extraConfig = JSON.parse(fs.readFileSync('./endpoints/passio_go/extraconfig.json'));

const updateFeed = async (feed) => {
  try {
    const gtfsRealtimeRoot = await protobuf.load('gtfs-rt.proto');
    const FeedMessage = gtfsRealtimeRoot.lookupType('transit_realtime.FeedMessage');

    const [
      tripUpdatesData,
      positionsData,
      alertsData,
    ] = await Promise.all([
      `https://passio3.com/${feed.id}/passioTransit/gtfs/realtime/tripUpdates`,
      `https://passio3.com/${feed.id}/passioTransit/gtfs/realtime/vehiclePositions`,
      `https://passio3.com/${feed.id}/passioTransit/gtfs/realtime/serviceAlerts`,
    ].map((url) =>
      fetch(url).then(res => res.arrayBuffer()).then(arrayBuffer => FeedMessage.decode(new Uint8Array(arrayBuffer))).then(data => data.toJSON()).catch((e) => {
        console.log(feed)
        console.log(e)
      })
    ));

    let vehiclePositionsDict = {};
    (positionsData.entity ?? []).forEach((position) => {
      if (position.vehicle) {
        if (position.vehicle.vehicle && position.vehicle.position) {
          vehiclePositionsDict[position.vehicle.vehicle.id] = position.vehicle.position;
        }
      }
    });

    const [
      staticStopsData,
      staticRoutesData,
    ] = await Promise.all([
      `https://gtfs.piemadd.com/data/${feed.gtfsKey ?? feed.id}/stops.json`,
      `https://gtfs.piemadd.com/data/${feed.gtfsKey ?? feed.id}/routes.json`
    ].map((url) =>
      fetch(url).then(res => res.json())
    ));

    let tripToRouteDict = {};
    Object.values(staticRoutesData).forEach((route) => {
      const routeID = route.routeID;
      Object.keys(route.routeTrips).forEach((trip) => {
        tripToRouteDict[trip] = routeID;
      })
    });

    let transitStatus = {
      trains: {},
      stations: {},
      lines: {},
      alerts: [],
    };

    //adding trains to transitStatus object
    (tripUpdatesData.entity ?? []).forEach((train, i) => {
      const runNumber = train.tripUpdate?.vehicle?.label ?? train.tripUpdate?.vehicle?.id ?? `X${(i + 1).toString().padStart(3, '0')}`;

      const position = vehiclePositionsDict[train.tripUpdate?.vehicle?.id] ?? {
        latitude: 0,
        longitude: 0,
        bearing: 0,
      }

      let routeId = train.tripUpdate?.trip?.routeId ?? tripToRouteDict[train.tripUpdate?.trip?.tripId];
      if (!routeId) routeId = Object.keys(staticRoutesData)[0];

      let finalTrain = {
        lat: position.latitude,
        lon: position.longitude,
        heading: position.bearing,
        realTime: true,
        deadMileage: false,
        line: staticRoutesData[routeId].routeLongName,
        lineCode: routeId,
        lineColor: staticRoutesData[routeId].routeColor,
        lineTextColor: staticRoutesData[routeId].routeTextColor,
        dest: "Unknown Dest",
        predictions: [],
        type: 'bus',
        extra: {
          load: null,
          cap: null,
          info: extraBusInfo[feed.id] && extraBusInfo[feed.id][runNumber] ? extraBusInfo[feed.id][runNumber] : null,
        }
      };

      //adding predictions to transitStatus object
      train.tripUpdate?.stopTimeUpdate?.forEach((stop, i, array) => {
        if (i == 0) finalTrain.dest = headsignReplacements[feed.id]?.[finalTrain.lineCode]?.replacements[stop.stopId] ?? staticStopsData[array[array.length - 1].stopId].stopName;

        const arr = stop.arrival ? parseInt(stop.arrival.time) : 0;
        const dep = stop.departure ? parseInt(stop.departure.time) : 0;
        const time = Math.max(arr, dep) * 1000;

        const thisStopData = staticStopsData[stop.stopId] ?? {
          stopID: stop.stopId,
          stopName: 'Unknown Stop',
          stopLat: 0,
          stoPLon: 0,
          stopTZ: ""
        };

        finalTrain.predictions.push({
          stationID: stop.stopId,
          stationName: thisStopData.stopName,
          actualETA: time,
          noETA: !time,
          realTime: true,
        });

        //adding stations to transitStatus object
        if (!transitStatus.stations[stop.stopId]) {
          transitStatus.stations[stop.stopId] = {
            stationID: stop.stopId,
            stationName: thisStopData.stopName,
            lat: thisStopData.stopLat,
            lon: thisStopData.stopLon,
            destinations: {},
          };
        }

        const destFromThisStop = headsignReplacements[feed.id]?.[finalTrain.lineCode]?.replacements[stop.stopId] ?? finalTrain.dest;

        if (!transitStatus.stations[stop.stopId].destinations[destFromThisStop]) {
          transitStatus.stations[stop.stopId].destinations[destFromThisStop] = { trains: [] }
        }

        transitStatus.stations[stop.stopId].destinations[destFromThisStop].trains.push({
          runNumber: runNumber,
          actualETA: time,
          noETA: !time,
          realTime: true,
          line: finalTrain.line,
          lineCode: finalTrain.lineCode,
          lineColor: finalTrain.lineColor,
          lineTextColor: finalTrain.lineTextColor,
          destination: finalTrain.dest,
          extra: {}
        });
      });

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
    transitStatus.alerts = (alertsData.entity ?? []).map((alert) => {
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

    return {
      ...transitStatus,
      shitsFucked: {
        shitIsFucked: false,
        message: '.'
      }
    }
  } catch (e) {
    console.log(e);
    return {
      trains: {},
      stations: {},
      lines: {},
      lastUpdated: new Date().toISOString(),
      shitsFucked: {
        shitIsFucked: true,
        message: `There was an error fetching data for ${feed.id} from Passio. Please try again in a few minutes. If this error persists please email me at piero@piemadd.com.`
      }
    };
  }
};

const updateFeedInd = async (feedKey, gtfsKey) => {
  let feed = {
    id: feedKey,
    gtfsKey,
  };

  if (extraConfig[feedKey]) {
    feed = {
      ...feed,
      ...extraConfig[feedKey],
    }
  }

  //if (feedKey !=)

  const feedData = await updateFeed(feed);

  console.log(`Finished updating ${feedKey}`);

  return feedData;
}

exports.update = updateFeedInd;
