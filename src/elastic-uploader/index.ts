import { Container } from '../container';
import { IElasticScript } from '../container-create-opts';
import { Utils } from '../utils';

const elastic_uploader = {
  kso: (container: Container, kso: any[], verbose?: boolean) => {
    // api doesnt allow the updated_at field to exist when creating a saved object.
    kso.forEach(el => delete el.updated_at);

    const b64 = Buffer.from(JSON.stringify(kso)).toString('base64');
    const port = container.kibana_port;
    const url = `localhost:${port}/api/saved_objects/_bulk_create?overwrite=true`;
    const cmd = `echo ${b64} | base64 --decode | ` +
        `curl -s -XPOST ${url} -H 'kbn-xsrf: true' -H 'Content-Type: application/json' -d @-`;

    if (verbose) {
      console.log(`uploading kibana saved objects to ${url}`);
    }

    return Utils.exec(cmd).then(ans => {
      const obj = JSON.parse(<string> ans);

      if (obj.error) {
        throw Error(JSON.stringify(obj));
      }

      const saved_objects = obj.saved_objects;

      saved_objects.forEach(el => {
        if (el.error) {
          throw Error(el);
        }
      });

      return saved_objects;
    });
  },
  scripts: (container: Container, scripts: { [name: string]: IElasticScript },
            verbose?: boolean) => {
    const promises: any = [];

    for (const script_name in scripts) {
      const script = scripts[script_name];
      const b64 = Buffer.from(JSON.stringify({ script: script })).toString('base64');
      const url = `localhost:${container.port}/_scripts/${script_name}`;
      const cmd = `echo ${b64} | base64 --decode | ` +
          `curl -s -XPOST ${url} -H 'Content-Type: application/json' -d @-`;

      if (verbose) {
        console.log(`uploading script ${script_name} to ${url}`);
      }

      const p = Utils.exec(cmd).then(ans => {
        const obj = JSON.parse(<string> ans);
        if (obj.error) {
          throw obj;
        }
        return obj;
      });

      promises.push(p);
    }

    return Promise.all(promises);
  },
  sm: (container: Container, sm: {}, verbose?: boolean) => {
    const promises: any = [];

    for (const index in sm) {
      const b64 = Buffer.from(JSON.stringify(sm[index])).toString('base64');
      const url = `localhost:${container.port}/${index}`;
      const cmd = `echo ${b64} | base64 --decode | ` +
          `curl -s -XPUT ${url} -H 'Content-Type: application/json' -d @-`;

      if (verbose) {
        console.log(`uploading settings/mappings for index ${index} to ${url}`);
      }

      const p = Utils.exec(cmd).then(ans => {
        const obj = JSON.parse(<string> ans);
        if (obj.error) {
          throw obj;
        }
        return obj;
      });

      promises.push(p);
    }

    return Promise.all(promises);
  }
};

export { elastic_uploader };
