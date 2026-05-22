import { useState, useEffect, useCallback } from 'react';
import apiClient from '../api/client';

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
  const create = async (body: T) => { setCreating(true); setCreateError(''); try { await apiClient.post(url, body); return true; } catch (e: any) { setCreateError(e?.response?.data?.messages?.[0] ?? e?.response?.data?.error ?? 'Error'); return false; } finally { setCreating(false); } };
  return { creating, createError, create, setCreateError };
}
