import type { ModuleTranslator } from '../i18n/ModuleTranslator';
import type { TestingData } from './TestingData';
import type { Level } from './Level';
import type { Principle } from './Principle';
import type { Guideline } from './Guideline';
import type { ModuleReport } from './ModuleReport';

export abstract class Tester {
  protected readonly assertions = new Map<string, Guideline>();
  protected readonly toExecute: { [key: string]: boolean } = {};

  protected readonly report: ModuleReport;

  constructor(report: ModuleReport) {
    this.report = report;
  }

  public configureByPrinciplesAndLevels(principles?: Principle[], levels?: Level[]): void {
    for (const [key, assertion] of this.assertions) {
      if (principles && principles.length !== 0) {
        if (levels && levels.length !== 0) {
          if (!assertion.hasPrincipleAndLevels(principles, levels)) {
            this.toExecute[key] = false;
          }
        } else if (!assertion.hasPrincipleAndLevels(principles, ['A', 'AA', 'AAA'])) {
          this.toExecute[key] = false;
        }
      } else if (
        levels &&
        levels.length !== 0 &&
        !assertion.hasPrincipleAndLevels(['Perceivable', 'Operable', 'Understandable', 'Robust'], levels)
      ) {
        this.toExecute[key] = false;
      }
    }
  }

  private configureAssertions(assertions?: string[], include = false): void {
    if (!assertions || assertions.length === 0) {
      return;
    }

    for (const code of assertions) {
      for (const [key, ruleObject] of this.assertions) {
        if (ruleObject.getCode() === code || ruleObject.getMapping() === code) {
          this.toExecute[key] = include;
        }
      }
    }
  }

  public configureIncluded(includeAssertions?: string[]): void {
    this.configureAssertions(includeAssertions, true);
  }

  public configureExcluded(excludeAssertions?: string[]): void {
    this.configureAssertions(excludeAssertions, false);
  }

  public getAllToExecute(): { [key: string]: boolean } {
    return this.toExecute;
  }

  public resetConfiguration(): void {
    for (const key in this.toExecute ?? {}) {
      this.toExecute[key] = true;
    }
  }

  public abstract init(translator: ModuleTranslator): this;
  public abstract execute(data: TestingData): void;
}
