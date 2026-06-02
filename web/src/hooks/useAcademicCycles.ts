import { useApiList, useApiCreate, useApiDelete, useApiUpdate } from './use-api';
import type { AcademicCycle, CreateAcademicCycleDto, UpdateAcademicCycleDto } from '../types/academic-cycle';
import { useState } from 'react';
import apiClient from '../api/client';

const BASE_URL = '/academic-cycles';

export function useAcademicCycles(params?: Record<string, string>) {
  return useApiList<AcademicCycle>(BASE_URL, params);
}

export function useCreateAcademicCycle() {
  return useApiCreate<CreateAcademicCycleDto>(BASE_URL);
}

export function useUpdateAcademicCycle() {
  return useApiUpdate<UpdateAcademicCycleDto>(BASE_URL);
}

export function useDeleteAcademicCycle() {
  return useApiDelete(BASE_URL);
}

export function useToggleAcademicCycleActive() {
  const [toggling, setToggling] = useState(false);

  const toggle = async (uuid: string): Promise<boolean> => {
    setToggling(true);
    try {
      await apiClient.patch(`${BASE_URL}/${uuid}/toggle-active`);
      return true;
    } catch {
      return false;
    } finally {
      setToggling(false);
    }
  };

  return { toggling, toggle };
}
