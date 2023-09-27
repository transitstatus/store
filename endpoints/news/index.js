const fetch = require('node-fetch');
const fs = require('fs');
const Parser = require('rss-parser');
const parser = new Parser();

const urls = [
  "https://www.chicagotribune.com/arcio/rss/category/news/",
  "https://www.nbcchicago.com/?rss=y",
  "https://chicago.suntimes.com/rss/index.xml",
];

const options = {};

const update = async () => {
  try {
    const requests = urls.map((url) =>
      parser.parseURL(url)
    );

    const res = await Promise.all(requests)
      .then(data => data)
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