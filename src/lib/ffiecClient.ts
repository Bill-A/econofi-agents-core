/**
 * FFIEC Geocoding Client
 *
 * Validates census tracts and retrieves tract demographic data via:
 *   1. US Census Bureau Geocoder API (address → lat/lng + census tract)
 *   2. FFIEC Census flat file data (tract → income level, minority %, MSA income)
 *
 * Results are cached in cra.ffiec_geocode_cache (24h TTL by default).
 *
 * No API key required — both services are free public government APIs.
 */

import axios, { type AxiosInstance } from 'axios';
import { createHash } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  FFIECGeocodeRequest,
  FFIECGeocodeResponse,
  IncomeLevel,
} from '../types/cra';
import type { Database } from '../types/database';

// ---------------------------------------------------------------------------
// Census Bureau Geocoder response shape (simplified)
// ---------------------------------------------------------------------------

interface CensusGeocoderResult {
  result?: {
    addressMatches?: Array<{
      geographies?: {
        'Census Tracts'?: Array<{
          GEOID: string;     // 11-digit tract FIPS
          TRACT: string;
          STATE: string;
          COUNTY: string;
        }>;
        'Metropolitan Statistical Areas'?: Array<{
          GEOID: string;
        }>;
      };
      matchedAddress?: string;
    }>;
  };
}

// ---------------------------------------------------------------------------
// FFIEC Census flat file API
// Provides income and demographic data keyed by state + county + tract
// ---------------------------------------------------------------------------

interface FFIECTractData {
  tractIncomePct: number;    // Tract median income as % of MSA median
  msaIncome: number;
  tractIncome: number;
  minorityPct: number;
  population: number;
}

// ---------------------------------------------------------------------------
// FFIECClient
// ---------------------------------------------------------------------------

export class FFIECClient {
  private readonly httpClient: AxiosInstance;
  private readonly supabase: SupabaseClient<Database> | null;
  private readonly cacheTtlSeconds: number;

  private static readonly CENSUS_GEOCODER_URL =
    'https://geocoding.geo.census.gov/geocoder/geographies/address';

  private static readonly FFIEC_CENSUS_URL =
    'https://www.ffiec.gov/censusapp/services/api/getcensusdatabygeoid';

  constructor(opts: {
    timeoutMs?: number;
    cacheTtlSeconds?: number;
    supabase?: SupabaseClient<Database>;
  } = {}) {
    this.httpClient = axios.create({
      timeout: opts.timeoutMs ?? 5000,
    });
    this.supabase = opts.supabase ?? null;
    this.cacheTtlSeconds = opts.cacheTtlSeconds ?? 86400;
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Verify a census tract code given a property address.
   * Returns null if the address cannot be geocoded.
   */
  async verifyTract(address: FFIECGeocodeRequest): Promise<FFIECGeocodeResponse | null> {
    const addressHash = this.hashAddress(address);

    // Check cache first
    const cached = await this.lookupFromCache(addressHash);
    if (cached !== null) {
      return cached;
    }

    // Call Census geocoder
    const tractInfo = await this.geocodeAddress(address);
    if (tractInfo === null) return null;

    // Call FFIEC for demographic data
    const demographics = await this.fetchTractDemographics(tractInfo.geoid);

    const response = this.buildResponse(address, tractInfo, demographics);

    // Save to cache
    await this.saveToCache(addressHash, response);

    return response;
  }

  /**
   * Look up cached geocode result by address hash.
   * Returns null on cache miss or if Supabase is not configured.
   */
  async lookupFromCache(addressHash: string): Promise<FFIECGeocodeResponse | null> {
    if (this.supabase === null) return null;

    const { data, error } = await this.supabase
      .schema('cra')
      .from('ffiec_geocode_cache')
      .select('*')
      .eq('address_hash', addressHash)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (error !== null || data === null) return null;

    return {
      success: true,
      address: { street: '', city: '', state: '', zip: '' }, // Not stored in cache
      census_tract: data.census_tract,
      msa_md: data.msa_md ?? '',
      county_code: data.county_code ?? '',
      tract_income_level: (data.tract_income_level as IncomeLevel) ?? 'middle',
      tract_minority_percentage: data.tract_minority_percentage ?? 0,
      tract_median_family_income: data.tract_median_family_income ?? 0,
      tract_population: data.tract_population ?? 0,
      msa_median_family_income: data.msa_median_family_income ?? 0,
      geocoding_quality: (data.geocoding_quality as FFIECGeocodeResponse['geocoding_quality']) ?? 'census_tract',
    };
  }

  /**
   * Persist geocode result to cache.
   */
  async saveToCache(
    addressHash: string,
    response: FFIECGeocodeResponse,
  ): Promise<void> {
    if (this.supabase === null) return;

    const expiresAt = new Date(Date.now() + this.cacheTtlSeconds * 1000).toISOString();

    await this.supabase
      .schema('cra')
      .from('ffiec_geocode_cache')
      .upsert({
        address_hash: addressHash,
        census_tract: response.census_tract,
        msa_md: response.msa_md,
        county_code: response.county_code,
        tract_income_level: response.tract_income_level,
        tract_minority_percentage: response.tract_minority_percentage,
        tract_median_family_income: response.tract_median_family_income,
        tract_population: response.tract_population,
        msa_median_family_income: response.msa_median_family_income,
        geocoding_quality: response.geocoding_quality,
        expires_at: expiresAt,
      });
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private hashAddress(address: FFIECGeocodeRequest): string {
    const normalized = [
      address.street.toLowerCase().trim(),
      address.city.toLowerCase().trim(),
      address.state.toUpperCase().trim(),
      address.zip.replace(/\D/g, '').slice(0, 5),
    ].join('|');
    return createHash('sha256').update(normalized).digest('hex');
  }

  private async geocodeAddress(
    address: FFIECGeocodeRequest,
  ): Promise<{ geoid: string; state: string; county: string; tract: string } | null> {
    try {
      const response = await this.httpClient.get<CensusGeocoderResult>(
        FFIECClient.CENSUS_GEOCODER_URL,
        {
          params: {
            street: address.street,
            city: address.city,
            state: address.state,
            zip: address.zip,
            benchmark: 'Public_AR_Current',
            vintage: 'Current_Current',
            layers: 'Census Tracts,Metropolitan Statistical Areas',
            format: 'json',
          },
        },
      );

      const matches = response.data?.result?.addressMatches;
      if (!matches || matches.length === 0) return null;

      const match = matches[0]!;
      const tracts = match.geographies?.['Census Tracts'];
      if (!tracts || tracts.length === 0) return null;

      const tract = tracts[0]!;
      return {
        geoid: tract.GEOID,
        state: tract.STATE,
        county: tract.COUNTY,
        tract: tract.TRACT,
      };
    } catch {
      return null;
    }
  }

  private async fetchTractDemographics(geoid: string): Promise<FFIECTractData | null> {
    try {
      const response = await this.httpClient.get<{ tractIncomePct?: number; msaIncome?: number; tractIncome?: number; minorityPct?: number; population?: number }>(
        FFIECClient.FFIEC_CENSUS_URL,
        { params: { geoid, year: new Date().getFullYear() - 1 } },
      );
      const d = response.data;
      return {
        tractIncomePct: d.tractIncomePct ?? 100,
        msaIncome: d.msaIncome ?? 0,
        tractIncome: d.tractIncome ?? 0,
        minorityPct: d.minorityPct ?? 0,
        population: d.population ?? 0,
      };
    } catch {
      return null;
    }
  }

  private formatTractId(geoid: string): string {
    // Census GEOID: 11-digit SSCCCTTTTBB → SS-CCC-TTTT.BB
    if (geoid.length !== 11) return geoid;
    const state = geoid.slice(0, 2);
    const county = geoid.slice(2, 5);
    const tract = geoid.slice(5, 9);
    const block = geoid.slice(9, 11);
    return `${state}-${county}-${tract}.${block}`;
  }

  private incomePctToLevel(pct: number): IncomeLevel {
    if (pct < 50) return 'low';
    if (pct < 80) return 'moderate';
    if (pct < 120) return 'middle';
    return 'upper';
  }

  private buildResponse(
    address: FFIECGeocodeRequest,
    tractInfo: { geoid: string; state: string; county: string; tract: string },
    demographics: FFIECTractData | null,
  ): FFIECGeocodeResponse {
    const tractIncomePct = demographics?.tractIncomePct ?? 100;
    return {
      success: true,
      address,
      census_tract: this.formatTractId(tractInfo.geoid),
      msa_md: '',
      county_code: `${tractInfo.state}${tractInfo.county}`,
      tract_income_level: this.incomePctToLevel(tractIncomePct),
      tract_minority_percentage: demographics?.minorityPct ?? 0,
      tract_median_family_income: demographics?.tractIncome ?? 0,
      tract_population: demographics?.population ?? 0,
      msa_median_family_income: demographics?.msaIncome ?? 0,
      geocoding_quality: 'exact',
    };
  }
}
