import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { configQuery, configuredEndpoint } from '@/lib/realtime';

/**
 * Where the browser connects to Soketi: undefined while the config loads (wait before connecting), null for the page's
 * own host (nothing configured, or the config request failed), else { host, port, scheme }. The value is memoized:
 * it is safe as a useEffect dependency (a new object every render would reconnect every render).
 */
export function useRealtimeEndpoint() {
    const { data, isPending, isError } = useQuery(configQuery);

    return useMemo(() => {
        if (isPending) return undefined;
        if (isError) return null;
        return configuredEndpoint(data);
    }, [data, isPending, isError]);
}
