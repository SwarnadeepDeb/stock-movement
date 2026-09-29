import { keepPreviousData, useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { getAllDesignsApi } from "../services/design.api.js";

export function useDesignListApi({ page = 1, limit = 20, keyword, sort } = {}) {
    return useQuery({
        queryKey: ["designs", { page, limit, keyword, sort }],
        queryFn: () => getAllDesignsApi({ page, limit, keyword, sort }),
        placeholderData: keepPreviousData,
    });
}

// Design Master dashboard: pages of design cards, loaded as the user asks for more.
export function useDesignInfiniteListApi({ limit = 24, keyword, sort }) {
    return useInfiniteQuery({
        queryKey: ["designs", "infinite", { limit, keyword, sort }],
        queryFn: ({ pageParam }) => getAllDesignsApi({ page: pageParam, limit, keyword, sort }),
        initialPageParam: 1,
        getNextPageParam: (lastPage) => (lastPage.meta.page < lastPage.meta.totalPages ? lastPage.meta.page + 1 : undefined),
        placeholderData: keepPreviousData,
    });
}
