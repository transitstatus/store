const fs = require('fs');
const fetch = require('node-fetch');
const GtfsRealtimeBindings = require('gtfs-realtime-bindings');
const headsignReplacements = require('./headsignReplacements');
const stopReplacements = require('./stopReplacements');
const extraBusInfo = require('./extraBusInfo');

const feeds = JSON.parse(fs.readFileSync('./endpoints/passio_go/feeds.json', 'utf8')).all;
const extraConfig = JSON.parse(fs.readFileSync('./endpoints/passio_go/extraconfig.json'));

let feedsDict = {};
feeds.forEach((feed) => {
  feedsDict[feed.username] = feed;
})

const recursivelyTryFetching = async (url, options, attempts = 5) => {
  if (attempts === 0) return {}; //default value

  const res = await fetch(url, options);

  if (!res.ok) {
    await new Promise(r => setTimeout(r, 500));
    return await recursivelyTryFetching(url, options, attempts - 1)
  }

  const data = await res.json();
  return data;
}

const keyGen = () => "pseudo101_" + 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
  var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
  return v.toString(16);
})

const idGen = (len = 8) => Math.random().toString().slice(2, 2 + len);

const average = array => array.reduce((a, b) => a + b) / array.length;

const parseTheStupidGodDamnFuckingPassioGoETAs = (raw) => {
  let actETA = '';

  const busETARaw = raw.replace('min', '').trim();

  if (busETARaw.includes('-')) { // range
    actETA = Number(busETARaw.split('-')[0]);
  } else if (busETARaw.includes('arriving')) { // now
    actETA = 0;
  } else if (busETARaw.includes('arrived')) {
    actETA = 0; // now
  } else if (busETARaw.includes('due')) { // now
    actETA = 0;
  } else if (busETARaw.includes('less than')) { // now
    actETA = 0;
  } else { //hopefully a number
    actETA = busETARaw.match(/\d+/)[0];
  }

  return actETA;
}

const updateFeed = async (feed) => {
  try {
    let vidToTripDict = {};

    //const deviceId = 64638265; //cheeky bastard moment
    const deviceId = idGen(8);
    const userId = idGen(5);

    const routesForm = `json=%7B%22systemSelected0%22%3A%22${feed.id}%22%2C%22amount%22%3A1%7D`;
    const stopsForm = `json=%7B%22s0%22%3A%22${feed.id}%22%2C%22sA%22%3A1%7D`;
    const busesForm = `json=%7B%22s0%22%3A%22${feed.id}%22%2C%22sA%22%3A1%7D`

    const routesReq = await fetch(`https://passiogo.com/mapGetData.php?getRoutes=1&deviceId=${deviceId}&wTransloc=1&userId=${userId}`, {
      "credentials": "omit",
      "headers": {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0",
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "Accept-Language": "en-US,en;q=0.5",
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        //'Contact': 'I know I am not meant to be here. If you would like to contact me, i am available at piero@piemadd.com',
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "cross-site",
        "X-Requested-With": "XMLHttpRequest"
      },
      "referrer": "https://passiogo.com/",
      "body": routesForm,
      "method": "POST",
      "mode": "cors"
    });

    const stopsReq = await fetch(`https://passiogo.com/mapGetData.php?getStops=2&deviceId=${deviceId}&withOutdated=1&wBounds=1&showBusInOos=0&lat=undefined&lng=undefined&wTransloc=1&userId=${userId}`, {
      "credentials": "omit",
      "headers": {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0",
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "Accept-Language": "en-US,en;q=0.5",
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        //'Contact': 'I know I am not meant to be here. If you would like to contact me, i am available at piero@piemadd.com',
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "cross-site",
        "X-Requested-With": "XMLHttpRequest"
      },
      "referrer": "https://passiogo.com/",
      "body": stopsForm,
      "method": "POST",
      "mode": "cors"
    });

    const busesReq = await fetch(`https://passiogo.com/mapGetData.php?getBuses=1&deviceId=${deviceId}&wTransloc=1&userId=${userId}`, {
      "credentials": "omit",
      "headers": {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0",
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "Accept-Language": "en-US,en;q=0.5",
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        //'Contact': 'I know I am not meant to be here. If you would like to contact me, i am available at piero@piemadd.com',
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "cross-site",
        "X-Requested-With": "XMLHttpRequest"
      },
      "referrer": "https://passiogo.com/",
      "body": busesForm,
      "method": "POST",
      "mode": "cors"
    });
    const routes = await routesReq.json();
    const stops = await stopsReq.json();
    const buses = await busesReq.json();

    //fs.writeFileSync('./routes.json', JSON.stringify(routes, null, 2));
    //fs.writeFileSync('./stops.json', JSON.stringify(stops, null, 2));
    //fs.writeFileSync('./buses.json', JSON.stringify(buses, null, 2));

    const lastUpdated = new Date().toISOString();

    let lineCodeReplacements = {};
    let transitStatus = {
      trains: {},
      stations: {},
      lines: {},
      lastUpdated,
    };

    //adding routes to transitStatus
    routes.forEach((route) => {
      let lineNameLong = route.nameOrig;
      let lineCode = route.myid;

      if (feed.textReplacements) {
        //console.log(feed.username, feed.textReplacements)
        feed.textReplacements.forEach((replacement) => {
          lineNameLong = lineNameLong.replace(replacement[0], replacement[1]);
        })
        //console.log(lineNameLong)
      }

      if (feed.combineBasedOnName) {
        lineCode = route.shortName.length > 0 ? route.shortName : lineNameLong;
        lineCodeReplacements[route.myid] = lineCode;
      }

      transitStatus.lines[lineCode] = {
        lineCode: lineCode,
        lineNameShort: route.shortName ?? '',
        lineNameLong: lineNameLong,
        routeColor: route.color.replace('#', '').toUpperCase(),
        routeTextColor: feed.black && feed.black.includes(lineCode) ? '000000' : 'FFFFFF',
        stations: [],
        hasActiveTrains: false,
      }
    })

    //fs.writeFileSync('./transitStatus.json', JSON.stringify(transitStatus, null, 2));

    let allStopIDs = [];

    //adding stops to transitStatus
    Object.values(stops.stops).forEach((stop) => {
      if (stopReplacements[feed.username] && stopReplacements[feed.username][stop.id]) {
        //not actually doing anything, just dont want dupes or anything
      } else {
        transitStatus.stations[stop.id] = {
          stationID: stop.id,
          stationName: stop.name,
          destinations: {},
          lat: stop.latitude,
          lon: stop.longitude,
        };
      }
      allStopIDs.push(stop.id);
    });

    let routeStations = {};

    //adding lines and destinations to transitstatus
    Object.keys(stops.routes).forEach((routeKey) => {
      const route = stops.routes[routeKey];
      const betterRouteKey = feed.combineBasedOnName ? lineCodeReplacements[routeKey] : routeKey;

      //remove first 3 items from route array
      route.shift();
      route.shift();
      route.shift();

      routeStations[betterRouteKey] = [...route.map((stop) => stop[1])].map((stationID) => {
        if (stopReplacements[feed.username] && stopReplacements[feed.username][stationID]) {
          return stopReplacements[feed.username][stationID];
          //return stationID;
        } else {
          return stationID;
        }
      })

      const finalStopName = transitStatus.stations[route[route.length - 1][1]].stationName;

      route.forEach((stop) => {
        if (stopReplacements[feed.username] && stopReplacements[feed.username][stop[1]]) {
          stop[1] = stopReplacements[feed.username][stop[1]];
        }

        let stopID = stop[1];
        if (stopReplacements[feed.username] && stopReplacements[feed.username][stop[1]]) {
          stopID = stopReplacements[feed.username][stop[1]];
        }

        let thisStopFinalStopName = finalStopName;

        if (headsignReplacements[feed.username] && headsignReplacements[feed.username][betterRouteKey]) {
          const replacement = headsignReplacements[feed.username][betterRouteKey].replacements[stopID];

          if (replacement) {
            thisStopFinalStopName = replacement;
          } else {
            console.log(`No replacement for ${betterRouteKey} ${stopID}`)
          }
        };

        if (!transitStatus.stations[stopID].destinations[thisStopFinalStopName]) {
          transitStatus.stations[stopID].destinations[thisStopFinalStopName] = {
            trains: [],
          };
        }

        if (!transitStatus.lines[betterRouteKey].stations.includes(stopID)) {
          transitStatus.lines[betterRouteKey].stations.push(stopID);
        }
      });
    });

    //adding buses to transitStatus
    Object.values(buses.buses).forEach((busArr) => {
      const bus = busArr[0];
      const busLineCode = feed.combineBasedOnName ? lineCodeReplacements[bus.routeId] : bus.routeId;
      const busLine = transitStatus.lines[busLineCode];

      if (bus['-1'] && bus['-1'].length === 0) return;

      if (!busLine) return;

      transitStatus.trains[bus.bus] = {
        lat: Number(bus.latitude),
        lon: Number(bus.longitude),
        heading: Number(bus.calculatedCourse),
        line: busLine.lineNameLong,
        lineCode: busLineCode,
        lineColor: busLine.routeColor,
        lineTextColor: busLine.routeTextColor,
        dest: stops.routes[bus.routeId] ? transitStatus.stations[stops.routes[bus.routeId][0][1]].stationName : 'Unknown Destination',
        predictions: [],
        type: 'bus',
        extra: {
          load: bus.paxLoad,
          cap: bus.totalCap,
          info: extraBusInfo[feed.username] && extraBusInfo[feed.username][bus.bus] ? extraBusInfo[feed.username][bus.bus] : null,
        }
      };

      if (headsignReplacements[feed.username] && headsignReplacements[feed.username][busLineCode]) {
        const replacement = headsignReplacements[feed.username][busLineCode].replacements[stops.routes[busLineCode][0][1]];

        if (replacement) {
          transitStatus.trains[bus.bus].dest = replacement;
        }
      }

      transitStatus.lines[busLineCode].hasActiveTrains = true;
    });

    let fullPredictions = {};

    const chunkSize = 10;
    for (let j = 0; j < allStopIDs.length; j += chunkSize) {
      const chunk = allStopIDs.slice(j, j + chunkSize);
      const chunkString = chunk.join(',');

      let predictions = await recursivelyTryFetching(`https://passiogo.com/mapGetData.php?eta=3&deviceId=${deviceId}&stopIds=${chunkString}&position=0&userId=${userId}`, {
        "credentials": "omit",
        "headers": {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
          //'Contact': 'I know I am not meant to be here. If you would like to contact me, i am available at passiogosucksass@piemadd.com',
          "Accept-Language": "en-US,en;q=0.5",
          "Upgrade-Insecure-Requests": "1",
          "Sec-Fetch-Dest": "document",
          "Sec-Fetch-Mode": "navigate",
          "Sec-Fetch-Site": "cross-site"
        },
        "method": "GET",
        "mode": "cors"
      });

      if (Object.keys(predictions).length === 0) {
        predictions = {
          ETAs: {},
        }
      }

      Object.keys(predictions.ETAs).forEach((stopKey) => {
        if (!fullPredictions[stopKey]) fullPredictions[stopKey] = [];

        fullPredictions[stopKey].push(...predictions.ETAs[stopKey]);
      });
    }

    let fallbackData = null;
    if (feed.rtfallback) {
      const fallbackRes = await fetch(feed.rtfallback, {
        "credentials": "omit",
        "headers": {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/119.0",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
          "Upgrade-Insecure-Requests": "1",
          "Sec-Fetch-Dest": "document",
          "Sec-Fetch-Mode": "navigate",
          "Sec-Fetch-Site": "none",
          "Sec-Fetch-User": "?1"
        },
        "method": "GET",
        "mode": "cors"
      });

      if (!fallbackRes.ok) {
        console.log(`Fallback died for ${feed.username}, welp`)
      } else {
        const buffer = await fallbackRes.arrayBuffer();
        const trackingFeed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(new Uint8Array(buffer));

        let finalFeed = {};

        //console.log(JSON.stringify(trackingFeed.entity))

        trackingFeed.entity.forEach((update) => {
          if (update.tripUpdate) {
            finalFeed[update.tripUpdate.trip.tripId] = {};

            update.tripUpdate.stopTimeUpdate.forEach((time) => {
              //stop replacements
              const stopId = stopReplacements[feed.username] && stopReplacements[feed.username][time.stopId] ? stopReplacements[feed.username][time.stopId] : time.stopId;

              finalFeed[update.tripUpdate.trip.tripId][stopId] = Math.max(time.arrival.time.low * 1000, time.arrival.time.high * 1000);
            })
          }
        });

        fallbackData = finalFeed;
      }
    }

    const now = new Date().valueOf();
    Object.keys(fullPredictions).forEach((stopKey) => {
      const stop = fullPredictions[stopKey];

      const actualStopKey = stopReplacements[feed.username] && stopReplacements[feed.username][stopKey] ? stopReplacements[feed.username][stopKey] : stopKey;
      //const actualStopKey = stopKey;

      const iteratableStop = Array.isArray(stop) ? stop : Object.values(stop);

      iteratableStop.forEach((bus) => {
        if (!bus.busName) return;

        let rawETA = bus.etaR;

        if (!rawETA) rawETA = parseTheStupidGodDamnFuckingPassioGoETAs(bus.eta);

        if (!rawETA) {
          const res = parseTheStupidGodDamnFuckingPassioGoETAs(bus.eta); //fallback

          if (isNaN(res)) {
            if (!transitStatus.trains[bus.busName]) return;

            transitStatus.trains[bus.busName].predictions.push({
              stationID: actualStopKey,
              stationName: transitStatus.stations[actualStopKey].stationName,
              actualETA: 0,
              noETA: true,
            });
            return; //exiting loop
          } else {
            rawETA = res; //putting in fallback if valid
          }
        }

        if (!isNaN(rawETA)) rawETA = rawETA.toString(); //in case its already a number
        const rawArr = rawETA.split(':').map(n => parseInt(n)); //ensuring all parts of the ETA as numbers

        let finalETA = rawArr[0]; //assuming only minutes
        if (rawArr.length > 1) finalETA = (rawArr[0] * 60) + rawArr[1]; //if an hours figure exists

        if (!transitStatus.trains[bus.busName]) return; //cant assign an ETA to a bus that doesnt exist

        let finalETAVal = new Date(now + (finalETA * 60000)).valueOf(); //adding minutes offset to current date

        vidToTripDict[bus.busName] = bus.tripId;

        transitStatus.trains[bus.busName].predictions.push({
          stationID: actualStopKey,
          stationName: transitStatus.stations[actualStopKey].stationName,
          actualETA: finalETAVal,
          noETA: false,
        });
      })
    });

    let totalBefore = 0;
    let totalAfter = 0;
    Object.keys(transitStatus.trains).forEach((trainKey) => {
      let train = transitStatus.trains[trainKey];

      let predictionStopKeys = [];
      let predictionsDict = {};

      train.predictions.forEach((stop) => {
        predictionStopKeys.push(stop.stationID);
        predictionsDict[stop.stationID] = stop;
      })

      totalBefore += predictionStopKeys.length;

      //trying gtfs-rt override
      if (fallbackData) { //do we have data to override with?
        if (vidToTripDict[trainKey]) { //do we have a trip ID?
          if (fallbackData[vidToTripDict[trainKey]]) { //does our trip have better estimates?
            Object.keys(fallbackData[vidToTripDict[trainKey]]).forEach((stopKey) => {
              if (!predictionsDict[stopKey]) { //seeing if the prediction exists
                if (!transitStatus.stations[stopKey]) return

                predictionsDict[stopKey] = {
                  stationID: stopKey,
                  stationName: transitStatus.stations[stopKey].stationName,
                  actualETA: fallbackData[vidToTripDict[trainKey]][stopKey],
                  noETA: false,
                  realTime: true,
                }
              } else {
                predictionsDict[stopKey].actualETA = fallbackData[vidToTripDict[trainKey]][stopKey]
              }
            })
          }
        }
      }

      /*
      // now that our predictions are all retrieved, we're going to use as much data as possible to fill in missing ETAs
      Object.values(predictionsDict).forEach((station) => {

      })
      */


      totalAfter += Object.keys(predictionsDict).length;

      train.predictions = Object.values(predictionsDict);

      transitStatus.trains[trainKey].predictions = train.predictions.sort((a, b) => a.actualETA - b.actualETA);

      //adding predictions to each station
      train.predictions.forEach((prediction, i) => {
        const hasReplacement = headsignReplacements[feed.username] && headsignReplacements[feed.username][train.lineCode];

        if (i === 0) {
          if (hasReplacement) {
            const replacement = headsignReplacements[feed.username][train.lineCode].replacements[prediction.stationID];

            if (replacement) {
              transitStatus.trains[trainKey].dest = replacement;
            }
          }
        }

        const realDest = hasReplacement ? headsignReplacements[feed.username][train.lineCode].replacements[prediction.stationID] : train.dest;
        if (!transitStatus.stations[prediction.stationID].destinations[realDest]) {
          transitStatus.stations[prediction.stationID].destinations[realDest] = {
            trains: [],
          };
        }

        transitStatus.stations[prediction.stationID].destinations[realDest].trains.push({
          runNumber: trainKey,
          //eta: prediction.eta,
          actualETA: prediction.actualETA,
          noETA: prediction.noETA,
          realTime: true,
          line: train.line,
          lineCode: train.lineCode,
          lineColor: train.lineColor,
          lineTextColor: train.lineTextColor,
          extra: train.extra,
        });
      });
    })

    console.log(`Finished updating ${feed.username}`)
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
        message: 'Passio\'s system broke so that means I can\'t get any data. Please try again in a few minutes.'
      }
    };
  }
};

const updateFeedInd = async (feedKey) => {
  let feed = feedsDict[feedKey];

  //if (feed.username !== '') return false;

  if (extraConfig[feed.username]) {
    feed = {
      ...feed,
      ...extraConfig[feed.username]
    }
  }

  const feedData = await updateFeed(feed);

  console.log(`Finished updating ${feed.username}`)

  return feedData;
}

exports.update = updateFeedInd;
