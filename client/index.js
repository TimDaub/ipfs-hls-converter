// @format
import React from 'react';
import ReactDOM from 'react-dom';
import css from './styles.css';

class App extends React.Component {
  state = {
    status: '',
  };
  handleClick = () => {
    setInterval(() => {
      var Http = new XMLHttpRequest();
      var url = '../hashes/' + document.querySelector('.value').value;
      Http.open('GET', url);
      Http.send();
      Http.onreadystatechange = e => {
        const data = JSON.parse(Http.responseText);
        this.setState(data);
      };
    }, 1000);
  };

  render() {
    const {files} = this.state;
    return (
      <div>
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
        <input type="text" className="value" placeholder="IPFS hash" />
        <button onClick={this.handleClick} type="submit">
          Convert
        </button>
        <p>Status: {this.state.status}</p>
        <p>Percentage: {this.state.percentage}</p>
        <p>
          File:{' '}
          <a
            target="_blank"
            href={
              files &&
              'https://ipfs.infura.io/ipfs/' + files[files.length - 1].hash
            }>
            File on Infura
          </a>
        </p>
        <p>To embedd a file, use the following code</p>
      </div>
    );
  }
}

const domContainer = document.querySelector('.root');
ReactDOM.render(<App />, domContainer);
