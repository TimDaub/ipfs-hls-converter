const { exec } = require('child_process');
const ipfsAPI = require('ipfs-api');
const fs = require('fs');
const PouchDB = require('pouchdb-node');

var ipfsHashes = function(req, res, next) {
    var db = new PouchDB('mydb');
    db.get(req.params.ipfsHash)
        .then(doc => {
            res.send(200, doc)
        }).catch(err => {
            db.put({
                _id: req.params.ipfsHash,
                status: "processing"
            })

            const random = randomString(10)
            exec(`docker run -v $PWD:/tmp jrottenberg/ffmpeg:3.4-scratch -stats -i http://gateway.ipfs.io/ipfs/${req.params.ipfsHash} -c:v libx264 -pix_fmt yuv420p10 -f mp4 /tmp/${req.params.ipfsHash+random}.mp4`,
                (error, stdout, stderr) => {
                    if (error) {
                        console.error(`exec error: ${error}`)
                        db.put({
                            _id: req.params.ipfsHash,
                            log: stderr
                        })
                        return;
                    }
                    console.log(`stdout: ${stdout}`)
                    console.log(`stderr: ${stderr}`)

                    const ipfs = ipfsAPI('ipfs.infura.io', '5001', {protocol: 'https'})
                    let testFile = fs.readFileSync(`${req.params.ipfsHash + random}.mp4`);
                    let testBuffer = new Buffer(testFile);
                    ipfs.files.add(testBuffer, function (err, file) {
                        if (err) {
                            console.log(err);
                        }
                        console.log(file)
                        db.get(req.params.ipfsHash)
                            .then(doc => {
                                db.put({
                                    _id: req.params.ipfsHash,
                                    _rev: doc._rev,
                                    file: file[0],
                                    status: "finished"
                                })
                            }).catch(console.log)
                    })
            })
            res.send(200, "File is downloaded and processed, check back later")
        })

}

function randomString(len, charSet) {
    charSet = charSet || 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var randomString = '';
    for (var i = 0; i < len; i++) {
        var randomPoz = Math.floor(Math.random() * charSet.length);
        randomString += charSet.substring(randomPoz,randomPoz+1);
    }
    return randomString;
}

module.exports = {
    ipfsHashes: ipfsHashes
}
