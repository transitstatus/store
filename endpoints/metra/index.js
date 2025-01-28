const fetch = require('node-fetch');
const protobuf = require('protobufjs');

require('dotenv').config();

const trainNumberRegex = new RegExp(/\d+/)

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

const downtownStations = [
  'Chicago OTC',
  'Chicago Union Station',
  'LaSalle Street',
  'Millennium Station',
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

    const todaysDate = new Date();
    const yesterdaysDate = new Date(todaysDate.valueOf() - (1000 * 60 * 60 * 24));

    const root = await protobuf.load('schedules.proto');
    const ScheduleMessage = root.lookupType('gobbler.ScheduleMessage');

    const [
      staticStopsData,
      staticRoutesData,
      staticMetaData,
    ] = await Promise.all([
      'https://gtfs.piemadd.com/data/metra/stops.json',
      'https://gtfs.piemadd.com/data/metra/routes.json',
      'https://gobblerstatic.transitstat.us/schedules/metra/metadata.json',
    ].map((url) =>
      fetch(url).then(res => res.json())
    ));

    const [
      staticScheduleArray,
      yesterdayStaticScheduleArray,
    ] = await Promise.all([
      `https://gobblerstatic.transitstat.us/schedules/metra/${todaysDate.toISOString().split('T')[0]}.pbf`,
      `https://gobblerstatic.transitstat.us/schedules/metra/${yesterdaysDate.toISOString().split('T')[0]}.pbf`,
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
      const trainNumber = train.trip_update?.trip?.trip_id.match(trainNumberRegex);
      if (!trainNumber) return; //no train ig

      const runNumber = `${train.trip_update?.trip?.route_id.replaceAll('-', '')}-${trainNumber[0]}`;
      const isInbound = parseInt(trainNumber[0]) % 2 == 0;
      const trainDirection = isInbound ? 'Inbound' : 'Outbound';
      
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

        finalTrain.predictions.push({
          stationID: stop.stop_id,
          stationName: staticStopsData[stop.stop_id].stopName,
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
            destinations: {
              'Inbound': {trains: []},
              'Outbound': {trains: []},
            },
          };
        }

        const finalStation = staticRoutesData[train.trip_update?.trip?.route_id].routeTrips[train.trip_update?.trip?.trip_id]?.headsign ?? "Unknown Dest";

        transitStatus.stations[stop.stop_id].destinations[trainDirection].trains.push({
          runNumber: runNumber,
          actualETA: time,
          noETA: false,
          realTime: true,
          line: finalTrain.line,
          lineCode: finalTrain.lineCode,
          lineColor: finalTrain.lineColor,
          lineTextColor: finalTrain.lineTextColor,
          destination: finalStation,
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
            destinations: {
              'Inbound': {trains: []},
              'Outbound': {trains: []},
            },
          };
        }
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

          const trainDirection = parseInt(thisVehicle.runNumber.split('-')[1]) % 2 == 0 ? 'Inbound' : 'Outbound';

          if (transitStatus.stations[stationKey]['destinations'][trainDirection]['trains'].length >= 4) continue; //we dont need all that
          if (thisVehicle.runNumber && transitStatus.trains[thisVehicle.runNumber]) continue; // train is tracking

          transitStatus.stations[stationKey]['destinations'][trainDirection]['trains'].push({
            runNumber: thisVehicle.runNumber ? thisVehicle.runNumber : 'Scheduled',
            actualETA: now,
            noETA: false,
            realTime: false,
            line: staticRoutesData[routeID].routeLongName,
            lineCode: routeID,
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