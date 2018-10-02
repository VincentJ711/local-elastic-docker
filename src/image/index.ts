import { Utils } from '../utils';

const elastic_image_label = '_led_elastic_image';
const kibana_image_label = '_led_kibana_image';

export {
  elastic_image_label,
  kibana_image_label
};

export interface IImage {
  es_version: string;
  kibana?: boolean;
  name: string;
  verbose?: boolean;
}

export class Image implements IImage {
  es_version: string;
  kibana: boolean;
  name: string;
  verbose: boolean;
  private _dockerfile: string;
  private _kibana_entry?: string;

  constructor(v: IImage) {
    this._set_es_version(v);
    this._set_kibana(v);
    this._set_name(v);
    this._set_verbose(v);
    this._set_kibana_entry_file();
    this._create_dockerfile();
  }

  async create() {
    const cmd = `docker build -t ${this.name} . -f-<<EOF\n${this._dockerfile}\nEOF`;

    if (this.verbose) {
      console.log(`creating image ${this.name} from the following dockerfile:\n`);
      console.log(this._dockerfile + '\n');
    }

    // docker build requires u be in the directory u copy files from
    await Utils.exec(cmd, this.verbose, __dirname);

    if (this.verbose) {
      console.log(`\nimage ${this.name} created!`);
    }
  }

  private _create_dockerfile() {
    const base_url = 'https://artifacts.elastic.co/downloads/kibana/kibana';
    const klines = this.kibana ?
        `LABEL ${kibana_image_label}="whatever"\n` +
        'WORKDIR /usr/share/kibana\n' +
        `RUN curl -Ls ${base_url}-${this.es_version}-linux-x86_64.tar.gz | ` +
            'tar --strip-components=1 -zxf -\n' +
        `COPY ${this._kibana_entry} /usr/local/bin/kentry.sh\n` +
        'RUN chmod 777 /usr/local/bin/kentry.sh\n' : '';
    const kcmd = this.kibana ? ' & /usr/local/bin/kentry.sh --server.host=0.0.0.0' : '';

    this._dockerfile =
        `FROM docker.elastic.co/elasticsearch/elasticsearch:${this.es_version}\n` +
        `LABEL ${elastic_image_label}="whatever"\n` +
        klines +
        'WORKDIR /usr/share\n' +
        'CMD /usr/local/bin/docker-entrypoint.sh eswrapper' + kcmd;
  }

  private _set_es_version(v: IImage) {
    if (!/\d+.\d+.\d+/.test(v.es_version)) {
      throw Error(`${v} is an invalid version.`);
    }
    this.es_version = v.es_version;
  }

  private _set_kibana(v: IImage) {
    if (Utils.is_defined(v.kibana) && !Utils.is_bool(v.kibana)) {
      throw Error('not a boolean.');
    }
    this.kibana = !!v.kibana;
  }

  private _set_kibana_entry_file() {
    if (this.es_version[0] === '5') {
      this._kibana_entry = 'kentry-5_x';
    } else if (this.es_version[0] === '6') {
      this._kibana_entry = 'kentry-6_x';
    } else {
      throw Error(`kibana ${this.es_version} not supported! ` +
          'a startup script still has to be added for this major version.');
    }
  }

  private _set_name(v: IImage) {
    if (!Utils.is_string(v.name) || !v.name || / /.test(v.name)) {
      throw Error('invalid string');
    }
    this.name = v.name;
  }

  private _set_verbose(v: IImage) {
    if (Utils.is_defined(v.verbose) && !Utils.is_bool(v.verbose)) {
      throw Error('not a boolean.');
    }
    this.verbose = !!v.verbose;
  }
}
