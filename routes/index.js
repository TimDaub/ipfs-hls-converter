// @format
const {spawn} = require('child_process');
const ipfsAPI = require('ipfs-api');
const https = require('https');
const fs = require('fs');
const PouchDB = require('pouchdb-node');
const mkdirp = require('mkdirp');
const rimraf = require('rimraf');

let errors = {};
var ipfsHashes = async function(req, res, next) {
  var db = new PouchDB('mydb');
  db.get(req.params.ipfsHash)
    .then(doc => {
      if (doc.status === 'error' && errors[req.params.ipfsHash]) {
        errors[req.params.ipfsHash] = undefined;
        throw new Error('Continue with encoding');
      } else if (doc.status === 'error' && !errors[req.params.ipfsHash]) {
        errors[req.params.ipfsHash] = true;
        res.json(200, doc);
      } else {
        res.json(200, doc);
      }
    })
    .catch(err => {
      db.put({
        _id: req.params.ipfsHash,
        status: 'processing',
      });

      res.json(200, {
        status: 'File is downloaded and processed, check back later',
      });
      const random = randomString(10);

      mkdirp(req.params.ipfsHash + random, function(err) {
        download(
          'https://ipfs.infura.io/ipfs/' + req.params.ipfsHash,
          process.env.PWD,
          req.params.ipfsHash,
          error => {
            if (error) {
              db.get(req.params.ipfsHash).then(doc => {
                db.put({
                  _id: req.params.ipfsHash,
                  _rev: doc._rev,
                  status: 'error',
                  error: 'Download failed',
                  duration: doc.duration,
                  percentage: doc.percentage,
                  progress: doc.progress,
                });
              });
              return;
            }

            getDuration(req.params.ipfsHash, random).then(duration => {
              db.get(req.params.ipfsHash).then(doc => {
                db.put({
                  _id: req.params.ipfsHash,
                  _rev: doc._rev,
                  duration: duration,
                  status: 'processing',
                });
              });
              // https://github.com/ipfs/js-ipfs/tree/master/examples/browser-video-streaming
              const options = [
                '-i',
                req.params.ipfsHash,
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
                './' + req.params.ipfsHash + random + '/master.m3u8',
              ];
              console.log(options);
              const child = spawn('ffmpeg', options);

              child.stdout.on('data', data => {
                var textChunk = data.toString('utf8');
                console.log(textChunk);
              });

              child.stderr.on('data', data => {
                var textChunk = data.toString('utf8');
                console.log(textChunk);

                const timeStart = textChunk.search('time=');
                if (timeStart !== -1) {
                  const progress = textChunk.slice(
                    timeStart + 5,
                    timeStart + 16,
                  );
                  db.get(req.params.ipfsHash).then(doc => {
                    db.put({
                      _id: req.params.ipfsHash,
                      _rev: doc._rev,
                      progress: progress,
                      duration: doc.duration,
                      status: 'processing',
                      percentage: getPercentage(doc.duration, progress),
                    });
                  });
                }
              });

              child.on('exit', err => {
                if (err === 1) {
                  db.get(req.params.ipfsHash).then(doc => {
                    db.put({
                      _id: req.params.ipfsHash,
                      _rev: doc._rev,
                      status: 'error',
                      error: 'Processing failed',
                      duration: doc.duration,
                      percentage: doc.percentage,
                      progress: doc.progress,
                    });
                    deleteFile(req.params.ipfsHash, random);
                  });
                  return;
                }

                console.log('Uploading to local ipfs node');
                const ipfs = ipfsAPI(process.env.IPFS_HOST, '5001', {
                  protocol: 'http',
                });

                ipfs.util.addFromFs(
                  './' + req.params.ipfsHash + random + '/',
                  {recursive: true},
                  function(err, result) {
                    console.log(result, err);
                    if (err) {
                      db.get(req.params.ipfsHash).then(doc => {
                        console.log('Updating database');
                        db.put({
                          _id: req.params.ipfsHash,
                          _rev: doc._rev,
                          files: result,
                          status: 'error',
                          progress: doc.progress,
                          duration: doc.duration,
                          percentage: doc.percentage,
                        });
                        deleteFile(req.params.ipfsHash, random);
                      });
                    }
                    db.get(req.params.ipfsHash)
                      .then(doc => {
                        console.log('Updating database');
                        db.put({
                          _id: req.params.ipfsHash,
                          _rev: doc._rev,
                          files: result,
                          status: 'finished',
                          progress: doc.progress,
                          duration: doc.duration,
                          percentage: doc.percentage,
                        });
                        deleteFile(req.params.ipfsHash, random);
                      })
                      .catch(console.log);
                  },
                );
              });
            });
          },
        );
      });
    });
};

function getDuration(name, random) {
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

const download = function(url, dest, filename, cb) {
  console.log('Starting download');
  const file = fs.createWriteStream(dest + '/' + filename);
  const request = https.get(url, function(response) {
    const {statusCode} = response;
    response.pipe(file);
    file.on('finish', function() {
      if (statusCode === 504) {
        cb(new Error('Download failed'));
      } else {
        file.close(cb);
      }
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
