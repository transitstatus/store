const codeReplacements = {
  'ARTIC': 'ANA',
  'BURBANK-AIRPORT-SOUTH': 'BUR',
  'CAMARILLO': 'CML',
  'CHATSWORTH': 'CWT',
  'DOWNTOWN BURBANK': 'BBK',
  'FULLERTON': 'FUL',
  'GLENDALE': 'GDL',
  'IRVINE': 'IRV',
  'LAUS': 'LAX',
  'MOORPARK': 'MPK',
  'NORTHRIDGE': 'NRG',
  'OXNARD': 'OXN',
  'RIVERSIDE-DOWNTOWN': 'RIV',
  'SAN JUAN CAPISTRANO': 'SNC',
  'SANTA ANA': 'SNA',
  'SIMIVALLEY': 'SIM',
  'VAN NUYS': 'VNC'
};

const updateFeed = async () => {
  try {
    let responseObject = {};
    let unknownStations = [];

    //fetching data
    const res = await fetch("https://rtt.metrolinktrains.com/StationScheduleList.json");
    const data = await res.json();

    data
      .filter((prediction) => prediction.TrainDesignation.startsWith('A'))
      .forEach((prediction) => {
        const trainNumber = prediction.TrainDesignation.replace('A', '');
        const stationCode = codeReplacements[prediction.PlatformName];
        const stationTrack = prediction.FormattedTrackDesignation.replace('Track ', '');

        if (!stationCode) {
          unknownStations.push(prediction.PlatformName);
          return;
        }

        if (!responseObject[stationCode]) responseObject[stationCode] = {};
        responseObject[stationCode][trainNumber] = stationTrack;
      });


    console.log(`Finished updating Metrolink tracks`)
    return {
      stations: responseObject,
      unknownStations
    };
  } catch (e) {
    console.log(e);
    return {
      stations: {
        "ANA": {},
        "BUR": {},
        "CML": {},
        "CWT": {},
        "BBK": {},
        "FUL": {},
        "GDL": {},
        "IRV": {},
        "LAX": {},
        "MPK": {},
        "NRG": {},
        "OXN": {},
        "RIV": {},
        "SNC": {},
        "SNA": {},
        "SIM": {},
        "VNC": {}
      },
      unknownStations: [],
    };
  }
};

exports.update = updateFeed;
