const GtfsRealtimeBindings = require('gtfs-realtime-bindings');

const updateFeed = async () => {
  const now = new Date();

  let finalBrightlineV1 = {
    trains: {},
    stations: {},
    lines: {},
    lastUpdated: now.toISOString(),
    shitsFucked: {
      shitIsFucked: false,
      message: ""
    }
  };
  let finalBrightlineV2 = {
    vehicles: {},
    stations: {},
    routes: {},
    alerts: {},
    meta: {
      lastUpdated: now.toISOString(),
      error: {
        shitIsFucked: false,
        message: ""
      }
    }
  };
  let platformsData = {};

  try {
    let fetchedData = {};
    const urlsToFetch = {
      'brightlineTimes': 'http://feed.gobrightline.com/trip_updates.pb',
      'brightlinePositions': 'http://feed.gobrightline.com/position_updates.pb',
      'brightlineStops': 'https://gtfs.piemadd.com/data/brightline/stops.json',
      'brightlineRoutes': 'https://gtfs.piemadd.com/data/brightline/routes.json',
    };
    const processRequests = {
      'brightlineTimes': (r) => r.arrayBuffer().then((buf) => GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(new Uint8Array(buf))),
      'brightlinePositions': (r) => r.arrayBuffer().then((buf) => GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(new Uint8Array(buf))),
      'brightlineStops': (r) => r.json(),
      'brightlineRoutes': (r) => r.json(),
    };

    // fetching all of our data asyncronously
    const fetchedDataRes = await Promise.all(Object.keys(urlsToFetch).map((key) => fetch(urlsToFetch[key] + `?currentTime=${Date.now()}`)));

    //processing our data bit less asyncronously
    const urlKeys = Object.keys(processRequests);
    for (let i = 0; i < urlKeys.length; i++) {
      const key = urlKeys[i];
      const processed = await processRequests[key](fetchedDataRes[i]);
      fetchedData[key] = processed;
    }

    //fetching platform numbers using previous data
    const stationsInOrder = Object.values(fetchedData.brightlineStops);
    const platformsRes = await Promise.all(stationsInOrder.map((stop) => fetch(`https://schedules.gobrightline.com/update/top-bottom.html?stationName=${stop.stopName}&DeparturesOrArrivals=Departures`)));
    const platformsResData = await Promise.all(platformsRes.map((res) => res.json()));
    platformsResData.forEach((station, i) => {
      const stationID = stationsInOrder[i].stopID;
      platformsData[stationID] = {};
      [station.scheduleSouth, station.scheduleNorth].flat().map((departure) => {
        platformsData[stationID][departure.scheduleNumber] = departure.track != '-' ? departure.track : '';
      })
    });

    //filling out the stop data with our GTFS
    Object.values(fetchedData.brightlineStops).forEach((stop) => {
      finalBrightlineV1.stations[stop.stopID] = {
        stationID: stop.stopID,
        stationName: stop.stopName,
        destinations: {},
        lat: stop.stopLat,
        lon: stop.stopLon,
        tz: stop.stopTZ,
      }
    });

    //filling out the route data with our GTFS
    Object.values(fetchedData.brightlineRoutes).forEach((route) => {
      finalBrightlineV1.lines[route.routeID] = {
        lineCode: route.routeID,
        lineNameShort: route.routeShortName,
        lineNameLong: route.routeLongName,
        routeColor: route.routeColor,
        routeTextColor: route.routeTextColor,
        stations: route.routeStations,
        hasActiveTrains: false,
      };

      route.routeStations.forEach((station) => {
        route.destinations.forEach((destination) => {
          // getting the actual stop name from the GTFS
          finalBrightlineV1.stations[station].destinations[fetchedData.brightlineStops[destination].stopName] = {
            trains: []
          }
        })
      })
    });

    //storing vehicle positions
    let vehiclePositions = {};
    fetchedData.brightlinePositions.entity.forEach((position) => {
      vehiclePositions[position.vehicle.trip.tripId] = position.vehicle.position.toJSON();
    })

    //vehicle times
    fetchedData.brightlineTimes.entity.forEach((trip) => {
      const route = fetchedData.brightlineRoutes[trip.tripUpdate.trip.routeId];
      const destination = fetchedData.brightlineStops[trip.tripUpdate.stopTimeUpdate.slice(-1)[0].stopId].stopName;
      const position = vehiclePositions[trip.id] ?? {
        latitude: 0,
        longitude: 0,
        bearing: 0,
        fake: true,
      };

      //doing some magic to make up for a not found position
      if (position.fake) {
        const upcomingStops = trip.tripUpdate.stopTimeUpdate.filter((stopTime) => (stopTime.departure ?? stopTime.arrival).time.toNumber() > now.valueOf() / 1000);
        const upcomingStopID = (upcomingStops.length > 0 ? upcomingStops[0] : trip.tripUpdate.stopTimeUpdate[0]).stopId;
        const upcomingStop = fetchedData.brightlineStops[upcomingStopID];

        position.latitude = upcomingStop.stopLat;
        position.longitude = upcomingStop.stopLon;
        position.bearing = 0;
      }

      finalBrightlineV1.lines[route.routeID].hasActiveTrains = true;

      finalBrightlineV1.trains[trip.id.split('_')[0]] = {
        line: route.routeLongName,
        lineCode: route.routeID,
        lineColor: route.routeColor,
        lineTextColor: route.routeTextColor,
        dest: destination,
        predictions: trip.tripUpdate.stopTimeUpdate.map((stopTime) => {
          finalBrightlineV1.stations[stopTime.stopId].destinations[destination].trains.push(
            {
              runNumber: trip.id.split('_')[0],
              actualETA: (stopTime.departure ?? stopTime.arrival).time.toNumber() * 1000,
              arr: (stopTime.arrival ?? stopTime.departure).time.toNumber() * 1000,
              dep: (stopTime.departure ?? stopTime.arrival).time.toNumber() * 1000,
              arrDelay: (stopTime.arrival ?? stopTime.departure).delay * 1000,
              depDelay: (stopTime.departure ?? stopTime.arrival).delay * 1000,
              noETA: false,
              line: route.routeLongName,
              lineCode: route.routeID,
              lineColor: route.routeColor,
              lineTextColor: route.routeTextColor,
            }
          )

          return {
            stationID: stopTime.stopId,
            stationName: fetchedData.brightlineStops[stopTime.stopId].stopName,
            actualETA: (stopTime.departure ?? stopTime.arrival).time.toNumber() * 1000,
            arr: (stopTime.arrival ?? stopTime.departure).time.toNumber() * 1000,
            dep: (stopTime.departure ?? stopTime.arrival).time.toNumber() * 1000,
            arrDelay: (stopTime.arrival ?? stopTime.departure).delay * 1000,
            depDelay: (stopTime.departure ?? stopTime.arrival).delay * 1000,
            noETA: false,
            tz: fetchedData.brightlineStops[stopTime.stopId].stopTZ
          }
        }),
        type: 'train',
        lat: position.latitude,
        lon: position.longitude,
        heading: position.bearing,
      }
    })

    return {
      v1: finalBrightlineV1,
      //v2: finalBrightlineV2,
      platforms: platformsData
    }
  } catch (e) {
    console.log(e);
    finalBrightlineV1.shitsFucked.shitIsFucked = true;
    finalBrightlineV1.shitsFucked.message = 'There was an error fetching from Brightline\'s API, please try again later.'
    return {
      v1: finalBrightlineV1,
      platforms: platformsData,
    };
  }
};

exports.update = updateFeed;
