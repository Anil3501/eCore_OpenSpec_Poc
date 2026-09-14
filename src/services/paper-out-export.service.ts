import fs from 'node:fs';
import path from 'node:path';

interface PaperOutExportSampleData {
  dataClassification: string;
  paperOutRequest: { nameOfRequest: string };
}

const SAMPLE_DATA_PATH = path.join(process.cwd(), 'test-data', 'paper-out-export.sample.json');

function loadSampleData(): PaperOutExportSampleData {
  const raw = fs.readFileSync(SAMPLE_DATA_PATH, 'utf8');
  return JSON.parse(raw) as PaperOutExportSampleData;
}

/**
 * Resolves the fabricated inputs EC-12000's Paper Out Request scenarios need,
 * keeping that decision out of the step definitions.
 *
 * Collection names are deliberately absent from here. qa5's Collections list
 * changed once already during this story - "demo collection"/"test
 * collection" became "c1".."c5" without warning - so a name recorded here
 * would silently go stale the next time it happens. Which collection is
 * eligible for which flow is established at runtime instead, by
 * `resolveOpenCancelCollectionName` and `resolveSubmittableCollectionName` in
 * steps/paper-out-media-type.steps.ts (they need page access this service
 * intentionally does not have). Only the Name of Request text is invented.
 */
export class PaperOutExportService {
  private readonly sample: PaperOutExportSampleData;

  constructor() {
    this.sample = loadSampleData();
  }

  fabricatedNameOfRequest(): string {
    return this.sample.paperOutRequest.nameOfRequest;
  }

  /**
   * A fabricated Name of Request that is unique to one scenario run.
   *
   * The audit-trail scenarios identify their own Submitted Paper Out event by
   * batch name, and qa5's fixture document already carries eighteen Paper Out
   * events from earlier runs - several of them sharing the fixed fabricated
   * name. A constant name would make "this run's event" ambiguous the moment
   * a second run existed, and a stale event would be read as the current
   * result. The prefix stays recognisably synthetic so the events are
   * identifiable as test data in qa5.
   *
   * Note that a Paper Out event is permanent: cancelling a request releases
   * its transaction lock but does not remove the logged event, so every run
   * necessarily leaves one behind.
   */
  uniqueNameOfRequest(testScenarioId: string): string {
    return `${this.sample.paperOutRequest.nameOfRequest}-${testScenarioId}-${Date.now()}`;
  }

  /**
   * The value the application actually records for each Media Type choice.
   *
   * Captured live from qa5 on 2026-09-14 rather than assumed: the Submitted
   * Paper Out event's Additional Information read "Media Type=paper" for a
   * request submitted with "Print to Paper" (batch PROBE-TXN-1789384390559,
   * ID=366927) and "Media Type=electronic" for one submitted with "Save as
   * Electronic File" (batch PROBE-TS003-CHECK, ID=366823).
   *
   * The test plan states these in business terms ("Paper", "Electronic"), so
   * the mapping between the two vocabularies lives here, next to the evidence
   * for it, instead of being hidden in an assertion.
   */
  recordedMediaTypeValueFor(businessTerm: string): string {
    const recorded: Record<string, string> = {
      paper: 'paper',
      electronic: 'electronic',
    };
    const key = businessTerm.trim().toLowerCase();
    const value = recorded[key];
    if (value === undefined) {
      throw new Error(
        `No recorded Media Type value has been observed for the business term "${businessTerm}". ` +
          'Only "Paper" and "Electronic" have been confirmed live against qa5; inventing a third ' +
          'would be guessing at application behaviour.',
      );
    }
    return value;
  }
}
