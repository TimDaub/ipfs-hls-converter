// @format
import React from 'react';
import ReactDOM from 'react-dom';
import css from './styles.css';
import Highlight from 'react-highlight';
import {Line} from 'rc-progress';

class App extends React.Component {
  state = {
    status: '',
    intervals: [],
  };
  handleClick = () => {
    const {intervals} = this.state;

    const intervalId = setInterval(() => {
      var Http = new XMLHttpRequest();
      var url = '../hashes/' + document.querySelector('.value').value;
      Http.open('GET', url);
      Http.send();
      Http.onreadystatechange = e => {
        const data = JSON.parse(Http.responseText);
        this.setState(data);
      };
    }, 1000);

    intervals.push(intervalId);
    this.setState({intervals, status: ''});
  };

  componentDidUpdate(prevProps, prevState) {
    const {status, intervals} = this.state;
    if (
      (status === 'error' && intervals.length !== 0) ||
      (status === 'finished' && intervals.length !== 0)
    ) {
      intervals.forEach(clearInterval);
      this.setState({intervals: []});
    }
  }

  progressBar() {
    const {percentage} = this.state;
    if (percentage && percentage !== 100) {
      return (
        <Line
          percent={percentage}
          strokeWidth="3"
          trailWidth="3"
          strokeColor="black"
          trailColor="white"
          strokeLinecap="square"
          style={{
            marginTop: '1em',
          }}
        />
      );
    }
  }

  status() {
    const {files, status, error} = this.state;
    if (files) {
      const hash = files[files.length - 1].hash;
      return (
        <p>
          <a target="_blank" href={'https://ipfs.io/ipfs/' + hash}>
            Check out your file: {hash}
          </a>
        </p>
      );
    }
    if (status === 'error' && error) {
      return <p>Processing threw an error: {error}</p>;
    }
    if (status === 'downloading') {
      return <p>Downloading the file and piping it to FFMPEG</p>;
    }
  }

  render() {
    const {files} = this.state;
    return (
      <div className="app">
        <h1>IPFS HLS Converter</h1>
        <p>
          This website converts any IPFS-hosted file to an{' '}
          <a
            target="_blank"
            href="https://github.com/ipfs/js-ipfs/tree/master/examples/browser-video-streaming">
            HLS file
          </a>{' '}
          and reuploads it to IPFS.
        </p>
        <input
          type="text"
          className="value"
          placeholder="IPFS hash (e.g. QmazrX5KcJodeGWBKEo2Cc4RJ8a6sDkB2SC58j8xqTSxMz)"
        />
        <span className="btn" onClick={this.handleClick} type="submit">
          Convert
        </span>
        {this.progressBar()}
        {this.status()}
        <h2>API (free)</h2>
        <h3>HTTP GET /hashes/:IPFSHash/</h3>
        <p>
          When an IPFS hash is requested to be converted a subprocess is spawned
          that downloads the file and converts it with FFMPEG. During this time,
          the endpoint can be continously be queried by a script (polling). The
          `status` property will indicate the status of the processing.
        </p>
        <Highlight language="javascript">
          {`
{
    "_id": "QmYRh3EmbVCTyA5vi1YJeKN3xQiyyogwf6t36LzMTN9FGb",
    "_rev": "19-f8918be4b43a18ebebb2962b226f7ff9",
    "duration": "00:00:23.10",
    "files": [
    {
        "hash": "QmSHAwFbJiufnWQwCtQMevzAWjK8gqQECvuo3mpxMutM9y",
        "path": "QmYRh3EmbVCTyA5vi1YJeKN3xQiyyogwf6t36LzMTN9FGbHTyhaIShBH/master.m3u8",
        "size": 246
    },
    {
        "hash": "QmeghHDm1DzoJa8mLE6LD8QTcSRnxmsUkqgLwpvrDqDVh3",
        "path": "QmYRh3EmbVCTyA5vi1YJeKN3xQiyyogwf6t36LzMTN9FGbHTyhaIShBH/master0.ts",
        "size": 3478125
    },
    {
        "hash": "Qmca9scyDaG5yLcXP3oQKeVMC65h9pMv29PRYZJ3SGJbpF",
        "path": "QmYRh3EmbVCTyA5vi1YJeKN3xQiyyogwf6t36LzMTN9FGbHTyhaIShBH/master1.ts",
        "size": 800943
    },
    {
        "hash": "QmcQ6ttJZfV6PfgFc3bK7nmUhVcwXdMDAA6gpwWM5TPfKF",
        "path": "QmYRh3EmbVCTyA5vi1YJeKN3xQiyyogwf6t36LzMTN9FGbHTyhaIShBH/master2.ts",
        "size": 1537468
    },
    {
        "hash": "QmY1m5xM9Ce6GMvYtZdqYjt1aUibHTkhrPRJrQkdLemC5L",
        "path": "QmYRh3EmbVCTyA5vi1YJeKN3xQiyyogwf6t36LzMTN9FGbHTyhaIShBH/master3.ts",
        "size": 1314307
    },
    {
        "hash": "QmfNgCUG35h9XZZaAxSWoubaxAfkFoc9eeGWDbABhK9W7c",
        "path": "QmYRh3EmbVCTyA5vi1YJeKN3xQiyyogwf6t36LzMTN9FGbHTyhaIShBH/master4.ts",
        "size": 149286
    },
    {
        "hash": "QmNuH4tuWm6CV6hXjDctEoy66hRcchG8qeFxL2w8FWPkVV",
        "path": "QmYRh3EmbVCTyA5vi1YJeKN3xQiyyogwf6t36LzMTN9FGbHTyhaIShBH",
        "size": 7280704
    }
    ],
    "percentage": 100,
    "progress": "00:00:23.10",
    "status": "finished"
}
            `}
        </Highlight>
        <h2>Embedd your movie into your website</h2>
        <p>
          It's important to use the folder hash (usually the last in the array
          `files`) as `testhash`'s value.
        </p>
        <iframe
          width="100%"
          height="850"
          src="//jsfiddle.net/0jh78pcL/3/embedded/html,result/"
          allowfullscreen="allowfullscreen"
          allowpaymentrequest
          frameborder="0"
        />
      </div>
    );
  }
}

const domContainer = document.querySelector('.root');
ReactDOM.render(<App />, domContainer);
