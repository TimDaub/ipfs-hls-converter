// @format
const {spawn} = require('child_process');
const ipfsAPI = require('ipfs-api');
const https = require('https');
const fs = require('fs');
const PouchDB = require('pouchdb-node');
const rimraf = require('rimraf');
const util = require('util');
const Bull = require('bull');
let mkdirp = require('mkdirp');

mkdirp = util.promisify(mkdirp);

let errors = {};
const queue = new Bull('video processing', {
  redis: {port: 6379, host: 'redis', password: process.env.REDIS_PSWD},
});

queue.process(async (job, done) => {
  var db = new PouchDB('mydb');
  const {ipfsHash, random} = job.data;

  try {
    await download(
      'https://ipfs.infura.io/ipfs/' + ipfsHash,
      process.env.PWD,
      ipfsHash,
    );
  } catch (err) {
    const doc = await db.get(ipfsHash);
    db.put({
      _id: ipfsHash,
      _rev: doc._rev,
      status: 'error',
      error: 'Download failed',
      duration: doc.duration,
      percentage: doc.percentage,
      progress: doc.progress,
    });
    return;
  }
  let duration;
  try {
    duration = await getDuration(ipfsHash);
  } catch (err) {
    const doc = await db.get(ipfsHash);
    db.put({
      _id: ipfsHash,
      _rev: doc._rev,
      status: 'error',
      error: err.message,
    });
    deleteFile(ipfsHash, random);
  }
  const doc = await db.get(ipfsHash);
  db.put({
    _id: ipfsHash,
    _rev: doc._rev,
    duration: duration,
    status: 'processing',
  });

  // https://github.com/ipfs/js-ipfs/tree/master/examples/browser-video-streaming
  const options = [
    '-i',
    ipfsHash,
    '-profile:v',
    'baseline',
    '-level',
    '3.0',
    '-start_number',
    '0',
    '-hls_time',
    '5',
    //'-t',
    //'2',
    '-hls_list_size',
    '0',
    '-strict',
    '-2',
    '-f',
    'hls',
    './' + ipfsHash + random + '/master.m3u8',
  ];
  console.log(options);
  const child = spawn('ffmpeg', options);

  child.stdout.on('data', data => {
    var textChunk = data.toString('utf8');
    console.log(textChunk);
  });

  child.stderr.on('data', async data => {
    var textChunk = data.toString('utf8');
    console.log(textChunk);

    const timeStart = textChunk.search('time=');
    if (timeStart !== -1) {
      const progress = textChunk.slice(timeStart + 5, timeStart + 16);
      const doc = await db.get(ipfsHash);
      db.put({
        _id: ipfsHash,
        _rev: doc._rev,
        progress: progress,
        duration: doc.duration,
        status: 'processing',
        percentage: getPercentage(doc.duration, progress),
      });
      job.process(getPercentage(doc.duration, progress));
    }
  });

  child.on('exit', async err => {
    if (err === 1) {
      const doc = await db.get(ipfsHash);
      db.put({
        _id: ipfsHash,
        _rev: doc._rev,
        status: 'error',
        error: 'FFMPEG failed',
        duration: doc.duration,
        percentage: doc.percentage,
        progress: doc.progress,
      });
      deleteFile(ipfsHash, random);
      return;
    }

    console.log('Uploading to local ipfs node');
    const ipfs = ipfsAPI(process.env.IPFS_HOST, '5001', {
      protocol: 'http',
    });

    const addFromFs = util.promisify(ipfs.util.addFromFs.bind(ipfs));
    let result;
    try {
      result = await addFromFs('./' + ipfsHash + random + '/', {
        recursive: true,
      });
    } catch (err) {
      const doc = await db.get(ipfsHash);
      console.log('Updating database');
      db.put({
        _id: ipfsHash,
        _rev: doc._rev,
        files: result,
        status: 'error',
        progress: doc.progress,
        duration: doc.duration,
        percentage: doc.percentage,
      });
      deleteFile(ipfsHash, random);
    }

    const doc = await db.get(ipfsHash);
    console.log('Updating database');
    db.put({
      _id: ipfsHash,
      _rev: doc._rev,
      files: result,
      status: 'finished',
      progress: doc.progress,
      duration: doc.duration,
      percentage: doc.percentage,
    });
    deleteFile(ipfsHash, random);
    done();
  });
});

var ipfsHashes = async function(req, res, next) {
  var db = new PouchDB('mydb');
  try {
    const doc = await db.get(req.params.ipfsHash);
    if (doc.status === 'error' && errors[req.params.ipfsHash]) {
      errors[req.params.ipfsHash] = undefined;
      throw new Error('Continue with encoding');
    } else if (doc.status === 'error' && !errors[req.params.ipfsHash]) {
      errors[req.params.ipfsHash] = true;
      res.json(200, doc);
    } else {
      res.json(200, doc);
    }
  } catch (err) {
    db.put({
      _id: req.params.ipfsHash,
      status: 'downloading',
    });

    res.json(200, {
      status: 'File is downloaded and processed, check back later',
    });
    const random = randomString(10);

    try {
      await mkdirp(req.params.ipfsHash + random);
    } catch (err) {
      const doc = await db.get(req.params.ipfsHash);
      db.put({
        _id: req.params.ipfsHash,
        _rev: doc._rev,
        status: 'error',
        error: "Couldn't create directory",
        duration: doc.duration,
        percentage: doc.percentage,
        progress: doc.progress,
      });
      deleteFile(req.params.ipfsHash, random);
    }

    queue.add({
      ipfsHash: req.params.ipfsHash,
      random: random,
    });
    queue.on('completed', job => {
      console.log(`Job with id ${job.id} has been completed`);
    });
    queue.on('error', function(error) {
      console.log(error);
    });
    queue.on('failed', function(job, err) {
      console.log(err);
    });
  }
};

function getDuration(name) {
  return new Promise((resolve, reject) => {
    const options = [
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'default=noprint_wrappers=1:nokey=1',
      name,
    ];
    console.log(options);
    const child = spawn('ffprobe', options);
    child.stdout.on('data', data => {
      var textChunk = data.toString('utf8');
      resolve(parseFloat(textChunk));
    });
    child.stderr.on('data', data => {
      var textChunk = data.toString('utf8');
      console.log(textChunk);
    });
    child.on('exit', err => {
      if (err === 1) {
        reject(new Error('Fatal error reading duration'));
      }
    });
  });
}

function deleteFile(name, random) {
  rimraf(name + random, function() {
    console.log('deleting folder');
  });
  console.log('deleting file');
  fs.unlinkSync(name);
}

function getPercentage(duration, progress) {
  const progressSplit = progress.split(':');
  const progressHours = progressSplit[0];
  const progressMinutes = progressSplit[1];
  const progressSeconds = progressSplit[2];

  const progressTotalSeconds =
    parseInt(progressHours) * 3600 +
    parseInt(progressMinutes) * 60 +
    parseInt(progressSeconds);

  return Math.round((progressTotalSeconds / duration) * 100);
}

const download = function(url, dest, filename) {
  return new Promise((resolve, reject) => {
    console.log('Starting download');
    const file = fs.createWriteStream(dest + '/' + filename);
    const request = https.get(url, function(response) {
      const {statusCode} = response;
      response.pipe(file);
      file.on('finish', function() {
        if (statusCode === 504) {
          cb(new Error('Download failed'));
          reject(new Error('Download failed'));
        } else {
          file.close(resolve);
        }
      });
    });
  });
};

function randomString(len, charSet) {
  charSet =
    charSet || 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  var randomString = '';
  for (var i = 0; i < len; i++) {
    var randomPoz = Math.floor(Math.random() * charSet.length);
    randomString += charSet.substring(randomPoz, randomPoz + 1);
  }
  return randomString;
}

module.exports = {
  ipfsHashes: ipfsHashes,
};
