# Resourceful production deployment

Resourceful's canonical production URL is:

- `https://resourceful-7x38.vercel.app`

The repository includes `.github/workflows/deploy-production.yml`. After the required secrets are configured, every push or merge to `main` will:

1. install the locked dependencies with Node.js 20 and pnpm 9;
2. run lint, TypeScript, and unit tests;
3. pull the production settings for the linked Vercel project;
4. build the production artifact;
5. deploy that exact artifact to Vercel production; and
6. verify `https://resourceful-7x38.vercel.app/api/health`.

## One-time GitHub environment setup

In GitHub, open **Settings → Environments → production** and add these environment secrets:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

Do not commit any of these values to the repository.

## Get the Vercel IDs

Use the Vercel account or team that owns `resourceful-7x38.vercel.app`.

From a trusted local checkout:

```bash
npm install --global vercel
vercel login
vercel link
cat .vercel/project.json
```

Link the checkout to the existing Resourceful project, not a new project. The generated local file contains:

```json
{
  "orgId": "team_or_user_id",
  "projectId": "prj_project_id"
}
```

Use `orgId` as `VERCEL_ORG_ID` and `projectId` as `VERCEL_PROJECT_ID`. Keep `.vercel/` uncommitted.

Create a scoped Vercel token from the same account and save it as `VERCEL_TOKEN` in the GitHub `production` environment.

## Production branch

The workflow treats `main` as the production branch. Pull requests remain non-production until merged.

Recommended branch protection for `main`:

- require the `CI / quality` check;
- require the branch to be current before merge;
- disallow force pushes;
- require pull requests for normal changes; and
- restrict production-environment secret access to the production workflow.

## Manual production deployment

The workflow also supports **Actions → Deploy Resourceful to Vercel → Run workflow**. A manual run deploys the current `main` commit through the same validation and health-check path.

## Failure behavior

A failed lint, type check, unit test, Vercel build, deployment, or canonical health check fails the workflow. The workflow never deploys a build that failed the quality gates.

If the credential check fails, confirm that all three values exist specifically in the GitHub `production` environment and belong to the Vercel scope that owns `resourceful-7x38.vercel.app`.
