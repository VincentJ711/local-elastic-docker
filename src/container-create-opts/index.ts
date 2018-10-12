import { Utils } from '../utils';

export interface IElasticScript {
  lang: string;
  source: string;
}

export interface IContainerCreateOpts {
  clear_volume_dir?: boolean;
  kso?: any[];
  scripts?: { [name: string]: IElasticScript };
  sm?: object;
  verbose?: boolean;
}

export class ContainerCreateOpts implements IContainerCreateOpts {
  clear_volume_dir: boolean;
  kso: any[];
  scripts: { [name: string]: IElasticScript };
  sm: object;
  verbose: boolean;

  constructor(v: IContainerCreateOpts) {
    const o = v || {};
    this._set_clear_volume_dir(o);
    this._set_kso(o);
    this._set_scripts(o);
    this._set_sm(o);
    this._set_verbose(o);
  }

  private _set_clear_volume_dir(v: IContainerCreateOpts) {
    this.clear_volume_dir = !!v.clear_volume_dir;
  }

  private _set_kso(v: IContainerCreateOpts) {
    if (Utils.is_array(v.kso)) {
      this.kso = <[]> v.kso;
    } else if (Utils.is_defined(v.kso)) {
      throw Error('kibana saved objects must be an array.');
    } else {
      this.kso = [];
    }
  }

  private _set_scripts(v: IContainerCreateOpts) {
    if (Utils.is_object(v.scripts)) {
      this.scripts = <{}> v.scripts;
    } else if (Utils.is_defined(v.scripts)) {
      throw Error('scripts must be an object.');
    } else {
      this.scripts = {};
    }
  }

  private _set_sm(v: IContainerCreateOpts) {
    if (Utils.is_object(v.sm)) {
      this.sm = <object> v.sm;
    } else if (Utils.is_defined(v.sm)) {
      throw Error('settings and mappings must be an object.');
    } else {
      this.sm = {};
    }
  }

  private _set_verbose(v: IContainerCreateOpts) {
    this.verbose = !!v.verbose;
  }
}
