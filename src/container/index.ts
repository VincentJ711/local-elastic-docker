import { BaseContainer, IBaseContainer } from '../base-container';
import { elastic_image_label } from '../image';
import { Utils } from '../utils';

export interface IContainer extends IBaseContainer { }

export class Container extends BaseContainer implements IContainer {
  static async fetch_all(verbose?: boolean) {
    const names_cmd = `docker ps -a --filter "label=${elastic_image_label}" ` +
        '--format " {{ .Names }}"';
    const containers: Container[] = [];

    if (verbose) {
      console.log(`fetching all containers this package has created via\n${names_cmd}`);
    }

    let names = <string> await Utils.exec(names_cmd);
    names = names.split('\n').join(' ');

    if (names.length) {
      const inspect_cmd = `docker inspect ${names}`;
      const configs = JSON.parse(<string> await Utils.exec(inspect_cmd));
      configs.forEach(config => {
        const labels = config.Config.Labels;
        const b64 = labels[elastic_image_label];
        const decoded: IContainer = JSON.parse(Buffer.from(b64, 'base64').toString());
        containers.push(new Container(decoded));
      });
    }

    return containers;
  }

  constructor(v: IContainer) {
    super(v);
  }

  // resolves w/ the standard elasticsearch json response for GET _cluster/health | undefined
  async cluster_health(verbose?: boolean) {
    if (verbose) {
      console.log(`fetching cluster health for ${this.name}`);
    }

    try {
      const cmd = 'curl -s localhost:9200/_cluster/health';
      const res = await this.exec(cmd);
      return JSON.parse(<string> res);
    } catch (e) { }
  }

  // resolves w/ green | yellow | red | undefined
  async cluster_state(verbose?: boolean) {
    if (verbose) {
      console.log(`fetching cluster state for ${this.name}`);
    }

    try {
      return (await this.cluster_health()).status;
    } catch (e) { }
  }

  async delete(verbose?: boolean) {
    const cmd = `docker rm -f ${this.name}`;

    if (verbose) {
      console.log(`deleting container ${this.name} via ${cmd}`);
    }

    await Utils.exec(cmd, verbose);
  }

  // executes the given command in the container and returns its stdout.
  // note that the cmd is base64 encoded so we dont have to worry about special
  // characters like $ or quotes.
  async exec(cmd: string, verbose?: boolean) {
    if (!Utils.is_string(cmd) || !cmd) {
      throw Error('command missing!');
    }

    const b64 = Buffer.from(cmd).toString('base64');
    const wrapped_cmd = `docker exec -i ${this.name}` +
        ` bash -c 'eval $(echo ${b64} | base64 --decode)'`;

    if (verbose) {
      console.log(`executing the following command\n${wrapped_cmd}`);
    }

    return await Utils.exec(wrapped_cmd, verbose);
  }

  async kibana_saved_objects(verbose?: boolean) {
    if (!this.kibana) {
      throw Error(`${this.name} isnt a kibana node!`);
    }

    const cmd = 'curl localhost:5601/api/saved_objects/_find?per_page=10000';

    if (verbose) {
      console.log(`fetching kibana saved objects for ${this.name}`);
    }

    const resp = <string> await this.exec(cmd);
    return JSON.parse(resp).saved_objects;
  }

  // resolves w/ number | undefined
  async kibana_status(verbose?: boolean) {
    if (!this.kibana) {
      return;
    } else if (verbose) {
      console.log(`fetching kibana status for ${this.name}`);
    }

    try {
      const cmd = 'curl -s -o /dev/null -w "%{http_code}" localhost:5601';
      const res = await this.exec(cmd);
      return res ? Number(res) : undefined;
    } catch (e) { }
  }

  async restart(verbose?: boolean) {
    await this.stop(verbose);
    await this.start(verbose);
  }

  async start(verbose?: boolean) {
    const cmd = `docker start ${this.name}`;

    if (verbose) {
      console.log(`starting container ${this.name} via ${cmd}`);
    }

    await Utils.exec(cmd, verbose);
  }

  async stop(verbose?: boolean) {
    const cmd = `docker stop ${this.name}`;

    if (verbose) {
      console.log(`stopping container ${this.name} via ${cmd}`);
    }

    await Utils.exec(cmd, verbose);
  }

  async wait_for_elastic(verbose?: boolean) {
    if (verbose) {
      console.log(`waiting for state >= yellow from elastic for ${this.name}`);
    }

    await new Promise(resolve => {
      const interval = 2000;

      const again = () => {
        setTimeout(async() => {
          const state = await this.cluster_state(verbose);
          /yellow|green/.test(state) ? resolve() : again();
        }, interval);
      };

      again();
    });
  }

  async wait_for_kibana(verbose?: boolean) {
    if (!this.kibana) {
      throw Error(`${this.name} isnt a kibana container! You\'ll never get a 200 response.`);
    } else if (verbose) {
      console.log(`waiting for status 200 from kibana for ${this.name}`);
    }

    await new Promise(resolve => {
      const interval = 2000;

      const again = () => {
        setTimeout(async() => {
          const status = await this.kibana_status(verbose);
          status === 200 ? resolve() : again();
        }, interval);
      };

      again();
    });
  }
}
