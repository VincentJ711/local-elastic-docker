const led = require('local-elastic-docker');
const es_version = '7.2.0';

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
  const node_name = `${image_name}-1`;
  const child_container = new led.ChildContainer({
    es_version,
    hsize: 500,
    image: image_name,
    name: node_name,
    port: 5000,
    env: [
      'discovery.type=single-node'
    ]
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
  const node_name = `${image_name}-1`;
  const container = new led.ChildContainer({
    es_version,
    cluster_name: 'kibana_cluster',
    hsize: 500,
    image: image_name,
    kibana: true,
    kibana_port: 6001,
    name: node_name,
    port: 5001,
    env: [
      'xpack.monitoring.collection.enabled=true',
      'discovery.type=single-node'
    ]
    // + other options ...
  });

  const tasks = container.create({
    verbose: true,
    kso: [{
      attributes: {
        description: '',
        kibanaSavedObjectMeta: {
          searchSourceJSON: '{"query":{"query":"","language":"kuery"},"filter":[]}'
        },
        title: 'sumting',
        uiStateJSON: '{}',
        version: 1,
        visState: '{"title":"sumting","type":"timelion","params":{"expression":".es(*)","interval":"auto"},"aggs":[]}'
      },
      id: '99526ac0-9cc0-11e9-b6a0-2f4b9d6c6ed7',
      migrationVersion: {
        visualization: '7.2.0'
      },
      references: [],
      type: 'visualization',
      updated_at: '2019-07-02T11:57:43.147Z',
      version: 'WzEzLDFd'
    }],
    scripts: {
      calc_score: {
        lang: 'painless',
        source: 'Math.log(_score * 2) + params.my_modifier'
      }
    },
    sm: {
      users: {
        mappings: { properties: { name: { type: 'keyword' } } },
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
