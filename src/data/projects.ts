// Add a GitHub repository URL here to give it a project page.
const repositories = [
  'https://github.com/huxint/orangutan-agent',
  'https://github.com/huxint/nexus',
];

export const projects = repositories.map((repository) => {
  const [owner, name] = new URL(repository).pathname.split('/').filter(Boolean);
  return {
    owner,
    name,
    repository,
    slug: name,
    metadata: `https://api.github.com/repos/${owner}/${name}`,
    readme: `https://raw.githubusercontent.com/${owner}/${name}/HEAD/README.md`,
  };
});
