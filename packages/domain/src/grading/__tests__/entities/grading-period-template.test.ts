import { describe, it, expect } from 'vitest';
import { GradingPeriodTemplate } from '../../entities/grading-period-template';
import {
  PeriodSortOrderDuplicateError,
  PeriodTemplateItemNameDuplicateError,
} from '../../errors/grading-period.errors';

import type { CreateGradingPeriodTemplateItemInput } from '../../entities/grading-period-template';

const makeItems = (overrides?: CreateGradingPeriodTemplateItemInput[]): CreateGradingPeriodTemplateItemInput[] =>
  overrides ?? [
    { name: '1° Trimestre', sortOrder: 1 },
    { name: '2° Trimestre', sortOrder: 2 },
    { name: '3° Trimestre', sortOrder: 3 },
  ];

describe('GradingPeriodTemplate', () => {
  describe('create()', () => {
    it('creates a valid template with 3 items', () => {
      const template = GradingPeriodTemplate.create({
        name: 'Trimestral',
        level: 2,
        modality: 0,
        items: makeItems(),
      });

      expect(template.name).toBe('Trimestral');
      expect(template.level).toBe(2);
      expect(template.modality).toBe(0);
      expect(template.items).toHaveLength(3);
      expect(template.items[0].sortOrder).toBe(1);
      expect(template.items[1].sortOrder).toBe(2);
      expect(template.items[2].sortOrder).toBe(3);
      expect(template.active).toBe(true);
      expect(template.deletedAt).toBeNull();
      expect(template.id).toBeTruthy();
    });

    it('creates a template with no items (empty collection is allowed)', () => {
      const template = GradingPeriodTemplate.create({
        name: 'Sin ítems',
        level: 1,
        modality: 0,
        items: [],
      });
      expect(template.items).toHaveLength(0);
    });

    it('throws PeriodSortOrderDuplicateError when items have duplicate sortOrder', () => {
      expect(() =>
        GradingPeriodTemplate.create({
          name: 'Duplicado',
          level: 2,
          modality: 0,
          items: [
            { name: 'Período A', sortOrder: 1 },
            { name: 'Período B', sortOrder: 1 }, // duplicate
          ],
        }),
      ).toThrow(PeriodSortOrderDuplicateError);
    });

    it('throws PeriodTemplateItemNameDuplicateError when items have duplicate names', () => {
      expect(() =>
        GradingPeriodTemplate.create({
          name: 'Nombres dup',
          level: 2,
          modality: 0,
          items: [
            { name: 'Mismo', sortOrder: 1 },
            { name: 'Mismo', sortOrder: 2 }, // duplicate name
          ],
        }),
      ).toThrow(PeriodTemplateItemNameDuplicateError);
    });
  });

  describe('reconstruct()', () => {
    it('preserves all provided fields without re-validating', () => {
      const deletedAt = new Date('2025-01-01');
      const template = GradingPeriodTemplate.reconstruct({
        id: 'tmpl-1',
        name: 'Cuatrimestral',
        level: 4,
        modality: 0,
        active: false,
        deletedAt,
        items: [
          { id: 'item-1', templateId: 'tmpl-1', name: '1° Cuatrimestre', sortOrder: 1 },
          { id: 'item-2', templateId: 'tmpl-1', name: '2° Cuatrimestre', sortOrder: 2 },
        ],
      });

      expect(template.id).toBe('tmpl-1');
      expect(template.name).toBe('Cuatrimestral');
      expect(template.level).toBe(4);
      expect(template.active).toBe(false);
      expect(template.deletedAt).toBe(deletedAt);
      expect(template.items).toHaveLength(2);
      expect(template.items[0].id).toBe('item-1');
    });
  });

  describe('softDelete()', () => {
    it('marks deletedAt and sets active to false', () => {
      const template = GradingPeriodTemplate.create({
        name: 'Trimestral',
        level: 2,
        modality: 0,
        items: makeItems(),
      });
      template.softDelete();
      expect(template.active).toBe(false);
      expect(template.deletedAt).toBeInstanceOf(Date);
    });
  });
});
