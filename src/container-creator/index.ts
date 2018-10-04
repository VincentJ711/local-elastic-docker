import { emptyDir, ensureDir } from 'fs-extra';
import { Container } from '../container';
import { elastic_image_label, kibana_image_label } from '../image';
import { EndTask, FullTask, IContainerCreateTasks } from '../tasks';
import { Utils } from '../utils';

export class ContainerCreator {
  private _c: Container;

  constructor(v: Container) {
    this._c = v;
  }

  create() {
    const tasks: IContainerCreateTasks = {
      container_mk: new FullTask(),
      container_rm: new FullTask(),
      container_start: new FullTask(),
      elastic_ready: new FullTask(),
      image_check: new FullTask(),
      kibana_ready: new FullTask(),
      main: new EndTask(),
      scripts_upload: new FullTask(),
      sm_upload: new FullTask(),
      volume_rm: new FullTask()
    };

    process.nextTick(async() => {
      try {
        await this._check_image(tasks.image_check);
        await this._clear_volume_dir(tasks.volume_rm);
        await this._remove_container_with_my_name(tasks.container_rm);
        await this._create_container(tasks.container_mk);
        await this._start(tasks.container_start);
        await this._wait_for_elastic(tasks.elastic_ready);
        await this._wait_for_kibana(tasks.kibana_ready);
        await this._upload_scripts(tasks.scripts_upload);
        await this._upload_sm(tasks.sm_upload);

        if (this._c.verbose) {
          const kmsg = this._c.has_kibana_image ?
              `and kibana @ localhost:${this._c.kibana_port}` : '';

          console.log(`Setup complete for container ${this._c.name}! ` +
            `Visit elastic @ localhost:${this._c.port} ${kmsg}`);
        }

        tasks.main.end_resolve_cb(this);
      } catch (e) {
        tasks.main.end_reject_cb(e);
      }
    });

    return tasks;
  }

  private async _check_image(task: FullTask) {
    task.start_resolve_cb();

    let labels;

    try {
      labels = await this._get_image_labels();
    } catch (err) {
      this._stop_at_task(task, err);
    }

    if (this._c.verbose) {
      console.log(`verifying image ${this._c.image} was created by this package.`);
    }

    if (labels.indexOf(elastic_image_label) < 0) {
      const err = new Error(`${this._c.image} exists but its not an ` +
          'image this package created.');
      this._stop_at_task(task, err);
    } else if (!this._c.kibana_port && (labels.indexOf(kibana_image_label) > -1)) {
      const err = new Error(`'${this._c.image}' is a kibana image but ` +
          'you didn\'t provide a kibana port.');
      this._stop_at_task(task, err);
    } else if (labels.indexOf(kibana_image_label) > -1) {
      this._c.has_kibana_image = true;
    }

    task.end_resolve_cb();
  }

  private async _clear_volume_dir(task: FullTask) {
    task.start_resolve_cb();

    try {
      if (this._c.volume_dir && this._c.clear_volume_dir) {
        if (this._c.verbose) {
          console.log(`emptying volume ${this._c.volume_dir}`);
        }
        await emptyDir(this._c.volume_dir);
      } else if (this._c.volume_dir) {
        if (this._c.verbose) {
          console.log(`making sure volume ${this._c.volume_dir} exists`);
        }
        await ensureDir(this._c.volume_dir);
      }
    } catch (err) {
      this._stop_at_task(task, err);
    }

    task.end_resolve_cb();
  }

  private async _create_container(task: FullTask) {
    task.start_resolve_cb();

    const vl = this._c.volume_dir ? `-v ${this._c.volume_dir}:/usr/share/elasticsearch/data` : '';
    const kpl = this._c.has_kibana_image ? `-p ${this._c.kibana_port}:5601` : '';
    const el = `-e ${this._merge_env_vars().join(' -e ')}`;

    const cmd = `docker create --name ${this._c.name} ${vl} -p ${this._c.port}:9200 ` +
        `${kpl} ${el} ${this._c.image}`;

    try {
      if (this._c.verbose) {
        console.log(`creating docker container ${this._c.name}`);
      }
      await Utils.exec(cmd);
    } catch (err) {
      this._stop_at_task(task, err);
    }

    task.end_resolve_cb();
  }

  private async _get_image_labels() {
    const cmd = `docker inspect --format "{{ .Config.Labels }}" ${this._c.image}`;

    if (this._c.verbose) {
      console.log(`fetching labels for image ${this._c.image}`);
    }

    try {
      const resp = <string> await Utils.exec(cmd);
      const tmp = resp.slice(4, resp.length - 2);
      return tmp.split(' ').map(el => el.split(':')[0]);
    } catch (e) {
      throw Error(`couldnt fetch image labels for ${this._c.image}`);
    }
  }

  private _merge_env_vars() {
    const uniq = {
      ES_JAVA_OPTS: `-Xms${this._c.hsize}m -Xmx${this._c.hsize}m`,
      'node.data': `${!!this._c.data}`,
      'node.ingest': `${!!this._c.ingest}`,
      'node.master': `${!!this._c.master}`
    };

    if (this._c.cluster_name) {
      uniq['cluster.name'] = this._c.cluster_name;
    }

    if (this._c.node_name) {
      uniq['node.name'] = this._c.node_name;
    }

    this._c.env.forEach(e => {
      const tokens = e.split('=');
      uniq[tokens[0]] = tokens.slice(1).join('=');
    });

    return Object.keys(uniq).map(k => `'${k}=${uniq[k]}'`);
  }

  private async _remove_container_with_my_name(task: FullTask) {
    task.start_resolve_cb();

    if (this._c.verbose) {
      console.log(`removing docker container ${this._c.name} if it exists`);
    }

    try {
      const cmd = `docker rm -f ${this._c.name}`;
      await Utils.exec(cmd, !!this._c.verbose);
    } catch (err) {
      if (!err || err.toString().indexOf('No such container') < 0) {
        this._stop_at_task(task, err);
      }
    }

    task.end_resolve_cb();
  }

  private async _start(task: FullTask) {
    task.start_resolve_cb();
    const cmd = `docker start ${this._c.name}`;

    try {
      if (this._c.verbose) {
        console.log(`starting docker container ${this._c.name}`);
      }
      await Utils.exec(cmd);
    } catch (err) {
      this._stop_at_task(task, err);
    }

    task.end_resolve_cb();
  }

  private _stop_at_task(task: FullTask, err) {
    task.end_reject_cb(err);
    throw err;
  }

  private async _upload_scripts(task: FullTask) {
    let res;
    task.start_resolve_cb();

    const promises: any[] = [];

    for (const script_name in this._c.scripts) {
      const script = this._c.scripts[script_name];
      const url = `localhost:${this._c.port}/_scripts/${script_name}`;
      const cmd = `curl -s -XPOST "${url}" -H 'Content-Type: application/json' ` +
          `-d '${JSON.stringify({ script: script })}'`;

      if (this._c.verbose) {
        console.log(`uploading script ${script_name} to ${url}`);
      }

      const p = Utils.exec(cmd, this._c.verbose).then(ans => {
        const obj = JSON.parse(<string> ans);
        if (obj.error) {
          throw obj;
        }
        return obj;
      });
      promises.push(p);
    }

    try {
      res = await Promise.all(promises);
    } catch (err) {
      this._stop_at_task(task, err);
    }

    task.end_resolve_cb(res);
  }

  private async _upload_sm(task: FullTask) {
    let res;
    task.start_resolve_cb();

    const promises: any = [];

    for (const index in this._c.sm) {
      const url = `localhost:${this._c.port}/${index}`;
      const str = JSON.stringify(this._c.sm[index]);
      const cmd = `curl -s -XPUT "${url}" -H 'Content-Type: application/json' -d '${str}'`;

      if (this._c.verbose) {
        console.log(`uploading settings/mappings for index ${index} to ${url}`);
      }

      const p = Utils.exec(cmd, this._c.verbose).then(ans => {
        const obj = JSON.parse(<string> ans);
        if (obj.error) {
          throw obj;
        }
        return obj;
      });
      promises.push(p);
    }

    try {
      res = await Promise.all(promises);
    } catch (err) {
      this._stop_at_task(task, err);
    }

    task.end_resolve_cb(res);
  }

  private async _wait_for_elastic(task: FullTask) {
    task.start_resolve_cb();
    const url = `localhost:${this._c.port}/_cluster/health`;
    const cmd = `curl -s ${url}`;

    if (this._c.verbose) {
      console.log(`waiting for state >= yellow from elastic @ ${url}`);
    }

    await new Promise(resolve => {
      const again = time => {
        setTimeout(() => wait_for_elastic_helper(cmd, again, resolve), time);
      };
      again(0);
    });
    task.end_resolve_cb();
  }

  private async _wait_for_kibana(task: FullTask) {
    task.start_resolve_cb();

    if (this._c.has_kibana_image) {
      const url = `localhost:${this._c.kibana_port}`;
      const cmd = `curl -s -o /dev/null -w "%{http_code}" ${url}`;

      if (this._c.verbose) {
        console.log(`waiting for status 200 from kibana @ ${url}`);
      }

      await new Promise(resolve => {
        const again = time => {
          setTimeout(() => wait_for_kibana_helper(cmd, again, resolve), time);
        };
        again(0);
      });
    }
    task.end_resolve_cb();
  }
}

const wait_for_elastic_helper = async(cmd, again, resolve) => {
  try {
    const res = await Utils.exec(cmd);
    const d = JSON.parse(<string> res);
    (d.status !== 'yellow') && (d.status !== 'green') ? again(2000) : resolve();
  } catch (err) {
    again(2000);
  }
};

const wait_for_kibana_helper = async(cmd, again, resolve) => {
  try {
    const res = await Utils.exec(cmd);
    res !== '200' ? again(2000) : resolve();
  } catch (err) {
    again(2000);
  }
};
