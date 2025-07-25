import linkSources from './linkSources';

type SpacedustStatus = 'disconnected' | 'connecting' | 'connected';

type Linkrement = { // this name should send me to jail
  subject: String // at-uri
  source: String // link source
};
type LinkHandler = (l: Linkrement) => void;

/**
 * simple spacedust demo client
 *
 * only purpose for now is to serve this demo so it might contain hacks
 **/
export class Spacedust {
  #callback: LinkHandler;
  #endpoint: string;

  // #socket must be null when #status is 'disconnected'
  #socket: WebSocket | null = null;
  #status: SpacedustStatus = 'disconnected';

  #subjects: string[];
  #subjectsDirty: boolean = false; // in case we try to update while disconnected
  #sources: string[] = Object.keys(linkSources); // hard-coding for demo
  #eol: boolean = false; // flag: we should shut down

  constructor(
    onLink: LinkHandler,
    endpoint: string = 'https://spacedust.microcosm.blue',
    subjects: string[] = [],
  ) {
    this.#callback = onLink;
    this.#endpoint = endpoint;
    this.#subjects = subjects;
    this.#connect();
  }

  async #connect(reconnecting: boolean = false) {
    this.#status = 'connecting';

    if (reconnecting) {
      const wait = Math.round(1000 + (Math.random() * 1800));
      console.info(`waiting ${(wait / 1000).toFixed(1)}s to reconnect...`);
      await new Promise(r => setTimeout(r, wait));
    }
    if (this.#eol) return this.close();

    // up to date as of this connection init
    this.#subjectsDirty = false;

    if (this.#subjects.length === 0) {
      console.info('no subjects, not connecting spacedust to avoid getting firehosed');
      this.#status = 'disconnected';
      return;
    }

    const url = new URL('/subscribe', this.#endpoint);
    url.searchParams.set('instant', 'true');

    for (const source of this.#sources) {
      url.searchParams.append('wantedSources', source);
    }

    // note: here we put all subjects in the url
    // that's fine since we only have a few for this demo
    // but spacedust accepts up to 50,000 subjects! more than fit in a url-- you
    // have to send a subscriber sourced message in that case after reconnect.
    for (const subject of this.#subjects) {
      url.searchParams.append('wantedSubjects', subject);
    }

    this.#socket = new WebSocket(url);

    this.#socket.onopen = () => {
      console.info('spacedust connected.');
      if (this.#eol) return this.close();
      this.#status = 'connected';
      // in case the subjects were changed while connecting
      if (this.#subjectsDirty) {
        this.setSubjects(this.#subjects);
      }
    };

    this.#socket.onmessage = message => {
      if (this.#eol) return this.close();
      this.#handleMessage(message);
    };

    this.#socket.onerror = err => {
      console.warn('spacedust socket errored. reconnecting...', err);
      this.#status = 'disconnected';
      this.#connect(true);
    };

    this.#socket.onclose = () => {
      if (this.#eol) {
        console.info('spacedust socket closed and we\'re EOL, not restarting');
        return;
      }
      console.info('spacedust socket closed. restarting...');
      this.#status = 'disconnected';
      this.#connect(true);
    };
  }

  #handleMessage(m: MessageEvent) {
    if (this.#eol) return;
    const data = JSON.parse(m.data);
    if (data.kind !== "link" || data.link.operation !== "create") {
      console.info('ignoring non-link-create event', data);
      return;
    }
    const { link: { subject, source } } = data;
    this.#callback({ subject, source });
  }

  setSubjects(newSubjects: string[]) {
    this.#subjects = newSubjects;

    if (this.#subjects.length === 0) {
      // no subjects specified: just disconnect (would get firehose from spacedust)
      this.#socket?.close();
      // closing should trigger the .onclose handler to take it from here
      return;
    }

    if (this.#status === 'disconnected') {
      console.info('spacedust currently disconnected; connecting for updated subjects');
      this.#subjectsDirty = true;
      this.#connect();
      return;
    } else if (this.#status === 'connecting') {
      console.info('spacedust currently connecting; just flagging subjects as dirty');
      this.#subjectsDirty = true; // on connect it should automatically update
      return;
    }

    if (!this.#socket) {
      throw new Error(`spacedust status is "${this.#status}" but the socket is null -- a bug?`);
    }

    this.#socket.send(JSON.stringify({
      type: 'options_update',
      payload: {
        wantedSources: this.#sources,
        wantedSubjects: this.#subjects,
      },
    }));

    this.#subjectsDirty = false;
  }

  close() {
    this.#eol = true;
    this.#socket?.close();
  }

}