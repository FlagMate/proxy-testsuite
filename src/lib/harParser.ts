// HAR (HTTP Archive) Parser for Restify Phase 2
// Converts HAR files to Restify API requests for production debugging

export interface HAREntry {
  request: {
    method: string;
    url: string;
    headers: Array<{ name: string; value: string }>;
    postData?: {
      mimeType: string;
      text: string;
    };
    queryString: Array<{ name: string; value: string }>;
  };
  response: {
    status: number;
    statusText: string;
    headers: Array<{ name: string; value: string }>;
    content: {
      mimeType: string;
      text?: string;
    };
  };
  time: number;
}

export interface HARFile {
  log: {
    version: string;
    creator: {
      name: string;
      version: string;
    };
    entries: HAREntry[];
  };
}

export interface HARImportFilters {
  domain?: string;    // comma-separated or single domain
  route?: string;     // comma-separated or single route
  domains?: string[]; // array of domain tags
  routes?: string[];  // array of route tags
  deduplicate?: boolean; // keep only first occurrence of repeated endpoints (polling APIs)
}

export interface ProcessedHARRequest {
  id: string;
  name: string;
  method: string;
  url: string;
  headers: Array<{ key: string; value: string; enabled: boolean }>;
  body: string;
  bodyType: 'none' | 'raw';
  rawType: 'json' | 'text';
  collectionId: string;
  originalDomain: string;
  originalPath: string;
  repeatCount?: number;
}

export class HARParser {
  /**
   * Parse and validate HAR file content
   */
  static parseHARFile(harContent: string): HARFile {
    try {
      const harData = JSON.parse(harContent);
      
      if (!harData.log || !harData.log.entries || !Array.isArray(harData.log.entries)) {
        throw new Error('Invalid HAR file format: Missing log.entries array');
      }

      return harData as HARFile;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error('Invalid HAR file: Not valid JSON');
      }
      throw error;
    }
  }

  /**
   * Extract unique domains/hostnames found in HAR entries, sorted by request volume
   */
  static extractDomains(entries: HAREntry[]): string[] {
    const domainCounts = new Map<string, number>();
    if (!Array.isArray(entries)) return [];
    
    for (const entry of entries) {
      try {
        if (entry?.request?.url) {
          const u = new URL(entry.request.url);
          const host = u.hostname.toLowerCase().trim();
          if (host) {
            domainCounts.set(host, (domainCounts.get(host) || 0) + 1);
          }
        }
      } catch {}
    }
    return Array.from(domainCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([domain]) => domain);
  }

  /**
   * Count occurrences of each unique method + URL across HAR entries
   */
  static getEndpointCounts(entries: HAREntry[]): Map<string, number> {
    const counts = new Map<string, number>();
    if (!Array.isArray(entries)) return counts;
    for (const entry of entries) {
      if (entry?.request?.url) {
        const method = (entry.request.method || 'GET').toUpperCase();
        const key = `${method} ${entry.request.url.trim()}`;
        counts.set(key, (counts.get(key) || 0) + 1);
      }
    }
    return counts;
  }

  /**
   * Normalize an array or comma-separated string of domain filters
   */
  static normalizeDomainList(filters: HARImportFilters): string[] {
    const list: string[] = [];
    const addClean = (raw: string) => {
      let t = (raw || '').toLowerCase().trim();
      t = t.replace(/^https?:\/\//i, '').replace(/:\d+$/, '').replace(/\/.*$/, '').trim();
      if (t.startsWith('*.')) t = t.slice(2);
      if (t && !list.includes(t)) list.push(t);
    };

    if (Array.isArray(filters.domains)) {
      filters.domains.forEach(d => {
        if (typeof d === 'string' && d.trim()) {
          d.split(/[, ]+/).forEach(addClean);
        }
      });
    }
    if (typeof filters.domain === 'string' && filters.domain.trim()) {
      filters.domain.split(/[, ]+/).forEach(addClean);
    }
    return list;
  }

  /**
   * Normalize an array or comma-separated string of route filters
   */
  static normalizeRouteList(filters: HARImportFilters): string[] {
    const list: string[] = [];
    const addClean = (raw: string) => {
      const clean = (raw || '').trim();
      if (clean && !list.includes(clean)) list.push(clean);
    };

    if (Array.isArray(filters.routes)) {
      filters.routes.forEach(r => {
        if (typeof r === 'string' && r.trim()) {
          r.split(',').forEach(addClean);
        }
      });
    }
    if (typeof filters.route === 'string' && filters.route.trim()) {
      filters.route.split(',').forEach(addClean);
    }
    return list;
  }

  /**
   * Check if a hostname matches a target domain pattern.
   * Supports:
   * - Exact matches: apiv2.sonyliv.com === apiv2.sonyliv.com
   * - Subdomain matches: apiv2.sonyliv.com ends with .sonyliv.com
   * - Root domain matches: sonyliv.com matches www.sonyliv.com
   * - Wildcards: *.sonyliv.com
   */
  static matchesDomain(hostname: string, targetPattern: string): boolean {
    const h = (hostname || '').toLowerCase().trim();
    let t = (targetPattern || '').toLowerCase().trim();
    t = t.replace(/^https?:\/\//i, '').replace(/:\d+$/, '').replace(/\/.*$/, '').trim();
    if (t.startsWith('*.')) t = t.slice(2);
    if (!t) return true;

    if (h === t) return true;
    if (h.endsWith('.' + t)) return true;
    if (t.endsWith('.' + h)) return true;

    return false;
  }

  /**
   * Check if a path matches any pattern in the route list
   */
  static matchesRoute(pathname: string, routeList: string[]): boolean {
    if (!routeList || routeList.length === 0) return true;
    const p = (pathname || '').toLowerCase();
    return routeList.some(r => {
      const target = r.toLowerCase().trim();
      return target.length > 0 && p.includes(target);
    });
  }

  /**
   * Filter HAR entries based on domain and route criteria
   */
  static filterEntries(entries: HAREntry[], filters: HARImportFilters): HAREntry[] {
    const domainList = this.normalizeDomainList(filters);
    const routeList = this.normalizeRouteList(filters);

    const filtered = entries.filter(entry => {
      if (!entry?.request?.url) return false;

      let url: URL;
      try {
        url = new URL(entry.request.url);
      } catch (e) {
        return false;
      }

      const domain = url.hostname;
      const path = url.pathname;

      // 1. Domain filter: If domains specified, must match at least one
      if (domainList.length > 0) {
        const matchesAnyDomain = domainList.some(d => this.matchesDomain(domain, d));
        if (!matchesAnyDomain) {
          return false;
        }
      }

      // 2. Route filter: If routes specified, must match at least one
      if (routeList.length > 0) {
        const matchesAnyRoute = this.matchesRoute(path, routeList);
        if (!matchesAnyRoute) {
          return false;
        }
      }

      // 3. Skip static media and asset extensions
      const staticExtRegex = /\.(png|jpg|jpeg|gif|webp|ico|svg|css|woff|woff2|ttf|eot|otf|mp4|m3u8|ts|mpd|avi|mov)$/i;
      if (staticExtRegex.test(path)) {
        return false;
      }

      // Check response content-type or mimeType if present
      const mimeType = (entry.response?.content?.mimeType || '').toLowerCase();
      if (mimeType.startsWith('image/') || mimeType.startsWith('video/') || mimeType.startsWith('audio/') || mimeType === 'text/css') {
        return false;
      }

      // If user supplied explicit domain or route filters, keep all non-static requests!
      if (domainList.length > 0 || routeList.length > 0) {
        return true;
      }

      // Fallback heuristic when no filter is provided: only include API/JSON endpoints
      const isJSONAPI = mimeType.includes('application/json') || 
                       mimeType.includes('application/vnd.api+json') ||
                       mimeType.includes('text/json');

      const isAPIEndpoint = path.includes('/api/') || 
                           path.includes('/v1/') || 
                           path.includes('/v2/') ||
                           path.includes('/agl/') ||
                           entry.request.method !== 'GET' ||
                           (entry.request.headers || []).some(h => 
                             h.name.toLowerCase() === 'content-type' && 
                             h.value.includes('application/json')
                           );

      return isJSONAPI || isAPIEndpoint;
    });

    // Deduplicate repeated calls if requested (default true)
    if (filters.deduplicate !== false) {
      const seen = new Set<string>();
      const deduped: HAREntry[] = [];
      for (const entry of filtered) {
        const method = (entry.request.method || 'GET').toUpperCase();
        const key = `${method} ${entry.request.url.trim()}`;
        if (!seen.has(key)) {
          seen.add(key);
          deduped.push(entry);
        }
      }
      return deduped;
    }

    return filtered;
  }

  /**
   * Convert HAR entries to Restify API requests
   */
  static convertToRestifyRequests(
    entries: HAREntry[], 
    collectionId: string,
    endpointCounts?: Map<string, number>
  ): ProcessedHARRequest[] {
    return entries.map((entry, index) => {
      const url = new URL(entry.request.url);
      const domain = url.hostname;
      const path = url.pathname;
      
      const key = `${(entry.request.method || 'GET').toUpperCase()} ${entry.request.url.trim()}`;
      const repeatCount = endpointCounts?.get(key) || 1;

      // Generate meaningful request name
      const requestName = this.generateRequestName(entry.request.method, path, domain);
      
      // Convert headers
      const headers = entry.request.headers
        .filter(h => !this.isSystemHeader(h.name))
        .map(h => ({
          key: h.name,
          value: h.value,
          enabled: true
        }));

      // Add empty header for user additions
      headers.push({ key: '', value: '', enabled: true });

      // Extract request body
      let body = '';
      let bodyType: 'none' | 'raw' = 'none';
      let rawType: 'json' | 'text' = 'json';

      if (entry.request.postData && entry.request.postData.text) {
        body = entry.request.postData.text;
        bodyType = 'raw';
        
        // Detect content type
        const contentType = entry.request.postData.mimeType.toLowerCase();
        rawType = contentType.includes('json') ? 'json' : 'text';
        
        // Try to format JSON
        if (rawType === 'json') {
          try {
            body = JSON.stringify(JSON.parse(body), null, 2);
          } catch {
            // Keep original if not valid JSON
          }
        }
      }

      return {
        id: `har_${Date.now()}_${index}`,
        name: requestName,
        method: entry.request.method.toUpperCase(),
        url: entry.request.url,
        headers,
        body,
        bodyType,
        rawType,
        collectionId,
        originalDomain: domain,
        originalPath: path,
        repeatCount
      };
    });
  }

  /**
   * Generate meaningful request names from HTTP method and path
   */
  private static generateRequestName(method: string, path: string, domain: string): string {
    // Remove query parameters and file extensions for cleaner names
    const cleanPath = path.split('?')[0];
    const pathParts = cleanPath.split('/').filter(Boolean);
    
    // Generate descriptive name
    if (pathParts.length === 0) {
      return `${method} ${domain}`;
    }
    
    // Use last 2-3 meaningful path segments
    const meaningfulParts = pathParts
      .slice(-3)
      .filter(part => !part.match(/^[0-9a-f-]{8,}$/i)) // Remove UUIDs/IDs
      .slice(-2);
    
    const pathName = meaningfulParts.length > 0 
      ? meaningfulParts.join(' / ')
      : pathParts.slice(-1)[0];
    
    return `${method} ${pathName}`;
  }

  /**
   * Check if header should be excluded (system/automatic headers)
   */
  private static isSystemHeader(headerName: string): boolean {
    const systemHeaders = [
      'host',
      'content-length',
      'connection',
      'upgrade-insecure-requests',
      'sec-fetch-dest',
      'sec-fetch-mode',  
      'sec-fetch-site',
      'sec-fetch-user',
      'sec-ch-ua',
      'sec-ch-ua-mobile',
      'sec-ch-ua-platform'
    ];
    
    return systemHeaders.includes(headerName.toLowerCase());
  }

  /**
   * Generate collection name from HAR import
   */
  static generateCollectionName(filters: HARImportFilters, requestCount: number): string {
    const timestamp = new Date().toISOString().split('T')[0];
    const domains = this.normalizeDomainList(filters);
    const routes = this.normalizeRouteList(filters);
    
    if (domains.length > 0) {
      const domainLabel = domains.slice(0, 2).join(' + ') + (domains.length > 2 ? ` (+${domains.length - 2})` : '');
      const routeInfo = routes.length > 0 ? ` (${routes.slice(0, 2).join(', ')})` : '';
      return `${domainLabel}${routeInfo} - HAR Import ${timestamp}`;
    }
    
    return `HAR Import ${timestamp} (${requestCount} requests)`;
  }

  /**
   * Get import summary statistics
   */
  static getImportSummary(
    originalCount: number, 
    filteredCount: number, 
    filters: HARImportFilters,
    duplicatesExcluded: number = 0
  ) {
    const domains = this.normalizeDomainList(filters);
    const routes = this.normalizeRouteList(filters);
    return {
      totalEntries: originalCount,
      filteredEntries: filteredCount,
      skippedEntries: originalCount - filteredCount,
      duplicatesExcluded,
      domainFilter: domains.length > 0 ? domains.join(', ') : 'All domains',
      routeFilter: routes.length > 0 ? routes.join(', ') : 'All routes',
      domainList: domains,
      routeList: routes,
    };
  }
}

/**
 * Parse HAR content and extract entries
 */
export function parseHAR(harContent: any) {
  if (!harContent || !harContent.log || !Array.isArray(harContent.log.entries)) {
    throw new Error('Invalid HAR content');
  }
  return harContent.log.entries;
}

export default HARParser;
