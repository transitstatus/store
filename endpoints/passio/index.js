const fs = require('fs');
const protobuf = require('protobufjs');
const fetch = require('node-fetch');

const arrayBufferToBase64 = (buffer) => {
  var binary = '';
  var bytes = new Uint8Array(buffer);
  var len = bytes.byteLength;
  for (var i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

const update = (async () => {
  let finalFeeds = {};

  //load up protobuf
  const root = await protobuf.load('./gtfs-rt.proto');
  const parser = root.lookupType('transit_realtime.FeedMessage');

  const feeds = JSON.parse(fs.readFileSync('./endpoints/passio/feeds.json'));
  const feedKeys = Object.keys(feeds);

  const now = new Date();

  for (let i = 0; i < feedKeys.length; i++) {
    const feedKey = feedKeys[i];
    const feed = feeds[feedKeys[i]];

    let transitStatus = {
      trains: {},
      stations: {},
      lines: {},
      lastUpdated: now.toISOString()
    }

    if (feed.invalid === true) {
      continue;
    }

    const onlyDoThese = ['rutgers', 'chicago'];
    if (!onlyDoThese.includes(feedKey)) continue;

    //if (feedKey !== 'rutgers') continue;

    console.log(`Starting feed ${feedKey}`)

    const tripUpdatesReq = await fetch(`https://passio3.com/${feedKey}/passioTransit/gtfs/realtime/tripUpdates`);
    const vehiclePositionsReq = await fetch(`https://passio3.com/${feedKey}/passioTransit/gtfs/realtime/vehiclePositions`);

    const staticStopsReq = await fetch(`https://gtfs.piemadd.com/data/${feedKey}/stops.json`)
    const staticRoutesReq = await fetch(`https://gtfs.piemadd.com/data/${feedKey}/routes.json`)

    const tripUpdatesBuffer = await tripUpdatesReq.arrayBuffer();
    const vehiclePositionsBuffer = await vehiclePositionsReq.arrayBuffer();

    const tripUpdatesRaw = Buffer.from(tripUpdatesBuffer, 'base64').toString();
    const vehiclePositionsRaw = Buffer.from(tripUpdatesBuffer, 'base64').toString();

    const staticStops = await staticStopsReq.json();
    const staticRoutes = await staticRoutesReq.json();

    if (tripUpdatesRaw === 'Not Found' || vehiclePositionsRaw === 'Not Found') {
      console.log(`Feed ${feedKey} is invalid`);
      continue;
    }

    const tripUpdates = parser.decode(new Uint8Array(tripUpdatesBuffer));
    const vehiclePositions = parser.decode(new Uint8Array(vehiclePositionsBuffer));

    Object.keys(staticStops).forEach((stopId) => {
      const stop = staticStops[stopId];

      transitStatus.stations[stopId] = {
        stationID: stop.stopID,
        stationName: stop.stopName,
        destinations: {},
        lat: stop.stopLat,
        lon: stop.stopLon
      }
    });

    Object.keys(staticRoutes).forEach((routeId) => {
      const route = staticRoutes[routeId];

      route.routeStations.forEach((station) => {
        if (!transitStatus.stations[station.stopID]) return;

        route.destinations.forEach((destination) => {
          transitStatus.stations[station.stopID].destinations[destination] = {
            trains: []
          }
        })
      })

      transitStatus.lines[route.routeID] = {
        lineCode: route.routeID,
        lineNameShort: route.routeShortName,
        lineNameLong: route.routeLongName,
        routeColor: route.routeColor,
        routeTextColor: route.routeTextColor,
        stations: route.routeStations.map((station) => station)
      }
    });

    let tripVehicles = {};

    vehiclePositions.entity.forEach((entity) => {
      transitStatus.trains[entity.vehicle.vehicle.label] = {
        lat: entity.vehicle.position.latitude,
        lon: entity.vehicle.position.longitude,
        heading: entity.vehicle.position.bearing,
      }

      tripVehicles[entity.vehicle.trip.tripId] = entity.vehicle.vehicle.label;
    })

    tripUpdates.entity.forEach((entity) => {
      const tripId = entity.tripUpdate.trip.tripId;
      const vehicleId = tripVehicles[tripId];

      const route = Object.values(staticRoutes).find((route) => Object.keys(route.routeTrips).includes(entity.tripUpdate.trip.tripId));

      if (!route) return;

      transitStatus.trains[vehicleId] = {
        ...transitStatus.trains[vehicleId],
        line: route.routeLongName,
        lineCode: route.routeID,
        lineColor: route.routeColor,
        lineTextColor: route.routeTextColor,
        dest: route.routeTrips[tripId].tripHeadsign,
        predictions: entity.tripUpdate.stopTimeUpdate.map((stop) => {
          const arrivalTimestamp = Math.max(stop.arrival.time.low, stop.arrival.time.high) * 1000;
          const staticStop = staticStops[stop.stopId] ?? {
            stopID: stop.stopId,
            stopName: 'Unknown',
            stopLat: 0,
            stopLon: 0
          }

          return {
            stationID: stop.stopId,
            stationName: staticStop.stopName,
            eta: Math.floor((arrivalTimestamp - now.valueOf()) / (1000 * 60)),
            actualETA: arrivalTimestamp,
          }
        })
      }
    })

    finalFeeds[feedKey] = { transitStatus: transitStatus };
  }

  return finalFeeds;
});

exports.update = update;