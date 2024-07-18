const manifold = async () => {
  const res = await fetch('https://api.manifold.markets/v0/slug/will-biden-be-the-2024-democratic-n')
  const data = await res.json();

  return {
    title: 'Manifold Markets',
    source: 'https://manifold.markets/NathanpmYoung/will-biden-be-the-2024-democratic-n',
    probability: Number((1 - data.probability).toFixed(4)),
    volume24: data.volume24Hours,
    storeUpdated: new Date().toISOString(),
  }
};

const predictit = async () => {
  const volumeRes = await fetch("https://www.predictit.org/api/Public/GetMarketChartData/7057?timespan=24&isTimespanInHours=true");
  const metaRes = await fetch("https://www.predictit.org/api/Market/7057/Contracts");

  const volumeData = await volumeRes.json();
  const metaData = await metaRes.json();

  let volume24 = 0;
  let lastPrice = 0;

  volumeData.forEach((candidate) => {
    volume24 += candidate.tradeVolume;
  });

  metaData.every((candidate) => {
    if (candidate.contractName != 'Joe Biden') return true;

    lastPrice = candidate.lastTradePrice;
    return false;
  })

  return {
    title: 'Predictit',
    source: 'https://www.predictit.org/markets/detail/7057/Who-will-win-the-2024-Democratic-presidential-nomination',
    probability: Number((1 - lastPrice).toFixed(4)),
    volume24: volume24,
    storeUpdated: new Date().toISOString(),
  }
};

const polymarket = async () => {
  const res = await fetch('https://clob.polymarket.com/rewards/markets/0x653483009043f1663360bc35ed8fb542d3f9453916082d20ff025adaa2fe7032');
  const data = await res.json();

  let probability = 1;

  data.data[0].tokens.forEach((token) => {
    if (token.outcome === 'No') probability = token.price;
  })

  return {
    title: 'Polymarket',
    source: 'https://polymarket.com/event/democratic-nominee-2024',
    probability: Number(probability.toFixed(4)),
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

  let candidatesRev = {};
  Object.keys(candidates).forEach((candidate) => candidatesRev[candidates[candidate]] = candidate);

  const now = Date.now();
  const nowStr = new Date(now).toISOString();
  const dayAgoStr = new Date(now - (1000 * 60 * 60 * 24)).toISOString();

  let volume24 = 0;
  let probability = 0;

  const res = await fetch(`https://api.smarkets.com/v3/events/41936389/markets/11445805/contracts/${Object.keys(candidatesRev).join(',')}/executions_time_series/?data_points=24&timestamp_max=${nowStr}&timestamp_min=${dayAgoStr}`)
  const data = await res.json();

  data.contracts.forEach((contract) => {
    contract.buckets.forEach((bucket) => {
      volume24 += bucket.volume_qty;

      if (contract.contract_id === candidates["Joe Biden"]) {
        probability = bucket.ohlc[bucket.ohlc.length - 1];
      }
    })
  })

  probability = (10000 - probability) / 10000; //adjusting the percent win to percent joever

  return {
    title: 'Smarkets',
    source: 'https://smarkets.com/event/41936389/politics/us/2024-presidential-election/2024-democratic-presidential-nominee',
    probability: Number(probability.toFixed(4)),
    volume24: volume24,
    storeUpdated: new Date().toISOString(),
  }
}

exports.sources = [manifold, predictit, polymarket, smarkets];