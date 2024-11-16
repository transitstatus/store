const fs = require('fs');
const fetch = require('node-fetch');
const GtfsRealtimeBindings = require('gtfs-realtime-bindings');

require('dotenv').config();

const interpolatePosition = (stationA, stationB, line, segmentsData) => {
  const segmentKey = segmentsData.segmentKeyDict[`${line}_${stationA}_${stationB}`];

  //console.log('key:', `${line}_${stationA}_${stationB}`)
  //console.log('data:', segmentsData.segments[segmentKey]);

  if (segmentsData.segments[segmentKey]) return true;
  return false;

  return {
    latitude: 0,
    longitude: 0,
    heading: 0,
  }
};

const updateFeed = async () => {
  try {
    if (!process.env.bay_511) return false;

    const now = new Date();

    let transitStatus = {
      trains: {},
      stations: {},
      lines: {},
      lastUpdated: now.toISOString(),
      shitsFucked: {
        shitIsFucked: false,
        message: '',
      }
    };

    //fetching gtfs-rt data
    const tripUpdatesRes = await fetch(`http://api.511.org/transit/tripupdates?api_key=${process.env.bay_511}&agency=RG`, {
      headers: {
        Accept: 'application/x-google-protobuf'
      },
    });
    const vehiclePositionsRes = await fetch(`http://api.511.org/transit/vehiclepositions?api_key=${process.env.bay_511}&agency=RG`, {
      headers: {
        Accept: 'application/x-google-protobuf'
      },
    });
    //finished fetching gtfs-rt data

    //starting GTFS-RT request error catching
    if (!tripUpdatesRes.ok) {
      const error = new Error(`${tripUpdatesRes.url}: ${tripUpdatesRes.status} ${tripUpdatesRes.statusText}`);
      error.response = tripUpdatesRes;
      throw error;
    }
    if (!vehiclePositionsRes.ok) {
      const error = new Error(`${vehiclePositionsRes.url}: ${vehiclePositionsRes.status} ${vehiclePositionsRes.statusText}`);
      error.response = vehiclePositionsRes;
      throw error;
    }
    //finished GTFS-RT request error catching

    //fetching static data
    const routesReq = await fetch('https://gtfs.piemadd.com/data/RG/routes.json');
    const stopsReq = await fetch('https://gtfs.piemadd.com/data/RG/stops.json');
    const segmentsReq = await fetch('https://gtfs.piemadd.com/data/RG/segments.json');

    const routesData = await routesReq.json();
    const stopsData = await stopsReq.json();
    const segmentsData = await segmentsReq.json();
    //finished fetching static data

    //processing GTFS-RT feed to usable format
    const tripUpdateBuffer = await tripUpdatesRes.arrayBuffer();
    const vehiclePositionsBuffer = await vehiclePositionsRes.arrayBuffer();

    const tripUpdateFeed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(new Uint8Array(tripUpdateBuffer));
    const vehiclePositionsFeed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(new Uint8Array(vehiclePositionsBuffer));
    //finished processing GTFS-RT

    //pushing routes into transitstatus object
    Object.keys(routesData).forEach((routeKey) => {
      transitStatus.lines[routeKey] = {
        lineCode: routesData[routeKey].routeID,
        lineNameShort: routesData[routeKey].routeShortName,
        lineNameLong: routesData[routeKey].routeLongName,
        routeColor: routesData[routeKey].routeColor,
        routeTextColor: routesData[routeKey].routeTextColor,
        stations: routesData[routeKey].routeStations,
        hasActiveTrains: false
      }
    })

    //pushing stops into transitstatus object
    Object.keys(stopsData).forEach((stopKey) => {
      transitStatus.stations[stopKey] = {
        stationID: stopsData[stopKey].stopID,
        stationName: stopsData[stopKey].stopName,
        destinations: {},
        lat: stopsData[stopKey].stopLat,
        lon: stopsData[stopKey].stopLon,
      }
    })

    let positions = {};
    vehiclePositionsFeed.entity.forEach((position, i) => {
      //console.log('vehicle:', position.vehicle)
      //console.log('trip:', position.vehicle.trip)
      //console.log('tripid:', position.vehicle.trip.tripId)

      //console.log(position)

      if (position.vehicle.vehicle) {
        positions['vehicle_' + position.vehicle.vehicle.id] = position.vehicle.position;
      }
      if (position.vehicle.trip) {
        positions['trip_' + position.vehicle.trip.tripId] = position.vehicle.position;
      }
    })


    tripUpdateFeed.entity.forEach((tripUpdate) => {
      if (tripUpdate.tripUpdate.stopTimeUpdate.length < 1) return;
      if (!tripUpdate.tripUpdate.vehicle) return;

      const vehicle = tripUpdate.tripUpdate.vehicle;
      const stopTimes = tripUpdate.tripUpdate.stopTimeUpdate;
      const tripMeta = tripUpdate.tripUpdate.trip;
      const route = routesData[tripMeta.routeId];

      if (!tripMeta || !tripMeta.routeId) return; //need the route id, even for fallbacks

      let positionMeta = positions[`vehicle_${vehicle.id}`] ?? positions[`trip_${tripMeta.tripId}`];

      if (!positionMeta) {
        if (stopTimes.length < 1) { //no data, go to null island i guess lol
          positionMeta = {
            latitude: 0,
            longitude: 0,
            heading: 0,
          }
        } else if (stopTimes.length < 2) { //approaching last stop
          positionMeta = interpolatePosition(stopTimes[0].stopId, undefined, tripMeta.routeId, segmentsData);
        } else {
          positionMeta = interpolatePosition(stopTimes[0].stopId, stopTimes[1].stopId, tripMeta.routeId, segmentsData);
        }
      }

      /*
      if (!positionMeta) {
        console.log('vid:', positions[`vehicle_${vehicle.id}`])
        console.log('tid:', positions[`trip_${tripMeta.tripId}`])
        console.log(tripMeta)
        console.log(stopTimes.length)
      }

      if (!route) {
        console.log(route)
        console.log(tripMeta)
        console.log(tripMeta.routeId)
        console.log(Object.keys(routesData).filter((n) => n.startsWith('EM')).join(','))
      }
      */

      transitStatus.trains[vehicle.id] = {
        lat: positionMeta.latitude,
        lon: positionMeta.longitude,
        heading: positionMeta.bearing,
        line: route.routeLongName,
        lineCode: tripMeta.routeId,
        lineColor: route.routeColor,
        lineTextColor: route.routeTextColor,
        dest: route.routeTrips[tripMeta.tripId] ? route.routeTrips[tripMeta.tripId].headsign : stopsData[stopTimes[stopTimes.length - 1].stopId].stopName,
        predictions: stopTimes.map((stopTime) => {
          return {
            stationID: stopTime.stopId,
            stationName: stopsData[stopTime.stopId].stopName,
            actualETA: Math.max(stopTime.arrival?.time?.low, stopTime.arrival?.time?.high) * 1000,
            noETA: false,
            realTime: true,
          };
        })
      }

      //making it active
      transitStatus.lines[tripMeta.routeId].hasActiveTrains = true;

      //console.log(transitStatus.trains[vehicle.id])
    })

    console.log(`Finished updating Bay Area`)
    return transitStatus;
  } catch (e) {
    console.log(e);
    return {
      trains: {},
      stations: {},
      lines: {},
      lastUpdated: new Date().toISOString(),
      shitsFucked: {
        shitIsFucked: true,
        message: 'Something went wrong updating the data from Bay Area 511. Please try again later.'
      }
    };
  }
};

exports.update = updateFeed;
