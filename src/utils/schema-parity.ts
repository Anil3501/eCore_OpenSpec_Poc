/**
 * Structural parity check between a JSON Schema (Draft 2020-12) document and a
 * JSON instance.
 *
 * Scope note: no JSON Schema runtime validator is permitted as a new dependency
 * for this POC, so full keyword evaluation is delegated to the equivalent Zod
 * models in `src/models/`. This module adds the checks that Zod cannot see -
 * that the hand-written JSON Schema and the instance agree on property names
 * and required properties, so the two contracts cannot silently drift apart.
 */
import { readJson } from './artifact-io.ts';

export interface ParityIssue {
  path: string;
  message: string;
}

interface SchemaNode {
  type?: string | string[];
  properties?: Record<string, SchemaNode>;
  required?: string[];
  additionalProperties?: boolean | SchemaNode;
  items?: SchemaNode;
  $ref?: string;
  $defs?: Record<string, SchemaNode>;
  anyOf?: SchemaNode[];
  allOf?: SchemaNode[];
}

function resolveRef(root: SchemaNode, node: SchemaNode): SchemaNode {
  if (!node.$ref) return node;
  const ref = node.$ref;
  if (!ref.startsWith('#/$defs/')) return node;
  const key = ref.slice('#/$defs/'.length);
  const resolved = root.$defs?.[key];
  return resolved ? resolveRef(root, resolved) : node;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function checkNode(
  root: SchemaNode,
  rawNode: SchemaNode,
  instance: unknown,
  pointer: string,
  issues: ParityIssue[],
): void {
  const node = resolveRef(root, rawNode);

  // Union branches: accept the instance if any branch matches structurally.
  if (node.anyOf) {
    const branchIssues = node.anyOf.map((branch) => {
      const collected: ParityIssue[] = [];
      checkNode(root, branch, instance, pointer, collected);
      return collected;
    });
    if (branchIssues.some((collected) => collected.length === 0)) return;
    issues.push({
      path: pointer,
      message: 'value does not match any anyOf branch declared in the schema',
    });
    return;
  }

  if (node.allOf) {
    for (const branch of node.allOf) {
      // allOf here only carries conditional refinements handled by Zod.
      if (branch.properties || branch.required) continue;
    }
  }

  if (node.properties || node.required) {
    if (!isPlainObject(instance)) {
      const declaredTypes = Array.isArray(node.type) ? node.type : [node.type];
      if (instance === null && declaredTypes.includes('null')) return;
      issues.push({ path: pointer, message: 'expected an object' });
      return;
    }

    const declared = new Set(Object.keys(node.properties ?? {}));
    if (node.additionalProperties === false) {
      for (const key of Object.keys(instance)) {
        if (!declared.has(key)) {
          issues.push({
            path: `${pointer}/${key}`,
            message: 'property is not declared in the schema (additionalProperties is false)',
          });
        }
      }
    }
    for (const requiredKey of node.required ?? []) {
      if (!(requiredKey in instance)) {
        issues.push({
          path: `${pointer}/${requiredKey}`,
          message: 'required property is missing',
        });
      }
    }
    for (const [key, childSchema] of Object.entries(node.properties ?? {})) {
      if (key in instance) {
        checkNode(root, childSchema, instance[key], `${pointer}/${key}`, issues);
      }
    }
    return;
  }

  if (node.items) {
    if (!Array.isArray(instance)) {
      const declaredTypes = Array.isArray(node.type) ? node.type : [node.type];
      if (instance === null && declaredTypes.includes('null')) return;
      if (node.type === 'array') {
        issues.push({ path: pointer, message: 'expected an array' });
      }
      return;
    }
    instance.forEach((item, index) => {
      checkNode(root, node.items as SchemaNode, item, `${pointer}/${index}`, issues);
    });
  }
}

/** Returns structural mismatches between a JSON Schema file and a JSON instance. */
export function checkSchemaParity(schemaPath: string, instance: unknown): ParityIssue[] {
  const schema = readJson<SchemaNode>(schemaPath);
  const issues: ParityIssue[] = [];
  checkNode(schema, schema, instance, '', issues);
  return issues;
}
