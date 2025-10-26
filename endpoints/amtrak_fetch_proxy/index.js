const updateFeed = async (updateConfig) => {
  try {
    let responseObject = {
      trainStations: null,
      trainDataMain: null,
      trainDataASMAD: { type: "FeatureCollection", features: [] },
      updatedAt: 0,
    };

    const fetchedData = await fetch('https://amtraker-fetch-proxy.piero.workers.dev/').then((res) => res.json());
    responseObject = fetchedData;
    responseObject.trainDataASMAD = JSON.parse(fetchedData.trainDataASMAD);
    responseObject.updatedAt = Date.now(),


    console.log(`Finished updating Amtraker Proxy`)
    return responseObject;
  } catch (e) {
    console.log('Error with Amtraker Proxy Alerts')
    const errorMessage = e.message;
    const errorString = e.toString();

    if (updateConfig.firstUpdate) {
      const initialStateText = await fetch('https://store.transitstat.us/amtrak_fetch_proxy').then((res) => res.text());
      if (initialStateText !== 'Not found' && !initialStateText.startsWith('no available server')) return JSON.parse(initialStateText);
    };

    return {
      trainStations: null,
      trainDataMain: null,
      trainDataASMAD: { type: "FeatureCollection", features: [] },
      updatedAt: Date.now(),
    };
  }
};

exports.update = updateFeed;
