const { exec } = require('child_process');

var ipfsHashes = function(req, res, next) {

    exec(`docker run -v $PWD:/tmp jrottenberg/ffmpeg:3.4-scratch -stats -i http://gateway.ipfs.io/ipfs/${req.params.ipfsHash} -c:v libx264 -pix_fmt yuv420p10 -t 5 -f mp4 /tmp/${req.params.ipfsHash}.mp4`,
        (error, stdout, stderr) => {
            if (error) {
                console.error(`exec error: ${error}`)
                return;
            }
            console.log(`stdout: ${stdout}`)
            console.log(`stderr: ${stderr}`)
    })
    res.send(200)
}

module.exports = {
    ipfsHashes: ipfsHashes
}
