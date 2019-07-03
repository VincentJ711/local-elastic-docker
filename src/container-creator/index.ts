import { emptyDir, ensureDir } from 'fs-extra';
import { ChildContainer } from '../child-container';
import { Container } from '../container';
import { ContainerCreateOpts } from '../container-create-opts';
import { elastic_uploader } from '../elastic-uploader';
import { elastic_image_label, kibana_image_label } from '../image';
import { EndTask, FullTask, IContainerCreateTasks } from '../tasks';
import { Utils } from '../utils';

export class ContainerCreator {
  private c: ChildContainer;
  private o: ContainerCreateOpts;

  constructor(container: ChildContainer, opts: ContainerCreateOpts) {
    this.c = container;
    this.o = opts;
  }

  create() {
    const tasks: IContainerCreateTasks = {
      container_mk: new FullTask(),
      container_rm: new FullTask(),
      container_start: new FullTask(),
      elastic_ready: new FullTask(),
      image_check: new FullTask(),
      kibana_ready: new FullTask(),
      kso_upload: new FullTask(),
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
        const container = await this._create_container(tasks.container_mk);
        await this._start(tasks.container_start);
        await this._wait_for_elastic(tasks.elastic_ready, container);
        await this._wait_for_kibana(tasks.kibana_ready, container);
        await this._upload_kso(tasks.kso_upload, container);
        await this._upload_scripts(tasks.scripts_upload, container);
        await this._upload_sm(tasks.sm_upload, container);

        if (this.o.verbose) {
          const kmsg = this.c.kibana ? `and kibana @ localhost:${this.c.kibana_port}` : '';

          console.log(`Setup complete for container ${this.c.name}! ` +
              `Visit elastic @ localhost:${this.c.port} ${kmsg}`);
        }

        tasks.main.end_resolve_cb(container);
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

    if (this.o.verbose) {
      console.log(`verifying image ${this.c.image} was created by this package.`);
    }

    if (labels.indexOf(elastic_image_label) < 0) {
      const err = new Error(`${this.c.image} exists but its not an ` +
          'image this package created.');
      this._stop_at_task(task, err);
    } else if (!this.c.kibana && (labels.indexOf(kibana_image_label) > -1)) {
      const err = new Error(`container ${this.c.name} has a kibana image, ` +
          'yet you didnt set its kibana property to true.');
      this._stop_at_task(task, err);
    }

    task.end_resolve_cb();
  }

  private async _clear_volume_dir(task: FullTask) {
    task.start_resolve_cb();

    try {
      if (this.c.volume_dir && this.o.clear_volume_dir) {
        if (this.o.verbose) {
          console.log(`emptying volume ${this.c.volume_dir}`);
        }
        await emptyDir(this.c.volume_dir);
      } else if (this.c.volume_dir) {
        if (this.o.verbose) {
          console.log(`making sure volume ${this.c.volume_dir} exists`);
        }
        await ensureDir(this.c.volume_dir);
      }
    } catch (err) {
      this._stop_at_task(task, err);
    }

    task.end_resolve_cb();
  }

  private async _create_container(task: FullTask) {
    task.start_resolve_cb();

    const container = new Container(this.c);
    const b64 = Buffer.from(JSON.stringify(container)).toString('base64');
    const kport_line = this.c.kibana ? `-p ${this.c.kibana_port}:5601` : '';
    const env_line = `-e ${this._merge_env_vars().join(' -e ')}`;
    const volume_line = this.c.volume_dir ?
        `-v ${this.c.volume_dir}:/usr/share/elasticsearch/data` : '';

    // override the es image label w/ the container which is b64 encoded.
    const cmd = `docker create --name ${this.c.name} --label ${elastic_image_label}=${b64} ` +
        `${volume_line} -p ${this.c.port}:9200 ${kport_line} ${env_line} ${this.c.image}`;

    try {
      if (this.o.verbose) {
        console.log(`creating docker container ${this.c.name}`);
      }
      await Utils.exec(cmd);
    } catch (err) {
      this._stop_at_task(task, err);
    }

    task.end_resolve_cb(container);
    return container;
  }

  private async _get_image_labels() {
    const cmd = `docker inspect --format "{{ .Config.Labels }}" ${this.c.image}`;

    if (this.o.verbose) {
      console.log(`fetching labels for image ${this.c.image}`);
    }

    try {
      const resp = <string> await Utils.exec(cmd);
      const tmp = resp.slice(4, resp.length - 2);
      return tmp.split(' ').map(el => el.split(':')[0]);
    } catch (e) {
      throw Error(`couldnt fetch image labels for ${this.c.image}`);
    }
  }

  private _merge_env_vars() {
    const uniq = {
      ES_JAVA_OPTS: `-Xms${this.c.hsize}m -Xmx${this.c.hsize}m`,
      NODE_OPTIONS: `--max-old-space-size=${this.c.khsize}`,
      'node.data': 'true',
      'node.ingest': 'true',
      'node.master': 'true'
    };

    if (this.c.cluster_name) {
      uniq['cluster.name'] = this.c.cluster_name;
    }

    if (this.c.node_name) {
      uniq['node.name'] = this.c.node_name;
    }

    this.c.env.forEach(e => {
      const tokens = e.split('=');
      uniq[tokens[0]] = tokens.slice(1).join('=');
    });

    return Object.keys(uniq).map(k => `'${k}=${uniq[k]}'`);
  }

  private async _remove_container_with_my_name(task: FullTask) {
    task.start_resolve_cb();

    if (this.o.verbose) {
      console.log(`removing docker container ${this.c.name} if it exists`);
    }

    try {
      const cmd = `docker rm -f ${this.c.name}`;
      await Utils.exec(cmd, this.o.verbose);
    } catch (err) {
      if (!err || err.toString().indexOf('No such container') < 0) {
        this._stop_at_task(task, err);
      }
    }

    task.end_resolve_cb();
  }

  private async _start(task: FullTask) {
    task.start_resolve_cb();
    const cmd = `docker start ${this.c.name}`;

    try {
      if (this.o.verbose) {
        console.log(`starting docker container ${this.c.name}`);
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

  private async _upload_kso(task: FullTask, container: Container) {
    await task.start_resolve_cb();

    let res;

    if (this.c.kibana) {
      try {
        res = await elastic_uploader.kso(container, this.o.kso, this.o.verbose);
      } catch (e) {
        this._stop_at_task(task, e);
      }
    }

    task.end_resolve_cb(res);
  }

  private async _upload_scripts(task: FullTask, container: Container) {
    await task.start_resolve_cb();

    try {
      const res = await elastic_uploader.scripts(container, this.o.scripts, this.o.verbose);
      task.end_resolve_cb(res);
    } catch (e) {
      this._stop_at_task(task, e);
    }
  }

  private async _upload_sm(task: FullTask, container: Container) {
    await task.start_resolve_cb();

    try {
      const res = await elastic_uploader.sm(container, this.o.sm, this.o.verbose);
      task.end_resolve_cb(res);
    } catch (e) {
      this._stop_at_task(task, e);
    }
  }

  private async _wait_for_elastic(task: FullTask, container: Container) {
    await task.start_resolve_cb();
    await container.wait_for_elastic(this.o.verbose);
    task.end_resolve_cb();
  }

  private async _wait_for_kibana(task: FullTask, container: Container) {
    await task.start_resolve_cb();
    if (this.c.kibana) {
      await container.wait_for_kibana(this.o.verbose);
    }
    task.end_resolve_cb();
  }
}
