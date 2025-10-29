const cryptoOld = require('crypto-js');
const crypto = require('node:crypto');

const sValue = "9a3686ac";
const iValue = "c6eb2f7f5c4740c1a2f708fefd947d39";
const publicKey = "69af143c-e8cf-47f8-bf09-fc1f61e5cc33";
const masterSegment = 88;

const decryptOld = (content, key) => {
  return cryptoOld.AES.decrypt(
    cryptoOld.lib.CipherParams.create({
      ciphertext: cryptoOld.enc.Base64.parse(content),
    }),
    cryptoOld.PBKDF2(key, cryptoOld.enc.Hex.parse(sValue), {
      keySize: 4,
      iterations: 1e3,
      hasher: cryptoOld.algo.SHA1 // thank you cabalex!
    }),
    { iv: cryptoOld.enc.Hex.parse(iValue) }
  ).toString(cryptoOld.enc.Utf8);
};

const decrypt = (content, key) => {
  const salt = Buffer.from(sValue, 'hex');
  const iv = Buffer.from(iValue, 'hex');

  const derivedKey = crypto.pbkdf2Sync(
    key,
    salt,
    1e3, // iterations 
    16, // key length in bytes 
    'sha1' // digest
  );

  const ciphertext = Buffer.from(content, 'base64');

  const decipher = crypto.createDecipheriv(
    'aes-128-cbc',
    derivedKey,
    iv
  );

  let decrypted = decipher.update(ciphertext);
  decrypted = Buffer.concat([decrypted, decipher.final()]);

  return decrypted.toString('utf8');
};

const getDecryptedData = (data) => {
  const mainContent = data.substring(0, data.length - masterSegment);
  const encryptedPrivateKey = data.substr(
    data.length - masterSegment,
    data.length
  );
  const privateKey = decrypt(encryptedPrivateKey, publicKey).split("|")[0];

  const decryptedData = decrypt(mainContent, privateKey);

  if (decryptedData.length > 0) return JSON.parse(decryptedData);
  return {};
};

const updateFeed = async (updateConfig) => {
  try {
    let responseObject = {
      trainDataMain: { type: "FeatureCollection", features: [] },
      trainStations: { type: "FeatureCollection", features: [] },
      trainDataASMAD: { type: "FeatureCollection", features: [] },
      updatedAt: 0,
    };

    const updatedAt = new Date();
    const fetchedData = await fetch('https://amtraker-fetch-proxy.piero.workers.dev/').then((res) => res.json());
    responseObject = {
      ...fetchedData,
      trainDataMain: getDecryptedData(fetchedData.trainDataMain) ?? { type: "FeatureCollection", features: [] },
      trainStations: getDecryptedData(fetchedData.trainStations).StationsDataResponse ?? { type: "FeatureCollection", features: [] },
      trainDataASMAD: JSON.parse(fetchedData.trainDataASMAD) ?? { type: "FeatureCollection", features: [] },
      trainDataVIA: JSON.parse(fetchedData.trainDataVIA) ?? {},
      updatedAt: updatedAt.valueOf(),
      updatedAtISO: updatedAt.toISOString(),
      updatedAtChicagoPlain: updatedAt.toLocaleString("en-US", {
        dateStyle: "full",
        timeStyle: "long",
        timeZone: "America/Chicago"
      }),
    }

    console.log(`Finished updating Amtraker Proxy`)
    return responseObject;
  } catch (e) {
    console.log('Error with Amtraker Proxy Alerts')

    const errorMessage = e.message;
    const errorString = e.toString();

    if (updateConfig.firstUpdate) {
      const initialStateText = await fetch('https://store.transitstat.us/amtrak_fetch_proxy').then((res) => res.text());
      if (initialStateText !== 'Not found' && !initialStateText.startsWith('no available server')) return JSON.parse(initialStateText);
    };

    return {
      trainStations: { type: "FeatureCollection", features: [] },
      trainDataMain: { type: "FeatureCollection", features: [] },
      trainDataASMAD: { type: "FeatureCollection", features: [] },
      updatedAt: Date.now(),
    };
  }
};

exports.update = updateFeed;
