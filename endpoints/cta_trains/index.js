const fetch = require('node-fetch');

const actualLines = {
  'R': 'Red',
  'P': "Purple",
  'Y': 'Yellow',
  'B': 'Blue',
  'V': 'Pink',
  'G': 'Green',
  'T': 'Brown',
  'O': 'Orange',
};

const validLines = {
  'Red': 'R',
  'P': 'P',
  'Y': 'Y',
  'Blue': 'B',
  'Pink': 'V',
  'G': 'G',
  'Brn': 'T',
  'Org': 'O',
};

const validLinesReverse = {
  'R': 'Red',
  'P': 'P',
  'Y': 'Y',
  'B': 'Blue',
  'V': 'Pink',
  'G': 'G',
  'T': 'Brn',
  'O': 'Org',
};

const lineShortNames = {
  'Red': 'Red',
  'P': 'Pur',
  'Y': 'Yel',
  'Blue': 'Blu',
  'Pink': 'Pnk',
  'G': 'Grn',
  'Brn': 'Brn',
  'Org': 'Org',
}

const regularDestinations = [
  'Howard',
  '95th/Dan Ryan',
  'Linden',
  '54th/Cermak',
  'Kimball',
  'Midway',
  'Loop',
  'Harlem/Lake',
  'Ashland/63rd',
  'Cottage Grove',
  'Forest Park',
  'O\'Hare',
  'UIC-Halsted',
  'Dempster-Skokie',
  'Skokie'
]

const inTheLoop = [
  40040,
  40160,
  40260,
  40380,
  40680,
  40730,
  40850,
  41700,
]

const lineMeta = {
  'P': {
    loopLimit: 40460.0,
    postLoopAlt: 'Linden'
  },
  'V': {
    loopLimit: 41160.0,
    postLoopAlt: '54th/Cermak'
  },
  'T': {
    loopLimit: 40460.0,
    postLoopAlt: 'Kimball'
  },
  'O': {
    loopLimit: 41400.0,
    postLoopAlt: 'Midway'
  }
};

const additionalStops = {
  'B': {
    'Forest Park': 'UIC-Halsted',
  }
};

const calcAvgHeadway = array => array.reduce((a, b) => a + b) / array.length;

const processData = async () => {
  try {
    const req = await fetch('https://www.transitchicago.com/traintracker/PredictionMap/tmTrains.aspx?line=R%2CP%2CY%2CB%2CV%2CG%2CT%2CO&MaxPredictions=3000');
    const raw = await req.text();
    const data = JSON.parse(raw);

    if (data?.status !== 'OK') return {};

    const routesReq = await fetch('https://gtfs.piemadd.com/data/cta/routes.json');
    const stationsReq = await fetch('https://gtfs.piemadd.com/data/cta/stops.json');

    const routesData = await routesReq.json();
    const stationsData = await stationsReq.json();

    let processedData = {
      transitStatus: {
        trains: {},
        stations: {},
        lines: {}
      },
    };

    data.dataObject.forEach((line) => {
      line.Markers.forEach((train) => {
        if (train.IsSched) return;

        let stationPastLoop = false;

        processedData.transitStatus.trains[train.RunNumber] = {
          lat: train.Position.Lat,
          lon: train.Position.Lng,
          heading: ((2 * Math.PI - train.Direction) / (2 * Math.PI)) * 360 + 90,
          line: actualLines[line.Line],
          lineCode: line.Line,
          lineColor: routesData[validLinesReverse[line.Line]].routeColor,
          lineTextColor: routesData[validLinesReverse[line.Line]].routeTextColor,
          dest: train.DestName.split('&')[0],
          predictions: [],
          type: 'train',
          extra: {
            holidayChristmas: train.RunNumber == 1225,
          }
        };

        const now = Date.now();

        train.Predictions.forEach((prediction, i, arr) => {
          let dest = train.DestName.split('&')[0];
          const eta = Number(prediction[2].replaceAll('Due', '1').replaceAll('<b>', '').replaceAll('</b>', '').split(' ')[0]);
          const actualETA = now + (eta * 60000);

          if (!isNaN(eta)) {
            // changing destination if past station before loop
            if (stationPastLoop) {
              dest = lineMeta[line.Line].postLoopAlt;
            }
          }
          //checking if train is past loop
          if (lineMeta[line.Line] && prediction[0] == lineMeta[line.Line].loopLimit) {
            stationPastLoop = true;
          };

          const isRealtime = !train.IsSched;

          //adding prediction to train
          processedData.transitStatus.trains[train.RunNumber].predictions.push({
            stationID: prediction[0],
            stationName: prediction[1],
            actualETA: actualETA,
            noETA: isNaN(eta),
          });

          //adding train to stations
          if (!processedData.transitStatus.stations[prediction[0]]) {
            processedData.transitStatus.stations[prediction[0]] = {
              stationID: prediction[0],
              stationName: prediction[1],
              destinations: {},
            }
          }

          if (!processedData.transitStatus.stations[prediction[0]].destinations[dest]) {
            processedData.transitStatus.stations[prediction[0]].destinations[dest] = {
              trains: [],
            }
          }

          processedData.transitStatus.stations[prediction[0]].destinations[dest].trains.push({
            runNumber: train.RunNumber,
            actualETA: actualETA,
            noETA: isNaN(eta),
            realTime: isRealtime,
            line: actualLines[line.Line],
            lineCode: line.Line,
            lineColor: routesData[validLinesReverse[line.Line]].routeColor,
            lineTextColor: routesData[validLinesReverse[line.Line]].routeTextColor,
            extra: {
              holidayChristmas: train.RunNumber == 1225,
            }
          });
        });
      });
    })

    Object.keys(validLines).forEach((lineCode) => {
      const lineData = routesData[lineCode];

      processedData.transitStatus.lines[validLines[lineCode]] = {
        lineCode: validLines[lineCode],
        lineNameShort: lineShortNames[lineCode],
        lineNameLong: lineData.routeLongName,
        routeColor: lineData.routeColor,
        routeTextColor: lineData.routeTextColor,
        stations: lineData.routeStations,
        hasActiveTrains: false
      };
    });

    //adding stations not in the tracking data
    Object.keys(stationsData).forEach((stationID) => {
      if (stationID < 40000 || stationID >= 50000) return;

      if (!processedData.transitStatus.stations[stationID]) {
        processedData.transitStatus.stations[stationID] = {
          stationID: stationID,
          stationName: stationsData[stationID].stopName,
          destinations: {},
        };
      }

      processedData.transitStatus.stations[stationID].lat = stationsData[stationID].stopLat;
      processedData.transitStatus.stations[stationID].lon = stationsData[stationID].stopLon;

      //adding destinations
      Object.keys(routesData).forEach((lineCode) => {
        if (!routesData[lineCode].routeStations.includes(stationID)) return;

        const lineDestinations = routesData[lineCode].destinations;

        lineDestinations.forEach((destination) => {
          if (!processedData.transitStatus.stations[stationID].destinations[destination]) {
            if (regularDestinations.includes(destination)) {
              if (inTheLoop.includes(stationID) && destination === 'Loop') return;
              processedData.transitStatus.stations[stationID].destinations[destination] = {
                trains: [],
              };
            }
          }
        });
      });
    });

    Object.keys(processedData.transitStatus.trains).forEach((train) => {
      const trainData = processedData.transitStatus.trains[train];

      processedData.transitStatus.lines[trainData.lineCode].hasActiveTrains = true;
    });

    const updated = new Date().toISOString();

    processedData.transitStatus.lastUpdated = updated;

    return processedData;
  } catch (e) {
    console.log(e);

    const updated = new Date().toISOString();

    return false;
    return {
      lines: {},
      stations: {},
      trains: {},
      transitStatus: {
        trains: {},
        stations: {},
        lines: {}
      },
      interval: 30000,
      lastUpdated: updated,
      versionNumberAPI: "2.0.0"
    };
  }
};

exports.update = processData;
