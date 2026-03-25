import { useEffect, useState } from 'react';
import type { SortingState } from '@tanstack/react-table';
import type { Employee, EmployeeNormalized } from '../../types';
import { normalizeEmployees } from '../../types';
import type { FilterState } from '../../utils';

interface UseEmployeesState {
  loading: boolean;
  error: string | null;
  data: EmployeeNormalized[];
  total: number;
}

interface UseEmployeesParams {
  page: number;
  pageSize: number;
  filters: FilterState;
  sorting: SortingState;
}

interface EmployeesResponse {
  total: number;
  page: number;
  pageSize: number;
  data: Employee[];
}

const apiUrl = import.meta.env.VITE_API_URL;

const formatDateQueryParam = (date: Date | null): string | null => {
  if (!date || Number.isNaN(date.getTime())) {
    return null;
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Custom hook for fetching and normalizing employee data.
 * Handles loading state, errors, and automatic normalization.
 *
 * @returns { loading, error, data }
 */
export function useEmployees({ page, pageSize, filters, sorting }: UseEmployeesParams): UseEmployeesState {
  const [state, setState] = useState<UseEmployeesState>({
    loading: true,
    error: null,
    data: [],
    total: 0,
  });

  useEffect(() => {
    const controller = new AbortController();
    let isMounted = true;

    async function fetchAndNormalize() {
      try {
        setState((prev) => ({ ...prev, loading: true, error: null }));

        const params = new URLSearchParams({
          page: String(page),
          pageSize: String(pageSize),
        });

        if (filters.textSearch.trim()) {
          params.set('search', filters.textSearch.trim());
        }

        const startDateFrom = formatDateQueryParam(filters.startDateFrom);
        if (startDateFrom) {
          params.set('startDateFrom', startDateFrom);
        }

        const startDateTo = formatDateQueryParam(filters.startDateTo);
        if (startDateTo) {
          params.set('startDateTo', startDateTo);
        }

        const primarySort = sorting[0];
        if (primarySort?.id) {
          params.set('sortBy', String(primarySort.id));
          params.set('sortOrder', primarySort.desc ? 'desc' : 'asc');
        }

        const response = await fetch(`${apiUrl}/employees?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }

        const payload = (await response.json()) as EmployeesResponse;
        const normalizedData = normalizeEmployees(payload.data);

        if (isMounted) {
          setState({
            loading: false,
            error: null,
            data: normalizedData,
            total: payload.total,
          });
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        }

        const errorMessage = err instanceof Error ? err.message : 'Unknown error';

        if (isMounted) {
          setState({
            loading: false,
            error: errorMessage,
            data: [],
            total: 0,
          });
        }
      }
    }

    fetchAndNormalize();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [page, pageSize, filters.textSearch, filters.startDateFrom, filters.startDateTo, sorting]);

  return state;
}
