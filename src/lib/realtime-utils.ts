import { QueryClient } from '@tanstack/react-query';

/**
 * Utility to atomically update React Query cache without invalidating/refetching.
 * Supports both simple results and Paginated (Infinite Query) results.
 */

interface Identifiable {
    id: string | number;
}

interface PaginatedPage<T> {
    items?: T[];
    data?: T[];
    comments?: T[];
}

interface PaginatedData<T> {
    pages: PaginatedPage<T>[];
}

type CacheData<T> = T[] | PaginatedData<T> | PaginatedPage<T>;

/**
 * Upserts an item into a list or a set of paginated results.
 * If the item exists (by ID), it updates it.
 * If it doesn't exist, it adds it to the beginning of the first page.
 */
export function upsertInList<T extends Identifiable>(
    queryClient: QueryClient,
    queryKey: string[],
    newItem: T
) {
    // 🔒 TYPE FIX: Explicitly type oldData to avoid implicit any
    queryClient.setQueriesData<unknown>({ queryKey }, (oldData: unknown) => {
        if (!oldData) return oldData;

        // Case 1: Infinite Query (Paginated)
        if (typeof oldData === 'object' && 'pages' in oldData && Array.isArray((oldData as PaginatedData<T>).pages)) {
            let found = false;
            const newPages = (oldData as PaginatedData<T>).pages.map((page) => {
                const items = page.items || page.data || [];
                const index = items.findIndex((item) => item.id === newItem.id);
                if (index !== -1) {
                    found = true;
                    const newItems = [...items];
                    newItems[index] = { ...newItems[index], ...newItem };
                    return { ...page, items: newItems, data: newItems };
                }
                return page;
            });

            if (!found) {
                // Prepend to the first page
                const firstPage = newPages[0];
                const items = firstPage.items || firstPage.data || [];
                const newItems = [newItem, ...items];
                newPages[0] = { ...firstPage, items: newItems, data: newItems };
            }

            return { ...oldData, pages: newPages };
        }

        // Case 2: Simple Array
        if (Array.isArray(oldData)) {
            const index = oldData.findIndex((item: T) => item.id === newItem.id);
            if (index !== -1) {
                const newData = [...oldData];
                newData[index] = { ...newData[index], ...newItem };
                return newData;
            }
            return [newItem, ...oldData];
        }

        // Case 3: Object with 'items', 'data' or 'comments' array
        const objData = oldData as PaginatedPage<T>;
        const itemsKey: 'items' | 'data' | 'comments' | null = 
            objData.items ? 'items' : objData.comments ? 'comments' : objData.data ? 'data' : null;
        if (itemsKey && Array.isArray(objData[itemsKey])) {
            const items = objData[itemsKey] as T[];
            const index = items.findIndex((item) => item.id === newItem.id);
            if (index !== -1) {
                const newItems = [...items];
                newItems[index] = { ...newItems[index], ...newItem };
                return { ...oldData, [itemsKey]: newItems };
            }
            return { ...oldData, [itemsKey]: [newItem, ...items] };
        }

        return oldData;
    });
}

/**
 * Removes an item from a list or a set of paginated results.
 */
export function removeFromList<T extends Identifiable>(
    queryClient: QueryClient,
    queryKey: string[],
    id: string | number
) {
    queryClient.setQueriesData<CacheData<T>>({ queryKey }, (oldData) => {
        if (!oldData) return oldData;

        // Case 1: Infinite Query
        if ('pages' in oldData && Array.isArray(oldData.pages)) {
            const newPages = oldData.pages.map((page) => {
                const itemsKey: 'items' | 'data' | null = page.items ? 'items' : page.data ? 'data' : null;
                if (!itemsKey) return page;
                return {
                    ...page,
                    [itemsKey]: page[itemsKey]!.filter((item) => item.id !== id)
                };
            });
            return { ...oldData, pages: newPages };
        }

        // Case 2: Simple Array
        if (Array.isArray(oldData)) {
            return oldData.filter((item) => item.id !== id);
        }

        // Case 3: Object with 'items', 'data' or 'comments' array
        const objData = oldData as PaginatedPage<T>;
        const itemsKey: 'items' | 'data' | 'comments' | null = 
            objData.items ? 'items' : objData.comments ? 'comments' : objData.data ? 'data' : null;
        // 🔒 TYPE FIX: Cast to access dynamic property safely
        if (itemsKey && Array.isArray(objData[itemsKey])) {
            const items = objData[itemsKey] as T[];
            return {
                ...objData,
                [itemsKey]: items.filter((item) => item.id !== id)
            };
        }

        return oldData;
    });
}

/**
 * Patches a single object or an item within a list.
 * Supports partial object updates OR a functional update (old => new).
 */
export function patchItem<T extends Identifiable>(
    queryClient: QueryClient,
    queryKey: any[],
    id: string | number,
    updates: Partial<T> | ((old: T) => Partial<T>)
) {
    const applyUpdate = (item: T) => {
        const updateObj = typeof updates === 'function' ? updates(item) : updates;
        return { ...item, ...updateObj };
    };

    queryClient.setQueriesData<any>({ queryKey }, (oldData: any) => {
        if (!oldData) return oldData;

        // Case 1: The data itself is the object
        if (oldData.id === id) {
            return applyUpdate(oldData);
        }

        // Case 2: Data is nested in 'data' field
        if (oldData.data && oldData.data.id === id) {
            return { ...oldData, data: applyUpdate(oldData.data) };
        }

        // Case 3: Infinite Query
        if (oldData.pages && Array.isArray(oldData.pages)) {
            const newPages = oldData.pages.map((page: any) => {
                const itemsKey = page.items ? 'items' : page.data ? 'data' : null;
                if (!itemsKey) return page;
                const newItems = page[itemsKey].map((item: any) =>
                    item.id === id ? applyUpdate(item) : item
                );
                return { ...page, [itemsKey]: newItems };
            });
            return { ...oldData, pages: newPages };
        }

        // Case 4: Simple Array
        if (Array.isArray(oldData)) {
            return oldData.map((item: any) =>
                item.id === id ? applyUpdate(item) : item
            );
        }

        // Case 5: Object with 'items', 'data' or 'comments' array
        const itemsKey = oldData.items ? 'items' : oldData.comments ? 'comments' : oldData.data ? 'data' : null;
        if (itemsKey && Array.isArray(oldData[itemsKey])) {
            const newItems = oldData[itemsKey].map((item: any) =>
                item.id === id ? applyUpdate(item) : item
            );
            return { ...oldData, [itemsKey]: newItems };
        }

        return oldData;
    });
}
