const fs = require('fs');
const fastify = require('fastify')({
  logger: false
});

let data = {};

// getting folders within scripts folder
const endpoints = fs.readdirSync('./endpoints');

// going through endpoints and setting up update jobs
endpoints.forEach(async (endpoint) => {
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

        const { update } = require(`./endpoints/${endpoint}/${config.script}`);

        update()
          .then((result) => {
            data[endpoint] = result;
          })

        setInterval(() => {
          update()
            .then((result) => {
              data[endpoint] = result;
            })
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

fastify.get('/:path', (request, reply) => {
  const { path } = request.params;

  //use path to traverse object recursively and return data
  const pathArray = path.split('/');
  let dataToReturn = data;

  try {
    pathArray.forEach((path) => {
      dataToReturn = dataToReturn[path];

      if (dataToReturn === undefined) {
        throw new Error('Not found');
      }
    });
  } catch (e) {
    console.log(e);
    reply.code(404);
    reply.send('Not found');
    return;
  }

  console.log(`Returning data for ${path}`)

  reply.header('Access-Control-Allow-Origin', '*');
  reply.send(dataToReturn);
});

fastify.listen({ port: 3000, host: '0.0.0.0' }, (err, address) => {
  if (err) throw err
  console.log(`Server is now listening on ${address}`);
})