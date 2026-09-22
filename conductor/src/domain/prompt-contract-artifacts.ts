import { createHash } from "node:crypto";
import type {
  PromptContractProvider,
  SharedPromptContract,
  TaskSnapshotMirrorRef,
} from "../core/lib/composition.js";
import { PRODUCT_SPEC_FORMAT, PRODUCT_SPEC_FORMAT_FILE } from "./product-spec-format.js";
import { TECHNICAL_SPEC_FORMAT, TECHNICAL_SPEC_FORMAT_FILE } from "./technical-spec-format.js";
import { WORK_REPO_CONTRACT, WORK_REPO_CONTRACT_FILE } from "./work-repo-contract.js";
import {
  persistTextArtifacts,
  type PersistTextArtifacts,
} from "./work-repo-artifacts.js";
import { workRepoFor, type WorkRepoConfig } from "./work-repo.js";

export const PROMPT_CONTRACT_NAMES = [
  PRODUCT_SPEC_FORMAT_FILE,
  TECHNICAL_SPEC_FORMAT_FILE,
  WORK_REPO_CONTRACT_FILE,
] as const;

export type PromptContractName = (typeof PROMPT_CONTRACT_NAMES)[number];

const CONTRACTS: Record<PromptContractName, string> = {
  [PRODUCT_SPEC_FORMAT_FILE]: PRODUCT_SPEC_FORMAT,
  [TECHNICAL_SPEC_FORMAT_FILE]: TECHNICAL_SPEC_FORMAT,
  [WORK_REPO_CONTRACT_FILE]: WORK_REPO_CONTRACT,
};

const CONTRACT_PATH = (name: PromptContractName) => `_conductor/contracts/${name}`;
const VERSION = createHash("sha256")
  .update(PROMPT_CONTRACT_NAMES.map((name) => `${name}\0${CONTRACTS[name]}\0`).join(""))
  .digest("hex");
const cache = new Map<string, Promise<Map<string, TaskSnapshotMirrorRef>>>();

/**
 * Canonical formats live in the app source, but Agents consume a pinned,
 * runtime-owned copy in the project's work repository. The cache is safe:
 * every returned ref names an immutable commit, even after that repo advances.
 */
export function createPromptContractProvider(
  persist: PersistTextArtifacts = persistTextArtifacts,
): PromptContractProvider {
  return {
    names: PROMPT_CONTRACT_NAMES,
    forCoordinator: PROMPT_CONTRACT_NAMES,
    defaultForWorker(agent) {
      return agent === "conductor:pm"
        ? [PRODUCT_SPEC_FORMAT_FILE, WORK_REPO_CONTRACT_FILE]
        : [];
    },
    async resolve(task, requested) {
      const names = selectedNames(requested);
      if (!names.length) return [];
      const workRepo = workRepoFor(task.project);
      if (!workRepo) {
        // Core supports projects without a work repository. Inline only the
        // selected contracts there; worker resumes suppress these stable bodies.
        return names.map((name) => ({ name, content: CONTRACTS[name] }));
      }
      const refs = await ensureContractArtifacts(workRepo, persist);
      return names.map((name): SharedPromptContract => {
        const artifact = refs.get(CONTRACT_PATH(name));
        if (!artifact) throw new Error(`Work repository did not return prompt contract ${name}`);
        return { name, artifact };
      });
    },
  };
}

function selectedNames(requested: readonly string[]): PromptContractName[] {
  const allowed = new Set<string>(PROMPT_CONTRACT_NAMES);
  return [...new Set(requested)].filter((name): name is PromptContractName => allowed.has(name));
}

async function ensureContractArtifacts(
  workRepo: WorkRepoConfig,
  persist: PersistTextArtifacts,
): Promise<Map<string, TaskSnapshotMirrorRef>> {
  // Tests may inject a persister whose result should not leak into the process
  // cache used by the production persister.
  if (persist !== persistTextArtifacts) return writeContractArtifacts(workRepo, persist);
  const key = `${workRepo.repo}\0${workRepo.workingDir}\0${VERSION}`;
  let pending = cache.get(key);
  if (!pending) {
    pending = writeContractArtifacts(workRepo, persist).catch((error) => {
      cache.delete(key);
      throw error;
    });
    cache.set(key, pending);
  }
  return pending;
}

async function writeContractArtifacts(
  workRepo: WorkRepoConfig,
  persist: PersistTextArtifacts,
): Promise<Map<string, TaskSnapshotMirrorRef>> {
  const refs = await persist(
    workRepo,
    PROMPT_CONTRACT_NAMES.map((name) => ({
      path: CONTRACT_PATH(name),
      mediaType: "text/markdown" as const,
      content: CONTRACTS[name],
    })),
    "conductor: sync Agent prompt contracts",
  );
  return new Map([...refs].map(([artifactPath, ref]) => [artifactPath, ref]));
}
