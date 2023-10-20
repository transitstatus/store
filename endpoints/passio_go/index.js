const fs = require('fs');
const fetch = require('node-fetch');
const headsignReplacements = require('./headsignReplacements');
const stopReplacements = require('./stopReplacements');
const extraBusInfo = require('./extraBusInfo');

const feeds = JSON.parse(fs.readFileSync('./endpoints/passio_go/feeds.json', 'utf8')).all;
const extraConfig = JSON.parse(fs.readFileSync('./endpoints/passio_go/extraconfig.json'));

let feedsDict = {};
feeds.forEach((feed) => {
  feedsDict[feed.username] = feed;
})

const keyGen = () => "pseudo101_" + 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
  var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
  return v.toString(16);
})

const average = array => array.reduce((a, b) => a + b) / array.length;

const updateFeed = async (feed) => {
  try {
    const key = keyGen();

    const deviceIdReq = await fetch(`https://passiogo.com/goServices.php?register=1&deviceId=0&token=${key}&platform=web&buildNo=undefined&oldToken=`, {
      "headers": {
        'Host': 'rutgers.passiogo.com',
        'User-Agent': 'Mozilla/ 5.0(Windows NT 10.0; Win64; x64; rv: 109.0) Gecko / 20100101 Firefox / 116.0',
        'Accept': 'application / json, text / javascript, */*; q=0.01',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'X-Requested-With': 'XMLHttpRequest',
        'Connection': 'keep-alive',
        'Contact': 'I know I am not meant to be here. If you would like to contact me, i am available at passiogosucksass@piemadd.com',
        'Referer': 'https://passiogo.com/',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin',
      },
      "method": "GET",
    });
    const { deviceId } = await deviceIdReq.json();

    const routesForm = `json=%7B%22systemSelected0%22%3A%22${feed.id}%22%2C%22amount%22%3A1%7D`;
    const stopsForm = `json=%7B%22s0%22%3A%22${feed.id}%22%2C%22sA%22%3A1%7D`;
    const busesForm = `json=%7B%22s0%22%3A%22${feed.id}%22%2C%22sA%22%3A1%7D`

    const routesReq = await fetch(`https://passiogo.com/mapGetData.php?getRoutes=1&deviceId=${deviceId}&wTransloc=1`, {
      "credentials": "omit",
      "headers": {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/116.0",
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "Accept-Language": "en-US,en;q=0.5",
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        'Contact': 'I know I am not meant to be here. If you would like to contact me, i am available at passiogosucksass@piemadd.com',
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "cross-site"
      },
      "referrer": "https://passiogo.com/",
      "body": routesForm,
      "method": "POST",
      "mode": "cors"
    });

    const stopsReq = await fetch(`https://passiogo.com/mapGetData.php?getStops=2&deviceId=${deviceId}&withOutdated=1&wBounds=1&showBusInOos=0&lat=undefined&lng=undefined&wTransloc=1`, {
      "credentials": "omit",
      "headers": {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/116.0",
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "Accept-Language": "en-US,en;q=0.5",
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        'Contact': 'I know I am not meant to be here. If you would like to contact me, i am available at passiogosucksass@piemadd.com',
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "cross-site"
      },
      "referrer": "https://passiogo.com/",
      "body": stopsForm,
      "method": "POST",
      "mode": "cors"
    });

    const busesReq = await fetch(`https://passiogo.com/mapGetData.php?getBuses=1&deviceId=${deviceId}&wTransloc=1`, {
      "credentials": "omit",
      "headers": {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/116.0",
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "Accept-Language": "en-US,en;q=0.5",
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        'Contact': 'I know I am not meant to be here. If you would like to contact me, i am available at passiogosucksass@piemadd.com',
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "cross-site"
      },
      "referrer": "https://passiogo.com/",
      "body": busesForm,
      "method": "POST",
      "mode": "cors"
    });

    const routes = await routesReq.json();
    const stops = await stopsReq.json();
    const buses = await busesReq.json();

    //console.log(routes)
    //console.log(stops)
    //console.log(buses)

    //fs.writeFileSync('./routes.json', JSON.stringify(routes, null, 2));
    //fs.writeFileSync('./stops.json', JSON.stringify(stops, null, 2));
    //fs.writeFileSync('./buses.json', JSON.stringify(buses, null, 2));

    const lastUpdated = new Date().toISOString();

    let transitStatus = {
      trains: {},
      stations: {},
      lines: {},
      lastUpdated,
    };

    //adding routes to transitStatus
    routes.forEach((route) => {
      let lineNameLong = route.nameOrig;

      if (feed.textReplacements) {
        //console.log(feed.username, feed.textReplacements)
        feed.textReplacements.forEach((replacement) => {
          lineNameLong = lineNameLong.replace(replacement[0], replacement[1]);
        })
        //console.log(lineNameLong)
      }

      transitStatus.lines[route.myid] = {
        lineCode: route.myid,
        lineNameShort: route.shortName ?? '',
        lineNameLong: lineNameLong,
        routeColor: route.color.replace('#', '').toUpperCase(),
        routeTextColor: feed.black && feed.black.includes(route.myid) ? '000000' : 'FFFFFF',
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

      //remove first 3 items from route array
      route.shift();
      route.shift();
      route.shift();

      routeStations[routeKey] = [...route.map((stop) => stop[1])].map((stationID) => {
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

        if (headsignReplacements[feed.username] && headsignReplacements[feed.username][routeKey]) {
          const replacement = headsignReplacements[feed.username][routeKey].replacements[stopID];

          if (replacement) {
            thisStopFinalStopName = replacement;
          } else {
            console.log(`No replacement for ${routeKey} ${stopID}`)
          }
        };

        if (!transitStatus.stations[stopID].destinations[thisStopFinalStopName]) {
          transitStatus.stations[stopID].destinations[thisStopFinalStopName] = {
            trains: [],
          };
        }

        if (!transitStatus.lines[routeKey].stations.includes(stopID)) {
          transitStatus.lines[routeKey].stations.push(stopID);
        }
      });
    });

    //adding buses to transitStatus
    Object.values(buses.buses).forEach((busArr) => {
      const bus = busArr[0];
      const busLine = transitStatus.lines[bus.routeId];

      if (bus['-1'] && bus['-1'].length === 0) return;

      if (!busLine) return;

      transitStatus.trains[bus.bus] = {
        lat: Number(bus.latitude),
        lon: Number(bus.longitude),
        heading: Number(bus.calculatedCourse),
        line: busLine.lineNameLong,
        lineCode: bus.routeId,
        lineColor: busLine.routeColor,
        lineTextColor: busLine.routeTextColor,
        dest: stops.routes[bus.routeId] ? transitStatus.stations[stops.routes[bus.routeId][0][1]].stationName : 'Unknown Destination',
        predictions: [],
        extra: {
          load: bus.paxLoad,
          cap: bus.totalCap,
          info: extraBusInfo[feed.username] && extraBusInfo[feed.username][bus.bus] ? extraBusInfo[feed.username][bus.bus] : null,
        }
      };

      if (headsignReplacements[feed.username] && headsignReplacements[feed.username][bus.routeId]) {
        const replacement = headsignReplacements[feed.username][bus.routeId].replacements[stops.routes[bus.routeId][0][1]];

        if (replacement) {
          transitStatus.trains[bus.bus].dest = replacement;
        }
      }

      transitStatus.lines[bus.routeId].hasActiveTrains = true;
    });

    const predictionsRes = await fetch(`https://passiogo.com/mapGetData.php?eta=3&deviceId=20331424&stopIds=${allStopIDs.join(',')}`, {
      "credentials": "omit",
      "headers": {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/116.0",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        'Contact': 'I know I am not meant to be here. If you would like to contact me, i am available at passiogosucksass@piemadd.com',
        "Accept-Language": "en-US,en;q=0.5",
        "Upgrade-Insecure-Requests": "1",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "cross-site"
      },
      "method": "GET",
      "mode": "cors"
    });
    const predictions = await predictionsRes.json();

    //if (feed.username === 'rutgers') fs.writeFileSync('./predictions.json', JSON.stringify(predictions, null, 2));
    //console.log(`https://passio3.com/www/mapGetData.php?eta=3&deviceId=20331424&stopIds=${allStopIDs.join(',')}`)

    const now = new Date().valueOf();
    Object.keys(predictions.ETAs).forEach((stopKey) => {
      const stop = predictions.ETAs[stopKey];

      const actualStopKey = stopReplacements[feed.username] && stopReplacements[feed.username][stopKey] ? stopReplacements[feed.username][stopKey] : stopKey;
      //const actualStopKey = stopKey;

      const iteratableStop = Array.isArray(stop) ? stop : Object.values(stop);

      iteratableStop.forEach((bus) => {
        if (!bus.busName) return;

        if (bus.theStop.shortName === 'a') {
          //console.log(bus.theStop.stopId, actualStopKey)
        }

        let actETA = '';
        let noETA = false;
        const busETARaw = bus.eta.replace('min', '').trim();

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
          actETA = Number(busETARaw);
        }

        if (isNaN(actETA)) return;
        if (bus.eta === '--') noETA = true;

        if (!transitStatus.trains[bus.busName]) return;

        transitStatus.trains[bus.busName].predictions.push({
          stationID: actualStopKey,
          stationName: transitStatus.stations[actualStopKey].stationName,
          //eta: actETA,
          //busETARaw: bus.eta,
          actualETA: new Date(now + (actETA * 60000)).valueOf(),
          noETA,
        });
      })
    });

    Object.keys(transitStatus.trains).forEach((trainKey) => {
      const train = transitStatus.trains[trainKey];

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
        message: 'Passio\'s system broke so that means I can\'t get any data. Sowwy 🥺'
      }
    };
  }
};

const updateFeeds = async () => {
  const onlyThese = ['rutgers', 'chicago', 'gcsu', 'georgiast', 'gatech', 'GASO', 'mit', 'newyork', 'uncc', 'uncg', 'uncw', 'bamabama', 'ncstateuni'];
  let finalFeeds = {};

  for (let i = 0; i < feeds.length; i++) {
    let feed = feeds[i];

    if (extraConfig[feed.username]) {
      feed = {
        ...feed,
        ...extraConfig[feed.username]
      }
    }

    if (!onlyThese.includes(feed.username)) continue;

    const feedData = await updateFeed(feed);

    finalFeeds[feed.username] = feedData;
  }

  return finalFeeds;
};

const updateFeedInd = async (feedKey) => {
  let feed = feedsDict[feedKey];

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
