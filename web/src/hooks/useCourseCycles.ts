import { useApiList, useApiCreate, useApiDelete, useApiUpdate } from './use-api';
import type { CourseCycle, CreateCourseCycleDto, UpdateCourseCycleDto, GenerateCourseCyclesDto, GenerateResult } from '../types/course-cycle';
import { useState } from 'react';
import apiClient from '../api/client';

const BASE_URL = '/v1/course-cycles';

export function useCourseCycles(params?: Record<string, string>) {
  return useApiList<CourseCycle>(BASE_URL, params);
}

export function useCreateCourseCycle() {
  return useApiCreate<CreateCourseCycleDto>(BASE_URL);
}

export function useUpdateCourseCycle() {
  return useApiUpdate<UpdateCourseCycleDto>(BASE_URL);
}

export function useDeleteCourseCycle() {
  return useApiDelete(BASE_URL);
}

export function useToggleCourseCycleActive() {
  const [toggling, setToggling] = useState(false);

  const toggle = async (uuid: string, active: boolean): Promise<boolean> => {
    setToggling(true);
    try {
      const endpoint = active ? `${BASE_URL}/${uuid}/activate` : `${BASE_URL}/${uuid}/deactivate`;
      await apiClient.patch(endpoint);
      return true;
    } catch {
      return false;
    } finally {
      setToggling(false);
    }
  };

  return { toggling, toggle };
}

export function useGenerateCourseCycles() {
  const [generating, setGenerating] = useState(false);
  const [generateResult, setGenerateResult] = useState<GenerateResult | null>(null);

  const generate = async (dto: GenerateCourseCyclesDto): Promise<GenerateResult | null> => {
    setGenerating(true);
    setGenerateResult(null);
    try {
      const res = await apiClient.post(`${BASE_URL}/generate`, dto);
      const result = res.data?.data as GenerateResult;
      setGenerateResult(result);
      return result;
    } catch {
      return null;
    } finally {
      setGenerating(false);
    }
  };

  return { generating, generateResult, generate, setGenerateResult };
}
