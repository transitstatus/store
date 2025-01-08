const fetch = require('node-fetch');

require('dotenv').config();

const actualLines = {
  'BNSF': 'BNSF',
  'HC': 'Heritage Corridor',
  'MD-N': 'Milwaukee District North',
  'MD-W': 'Milwaukee District West',
  'ME': 'Metra Electric',
  'NCS': 'North Central Service',
  'RI': 'Rock Island',
  'SWS': 'Southwest Service',
  'UP-N': 'Union Pacific North',
  'UP-NW': 'Union Pacific Northwest',
  'UP-W': 'Union Pacific West',
};

const holidayTrains = [
  'ME-BX02',
  'ME-BX03',
  'ME-BX04',
  'ME-BX05',
  'BNSF-9513',
  'BNSF-9516',
  'RI-MX01',
  'RI-MX02',
  'MDN-NX02',
  'MDN-NX03',
  'UPN-8911',
  'UPN-8914',
  'UPNW-7902',
  'UPNW-7903',
]

const recursivelyParseObjectValuesIntoString = (obj) => {
  if (typeof obj === 'string') {
    if (obj === '') {
      return [];
    }

    const tempArr = obj.split('. ');
    if (tempArr.length > 1) {
      return tempArr;
    }

    return [obj];
  }

  const keys = Object.keys(obj);
  const values = Object.values(obj);

  let final = [];

  for (let i = 0; i < keys.length; i++) {
    if (typeof values[i] === 'object') {
      final.push(recursivelyParseObjectValuesIntoString(values[i]));
    } else {
      if (values[i] === '') {
        continue;
      }
      final.push(values[i]);
    }
  }

  return final;
};

const update = (async () => {
  if (!process.env.metra_authorization) return false;

  try {
    const res = await fetch('https://gtfsapi.metrarail.com/gtfs/tripUpdates', {
      "credentials": "include",
      "headers": {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/115.0",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Authorization": process.env.metra_authorization,
        "Upgrade-Insecure-Requests": "1",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "cross-site",
        "Pragma": "no-cache",
        "Cache-Control": "no-cache"
      },
      "method": "GET",
      "mode": "cors"
    });

    const staticStopsRes = await fetch('https://gtfs.piemadd.com/data/metra/stops.json');
    const staticStopsData = await staticStopsRes.json();

    const staticRoutesRes = await fetch('https://gtfs.piemadd.com/data/metra/routes.json');
    const staticRoutesData = await staticRoutesRes.json();

    const staticScheduleRes = await fetch(`https://gobblerstatic.transitstat.us/schedules/metra/${new Date().toISOString().split('T')[0]}.json`);
    const staticScheduleData = await staticScheduleRes.json();

    const staticHeadsignsRes = await fetch('https://gobblerstatic.transitstat.us/schedules/metra/headsigns.json');
    const staticHeadsignsData = await staticHeadsignsRes.json();

    const data = await res.json();

    const processedData = data.map((train) => {
      return {
        trip: train.trip_update?.trip,
        vehicle: train.trip_update?.vehicle,
        position: train.trip_update?.position?.vehicle?.position,
        stops: train.trip_update?.stop_time_update,
      }
    });

    let transitStatus = {
      trains: {},
      stations: {},
      lines: {},
    };

    //adding trains to transitStatus object
    data.forEach((train, i) => {
      const runNumber = `${train.trip_update?.trip?.route_id.replaceAll('-', '')}-${train.trip_update?.vehicle?.label ?? train.trip_update?.vehicle?.id}`;

      let finalTrain = {
        lat: train.trip_update?.position?.vehicle?.position?.latitude,
        lon: train.trip_update?.position?.vehicle?.position?.longitude,
        heading: train.trip_update?.position?.vehicle?.position?.bearing,
        line: actualLines[train.trip_update?.trip?.route_id],
        lineCode: train.trip_update?.trip?.route_id,
        lineColor: staticRoutesData[train.trip_update?.trip?.route_id].routeColor,
        lineTextColor: staticRoutesData[train.trip_update?.trip?.route_id].routeTextColor,
        dest: staticRoutesData[train.trip_update?.trip?.route_id].routeTrips[train.trip_update?.trip?.trip_id]?.headsign ?? "Unknown Dest",
        predictions: [],
        type: 'train',
        extra: {
          holidayChristmas: holidayTrains.includes(runNumber),
        }
      }

      //adding predictions to transitStatus object
      train.trip_update?.stop_time_update?.forEach((stop) => {
        const arr = new Date(stop.arrival?.time?.low).valueOf();
        const dep = new Date(stop.departure?.time?.low).valueOf();
        const time = Math.max(arr, dep);
        const now = new Date().valueOf();
        const eta = Math.round((time - now) / 60000);

        finalTrain.predictions.push({
          stationID: stop.stop_id,
          stationName: staticStopsData[stop.stop_id].stopName,
          //eta: eta,
          actualETA: time,
          noETA: false,
        });

        //adding stations to transitStatus object
        if (!transitStatus.stations[stop.stop_id]) {
          transitStatus.stations[stop.stop_id] = {
            stationID: stop.stop_id,
            stationName: staticStopsData[stop.stop_id].stopName,
            lat: staticStopsData[stop.stop_id].stopLat,
            lon: staticStopsData[stop.stop_id].stopLon,
            destinations: {},
          };
        }

        const finalStation = staticRoutesData[train.trip_update?.trip?.route_id].routeTrips[train.trip_update?.trip?.trip_id]?.headsign ?? "Unknown Dest";

        //adding destinations to transitStatus object
        if (!transitStatus.stations[stop.stop_id].destinations[finalStation]) {
          transitStatus.stations[stop.stop_id].destinations[finalStation] = {
            trains: [],
          };
        };

        transitStatus.stations[stop.stop_id].destinations[finalStation].trains.push({
          runNumber: runNumber,
          //eta: eta,
          actualETA: time,
          noETA: false,
          realTime: true,
          line: finalTrain.line,
          lineCode: finalTrain.lineCode,
          lineColor: finalTrain.lineColor,
          lineTextColor: finalTrain.lineTextColor,
          extra: {
            holidayChristmas: holidayTrains.includes(runNumber),
          }
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
            destinations: {},
          };
        }

        route.destinations.forEach((destination) => {
          if (!transitStatus.stations[stationID].destinations[destination]) {
            transitStatus.stations[stationID].destinations[destination] = {
              trains: [],
            };
          }
        })
      });
    });

    Object.keys(transitStatus.trains).forEach((train) => {
      const trainData = transitStatus.trains[train];

      transitStatus.lines[trainData.lineCode].hasActiveTrains = true;
    });

    const lastUpdated = new Date().toISOString();
    const lastUpdatedNum = new Date(lastUpdated).valueOf();

    transitStatus.lastUpdated = lastUpdated;

    //filling in schedule data
    const startOfDay = `${new Date().toISOString().split('T')[0]}T00:00:00.000Z`; // Midnight UTC in ISO-8601
    Object.keys(transitStatus.stations).forEach((stationKey) => {
      if (!staticScheduleData[stationKey]) return;

      let now = new Date(startOfDay).valueOf();
      let headsign = null; //NOT headsign id
      let routeID = null;

      const staticStationData = staticScheduleData[stationKey];
      for (i = 0; i < staticStationData.length; i++) {
        const thisVehicle = staticStationData[i];

        now += (thisVehicle[0] * 1000);
        headsign = (thisVehicle[1] && thisVehicle[1] >= 0) ? staticHeadsignsData[thisVehicle[1]] : headsign;
        routeID = thisVehicle[2] ?? routeID;

        if (now < lastUpdatedNum || now > lastUpdatedNum + (1000 * 60 * 60 * 4)) return;

        transitStatus.stations[stationKey]['destinations'][headsign]['trains'].push({
          runNumber: "Scheduled",
          actualETA: now,
          noETA: false,
          realTime: false,
          line: staticRoutesData[routeID].routeLongName,
          lineCode: routeID,
          lineColor: staticRoutesData[routeID].lineColor,
          lineTextColor: staticRoutesData[routeID].lineTextColor,
          extra: {},
        })
      }
    })

    return {
      trains: processedData,
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