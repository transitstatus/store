const fetch = require('node-fetch');
const redStatic = require('./rawData/red.json');
const blueStatic = require('./rawData/blue.json');
const greenStatic = require('./rawData/green.json');

const customMetaIndexes = {
  'Red-': 0,
  'Blue-': 1,
  'Green-': 2
}
const customMeta = [
  {
    code: 'red',
    name: 'Red',
    color: 'e64219',
    stopNames: {
      '1': 'Convention Center',
      '2': 'Target',
      '3': 'Hyatt Place',
      '4': 'Staybridge Suites/Holiday Inn'
    }
  },
  {
    code: 'blue',
    name: 'Blue',
    color: '5894ed',
    stopNames: {
      '1': 'Convention Center',
      '2': 'Marriott Suites',
      '3': 'Courtyard by Marriott',
      '4': 'Hyatt Centric'
    }
  },
  {
    code: 'green',
    name: 'Green',
    color: '2fad80',
    stopNames: {
      '1': 'Convention Center',
      '2': 'Crowne Plaza',
      '3': 'Aloft',
      '4': 'Fashion Outlets of Chicago'
    }
  }
];

const updateFeed = async () => {
  try {

    const now = new Date();

    let stopDict = {};
    let stopNameDict = {};
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

    const routeData = await fetch(`https://buswhere.com/furfest/routes/red_route_a_line?t=${now.valueOf()}&t=${now.valueOf() + 55421}&initial=true`, {
      "headers": {
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0",
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "Accept-Language": "en-US,en;q=0.5",
        "X-Requested-With": "XMLHttpRequest",
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-origin",
        "Pragma": "no-cache",
        "Cache-Control": "no-cache"
      },
    })
      .then(response => response.json());

    //pushing routes into transitstatus object
    const routeStaticData = [redStatic, blueStatic, greenStatic];
    routeStaticData.forEach((routeStatic, i) => {
      const meta = customMeta[i];
      transitStatus.lines[meta.code] = {
        lineCode: meta.code,
        lineNameShort: meta.name,
        lineNameLong: meta.name,
        routeColor: meta.color,
        routeTextColor: 'ffffff',
        stations: Object.values(meta.stopNames).map((stop) => stop.toLowerCase().replaceAll(' ', '-').replaceAll('/', '-')),
        hasActiveTrains: false
      }

      routeStatic.stops.forEach((stop) => {
        const stopID = meta.stopNames[stop.name].toLowerCase().replaceAll(' ', '-').replaceAll('/', '-');
        if (!transitStatus.stations[stopID]) {
          transitStatus.stations[stopID] = {
            stationID: stopID,
            stationName: meta.stopNames[stop.name],
            destinations: {},
            lat: stop.lat,
            lon: stop.lon,
          }
        };

        if (stop.address != '5555 N River Rd') {
          transitStatus.stations[stopID]['destinations']['Convention Center'] = {
            trains: []
          }
        } else {
          transitStatus.stations[stopID]['destinations'][`${meta.name} Loop`] = { trains: [] }
        }

        stopDict[stop.id] = stopID;
        stopNameDict[stop.id] = meta.stopNames[stop.name];
      })
    })

    if (routeData.devices.length < 1) return;
    const lineMeta = customMeta[customMetaIndexes[routeData.devices[0].name.split(' ')[0]]];
    const updatedAt = new Date(routeData.address_updated_at).valueOf();

    for (let i = 0; i < routeData.devices.length; i++) {
      const device = routeData.devices[i];

      const busID = device.name.split(' ')[2];
      transitStatus.trains[busID] = {
        lat: device.position.lat,
        lon: device.position.lon,
        heading: 0,
        realTime: true,
        deadMileage: false,
        line: lineMeta.name,
        lineCode: lineMeta.code,
        lineColor: lineMeta.color,
        lineTextColor: 'ffffff',
        dest: '',
        predictions: [],
        extra: {
          accessible: device.name.endsWith('♿️')
        }
      }

      transitStatus.lines[lineMeta.code].hasActiveTrains = true;
    }

    Object.keys(routeData.other_routes_stop_eta).forEach((stopID) => {
      routeData.other_routes_stop_eta[stopID].forEach((stopTime) => {
        const busID = stopTime.device.split(' ')[2];

        transitStatus.trains[busID].predictions.push({
          stationID: stopDict[stopID],
          stationName: stopNameDict[stopID],
          actualETA: isNaN(stopTime.eta) ? updatedAt : updatedAt + (parseInt(stopTime.eta) * 1000),
          noETA: false,
          realTime: true,
          extra: {
            accessible: stopTime.device.endsWith('♿️')
          }
        });

        const destination = stopDict[stopID] == 'convention-center' ? `${lineMeta.name} Loop` : 'Convention Center';
        transitStatus.stations[stopDict[stopID]].destinations[destination].trains.push({
          runNumber: busID,
          actualETA: isNaN(stopTime.eta) ? updatedAt : updatedAt + (parseInt(stopTime.eta) * 1000),
          noETA: false,
          realTime: true,
          line: lineMeta.name,
          lineCode: lineMeta.code,
          lineColor: lineMeta.color,
          lineTextColor: 'ffffff'
        })

        transitStatus.trains[busID].dest = destination;
      })
    })
    console.log(`Finished updating MFF Buses`)
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
        message: 'Something went wrong updating the data for MFF buses. Please try again later.'
      }
    };
  }
};

exports.update = updateFeed;
