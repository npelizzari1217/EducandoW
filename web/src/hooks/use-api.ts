import { useState, useEffect, useCallback } from 'react';
import apiClient from '../api/client';
import { adaptListResponse } from '../api/adapters';

export type ApiError = { response?: { data?: { error?: { message?: string }; message?: string; messages?: string[] } }; message?: string };

/**
 * Extrae un mensaje de error string desde una respuesta de error de axios.
 */
export function extractErrorMessage(e: unknown): string {
  const err = e as ApiError;
  const data = err?.response?.data;
  if (!data) return err?.message ?? 'Error';

  // Array de mensajes (ej: NestJS { message: string[] }, o { messages: string[] })
  const arr = data.messages ?? data.message;
  if (Array.isArray(arr)) {
    const first = arr[0];
    if (typeof first === 'string') return first;
    if (first && typeof first === 'object' && 'message' in first) {
      const msg = (first as Record<string, unknown>).message;
      if (typeof msg === 'string') return msg;
    }
    return 'Error';
  }
  if (typeof arr === 'string') return arr;

  // Campo error (string u objeto anidado)
  const errorField = data.error;
  if (typeof errorField === 'string') return errorField;
  if (errorField && typeof errorField === 'object' && typeof errorField.message === 'string') return errorField.message;

  return err?.message ?? 'Error';
}

export function useApiList<T>(url: string, params?: Record<string, string>) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!url) {
      setData([]);
      setLoading(false);
      return;
    }
    setLoading(true); setError('');
    try { const res = await apiClient.get(url, { params }); setData(adaptListResponse<T>(res)); }
    catch { setError('Error al cargar datos'); }
    finally { setLoading(false); }
  }, [url, JSON.stringify(params)]);

  useEffect(() => { load(); }, [load]);
  return { data, loading, error, reload: load };
}

export function useApiDelete(url: string, queryParams?: Record<string, string>) {
  const [deleting, setDeleting] = useState(false);
  const del = async (id: string) => {
    setDeleting(true);
    try {
      await apiClient.delete(`${url}/${id}`, queryParams ? { params: queryParams } : undefined);
      return true;
    } catch { return false; } finally { setDeleting(false); }
  };
  return { deleting, del };
}

export function useApiCreate<T>(url: string, queryParams?: Record<string, string>) {
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const create = async (body: T) => {
    setCreating(true); setCreateError('');
    try { await apiClient.post(url, body, { params: queryParams }); return true; }
    catch (e: unknown) { setCreateError(extractErrorMessage(e)); return false; }
    finally { setCreating(false); }
  };
  return { creating, createError, create, setCreateError };
}

export function useApiUpdate<T>(url: string, queryParams?: Record<string, string>) {
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState('');
  const update = async (id: string, body: Partial<T>) => {
    setUpdating(true); setUpdateError('');
    try { await apiClient.patch(`${url}/${id}`, body, { params: queryParams }); return true; }
    catch (e: unknown) { setUpdateError(extractErrorMessage(e)); return false; }
    finally { setUpdating(false); }
  };
  return { updating, updateError, update, setUpdateError };
}
