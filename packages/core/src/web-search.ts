export interface SearchQuery {
    query: string;
    maxResults: number;
}
export interface SearchResult {
    title: string;
    url: string;
    snippet?: string;
    source?: string;
}
export interface SearchResponse {
    results: SearchResult[];
}
export interface WebSearchProvider {
    search(input: SearchQuery): Promise<SearchResponse>;
}
