const manifold = async () => {
  const res = await fetch('https://api.manifold.markets/v0/slug/who-will-win-the-2024-democratic-pr-47576e90fa38')
  const data = await res.json();

  let probabilityBiden = 0;
  let probabilityKamala = 0;

  data.answers.forEach((answer) => {
    if (answer.text === 'Joe Biden') probabilityBiden = answer.probability;
    if (answer.text === 'Kamala Harris') probabilityKamala = answer.probability;
  })

  return {
    title: 'Manifold Markets',
    source: 'https://manifold.markets/ManifoldPolitics/who-will-win-the-2024-democratic-pr-47576e90fa38',
    probabilityBiden: Number((probabilityBiden).toFixed(4)),
    probabilityKamala: Number((probabilityKamala).toFixed(4)),
    volume24: data.volume24Hours,
    storeUpdated: new Date().toISOString(),
  }
};

const predictit = async () => {
  const volumeRes = await fetch("https://www.predictit.org/api/Public/GetMarketChartData/7057?timespan=24&isTimespanInHours=true");
  const metaRes = await fetch("https://www.predictit.org/api/Market/7057/Contracts", { headers: { 'Accept': "application/json, text/plain, */*" } });

  const volumeData = await volumeRes.json();
  const metaData = await metaRes.json();

  let volume24 = 0;
  let lastPriceBiden = 0;
  let lastPriceKamala = 0;

  volumeData.forEach((candidate) => {
    volume24 += candidate.tradeVolume;
  });

  metaData.forEach((candidate) => {
    if (candidate.contractName == 'Joe Biden') lastPriceBiden = candidate.lastTradePrice;
    if (candidate.contractName == 'Kamala Harris') lastPriceKamala = candidate.lastTradePrice;
  })

  return {
    title: 'Predictit',
    source: 'https://www.predictit.org/markets/detail/7057/Who-will-win-the-2024-Democratic-presidential-nomination',
    probabilityBiden: Number((lastPriceBiden).toFixed(4)),
    probabilityKamala: Number(lastPriceKamala.toFixed(4)),
    volume24: volume24,
    storeUpdated: new Date().toISOString(),
  }
};

const polymarket = async () => {
  const resBiden = await fetch('https://clob.polymarket.com/rewards/markets/0x653483009043f1663360bc35ed8fb542d3f9453916082d20ff025adaa2fe7032');
  const dataBiden = await resBiden.json();

  const resKamala = await fetch('https://clob.polymarket.com/rewards/markets/0x9e9071636d176562592a98dfede865385ba0cff7864cfa01f0479ca6e9e26e1b');
  const dataKamala = await resKamala.json();

  let probabilityBiden = 1;
  let probabilityKamala = 1;

  dataBiden.data[0].tokens.forEach((token) => {
    if (token.outcome === 'Yes') probabilityBiden = token.price;
  })

  dataKamala.data[0].tokens.forEach((token) => {
    if (token.outcome === 'Yes') probabilityKamala = token.price;
  })

  return {
    title: 'Polymarket',
    source: 'https://polymarket.com/event/democratic-nominee-2024',
    probabilityBiden: Number(probabilityBiden.toFixed(4)),
    probabilityKamala: Number(probabilityKamala.toFixed(4)),
    volume24: null,
    storeUpdated: new Date().toISOString(),
  }
};

const smarkets = async () => {
  const candidates = {
    "Bernie Sanders": "39968378",
    "Cory Booker": "39968384",
    "Dean Phillips": "155245653",
    "Elizabeth Warren": "39968371",
    "Gavin Newsom": "39968375",
    "Gretchen Whitmer": "39968385",
    "Hillary Clinton": "52378944",
    "Jamie Dimon": "130839954",
    "Kared Polis": "81100703",
    "JB Pritzker": "81103958",
    "Joe Biden": "39968369",
    "Josh Shapiro": "209535783",
    "Kamala Harris": "39968370",
    "Michelle Obama": "39968373",
    "Nina Turner": "39968376",
    "Pete Buttigieg": "39968374",
    "Raphael Warnock": "81116120",
    "Robert F. Kennedy Jr.": "125329894",
  };

  const now = Date.now();
  const nowStr = new Date(now).toISOString();
  const dayAgoStr = new Date(now - (1000 * 60 * 60 * 24)).toISOString();

  let volume24 = 0;
  let probabilityBiden = 0;
  let probabilityKamala = 0;

  const res = await fetch(`https://api.smarkets.com/v3/events/41936389/markets/11445805/contracts/${Object.values(candidates).join(',')}/executions_time_series/?data_points=24&timestamp_max=${nowStr}&timestamp_min=${dayAgoStr}`)
  const data = await res.json();

  data.contracts.forEach((contract) => {
    contract.buckets.forEach((bucket) => {
      volume24 += bucket.volume_qty;

      if (contract.contract_id === candidates["Joe Biden"]) {
        probabilityBiden = bucket.ohlc[bucket.ohlc.length - 1];
      }

      if (contract.contract_id === candidates["Kamala Harris"]) {
        probabilityKamala = bucket.ohlc[bucket.ohlc.length - 1];
      }
    })
  })

  probabilityBiden = probabilityBiden / 10000;
  probabilityKamala = probabilityKamala / 10000;

  return {
    title: 'Smarkets',
    source: 'https://smarkets.com/event/41936389/politics/us/2024-presidential-election/2024-democratic-presidential-nominee',
    probabilityBiden: Number(probabilityBiden.toFixed(4)),
    probabilityKamala: Number(probabilityKamala.toFixed(4)),
    volume24: volume24,
    storeUpdated: new Date().toISOString(),
  }
}

exports.sources = [manifold, predictit, polymarket, smarkets];