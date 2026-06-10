import { useState, useEffect } from 'react';
import apiClient from '../../api/client';

export interface TeacherGradingAccess {
  hasCourse: boolean;
  hasSubject: boolean;
  loading: boolean;
}

type MinimalUser = {
  id: string;
  role?: string;
  roles?: string[];
  modules?: { moduleCode: string; actions: string[] }[];
} | null;

function isRootUser(user: MinimalUser): boolean {
  if (!user) return false;
  return user.roles?.includes('ROOT') || user.role === 'ROOT' || false;
}

function hasGradesRead(user: MinimalUser): boolean {
  if (!user?.modules) return false;
  return user.modules.some(
    (m) => m.moduleCode === 'GRADES' && m.actions.includes('READ'),
  );
}

/**
 * Determines whether the current teacher has homeroom (course) and/or subject
 * assignments, which gates the two grading sidebar items:
 *   /competency-grading   → hasSubject
 *   /grading/by-course    → hasCourse
 *
 * ROOT bypasses the fetch and immediately returns both as true.
 * Users without GRADES READ permission never fetch (items are hidden by
 * the existing filterItem anyway).
 * While loading is true, both items should be suppressed (no flicker).
 */
export function useTeacherGradingAccess(user: MinimalUser): TeacherGradingAccess {
  const root = isRootUser(user);
  const shouldFetch = !root && hasGradesRead(user) && !!user?.id;

  const [hasCourse, setHasCourse] = useState(false);
  const [hasSubject, setHasSubject] = useState(false);
  // Start loading only when we know we'll fetch
  const [loading, setLoading] = useState(shouldFetch);

  useEffect(() => {
    if (!user?.id) return;

    const isRoot = isRootUser(user);
    const canGrades = hasGradesRead(user);

    // ROOT and no-GRADES cases don't fetch — ensure loading is cleared
    if (isRoot || !canGrades) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    Promise.all([
      apiClient.get('/course-cycles', {
        params: { teacherUserId: user.id, role: 'homeroom' },
      }),
      apiClient.get('/course-cycles', {
        params: { teacherUserId: user.id, role: 'subject' },
      }),
    ])
      .then(([homeroomRes, subjectRes]) => {
        if (cancelled) return;
        const homeroomData: unknown[] = homeroomRes.data?.data ?? [];
        const subjectData: unknown[] = subjectRes.data?.data ?? [];
        setHasCourse(homeroomData.length > 0);
        setHasSubject(subjectData.length > 0);
      })
      .catch(() => {
        if (cancelled) return;
        setHasCourse(false);
        setHasSubject(false);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ROOT bypasses: both visible immediately, no state needed
  if (root) return { hasCourse: true, hasSubject: true, loading: false };

  return { hasCourse, hasSubject, loading };
}
