const fetch = require('node-fetch');
const htmlparser2 = require("htmlparser2");
const fs = require('fs');

const urls = [
  "https://www.chicagotribune.com/arcio/rss/category/news/",
  "https://www.nbcchicago.com/?rss=y",
  "https://chicago.suntimes.com/rss/index.xml",
];

const options = {};

const update = async () => {
  try {
    const requests = urls.map((url) =>
      fetch(url).then((response) => response.text())
    );

    const res = await Promise.all(requests)
      .then((data) => {
        const parsedFeeds = data.map((feed) => htmlparser2.parseFeed(feed, options))

        return parsedFeeds;
      })
      .catch((error) => {
        console.error(error);
      });

    return res;
  } catch (e) {
    console.log(e)
    return false;
  }
}

exports.update = update;