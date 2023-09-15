const fs = require('fs');
const fastify = require('fastify')({
  logger: false
});

const only_testing = ''

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

fastify.get('/', (request, reply) => {
  console.log('Returning data for /');

  reply.header('Access-Control-Allow-Origin', '*');
  reply.send(data);
})

fastify.get('*', (request, reply) => {
  const path = request.url;

  console.log(`Returning data for ${path}`)

  //remove leading slash first
  const pathArray = path.substring(1).split('/');
  let dataToReturn = data;

  try {
    pathArray.forEach((path) => {
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

fastify.listen({ port: 3000, host: '0.0.0.0' }, (err, address) => {
  if (err) throw err
  console.log(`Server is now listening on ${address}`);
})