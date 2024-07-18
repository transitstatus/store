const { sources } = require('./sources');

const weightedAverage = (sources) => {
  let totalVolume = 0;
  let totalPercent = 0;

  sources.forEach((source) => {
    if (!source.volume24) return; //cant weight if we dont have the volume

    totalVolume += source.volume24;
    totalPercent += source.probability * source.volume24;
  })

  return Number((totalPercent / totalVolume).toFixed(4));
};

const unweightedAverage = (sources) => {
  let totalPercent = 0;

  sources.forEach((source) => {
    totalPercent += source.probability;
  })

  return Number((totalPercent / sources.length).toFixed(4));
}

const updateFeed = (async () => {
  try {
    let finalData = {
      sources: [],
      overall: {
        weigthed: 0,
        unweighted: 0,
      }
    };

    for (let i = 0; i < sources.length; i++) {
      const res = await sources[i]();
      finalData.sources.push(res);
    }

    finalData.overall.weigthed = weightedAverage(finalData.sources);
    finalData.overall.unweighted = unweightedAverage(finalData.sources);

    return finalData;
  } catch (e) {
    console.log(e)
    return false;
  }
})

exports.update = updateFeed;