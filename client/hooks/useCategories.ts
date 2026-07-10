import { useState, useEffect, useCallback } from 'react';
import { apiService } from '../src/_services/apiService';
import { DEFAULT_CATEGORIES } from '../lib/firebaseHelpers/index';

let cachedCategories: any[] | null = null;

export function useCategories() {
  const defaultCategoryObjects = Array.isArray(DEFAULT_CATEGORIES)
    ? DEFAULT_CATEGORIES.map((cat: any) =>
      typeof cat === 'string' ? { name: cat, image: '' } : cat
    )
    : [];

  const [categories, setCategories] = useState(cachedCategories || defaultCategoryObjects);

  const loadCategories = useCallback(async (force = false) => {
    if (cachedCategories && !force) {
      setCategories(cachedCategories);
      return;
    }
    try {
      const cats = await apiService.getCategories();
      if (cats?.success && Array.isArray(cats.data)) {
        const mappedCats = cats.data.map((c: any) => {
          if (typeof c === 'string') return { name: c, image: '' };
          return {
            name: typeof c.name === 'string' ? c.name : '',
            image: typeof c.image === 'string' ? c.image : ''
          };
        }).filter((c: any) => c.name);
        cachedCategories = mappedCats;
        setCategories(mappedCats);
      }
    } catch (error) {
      console.error('[useCategories] Load error:', error);
      if (!cachedCategories) {
        setCategories(defaultCategoryObjects);
      }
    }
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  return { categories, loadCategories };
}
