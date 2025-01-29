const fetch = require('node-fetch');
const protobuf = require('protobufjs');
const turf = require('@turf/turf');

require('dotenv').config();

const update = (async () => {
  try {
    const now = Date.now();
    const todaysDate = new Date(now);
    const yesterdaysDate = new Date(todaysDate.valueOf() - (1000 * 60 * 60 * 24));

    const gtfsRealtimeRoot = await protobuf.load('gtfs-rt.proto');
    const FeedMessage = gtfsRealtimeRoot.lookupType('transit_realtime.FeedMessage');

    const schedulesRoot = await protobuf.load('schedules.proto');
    const ScheduleMessage = schedulesRoot.lookupType('gobbler.ScheduleMessage');

    const data = await fetch('http://api.bart.gov/gtfsrt/tripupdate.aspx')
      .then(res => res.arrayBuffer())
      .then(arrayBuffer => FeedMessage.decode(new Uint8Array(arrayBuffer)));

    const [
      staticStopsData,
      staticRoutesData,
      staticSegmentsData,
      staticMetaData,
    ] = await Promise.all([
      'https://gtfs.piemadd.com/data/bart/stops.json',
      'https://gtfs.piemadd.com/data/bart/routes.json',
      'https://gtfs.piemadd.com/data/bart/segments.json',
      'https://gobblerstatic.transitstat.us/schedules/bart/metadata.json',
    ].map((url) =>
      fetch(url).then(res => res.json())
    ));

    const [
      staticScheduleArray,
      yesterdayStaticScheduleArray,
    ] = await Promise.all([
      `https://gobblerstatic.transitstat.us/schedules/bart/${todaysDate.toISOString().split('T')[0]}.pbf`,
      `https://gobblerstatic.transitstat.us/schedules/bart/${yesterdaysDate.toISOString().split('T')[0]}.pbf`,
    ].map((url) =>
      fetch(url).then(res => res.arrayBuffer()).then(arrayBuffer => ScheduleMessage.decode(new Uint8Array(arrayBuffer)))
    ));

    let staticScheduleData = {};
    let yesterdayStaticScheduleData = {};
    staticScheduleArray.stopMessage.forEach((stop) => {
      staticScheduleData[stop.stopId] = stop.trainMessage;
    });
    yesterdayStaticScheduleArray.stopMessage.forEach((stop) => {
      yesterdayStaticScheduleData[stop.stopId] = stop.trainMessage;
    });

    let transitStatus = {
      trains: {},
      stations: {},
      lines: {},
    };

    let routesDict = {};
    Object.values(staticRoutesData).forEach((route) => {
      Object.keys(route.routeTrips).forEach((tripID) => routesDict[tripID] = route.routeID)
    })

    let headsignsDict = {};
    staticScheduleArray.stopMessage.forEach((stop) => {
      const stopID = stop.stopId;
      if (!headsignsDict[stopID]) headsignsDict[stopID] = {};

      let headsign = null;

      stop.trainMessage.forEach((trip) => {
        if (trip.headsignId) headsign = staticMetaData.headsigns[trip.headsignId];
        headsignsDict[stopID][trip.runNumber] = headsign;
      });
    })

    //adding trains to transitStatus object
    data.toJSON().entity.forEach((train, i) => {
      const runNumber = train.tripUpdate.trip.tripId;
      const trainRouteID = routesDict[runNumber];
      if (!trainRouteID) return;
      const actualRouteID = staticRoutesData[trainRouteID].routeShortName;

      const trainTimes = train.tripUpdate.stopTimeUpdate.map((stop) => {
        return {
          ...stop,
          stopId: staticStopsData[stop.stopId].parentStation.length > 0 ? staticStopsData[stop.stopId].parentStation : stop.stopId,
        }
      })

      const nextTwoStops = trainTimes.slice(0, 2); // get last two stops
      if (nextTwoStops.length < 2) nextTwoStops.push('undefined'); // funny games for our segments

      const segmentDictKey = `${trainRouteID}_${nextTwoStops[0].stopId}_${nextTwoStops[1].stopId}`;
      const segmentKey = staticSegmentsData.segmentKeyDict[segmentDictKey];

      let position = null;

      if (nextTwoStops.length == 1) { // at the last stop
        return; // no point in showing this train tbh
      } else if (!segmentKey) { // at the first stop
        const currentStop = staticStopsData[nextTwoStops[0].stopId];
        position = [currentStop.stopLat, currentStop.stopLon, 0];
        return; // TODO REMOVE
      } else { // yay
        try {
          const segment = staticSegmentsData.segments[segmentKey];
          const segmentShape = turf.lineString(segment.shape);
          const percentDone = 1 - (((parseInt((nextTwoStops[0].arrival ?? nextTwoStops[0].departure).time) * 1000) - now) / (segment.seconds * 1000));
          const metersAlong = segment.meters * percentDone;
          const lineSegment = turf.lineSliceAlong(segmentShape, 0, metersAlong / 1000);
          const lastTwoPointsForAngle = lineSegment.geometry.coordinates.slice(-2);
          const bearing = turf.rhumbBearing(lastTwoPointsForAngle[0], lastTwoPointsForAngle[1], { final: false });
          position = [lastTwoPointsForAngle[1][1], lastTwoPointsForAngle[1][0], bearing]
        } catch (e) {
          // something happened within turf, im just gonna snap the vehicle to the next station and pray it fixes itself next update
          const currentStop = staticStopsData[nextTwoStops[0].stopId];
          position = [currentStop.stopLat, currentStop.stopLon, 0];
        }
      }

      let finalTrain = {
        lat: position[0],
        lon: position[1],
        heading: position[2],
        line: actualRouteID,
        lineCode: actualRouteID,
        lineColor: staticRoutesData[trainRouteID].routeColor,
        lineTextColor: staticRoutesData[trainRouteID].routeTextColor,
        dest: headsignsDict[trainTimes[0].stopId][runNumber],
        predictions: [],
        type: 'train',
        extra: {}
      }

      //adding predictions to transitStatus object
      trainTimes.forEach((stop) => {
        const arr = parseInt(stop.arrival?.time) * 1000;
        const dep = parseInt(stop.departure?.time) * 1000;
        const time = Math.min(arr, dep);

        finalTrain.predictions.push({
          stationID: stop.stopId,
          stationName: staticStopsData[stop.stopId].stopName,
          actualETA: time,
          noETA: false,
        });

        //adding stations to transitStatus object
        if (!transitStatus.stations[stop.stopId]) {
          transitStatus.stations[stop.stopId] = {
            stationID: stop.stopId,
            stationName: staticStopsData[stop.stopId].stopName,
            lat: staticStopsData[stop.stopId].stopLat,
            lon: staticStopsData[stop.stopId].stopLon,
            destinations: {},
          };
        }

        const finalStation = headsignsDict[stop.stopId][runNumber] ?? staticStopsData[trainTimes.slice(-1)[0].stopId].stopName ?? "Unknown Dest";

        if (!transitStatus.stations[stop.stopId].destinations[finalStation]) {
          transitStatus.stations[stop.stopId].destinations[finalStation] = {
            trains: [],
          }
        }

        transitStatus.stations[stop.stopId].destinations[finalStation].trains.push({
          runNumber: runNumber,
          actualETA: time,
          noETA: false,
          realTime: true,
          line: finalTrain.line,
          lineCode: finalTrain.lineCode,
          lineColor: finalTrain.lineColor,
          lineTextColor: finalTrain.lineTextColor,
          extra: {}
        });
      });

      transitStatus.trains[runNumber] = finalTrain;
    });

    //adding any stations without trains to transitStatus object
    Object.keys(staticRoutesData).forEach((routeID) => {
      const route = staticRoutesData[routeID];

      transitStatus.lines[route.routeShortName] = {
        lineCode: route.routeShortName,
        lineNameShort: route.routeShortName,
        lineNameLong: route.routeShortName,
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
            destinations: {},
          };
        }
      });
    });

    Object.keys(transitStatus.trains).forEach((train) => {
      const trainData = transitStatus.trains[train];

      transitStatus.lines[trainData.lineCode].hasActiveTrains = true;
    });

    const lastUpdated = new Date(now).toISOString();
    const lastUpdatedNum = new Date(lastUpdated).valueOf();

    transitStatus.lastUpdated = lastUpdated;

    //filling in schedule data
    const fillInData = (staticData, date) => {
      const startOfDay = `${date.toISOString().split('T')[0]}T00:00:00.000Z`; // Midnight UTC in ISO-8601

      Object.keys(transitStatus.stations).forEach((stationKey) => {
        if (!staticData[stationKey]) return;

        let now = new Date(startOfDay).valueOf();
        let headsign = null; //NOT headsign id
        let routeID = null;

        const staticStationData = staticData[stationKey];
        for (i = 0; i < staticStationData.length; i++) {
          const thisVehicle = staticStationData[i];

          now += thisVehicle.timeDiff * 1000;
          headsign = thisVehicle.headsignId || thisVehicle.headsignId == 0 ? staticMetaData.headsigns[thisVehicle.headsignId] : headsign;
          routeID = thisVehicle.routeId || thisVehicle.routeId == 0 ? staticMetaData.routes[thisVehicle.routeId] : routeID;

          if (now < lastUpdatedNum || now > lastUpdatedNum + (1000 * 60 * 60 * 4)) continue;

          if (transitStatus.stations[stationKey]['destinations'][headsign]['trains'].length >= 4) continue; //we dont need all that
          if (thisVehicle.runNumber && transitStatus.trains[thisVehicle.runNumber]) continue; // train is tracking

          transitStatus.stations[stationKey]['destinations'][headsign]['trains'].push({
            runNumber: thisVehicle.runNumber ? thisVehicle.runNumber : 'Scheduled',
            actualETA: now,
            noETA: false,
            realTime: false,
            line: staticRoutesData[routeID].routeShortName,
            lineCode: staticRoutesData[routeID].routeShortName,
            lineColor: staticRoutesData[routeID].routeColor,
            lineTextColor: staticRoutesData[routeID].routeTextColor,
            destination: headsign,
            extra: {},
          })
        }
      })
    };

    fillInData(yesterdayStaticScheduleData, yesterdaysDate);
    fillInData(staticScheduleData, todaysDate);

    return {
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