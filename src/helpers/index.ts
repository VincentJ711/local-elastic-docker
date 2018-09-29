import { elastic_image_label } from '../image';
import { Utils } from '../utils';

export const helpers = {
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
