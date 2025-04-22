const fetch = require('node-fetch');

//get env variables in dev mode
require('dotenv').config();

const updateFeed = (async (zoneTag) => {
  const now = new Date();
  const monthAgo = new Date(now.valueOf() - (1000 * 60 * 60 * 24 * 30));

  const nowString = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${(now.getDate()).toString().padStart(2, '0')}`;
  const monthAgoString = `${monthAgo.getFullYear()}-${(monthAgo.getMonth() + 1).toString().padStart(2, '0')}-${(monthAgo.getDate()).toString().padStart(2, '0')}`;

  let query = {
    "query": `{\n  viewer {\n    zones(filter: {zoneTag: \"${zoneTag}\"}) {\n      totals: httpRequests1dGroups(limit: 10000, filter: {date_geq: \"${monthAgoString}\", date_lt: \"${nowString}\"}) {\n        uniq {\n          uniques\n          __typename\n        }\n        __typename\n      }\n      zones: httpRequests1dGroups(orderBy: [date_ASC], limit: 10000, filter: {date_geq: \"${monthAgoString}\", date_lt: \"${nowString}\"}) {\n        dimensions {\n          date\n          __typename\n        }\n        uniq {\n          uniques\n          __typename\n        }\n        sum {\n          browserMap {\n            pageViews\n            key: uaBrowserFamily\n            __typename\n          }\n          bytes\n          cachedBytes\n          cachedRequests\n          contentTypeMap {\n            bytes\n            requests\n            key: edgeResponseContentTypeName\n            __typename\n          }\n          clientSSLMap {\n            requests\n            key: clientSSLProtocol\n            __typename\n          }\n          countryMap {\n            bytes\n            requests\n            threats\n            key: clientCountryName\n            __typename\n          }\n          encryptedBytes\n          encryptedRequests\n          ipClassMap {\n            requests\n            key: ipType\n            __typename\n          }\n          pageViews\n          requests\n          responseStatusMap {\n            requests\n            key: edgeResponseStatus\n            __typename\n          }\n          threats\n          threatPathingMap {\n            requests\n            key: threatPathingName\n            __typename\n          }\n          __typename\n        }\n        __typename\n      }\n      __typename\n    }\n    __typename\n  }\n}\n`
  }

  const res = await fetch('https://api.cloudflare.com/client/v4/graphql', {
    headers: {
      'X-AUTH-EMAIL': process.env['cf_analytics_email'],
      'Authorization': `Bearer ${process.env['cf_analytics_token']}`,
    },
    "body": JSON.stringify(
      query
    ),
    "method": "POST",
  });
  try {
    const data = await res.json();

    if (data.data == null) throw new Error(data.error);

    let zoneData = {
      totals: {},
      dates: {},
    };

    //setting total users
    zoneData.totals.users = data.data.viewer.zones[0].totals[0].uniq.uniques;

    data.data.viewer.zones[0].zones.forEach((day, i) => {
      zoneData.dates[day.dimensions.date] = {
        date: day.dimensions.date,
        dateNum: Number(day.dimensions.date.split('-').join('')),
        bytes: day.sum.bytes,
        cachedBytes: day.sum.cachedBytes,
        cachedRequests: day.sum.cachedRequests,
        encryptedBytes: day.sum.encryptedBytes,
        encryptedRequests: day.sum.encryptedRequests,
        pageViews: day.sum.pageViews,
        requests: day.sum.requests,
        threats: day.sum.threats,
        users: day.uniq.uniques,
      }
    });

    Object.values(zoneData.dates).forEach((dayParsed) => {
      Object.keys(dayParsed).forEach((dayParsedKey) => {
        if (dayParsedKey === 'users' || dayParsedKey === 'date' || dayParsedKey === 'dateNum') return; // MAU cant just be DAU totaled
        if (!zoneData.totals[dayParsedKey]) zoneData.totals[dayParsedKey] = 0; // gotta plug in the data, ya feel?

        zoneData.totals[dayParsedKey] += dayParsed[dayParsedKey]; //adding to total
      })
    })

    return zoneData;
  } catch (e) {
    console.log(e)
    return false;
  }
})

const updateFeedInd = async (domain, zoneTag) => {
  const domainData = await updateFeed(zoneTag);

  console.log(`Finished updating cfa for ${domain}`)

  return domainData;
}

exports.update = updateFeedInd;
