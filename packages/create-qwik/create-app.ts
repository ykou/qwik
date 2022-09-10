/* eslint-disable no-console */
import fs from 'fs';
import { join, resolve } from 'path';
import { cleanPackageJson, panic, toDashCase, writePackageJson } from '../qwik/src/cli/utils';
import { loadIntegrations } from '../qwik/src/cli/integrations';
import { logCreateAppResult } from '../qwik/src/cli/log';
import { updateApp } from '../qwik/src/cli/update-app';
import type {
  CreateAppOptions,
  CreateAppResult,
  IntegrationData,
  IntegrationPackageJson,
} from '../qwik/src/cli/types';

export async function runCreateCli(starterId: string, projectName: string) {
  const outDirName = createOutDirName(projectName);
  let outDir: string;

  if (writeToCwd()) {
    // write to the current working directory
    outDir = process.cwd();
  } else {
    // create a sub directory
    outDir = createOutDir(outDirName);
    if (fs.existsSync(outDir)) {
      panic(
        `Directory "${outDir}" already exists. Please either remove this directory, or choose another location.`
      );
    }
  }

  const opts: CreateAppOptions = {
    starterId,
    projectName,
    outDir,
  };

  const result = await createApp(opts);

  logCreateAppResult(result, false);

  return result;
}

export async function createApp(opts: CreateAppOptions) {
  if (!isValidOption(opts.projectName)) {
    throw new Error(`Missing project name`);
  }
  if (!isValidOption(opts.starterId)) {
    throw new Error(`Missing starter id`);
  }
  if (!isValidOption(opts.outDir)) {
    throw new Error(`Missing outDir`);
  }
  if (!fs.existsSync(opts.outDir)) {
    fs.mkdirSync(opts.outDir, { recursive: true });
  }

  const result: CreateAppResult = {
    projectName: opts.projectName,
    starterId: opts.starterId,
    outDir: opts.outDir,
  };

  const starterApps = (await loadIntegrations()).filter((i) => i.type === 'app');
  const baseApp = starterApps.find((a) => a.id === 'base');
  const starterApp = starterApps.find((s) => s.id === opts.starterId);
  if (!baseApp) {
    throw new Error(`Unable to find base app`);
  }
  if (!starterApp) {
    throw new Error(`Invalid starter id "${opts.starterId}"`);
  }

  await createFromStarter(result, baseApp, starterApp);

  return result;
}

async function createFromStarter(
  result: CreateAppResult,
  baseApp: IntegrationData,
  starterApp: IntegrationData
) {
  const appPkgJson: IntegrationPackageJson = {
    name: toDashCase(result.projectName),
    description: starterApp.description.trim(),
    private: true,
  };
  await writePackageJson(result.outDir, cleanPackageJson(appPkgJson));
  await createReadme(result);

  const baseUpdate = await updateApp({
    rootDir: result.outDir,
    integration: baseApp.id,
    installDeps: false,
  });
  await baseUpdate.commit(false);

  const starterUpdate = await updateApp({
    rootDir: result.outDir,
    integration: starterApp.id,
    installDeps: false,
  });
  await starterUpdate.commit(false);
}

async function createReadme(result: CreateAppResult) {
  const r: string[] = [];

  r.push(`# Qwik ${result.projectName} ⚡️`);
  r.push(``);
  r.push(`- [Qwik Docs](https://qwik.builder.io/)`);
  r.push(`- [Qwik Github](https://github.com/BuilderIO/qwik)`);
  r.push(`- [@QwikDev](https://twitter.com/QwikDev)`);
  r.push(`- [Discord](https://qwik.builder.io/chat)`);
  r.push(`- [Vite](https://vitejs.dev/)`);
  r.push(`- [Partytown](https://partytown.builder.io/)`);
  r.push(`- [Mitosis](https://github.com/BuilderIO/mitosis)`);
  r.push(`- [Builder.io](https://www.builder.io/)`);
  r.push(``);
  r.push(`--------------------`);

  const readmePath = join(result.outDir, 'README.md');
  const readmeContent = r.join('\n').trim() + '\n';
  await fs.promises.writeFile(readmePath, readmeContent);
}

function isValidOption(value: any) {
  return typeof value === 'string' && value.trim().length > 0;
}

export function createOutDirName(projectName: string) {
  return projectName.toLocaleLowerCase().replace(/ /g, '-');
}

export function createOutDir(outDirName: string) {
  return resolve(process.cwd(), outDirName);
}

export function writeToCwd() {
  return isStackBlitz();
}

function isStackBlitz() {
  try {
    // /home/projects/abc123
    return process.cwd().startsWith('/home/projects/');
  } catch (e) {
    /**/
  }
  return false;
}
