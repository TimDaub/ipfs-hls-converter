// @format

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
    }, 1000)
  }

  request() {
  }

  render() {
    return (
      <div>
        <h1>IPFS MP4 Converter</h1>
        <p>
          This website converts any IPFS-hosted file to .mp4 and reuploads it to
          IPFS.
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
              this.state.file &&
              'https://ipfs.infura.io/ipfs/' + this.state.file.hash
            }>
            File on Infura
          </a>
        </p>
      </div>
    );
  }
}

const domContainer = document.querySelector('.root');
ReactDOM.render(<App />, domContainer);
