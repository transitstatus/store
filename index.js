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
const metricsPlugin = require('fastify-metrics');

fastify.register(metricsPlugin, { endpoint: '/metrics' }).then(() => {

  fastify.register(lcache, {
    ttlInMinutes: 0.5, // set cached data lifetime to 30 seconds
    //excludeRoutes: ['/']
  });

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
    const only_testing = 'amtrak_alerts';

    let data = {};

    // getting folders within scripts folder
    const endpoints = fs.readdirSync('./endpoints');

    // going through endpoints and setting up update jobs
    endpoints.forEach(async (endpoint) => {
      if (only_testing !== undefined && only_testing !== null && only_testing !== '' && endpoint !== only_testing) return;

      console.log(`Loading endpoint: ${endpoint}`);
      if (fs.lstatSync(`./endpoints/${endpoint}`).isDirectory()) {
        console.log(`${endpoint} is a directory`);
        console.log(`Reading ${endpoint} config file`)

        if (!fs.existsSync(`./endpoints/${endpoint}/config.json`)) {
          console.log(`No config file found for ${endpoint}, not continuing`);
          return;
        }

        const config = JSON.parse(fs.readFileSync(`./endpoints/${endpoint}/config.json`));

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

            try {
              updateV0()
                .then((result) => {
                  if (result === false) {
                    data[endpoint] = config.default
                  } else {
                    data[endpoint] = result;

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

            try {
              variables.forEach((variableSet) => updateV1(...variableSet)
                .then((result) => {
                  if (result === false) return;

                  data[endpoint][variableSet[0]] = result;

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
                  }))
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

    fastify.get('*', (request, reply) => {
      let path = request.url;

      console.log(`Returning data for ${path}`)

      if (path === '/') {
        reply.header('Access-Control-Allow-Origin', '*');
        reply.send(data);
        return;
      }

      //remove leading slash first
      const pathArray = path.substring(1).split('/');
      let dataToReturn = data;

      try {
        pathArray.forEach((path) => {
          if (path === '') return; //trailing slash

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

  fastify.listen({ port: 3000, host: '0.0.0.0', }, (err, address) => {
    if (err) throw err
    console.log(`Server is now listening on ${address}`);
  })
});