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

  constructor(v: IImage) {
    this._set_es_version(v);
    this._set_kibana(v);
    this._set_name(v);
    this._set_verbose(v);
    this._create_dockerfile();
  }

  async create() {
    const cmd = `docker build -t ${this.name} . -f-<<EOF\n${this._dockerfile}\nEOF`;

    if (this.verbose) {
      console.log(`creating image ${this.name} from the following dockerfile:\n`);
      console.log(this._dockerfile + '\n');
    }

    await Utils.exec(cmd, this.verbose);

    if (this.verbose) {
      console.log(`\nimage ${this.name} created!`);
    }
  }

  private _create_dockerfile() {
    const base_url = 'https://artifacts.elastic.co/downloads/kibana/kibana';
    const klines = this.kibana ?
        `RUN wget -q ${base_url}-${this.es_version}-x86_64.rpm\n` +
        `RUN rpm --install kibana-${this.es_version}-x86_64.rpm\n` +
        `LABEL ${kibana_image_label}="whatever"\n` : '';
    const kcmd = this.kibana ? ' & kibana/bin/kibana --server.host=0.0.0.0' : '';

    this._dockerfile =
        `FROM docker.elastic.co/elasticsearch/elasticsearch:${this.es_version}\n` +
        klines +
        `LABEL ${elastic_image_label}="whatever"\n` +
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
