import { useApiList, useApiCreate, useApiDelete, useApiUpdate } from './use-api';
import type { AcademicCycle, CreateAcademicCycleDto, UpdateAcademicCycleDto } from '../types/academic-cycle';
import { useState } from 'react';
import apiClient from '../api/client';

const BASE_URL = '/academic-cycles';

function withInstitution(url: string, institutionId?: string): string {
  return institutionId ? `${url}?institutionId=${institutionId}` : url;
}

export function useAcademicCycles(institutionId?: string, params?: Record<string, string>) {
  const allParams: Record<string, string> = { ...params };
  if (institutionId) allParams.institutionId = institutionId;
  return useApiList<AcademicCycle>(BASE_URL, Object.keys(allParams).length > 0 ? allParams : undefined);
}

export function useCreateAcademicCycle(institutionId?: string) {
  const queryParams = institutionId ? { institutionId } : undefined;
  return useApiCreate<CreateAcademicCycleDto>(BASE_URL, queryParams);
}

export function useUpdateAcademicCycle(institutionId?: string) {
  const queryParams = institutionId ? { institutionId } : undefined;
  return useApiUpdate<UpdateAcademicCycleDto>(BASE_URL, queryParams);
}

export function useDeleteAcademicCycle(institutionId?: string) {
  const base = institutionId ? withInstitution(BASE_URL, institutionId) : BASE_URL;
  return useApiDelete(base);
}

export function useToggleAcademicCycleActive(institutionId?: string) {
  const [toggling, setToggling] = useState(false);

  const toggle = async (uuid: string): Promise<boolean> => {
    setToggling(true);
    try {
      const url = institutionId
        ? `${BASE_URL}/${uuid}/toggle-active?institutionId=${institutionId}`
        : `${BASE_URL}/${uuid}/toggle-active`;
      await apiClient.patch(url);
      return true;
    } catch {
      return false;
    } finally {
      setToggling(false);
    }
  };

  return { toggling, toggle };
}
