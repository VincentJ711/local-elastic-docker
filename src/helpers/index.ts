import { elastic_image_label } from '../image';
import { Utils } from '../utils';

export const helpers = {
  ls_containers: async(fmt?: string) => {
    fmt = fmt ? `"${fmt}"` : '"table {{.Names}}\t{{.Status}}\t{{.CreatedAt}}\t{{.Image}}"';
    const cmd = `docker ps -a --filter label=${elastic_image_label} -q --format ${fmt}`;
    const res = <string> await Utils.exec(cmd);

    let cnt = 0;

    for (const c of res) {
      if (c === '\n') {
        cnt++;
      }
    }

    if (cnt !== 1) {
      process.stdout.write(res);
    }
  },
  ls_images: async(fmt?: string) => {
    fmt = fmt ? `"${fmt}"` : '"table {{.Repository}}\t{{ .CreatedSince }}\t{{.ID}}\t{{ .Size}}"';
    const cmd = `docker images --filter label=${elastic_image_label} -q --format ${fmt}`;
    const res = <string> await Utils.exec(cmd);

    let cnt = 0;

    for (const c of res) {
      if (c === '\n') {
        cnt++;
      }
    }

    if (cnt !== 1) {
      process.stdout.write(res);
    }
  },
  remove_containers: async(verbose?: boolean) => {
    const cmd = `docker rm -f $(docker ps -a --filter "label=${elastic_image_label}" ` +
        '--format "{{ .Names }}")';
    await helper(cmd, verbose, `removing containers w/ image label ${elastic_image_label}\n`);
  },
  remove_dangling_images: async(verbose?: boolean) => {
    const cmd = 'docker rmi -f $(docker images --quiet --filter "dangling=true")';
    await helper(cmd, verbose, 'removing dangling images');
  },
  remove_images: async(verbose?: boolean) => {
    const cmd = `docker rmi -f $(docker images --filter label=${elastic_image_label} -q)`;
    await helper(cmd, verbose, `removing images w/ label ${elastic_image_label}`);
  },
  start_containers: async(verbose?: boolean) => {
    const cmd = `docker start $(docker ps -a --filter label=${elastic_image_label} -q)`;
    await helper(cmd, verbose, `starting containers w/ image label ${elastic_image_label}`);
  },
  stop_containers: async(verbose?: boolean) => {
    const cmd = `docker stop $(docker ps -a --filter label=${elastic_image_label} -q)`;
    await helper(cmd, verbose, `stopping containers w/ image label ${elastic_image_label}`);
  }
};

const helper = async(cmd, verbose, msg) => {
  try {
    if (verbose) {
      console.log(msg);
    }
    await Utils.exec(cmd, verbose);
  } catch (err) {
    if (!err || err.toString().indexOf('requires at least 1') < 0) {
      throw err;
    }
  }
};
