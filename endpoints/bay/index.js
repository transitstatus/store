const fs = require('fs');
const fetch = require('node-fetch');
const GtfsRealtimeBindings = require('gtfs-realtime-bindings');

require('dotenv').config();

const feeds = JSON.parse(fs.readFileSync('./endpoints/bay/feeds.json', 'utf8'));

const updateFeed = async (feedKey) => {
  try {
    if (!process.env.bay_511) return false;

    const now = new Date();

    let positions = {};
    let transitStatus = {
      trains: {},
      stations: {},
      lines: {},
      lastUpdated: now.toISOString(),
    };

    //fetching gtfs-rt data
    const tripUpdatesRes = await fetch(`http://api.511.org/transit/tripupdates?api_key=${process.env.bay_511}&agency=${feedKey}`, {
      headers: {
        Accept: 'application/x-google-protobuf'
      },
    });
    const vehiclePositionsRes = await fetch(`http://api.511.org/transit/vehiclepositions?api_key=${process.env.bay_511}&agency=${feedKey}`, {
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

    //fetching static routes and stops
    const routesReq = await fetch(`https://gtfs.piemadd.com/data/${feedKey}/routes.json`);
    const stopsReq = await fetch(`https://gtfs.piemadd.com/data/${feedKey}/stops.json`);

    const routesData = await routesReq.json();
    const stopsData = await stopsReq.json();
    //finished fetching static routes and stops

    //processing GTFS-RT feed to usable format
    const tripUpdateBuffer = await tripUpdatesRes.arrayBuffer();
    const vehiclePositionsBuffer = await vehiclePositionsRes.arrayBuffer();

    const tripUpdateFeed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(
      new Uint8Array(tripUpdateBuffer)
    );
    const vehiclePositionsFeed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(
      new Uint8Array(vehiclePositionsBuffer)
    );
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

    vehiclePositionsFeed.entity.forEach((position) => {
      if (position.vehicle.vehicle) positions['vehicle_' + position.vehicle.vehicle.id] = position;
      if (position.vehicle.trip) positions['trip_' + position.vehicle.trip.tripId] = position;
    })

    tripUpdateFeed.entity.forEach((tripUpdate) => {
      if (tripUpdate.tripUpdate.stopTimeUpdate.length < 1) return;
      if (!tripUpdate.tripUpdate.vehicle) return;

      const vehicle = tripUpdate.tripUpdate.vehicle;
      const stopTimes = tripUpdate.tripUpdate.stopTimeUpdate;
      const tripMeta = tripUpdate.tripUpdate.trip;
      const route = routesData[tripMeta.routeId];
      
      transitStatus.trains[vehicle.id] = {
        lat: 0,
        lon: 0,
        heading: 0,
        line: route.routeLongName,
        lineCode: tripMeta.routeId,
        lineColor: route.routeColor,
        lineTextColor: route.routeTextColor,
        //dest: route.routeTrips[tripMeta.tripId].headsign,
        predictions: stopTimes.map((stopTime) => {
          console.log(stopTime)
          return {};
        })
      }
    })


    console.log(`Finished updating ${feedKey}`)
    return {
      ...transitStatus,
      shitsFucked: {
        shitIsFucked: false,
        message: '',
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
        message: 'Something went wrong updating the data from Bay Area 511. Please try again later.'
      }
    };
  }
};

const updateFeedInd = async (feedKey) => {
  if (feedKey !== 'AC') return false;

  const feedData = await updateFeed(feedKey);

  console.log(`Finished updating ${feedKey}`)

  return feedData;
}

exports.update = updateFeedInd;
