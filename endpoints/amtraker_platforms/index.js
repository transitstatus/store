const updateFeed = async () => {
  try {
    let responseObject = {
      stations: {},
      stations_w_src: {},
    };

    return responseObject;

    //fetching data
    const resultingData = await Promise.all([
      'https://store.transitstat.us/njt_rail_platforms',
      'https://store.transitstat.us/nyp_moy_platforms',
    ].map((url) =>
      fetch(url).then(res => res.json())
    ));

    const sourceNames = [
      'New Jersey Transit',
      'Moynihan Train Hall',
    ];

    resultingData.forEach((source, sourceIndex) => {
      Object.keys(source.stations).forEach((stationCode) => {

        if (!responseObject.stations[stationCode]) responseObject.stations[stationCode] = {};
        if (!responseObject.stations_w_src[stationCode]) responseObject.stations_w_src[stationCode] = {};

        Object.keys(source.stations[stationCode]).forEach((trainNumber) => {
          const trainTrack = source.stations[stationCode][trainNumber];

          if (trainTrack.length > 0) {
            responseObject.stations[stationCode][trainNumber] = trainTrack;
            responseObject.stations_w_src[stationCode][trainNumber] = {
              platform: trainTrack,
              source: sourceNames[sourceIndex],
            }
          }
        });
      });
    });

    console.log(`Finished updating All Amtraker Tracks`)
    return responseObject;
  } catch (e) {
    console.log(e);
    return {
      stations: {}
    };
  }
};

exports.update = updateFeed;
