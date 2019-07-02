# local-elastic-docker
This package helps you set up single-node [Elasticsearch](https://www.elastic.co/guide/en/elasticsearch/reference/current/index.html)/[Kibana](https://www.elastic.co/guide/en/kibana/current/index.html) clusters locally for development via [Docker](https://docs.docker.com/). If you're also looking for a similar way to setup Elasticsearch/Kibana on Google Compute Engine, look at [this repo](https://github.com/VincentJ711/gce-elastic-docker).

## Why?
I needed a flexible API to setup/teardown clusters locally and on GCE for production. The existing guides, while fantastic for getting started are limited in what they setup. For example, its incredibly easy to setup Elasticsearch by just pulling the Elasticsearch Docker image and starting a container from it, but theres so much more to setting up a cluster than just getting Elasticsearch running. Once your cluster is live, you'll need to upload your index settings/mappings and if you have Kibana you may want to upload some of your saved Charts/Dashboards. And what about if you want to create a CLI app that lets you handle several management tasks easily? This API allows you to do that. For example, you could create a file (w/ execute permission) @ `/usr/local/bin/esk`

```
#! /bin/bash
cmd="${@}"
node $HOME/desktop/app-esk/build/entry.js $cmd
```

where `entry.js` recieves the commands given to the `esk` command and utilizes this API to handle them, ie:

```
esk on  # starts cluster(s)
esk off # stops cluster(s)
esk mk  # creates cluster(s)
esk rm  # removes cluster(s)
esk ls  # lists cluster(s)
...
```

## Getting Started
There are two stages when using this module. The first is building Elasticsearch/Kibana Docker images and the second is creating Docker containers from these images. Once the containers are created, you can use Elasticsearch/Kibana however you please.

### Prerequisites
This package utilizes `curl` and `docker` heavily. If you do not install them, this package will not work.

### Installation
`npm install local-elastic-docker`

#### creating an Elasticsearch image
This image is only recommended if you do not want Kibana. You can view your images with `docker images`.

```
const led = require('local-elastic-docker');

const create_elastic_image = async image_name => {
  await (new led.Image({
    es_version: '7.2.0',
    name: image_name
  })).create();
};
```

#### creating a Kibana image
This is the preferred image as it has Elasticsearch and Kibana installed.
```
const create_kibana_image = async image_name => {
  await (new led.Image({
    es_version: '7.2.0',
    kibana: true,
    name: image_name
  })).create();
};
```

#### creating an Elasticsearch container
you can view your containers with `docker ps -a`

```
const create_elastic_container = async image_name => {
  const container = new led.ChildContainer({
    hsize: 500,
    image: image_name,
    name: `${image_name}-1`,
    port: 5000,
    env: [
      'discovery.type=single-node'
    ]
  });
  const tasks = container.create();
  await tasks.main.on_end();
};
```

#### creating a Kibana container

```
const create_kibana_container = async image_name => {
  const container = new led.ChildContainer({
    cluster_name: 'kibana_cluster',
    hsize: 500,
    image: image_name,
    name: `${image_name}-1`,
    port: 5001,
    kibana: true,
    kibana_port: 6001,
    env: [
      'discovery.type=single-node'
    ]
  });
  const tasks = container.create();
  await tasks.main.on_end();
};
```

#### tieing it all together

```
const combo = async() => {
  const es_image_name = 'dev-es';
  const kib_image_name = 'dev-kibana';

  await led.helpers.remove_containers();
  await led.helpers.remove_images();
  await create_elastic_image(es_image_name);
  await create_kibana_image(kib_image_name);
  await create_elastic_container(es_image_name);
  await create_kibana_container(kib_image_name);
};

combo();
```

### fetching the Containers later

```
const fetch_containers = async() => {
  const containers = await led.Container.fetch_all();
  console.log(containers);
};
```

## API overview
Everything that follows can be found on the `led` object. Fields with ? denote an optional field (typescript) and [false] denotes a field with a default value of false. Entities prefixed with an `I` indicate an interface. Finally, any param/option that is `verbose` just indicates the operation will run w/ logging.

- `elastic_image_label` set as a label on the image and therefore the container. used to identify containers/images this package has made.
- `kibana_image_label` set as a label on the image and therefore the container. used to identify kibana containers/images.

### Image
- `constructor(opts)`

  ```
  opts {
    es_version: string;
    kibana?: boolean;
    name: string;
  }
  ```

  - `es_version` the Elasticsearch version you want to use
  - `kibana[false]` do you want this image to have kibana installed?
  - `name` the name of the image
- `prototype.create(verbose?: boolean[false])` creates the Docker image using `docker build`. Be aware, the first time you create an image is by far the slowest. Subsequent times are near instantaneous due to how Docker caches the Dockerfile steps. Note the Kibana image takes significantly longer to create on the first attempt. This may take a minute or two. You should use the verbose option when you make the images for the first few times so you see the Docker build steps.

### EndTask
- `prototype.on_end(): Promise` denotes when a task has finished. it may resolve or reject w/ data. see the specific task to determine when it does resolve w/ data.

### FullTask extends EndTask
- `prototype.on_start(): Promise` denotes when a task has started. it will never reject.

### IContainerCreateTasks
The following tasks are executed in the order you see when a container is being created.

```
{
  main: EndTask;
  image_check: FullTask;
  volume_rm: FullTask;
  container_rm: FullTask;
  container_mk: FullTask;
  container_start: FullTask;
  elastic_ready: FullTask;
  kibana_ready: FullTask;
  kso_upload: FullTask;
  scripts_upload: FullTask;
  sm_upload: FullTask;
}
```

- `main` will resolve with an instance of the created `Container` as soon as the last task has resolved. It will reject immediately if any other task rejects and it will reject with that tasks error.
- `image_check` verifies you provided an image this container created and also makes sure if it's a Kibana image, you set `kibana` to true when you created the `ChildContainer`.
- `volume_rm` clears the volume directory provided to the container only if specified in `ContainerCreateOpts`.
- `container_rm` removes the container with the given containers name if it exists.
- `container_mk` creates the container with `docker create`.
- `container_start` starts the container with `docker start`.
- `elastic_ready` sends curl requests to `localhost:${port}/_cluster/health` and waits for status yellow/green. This will never reject. It will keep sending requests until it gets status yellow/green.
- `kibana_ready` sends curl requests to `localhost:${kibana_port}` and waits for status 200. This will never reject. It will keep sending requests until it gets status 200.
- `kso_upload` uploads any Kibana saved_objects given in `ContainerCreateOpts` to the container if it's a Kibana container.
  - if a saved_object is erroneous this will reject w/ that error.
  - else it will resolve w/ the created saved_objects.
- `scripts_upload` uploads any scripts given in `ContainerCreateOpts` to the container.

  - if two scripts are uploaded successfully, this task will resolve w/ something like (standard Elasticsearch response)

    ```
    [{ acknowledged: true }, { acknowledged: true }]
    ```

  - if N scripts are uploaded and 1 of them fails, this task will reject with something like (standard Elasticsearch response)

    ```
    {
      error: {
        root_cause: [ [Object] ],
        type: 'illegal_argument_exception',
        reason: 'unable to put stored script with unsupported lang [painlesss]'
      },
      status: 400
    }
    ```

- `sm_upload` uploads any settings/mappings given in `ContainerCreateOpts` to the container.

  - if settings/mappings are uploaded for a users index, you'll get something like (standard Elasticsearch response)

    ```
    [{ acknowledged: true, shards_acknowledged: true, index: 'users' }]
    ```

  - if N indices are uploaded and 1 of them fails, this task will reject with something like (standard Elasticsearch response)

    ```
    {
      error: {
        root_cause: [ [Object] ],
        type: 'illegal_argument_exception',
        reason: 'Failed to parse value [0] for setting [index.number_of_shards] must be >= 1'
      },
      status: 400
    }
    ```

### IElasticScript
```
{
  lang: string;
  source: string;
}
```

### IContainerCreateOpts
```
{
  clear_volume_dir?: boolean;
  kso?: any[];
  scripts?: { [name: string]: IElasticScript };
  sm?: object;
  verbose?: boolean;  
}
```
- `clear_volume_dir[false]` If a volume directory was given to the `ChildContainer`, do you want it cleared? This should be set to true, but it's your filesystem, so you need to tell this script to clear the directory.
- `kso[empty array]` an array of [Kibana saved_objects](https://www.elastic.co/guide/en/kibana/current/saved-objects-api.html). use this when you want to create the Kibana instance for the container w/ charts/dashboards you've previously saved from another Kibana instance. To fetch the saved_objects from a currently running Kibana instance, call its  `Container.prototype.kibana_saved_objects` method. A saved_objects array looks like:

  ```
  [
    {
      "id": "e84e14c0-cdeb-11e8-b958-0b2cbb7f0531",
      "type": "timelion-sheet",
      "updated_at": "2018-10-12T08:37:00.919Z",
      "version": 1,
      "attributes": {
        "title": "sheet1",
        "hits": 0,
        "description": "",
        "timelion_sheet": [
          ".es(*).title(\"I uploaded this.\")"
        ],
        "timelion_interval": "auto",
        "timelion_chart_height": 275,
        "timelion_columns": 2,
        "timelion_rows": 2,
        "version": 1
      }
    }
  ]
  ```
- `scripts[{}]` an object of Elasticsearch scripts. use this when you want to upload scripts to your container on create. the root keys are the script ids and their values are the scripts themselves. the format is as follows (see [here for more info](https://www.elastic.co/guide/en/elasticsearch/reference/current/modules-scripting-using.html#_request_examples)):

  ```
  {
    calc_score: {
      lang: 'painless',
      source: 'Math.log(_score * 2) + params.my_modifier'
    }
  }
  ```

- `sm` an object of Elasticsearch index settings/mappings. the root keys are the indices and their values are their settings/mappings. the format is as follows:

  ```
  {
    users: {
      mappings: { _doc: { properties: { name: { type: 'keyword' } } } },
      settings: { number_of_shards: 1 }
    }
  }
  ```

- `verbose[false]`

### BaseContainer
- `constructor(opts)`

  ```
  opts {
    image: string;
    name: string;
    node_name?: string;
    cluster_name?: string;
    port: number;
    kibana?: boolean;
    kibana_port?: number;
    hsize: number;
    khsize?: number;
    volume_dir?: string;
    env?: string[];
  }
  ```

  - `image` The name of the docker image to use. This should be an image produced from a call to `Image.prototype.create`.
  - `name` The name you want for the Docker container.
  - `node_name[autogenerated by Elasticsearch]` The name for the node in the container.
  - `cluster_name[autogenerated by Elasticsearch]` The cluster name for the node in the container.
  - `port` The exposed port to access Elasticsearch.
  - `kibana[false]` does this containers image have Kibana installed?
  - `kibana_port` The exposed port to access Kibana.
  - `hsize` heap size you want to give to the Elasticsearch node in MB. This is equivalent to the value in ES_JAVA_OPTS.
  - `khsize[512]` max heap size for the kibana node in MB. its set by passing `NODE_OPTIONS=--max-old-space-size={value}` as an environment variable to the `docker create` command.
  - `volume_dir[undefined]` A relative/absolute path to a directory you want as volume for the Elasticsearch cluster.
  - `env[empty array]` This is an array of environment variables along with their values you want set on the container. This is super valuable when you want to setup monitoring for your Kibana instance (monitoring requires the node to be an ingest node). All Kibana/Elasticsearch Docker environment variables are supported. If you provide an environment variable that is the same as one of the Elasticsearch specific options above (like heap size), it will have precedence. For example:

    ```
    [
      'node.master=true',
      'node.data=false',
      'ES_JAVA_OPTS="-Xms500m -Xmx500m"',
      'xpack.monitoring.collection.enabled=true'
      'whatever="environment var u want"'
    ]
    ```

  would be translated into `-e 'node.master=true' -e 'node.data=false' ...` for the `docker create` command. NOTE if using elastic version 7, you need to set `discovery.type=single-node`.

### ChildContainer extends BaseContainer
- `prototype.create(opts: IContainerCreateOpts): IContainerCreateTasks` creates the container by executing all the tasks in the returned tasks object.

### Container extends BaseContainer
- `fetch_all(verbose?: boolean[false]): Promise<Container[]>` fetches all the containers this package has created. It does so by fetching the containers w/ the `ged.elastic_image_label` and parsing each value.
- `prototype.start(verbose?: boolean[false])` starts the container.
- `prototype.stop(verbose?: boolean[false])` stops the container
- `prototype.restart(verbose?: boolean[false])` stops then starts the container.
- `prototype.delete(verbose?: boolean[false])` deletes the container.
- `prototype.wait_for_elastic(verbose?: boolean[false])` sends health checks to the Elasticsearch node in the container waiting for cluster state >= yellow.
- `prototype.wait_for_kibana(verbose?: boolean[false])` sends health checks to the Kibana node in the container waiting for status 200.
- `prototype.exec(cmd: string, verbose?: boolean): Promise<any>` executes the given command in the container and resolves w/ its stdout (VERY HANDY).

  ```
  const resp = await container.exec('curl localhost:9200/_cluster/health');
  const status = JSON.parse(resp).status; // yellow | green | red ...
  ```

- `prototype.cluster_health(verbose?: boolean[false]): Promise<{} | undefined>` curls inside the container on port 9200 and asks for its cluster health. If it succeeds, it resolves with the standard Elasticsearch response. If it fails or gets no response, it resolves with `undefined`. For example:

  ```
  {
    cluster_name: 'single-node-cluster',
    status: 'green',
    timed_out: false,
    number_of_nodes: 1,
    number_of_data_nodes: 1,
    active_primary_shards: 0,
    active_shards: 0,
    relocating_shards: 0,
    initializing_shards: 0,
    unassigned_shards: 0,
    delayed_unassigned_shards: 0,
    number_of_pending_tasks: 0,
    number_of_in_flight_fetch: 0,
    task_max_waiting_in_queue_millis: 0,
    active_shards_percent_as_number: 100
  }
  ```

- `prototype.cluster_state(verbose?: boolean[false]): Promise<string | undefined>` curls inside the container on port 9200 and asks for its cluster health state. If it succeeds, it resolves with `green | yellow | red`. If it fails or gets no response, it resolves with `undefined`.
- `prototype.kibana_status(verbose?: boolean[false]): Promise<number | undefined>` curls inside the container on port 5601 and checks the http status code. If it succeeds, it resolves with a number (like 200). If it fails or gets no response, it resolves with `undefined`.
- `prototype.kibana_saved_objects(verbose?: boolean[false]): Promise<[]>` curls inside the container on port 5601 @ `/api/saved_objects/_find` and returns the saved_objects array. will throw if this isn't a Kibana container. I believe this api endpoint was added in 6.4, so don't call this if your image was for an es version < 6.4. (see [here](https://www.elastic.co/guide/en/kibana/master/saved-objects-api.html))

### helpers
- `ls_containers(fmt?: string): Promise` prints the containers made by this package. you can pass in your own docker format string to override the default. see [here](https://docs.docker.com/engine/reference/commandline/ps/#formatting)

  ```
  await led.helpers.ls_containers('table {{ .ID }}\t {{.Status}}');
  ```

- `ls_images(fmt?: string): Promise` prints the images made by this package. you can pass in your own docker format string to override the default. see [here](https://docs.docker.com/engine/reference/commandline/images/#format-the-output)

  ```
  await led.helpers.ls_images('table {{ .ID }}\t {{.Size}}');
  ```

- `remove_containers(verbose?: boolean[false]): Promise` removes all containers this package has made.

- `remove_dangling_images(verbose?: boolean[false]): Promise` removes all dangling images. It just executes `docker rmi -f $(docker images --quiet --filter "dangling=true")`

- `remove_images(verbose?: boolean[false]): Promise` removes all images this package has made.

- `start_containers(verbose?: boolean[false]): Promise` starts all containers this package has made using `docker start`.

- `stop_containers(verbose?: boolean[false]): Promise` stops all containers this package has made using `docker stop`.

- `kill_containers(verbose?: boolean[false]): Promise` kills all containers this package has made using `docker kill`.

## supported versions of Elasticsearch/Kibana
Currently, 5.x, 6.x, 7.x should work. The only part I have to keep up to date are the supported Docker environment variables for Elasticsearch/Kibana. These seem to be updated for each major/minor version.

- see https://github.com/elastic/dockerfiles/blob/v7.2.0/kibana/bin/kibana-docker (modify the git tag etc...)

## additional notes
- if you're new to Docker, make sure you stop or delete the containers this package creates when you're not using them. You don't want these containers eating up your ram/cpu. To do this, execute a `docker ps -a` and get the container names you created and then `docker stop <name1> <name2>` or `docker rm -f <name1> <name2>` or you can just use the appropriate method on `led.helpers`.
