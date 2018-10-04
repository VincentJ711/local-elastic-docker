import { freemem } from 'os';
import * as path from 'path';
import { ContainerCreator } from '../container-creator';
import { Utils } from '../utils';

export interface IElasticScript {
  lang: string;
  source: string;
}

export interface IContainer {
  clear_volume_dir?: boolean;
  cluster_name?: string;
  data?: boolean;
  env?: string[];
  hsize: number;
  image: string;
  ingest?: boolean;
  kibana_port?: number;
  master?: boolean;
  name: string;
  node_name?: string;
  port: number;
  scripts?: { [name: string]: IElasticScript };
  sm?: object;
  verbose?: boolean;
  volume_dir?: string;
}

export class Container implements IContainer {
  clear_volume_dir: boolean;
  cluster_name?: string;
  data: boolean;
  env: string[];
  has_kibana_image?: boolean;
  hsize: number;
  image: string;
  ingest: boolean;
  kibana_port?: number;
  master: boolean;
  name: string;
  node_name?: string;
  port: number;
  scripts: { [name: string]: IElasticScript };
  sm: object;
  verbose: boolean;
  volume_dir?: string;

  constructor(v: IContainer) {
    this._set_clear_volume_dir(v);
    this._set_cluster_name(v);
    this._set_data(v);
    this._set_port(v);
    this._set_env(v);
    this._set_hsize(v);
    this._set_image(v);
    this._set_ingest(v);
    this._set_kibana_port(v);
    this._set_master(v);
    this._set_name(v);
    this._set_node_name(v);
    this._set_scripts(v);
    this._set_sm(v);
    this._set_verbose(v);
    this._set_volume_dir(v);

    if (this.kibana_port === this.port) {
      throw Error('kibana port cant be the same as the elastic port.');
    }
  }

  create() {
    return (new ContainerCreator(this)).create();
  }

  private _set_clear_volume_dir(v: IContainer) {
    if (Utils.is_bool(v.clear_volume_dir)) {
      this.clear_volume_dir = <boolean> v.clear_volume_dir;
    } else if (Utils.is_defined(v.clear_volume_dir)) {
      throw Error('not a boolean');
    } else {
      this.clear_volume_dir = false;
    }
  }

  private _set_cluster_name(v: IContainer) {
    if (Utils.is_string(v.cluster_name) && v.cluster_name && !/ /.test(v.cluster_name)) {
      this.cluster_name = v.cluster_name;
    } else if (Utils.is_defined(v.cluster_name)) {
      throw Error('not a valid string');
    }
  }

  private _set_data(v: IContainer) {
    if (Utils.is_bool(v.data)) {
      this.data = <boolean> v.data;
    } else if (Utils.is_defined(v.data)) {
      throw Error('not a boolean');
    } else {
      this.data = true;
    }
  }

  private _set_env(v: IContainer) {
    if (v.env) {
      v.env.forEach(s => {
        if (!Utils.is_string(s)) {
          throw Error('invalid environment string');
        } else if (s.indexOf('=') < 0) {
          throw Error(s + ' has an invalid env format!');
        }
      });
    }
    this.env = v.env ? v.env : [];
  }

  private _set_hsize(v: IContainer) {
    if (!Utils.is_integer(v.hsize)) {
      throw Error('not an integer');
    } else if ((v.hsize < 100) || (v.hsize > 31000)) {
      throw Error('heap size out of range.');
    } else if ((v.hsize * 1000000) >= freemem()) {
      throw Error('requested heap size is too large for this system.');
    }
    this.hsize = v.hsize;
  }

  private _set_image(v: IContainer) {
    if (!Utils.is_string(v.image) || !v.image || / /.test(v.image)) {
      throw Error(`${v.image} is an invalid image name`);
    }
    this.image = v.image;
  }

  private _set_ingest(v: IContainer) {
    if (Utils.is_bool(v.ingest)) {
      this.ingest = <boolean> v.ingest;
    } else if (Utils.is_defined(v.ingest)) {
      throw Error('not a boolean');
    } else {
      this.ingest = false;
    }
  }

  private _set_kibana_port(v: IContainer) {
    if (Utils.is_defined(v.kibana_port) && (!Utils.is_integer(v.kibana_port) ||
        (<number> v.kibana_port < 1) || (<number> v.kibana_port > 65535))) {
      throw Error(`${v.kibana_port} is an invalid kibana port`);
    }
    this.kibana_port = v.kibana_port;
  }

  private _set_master(v: IContainer) {
    if (Utils.is_bool(v.master)) {
      this.master = <boolean> v.master;
    } else if (Utils.is_defined(v.master)) {
      throw Error('not a boolean');
    } else {
      this.master = true;
    }
  }

  private _set_name(v: IContainer) {
    if (!Utils.is_string(v.name) || !v.name || / /.test(v.name)) {
      throw Error('not a valid string');
    }
    this.name = v.name;
  }

  private _set_node_name(v: IContainer) {
    if (Utils.is_string(v.node_name) && v.node_name && !/ /.test(v.node_name)) {
      this.node_name = v.node_name;
    } else if (Utils.is_defined(v.node_name)) {
      throw Error('not a valid string');
    }
  }

  private _set_port(v: IContainer) {
    if (!Utils.is_integer(v.port)) {
      throw Error('not an integer');
    } else if ((v.port < 1) || (v.port > 65535)) {
      throw Error('port out of range.');
    }
    this.port = v.port;
  }

  private _set_scripts(v: IContainer) {
    if (Utils.is_object(v.scripts)) {
      this.scripts = <{}> v.scripts;
    } else if (Utils.is_defined(v.scripts)) {
      throw Error('scripts must be an object.');
    } else {
      this.scripts = {};
    }
  }

  private _set_sm(v: IContainer) {
    if (Utils.is_object(v.sm)) {
      this.sm = <object> v.sm;
    } else if (Utils.is_defined(v.sm)) {
      throw Error('settings and mappings must be an object.');
    } else {
      this.sm = {};
    }
  }

  private _set_verbose(v: IContainer) {
    if (Utils.is_bool(v.verbose)) {
      this.verbose = <boolean> v.verbose;
    } else if (Utils.is_defined(v.verbose)) {
      throw Error('not a boolean');
    } else {
      this.verbose = false;
    }
  }

  private _set_volume_dir(v: IContainer) {
    if (Utils.is_string(v.volume_dir) && v.volume_dir && !/ /.test(v.volume_dir)) {
      this.volume_dir = path.resolve(process.cwd(), v.volume_dir);
    } else if (Utils.is_defined(v.volume_dir)) {
      throw Error('not a valid string');
    }
  }
}
