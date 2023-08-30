const fs = require('fs');
const fetch = require('node-fetch');

const feeds = JSON.parse(fs.readFileSync('./endpoints/passio_go/feeds.json', 'utf8')).all;

const keyGen = () => "pseudo101_" + 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
  var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
  return v.toString(16);
})

const average = array => array.reduce((a, b) => a + b) / array.length;

const updateFeed = async (feed) => {
  const key = keyGen();

  const deviceIdReq = await fetch(`https://rutgers.passiogo.com/goServices.php?register=1&deviceId=0&token=${key}&platform=web&buildNo=undefined&oldToken=`, {
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

  const routesReq = await fetch(`https://passio3.com/www/mapGetData.php?getRoutes=1&deviceId=${deviceId}&wTransloc=1`, {
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

  const stopsReq = await fetch(`https://passio3.com/www/mapGetData.php?getStops=2&deviceId=${deviceId}&withOutdated=1&wBounds=1&showBusInOos=0&lat=undefined&lng=undefined&wTransloc=1`, {
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

  const busesReq = await fetch(`https://passio3.com/www/mapGetData.php?getBuses=1&deviceId=${deviceId}&wTransloc=1`, {
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
    transitStatus.lines[route.myid] = {
      lineCode: route.myid,
      lineNameShort: route.shortName ?? '',
      lineNameLong: route.nameOrig,
      routeColor: route.color.replace('#', ''),
      routeTextColor: feed.black && feed.black.includes(route.myid) ? '000000' : 'FFFFFF',
      stations: [],
      hasActiveTrains: false,
    }
  })

  //fs.writeFileSync('./transitStatus.json', JSON.stringify(transitStatus, null, 2));

  let allStopIDs = [];

  //adding stops to transitStatus
  Object.values(stops.stops).forEach((stop) => {
    allStopIDs.push(stop.id);

    transitStatus.stations[stop.id] = {
      stationID: stop.id,
      stationName: stop.name,
      destinations: {},
      lat: stop.latitude,
      lon: stop.longitude,
    };
  });

  let routeStations = {};

  //adding lines and destinations to transitstatus
  Object.keys(stops.routes).forEach((routeKey) => {
    const route = stops.routes[routeKey];

    //remove first 3 items from route array
    route.shift();
    route.shift();
    route.shift();

    routeStations[routeKey] = [...route.map((stop) => stop[1])];

    const finalStopName = transitStatus.stations[route[route.length - 1][1]].stationName;

    route.forEach((stop) => {
      transitStatus.stations[stop[1]].destinations[finalStopName] = {
        trains: [],
      };

      if (!transitStatus.lines[routeKey].stations.includes(stop[1])) {
        transitStatus.lines[routeKey].stations.push(stop[1]);
      }
    });
  });

  //adding buses to transitStatus
  Object.values(buses.buses).forEach((busArr) => {
    const bus = busArr[0];
    const busLine = transitStatus.lines[bus.routeId];

    if (bus['-1'] && bus['-1'].length === 0) return;

    transitStatus.trains[bus.bus] = {
      lat: bus.latitude,
      lon: bus.longitude,
      heading: bus.calculatedCourse,
      line: busLine.lineNameLong,
      lineCode: bus.routeId,
      lineColor: busLine.routeColor,
      lineTextColor: busLine.routeTextColor,
      dest: transitStatus.stations[stops.routes[bus.routeId][stops.routes[bus.routeId].length - 1][1]].stationName,
      predictions: []
    };

    transitStatus.lines[bus.routeId].hasActiveTrains = true;
  });

  const predictionsRes = await fetch(`https://passio3.com/www/mapGetData.php?eta=3&deviceId=20331424&stopIds=${allStopIDs.join(',')}`, {
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

  const now = new Date().valueOf();
  Object.keys(predictions.ETAs).forEach((stopKey) => {
    const stop = predictions.ETAs[stopKey];

    stop.forEach((bus) => {
      if (!bus.busName) return;

      let actETA = '';
      const busETARaw = bus.eta.replace(' min ', '');

      if (busETARaw.includes('-')) { // range
        actETA = average(busETARaw.split('-').map((n) => Number(n)));
      } else if (busETARaw.includes('arriving')) { // now
        actETA = 0;
      } else { //hopefully a number
        actETA = Number(busETARaw);
      }

      if (isNaN(actETA)) return;

      if (!transitStatus.trains[bus.busName]) return;

      transitStatus.trains[bus.busName].predictions.push({
        stationID: stopKey,
        stationName: transitStatus.stations[stopKey].stationName,
        eta: actETA,
        actualETA: new Date(now + (actETA * 60000)).valueOf(),
      });
    })
  });

  Object.keys(transitStatus.trains).forEach((trainKey) => {
    const train = transitStatus.trains[trainKey];

    transitStatus.trains[trainKey].predictions = train.predictions.sort((a, b) => a.actualETA - b.actualETA);

    //adding predictions to each station
    train.predictions.forEach((prediction) => {
      if (!transitStatus.stations[prediction.stationID].destinations[train.dest]) {
        transitStatus.stations[prediction.stationID].destinations[train.dest] = {
          trains: [],
        };
      }

      transitStatus.stations[prediction.stationID].destinations[train.dest].trains.push({
        runNumber: trainKey,
        eta: prediction.eta,
        actualETA: prediction.actualETA,
        line: train.line,
        lineCode: train.lineCode,
        lineColor: train.lineColor,
        lineTextColor: train.lineTextColor,
      });
    });
  })

  return transitStatus;
};

const updateFeeds = async () => {
  const onlyThese = ['rutgers', 'chicago', 'gcsu', 'georgiast', 'gatech', 'sundiego', 'columbia', 'elonedu', 'emory', 'GASO', 'mit', 'newyork'];
  let finalFeeds = {};

  for (let i = 0; i < feeds.length; i++) {
    const feed = feeds[i];

    if (!onlyThese.includes(feed.username)) continue;

    const feedData = await updateFeed(feed);

    finalFeeds[feed.username] = feedData;
  }

  return finalFeeds;
};

exports.update = updateFeeds;
