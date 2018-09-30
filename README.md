# local-elastic-docker
This package helps you set up single-node [Elasticsearch](https://www.elastic.co/guide/en/elasticsearch/reference/current/index.html)/[Kibana](https://www.elastic.co/guide/en/kibana/current/index.html) clusters locally for development via [Docker](https://docs.docker.com/). If you're also looking for a similar way to setup Elasticsearch/Kibana on Google Compute Engine, look at [this repo](https://github.com/VincentJ711/gce-elastic-docker).

## Getting Started
There are two stages when using this module. The first is building Elasticsearch/Kibana Docker images and the second is creating Docker containers from these images. Once the containers are created, you can use Elasticsearch/Kibana however you please.

### Prerequisites
This package utilizes `curl` and `docker` heavily. If you do not install them, this package will not work.

### Installation
`npm install local-elastic-docker`

### Examples
If you would like to run this example (recommended), copy/paste the file in ./examples and run it, ie `node readme`. also make sure you delete your containers when your not using them to free your cpu/ram.

#### creating an Elasticsearch image
you can view your images with `docker images`

```
const led = require('local-elastic-docker');

const create_elastic_image = async image_name => {
  await (new led.Image({
    es_version: '6.3.2',
    name: image_name,
    verbose: true
  })).create();
};
```

#### creating a Kibana image

```
const create_kibana_image = async image_name => {
  await (new led.Image({
    es_version: '6.3.2',
    kibana: true,
    name: image_name,
    verbose: true
  })).create();
};
```

#### creating an Elasticsearch container
you can view your containers with `docker ps -a`

```
const create_elastic_container = async image_name => {
  const container = new led.Container({
    hsize: 500,
    image: image_name,
    name: `${image_name}-1`,
    port: 5000,
    verbose: true
  });
  const tasks = container.create();
  await tasks.main.on_end();
};
```

#### creating a Kibana container

```
const create_kibana_container = async image_name => {
  const container = new led.Container({
    cluster_name: 'kibana_cluster',
    hsize: 500,
    image: image_name,
    kibana_port: 6001,
    name: `${image_name}-1`,
    port: 5001,
    verbose: true
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
  const verbose = true;

  await led.helpers.remove_containers(verbose);
  await led.helpers.remove_images(verbose);
  await create_elastic_image(es_image_name);
  await create_kibana_image(kib_image_name);
  await create_elastic_container(es_image_name);
  await create_kibana_container(kib_image_name);
};

combo();
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
    verbose?: boolean;
  }
  ```

  - `es_version` the Elasticsearch version you want to use
  - `kibana[false]` do you want this image to have kibana installed?
  - `name` the name of the image
  - `verbose[false]`
- `prototype.create()` creates the Docker image using `docker build`. Be aware, the first time you create an image is by far the slowest. Subsequent times are near instantaneous due to how Docker caches the Dockerfile steps. Note the Kibana image takes significantly longer to create on the first attempt. This may take a minute or two. You should use the verbose option when you make the images for the first few times so you see the Docker build steps.

### EndTask
- `prototype.on_end(): Promise` denotes when a task has finished. it may resolve or reject w/ data. see the specific task to determine when it does resolve w/ data.

### FullTask extends EndTask
- `prototype.on_start(): Promise` denotes when a task has started. it will never reject.

### IContainerCreateTasks
The following tasks are executed in the order you see.

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
  scripts_upload: FullTask;
  sm_upload: FullTask;
}
```

- `main` will resolve with the container itself as soon as the last task has resolved. It will reject immediately if any other task rejects and it will reject with that tasks error.
- `image_check` verifies you provided an image this container created and also makes sure if it's a Kibana image, you provided a Kibana port.
- `volume_rm`

  - if `volume_dir` exists and `clear_volume_dir` is set, it will clear `volume_dir` and ensure it exists.
  - if `volume_dir` exists and `clear_volume_dir` is not set, it will ensure `volume_dir` exists.
- `container_rm` removes a container with the given containers name if it exists.
- `container_mk` creates the container with `docker create`.
- `container_start` starts the container with `docker start`.
- `elastic_ready` sends curl requests to `localhost:${port}/_cluster/health` and waits for status yellow/green. This will never reject. It will keep sending requests until it gets status yellow/green.
- `kibana_ready` sends curl requests to `localhost:${kibana_port}` and waits for status 200. This will never reject. It will keep sending requests until it gets status 200.
- `scripts_upload` uploads the given scripts in parallel to `localhost:${port}/_scripts/${script.id}`.

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

- `sm_upload` uploads given settings/mappings for each given index in parallel to `localhost:${port}/${index}`

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

### Container
- `constructor(opts)`

  ```
  opts {
    image: string;
    name: string;
    node_name?: string;
    cluster_name?: string;
    port: number;
    kibana_port?: number;
    hsize: number;
    master?: boolean;
    data?: boolean;
    ingest?: boolean;
    sm?: object;
    scripts?: { [name: string]: IElasticScript };
    volume_dir?: string;
    clear_volume_dir?: boolean;
    env?: string[];
    verbose?: boolean;
  }
  ```

  - `image` The name of the image to use. This should be an image produced from a call to `Image.prototype.create`.
  - `name` The name you want for the Docker container.
  - `node_name[autogenerated by Elasticsearch]` The name for the node in the container.
  - `cluster_name[autogenerated by Elasticsearch]` The cluster name for the node in the container.
  - `port` The exposed port to access Elasticsearch.
  - `kibana_port` The exposed port to access Kibana. If no port is given and a Kibana image was passed to this constructor, an error will be thrown.
  - `hsize` heap size you want to give to the Elasticsearch node in MB. This is equivalent to the value in ES_JAVA_OPTS.
  - `master[true]` Is this a master node?
  - `data[true]` Is this a data node?
  - `ingest[false]` Is this an ingest node?
  - `sm` an object of Elasticsearch index settings/mappings. the root keys are the indices and their values are their settings/mappings. the format is as follows:

    ```
    {
      users: {
        mappings: { _doc: { properties: { name: { type: 'keyword' } } } },
        settings: { number_of_shards: 1 }
      }
    }
    ```

  - `scripts[{}]` an object of Elasticsearch scripts. the root keys are the script ids and their values are the scripts themselves. the format is as follows (see [here for more info](https://www.elastic.co/guide/en/elasticsearch/reference/current/modules-scripting-using.html#_request_examples)):

    ```
    {
      calc_score: {
        lang: 'painless',
        source: 'Math.log(_score * 2) + params.my_modifier'
      }
    }
    ```

  - `volume_dir` A relative/absolute path to a directory you want as volume for the Elasticsearch cluster.
  - `clear_volume_dir[false]` If a volume directory is given, do you want it cleared? This should be set to true, but it's your filesystem, so you need to tell this script to clear the directory.
  - `env[empty array]` This is an array of environment variables along with their values you want set on the container. This script just concatenates them together and passes them to the `docker create` command. Thus, make sure each entry is formatted for that. If you provide an environment variable that is the same as one of the Elasticsearch specific options above (like data/master/ingest node/heap size), it will have precedence. For example:

    ```
    [
      'node.master=true',
      'node.data=true',
      'node.ingest=false',
      'ES_JAVA_OPTS="-Xms500m -Xmx500m"',
      'whatever="environment var u want"'
    ]
    ```

  would be translated into `-e 'node.master=true' -e 'node.data=true' ...` for the `docker create` command.

  - `verbose[false]`

- `prototype.create(): IContainerCreateTasks` creates the container by executing all the tasks in the returned tasks object.

### helpers
- `ls_containers(fmt?: string)` prints the containers made by this package. you can pass in your own docker format string to override the default. see [here](https://docs.docker.com/engine/reference/commandline/ps/#formatting)

  ```
  await led.helpers.ls_containers('table {{ .ID }}\t {{.Status}}');
  ```

- `ls_images(fmt?: string)` prints the images made by this package. you can pass in your own docker format string to override the default. see [here](https://docs.docker.com/engine/reference/commandline/images/#format-the-output)

  ```
  await led.helpers.ls_images('table {{ .ID }}\t {{.Size}}');
  ```

- `remove_containers(verbose?: boolean[false])` removes all containers this package has made.

- `remove_dangling_images(verbose?: boolean[false])` removes all dangling images. It just executes `docker rmi -f $(docker images --quiet --filter "dangling=true")`

- `remove_images(verbose?: boolean[false])` removes all images this package has made.

- `start_containers(verbose?: boolean[false])` starts all containers this package has made.

- `stop_containers(verbose?: boolean[false])` stops all containers this package has made.

## additional notes
- if you're new to Docker, make sure you stop or delete the containers this package creates when you're not using them. You don't want these containers eating up your ram/cpu. To do this, execute a `docker ps -a` and get the container names you created and then `docker stop <name1> <name2>` or `docker rm -f <name1> <name2>` or you can just use the appropriate method on `led.helpers`.
