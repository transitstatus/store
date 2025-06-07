require('dotenv').config();

const validCloudflareProjects = [
  'gtfs-schedule-data',
  'gobbler',
  'amtraker',
  'transitstatus-react',
  'passio-ingest',
  'basemaps-assets',
  'site',
  'naturalearthtiles',
  'osm-liberty',
  'fonts',
  'transitstatus',
];
const validCloudflareWorkers = [
  'gtfs-autodeploy',
  'v4map'
];

const fetchCoolifyData = async () => {
  if (!process.env.coolify_domain) return [];
  const apiData = await fetch(`https://${process.env.coolify_domain}/api/v1/resources`, {
    headers: {
      Authorization: process.env.coolify_key,
    }
  })
    .then((res) => res.json());

  return apiData.map((resourceRaw) => {
    return {
      name: resourceRaw.name,
      git: resourceRaw.git_repository,
      isRunning: resourceRaw.status.includes('running'),
      createdTime: new Date(resourceRaw.created_at).toISOString(),
      updatedTime: new Date(resourceRaw.updated_at).toISOString(),
    }
  })
};

const fetchCloudflareBuildStatusData = async () => {
  let projectsArr = [];
  let finalPageNumber = 999;
  let pageNumber = 1;

  while (finalPageNumber > pageNumber) {
    const apiData = await fetch(`https://api.cloudflare.com/client/v4/accounts/${process.env.cf_account_id}/pages/projects?per_page=10&page=${pageNumber}`, {
      headers: {
        'X-Auth-Email': process.env.cf_build_status_email,
        'Authorization': `Bearer ${process.env.cf_build_status_token}`,
      }
    })
      .then((res) => res.json());

    if (apiData.result) {
      projectsArr.push(...apiData.result);
      pageNumber++;
      finalPageNumber = apiData.result_info.total_pages;
    } else {
      pageNumber = finalPageNumber + 1;
    }
  }

  const validProjects = projectsArr.filter((project) => validCloudflareProjects.includes(project.name));

  const finalProjects = validProjects.map((project) => {
    return {
      name: project.name,
      git: project.source.type == 'github' ? `${project.source.config.owner}/${project.source.config.repo_name}` : null,
      isBuilding: ['idle', 'active'].includes(project.latest_deployment.latest_stage.status),
      isDeployed: project.latest_deployment.latest_stage.status == 'success',
      isFailed: ['failure', 'cancelled'].includes(project.latest_deployment.latest_stage.status),
      createdTime: new Date(project.created_on).toISOString(),
      updatedTime: new Date(project.latest_deployment.modified_on).toISOString(),
    }
  });

  return finalProjects;
}

const fetchCloudflareWorkerStatusData = async () => {
  let workersArr = [];
  let finalPageNumber = 999;
  let pageNumber = 1;

  while (finalPageNumber > pageNumber) {
    const apiData = await fetch(`https://api.cloudflare.com/client/v4/accounts/${process.env.cf_account_id}/workers/scripts?per_page=10&page=${pageNumber}`, {
      headers: {
        'X-Auth-Email': process.env.cf_build_status_email,
        'Authorization': `Bearer ${process.env.cf_build_status_token}`,
      }
    })
      .then((res) => res.json());

    if (apiData.result) {
      workersArr.push(...apiData.result);
      pageNumber++;
      pageNumber = apiData.result_info ? apiData.result_info.total_pages : finalPageNumber + 1;
    } else {
      pageNumber = finalPageNumber + 1;
    }
  }

  const validWorkers = workersArr.filter((worker) => validCloudflareWorkers.includes(worker.id));

  const finalWorkers = validWorkers.map((worker) => {
    return {
      name: worker.id,
      git: null,
      isDeployed: true,
      createdTime: new Date(worker.created_on).toISOString(),
      updatedTime: new Date(worker.modified_on).toISOString(),
    }
  });

  return finalWorkers;
}

const update = async () => {
  const coolifyData = await fetchCoolifyData();
  const cloudFlareBuildStatusData = await fetchCloudflareBuildStatusData();
  const cloudflareWorkerStatusData = await fetchCloudflareWorkerStatusData();

  return {
    containers: coolifyData,
    staticContent: cloudFlareBuildStatusData,
    serverless: cloudflareWorkerStatusData,
  }
}

exports.update = update;