const led = require('local-elastic-docker');

const create_elastic_image = async image_name => {
  await (new led.Image({
    es_version: '6.3.2',
    name: image_name,
    verbose: true
  })).create();
};

const create_kibana_image = async image_name => {
  await (new led.Image({
    es_version: '6.3.2',
    kibana: true,
    name: image_name,
    verbose: true
  })).create();
};

const create_elastic_container = async image_name => {
  const container = new led.Container({
    hsize: 500,
    image: image_name,
    name: `${image_name}-1`,
    port: 5000,
    verbose: true
  });

  const tasks = container.create();

  tasks.container_mk.on_start().then(() => {
    console.log(1);
  });

  tasks.container_mk.on_end().then(() => {
    console.log(2);
  }).catch(err => {
    console.log(2.5, err);
  });

  tasks.elastic_ready.on_start().then(() => {
    console.log(3);
  });

  tasks.elastic_ready.on_end().then(() => {
    console.log(4);
  });

  // + other tasks ...

  await tasks.main.on_end();
  console.log(5);
};

const create_kibana_container = async image_name => {
  const container = new led.Container({
    cluster_name: 'kibana_cluster',
    hsize: 500,
    image: image_name,
    kibana_port: 6001,
    name: `${image_name}-1`,
    port: 5001,
    verbose: true,
    scripts: {
      calc_score: {
        lang: 'painless',
        source: 'Math.log(_score * 2) + params.my_modifier'
      }
    },
    sm: {
      users: {
        mappings: { _doc: { properties: { name: { type: 'keyword' } } } },
        settings: { number_of_shards: 1 }
      }
    }
    // + other options ...
  });

  const tasks = container.create();

  tasks.kibana_ready.on_start().then(() => {
    console.log(6);
  });

  tasks.kibana_ready.on_end().then(() => {
    console.log(7);
  });

  tasks.scripts_upload.on_end().then(r => {
    console.log(8, r);
  });

  tasks.sm_upload.on_end().then(r => {
    console.log(9, r);
  });

  // + other tasks ...

  await tasks.main.on_end();
  console.log(10);
};

const combo = async() => {
  const es_image_name = 'dev-es';
  const kib_image_name = 'dev-kibana';
  const verbose = true;

  await led.helpers.remove_containers(verbose);
  await create_elastic_image(es_image_name);
  await create_kibana_image(kib_image_name);
  await create_elastic_container(es_image_name);
  await create_kibana_container(kib_image_name);
};

combo();
