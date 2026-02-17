import { useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '@/lib/api';
import { logError } from '@/lib/logger';
import { queryKeys } from '@/lib/queryKeys';
import type { PublicUserProfile, UserListItem } from '@/types/user';

interface FollowVariables {
    anonymousId: string;
    action: 'follow' | 'unfollow';
}

type UserQuerySnapshot = [readonly unknown[], unknown];

interface FollowMutationContext {
    previousUserQueries: UserQuerySnapshot[];
    previousProfile?: unknown;
}

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function isUserListItem(value: unknown): value is UserListItem {
    if (!isObject(value)) return false;
    return (
        typeof value.anonymous_id === 'string' &&
        typeof value.alias === 'string' &&
        typeof value.level === 'number' &&
        typeof value.is_following === 'boolean'
    );
}

function isPublicUserProfile(value: unknown): value is PublicUserProfile {
    if (!isObject(value) || !isObject(value.stats)) return false;
    return (
        typeof value.anonymous_id === 'string' &&
        typeof value.alias === 'string' &&
        typeof value.level === 'number' &&
        typeof value.points === 'number' &&
        typeof value.total_reports === 'number' &&
        typeof value.stats.followers_count === 'number' &&
        typeof value.stats.following_count === 'number' &&
        typeof value.stats.is_following === 'boolean'
    );
}

function patchUserListItem(
    item: UserListItem,
    anonymousId: string,
    nextFollowing: boolean
): UserListItem {
    if (item.anonymous_id !== anonymousId) return item;
    return {
        ...item,
        is_following: nextFollowing,
        is_following_back: nextFollowing,
    };
}

function patchPublicProfile(
    profile: PublicUserProfile,
    anonymousId: string,
    delta: 1 | -1
): PublicUserProfile {
    if (profile.anonymous_id !== anonymousId) return profile;
    const nextFollowersCount = Math.max(0, profile.stats.followers_count + delta);
    return {
        ...profile,
        stats: {
            ...profile.stats,
            is_following: delta > 0,
            followers_count: nextFollowersCount,
        },
    };
}

function patchUserQueryData(
    data: unknown,
    anonymousId: string,
    delta: 1 | -1
): unknown {
    const nextFollowing = delta > 0;

    if (Array.isArray(data)) {
        return data.map((entry) =>
            isUserListItem(entry)
                ? patchUserListItem(entry, anonymousId, nextFollowing)
                : entry
        );
    }

    if (isPublicUserProfile(data)) {
        return patchPublicProfile(data, anonymousId, delta);
    }

    return data;
}

export function useFollowMutation() {
    const queryClient = useQueryClient();

    return useMutation<void, Error, FollowVariables, FollowMutationContext>({
        mutationFn: async ({ anonymousId, action }) => {
            if (action === 'follow') {
                await usersApi.follow(anonymousId);
            } else {
                await usersApi.unfollow(anonymousId);
            }
        },
        onMutate: async ({ anonymousId, action }) => {
            const delta: 1 | -1 = action === 'follow' ? 1 : -1;

            await queryClient.cancelQueries({ queryKey: ['user'] });

            const previousUserQueries = queryClient.getQueriesData({ queryKey: ['user'] });
            const previousProfile = queryClient.getQueryData(queryKeys.user.profile);

            previousUserQueries.forEach(([queryKey, queryData]) => {
                const patched = patchUserQueryData(queryData, anonymousId, delta);
                if (patched !== queryData) {
                    queryClient.setQueryData(queryKey, patched);
                }
            });

            queryClient.setQueryData(queryKeys.user.profile, (oldData: unknown) => {
                if (!isObject(oldData)) return oldData;
                const currentFollowingCount = oldData.following_count;
                if (typeof currentFollowingCount !== 'number') return oldData;
                return {
                    ...oldData,
                    following_count: Math.max(0, currentFollowingCount + delta),
                };
            });

            return { previousUserQueries, previousProfile };
        },
        onError: (err, _variables, context) => {
            context?.previousUserQueries.forEach(([queryKey, queryData]) => {
                queryClient.setQueryData(queryKey, queryData);
            });
            if (context && context.previousProfile !== undefined) {
                queryClient.setQueryData(queryKeys.user.profile, context.previousProfile);
            }
            logError(err, 'useFollowMutation');
        },
        onSettled: () => {
            // Safety net: sync with server truth after optimistic update.
            void queryClient.invalidateQueries({ queryKey: ['user'] });
            void queryClient.invalidateQueries({ queryKey: ['notifications'] });
        },
    });
}
