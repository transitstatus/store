const updateFeed = async () => {
  try {
    let responseObject = {};

    //fetching data
    const resultingData = await Promise.all([
      'https://store.transitstat.us/njt_rail_platforms',
      'https://store.transitstat.us/nyp_moy_platforms',
    ].map((url) =>
      fetch(url).then(res => res.json())
    ));

    console.log(resultingData)

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
