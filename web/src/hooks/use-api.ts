import { useState, useEffect, useCallback } from 'react';
import apiClient from '../api/client';

/**
 * Extrae un mensaje de error string desde una respuesta de error de axios.
 * Maneja múltiples formatos comunes de API (NestJS validation pipe,
 * errores anidados, arrays de mensajes, etc.).
 */
function extractErrorMessage(e: any): string {
  const data = e?.response?.data;
  if (!data) return e?.message ?? 'Error';

  // Array de mensajes (ej: NestJS { message: string[] }, o { messages: string[] })
  const arr = data.messages ?? data.message;
  if (Array.isArray(arr)) {
    const first = arr[0];
    if (typeof first === 'string') return first;
    if (first && typeof first === 'object' && typeof first.message === 'string') return first.message;
    return 'Error';
  }
  if (typeof arr === 'string') return arr;

  // Campo error (string u objeto anidado)
  const err = data.error;
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object' && typeof err.message === 'string') return err.message;

  return e?.message ?? 'Error';
}

export function useApiList<T>(url: string, params?: Record<string, string>) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { const res = await apiClient.get(url, { params }); setData(res.data.data ?? []); }
    catch { setError('Error al cargar datos'); }
    finally { setLoading(false); }
  }, [url, JSON.stringify(params)]);

  useEffect(() => { load(); }, [load]);
  return { data, loading, error, reload: load };
}

export function useApiDelete(url: string) {
  const [deleting, setDeleting] = useState(false);
  const del = async (id: string) => { setDeleting(true); try { await apiClient.delete(`${url}/${id}`); return true; } catch { return false; } finally { setDeleting(false); } };
  return { deleting, del };
}

export function useApiCreate<T>(url: string) {
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const create = async (body: T) => {
    setCreating(true); setCreateError('');
    try { await apiClient.post(url, body); return true; }
    catch (e: any) { setCreateError(extractErrorMessage(e)); return false; }
    finally { setCreating(false); }
  };
  return { creating, createError, create, setCreateError };
}

export function useApiUpdate<T>(url: string) {
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState('');
  const update = async (id: string, body: Partial<T>) => {
    setUpdating(true); setUpdateError('');
    try { await apiClient.patch(`${url}/${id}`, body); return true; }
    catch (e: any) { setUpdateError(extractErrorMessage(e)); return false; }
    finally { setUpdating(false); }
  };
  return { updating, updateError, update, setUpdateError };
}
