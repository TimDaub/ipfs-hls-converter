// @format
const {spawn} = require('child_process');
const ipfsAPI = require('ipfs-api');
const fs = require('fs');
const PouchDB = require('pouchdb-node');

var ipfsHashes = function(req, res, next) {
  var db = new PouchDB('mydb');
  db.get(req.params.ipfsHash)
    .then(doc => {
      res.send(200, doc);
    })
    .catch(err => {
      db.put({
        _id: req.params.ipfsHash,
        status: 'processing',
      });

      res.send(200, 'File is downloaded and processed, check back later');
      const random = randomString(10);
      console.log(process.argv[1]);
      const child = spawn('docker', [
        'run',
        '-v',
        process.env.PWD + ':/tmp',
        'jrottenberg/ffmpeg:3.4-scratch',
        '-i',
        'http://ipfs.infura.io/ipfs/' + req.params.ipfsHash,
        '-t',
        '5',
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
      });

      child.on('exit', err, stdout => {
        if (err === 1) {
          console.log(stdout);
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
          console.log(req.params);
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
