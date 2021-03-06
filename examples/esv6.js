const led = require('local-elastic-docker');
const es_version = '6.4.0';

const create_elastic_image = async image_name => {
  await (new led.Image({
    es_version,
    name: image_name
  })).create(true);
};

const create_kibana_image = async image_name => {
  await (new led.Image({
    es_version,
    kibana: true,
    name: image_name
  })).create(true);
};

const create_elastic_container = async image_name => {
  const child_container = new led.ChildContainer({
    es_version,
    hsize: 500,
    image: image_name,
    name: `${image_name}-1`,
    port: 5000
  });

  const tasks = child_container.create({ verbose: true });

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

  const container = await tasks.main.on_end();
  console.log(5);
};

const create_kibana_container = async image_name => {
  const container = new led.ChildContainer({
    es_version,
    cluster_name: 'kibana_cluster',
    hsize: 500,
    image: image_name,
    kibana: true,
    kibana_port: 6001,
    name: `${image_name}-1`,
    port: 5001,
    env: [
      'xpack.monitoring.collection.enabled=true'
    ]
    // + other options ...
  });

  const tasks = container.create({
    verbose: true,
    kso: [{
      id: 'e84e14c0-cdeb-11e8-b958-0b2cbb7f0531',
      type: 'timelion-sheet',
      updated_at: '2018-10-12T06:56:13.323Z',
      version: 1,
      attributes: {
        title: 'sheet1',
        hits: 0,
        description: '',
        timelion_sheet: [
          '.es(*).title("I uploaded this.")'
        ],
        timelion_interval: 'auto',
        timelion_chart_height: 275,
        timelion_columns: 2,
        timelion_rows: 2,
        version: 1
      }
    }],
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
  });

  tasks.kibana_ready.on_start().then(() => {
    console.log(6);
  });

  tasks.kibana_ready.on_end().then(() => {
    console.log(7);
  });

  tasks.kso_upload.on_end().then(r => {
    console.log(8, r);
  });

  tasks.scripts_upload.on_end().then(r => {
    console.log(9, r);
  });

  tasks.sm_upload.on_end().then(r => {
    console.log(10, r);
  });

  // + other tasks ...

  await tasks.main.on_end();
  console.log(11);
};

const fetch_containers = async () => {
  const containers = await led.Container.fetch_all();
  console.log(12, containers);
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
  await fetch_containers();
};

combo();
