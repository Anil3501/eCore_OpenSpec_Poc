import type { Page } from '@playwright/test';
import { PaperOutRequestModalComponent } from '../components/paper-out-request-modal.component.ts';
import { AcknowledgementModalComponent } from '../components/acknowledgement-modal.component.ts';
import { WorkQueueComponent } from '../components/work-queue.component.ts';
import { VerifyPaperOutModalComponent } from '../components/verify-paper-out-modal.component.ts';
import { DocumentHistoryComponent } from '../components/document-history.component.ts';
import { PaperOutExportService } from '../services/paper-out-export.service.ts';

/**
 * What TS-EC-12000-018's When step read from the Verify Paper Out modal.
 */
export interface VerifyModalReading {
  lastCheckboxLabel?: string;
}

/**
 * The text of the Paper Out package downloaded for TS-EC-12000-016.
 */
export interface DocumentActivityReport {
  text?: string;
}

/**
 * The Name of Request a scenario submitted its Paper Out under.
 */
export interface PaperOutSubmission {
  nameOfRequest?: string;
}

export interface PaperOutExportFixtures {
  paperOutRequestModal: PaperOutRequestModalComponent;
  acknowledgementModal: AcknowledgementModalComponent;
  workQueue: WorkQueueComponent;
  verifyPaperOutModal: VerifyPaperOutModalComponent;
  documentHistory: DocumentHistoryComponent;
  verifyModalReading: VerifyModalReading;
  documentActivityReport: DocumentActivityReport;
  paperOutSubmission: PaperOutSubmission;
  paperOutExport: PaperOutExportService;
}

export const paperOutExportFixture = {
  paperOutRequestModal: async ({ page }: { page: Page }, use: (c: PaperOutRequestModalComponent) => Promise<void>) => {
    await use(new PaperOutRequestModalComponent(page));
  },
  acknowledgementModal: async ({ page }: { page: Page }, use: (c: AcknowledgementModalComponent) => Promise<void>) => {
    await use(new AcknowledgementModalComponent(page));
  },
  workQueue: async ({ page }: { page: Page }, use: (c: WorkQueueComponent) => Promise<void>) => {
    await use(new WorkQueueComponent(page));
  },
  verifyPaperOutModal: async ({ page }: { page: Page }, use: (c: VerifyPaperOutModalComponent) => Promise<void>) => {
    await use(new VerifyPaperOutModalComponent(page));
  },
  documentHistory: async ({ page }: { page: Page }, use: (c: DocumentHistoryComponent) => Promise<void>) => {
    await use(new DocumentHistoryComponent(page));
  },
  // eslint-disable-next-line no-empty-pattern
  verifyModalReading: async ({}, use: (m: VerifyModalReading) => Promise<void>) => {
    await use({});
  },
  // eslint-disable-next-line no-empty-pattern
  documentActivityReport: async ({}, use: (r: DocumentActivityReport) => Promise<void>) => {
    await use({});
  },
  // eslint-disable-next-line no-empty-pattern
  paperOutSubmission: async ({}, use: (s: PaperOutSubmission) => Promise<void>) => {
    await use({});
  },
  // eslint-disable-next-line no-empty-pattern
  paperOutExport: async ({}, use: (s: PaperOutExportService) => Promise<void>) => {
    await use(new PaperOutExportService());
  },
};
