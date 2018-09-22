// @format
const {spawn} = require('child_process');
const ipfsAPI = require('ipfs-api');
const fs = require('fs');
const PouchDB = require('pouchdb-node');

let errors = {};
var ipfsHashes = function(req, res, next) {
  var db = new PouchDB('mydb');
  db.get(req.params.ipfsHash)
    .then(doc => {
      if (doc.status === 'error' && errors[req.params.ipfsHash]) {
        errors[req.params.ipfsHash] = undefined;
        throw new Error('Continue with encoding');
      } else if (doc.status === 'error' && !errors[req.params.ipfsHash]) {
        errors[req.params.ipfsHash] = true;
        res.send(200, doc);
      } else {
        res.send(200, doc);
      }
    })
    .catch(err => {
      db.put({
        _id: req.params.ipfsHash,
        status: 'processing',
      });

      res.send(200, 'File is downloaded and processed, check back later');
      const random = randomString(10);

      const child = spawn('docker', [
        'run',
        '-v',
        process.env.PWD + ':/tmp',
        'jrottenberg/ffmpeg:3.4-scratch',
        '-i',
        'https://ipfs.infura.io/ipfs/' + req.params.ipfsHash,
        //'-t',
        //'5',
        '-c:v',
        'libx264',
        '-pix_fmt',
        'yuv420p10',
        '-f',
        'mp4',
        '/tmp/' + req.params.ipfsHash + random + '.mp4',
      ]);

      child.stdout.on('data', data => {
        var textChunk = data.toString('utf8');
        console.log(textChunk);
      });

      child.stderr.on('data', data => {
        var textChunk = data.toString('utf8');
        console.log(textChunk);

        const durationStart = textChunk.search('Duration: ');
        if (durationStart !== -1) {
          db.get(req.params.ipfsHash).then(doc => {
            db.put({
              _id: req.params.ipfsHash,
              _rev: doc._rev,
              duration: textChunk.slice(durationStart + 10, durationStart + 21),
              status: 'processing',
            });
          });
        }

        const timeStart = textChunk.search('time=');
        if (timeStart !== -1) {
          db.get(req.params.ipfsHash).then(doc => {
            db.put({
              _id: req.params.ipfsHash,
              _rev: doc._rev,
              progress: textChunk.slice(timeStart + 5, timeStart + 16),
              duration: doc.duration,
              status: 'processing',
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
            });
          });
          return;
        }

        console.log('Uploading to infura');
        const ipfs = ipfsAPI('ipfs.infura.io', '5001', {protocol: 'https'});
        let testFile = fs.readFileSync(`${req.params.ipfsHash + random}.mp4`);
        let testBuffer = new Buffer(testFile);

        ipfs.files.add(testBuffer, function(err, file) {
          if (err) {
            console.log(err);
          }
          db.get(req.params.ipfsHash)
            .then(doc => {
              console.log('Updating database');
              db.put({
                _id: req.params.ipfsHash,
                _rev: doc._rev,
                file: file[0],
                status: 'finished',
              });
              console.log('deleting file');
              fs.unlinkSync(`${req.params.ipfsHash + random}.mp4`);
            })
            .catch(console.log);
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
