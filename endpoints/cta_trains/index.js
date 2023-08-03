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
  const req = await fetch('https://www.transitchicago.com/traintracker/PredictionMap/tmTrains.aspx?line=R%2CP%2CY%2CB%2CV%2CG%2CT%2CO&MaxPredictions=200');
  const raw = await req.text();
  const data = JSON.parse(raw);

  if (data?.status !== 'OK') return {};

  const routesReq = await fetch('https://gtfs.piemadd.com/data/cta/routes.json');
  const stationsReq = await fetch('https://gtfs.piemadd.com/data/cta/stops.json');

  const routesData = await routesReq.json();
  const stationsData = await stationsReq.json();

  let processedData = {
    lines: {},
    stations: {},
    trains: {},
    transitStatus: {
      trains: {},
      stations: {},
      lines: {}
    },
    interval: 30000,
  };

  data.dataObject.forEach((line) => {
    let stations = {};
    let headways = {};
    let trains = {};

    line.Markers.forEach((train) => {
      if (train.IsSched) return;

      let stationPastLoop = false;

      processedData.trains[train.RunNumber] = {
        lat: train.Position.Lat,
        lon: train.Position.Lng,
        heading: train.Direction,
        line: actualLines[line.Line],
      };

      processedData.transitStatus.trains[train.RunNumber] = {
        lat: train.Position.Lat,
        lon: train.Position.Lng,
        heading: train.Direction,
        line: actualLines[line.Line],
        lineCode: line.Line,
        lineColor: routesData[validLinesReverse[line.Line]].routeColor,
        lineTextColor: routesData[validLinesReverse[line.Line]].routeTextColor,
        dest: train.DestName.split('&')[0],
        predictions: [],
      };

      train.Predictions.forEach((prediction, i, arr) => {
        let dest = train.DestName.split('&')[0];
        const eta = Number(prediction[2].replaceAll('Due', '1').replaceAll('<b>', '').replaceAll('</b>', '').split(' ')[0]);

        const now = new Date().valueOf();
        const actualETA = now + (eta * 60000);

        if (!isNaN(eta)) {
          //setting up station if it doesn't exist
          if (!stations[parseInt(prediction[0])]) {
            stations[parseInt(prediction[0])] = {
              dest: {},
              stationName: prediction[1],
            };
          };

          // changing destination if past station before loop
          if (stationPastLoop) {
            dest = lineMeta[line.Line].postLoopAlt;
          }

          //setting up destination if it doesn't exist
          if (!stations[parseInt(prediction[0])]['dest'][dest]) {
            stations[parseInt(prediction[0])]['dest'][dest] = {
              etas: [],
              headways: [],
              avgHeadway: 0,
              runNumbers: [],
            };
          };

          //adding headway to station
          stations[parseInt(prediction[0])]['dest'][dest].etas.push(eta);

          //adding run number to station
          stations[parseInt(prediction[0])]['dest'][dest].runNumbers.push(train.RunNumber);

          //if final station, adding headway to line
          if (i === arr.length - 1 || (lineMeta[line.Line] && prediction[0] == lineMeta[line.Line].loopLimit)) {
            if (!headways[dest]) {
              headways[dest] = {
                etas: [],
                headways: [],
                avgHeadway: 0,
                runNumbers: [],
              };
            };

            headways[dest].etas.push(eta);
            headways[dest].runNumbers.push(train.RunNumber);
          }

          if (additionalStops[line.Line] && additionalStops[line.Line][prediction[1]]) {
            if (!headways[additionalStops[line.Line][prediction[1]]]) {
              headways[additionalStops[line.Line][prediction[1]]] = {
                etas: [],
                headways: [],
                avgHeadway: 0,
                runNumbers: [],
              };
            }

            headways[additionalStops[line.Line][prediction[1]]].etas.push(eta);
            headways[additionalStops[line.Line][prediction[1]]].runNumbers.push(train.RunNumber);
          }
        }

        //checking if train is past loop
        if (lineMeta[line.Line] && prediction[0] == lineMeta[line.Line].loopLimit) {
          stationPastLoop = true;
        };

        //adding prediction to train
        processedData.transitStatus.trains[train.RunNumber].predictions.push({
          stationID: prediction[0],
          stationName: prediction[1],
          eta: eta,
          actualETA: actualETA,
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
          eta: eta,
          actualETA: actualETA,
          line: actualLines[line.Line],
          lineCode: line.Line,
          lineColor: routesData[validLinesReverse[line.Line]].routeColor,
          lineTextColor: routesData[validLinesReverse[line.Line]].routeTextColor,
        });
      });
    });

    //looping through stations
    Object.keys(stations).forEach((station) => {
      Object.keys(stations[station]['dest']).forEach((dest) => {
        //sorting ETAs
        stations[station]['dest'][dest].etas.sort((a, b) => a - b);

        //calculating headways
        stations[station]['dest'][dest].etas.forEach((eta, i, arr) => {
          if (i === 0) stations[station]['dest'][dest].headways.push(eta);
          else stations[station]['dest'][dest].headways.push(eta - arr[i - 1]);
        });

        //calculating average headway
        stations[station]['dest'][dest].avgHeadway = calcAvgHeadway(stations[station]['dest'][dest].headways);
      });
    });

    //looping through headways
    Object.keys(headways).forEach((dest) => {
      //sorting ETAs
      headways[dest].etas.sort((a, b) => a - b);

      //calculating headways
      headways[dest].etas.forEach((eta, i, arr) => {
        if (i === 0) headways[dest].headways.push(eta);
        else headways[dest].headways.push(eta - arr[i - 1]);
      });

      //calculating average headway
      headways[dest].avgHeadway = calcAvgHeadway(headways[dest].headways);
    });

    //adding stations to processedData
    Object.keys(stations).forEach((station) => {
      if (!processedData.stations[station]) {
        processedData.stations[station] = {
          stationName: stations[station].stationName,
          lines: {},
        };
      };

      processedData.stations[station].lines[actualLines[line.Line]] = stations[station].dest;
    });

    //adding headways to processedData
    processedData.lines[actualLines[line.Line]] = headways;
    console.log('Data updated!')
  })

  Object.keys(validLines).forEach((lineCode) => {
    const lineData = routesData[lineCode];

    processedData.transitStatus.lines[validLines[lineCode]] = {
      lineCode: validLines[lineCode],
      lineNameShort: lineData.routeShortName,
      lineNameLong: lineData.routeLongName,
      routeColor: lineData.routeColor,
      routeTextColor: lineData.routeTextColor,
      stations: lineData.routeStations
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

  //console.log(processedData)

  const updated = new Date().toISOString();

  processedData.lastUpdated = updated;
  processedData.transitStatus.lastUpdated = updated;
  processedData.versionNumberAPI = '2.0.0'

  return processedData;
};

exports.update = processData;