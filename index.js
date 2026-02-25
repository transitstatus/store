const domainReplacements = require('./domainReplacements.json');

const fs = require('fs');
const fastify = require('fastify')({
  logger: false,
  rewriteUrl: (request) => {
    if (domainReplacements[request.headers.host]) {
      return domainReplacements[request.headers.host] + request.url;
    }

    return request.url;
  }
});

const lcache = require('fastify-lcache');

fastify.register(lcache, {
  ttlInMinutes: 0.5, // set cached data lifetime to 30 seconds
  //excludeRoutes: ['/']
});

require('dotenv').config();

const getAllKeysWithParents = (obj, parentKey = '') => {
  let keys = [];

  for (let key in obj) {
    if (obj.hasOwnProperty(key)) {
      const currentKey = parentKey ? `${parentKey}/${key}` : key;
      keys.push(currentKey);
      if (typeof obj[key] === 'object') {
        keys = keys.concat(getAllKeysWithParents(obj[key], currentKey));
      }
    }
  }

  return keys;
}

//ensuring the plugin(s) load before we start registering endpoints
fastify.after(() => {
  const only_testing = []//['ctrail', 'gtfs_sch_acc'];
  const exclude_from_root = ['gtfs_sch', 'gtfs_sch_acc', 'chicago_snowplow_routes', 'atlas_routes', 'amtrak_fetch_proxy']; // won't be returned to lighten the load, can be overridden

  let data = {};
  let data_reduced = {};
  let data_configs = {};

  // getting folders within scripts folder
  const endpoints = fs.readdirSync('./endpoints');

  if (process.env.PROXY_MODE == 'true') {
    const updateInProxyMode = () => {
      fetch('https://store.transitstat.us/?showAll=true')
        .then((result) => {
          if (result !== false) {
            data = result;

            console.log('Finished updating in proxy mode')

            console.log(`Destroying /GET`)
            fastify.lcache.reset(`/GET`)
          }
        })
    };

    updateInProxyMode();
    setInterval(() => { updateInProxyMode() }, process.env.PROXY_MODE_INTERVAL ?? 60000);
  } else { // normal operation
    // going through endpoints and setting up update jobs
    endpoints.forEach(async (endpoint) => {
      if (only_testing.length > 0 && !only_testing.includes(endpoint)) return;

      console.log(`Loading endpoint: ${endpoint}`);
      if (fs.lstatSync(`./endpoints/${endpoint}`).isDirectory()) {
        console.log(`${endpoint} is a directory`);
        console.log(`Reading ${endpoint} config file`)

        if (!fs.existsSync(`./endpoints/${endpoint}/config.json`)) {
          console.log(`No config file found for ${endpoint}, not continuing`);
          return;
        }

        const config = JSON.parse(fs.readFileSync(`./endpoints/${endpoint}/config.json`));
        if (config) data_configs[endpoint] = config;

        if (config.disabled) {
          console.log(`Endpoint ${endpoint} is disabled, skipping`)
          return;
        }

        if (config.configVersion === undefined || config.configVersion === null) {
          console.log(`No config version found for ${endpoint}, not continuing`);
          return;
        }

        // included for possible future variations in config versions
        switch (config.configVersion) {
          case 0:
            console.log(`Config version 0 detected for ${endpoint}`);

            const updateV0 = require(`./endpoints/${endpoint}/${config.script}`).update;

            data[endpoint] = config.default
            data_reduced[endpoint] = exclude_from_root.includes(endpoint) ? `Not returned due to large size. Visit '/${endpoint}' for data.` : config.default;

            try {
              updateV0()
                .then((result) => {
                  if (result !== false) {
                    data[endpoint] = result;
                    data_reduced[endpoint] = exclude_from_root.includes(endpoint) ? `Not returned due to large size. Visit '/${endpoint}' for data.` : result;

                    const keys = getAllKeysWithParents(config.default);

                    console.log(`Destroying /${endpoint}GET`)
                    fastify.lcache.reset(`/${endpoint}GET`)
                    keys.forEach((key) => {
                      console.log(`Destroying /${endpoint}/${key}GET`)
                      fastify.lcache.reset(`/${endpoint}/${key}GET`)
                    })
                  }
                })
            } catch (e) {
              console.log(`error updating data for ${endpoint}`);
              console.log(e);
            }

            setInterval(() => {
              try {
                updateV0()
                  .then((result) => {
                    if (result === false) return;

                    data[endpoint] = result;
                    data_reduced[endpoint] = exclude_from_root.includes(endpoint) ? `Not returned due to large size. Visit '/${endpoint}' for data.` : result;
                  })
              } catch (e) {
                console.log(`error updating data for ${endpoint}`);
                console.log(e);
              }
            }, config.interval);

            break;
          case 1:
            console.log(`Config version 1 detected for ${endpoint}`);

            const updateV1 = require(`./endpoints/${endpoint}/${config.script}`).update;
            const variables = config.variables;

            data[endpoint] = config.default
            data_reduced[endpoint] = exclude_from_root.includes(endpoint) ? `Not returned due to large size. Visit '/${endpoint}' for data.` : config.default;

            try {
              variables.forEach((variableSet) => updateV1(...variableSet)
                .then((result) => {
                  if (result === false) return;

                  data[endpoint][variableSet[0]] = result;
                  if (!exclude_from_root.includes(endpoint)) data_reduced[endpoint][variableSet[0]] = result;

                  console.log(`Destroying /${endpoint}/${variableSet[0]}GET`)
                  fastify.lcache.reset(`/${endpoint}/${variableSet[0]}GET`);
                }))

            } catch (e) {
              console.log(`error updating data for ${endpoint}`);
              console.log(e);
            }

            setInterval(() => {
              try {
                variables.forEach((variableSet) => updateV1(...variableSet)
                  .then((result) => {
                    if (result === false) return;

                    data[endpoint][variableSet[0]] = result;
                    if (!exclude_from_root.includes(endpoint)) data_reduced[endpoint][variableSet[0]] = result;
                  }))
              } catch (e) {
                console.log(`error updating data for ${endpoint}`);
                console.log(e);
              }
            }, config.interval);

            break;
          case 2:
            console.log(`Config version 2 detected for ${endpoint}`);

            const updateV2 = require(`./endpoints/${endpoint}/${config.script}`).update;

            data[endpoint] = config.default;
            data_reduced[endpoint] = exclude_from_root.includes(endpoint) ? `Not returned due to large size. Visit '/${endpoint}' for data.` : config.default;

            try {
              const initialState = await fetch(`https://store.transitstat.us/${endpoint}`)
                .then((res) => res.json())
                .catch((e) => {
                  return config.default; // earlier failure or issue
                });

              data[endpoint] = initialState;
              data_reduced[endpoint] = exclude_from_root.includes(endpoint) ? `Not returned due to large size. Visit '/${endpoint}' for data.` : initialState;

              updateV2({ firstUpdate: true })
                .then((result) => {
                  if (result === false) {
                    data[endpoint] = initialState;
                    data_reduced[endpoint] = exclude_from_root.includes(endpoint) ? `Not returned due to large size. Visit '/${endpoint}' for data.` : initialState;
                  } else {
                    data[endpoint] = result;
                    data_reduced[endpoint] = exclude_from_root.includes(endpoint) ? `Not returned due to large size. Visit '/${endpoint}' for data.` : result;

                    const keys = getAllKeysWithParents(config.default);

                    console.log(`Destroying /${endpoint}GET`)
                    fastify.lcache.reset(`/${endpoint}GET`)
                    keys.forEach((key) => {
                      console.log(`Destroying /${endpoint}/${key}GET`)
                      fastify.lcache.reset(`/${endpoint}/${key}GET`)
                    })
                  }
                })
            } catch (e) {
              console.log(`error updating data for ${endpoint}`);
              console.log(e);
            }

            setInterval(() => {
              try {
                updateV2({ firstUpdate: false })
                  .then((result) => {
                    if (result === false) return;

                    data[endpoint] = result;
                    data_reduced[endpoint] = exclude_from_root.includes(endpoint) ? `Not returned due to large size. Visit '/${endpoint}' for data.` : result;
                  })
              } catch (e) {
                console.log(`error updating data for ${endpoint}`);
                console.log(e);
              }
            }, config.interval);

            break;
          default:
            console.log(`No known config version detected for ${endpoint}`);
            break;
        }
      } else {
        console.log(`${endpoint} is a file, not continuing`);
      }
    });
  }

  fastify.get('*', (request, reply) => {
    let path = request.url.split('?')[0];

    console.log(`Returning data for ${path}`)

    if (path === '/') {
      reply.header('Access-Control-Allow-Origin', '*');
      if (request.query?.showAll == 'true') reply.send(data)
      else reply.send(data_reduced);
      return;
    }

    //remove leading slash first
    const pathArray = path.substring(1).split('/');
    let dataToReturn = data;

    try {
      pathArray.forEach((path) => {
        if (path === '') return; //trailing slash

        if (path === '_ts_store_meta') {
          let roughSizesOfKeys = {};

          Object.keys(dataToReturn).forEach((key) => {
            roughSizesOfKeys[key] = JSON.stringify(dataToReturn[key]).length
          });

          dataToReturn = {
            roughSize: JSON.stringify(dataToReturn).length,
            roughSizesOfKeys,
            config: data_configs[pathArray[0]] ?? null
          };
          return;
        };

        dataToReturn = dataToReturn[path];

        if (dataToReturn === undefined) {
          throw new Error('Not found');
        }
      });
    } catch (e) {
      //console.log(e);
      console.log('Not found:', path)
      reply.header('Access-Control-Allow-Origin', '*');
      reply.code(404);
      reply.send('Not found');
      return;
    }

    reply.header('Access-Control-Allow-Origin', '*');
    reply.send(dataToReturn);
  });

  //killing the cache's default state every 5 seconds for the first minute just in case the updates didn't go through above
  //this isnt needed, but tbh i dont trust this cache implementation
  for (let i = 5; i <= 60; i += 5) {
    setTimeout(() => {
      console.log('Hard resetting cache')
      fastify.lcache.reset();
    }, i * 1000)
  }
});

fastify.listen({ port: process.env.PORT ?? 3000, host: '0.0.0.0', }, (err, address) => {
  if (err) throw err
  console.log(`Server is now listening on ${address}`);
})
