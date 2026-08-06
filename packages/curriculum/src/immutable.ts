import type { CurriculumBlueprint, CurriculumSeedDay } from "@codelift/contracts";

export type DeepReadonly<T> = T extends (...arguments_: never[]) => unknown
  ? T
  : T extends readonly (infer Item)[]
    ? readonly DeepReadonly<Item>[]
    : T extends object
      ? { readonly [Key in keyof T]: DeepReadonly<T[Key]> }
      : T;

export type ReadonlyCurriculumBlueprint = DeepReadonly<CurriculumBlueprint>;
export type ReadonlyCurriculumSeedDay = DeepReadonly<CurriculumSeedDay>;

export function deepFreeze<T>(value: T): DeepReadonly<T> {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) {
    return value as DeepReadonly<T>;
  }

  for (const key of Reflect.ownKeys(value)) {
    const child = Reflect.get(value, key) as unknown;
    deepFreeze(child);
  }

  return Object.freeze(value) as DeepReadonly<T>;
}

export type CurriculumDayIndex = ReadonlyMap<number, CurriculumSeedDay>;

class ImmutableDayIndex<Day extends { readonly dayNumber: number }> implements ReadonlyMap<
  number,
  Day
> {
  readonly #days: Map<number, Day>;

  constructor(days: readonly Day[]) {
    const indexedDays = new Map<number, Day>();

    for (const day of days) {
      if (indexedDays.has(day.dayNumber)) {
        throw new Error(`Cannot index duplicate curriculum day ${day.dayNumber}.`);
      }

      deepFreeze(day);
      indexedDays.set(day.dayNumber, day);
    }

    this.#days = indexedDays;
    Object.freeze(this);
  }

  get size(): number {
    return this.#days.size;
  }

  get [Symbol.toStringTag](): string {
    return "CurriculumDayIndex";
  }

  has(dayNumber: number): boolean {
    return this.#days.has(dayNumber);
  }

  get(dayNumber: number): Day | undefined {
    return this.#days.get(dayNumber);
  }

  entries(): MapIterator<[number, Day]> {
    return this.#days.entries();
  }

  keys(): MapIterator<number> {
    return this.#days.keys();
  }

  values(): MapIterator<Day> {
    return this.#days.values();
  }

  forEach(
    callback: (value: Day, key: number, map: ReadonlyMap<number, Day>) => void,
    thisArgument?: unknown
  ): void {
    for (const [key, value] of this.#days) {
      callback.call(thisArgument, value, key, this);
    }
  }

  [Symbol.iterator](): MapIterator<[number, Day]> {
    return this.entries();
  }
}

export function createImmutableDayIndex<Day extends { readonly dayNumber: number }>(
  days: readonly Day[]
): ReadonlyMap<number, Day> {
  return new ImmutableDayIndex(days);
}

export function createCurriculumDayIndex(days: readonly CurriculumSeedDay[]): CurriculumDayIndex {
  return createImmutableDayIndex(days);
}
