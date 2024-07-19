const { sources } = require('./sources');

const weightedAverage = (sources) => {
  let totalVolumeBiden = 0;
  let totalPercentBiden = 0;
  let totalVolumeKamala = 0;
  let totalPercentKamala = 0;

  sources.forEach((source) => {
    if (!source.volume24) return; //cant weight if we dont have the volume

    totalVolumeBiden += source.volume24;
    totalPercentBiden += source.probabilityBiden * source.volume24;

    totalVolumeKamala += source.volume24;
    totalPercentKamala += source.probabilityKamala * source.volume24;
  })

  return {
    biden: Number((totalPercentBiden / totalVolumeBiden).toFixed(4)),
    kamala: Number((totalPercentKamala / totalVolumeKamala).toFixed(4)),
  }
};

const unweightedAverage = (sources) => {
  let totalPercentBiden = 0;
  let totalPercentKamala = 0;

  sources.forEach((source) => {
    totalPercentBiden += source.probabilityBiden;
    totalPercentKamala += source.probabilityKamala;
  })

  return {
    biden: Number((totalPercentBiden / sources.length).toFixed(4)),
    kamala: Number((totalPercentKamala / sources.length).toFixed(4)),
  }
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