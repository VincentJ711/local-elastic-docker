import { freemem } from 'os';
import * as path from 'path';
import { Utils } from '../utils';

export interface IBaseContainer {
  cluster_name?: string;
  data?: boolean;
  env?: string[];
  hsize: number;
  image: string;
  ingest?: boolean;
  khsize?: number;
  kibana?: boolean;
  kibana_port?: number;
  master?: boolean;
  name: string;
  node_name?: string;
  port: number;
  volume_dir?: string;
}

export class BaseContainer implements IBaseContainer {
  cluster_name?: string;
  data: boolean;
  env: string[];
  hsize: number;
  image: string;
  ingest: boolean;
  khsize: number;
  kibana: boolean;
  kibana_port?: number;
  master: boolean;
  name: string;
  node_name?: string;
  port: number;
  volume_dir?: string;

  constructor(v: IBaseContainer) {
    this._set_cluster_name(v);
    this._set_data(v);
    this._set_env(v);
    this._set_hsize(v);
    this._set_image(v);
    this._set_ingest(v);
    this._set_khsize(v);
    this._set_kibana(v);
    this._set_kibana_port(v);
    this._set_master(v);
    this._set_name(v);
    this._set_node_name(v);
    this._set_port(v);
    this._set_volume_dir(v);

    if (this.kibana_port === this.port) {
      throw Error('kibana port cant be the same as the elastic port.');
    } else if (this.kibana && !this.kibana_port) {
      throw Error('since you specified this is a kibana container, you must provide ' +
          'a port for kibana.');
    }
  }

  private _set_cluster_name(v: IBaseContainer) {
    if (Utils.is_string(v.cluster_name) && v.cluster_name && !/ /.test(v.cluster_name)) {
      this.cluster_name = v.cluster_name;
    } else if (Utils.is_defined(v.cluster_name)) {
      throw Error('not a valid string');
    }
  }

  private _set_data(v: IBaseContainer) {
    if (Utils.is_bool(v.data)) {
      this.data = <boolean> v.data;
    } else if (Utils.is_defined(v.data)) {
      throw Error('not a boolean');
    } else {
      this.data = true;
    }
  }

  private _set_env(v: IBaseContainer) {
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

  private _set_hsize(v: IBaseContainer) {
    if (!Utils.is_integer(v.hsize)) {
      throw Error('es heap size not an integer');
    } else if ((v.hsize < 100) || (v.hsize > 31000)) {
      throw Error('es heap size out of range.');
    } else if ((v.hsize * 1000000) >= freemem()) {
      throw Error('requested es heap size is too large for this system.');
    }
    this.hsize = v.hsize;
  }

  private _set_image(v: IBaseContainer) {
    if (!Utils.is_string(v.image) || !v.image || / /.test(v.image)) {
      throw Error(`${v.image} is an invalid image name`);
    }
    this.image = v.image;
  }

  private _set_ingest(v: IBaseContainer) {
    if (Utils.is_bool(v.ingest)) {
      this.ingest = <boolean> v.ingest;
    } else if (Utils.is_defined(v.ingest)) {
      throw Error('not a boolean');
    } else {
      this.ingest = false;
    }
  }

  private _set_khsize(v: IBaseContainer) {
    const val: any = v.khsize;
    if (Utils.is_defined(val)) {
      if (!Utils.is_integer(val)) {
        throw Error('kibana heap size not an integer');
      } else if (val < 100) {
        throw Error('kibana heap size out of range.');
      } else if ((val * 1000000) >= freemem()) {
        throw Error('requested kibana heap size is too large for this system.');
      }
    }
    this.khsize = val ? val : 512;
  }

  private _set_kibana(v: IBaseContainer) {
    if (Utils.is_bool(v.kibana)) {
      this.kibana = <boolean> v.kibana;
    } else if (Utils.is_defined(v.kibana)) {
      throw Error('not a boolean');
    } else {
      this.kibana = false;
    }
  }

  private _set_kibana_port(v: IBaseContainer) {
    if (Utils.is_defined(v.kibana_port) && (!Utils.is_integer(v.kibana_port) ||
        (<number> v.kibana_port < 1) || (<number> v.kibana_port > 65535))) {
      throw Error(`${v.kibana_port} is an invalid kibana port`);
    } else if (v.kibana_port) {
      this.kibana_port = v.kibana_port;
    }
  }

  private _set_master(v: IBaseContainer) {
    if (Utils.is_bool(v.master)) {
      this.master = <boolean> v.master;
    } else if (Utils.is_defined(v.master)) {
      throw Error('not a boolean');
    } else {
      this.master = true;
    }
  }

  private _set_name(v: IBaseContainer) {
    if (!Utils.is_string(v.name) || !v.name || / /.test(v.name)) {
      throw Error('not a valid string');
    }
    this.name = v.name;
  }

  private _set_node_name(v: IBaseContainer) {
    if (Utils.is_string(v.node_name) && v.node_name && !/ /.test(v.node_name)) {
      this.node_name = v.node_name;
    } else if (Utils.is_defined(v.node_name)) {
      throw Error('not a valid string');
    }
  }

  private _set_port(v: IBaseContainer) {
    if (!Utils.is_integer(v.port)) {
      throw Error('not an integer');
    } else if ((v.port < 1) || (v.port > 65535)) {
      throw Error('port out of range.');
    }
    this.port = v.port;
  }

  private _set_volume_dir(v: IBaseContainer) {
    if (Utils.is_string(v.volume_dir) && v.volume_dir && !/ /.test(v.volume_dir)) {
      this.volume_dir = path.resolve(process.cwd(), v.volume_dir);
    } else if (Utils.is_defined(v.volume_dir)) {
      throw Error('not a valid string');
    }
  }
}
